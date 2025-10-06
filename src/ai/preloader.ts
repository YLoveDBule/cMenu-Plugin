import { CacheManager } from "./cacheManager";
import { runChat } from "./aiClient";
import type { AISettings } from "src/settings/settingsData";

export interface PreloadRule {
  id: string;
  name: string;
  template: string;
  priority: 'high' | 'medium' | 'low';
  triggers: {
    fileTypes?: string[];        // 文件类型触发 ['.md', '.txt']
    contentPatterns?: string[];  // 内容模式触发 ['# ', '```']
    selectionLength?: { min: number; max: number };
    timeOfDay?: { start: number; end: number }; // 时间触发 (小时)
  };
  sampleInputs: string[];       // 预加载用的示例输入
  enabled: boolean;
}

export interface PreloadStats {
  totalRules: number;
  activeRules: number;
  preloadedCount: number;
  cacheHitRate: number;
  lastPreloadTime: number;
  averagePreloadTime: number;
}

export class PreloadManager {
  private static instance: PreloadManager;
  private rules: Map<string, PreloadRule> = new Map();
  private isPreloading = false;
  private preloadQueue: Array<{rule: PreloadRule, input: string}> = [];
  private stats: PreloadStats = {
    totalRules: 0,
    activeRules: 0,
    preloadedCount: 0,
    cacheHitRate: 0,
    lastPreloadTime: 0,
    averagePreloadTime: 0
  };
  
  private preloadTimes: number[] = [];
  private maxPreloadTimes = 10; // 保留最近10次的时间记录

  static getInstance(): PreloadManager {
    if (!PreloadManager.instance) {
      PreloadManager.instance = new PreloadManager();
    }
    return PreloadManager.instance;
  }

  constructor() {
    this.initializeDefaultRules();
    this.startIdlePreloading();
  }

  /**
   * 初始化默认预加载规则
   */
  private initializeDefaultRules(): void {
    const defaultRules: PreloadRule[] = [
      {
        id: 'optimize_common',
        name: '常用优化',
        template: '请优化以下文本，使其更加清晰、简洁和易读：\n\n{selection}',
        priority: 'high',
        triggers: {
          fileTypes: ['.md', '.txt'],
          selectionLength: { min: 50, max: 500 }
        },
        sampleInputs: [
          '这是一个需要优化的示例文本，包含了一些常见的表达方式。',
          '我们需要改进这个文档的质量，让它更容易理解。',
          '以下内容可能存在一些问题，需要进行相应的调整和完善。'
        ],
        enabled: true
      },
      {
        id: 'translate_common',
        name: '常用翻译',
        template: '请将以下文本翻译成中文：\n\n{selection}',
        priority: 'high',
        triggers: {
          contentPatterns: ['hello', 'the', 'and', 'is', 'to'],
          selectionLength: { min: 10, max: 200 }
        },
        sampleInputs: [
          'Hello world, this is a sample text for translation.',
          'The quick brown fox jumps over the lazy dog.',
          'This is a common English sentence that needs translation.'
        ],
        enabled: true
      },
      {
        id: 'summarize_common',
        name: '常用总结',
        template: '请总结以下内容的要点：\n\n{selection}',
        priority: 'medium',
        triggers: {
          selectionLength: { min: 200, max: 2000 },
          fileTypes: ['.md', '.txt']
        },
        sampleInputs: [
          '这是一个较长的文档内容，包含了多个段落和要点。我们需要从中提取关键信息，形成简洁的总结。这样可以帮助读者快速理解文档的核心内容。',
          '在现代软件开发中，性能优化是一个重要的话题。开发者需要考虑多个方面，包括算法效率、内存使用、网络请求优化等。通过合理的优化策略，可以显著提升应用的用户体验。'
        ],
        enabled: true
      },
      {
        id: 'explain_code',
        name: '代码解释',
        template: '请解释以下代码的功能和工作原理：\n\n```\n{selection}\n```',
        priority: 'medium',
        triggers: {
          contentPatterns: ['function', 'const', 'let', 'var', 'class', 'import'],
          fileTypes: ['.js', '.ts', '.py', '.java']
        },
        sampleInputs: [
          'function calculateSum(a, b) {\n  return a + b;\n}',
          'const users = await fetch("/api/users").then(res => res.json());',
          'class UserManager {\n  constructor() {\n    this.users = [];\n  }\n}'
        ],
        enabled: true
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
    
    this.updateStats();
  }

  /**
   * 添加预加载规则
   */
  public addRule(rule: PreloadRule): void {
    this.rules.set(rule.id, rule);
    this.updateStats();
    console.log(`[PreloadManager] Added rule: ${rule.name}`);
  }

  /**
   * 移除预加载规则
   */
  public removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      this.updateStats();
      console.log(`[PreloadManager] Removed rule: ${ruleId}`);
    }
    return removed;
  }

  /**
   * 更新预加载规则
   */
  public updateRule(ruleId: string, updates: Partial<PreloadRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    
    this.rules.set(ruleId, { ...rule, ...updates });
    this.updateStats();
    console.log(`[PreloadManager] Updated rule: ${ruleId}`);
    return true;
  }

  /**
   * 获取所有规则
   */
  public getRules(): PreloadRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 根据上下文触发预加载
   */
  public async triggerPreload(context: {
    fileType?: string;
    content?: string;
    selectionLength?: number;
    currentTime?: Date;
  }, ai: AISettings): Promise<void> {
    if (this.isPreloading) return;
    
    const matchingRules = this.findMatchingRules(context);
    if (matchingRules.length === 0) return;

    console.log(`[PreloadManager] Found ${matchingRules.length} matching rules for context`);
    
    // 按优先级排序
    matchingRules.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // 添加到预加载队列
    for (const rule of matchingRules.slice(0, 3)) { // 最多预加载3个规则
      for (const sampleInput of rule.sampleInputs.slice(0, 2)) { // 每个规则最多2个示例
        this.preloadQueue.push({ rule, input: sampleInput });
      }
    }

    // 开始预加载
    this.processPreloadQueue(ai);
  }

  /**
   * 查找匹配的规则
   */
  private findMatchingRules(context: {
    fileType?: string;
    content?: string;
    selectionLength?: number;
    currentTime?: Date;
  }): PreloadRule[] {
    const matchingRules: PreloadRule[] = [];
    const currentHour = context.currentTime?.getHours() || new Date().getHours();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      let matches = true;

      // 检查文件类型
      if (rule.triggers.fileTypes && context.fileType) {
        matches = matches && rule.triggers.fileTypes.some(type => 
          context.fileType?.endsWith(type)
        );
      }

      // 检查内容模式
      if (rule.triggers.contentPatterns && context.content) {
        matches = matches && rule.triggers.contentPatterns.some(pattern =>
          context.content?.toLowerCase().includes(pattern.toLowerCase())
        );
      }

      // 检查选择长度
      if (rule.triggers.selectionLength && context.selectionLength !== undefined) {
        const { min, max } = rule.triggers.selectionLength;
        matches = matches && context.selectionLength >= min && context.selectionLength <= max;
      }

      // 检查时间
      if (rule.triggers.timeOfDay) {
        const { start, end } = rule.triggers.timeOfDay;
        matches = matches && currentHour >= start && currentHour <= end;
      }

      if (matches) {
        matchingRules.push(rule);
      }
    }

    return matchingRules;
  }

  /**
   * 处理预加载队列
   */
  private async processPreloadQueue(ai: AISettings): Promise<void> {
    if (this.isPreloading || this.preloadQueue.length === 0) return;

    this.isPreloading = true;
    const startTime = performance.now();
    let preloadedCount = 0;

    try {
      while (this.preloadQueue.length > 0) {
        const item = this.preloadQueue.shift();
        if (!item) break;

        try {
          await this.preloadSingle(item.rule, item.input, ai);
          preloadedCount++;
          
          // 避免过于频繁的请求
          await this.sleep(100);
        } catch (error) {
          console.warn(`[PreloadManager] Failed to preload for rule ${item.rule.id}:`, error);
        }
      }
    } finally {
      this.isPreloading = false;
      
      // 更新统计信息
      const endTime = performance.now();
      const preloadTime = endTime - startTime;
      this.preloadTimes.push(preloadTime);
      if (this.preloadTimes.length > this.maxPreloadTimes) {
        this.preloadTimes.shift();
      }
      
      this.stats.preloadedCount += preloadedCount;
      this.stats.lastPreloadTime = Date.now();
      this.stats.averagePreloadTime = this.preloadTimes.reduce((a, b) => a + b, 0) / this.preloadTimes.length;
      
      console.log(`[PreloadManager] Preloaded ${preloadedCount} items in ${preloadTime.toFixed(2)}ms`);
    }
  }

  /**
   * 预加载单个项目
   */
  private async preloadSingle(rule: PreloadRule, input: string, ai: AISettings): Promise<void> {
    const cache = CacheManager.getInstance();
    const model = (ai.model && ai.model.trim()) || (ai.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo');
    
    // 检查是否已经缓存
    if (cache.has(rule.template, input, model)) {
      return; // 已经缓存，跳过
    }

    // 构建消息
    const messages = [
      { role: 'user' as const, content: rule.template.replace('{selection}', input) }
    ];

    try {
      // 执行AI请求并缓存结果
      await runChat(ai, messages, rule.template);
      console.log(`[PreloadManager] Preloaded: ${rule.name} with input length ${input.length}`);
    } catch (error) {
      // 预加载失败不应该影响主流程
      console.warn(`[PreloadManager] Preload failed for ${rule.name}:`, error);
    }
  }

  /**
   * 开始空闲时预加载
   */
  private startIdlePreloading(): void {
    // 使用 requestIdleCallback 在浏览器空闲时进行预加载
    const scheduleIdlePreload = () => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          this.performIdlePreload();
          // 5分钟后再次调度
          setTimeout(scheduleIdlePreload, 5 * 60 * 1000);
        });
      } else {
        // 回退到 setTimeout
        setTimeout(() => {
          this.performIdlePreload();
          setTimeout(scheduleIdlePreload, 5 * 60 * 1000);
        }, 1000);
      }
    };

    // 延迟5秒开始，避免影响启动性能
    setTimeout(scheduleIdlePreload, 5000);
  }

  /**
   * 执行空闲时预加载
   */
  private async performIdlePreload(): Promise<void> {
    // 这里可以实现基于使用模式的智能预加载
    // 例如：分析最近使用的模板，预加载相似内容
    console.log('[PreloadManager] Performing idle preload...');
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.totalRules = this.rules.size;
    this.stats.activeRules = Array.from(this.rules.values()).filter(r => r.enabled).length;
    
    // 计算缓存命中率
    const cache = CacheManager.getInstance();
    const cacheStats = cache.getStats();
    this.stats.cacheHitRate = cacheStats.hitRate;
  }

  /**
   * 获取统计信息
   */
  public getStats(): PreloadStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 清空预加载队列
   */
  public clearQueue(): void {
    this.preloadQueue = [];
    console.log('[PreloadManager] Preload queue cleared');
  }

  /**
   * 启用/禁用规则
   */
  public toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    
    rule.enabled = enabled;
    this.updateStats();
    console.log(`[PreloadManager] Rule ${ruleId} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  /**
   * 获取预加载建议
   */
  public getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.stats.cacheHitRate < 0.2) {
      recommendations.push('缓存命中率较低，考虑调整预加载规则');
    }
    
    if (this.stats.averagePreloadTime > 5000) {
      recommendations.push('预加载时间过长，考虑减少示例输入数量');
    }
    
    if (this.stats.activeRules === 0) {
      recommendations.push('没有启用的预加载规则，建议启用一些常用规则');
    }
    
    return recommendations;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 销毁预加载管理器
   */
  public destroy(): void {
    this.clearQueue();
    this.isPreloading = false;
    this.rules.clear();
  }
}

// 便捷函数
export const triggerContextualPreload = async (
  fileType: string,
  content: string,
  selectionLength: number,
  ai: AISettings
): Promise<void> => {
  const preloader = PreloadManager.getInstance();
  await preloader.triggerPreload({
    fileType,
    content,
    selectionLength,
    currentTime: new Date()
  }, ai);
};

export const getPreloadStats = (): PreloadStats => {
  return PreloadManager.getInstance().getStats();
};

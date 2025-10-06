import { App, Notice, MarkdownView, Hotkey, Modifier } from "obsidian";
import { runChat } from "../ai/aiClient";
import type { cMenuSettings } from "../settings/settingsData";

export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  template: string;
  hotkey: Hotkey;
  icon?: string;
  enabled: boolean;
  apply: 'replace' | 'insert' | 'quote' | 'code';
}

export interface ShortcutStats {
  totalShortcuts: number;
  enabledShortcuts: number;
  usageCount: Record<string, number>;
  lastUsed: Record<string, number>;
  mostUsed: string | null;
}

export class ShortcutManager {
  private static instance: ShortcutManager;
  private app: App;
  private settings: cMenuSettings;
  private shortcuts: Map<string, ShortcutAction> = new Map();
  private stats: ShortcutStats = {
    totalShortcuts: 0,
    enabledShortcuts: 0,
    usageCount: {},
    lastUsed: {},
    mostUsed: null
  };

  // 预定义快捷键动作
  private defaultShortcuts: ShortcutAction[] = [
    {
      id: 'ai_optimize',
      name: '快速优化',
      description: '优化选中的文本，使其更清晰简洁',
      template: '请优化以下文本，使其更加清晰、简洁和易读：\n\n{selection}',
      hotkey: { modifiers: ['Ctrl', 'Shift'], key: 'O' },
      icon: 'sparkles',
      enabled: true,
      apply: 'replace'
    },
    {
      id: 'ai_translate',
      name: '快速翻译',
      description: '将选中文本翻译成中文',
      template: '请将以下文本翻译成中文：\n\n{selection}',
      hotkey: { modifiers: ['Ctrl', 'Shift'], key: 'T' },
      icon: 'languages',
      enabled: true,
      apply: 'replace'
    },
    {
      id: 'ai_summarize',
      name: '快速总结',
      description: '总结选中文本的要点',
      template: '请总结以下内容的要点：\n\n{selection}',
      hotkey: { modifiers: ['Ctrl', 'Shift'], key: 'S' },
      icon: 'list',
      enabled: true,
      apply: 'insert'
    },
    {
      id: 'ai_continue',
      name: '快速续写',
      description: '基于选中文本继续写作',
      template: '请基于以下内容继续写作，保持风格一致：\n\n{selection}',
      hotkey: { modifiers: ['Ctrl', 'Shift'], key: 'C' },
      icon: 'edit',
      enabled: true,
      apply: 'insert'
    },
    {
      id: 'ai_explain',
      name: '快速解释',
      description: '解释选中的代码或概念',
      template: '请解释以下内容：\n\n{selection}',
      hotkey: { modifiers: ['Ctrl', 'Shift'], key: 'E' },
      icon: 'help-circle',
      enabled: true,
      apply: 'insert'
    },
    {
      id: 'ai_improve',
      name: '快速改进',
      description: '改进选中文本的表达方式',
      template: '请改进以下文本的表达方式，使其更专业和准确：\n\n{selection}',
      hotkey: { modifiers: ['Ctrl', 'Shift'], key: 'I' },
      icon: 'trending-up',
      enabled: true,
      apply: 'replace'
    }
  ];

  static getInstance(app: App, settings: cMenuSettings): ShortcutManager {
    if (!ShortcutManager.instance) {
      ShortcutManager.instance = new ShortcutManager(app, settings);
    }
    return ShortcutManager.instance;
  }

  constructor(app: App, settings: cMenuSettings) {
    this.app = app;
    this.settings = settings;
    this.initializeShortcuts();
    this.loadStats();
  }

  /**
   * 初始化快捷键
   */
  private initializeShortcuts(): void {
    // 加载默认快捷键
    this.defaultShortcuts.forEach(shortcut => {
      this.shortcuts.set(shortcut.id, { ...shortcut });
    });

    // 加载用户自定义快捷键
    this.loadCustomShortcuts();

    // 注册所有启用的快捷键
    this.registerAllShortcuts();
    
    this.updateStats();
    console.log(`[ShortcutManager] Initialized ${this.shortcuts.size} shortcuts`);
  }

  /**
   * 注册所有快捷键
   */
  private registerAllShortcuts(): void {
    for (const shortcut of this.shortcuts.values()) {
      if (shortcut.enabled) {
        this.registerShortcut(shortcut);
      }
    }
  }

  /**
   * 注册单个快捷键
   */
  private registerShortcut(shortcut: ShortcutAction): void {
    try {
      this.app.scope.register(
        shortcut.hotkey.modifiers,
        shortcut.hotkey.key,
        () => {
          this.executeShortcut(shortcut.id);
        }
      );
      
      console.log(`[ShortcutManager] Registered shortcut: ${shortcut.name} (${this.formatHotkey(shortcut.hotkey)})`);
    } catch (error) {
      console.error(`[ShortcutManager] Failed to register shortcut ${shortcut.id}:`, error);
    }
  }

  /**
   * 执行快捷键动作
   */
  private async executeShortcut(shortcutId: string): Promise<void> {
    const shortcut = this.shortcuts.get(shortcutId);
    if (!shortcut || !shortcut.enabled) {
      return;
    }

    try {
      // 获取当前编辑器和选中文本
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) {
        new Notice('请在 Markdown 编辑器中使用快捷键');
        return;
      }

      const editor = activeView.editor;
      const selection = editor.getSelection();
      
      if (!selection.trim()) {
        new Notice(`请先选中文本再使用 ${shortcut.name}`);
        return;
      }

      // 检查AI配置
      const ai = (this.settings as any).ai;
      if (!ai?.apiKey) {
        new Notice('请先在设置中配置 AI 的 API Key');
        return;
      }

      // 显示处理通知
      const processingNotice = new Notice(`正在执行 ${shortcut.name}...`, 0);

      // 构建消息
      const messages = [{
        role: 'user' as const,
        content: shortcut.template.replace('{selection}', selection)
      }];

      try {
        // 执行AI请求
        const result = await runChat(ai, messages, shortcut.template);
        
        // 应用结果
        this.applyResult(editor, result, shortcut.apply, selection);
        
        // 更新统计
        this.updateUsageStats(shortcutId);
        
        // 显示成功通知
        processingNotice.hide();
        new Notice(`${shortcut.name} 完成`);
        
      } catch (error) {
        processingNotice.hide();
        new Notice(`${shortcut.name} 失败：${error.message}`);
        console.error(`[ShortcutManager] Shortcut execution failed:`, error);
      }

    } catch (error) {
      new Notice(`执行快捷键失败：${error.message}`);
      console.error(`[ShortcutManager] Shortcut execution error:`, error);
    }
  }

  /**
   * 应用AI结果
   */
  private applyResult(editor: any, result: string, applyMode: string, originalSelection: string): void {
    switch (applyMode) {
      case 'replace':
        editor.replaceSelection(result);
        break;
        
      case 'insert':
        const cursor = editor.getCursor('to') || editor.getCursor();
        const prefix = originalSelection.endsWith('\n') ? '' : '\n';
        editor.replaceRange(prefix + result + '\n', cursor);
        break;
        
      case 'quote':
        const cursor2 = editor.getCursor('to') || editor.getCursor();
        const quotedResult = result.split('\n').map(line => `> ${line}`).join('\n');
        const prefix2 = originalSelection.endsWith('\n') ? '' : '\n';
        editor.replaceRange(prefix2 + quotedResult + '\n', cursor2);
        break;
        
      case 'code':
        const cursor3 = editor.getCursor('to') || editor.getCursor();
        const codeResult = '```\n' + result + '\n```';
        const prefix3 = originalSelection.endsWith('\n') ? '' : '\n';
        editor.replaceRange(prefix3 + codeResult + '\n', cursor3);
        break;
    }
  }

  /**
   * 更新使用统计
   */
  private updateUsageStats(shortcutId: string): void {
    this.stats.usageCount[shortcutId] = (this.stats.usageCount[shortcutId] || 0) + 1;
    this.stats.lastUsed[shortcutId] = Date.now();
    
    // 更新最常用快捷键
    let maxCount = 0;
    let mostUsed = null;
    for (const [id, count] of Object.entries(this.stats.usageCount)) {
      if (count > maxCount) {
        maxCount = count;
        mostUsed = id;
      }
    }
    this.stats.mostUsed = mostUsed;
    
    this.saveStats();
  }

  /**
   * 添加自定义快捷键
   */
  public addCustomShortcut(shortcut: Omit<ShortcutAction, 'id'>): string {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const customShortcut: ShortcutAction = {
      ...shortcut,
      id
    };
    
    this.shortcuts.set(id, customShortcut);
    
    if (customShortcut.enabled) {
      this.registerShortcut(customShortcut);
    }
    
    this.updateStats();
    this.saveCustomShortcuts();
    
    console.log(`[ShortcutManager] Added custom shortcut: ${customShortcut.name}`);
    return id;
  }

  /**
   * 移除快捷键
   */
  public removeShortcut(shortcutId: string): boolean {
    const shortcut = this.shortcuts.get(shortcutId);
    if (!shortcut) return false;
    
    // 不能删除默认快捷键，只能禁用
    if (this.defaultShortcuts.some(s => s.id === shortcutId)) {
      shortcut.enabled = false;
      this.updateStats();
      return true;
    }
    
    // 删除自定义快捷键
    this.shortcuts.delete(shortcutId);
    this.updateStats();
    this.saveCustomShortcuts();
    
    console.log(`[ShortcutManager] Removed shortcut: ${shortcutId}`);
    return true;
  }

  /**
   * 更新快捷键
   */
  public updateShortcut(shortcutId: string, updates: Partial<ShortcutAction>): boolean {
    const shortcut = this.shortcuts.get(shortcutId);
    if (!shortcut) return false;
    
    // 更新快捷键
    Object.assign(shortcut, updates);
    
    // 如果更新了热键或启用状态，需要重新注册
    if (updates.hotkey || updates.enabled !== undefined) {
      // 这里应该先注销旧的快捷键，但Obsidian API没有提供注销方法
      // 所以我们只能在重启时生效
      new Notice('快捷键更改将在重启后生效');
    }
    
    this.updateStats();
    this.saveCustomShortcuts();
    
    console.log(`[ShortcutManager] Updated shortcut: ${shortcutId}`);
    return true;
  }

  /**
   * 获取所有快捷键
   */
  public getAllShortcuts(): ShortcutAction[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * 获取启用的快捷键
   */
  public getEnabledShortcuts(): ShortcutAction[] {
    return Array.from(this.shortcuts.values()).filter(s => s.enabled);
  }

  /**
   * 获取统计信息
   */
  public getStats(): ShortcutStats {
    return { ...this.stats };
  }

  /**
   * 获取快捷键使用排行
   */
  public getUsageRanking(): Array<{shortcut: ShortcutAction, count: number, lastUsed: number}> {
    return Array.from(this.shortcuts.values())
      .map(shortcut => ({
        shortcut,
        count: this.stats.usageCount[shortcut.id] || 0,
        lastUsed: this.stats.lastUsed[shortcut.id] || 0
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 检查快捷键冲突
   */
  public checkHotkeyConflict(hotkey: Hotkey, excludeId?: string): ShortcutAction | null {
    for (const shortcut of this.shortcuts.values()) {
      if (shortcut.id === excludeId) continue;
      if (!shortcut.enabled) continue;
      
      if (this.hotkeyEquals(shortcut.hotkey, hotkey)) {
        return shortcut;
      }
    }
    return null;
  }

  /**
   * 比较两个热键是否相同
   */
  private hotkeyEquals(hotkey1: Hotkey, hotkey2: Hotkey): boolean {
    if (hotkey1.key !== hotkey2.key) return false;
    
    const mods1 = [...(hotkey1.modifiers || [])].sort();
    const mods2 = [...(hotkey2.modifiers || [])].sort();
    
    if (mods1.length !== mods2.length) return false;
    
    return mods1.every((mod, index) => mod === mods2[index]);
  }

  /**
   * 格式化热键显示
   */
  public formatHotkey(hotkey: Hotkey): string {
    const modifiers = hotkey.modifiers || [];
    const parts = [...modifiers, hotkey.key];
    return parts.join('+');
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.totalShortcuts = this.shortcuts.size;
    this.stats.enabledShortcuts = Array.from(this.shortcuts.values()).filter(s => s.enabled).length;
  }

  /**
   * 加载自定义快捷键
   */
  private loadCustomShortcuts(): void {
    try {
      const saved = localStorage.getItem('cMenuCustomShortcuts');
      if (saved) {
        const customShortcuts: ShortcutAction[] = JSON.parse(saved);
        customShortcuts.forEach(shortcut => {
          this.shortcuts.set(shortcut.id, shortcut);
        });
        console.log(`[ShortcutManager] Loaded ${customShortcuts.length} custom shortcuts`);
      }
    } catch (error) {
      console.warn('[ShortcutManager] Failed to load custom shortcuts:', error);
    }
  }

  /**
   * 保存自定义快捷键
   */
  private saveCustomShortcuts(): void {
    try {
      const customShortcuts = Array.from(this.shortcuts.values())
        .filter(s => !this.defaultShortcuts.some(d => d.id === s.id));
      
      localStorage.setItem('cMenuCustomShortcuts', JSON.stringify(customShortcuts));
    } catch (error) {
      console.warn('[ShortcutManager] Failed to save custom shortcuts:', error);
    }
  }

  /**
   * 加载统计信息
   */
  private loadStats(): void {
    try {
      const saved = localStorage.getItem('cMenuShortcutStats');
      if (saved) {
        const savedStats = JSON.parse(saved);
        this.stats = { ...this.stats, ...savedStats };
      }
    } catch (error) {
      console.warn('[ShortcutManager] Failed to load stats:', error);
    }
  }

  /**
   * 保存统计信息
   */
  private saveStats(): void {
    try {
      localStorage.setItem('cMenuShortcutStats', JSON.stringify(this.stats));
    } catch (error) {
      console.warn('[ShortcutManager] Failed to save stats:', error);
    }
  }

  /**
   * 重置统计信息
   */
  public resetStats(): void {
    this.stats = {
      totalShortcuts: this.stats.totalShortcuts,
      enabledShortcuts: this.stats.enabledShortcuts,
      usageCount: {},
      lastUsed: {},
      mostUsed: null
    };
    this.saveStats();
    new Notice('快捷键统计已重置');
  }

  /**
   * 导出快捷键配置
   */
  public exportConfig(): string {
    const config = {
      shortcuts: Array.from(this.shortcuts.values()),
      stats: this.stats,
      exportTime: Date.now()
    };
    return JSON.stringify(config, null, 2);
  }

  /**
   * 导入快捷键配置
   */
  public importConfig(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson);
      
      if (!config.shortcuts || !Array.isArray(config.shortcuts)) {
        throw new Error('Invalid config format');
      }
      
      // 清除现有自定义快捷键
      const defaultIds = this.defaultShortcuts.map(s => s.id);
      for (const [id, shortcut] of this.shortcuts.entries()) {
        if (!defaultIds.includes(id)) {
          this.shortcuts.delete(id);
        }
      }
      
      // 导入新的快捷键
      config.shortcuts.forEach((shortcut: ShortcutAction) => {
        this.shortcuts.set(shortcut.id, shortcut);
      });
      
      // 导入统计信息
      if (config.stats) {
        this.stats = { ...this.stats, ...config.stats };
      }
      
      this.updateStats();
      this.saveCustomShortcuts();
      this.saveStats();
      
      new Notice(`成功导入 ${config.shortcuts.length} 个快捷键配置`);
      return true;
      
    } catch (error) {
      new Notice(`导入配置失败：${error.message}`);
      return false;
    }
  }

  /**
   * 销毁快捷键管理器
   */
  public destroy(): void {
    this.saveCustomShortcuts();
    this.saveStats();
    // 注意：Obsidian API 没有提供注销快捷键的方法
    // 快捷键会在插件重新加载时自动清除
  }
}

// 便捷函数
export const initializeShortcuts = (app: App, settings: cMenuSettings): ShortcutManager => {
  return ShortcutManager.getInstance(app, settings);
};

export const getShortcutManager = (): ShortcutManager | null => {
  return ShortcutManager['instance'] || null;
};

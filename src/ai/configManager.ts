import { CacheManager } from "./cacheManager";
import { PreloadManager } from "./preloader";
import { QueueManager } from "./queueManager";
import { StreamRenderer } from "./streamRenderer";

export interface PerformanceProfile {
  name: string;
  description: string;
  cache: {
    maxEntries: number;
    maxSize: number;
    defaultTTL: number;
    cleanupInterval: number;
  };
  preload: {
    enabled: boolean;
    maxRules: number;
    idleDelay: number;
    maxSampleInputs: number;
  };
  queue: {
    maxConcurrent: number;
    maxQueueSize: number;
    throttleInterval: number;
    timeoutMs: number;
  };
  render: {
    chunkSize: number;
    renderDelay: number;
    enableMarkdown: boolean;
    enableSyntaxHighlight: boolean;
  };
}

export interface PerformanceMetrics {
  timestamp: number;
  cache: {
    hitRate: number;
    totalEntries: number;
    totalSize: number;
  };
  queue: {
    throughput: number;
    averageWaitTime: number;
    activeRequests: number;
  };
  render: {
    fps: number;
    averageRenderTime: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  
  private currentProfile: PerformanceProfile;
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsHistory = 100;
  private metricsInterval?: number;
  
  // 预定义性能配置文件
  private profiles: Record<string, PerformanceProfile> = {
    'conservative': {
      name: '保守模式',
      description: '低资源消耗，适合性能较弱的设备',
      cache: {
        maxEntries: 500,
        maxSize: 2 * 1024 * 1024, // 2MB
        defaultTTL: 12 * 60 * 60 * 1000, // 12小时
        cleanupInterval: 60 * 60 * 1000, // 1小时
      },
      preload: {
        enabled: true,
        maxRules: 2,
        idleDelay: 10000,
        maxSampleInputs: 1,
      },
      queue: {
        maxConcurrent: 1,
        maxQueueSize: 20,
        throttleInterval: 2000,
        timeoutMs: 20000,
      },
      render: {
        chunkSize: 25,
        renderDelay: 50,
        enableMarkdown: false,
        enableSyntaxHighlight: false,
      }
    },
    
    'balanced': {
      name: '平衡模式',
      description: '性能与资源消耗的平衡，适合大多数用户',
      cache: {
        maxEntries: 1000,
        maxSize: 5 * 1024 * 1024, // 5MB
        defaultTTL: 24 * 60 * 60 * 1000, // 24小时
        cleanupInterval: 30 * 60 * 1000, // 30分钟
      },
      preload: {
        enabled: true,
        maxRules: 4,
        idleDelay: 5000,
        maxSampleInputs: 2,
      },
      queue: {
        maxConcurrent: 3,
        maxQueueSize: 50,
        throttleInterval: 1000,
        timeoutMs: 30000,
      },
      render: {
        chunkSize: 50,
        renderDelay: 16,
        enableMarkdown: true,
        enableSyntaxHighlight: true,
      }
    },
    
    'performance': {
      name: '性能模式',
      description: '最大化性能，适合高性能设备和重度用户',
      cache: {
        maxEntries: 2000,
        maxSize: 10 * 1024 * 1024, // 10MB
        defaultTTL: 48 * 60 * 60 * 1000, // 48小时
        cleanupInterval: 15 * 60 * 1000, // 15分钟
      },
      preload: {
        enabled: true,
        maxRules: 6,
        idleDelay: 2000,
        maxSampleInputs: 3,
      },
      queue: {
        maxConcurrent: 5,
        maxQueueSize: 100,
        throttleInterval: 500,
        timeoutMs: 45000,
      },
      render: {
        chunkSize: 100,
        renderDelay: 8,
        enableMarkdown: true,
        enableSyntaxHighlight: true,
      }
    }
  };

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  constructor() {
    this.currentProfile = this.profiles['balanced']; // 默认平衡模式
    this.loadSavedProfile();
    this.startMetricsCollection();
    this.applyCurrentProfile();
  }

  /**
   * 应用性能配置文件
   */
  public applyProfile(profileName: string): boolean {
    const profile = this.profiles[profileName];
    if (!profile) {
      console.error(`[ConfigManager] Profile not found: ${profileName}`);
      return false;
    }

    this.currentProfile = profile;
    this.applyCurrentProfile();
    this.saveCurrentProfile();
    
    console.log(`[ConfigManager] Applied profile: ${profile.name}`);
    return true;
  }

  /**
   * 应用当前配置文件到各个模块
   */
  private applyCurrentProfile(): void {
    const profile = this.currentProfile;

    // 应用缓存配置
    const cacheManager = CacheManager.getInstance();
    cacheManager.updateConfig({
      maxEntries: profile.cache.maxEntries,
      maxSize: profile.cache.maxSize,
      defaultTTL: profile.cache.defaultTTL,
      cleanupInterval: profile.cache.cleanupInterval,
      enablePersistence: true
    });

    // 应用队列配置
    const queueManager = QueueManager.getInstance();
    queueManager.updateConfig({
      maxConcurrent: profile.queue.maxConcurrent,
      maxQueueSize: profile.queue.maxQueueSize,
      throttleInterval: profile.queue.throttleInterval,
      timeoutMs: profile.queue.timeoutMs,
      priorityWeights: { high: 10, medium: 5, low: 1 },
      retryDelay: 2000,
      enableThrottling: true
    });

    console.log(`[ConfigManager] Configuration applied for profile: ${profile.name}`);
  }

  /**
   * 获取当前配置文件
   */
  public getCurrentProfile(): PerformanceProfile {
    return { ...this.currentProfile };
  }

  /**
   * 获取所有可用配置文件
   */
  public getAvailableProfiles(): Array<{name: string, profile: PerformanceProfile}> {
    return Object.entries(this.profiles).map(([name, profile]) => ({
      name,
      profile: { ...profile }
    }));
  }

  /**
   * 创建自定义配置文件
   */
  public createCustomProfile(name: string, baseProfile: string, overrides: Partial<PerformanceProfile>): boolean {
    const base = this.profiles[baseProfile];
    if (!base) {
      console.error(`[ConfigManager] Base profile not found: ${baseProfile}`);
      return false;
    }

    this.profiles[name] = {
      ...base,
      ...overrides,
      name: overrides.name || `自定义-${name}`,
      description: overrides.description || `基于${base.name}的自定义配置`
    };

    console.log(`[ConfigManager] Created custom profile: ${name}`);
    return true;
  }

  /**
   * 自动优化配置
   */
  public autoOptimize(): string[] {
    const recommendations: string[] = [];
    const recentMetrics = this.getRecentMetrics(10);
    
    if (recentMetrics.length === 0) {
      recommendations.push('需要更多使用数据才能提供优化建议');
      return recommendations;
    }

    const avgMetrics = this.calculateAverageMetrics(recentMetrics);

    // 缓存优化建议
    if (avgMetrics.cache.hitRate < 0.2) {
      recommendations.push('缓存命中率较低，建议增加缓存大小或延长TTL');
      this.adjustCacheConfig('increase');
    } else if (avgMetrics.cache.hitRate > 0.8) {
      recommendations.push('缓存命中率很高，可以考虑减少缓存大小以节省内存');
    }

    // 队列优化建议
    if (avgMetrics.queue.averageWaitTime > 5000) {
      recommendations.push('队列等待时间过长，建议增加并发数');
      this.adjustQueueConfig('increase_concurrent');
    } else if (avgMetrics.queue.throughput < 2) {
      recommendations.push('处理吞吐量较低，检查网络连接和API配置');
    }

    // 渲染优化建议
    if (avgMetrics.render.fps < 30) {
      recommendations.push('渲染帧率较低，建议减少渲染复杂度');
      this.adjustRenderConfig('reduce_complexity');
    }

    // 系统资源建议
    if (avgMetrics.system.memoryUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push('内存使用较高，建议使用保守模式');
    }

    if (recommendations.length === 0) {
      recommendations.push('当前配置已经很好，无需调整');
    }

    return recommendations;
  }

  /**
   * 调整缓存配置
   */
  private adjustCacheConfig(direction: 'increase' | 'decrease'): void {
    const factor = direction === 'increase' ? 1.5 : 0.7;
    
    this.currentProfile.cache.maxEntries = Math.round(this.currentProfile.cache.maxEntries * factor);
    this.currentProfile.cache.maxSize = Math.round(this.currentProfile.cache.maxSize * factor);
    
    this.applyCurrentProfile();
  }

  /**
   * 调整队列配置
   */
  private adjustQueueConfig(action: 'increase_concurrent' | 'decrease_concurrent'): void {
    if (action === 'increase_concurrent') {
      this.currentProfile.queue.maxConcurrent = Math.min(this.currentProfile.queue.maxConcurrent + 1, 8);
    } else {
      this.currentProfile.queue.maxConcurrent = Math.max(this.currentProfile.queue.maxConcurrent - 1, 1);
    }
    
    this.applyCurrentProfile();
  }

  /**
   * 调整渲染配置
   */
  private adjustRenderConfig(action: 'reduce_complexity' | 'increase_complexity'): void {
    if (action === 'reduce_complexity') {
      this.currentProfile.render.chunkSize = Math.max(this.currentProfile.render.chunkSize - 10, 10);
      this.currentProfile.render.renderDelay = Math.min(this.currentProfile.render.renderDelay + 8, 100);
    } else {
      this.currentProfile.render.chunkSize = Math.min(this.currentProfile.render.chunkSize + 10, 200);
      this.currentProfile.render.renderDelay = Math.max(this.currentProfile.render.renderDelay - 8, 8);
    }
    
    this.applyCurrentProfile();
  }

  /**
   * 开始性能指标收集
   */
  private startMetricsCollection(): void {
    this.metricsInterval = window.setInterval(() => {
      this.collectMetrics();
    }, 30000); // 每30秒收集一次
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    try {
      const cacheStats = CacheManager.getInstance().getStats();
      const queueStats = QueueManager.getInstance().getStats();
      
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cache: {
          hitRate: cacheStats.hitRate,
          totalEntries: cacheStats.totalEntries,
          totalSize: cacheStats.totalSize,
        },
        queue: {
          throughput: queueStats.throughput,
          averageWaitTime: queueStats.averageWaitTime,
          activeRequests: queueStats.activeRequests,
        },
        render: {
          fps: 60, // 默认值，实际应该从StreamRenderer获取
          averageRenderTime: 16,
        },
        system: {
          memoryUsage: this.estimateMemoryUsage(),
          cpuUsage: 0, // 浏览器中难以准确获取
        }
      };

      this.metrics.push(metrics);
      
      // 保持历史记录在限制范围内
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics.shift();
      }

    } catch (error) {
      console.warn('[ConfigManager] Failed to collect metrics:', error);
    }
  }

  /**
   * 估算内存使用量
   */
  private estimateMemoryUsage(): number {
    const cacheStats = CacheManager.getInstance().getStats();
    return cacheStats.totalSize + (this.metrics.length * 1000); // 粗略估算
  }

  /**
   * 获取最近的性能指标
   */
  public getRecentMetrics(count: number = 10): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * 计算平均性能指标
   */
  private calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    if (metrics.length === 0) {
      throw new Error('No metrics available');
    }

    const avg: PerformanceMetrics = {
      timestamp: Date.now(),
      cache: { hitRate: 0, totalEntries: 0, totalSize: 0 },
      queue: { throughput: 0, averageWaitTime: 0, activeRequests: 0 },
      render: { fps: 0, averageRenderTime: 0 },
      system: { memoryUsage: 0, cpuUsage: 0 }
    };

    for (const metric of metrics) {
      avg.cache.hitRate += metric.cache.hitRate;
      avg.cache.totalEntries += metric.cache.totalEntries;
      avg.cache.totalSize += metric.cache.totalSize;
      avg.queue.throughput += metric.queue.throughput;
      avg.queue.averageWaitTime += metric.queue.averageWaitTime;
      avg.queue.activeRequests += metric.queue.activeRequests;
      avg.render.fps += metric.render.fps;
      avg.render.averageRenderTime += metric.render.averageRenderTime;
      avg.system.memoryUsage += metric.system.memoryUsage;
      avg.system.cpuUsage += metric.system.cpuUsage;
    }

    const count = metrics.length;
    avg.cache.hitRate /= count;
    avg.cache.totalEntries /= count;
    avg.cache.totalSize /= count;
    avg.queue.throughput /= count;
    avg.queue.averageWaitTime /= count;
    avg.queue.activeRequests /= count;
    avg.render.fps /= count;
    avg.render.averageRenderTime /= count;
    avg.system.memoryUsage /= count;
    avg.system.cpuUsage /= count;

    return avg;
  }

  /**
   * 保存当前配置文件
   */
  private saveCurrentProfile(): void {
    try {
      localStorage.setItem('cMenuPerformanceProfile', JSON.stringify({
        profileName: this.findProfileName(this.currentProfile),
        customProfile: this.currentProfile
      }));
    } catch (error) {
      console.warn('[ConfigManager] Failed to save profile:', error);
    }
  }

  /**
   * 加载保存的配置文件
   */
  private loadSavedProfile(): void {
    try {
      const saved = localStorage.getItem('cMenuPerformanceProfile');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.profileName && this.profiles[data.profileName]) {
          this.currentProfile = this.profiles[data.profileName];
        } else if (data.customProfile) {
          this.currentProfile = data.customProfile;
        }
      }
    } catch (error) {
      console.warn('[ConfigManager] Failed to load saved profile:', error);
    }
  }

  /**
   * 查找配置文件名称
   */
  private findProfileName(profile: PerformanceProfile): string | null {
    for (const [name, p] of Object.entries(this.profiles)) {
      if (JSON.stringify(p) === JSON.stringify(profile)) {
        return name;
      }
    }
    return null;
  }

  /**
   * 获取性能报告
   */
  public getPerformanceReport(): {
    currentProfile: string;
    metrics: PerformanceMetrics;
    recommendations: string[];
    trends: {
      cacheHitRate: 'improving' | 'stable' | 'declining';
      queueThroughput: 'improving' | 'stable' | 'declining';
      memoryUsage: 'improving' | 'stable' | 'declining';
    };
  } {
    const recentMetrics = this.getRecentMetrics(5);
    const currentMetrics = recentMetrics[recentMetrics.length - 1] || this.getDefaultMetrics();
    
    return {
      currentProfile: this.currentProfile.name,
      metrics: currentMetrics,
      recommendations: this.autoOptimize(),
      trends: this.analyzeTrends(recentMetrics)
    };
  }

  /**
   * 分析性能趋势
   */
  private analyzeTrends(metrics: PerformanceMetrics[]): {
    cacheHitRate: 'improving' | 'stable' | 'declining';
    queueThroughput: 'improving' | 'stable' | 'declining';
    memoryUsage: 'improving' | 'stable' | 'declining';
  } {
    if (metrics.length < 3) {
      return {
        cacheHitRate: 'stable',
        queueThroughput: 'stable',
        memoryUsage: 'stable'
      };
    }

    const first = metrics[0];
    const last = metrics[metrics.length - 1];

    return {
      cacheHitRate: this.getTrend(first.cache.hitRate, last.cache.hitRate),
      queueThroughput: this.getTrend(first.queue.throughput, last.queue.throughput),
      memoryUsage: this.getTrend(first.system.memoryUsage, last.system.memoryUsage, true) // 反向，内存增加是负面的
    };
  }

  /**
   * 获取趋势方向
   */
  private getTrend(oldValue: number, newValue: number, reverse: boolean = false): 'improving' | 'stable' | 'declining' {
    const change = (newValue - oldValue) / (oldValue || 1);
    const threshold = 0.1;
    
    if (reverse) {
      // 对于内存使用等指标，增加是负面的
      if (change > threshold) return 'declining';
      if (change < -threshold) return 'improving';
    } else {
      if (change > threshold) return 'improving';
      if (change < -threshold) return 'declining';
    }
    
    return 'stable';
  }

  /**
   * 获取默认指标
   */
  private getDefaultMetrics(): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      cache: { hitRate: 0, totalEntries: 0, totalSize: 0 },
      queue: { throughput: 0, averageWaitTime: 0, activeRequests: 0 },
      render: { fps: 60, averageRenderTime: 16 },
      system: { memoryUsage: 0, cpuUsage: 0 }
    };
  }

  /**
   * 销毁配置管理器
   */
  public destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
    this.saveCurrentProfile();
  }
}

// 便捷函数
export const getCurrentPerformanceProfile = (): PerformanceProfile => {
  return ConfigManager.getInstance().getCurrentProfile();
};

export const applyPerformanceProfile = (profileName: string): boolean => {
  return ConfigManager.getInstance().applyProfile(profileName);
};

export const getPerformanceReport = () => {
  return ConfigManager.getInstance().getPerformanceReport();
};

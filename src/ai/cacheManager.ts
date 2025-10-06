import { Notice } from "obsidian";

export interface CacheEntry {
  key: string;           // 缓存键 (hash)
  result: string;        // AI 返回结果
  metadata: {
    timestamp: number;   // 创建时间
    hitCount: number;    // 命中次数
    model: string;       // 使用的模型
    template: string;    // 使用的模板
    inputHash: string;   // 输入内容的hash
    size: number;        // 结果大小(字符数)
  };
  ttl: number;          // 生存时间 (ms)
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  totalSize: number;    // 总缓存大小
  oldestEntry: number;  // 最老条目时间戳
  newestEntry: number;  // 最新条目时间戳
}

export interface CacheConfig {
  maxEntries: number;      // 最大缓存条目数
  maxSize: number;         // 最大缓存大小 (字符数)
  defaultTTL: number;      // 默认TTL (24小时)
  cleanupInterval: number; // 清理间隔 (30分钟)
  enablePersistence: boolean; // 是否持久化到磁盘
}

export class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, CacheEntry> = new Map();
  private stats = {
    totalHits: 0,
    totalMisses: 0
  };
  
  private config: CacheConfig = {
    maxEntries: 1000,
    maxSize: 5 * 1024 * 1024, // 5MB 字符数
    defaultTTL: 24 * 60 * 60 * 1000, // 24小时
    cleanupInterval: 30 * 60 * 1000, // 30分钟
    enablePersistence: true
  };
  
  private cleanupTimer?: number;

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  constructor() {
    this.startCleanupTimer();
    this.loadFromStorage();
  }

  /**
   * 生成缓存键
   */
  public generateKey(template: string, input: string, model: string): string {
    const content = `${template}|${input}|${model}`;
    return this.hashString(content);
  }

  /**
   * 获取缓存条目
   */
  public get(key: string): string | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.totalMisses++;
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.metadata.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.totalMisses++;
      return null;
    }

    // 更新命中统计
    entry.metadata.hitCount++;
    this.stats.totalHits++;
    
    console.log(`[CacheManager] Cache hit for key: ${key.substring(0, 8)}...`);
    return entry.result;
  }

  /**
   * 设置缓存条目
   */
  public set(
    template: string, 
    input: string, 
    model: string, 
    result: string,
    customTTL?: number
  ): void {
    const key = this.generateKey(template, input, model);
    const ttl = customTTL || this.config.defaultTTL;
    
    const entry: CacheEntry = {
      key,
      result,
      metadata: {
        timestamp: Date.now(),
        hitCount: 0,
        model,
        template: template.substring(0, 100), // 只保存前100字符用于调试
        inputHash: this.hashString(input),
        size: result.length
      },
      ttl
    };

    // 检查缓存大小限制
    this.ensureCapacity(entry.metadata.size);
    
    this.cache.set(key, entry);
    console.log(`[CacheManager] Cached result for key: ${key.substring(0, 8)}... (${result.length} chars)`);
    
    // 异步保存到存储
    if (this.config.enablePersistence) {
      this.saveToStorage();
    }
  }

  /**
   * 检查是否存在缓存
   */
  public has(template: string, input: string, model: string): boolean {
    const key = this.generateKey(template, input, model);
    const entry = this.cache.get(key);
    
    if (!entry) return false;
    
    // 检查是否过期
    if (Date.now() - entry.metadata.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 删除特定缓存条目
   */
  public delete(template: string, input: string, model: string): boolean {
    const key = this.generateKey(template, input, model);
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  public clear(): void {
    this.cache.clear();
    this.stats.totalHits = 0;
    this.stats.totalMisses = 0;
    
    if (this.config.enablePersistence) {
      this.saveToStorage();
    }
    
    new Notice('AI 缓存已清空', 2000);
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.metadata.size, 0);
    const timestamps = entries.map(entry => entry.metadata.timestamp);
    
    return {
      totalEntries: this.cache.size,
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      hitRate: this.stats.totalHits + this.stats.totalMisses > 0 
        ? this.stats.totalHits / (this.stats.totalHits + this.stats.totalMisses) 
        : 0,
      totalSize,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
    };
  }

  /**
   * 获取热门缓存条目
   */
  public getPopularEntries(limit: number = 10): Array<{key: string, hits: number, model: string, age: number}> {
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key: key.substring(0, 8) + '...',
        hits: entry.metadata.hitCount,
        model: entry.metadata.model,
        age: Date.now() - entry.metadata.timestamp
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  }

  /**
   * 确保缓存容量
   */
  private ensureCapacity(newEntrySize: number): void {
    // 检查条目数量限制
    while (this.cache.size >= this.config.maxEntries) {
      this.evictLeastUsed();
    }

    // 检查总大小限制
    let totalSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.metadata.size, 0);
    
    while (totalSize + newEntrySize > this.config.maxSize && this.cache.size > 0) {
      this.evictLeastUsed();
      totalSize = Array.from(this.cache.values())
        .reduce((sum, entry) => sum + entry.metadata.size, 0);
    }
  }

  /**
   * 驱逐最少使用的条目
   */
  private evictLeastUsed(): void {
    let leastUsedKey = '';
    let leastUsedScore = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      // 综合考虑命中次数和时间
      const age = Date.now() - entry.metadata.timestamp;
      const score = entry.metadata.hitCount / (age / (1000 * 60 * 60)); // 每小时命中次数
      
      if (score < leastUsedScore) {
        leastUsedScore = score;
        leastUsedKey = key;
      }
    }
    
    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      console.log(`[CacheManager] Evicted cache entry: ${leastUsedKey.substring(0, 8)}...`);
    }
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.metadata.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[CacheManager] Cleaned up ${cleanedCount} expired cache entries`);
      if (this.config.enablePersistence) {
        this.saveToStorage();
      }
    }
  }

  /**
   * 开始清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = window.setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 停止清理定时器
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * 字符串哈希函数
   */
  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * 保存到本地存储
   */
  private async saveToStorage(): Promise<void> {
    try {
      const data = {
        cache: Array.from(this.cache.entries()),
        stats: this.stats,
        timestamp: Date.now()
      };
      
      localStorage.setItem('cMenuAICache', JSON.stringify(data));
    } catch (error) {
      console.warn('[CacheManager] Failed to save cache to storage:', error);
    }
  }

  /**
   * 从本地存储加载
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem('cMenuAICache');
      if (!stored) return;
      
      const data = JSON.parse(stored);
      const now = Date.now();
      
      // 检查存储的数据是否太旧 (超过7天)
      if (now - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem('cMenuAICache');
        return;
      }
      
      // 恢复缓存条目 (跳过过期的)
      let loadedCount = 0;
      for (const [key, entry] of data.cache) {
        if (now - entry.metadata.timestamp <= entry.ttl) {
          this.cache.set(key, entry);
          loadedCount++;
        }
      }
      
      // 恢复统计信息
      this.stats = data.stats || { totalHits: 0, totalMisses: 0 };
      
      console.log(`[CacheManager] Loaded ${loadedCount} cache entries from storage`);
    } catch (error) {
      console.warn('[CacheManager] Failed to load cache from storage:', error);
      localStorage.removeItem('cMenuAICache');
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 重启清理定时器
    this.stopCleanupTimer();
    this.startCleanupTimer();
    
    // 确保当前缓存符合新配置
    this.ensureCapacity(0);
  }

  /**
   * 获取当前配置
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * 销毁缓存管理器
   */
  public destroy(): void {
    this.stopCleanupTimer();
    if (this.config.enablePersistence) {
      this.saveToStorage();
    }
    this.cache.clear();
  }
}

// 便捷函数
export const getCachedResult = (template: string, input: string, model: string): string | null => {
  return CacheManager.getInstance().get(CacheManager.getInstance().generateKey(template, input, model));
};

export const setCachedResult = (template: string, input: string, model: string, result: string): void => {
  CacheManager.getInstance().set(template, input, model, result);
};

export const hasCachedResult = (template: string, input: string, model: string): boolean => {
  return CacheManager.getInstance().has(template, input, model);
};

export interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  template: string;
  input: string;
  output: string;
  model: string;
  favorite: boolean;
  tags: string[];
  rating?: 1 | 2 | 3 | 4 | 5;
  metadata: {
    inputLength: number;
    outputLength: number;
    processingTime?: number;
    source: 'menu' | 'shortcut' | 'batch';
    fileType?: string;
  };
}

export interface HistoryStats {
  totalEntries: number;
  favoriteEntries: number;
  averageRating: number;
  mostUsedAction: string | null;
  totalProcessingTime: number;
  averageInputLength: number;
  averageOutputLength: number;
  entriesBySource: Record<string, number>;
  entriesByAction: Record<string, number>;
}

export interface HistoryFilter {
  action?: string;
  dateRange?: { start: number; end: number };
  rating?: number;
  favorite?: boolean;
  tags?: string[];
  source?: string;
  minInputLength?: number;
  maxInputLength?: number;
  searchQuery?: string;
}

export class HistoryManager {
  private static instance: HistoryManager;
  private entries: Map<string, HistoryEntry> = new Map();
  private maxEntries = 1000; // 最大历史条目数
  private storageKey = 'cMenuAIHistory';
  private tagsSet: Set<string> = new Set();

  static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }

  constructor() {
    this.loadFromStorage();
  }

  /**
   * 添加历史记录
   */
  public addEntry(
    action: string,
    template: string,
    input: string,
    output: string,
    model: string,
    metadata: Partial<HistoryEntry['metadata']> = {}
  ): string {
    const id = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const entry: HistoryEntry = {
      id,
      timestamp: Date.now(),
      action,
      template,
      input,
      output,
      model,
      favorite: false,
      tags: [],
      metadata: {
        inputLength: input.length,
        outputLength: output.length,
        source: 'menu',
        ...metadata
      }
    };

    this.entries.set(id, entry);
    
    // 如果超过最大条目数，删除最旧的条目
    if (this.entries.size > this.maxEntries) {
      this.cleanupOldEntries();
    }
    
    this.saveToStorage();
    
    console.log(`[HistoryManager] Added entry: ${action} (${input.length} -> ${output.length} chars)`);
    return id;
  }

  /**
   * 获取历史记录
   */
  public getEntry(id: string): HistoryEntry | null {
    return this.entries.get(id) || null;
  }

  /**
   * 获取所有历史记录
   */
  public getAllEntries(): HistoryEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 搜索历史记录
   */
  public searchEntries(filter: HistoryFilter = {}): HistoryEntry[] {
    let results = Array.from(this.entries.values());

    // 按动作筛选
    if (filter.action) {
      results = results.filter(entry => entry.action === filter.action);
    }

    // 按日期范围筛选
    if (filter.dateRange) {
      results = results.filter(entry => 
        entry.timestamp >= filter.dateRange!.start && 
        entry.timestamp <= filter.dateRange!.end
      );
    }

    // 按评分筛选
    if (filter.rating) {
      results = results.filter(entry => entry.rating === filter.rating);
    }

    // 按收藏筛选
    if (filter.favorite !== undefined) {
      results = results.filter(entry => entry.favorite === filter.favorite);
    }

    // 按标签筛选
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(entry => 
        filter.tags!.some(tag => entry.tags.includes(tag))
      );
    }

    // 按来源筛选
    if (filter.source) {
      results = results.filter(entry => entry.metadata.source === filter.source);
    }

    // 按输入长度筛选
    if (filter.minInputLength !== undefined) {
      results = results.filter(entry => entry.metadata.inputLength >= filter.minInputLength!);
    }
    if (filter.maxInputLength !== undefined) {
      results = results.filter(entry => entry.metadata.inputLength <= filter.maxInputLength!);
    }

    // 文本搜索
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      results = results.filter(entry => 
        entry.action.toLowerCase().includes(query) ||
        entry.input.toLowerCase().includes(query) ||
        entry.output.toLowerCase().includes(query) ||
        entry.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 更新历史记录
   */
  public updateEntry(id: string, updates: Partial<HistoryEntry>): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    // 更新标签集合
    if (updates.tags) {
      updates.tags.forEach(tag => this.tagsSet.add(tag));
    }

    Object.assign(entry, updates);
    this.saveToStorage();
    
    return true;
  }

  /**
   * 删除历史记录
   */
  public deleteEntry(id: string): boolean {
    const deleted = this.entries.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * 批量删除历史记录
   */
  public deleteEntries(ids: string[]): number {
    let deletedCount = 0;
    
    ids.forEach(id => {
      if (this.entries.delete(id)) {
        deletedCount++;
      }
    });
    
    if (deletedCount > 0) {
      this.saveToStorage();
    }
    
    return deletedCount;
  }

  /**
   * 清空所有历史记录
   */
  public clearAll(): number {
    const count = this.entries.size;
    this.entries.clear();
    this.tagsSet.clear();
    this.saveToStorage();
    return count;
  }

  /**
   * 切换收藏状态
   */
  public toggleFavorite(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    entry.favorite = !entry.favorite;
    this.saveToStorage();
    
    return entry.favorite;
  }

  /**
   * 设置评分
   */
  public setRating(id: string, rating: 1 | 2 | 3 | 4 | 5): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    entry.rating = rating;
    this.saveToStorage();
    
    return true;
  }

  /**
   * 添加标签
   */
  public addTag(id: string, tag: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    if (!entry.tags.includes(tag)) {
      entry.tags.push(tag);
      this.tagsSet.add(tag);
      this.saveToStorage();
    }
    
    return true;
  }

  /**
   * 移除标签
   */
  public removeTag(id: string, tag: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    const index = entry.tags.indexOf(tag);
    if (index > -1) {
      entry.tags.splice(index, 1);
      this.saveToStorage();
      return true;
    }
    
    return false;
  }

  /**
   * 获取所有标签
   */
  public getAllTags(): string[] {
    return Array.from(this.tagsSet).sort();
  }

  /**
   * 获取所有动作
   */
  public getAllActions(): string[] {
    const actions = new Set<string>();
    this.entries.forEach(entry => actions.add(entry.action));
    return Array.from(actions).sort();
  }

  /**
   * 获取收藏的历史记录
   */
  public getFavorites(): HistoryEntry[] {
    return this.searchEntries({ favorite: true });
  }

  /**
   * 获取最近的历史记录
   */
  public getRecent(limit: number = 10): HistoryEntry[] {
    return this.getAllEntries().slice(0, limit);
  }

  /**
   * 获取统计信息
   */
  public getStats(): HistoryStats {
    const entries = Array.from(this.entries.values());
    
    if (entries.length === 0) {
      return {
        totalEntries: 0,
        favoriteEntries: 0,
        averageRating: 0,
        mostUsedAction: null,
        totalProcessingTime: 0,
        averageInputLength: 0,
        averageOutputLength: 0,
        entriesBySource: {},
        entriesByAction: {}
      };
    }

    const favoriteEntries = entries.filter(e => e.favorite).length;
    const ratedEntries = entries.filter(e => e.rating);
    const averageRating = ratedEntries.length > 0 
      ? ratedEntries.reduce((sum, e) => sum + (e.rating || 0), 0) / ratedEntries.length
      : 0;

    const totalProcessingTime = entries.reduce((sum, e) => sum + (e.metadata.processingTime || 0), 0);
    const averageInputLength = entries.reduce((sum, e) => sum + e.metadata.inputLength, 0) / entries.length;
    const averageOutputLength = entries.reduce((sum, e) => sum + e.metadata.outputLength, 0) / entries.length;

    // 按来源统计
    const entriesBySource: Record<string, number> = {};
    entries.forEach(entry => {
      const source = entry.metadata.source;
      entriesBySource[source] = (entriesBySource[source] || 0) + 1;
    });

    // 按动作统计
    const entriesByAction: Record<string, number> = {};
    entries.forEach(entry => {
      entriesByAction[entry.action] = (entriesByAction[entry.action] || 0) + 1;
    });

    // 最常用动作
    let mostUsedAction: string | null = null;
    let maxCount = 0;
    Object.entries(entriesByAction).forEach(([action, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostUsedAction = action;
      }
    });

    return {
      totalEntries: entries.length,
      favoriteEntries,
      averageRating,
      mostUsedAction,
      totalProcessingTime,
      averageInputLength: Math.round(averageInputLength),
      averageOutputLength: Math.round(averageOutputLength),
      entriesBySource,
      entriesByAction
    };
  }

  /**
   * 导出历史记录
   */
  public exportHistory(filter?: HistoryFilter): string {
    const entries = filter ? this.searchEntries(filter) : this.getAllEntries();
    
    const exportData = {
      exportTime: Date.now(),
      version: '1.0',
      totalEntries: entries.length,
      entries: entries
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导入历史记录
   */
  public importHistory(jsonData: string, mergeMode: 'replace' | 'merge' = 'merge'): number {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.entries || !Array.isArray(data.entries)) {
        throw new Error('Invalid import format');
      }

      if (mergeMode === 'replace') {
        this.entries.clear();
        this.tagsSet.clear();
      }

      let importedCount = 0;
      
      data.entries.forEach((entry: any) => {
        // 验证必要字段
        if (entry.id && entry.action && entry.input && entry.output) {
          // 避免ID冲突
          if (this.entries.has(entry.id)) {
            entry.id = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }
          
          this.entries.set(entry.id, entry);
          
          // 更新标签集合
          if (entry.tags) {
            entry.tags.forEach((tag: string) => this.tagsSet.add(tag));
          }
          
          importedCount++;
        }
      });

      this.saveToStorage();
      return importedCount;
      
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  /**
   * 获取相似的历史记录
   */
  public findSimilar(input: string, limit: number = 5): HistoryEntry[] {
    const entries = Array.from(this.entries.values());
    
    // 简单的相似度计算（基于输入文本的相似性）
    const similarities = entries.map(entry => ({
      entry,
      similarity: this.calculateSimilarity(input, entry.input)
    }));

    return similarities
      .filter(item => item.similarity > 0.3) // 相似度阈值
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.entry);
  }

  /**
   * 计算文本相似度（简单实现）
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * 清理旧条目
   */
  private cleanupOldEntries(): void {
    const entries = this.getAllEntries();
    const toDelete = entries.slice(this.maxEntries);
    
    toDelete.forEach(entry => {
      this.entries.delete(entry.id);
    });
    
    console.log(`[HistoryManager] Cleaned up ${toDelete.length} old entries`);
  }

  /**
   * 保存到本地存储
   */
  private saveToStorage(): void {
    try {
      const data = {
        entries: Array.from(this.entries.entries()),
        tags: Array.from(this.tagsSet),
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('[HistoryManager] Failed to save to storage:', error);
    }
  }

  /**
   * 从本地存储加载
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;
      
      const data = JSON.parse(stored);
      
      if (data.entries && Array.isArray(data.entries)) {
        this.entries = new Map(data.entries);
      }
      
      if (data.tags && Array.isArray(data.tags)) {
        this.tagsSet = new Set(data.tags);
      }
      
      console.log(`[HistoryManager] Loaded ${this.entries.size} entries from storage`);
      
    } catch (error) {
      console.warn('[HistoryManager] Failed to load from storage:', error);
      localStorage.removeItem(this.storageKey);
    }
  }

  /**
   * 设置最大条目数
   */
  public setMaxEntries(maxEntries: number): void {
    this.maxEntries = Math.max(100, maxEntries); // 最少100条
    
    if (this.entries.size > this.maxEntries) {
      this.cleanupOldEntries();
      this.saveToStorage();
    }
  }

  /**
   * 获取最大条目数
   */
  public getMaxEntries(): number {
    return this.maxEntries;
  }
}

// 便捷函数
export const addHistoryEntry = (
  action: string,
  template: string,
  input: string,
  output: string,
  model: string,
  metadata?: Partial<HistoryEntry['metadata']>
): string => {
  return HistoryManager.getInstance().addEntry(action, template, input, output, model, metadata);
};

export const getHistoryStats = (): HistoryStats => {
  return HistoryManager.getInstance().getStats();
};

export const searchHistory = (filter: HistoryFilter): HistoryEntry[] => {
  return HistoryManager.getInstance().searchEntries(filter);
};

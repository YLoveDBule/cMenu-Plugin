import { Notice } from "obsidian";
import { runChat } from "../ai/aiClient";
import type { AISettings } from "../settings/settingsData";

export interface BatchTask {
  id: string;
  name: string;
  template: string;
  chunks: string[];
  results: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime?: number;
  endTime?: number;
  errorMessage?: string;
  settings: {
    chunkSize: number;
    overlap: number;
    concurrency: number;
    delimiter: 'paragraph' | 'sentence' | 'line' | 'custom';
    customDelimiter?: string;
    preserveFormatting: boolean;
    combineResults: boolean;
  };
}

export interface BatchStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalChunks: number;
  processedChunks: number;
  averageChunkSize: number;
  averageProcessTime: number;
  successRate: number;
}

export class BatchProcessor {
  private static instance: BatchProcessor;
  private tasks: Map<string, BatchTask> = new Map();
  private activeProcesses: Set<string> = new Set();
  private stats: BatchStats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalChunks: 0,
    processedChunks: 0,
    averageChunkSize: 0,
    averageProcessTime: 0,
    successRate: 0
  };

  static getInstance(): BatchProcessor {
    if (!BatchProcessor.instance) {
      BatchProcessor.instance = new BatchProcessor();
    }
    return BatchProcessor.instance;
  }

  /**
   * 创建批量处理任务
   */
  public createTask(
    name: string,
    template: string,
    content: string,
    settings: Partial<BatchTask['settings']> = {}
  ): string {
    const taskId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const defaultSettings: BatchTask['settings'] = {
      chunkSize: 1000,
      overlap: 100,
      concurrency: 2,
      delimiter: 'paragraph',
      preserveFormatting: true,
      combineResults: true
    };

    const finalSettings = { ...defaultSettings, ...settings };
    
    // 分割内容
    const chunks = this.splitContent(content, finalSettings);
    
    const task: BatchTask = {
      id: taskId,
      name,
      template,
      chunks,
      results: new Array(chunks.length).fill(''),
      status: 'pending',
      progress: 0,
      settings: finalSettings
    };

    this.tasks.set(taskId, task);
    this.updateStats();
    
    console.log(`[BatchProcessor] Created task ${taskId} with ${chunks.length} chunks`);
    return taskId;
  }

  /**
   * 开始处理批量任务
   */
  public async processTask(taskId: string, ai: AISettings): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (this.activeProcesses.has(taskId)) {
      throw new Error(`Task already processing: ${taskId}`);
    }

    this.activeProcesses.add(taskId);
    task.status = 'processing';
    task.startTime = Date.now();
    task.progress = 0;

    try {
      await this.processChunks(task, ai);
      
      if (task.settings.combineResults) {
        task.results = [this.combineResults(task.results, task.settings)];
      }
      
      task.status = 'completed';
      task.progress = 100;
      task.endTime = Date.now();
      
      this.stats.completedTasks++;
      this.updateStats();
      
      new Notice(`批量处理任务 "${task.name}" 已完成`);
      
    } catch (error) {
      task.status = 'failed';
      task.errorMessage = error.message;
      this.stats.failedTasks++;
      this.updateStats();
      
      new Notice(`批量处理任务 "${task.name}" 失败：${error.message}`);
      throw error;
      
    } finally {
      this.activeProcesses.delete(taskId);
    }
  }

  /**
   * 处理所有块
   */
  private async processChunks(task: BatchTask, ai: AISettings): Promise<void> {
    const { chunks, settings } = task;
    const semaphore = new Semaphore(settings.concurrency);
    
    const promises = chunks.map(async (chunk, index) => {
      await semaphore.acquire();
      
      try {
        if (task.status === 'cancelled') {
          throw new Error('Task cancelled');
        }
        
        const result = await this.processChunk(chunk, task.template, ai);
        task.results[index] = result;
        
        // 更新进度
        const completed = task.results.filter(r => r !== '').length;
        task.progress = Math.round((completed / chunks.length) * 100);
        
        this.stats.processedChunks++;
        this.updateStats();
        
        console.log(`[BatchProcessor] Processed chunk ${index + 1}/${chunks.length} for task ${task.id}`);
        
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);
  }

  /**
   * 处理单个块
   */
  private async processChunk(chunk: string, template: string, ai: AISettings): Promise<string> {
    const messages = [{
      role: 'user' as const,
      content: template.replace('{selection}', chunk)
    }];

    return await runChat(ai, messages, template);
  }

  /**
   * 分割内容
   */
  private splitContent(content: string, settings: BatchTask['settings']): string[] {
    let chunks: string[] = [];
    
    switch (settings.delimiter) {
      case 'paragraph':
        chunks = this.splitByParagraph(content, settings);
        break;
      case 'sentence':
        chunks = this.splitBySentence(content, settings);
        break;
      case 'line':
        chunks = this.splitByLine(content, settings);
        break;
      case 'custom':
        chunks = this.splitByCustomDelimiter(content, settings);
        break;
    }

    // 应用重叠
    if (settings.overlap > 0) {
      chunks = this.applyOverlap(chunks, settings.overlap);
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  /**
   * 按段落分割
   */
  private splitByParagraph(content: string, settings: BatchTask['settings']): string[] {
    const paragraphs = content.split(/\n\s*\n/);
    return this.groupBySize(paragraphs, settings.chunkSize);
  }

  /**
   * 按句子分割
   */
  private splitBySentence(content: string, settings: BatchTask['settings']): string[] {
    const sentences = content.split(/[.!?]+\s+/);
    return this.groupBySize(sentences, settings.chunkSize);
  }

  /**
   * 按行分割
   */
  private splitByLine(content: string, settings: BatchTask['settings']): string[] {
    const lines = content.split('\n');
    return this.groupBySize(lines, settings.chunkSize);
  }

  /**
   * 按自定义分隔符分割
   */
  private splitByCustomDelimiter(content: string, settings: BatchTask['settings']): string[] {
    if (!settings.customDelimiter) {
      return [content];
    }
    
    const parts = content.split(settings.customDelimiter);
    return this.groupBySize(parts, settings.chunkSize);
  }

  /**
   * 按大小分组
   */
  private groupBySize(items: string[], maxSize: number): string[] {
    const groups: string[] = [];
    let currentGroup = '';
    
    for (const item of items) {
      if (currentGroup.length + item.length > maxSize && currentGroup.length > 0) {
        groups.push(currentGroup.trim());
        currentGroup = item;
      } else {
        currentGroup += (currentGroup ? '\n' : '') + item;
      }
    }
    
    if (currentGroup.trim()) {
      groups.push(currentGroup.trim());
    }
    
    return groups;
  }

  /**
   * 应用重叠
   */
  private applyOverlap(chunks: string[], overlapSize: number): string[] {
    if (chunks.length <= 1 || overlapSize <= 0) {
      return chunks;
    }

    const overlappedChunks: string[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];
      
      // 添加前一个块的结尾
      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const prevEnd = prevChunk.slice(-overlapSize);
        chunk = prevEnd + '\n---\n' + chunk;
      }
      
      // 添加下一个块的开头
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const nextStart = nextChunk.slice(0, overlapSize);
        chunk = chunk + '\n---\n' + nextStart;
      }
      
      overlappedChunks.push(chunk);
    }
    
    return overlappedChunks;
  }

  /**
   * 合并结果
   */
  private combineResults(results: string[], settings: BatchTask['settings']): string {
    if (!settings.combineResults) {
      return results.join('\n\n');
    }

    let combined = results.join('\n\n');
    
    if (settings.preserveFormatting) {
      // 保持原有格式
      combined = combined.replace(/\n{3,}/g, '\n\n');
    }
    
    return combined;
  }

  /**
   * 取消任务
   */
  public cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    if (task.status === 'processing') {
      task.status = 'cancelled';
      this.activeProcesses.delete(taskId);
      new Notice(`批量处理任务 "${task.name}" 已取消`);
    }
    
    return true;
  }

  /**
   * 删除任务
   */
  public deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    if (task.status === 'processing') {
      this.cancelTask(taskId);
    }
    
    this.tasks.delete(taskId);
    this.updateStats();
    
    return true;
  }

  /**
   * 获取任务
   */
  public getTask(taskId: string): BatchTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 获取所有任务
   */
  public getAllTasks(): BatchTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取活动任务
   */
  public getActiveTasks(): BatchTask[] {
    return Array.from(this.tasks.values()).filter(task => 
      task.status === 'processing' || task.status === 'pending'
    );
  }

  /**
   * 获取统计信息
   */
  public getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    const tasks = Array.from(this.tasks.values());
    
    this.stats.totalTasks = tasks.length;
    this.stats.completedTasks = tasks.filter(t => t.status === 'completed').length;
    this.stats.failedTasks = tasks.filter(t => t.status === 'failed').length;
    this.stats.totalChunks = tasks.reduce((sum, task) => sum + task.chunks.length, 0);
    
    const completedTasks = tasks.filter(t => t.status === 'completed');
    if (completedTasks.length > 0) {
      const totalChunkSize = completedTasks.reduce((sum, task) => 
        sum + task.chunks.reduce((chunkSum, chunk) => chunkSum + chunk.length, 0), 0
      );
      this.stats.averageChunkSize = Math.round(totalChunkSize / this.stats.totalChunks);
      
      const totalProcessTime = completedTasks.reduce((sum, task) => 
        sum + ((task.endTime || 0) - (task.startTime || 0)), 0
      );
      this.stats.averageProcessTime = Math.round(totalProcessTime / completedTasks.length);
    }
    
    this.stats.successRate = this.stats.totalTasks > 0 
      ? this.stats.completedTasks / this.stats.totalTasks 
      : 0;
  }

  /**
   * 清理已完成的任务
   */
  public cleanupCompletedTasks(): number {
    const completedTasks = Array.from(this.tasks.entries())
      .filter(([_, task]) => task.status === 'completed' || task.status === 'failed');
    
    completedTasks.forEach(([taskId, _]) => {
      this.tasks.delete(taskId);
    });
    
    this.updateStats();
    
    if (completedTasks.length > 0) {
      new Notice(`已清理 ${completedTasks.length} 个已完成的任务`);
    }
    
    return completedTasks.length;
  }

  /**
   * 导出任务结果
   */
  public exportTaskResult(taskId: string): string | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'completed') {
      return null;
    }

    const result = {
      taskName: task.name,
      template: task.template,
      completedAt: task.endTime,
      chunkCount: task.chunks.length,
      results: task.results,
      settings: task.settings
    };

    return JSON.stringify(result, null, 2);
  }

  /**
   * 获取任务进度
   */
  public getTaskProgress(taskId: string): { progress: number; status: string; eta?: number } | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    let eta: number | undefined;
    if (task.status === 'processing' && task.startTime) {
      const elapsed = Date.now() - task.startTime;
      const rate = task.progress / elapsed;
      if (rate > 0) {
        eta = Math.round((100 - task.progress) / rate);
      }
    }

    return {
      progress: task.progress,
      status: task.status,
      eta
    };
  }
}

/**
 * 信号量类，用于控制并发
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      this.permits--;
      resolve();
    }
  }
}

// 便捷函数
export const createBatchTask = (
  name: string,
  template: string,
  content: string,
  settings?: Partial<BatchTask['settings']>
): string => {
  return BatchProcessor.getInstance().createTask(name, template, content, settings);
};

export const processBatchTask = async (taskId: string, ai: AISettings): Promise<void> => {
  return BatchProcessor.getInstance().processTask(taskId, ai);
};

export const getBatchStats = (): BatchStats => {
  return BatchProcessor.getInstance().getStats();
};

import { Notice } from "obsidian";

export interface QueuedRequest {
  id: string;
  priority: 'high' | 'medium' | 'low';
  type: 'user' | 'preload' | 'background';
  template: string;
  input: string;
  model: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  onProgress?: (progress: number) => void;
  onComplete?: (result: string) => void;
  onError?: (error: any) => void;
  abortController?: AbortController;
}

export interface QueueStats {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  activeRequests: number;
  queuedRequests: number;
  averageWaitTime: number;
  averageProcessTime: number;
  throughput: number; // 每分钟处理的请求数
}

export interface QueueConfig {
  maxConcurrent: number;        // 最大并发数
  maxQueueSize: number;         // 最大队列长度
  priorityWeights: {            // 优先级权重
    high: number;
    medium: number;
    low: number;
  };
  timeoutMs: number;            // 请求超时时间
  retryDelay: number;           // 重试延迟
  enableThrottling: boolean;    // 是否启用限流
  throttleInterval: number;     // 限流间隔 (ms)
}

export class QueueManager {
  private static instance: QueueManager;
  private queue: QueuedRequest[] = [];
  private activeRequests: Map<string, QueuedRequest> = new Map();
  private completedRequests: QueuedRequest[] = [];
  private failedRequests: QueuedRequest[] = [];
  
  private config: QueueConfig = {
    maxConcurrent: 3,
    maxQueueSize: 50,
    priorityWeights: {
      high: 10,
      medium: 5,
      low: 1
    },
    timeoutMs: 30000,
    retryDelay: 2000,
    enableThrottling: true,
    throttleInterval: 1000
  };

  private stats: QueueStats = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    activeRequests: 0,
    queuedRequests: 0,
    averageWaitTime: 0,
    averageProcessTime: 0,
    throughput: 0
  };

  private processingTimer?: number;
  private lastProcessTime = 0;
  private waitTimes: number[] = [];
  private processTimes: number[] = [];
  private maxHistorySize = 100;

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  constructor() {
    this.startProcessing();
    this.startStatsUpdater();
  }

  /**
   * 添加请求到队列
   */
  public async enqueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    return new Promise((resolve, reject) => {
      // 检查队列大小限制
      if (this.queue.length >= this.config.maxQueueSize) {
        reject(new Error('请求队列已满，请稍后重试'));
        return;
      }

      const queuedRequest: QueuedRequest = {
        ...request,
        id: this.generateRequestId(),
        timestamp: Date.now(),
        retryCount: 0,
        onComplete: (result: string) => {
          request.onComplete?.(result);
          resolve(result);
        },
        onError: (error: any) => {
          request.onError?.(error);
          reject(error);
        }
      };

      // 插入到队列中的正确位置（按优先级排序）
      this.insertByPriority(queuedRequest);
      
      this.stats.totalRequests++;
      this.updateQueueStats();
      
      console.log(`[QueueManager] Enqueued request ${queuedRequest.id} with priority ${queuedRequest.priority}`);
    });
  }

  /**
   * 取消请求
   */
  public cancel(requestId: string): boolean {
    // 从队列中移除
    const queueIndex = this.queue.findIndex(req => req.id === requestId);
    if (queueIndex !== -1) {
      const request = this.queue.splice(queueIndex, 1)[0];
      request.onError?.(new Error('Request cancelled'));
      this.updateQueueStats();
      return true;
    }

    // 取消活动请求
    const activeRequest = this.activeRequests.get(requestId);
    if (activeRequest) {
      activeRequest.abortController?.abort();
      activeRequest.onError?.(new Error('Request cancelled'));
      this.activeRequests.delete(requestId);
      this.updateQueueStats();
      return true;
    }

    return false;
  }

  /**
   * 清空队列
   */
  public clearQueue(): void {
    // 取消所有排队的请求
    for (const request of this.queue) {
      request.onError?.(new Error('Queue cleared'));
    }
    this.queue = [];

    // 取消所有活动请求
    for (const request of this.activeRequests.values()) {
      request.abortController?.abort();
      request.onError?.(new Error('Queue cleared'));
    }
    this.activeRequests.clear();

    this.updateQueueStats();
    new Notice('AI 请求队列已清空', 2000);
  }

  /**
   * 按优先级插入请求
   */
  private insertByPriority(request: QueuedRequest): void {
    const weight = this.config.priorityWeights[request.priority];
    let insertIndex = this.queue.length;

    // 找到合适的插入位置
    for (let i = 0; i < this.queue.length; i++) {
      const existingWeight = this.config.priorityWeights[this.queue[i].priority];
      if (weight > existingWeight) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, request);
  }

  /**
   * 开始处理队列
   */
  private startProcessing(): void {
    const processNext = () => {
      this.processQueue();
      this.processingTimer = window.setTimeout(processNext, 100); // 每100ms检查一次
    };
    processNext();
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    // 检查是否可以处理更多请求
    if (this.activeRequests.size >= this.config.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // 限流检查
    if (this.config.enableThrottling) {
      const now = Date.now();
      if (now - this.lastProcessTime < this.config.throttleInterval) {
        return;
      }
      this.lastProcessTime = now;
    }

    // 获取下一个请求
    const request = this.queue.shift();
    if (!request) return;

    // 记录等待时间
    const waitTime = Date.now() - request.timestamp;
    this.waitTimes.push(waitTime);
    if (this.waitTimes.length > this.maxHistorySize) {
      this.waitTimes.shift();
    }

    // 开始处理请求
    this.activeRequests.set(request.id, request);
    this.updateQueueStats();

    try {
      await this.processRequest(request);
    } catch (error) {
      console.error(`[QueueManager] Failed to process request ${request.id}:`, error);
    }
  }

  /**
   * 处理单个请求
   */
  private async processRequest(request: QueuedRequest): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 创建 AbortController
      request.abortController = new AbortController();
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        request.abortController?.abort();
      }, this.config.timeoutMs);

      // 这里应该调用实际的 AI 请求函数
      // 为了演示，我们模拟一个异步操作
      const result = await this.simulateAIRequest(request);
      
      clearTimeout(timeoutId);
      
      // 记录处理时间
      const processTime = Date.now() - startTime;
      this.processTimes.push(processTime);
      if (this.processTimes.length > this.maxHistorySize) {
        this.processTimes.shift();
      }

      // 请求成功
      this.activeRequests.delete(request.id);
      this.completedRequests.push(request);
      this.stats.completedRequests++;
      
      request.onComplete?.(result);
      
      console.log(`[QueueManager] Completed request ${request.id} in ${processTime}ms`);
      
    } catch (error) {
      // 请求失败，考虑重试
      if (request.retryCount < request.maxRetries && !request.abortController?.signal.aborted) {
        request.retryCount++;
        console.log(`[QueueManager] Retrying request ${request.id} (${request.retryCount}/${request.maxRetries})`);
        
        // 延迟后重新加入队列
        setTimeout(() => {
          this.insertByPriority(request);
        }, this.config.retryDelay);
      } else {
        // 最终失败
        this.activeRequests.delete(request.id);
        this.failedRequests.push(request);
        this.stats.failedRequests++;
        
        request.onError?.(error);
        
        console.error(`[QueueManager] Request ${request.id} failed after ${request.retryCount} retries:`, error);
      }
    }
    
    this.updateQueueStats();
  }

  /**
   * 模拟 AI 请求（实际实现中应该调用真实的 AI 客户端）
   */
  private async simulateAIRequest(request: QueuedRequest): Promise<string> {
    // 这里应该集成实际的 AI 客户端
    // 例如：return await runChat(ai, messages, request.template);
    
    // 模拟处理时间
    const delay = Math.random() * 2000 + 1000; // 1-3秒
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // 模拟偶尔的失败
    if (Math.random() < 0.1) {
      throw new Error('Simulated AI request failure');
    }
    
    return `AI response for: ${request.input.substring(0, 50)}...`;
  }

  /**
   * 更新队列统计
   */
  private updateQueueStats(): void {
    this.stats.activeRequests = this.activeRequests.size;
    this.stats.queuedRequests = this.queue.length;
    
    if (this.waitTimes.length > 0) {
      this.stats.averageWaitTime = this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length;
    }
    
    if (this.processTimes.length > 0) {
      this.stats.averageProcessTime = this.processTimes.reduce((a, b) => a + b, 0) / this.processTimes.length;
    }
  }

  /**
   * 开始统计更新器
   */
  private startStatsUpdater(): void {
    setInterval(() => {
      // 计算吞吐量（每分钟完成的请求数）
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const recentCompleted = this.completedRequests.filter(req => 
        req.timestamp > oneMinuteAgo
      ).length;
      
      this.stats.throughput = recentCompleted;
    }, 10000); // 每10秒更新一次
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取队列状态
   */
  public getQueueStatus(): {
    queue: Array<{id: string, priority: string, type: string, waitTime: number}>;
    active: Array<{id: string, priority: string, type: string, processingTime: number}>;
  } {
    const now = Date.now();
    
    return {
      queue: this.queue.map(req => ({
        id: req.id,
        priority: req.priority,
        type: req.type,
        waitTime: now - req.timestamp
      })),
      active: Array.from(this.activeRequests.values()).map(req => ({
        id: req.id,
        priority: req.priority,
        type: req.type,
        processingTime: now - req.timestamp
      }))
    };
  }

  /**
   * 获取统计信息
   */
  public getStats(): QueueStats {
    this.updateQueueStats();
    return { ...this.stats };
  }

  /**
   * 获取性能建议
   */
  public getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.stats.averageWaitTime > 5000) {
      recommendations.push('平均等待时间过长，考虑增加并发数或优化请求优先级');
    }
    
    if (this.stats.queuedRequests > this.config.maxQueueSize * 0.8) {
      recommendations.push('队列接近满载，建议增加队列大小或优化处理速度');
    }
    
    if (this.stats.failedRequests / this.stats.totalRequests > 0.1) {
      recommendations.push('失败率较高，检查网络连接和 API 配置');
    }
    
    if (this.stats.throughput < 5) {
      recommendations.push('吞吐量较低，考虑优化请求处理逻辑');
    }
    
    return recommendations;
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[QueueManager] Configuration updated:', this.config);
  }

  /**
   * 获取当前配置
   */
  public getConfig(): QueueConfig {
    return { ...this.config };
  }

  /**
   * 暂停队列处理
   */
  public pause(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = undefined;
    }
    console.log('[QueueManager] Queue processing paused');
  }

  /**
   * 恢复队列处理
   */
  public resume(): void {
    if (!this.processingTimer) {
      this.startProcessing();
    }
    console.log('[QueueManager] Queue processing resumed');
  }

  /**
   * 销毁队列管理器
   */
  public destroy(): void {
    this.pause();
    this.clearQueue();
    this.completedRequests = [];
    this.failedRequests = [];
  }
}

// 便捷函数
export const enqueueAIRequest = async (
  template: string,
  input: string,
  model: string,
  priority: 'high' | 'medium' | 'low' = 'medium',
  type: 'user' | 'preload' | 'background' = 'user'
): Promise<string> => {
  const queue = QueueManager.getInstance();
  return queue.enqueue({
    template,
    input,
    model,
    priority,
    type,
    maxRetries: 2
  });
};

export const getQueueStats = (): QueueStats => {
  return QueueManager.getInstance().getStats();
};

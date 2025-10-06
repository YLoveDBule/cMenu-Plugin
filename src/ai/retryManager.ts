import { Notice } from "obsidian";
import { AIErrorHandler, ErrorStats } from "./errorHandler";

export interface RetryConfig {
  maxRetries: number;
  backoffMs: readonly number[];  // 指数退避时间
  retryableErrors: readonly string[];
  onRetry?: (attempt: number, error: any) => void;
  onMaxRetriesReached?: (error: any) => void;
}

export interface RetryableError {
  type: 'TIMEOUT' | 'NETWORK_ERROR' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'UNKNOWN';
  retryable: boolean;
  message: string;
}

export class RetryManager {
  private static instance: RetryManager;
  
  private defaultConfig: RetryConfig = {
    maxRetries: 3,
    backoffMs: [1000, 2000, 4000], // 1s, 2s, 4s
    retryableErrors: ['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMIT', 'SERVER_ERROR'],
    onRetry: (attempt, error) => {
      new Notice(`AI 请求失败，正在重试 (${attempt}/${this.defaultConfig.maxRetries})...`, 2000);
    },
    onMaxRetriesReached: (error) => {
      new Notice(`AI 请求多次失败，请检查网络连接或稍后重试`, 5000);
    }
  };

  static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager();
    }
    return RetryManager.instance;
  }

  /**
   * 分析错误类型，判断是否可重试
   */
  public analyzeError(error: any): RetryableError {
    const errorHandler = AIErrorHandler.getInstance();
    const aiError = errorHandler.analyzeError(error);
    
    // 记录错误统计
    ErrorStats.record(aiError.type);
    
    // 转换为 RetryableError 格式
    const typeMapping: Record<string, RetryableError['type']> = {
      'NETWORK': 'NETWORK_ERROR',
      'TIMEOUT': 'TIMEOUT',
      'QUOTA': 'RATE_LIMIT',
      'UNKNOWN': 'UNKNOWN'
    };
    
    return {
      type: typeMapping[aiError.type] || 'UNKNOWN',
      retryable: aiError.retryable,
      message: aiError.userMessage
    };
  }

  /**
   * 执行带重试的异步操作
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: any;
    
    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        // 第一次尝试不延迟，后续尝试按退避策略延迟
        if (attempt > 0) {
          const delay = finalConfig.backoffMs[Math.min(attempt - 1, finalConfig.backoffMs.length - 1)];
          await this.sleep(delay);
        }
        
        const result = await operation();
        
        // 成功时清除之前的错误通知
        if (attempt > 0) {
          new Notice('AI 请求成功恢复', 2000);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        const errorInfo = this.analyzeError(error);
        
        // 如果错误不可重试，直接抛出
        if (!errorInfo.retryable) {
          throw error;
        }
        
        // 如果还有重试机会
        if (attempt < finalConfig.maxRetries) {
          // 使用友好的错误提示
          const errorHandler = AIErrorHandler.getInstance();
          const aiError = errorHandler.analyzeError(error);
          
          finalConfig.onRetry?.(attempt + 1, error);
          console.warn(`[cMenu AI] Retry attempt ${attempt + 1}/${finalConfig.maxRetries}:`, aiError.userMessage);
          continue;
        }
        
        // 达到最大重试次数，显示详细错误信息
        const errorHandler = AIErrorHandler.getInstance();
        const aiError = errorHandler.analyzeError(error);
        errorHandler.showErrorNotice(aiError, true);
        
        finalConfig.onMaxRetriesReached?.(error);
        console.error(`[cMenu AI] Max retries reached:`, aiError);
        break;
      }
    }
    
    // 抛出最后一次的错误
    throw lastError;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 更新默认配置
   */
  public updateConfig(config: Partial<RetryConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * 获取当前配置
   */
  public getConfig(): RetryConfig {
    return { ...this.defaultConfig };
  }
}

// 便捷函数：直接使用默认实例
export const withRetry = <T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> => {
  return RetryManager.getInstance().executeWithRetry(operation, config);
};

// 预定义的重试配置
export const RETRY_CONFIGS: Record<string, Partial<RetryConfig>> = {
  // 快速重试（用于轻量级操作）
  FAST: {
    maxRetries: 2,
    backoffMs: [500, 1000],
  },
  
  // 标准重试（默认）
  STANDARD: {
    maxRetries: 3,
    backoffMs: [1000, 2000, 4000],
  },
  
  // 耐心重试（用于重要操作）
  PATIENT: {
    maxRetries: 5,
    backoffMs: [1000, 2000, 4000, 8000, 16000],
  },
  
  // 网络问题专用
  NETWORK_ISSUES: {
    maxRetries: 4,
    backoffMs: [2000, 4000, 8000, 16000],
    retryableErrors: ['TIMEOUT', 'NETWORK_ERROR'],
  }
};

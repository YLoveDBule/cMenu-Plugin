import { Notice } from "obsidian";

export interface AIError {
  type: 'NETWORK' | 'AUTH' | 'QUOTA' | 'MODEL' | 'CONTENT' | 'TIMEOUT' | 'UNKNOWN';
  code?: string;
  message: string;
  userMessage: string;  // 用户友好的错误信息
  retryable: boolean;
  suggestions?: string[];  // 解决建议
}

export class AIErrorHandler {
  private static instance: AIErrorHandler;

  static getInstance(): AIErrorHandler {
    if (!AIErrorHandler.instance) {
      AIErrorHandler.instance = new AIErrorHandler();
    }
    return AIErrorHandler.instance;
  }

  /**
   * 分析并分类错误
   */
  public analyzeError(error: any): AIError {
    const rawMessage = error?.message || error?.toString() || 'Unknown error';
    const statusCode = this.extractStatusCode(rawMessage);

    // 网络连接错误
    if (this.isNetworkError(rawMessage)) {
      return {
        type: 'NETWORK',
        message: rawMessage,
        userMessage: '网络连接失败，请检查网络设置',
        retryable: true,
        suggestions: [
          '检查网络连接是否正常',
          '确认防火墙或代理设置',
          '稍后重试'
        ]
      };
    }

    // 认证错误 (401, 403)
    if (statusCode === 401 || statusCode === 403 || this.isAuthError(rawMessage)) {
      return {
        type: 'AUTH',
        code: statusCode?.toString(),
        message: rawMessage,
        userMessage: 'API Key 无效或已过期',
        retryable: false,
        suggestions: [
          '检查 API Key 是否正确',
          '确认 API Key 是否有效',
          '联系 API 提供商确认账户状态'
        ]
      };
    }

    // 配额/限流错误 (429, 402)
    if (statusCode === 429 || statusCode === 402 || this.isQuotaError(rawMessage)) {
      return {
        type: 'QUOTA',
        code: statusCode?.toString(),
        message: rawMessage,
        userMessage: statusCode === 429 ? '请求过于频繁，请稍后重试' : '账户余额不足或配额已用完',
        retryable: statusCode === 429,
        suggestions: statusCode === 429 ? [
          '等待一段时间后重试',
          '减少请求频率',
          '考虑升级 API 计划'
        ] : [
          '检查账户余额',
          '充值或升级账户',
          '联系 API 提供商'
        ]
      };
    }

    // 模型错误 (400, 404)
    if (statusCode === 400 || statusCode === 404 || this.isModelError(rawMessage)) {
      return {
        type: 'MODEL',
        code: statusCode?.toString(),
        message: rawMessage,
        userMessage: '模型配置错误或不可用',
        retryable: false,
        suggestions: [
          '检查模型名称是否正确',
          '确认模型是否支持',
          '尝试使用其他模型'
        ]
      };
    }

    // 内容错误
    if (this.isContentError(rawMessage)) {
      return {
        type: 'CONTENT',
        message: rawMessage,
        userMessage: '内容被过滤或不符合要求',
        retryable: false,
        suggestions: [
          '修改输入内容',
          '避免敏感或不当内容',
          '尝试重新表述'
        ]
      };
    }

    // 超时错误
    if (this.isTimeoutError(rawMessage)) {
      return {
        type: 'TIMEOUT',
        message: rawMessage,
        userMessage: '请求超时，请稍后重试',
        retryable: true,
        suggestions: [
          '检查网络连接速度',
          '尝试缩短输入内容',
          '稍后重试'
        ]
      };
    }

    // 服务器错误 (5xx)
    if (statusCode && statusCode >= 500) {
      return {
        type: 'NETWORK',
        code: statusCode.toString(),
        message: rawMessage,
        userMessage: 'AI 服务暂时不可用',
        retryable: true,
        suggestions: [
          '稍后重试',
          '检查 API 服务状态',
          '尝试使用其他 AI 提供商'
        ]
      };
    }

    // 未知错误
    return {
      type: 'UNKNOWN',
      message: rawMessage,
      userMessage: '发生未知错误',
      retryable: false,
      suggestions: [
        '检查网络连接',
        '重启应用',
        '联系技术支持'
      ]
    };
  }

  /**
   * 显示用户友好的错误通知
   */
  public showErrorNotice(error: AIError, showSuggestions: boolean = true): void {
    let message = `❌ ${error.userMessage}`;
    
    if (showSuggestions && error.suggestions && error.suggestions.length > 0) {
      message += `\n\n💡 建议：\n${error.suggestions.map(s => `• ${s}`).join('\n')}`;
    }

    // 根据错误类型设置不同的显示时间
    const duration = this.getNoticeDuration(error.type);
    new Notice(message, duration);
  }

  /**
   * 获取错误的严重程度
   */
  public getErrorSeverity(error: AIError): 'low' | 'medium' | 'high' | 'critical' {
    switch (error.type) {
      case 'TIMEOUT':
      case 'NETWORK':
        return error.retryable ? 'medium' : 'high';
      case 'QUOTA':
        return 'high';
      case 'AUTH':
        return 'critical';
      case 'MODEL':
      case 'CONTENT':
        return 'medium';
      default:
        return 'low';
    }
  }

  // 私有方法：错误检测
  private isNetworkError(message: string): boolean {
    const networkKeywords = [
      'fetch', 'network', 'connection', 'NetworkError', 'ERR_NETWORK',
      'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'offline'
    ];
    return networkKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isAuthError(message: string): boolean {
    const authKeywords = [
      'unauthorized', 'forbidden', 'invalid api key', 'authentication',
      'api key', 'token', 'permission denied'
    ];
    return authKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isQuotaError(message: string): boolean {
    const quotaKeywords = [
      'quota', 'rate limit', 'too many requests', 'billing', 'insufficient',
      'exceeded', 'limit', 'balance', 'payment'
    ];
    return quotaKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isModelError(message: string): boolean {
    const modelKeywords = [
      'model', 'not found', 'invalid model', 'unsupported', 'bad request',
      'invalid request', 'parameter'
    ];
    return modelKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isContentError(message: string): boolean {
    const contentKeywords = [
      'content filter', 'inappropriate', 'violation', 'policy', 'blocked',
      'filtered', 'safety', 'harmful'
    ];
    return contentKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isTimeoutError(message: string): boolean {
    const timeoutKeywords = [
      'timeout', 'AbortError', 'TimeoutError', 'timed out'
    ];
    return timeoutKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private extractStatusCode(message: string): number | null {
    const match = message.match(/HTTP (\d{3})/);
    return match ? parseInt(match[1], 10) : null;
  }

  private getNoticeDuration(errorType: AIError['type']): number {
    switch (errorType) {
      case 'AUTH':
      case 'QUOTA':
        return 8000;  // 重要错误显示更长时间
      case 'NETWORK':
      case 'TIMEOUT':
        return 5000;  // 网络错误中等时间
      case 'MODEL':
      case 'CONTENT':
        return 6000;  // 配置错误稍长时间
      default:
        return 4000;  // 默认时间
    }
  }
}

// 便捷函数
export const handleAIError = (error: any, showSuggestions: boolean = true): AIError => {
  const handler = AIErrorHandler.getInstance();
  const aiError = handler.analyzeError(error);
  handler.showErrorNotice(aiError, showSuggestions);
  return aiError;
};

// 错误统计（用于后续分析）
export class ErrorStats {
  private static stats: Map<string, number> = new Map();

  static record(errorType: AIError['type']): void {
    const current = this.stats.get(errorType) || 0;
    this.stats.set(errorType, current + 1);
  }

  static getStats(): Record<string, number> {
    return Object.fromEntries(this.stats.entries());
  }

  static getMostCommonError(): string | null {
    let maxCount = 0;
    let mostCommon = null;
    
    for (const [type, count] of this.stats.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = type;
      }
    }
    
    return mostCommon;
  }

  static reset(): void {
    this.stats.clear();
  }
}

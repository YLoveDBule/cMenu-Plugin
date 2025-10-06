import { Notice } from "obsidian";

export interface NetworkStatus {
  online: boolean;
  latency: number;  // ms，-1 表示未知
  lastCheck: number;  // 时间戳
  quality: 'excellent' | 'good' | 'poor' | 'offline';
}

export interface NetworkCheckOptions {
  timeout: number;      // 检测超时时间
  endpoints: string[];  // 检测端点
  retries: number;      // 重试次数
}

export class NetworkDetector {
  private static instance: NetworkDetector;
  private status: NetworkStatus = {
    online: navigator.onLine,
    latency: -1,
    lastCheck: 0,
    quality: 'offline'
  };
  
  private checkInterval: number | null = null;
  private listeners: Array<(status: NetworkStatus) => void> = [];
  private onOnline?: () => void;
  private onOffline?: () => void;
  private onVisibilityChange?: () => void;
  
  private defaultOptions: NetworkCheckOptions = {
    timeout: 5000,
    endpoints: [
      'https://api.deepseek.com/health',  // DeepSeek 健康检查
      'https://api.openai.com/v1/models', // OpenAI 健康检查
      'https://httpbin.org/get',          // 通用网络检查
      'https://www.google.com/favicon.ico' // 备用检查
    ],
    retries: 2
  };

  static getInstance(): NetworkDetector {
    if (!NetworkDetector.instance) {
      NetworkDetector.instance = new NetworkDetector();
    }
    return NetworkDetector.instance;
  }

  constructor() {
    this.initializeEventListeners();
    this.checkNetworkStatus(); // 初始检查
  }

  /**
   * 初始化网络事件监听
   */
  private initializeEventListeners(): void {
    // 监听浏览器网络状态变化
    const onOnline = () => {
      this.status.online = true;
      this.checkNetworkStatus();
      this.notifyListeners();
    };

    const onOffline = () => {
      this.status.online = false;
      this.status.quality = 'offline';
      this.status.latency = -1;
      this.status.lastCheck = Date.now();
      this.notifyListeners();
      new Notice('网络连接已断开', 3000);
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        this.checkNetworkStatus();
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibilityChange);
    
    // 保存引用以便后续清理
    this.onOnline = onOnline;
    this.onOffline = onOffline;
    this.onVisibilityChange = onVisibilityChange;
  }

  /**
   * 检查网络状态
   */
  public async checkNetworkStatus(options?: Partial<NetworkCheckOptions>): Promise<NetworkStatus> {
    const finalOptions = { ...this.defaultOptions, ...options };
    
    if (!navigator.onLine) {
      this.status = {
        online: false,
        latency: -1,
        lastCheck: Date.now(),
        quality: 'offline'
      };
      this.notifyListeners();
      return this.status;
    }

    try {
      const latency = await this.measureLatency(finalOptions);
      this.status = {
        online: true,
        latency,
        lastCheck: Date.now(),
        quality: this.getQualityFromLatency(latency)
      };
    } catch (error) {
      console.warn('[NetworkDetector] Network check failed:', error);
      this.status = {
        online: false,
        latency: -1,
        lastCheck: Date.now(),
        quality: 'offline'
      };
    }

    this.notifyListeners();
    return this.status;
  }

  /**
   * 测量网络延迟
   */
  private async measureLatency(options: NetworkCheckOptions): Promise<number> {
    const results: number[] = [];
    
    for (const endpoint of options.endpoints) {
      try {
        const latency = await this.pingEndpoint(endpoint, options.timeout);
        if (latency > 0) {
          results.push(latency);
          break; // 有一个成功就够了
        }
      } catch (error) {
        console.warn(`[NetworkDetector] Ping failed for ${endpoint}:`, error);
        continue;
      }
    }

    if (results.length === 0) {
      throw new Error('All endpoints failed');
    }

    // 返回最好的结果
    return Math.min(...results);
  }

  /**
   * Ping 单个端点
   */
  private async pingEndpoint(url: string, timeout: number): Promise<number> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const startTime = performance.now();
      
      const response = await fetch(url, {
        method: 'HEAD', // 只获取头部，减少数据传输
        signal: controller.signal,
        cache: 'no-cache',
        mode: 'no-cors' // 避免 CORS 问题
      });
      
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      clearTimeout(timeoutId);
      return latency;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 根据延迟判断网络质量
   */
  private getQualityFromLatency(latency: number): NetworkStatus['quality'] {
    if (latency < 100) return 'excellent';      // < 100ms 优秀
    if (latency < 300) return 'good';           // < 300ms 良好  
    if (latency < 1000) return 'poor';          // < 1000ms 较差
    return 'poor';                              // >= 1000ms 很差
  }

  /**
   * 获取当前网络状态
   */
  public getStatus(): NetworkStatus {
    return { ...this.status };
  }

  /**
   * 检查是否适合进行 AI 请求
   */
  public isGoodForAI(): boolean {
    return this.status.online && 
           this.status.quality !== 'offline' &&
           (this.status.latency < 0 || this.status.latency < 5000); // 5秒以内可以接受
  }

  /**
   * 获取网络状态描述
   */
  public getStatusDescription(): string {
    if (!this.status.online) {
      return '网络已断开';
    }

    const latencyText = this.status.latency > 0 ? 
      ` (${Math.round(this.status.latency)}ms)` : '';

    switch (this.status.quality) {
      case 'excellent':
        return `网络状况优秀${latencyText}`;
      case 'good':
        return `网络状况良好${latencyText}`;
      case 'poor':
        return `网络状况较差${latencyText}`;
      default:
        return '网络状态未知';
    }
  }

  /**
   * 获取网络状态图标
   */
  public getStatusIcon(): string {
    switch (this.status.quality) {
      case 'excellent':
        return '🟢';
      case 'good':
        return '🟡';
      case 'poor':
        return '🔴';
      default:
        return '⚫';
    }
  }

  /**
   * 添加状态变化监听器
   */
  public addListener(callback: (status: NetworkStatus) => void): void {
    this.listeners.push(callback);
  }

  /**
   * 移除状态变化监听器
   */
  public removeListener(callback: (status: NetworkStatus) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.status);
      } catch (error) {
        console.error('[NetworkDetector] Listener error:', error);
      }
    });
  }

  /**
   * 开始定期检查网络状态
   */
  public startPeriodicCheck(intervalMs: number = 30000): void {
    this.stopPeriodicCheck();
    this.checkInterval = window.setInterval(() => {
      this.checkNetworkStatus();
    }, intervalMs);
  }

  /**
   * 停止定期检查
   */
  public stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 显示网络状态通知
   */
  public showStatusNotice(): void {
    const icon = this.getStatusIcon();
    const description = this.getStatusDescription();
    const message = `${icon} ${description}`;
    
    const duration = this.status.online ? 2000 : 4000;
    new Notice(message, duration);
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    this.stopPeriodicCheck();
    this.listeners = [];
    
    if (this.onOnline) {
      window.removeEventListener('online', this.onOnline);
    }
    if (this.onOffline) {
      window.removeEventListener('offline', this.onOffline);
    }
    if (this.onVisibilityChange) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }
}

// 便捷函数
export const getNetworkStatus = (): NetworkStatus => {
  return NetworkDetector.getInstance().getStatus();
};

export const isNetworkGoodForAI = (): boolean => {
  return NetworkDetector.getInstance().isGoodForAI();
};

export const checkNetworkAndNotify = async (): Promise<NetworkStatus> => {
  const detector = NetworkDetector.getInstance();
  const status = await detector.checkNetworkStatus();
  detector.showStatusNotice();
  return status;
};

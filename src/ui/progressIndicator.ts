import { Notice } from "obsidian";

export interface ProgressState {
  phase: 'connecting' | 'sending' | 'waiting' | 'receiving' | 'processing' | 'complete' | 'error';
  progress: number;  // 0-100
  message: string;
  startTime: number;
  estimatedDuration?: number; // ms
}

export interface ProgressOptions {
  showNotice: boolean;
  showInElement?: HTMLElement;
  autoHide: boolean;
  hideDelay: number; // ms
  showElapsedTime: boolean;
}

export class ProgressIndicator {
  private state: ProgressState;
  private options: ProgressOptions;
  private notice?: Notice;
  private element?: HTMLElement;
  private progressBar?: HTMLElement;
  private messageEl?: HTMLElement;
  private timeEl?: HTMLElement;
  private updateInterval?: number;
  private onComplete?: (success: boolean) => void;
  private onCancel?: () => void;

  constructor(options: Partial<ProgressOptions> = {}) {
    this.options = {
      showNotice: true,
      autoHide: true,
      hideDelay: 2000,
      showElapsedTime: true,
      ...options
    };

    this.state = {
      phase: 'connecting',
      progress: 0,
      message: '正在连接...',
      startTime: Date.now()
    };

    this.initialize();
  }

  private initialize(): void {
    if (this.options.showInElement) {
      this.createElementProgress();
    } else if (this.options.showNotice) {
      this.createNoticeProgress();
    }

    // 开始更新计时器
    if (this.options.showElapsedTime) {
      this.startTimeUpdater();
    }
  }

  /**
   * 创建元素内的进度显示
   */
  private createElementProgress(): void {
    if (!this.options.showInElement) return;

    this.element = this.options.showInElement.createDiv({ cls: 'cMenuProgressIndicator' });
    
    // 进度条容器
    const progressContainer = this.element.createDiv({ cls: 'cMenuProgressContainer' });
    
    // 进度条背景
    const progressBg = progressContainer.createDiv({ cls: 'cMenuProgressBg' });
    
    // 进度条
    this.progressBar = progressBg.createDiv({ cls: 'cMenuProgressBar' });
    this.progressBar.style.width = '0%';
    
    // 消息区域
    const messageContainer = this.element.createDiv({ cls: 'cMenuProgressMessage' });
    this.messageEl = messageContainer.createSpan({ cls: 'cMenuProgressText' });
    this.messageEl.textContent = this.state.message;
    
    // 时间显示
    if (this.options.showElapsedTime) {
      this.timeEl = messageContainer.createSpan({ cls: 'cMenuProgressTime' });
      this.updateTimeDisplay();
    }

    // 取消按钮
    const cancelBtn = messageContainer.createEl('button', { 
      cls: 'cMenuProgressCancel',
      text: '取消'
    });
    cancelBtn.onclick = () => this.cancel();
  }

  /**
   * 创建通知形式的进度显示
   */
  private createNoticeProgress(): void {
    const message = this.getNoticeMessage();
    this.notice = new Notice(message, 0); // 0 表示不自动消失
    
    // 添加自定义样式
    if (this.notice.noticeEl) {
      this.notice.noticeEl.addClass('cMenuProgressNotice');
      
      // 保存文本节点引用以便后续更新
      this.messageEl = this.notice.noticeEl.querySelector('.notice-text') || this.notice.noticeEl;
      
      // 添加取消按钮
      const cancelBtn = this.notice.noticeEl.createEl('button', {
        cls: 'cMenuProgressNoticeCancel',
        text: '✕'
      });
      cancelBtn.onclick = () => this.cancel();
    }
  }

  /**
   * 更新进度状态
   */
  public updateProgress(
    phase: ProgressState['phase'], 
    progress: number, 
    message?: string,
    estimatedDuration?: number
  ): void {
    this.state.phase = phase;
    this.state.progress = Math.max(0, Math.min(100, progress));
    
    if (message) {
      this.state.message = message;
    } else {
      this.state.message = this.getDefaultMessage(phase);
    }

    if (estimatedDuration) {
      this.state.estimatedDuration = estimatedDuration;
    }

    this.updateDisplay();
  }

  /**
   * 设置为完成状态
   */
  public complete(success: boolean = true, message?: string): void {
    this.state.phase = success ? 'complete' : 'error';
    this.state.progress = 100;
    this.state.message = message || (success ? '完成' : '失败');

    this.updateDisplay();
    this.onComplete?.(success);

    if (this.options.autoHide) {
      setTimeout(() => this.hide(), this.options.hideDelay);
    }
  }

  /**
   * 取消操作
   */
  public cancel(): void {
    this.onCancel?.();
    this.hide();
  }

  /**
   * 隐藏进度指示器
   */
  public hide(): void {
    this.stopTimeUpdater();
    
    if (this.notice) {
      this.notice.hide();
      this.notice = undefined;
    }
    
    if (this.element) {
      this.element.remove();
      this.element = undefined;
    }
  }

  /**
   * 设置完成回调
   */
  public onCompleteCallback(callback: (success: boolean) => void): void {
    this.onComplete = callback;
  }

  /**
   * 设置取消回调
   */
  public onCancelCallback(callback: () => void): void {
    this.onCancel = callback;
  }

  /**
   * 更新显示
   */
  private updateDisplay(): void {
    // 更新进度条
    if (this.progressBar) {
      this.progressBar.style.width = `${this.state.progress}%`;
      
      // 根据阶段设置颜色
      const color = this.getProgressColor();
      this.progressBar.style.backgroundColor = color;
    }

    // 更新消息
    if (this.messageEl) {
      this.messageEl.textContent = this.state.message;
    }

    // 更新通知
    if (this.notice && this.notice.noticeEl) {
      const message = this.getNoticeMessage();
      // 尝试多种方式更新通知文本
      const textNode = this.notice.noticeEl.querySelector('.notice-text') || 
                      this.notice.noticeEl.querySelector('div') ||
                      this.notice.noticeEl;
      if (textNode) {
        textNode.textContent = message;
      }
      // 备用方案：直接设置 innerHTML
      else {
        this.notice.noticeEl.innerHTML = `${message} <button class="cMenuProgressNoticeCancel">✕</button>`;
        const cancelBtn = this.notice.noticeEl.querySelector('.cMenuProgressNoticeCancel');
        if (cancelBtn) {
          (cancelBtn as HTMLElement).onclick = () => this.cancel();
        }
      }
    }

    // 更新时间显示
    if (this.timeEl) {
      this.updateTimeDisplay();
    }
  }

  /**
   * 获取进度条颜色
   */
  private getProgressColor(): string {
    switch (this.state.phase) {
      case 'connecting':
      case 'sending':
        return '#3b82f6'; // 蓝色
      case 'waiting':
      case 'receiving':
        return '#10b981'; // 绿色
      case 'processing':
        return '#f59e0b'; // 橙色
      case 'complete':
        return '#10b981'; // 绿色
      case 'error':
        return '#ef4444'; // 红色
      default:
        return '#6b7280'; // 灰色
    }
  }

  /**
   * 获取默认消息
   */
  private getDefaultMessage(phase: ProgressState['phase']): string {
    switch (phase) {
      case 'connecting':
        return '正在连接 AI 服务...';
      case 'sending':
        return '正在发送请求...';
      case 'waiting':
        return '等待 AI 响应...';
      case 'receiving':
        return '正在接收数据...';
      case 'processing':
        return '正在处理结果...';
      case 'complete':
        return 'AI 处理完成';
      case 'error':
        return 'AI 处理失败';
      default:
        return '处理中...';
    }
  }

  /**
   * 获取通知消息
   */
  private getNoticeMessage(): string {
    const elapsed = this.getElapsedTime();
    const progressText = `${Math.round(this.state.progress)}%`;
    const timeText = this.options.showElapsedTime ? ` (${elapsed})` : '';
    
    return `${this.state.message} ${progressText}${timeText}`;
  }

  /**
   * 获取已用时间
   */
  private getElapsedTime(): string {
    const elapsed = Date.now() - this.state.startTime;
    const seconds = Math.floor(elapsed / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
  }

  /**
   * 更新时间显示
   */
  private updateTimeDisplay(): void {
    if (this.timeEl) {
      this.timeEl.textContent = `(${this.getElapsedTime()})`;
    }
  }

  /**
   * 开始时间更新器
   */
  private startTimeUpdater(): void {
    this.updateInterval = window.setInterval(() => {
      this.updateTimeDisplay();
      
      // 更新通知消息（如果使用通知形式）
      if (this.notice && this.notice.noticeEl) {
        const message = this.getNoticeMessage();
        const textNode = this.notice.noticeEl.querySelector('.notice-text');
        if (textNode) {
          textNode.textContent = message;
        }
      }
    }, 1000);
  }

  /**
   * 停止时间更新器
   */
  private stopTimeUpdater(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  /**
   * 获取当前状态
   */
  public getState(): ProgressState {
    return { ...this.state };
  }
}

// 便捷函数：创建简单的进度通知
export const showSimpleProgress = (message: string): ProgressIndicator => {
  const progress = new ProgressIndicator({
    showNotice: true,
    autoHide: false,
    showElapsedTime: true
  });
  
  // 立即更新为正确的初始状态
  setTimeout(() => {
    progress.updateProgress('sending', 10, message);
  }, 50);
  
  return progress;
};

// 便捷函数：创建带进度条的元素进度
export const showElementProgress = (container: HTMLElement): ProgressIndicator => {
  return new ProgressIndicator({
    showNotice: false,
    showInElement: container,
    autoHide: false,
    showElapsedTime: true
  });
};

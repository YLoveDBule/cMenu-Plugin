import { MarkdownRenderer, Component, MarkdownView } from "obsidian";

export interface StreamRenderConfig {
  chunkSize: number;          // 每次渲染的字符数
  renderDelay: number;        // 渲染间隔 (ms)
  enableMarkdown: boolean;    // 是否启用 Markdown 渲染
  maxBufferSize: number;      // 最大缓冲区大小
  enableSyntaxHighlight: boolean; // 是否启用语法高亮
}

export interface RenderStats {
  totalChunks: number;
  renderedChunks: number;
  totalCharacters: number;
  renderTime: number;
  fps: number;
}

export class StreamRenderer {
  private config: StreamRenderConfig = {
    chunkSize: 50,              // 50字符每次
    renderDelay: 16,            // 60fps
    enableMarkdown: true,
    maxBufferSize: 10000,       // 10k字符缓冲
    enableSyntaxHighlight: true
  };

  private renderQueue: string[] = [];
  private isRendering = false;
  private renderTimer?: number;
  private stats: RenderStats = {
    totalChunks: 0,
    renderedChunks: 0,
    totalCharacters: 0,
    renderTime: 0,
    fps: 0
  };

  private startTime = 0;
  private frameCount = 0;
  private lastFrameTime = 0;

  constructor(config?: Partial<StreamRenderConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * 开始流式渲染
   */
  public startStreaming(
    container: HTMLElement,
    app: any,
    filePath?: string
  ): {
    addChunk: (chunk: string) => void;
    finish: () => void;
    cancel: () => void;
    getStats: () => RenderStats;
  } {
    this.reset();
    this.startTime = performance.now();
    
    let buffer = '';
    let isFinished = false;
    let textElement: HTMLElement;
    let markdownContainer: HTMLElement;

    // 创建渲染容器
    container.empty();
    
    if (this.config.enableMarkdown) {
      // Markdown 模式：创建两个容器
      textElement = container.createEl('div', { 
        cls: 'cMenuStreamText',
        attr: { style: 'display: none;' }
      });
      markdownContainer = container.createEl('div', { 
        cls: 'cMenuStreamMarkdown'
      });
    } else {
      // 纯文本模式
      textElement = container.createEl('pre', { 
        cls: 'cMenuStreamText'
      });
    }

    const addChunk = (chunk: string) => {
      if (isFinished) return;
      
      buffer += chunk;
      this.stats.totalCharacters += chunk.length;
      
      // 立即显示文本（用于实时反馈）
      if (textElement) {
        textElement.textContent = buffer;
        
        // 自动滚动到底部
        textElement.scrollTop = textElement.scrollHeight;
      }

      // 将块添加到渲染队列
      this.addToRenderQueue(chunk);
      
      // 开始渲染处理
      if (!this.isRendering) {
        this.startRenderLoop(markdownContainer, app, filePath);
      }
    };

    const finish = async () => {
      if (isFinished) return;
      isFinished = true;
      
      // 等待所有渲染完成
      await this.finishRendering();
      
      // 最终 Markdown 渲染
      if (this.config.enableMarkdown && markdownContainer && buffer.trim()) {
        try {
          markdownContainer.empty();
          const component = new Component();
          await MarkdownRenderer.render(app, buffer, markdownContainer, filePath || '', component);
          
          // 隐藏文本容器，显示 Markdown 容器
          if (textElement) {
            textElement.style.display = 'none';
          }
          markdownContainer.style.display = 'block';
        } catch (error) {
          console.warn('[StreamRenderer] Markdown rendering failed:', error);
          // 回退到文本显示
          if (textElement) {
            textElement.style.display = 'block';
          }
        }
      }
      
      this.calculateFinalStats();
    };

    const cancel = () => {
      isFinished = true;
      this.stopRenderLoop();
      this.reset();
    };

    const getStats = () => ({ ...this.stats });

    return { addChunk, finish, cancel, getStats };
  }

  /**
   * 添加到渲染队列
   */
  private addToRenderQueue(chunk: string): void {
    // 将大块分割成小块
    for (let i = 0; i < chunk.length; i += this.config.chunkSize) {
      const subChunk = chunk.substring(i, i + this.config.chunkSize);
      this.renderQueue.push(subChunk);
      this.stats.totalChunks++;
    }
  }

  /**
   * 开始渲染循环
   */
  private startRenderLoop(
    container: HTMLElement | undefined,
    app: any,
    filePath?: string
  ): void {
    if (this.isRendering) return;
    
    this.isRendering = true;
    this.lastFrameTime = performance.now();

    const renderFrame = () => {
      if (!this.isRendering || this.renderQueue.length === 0) {
        return;
      }

      const frameStart = performance.now();
      const frameBudget = this.config.renderDelay; // 每帧的时间预算

      // 在时间预算内处理尽可能多的块
      while (this.renderQueue.length > 0 && (performance.now() - frameStart) < frameBudget) {
        const chunk = this.renderQueue.shift();
        if (chunk) {
          this.processChunk(chunk, container, app, filePath);
          this.stats.renderedChunks++;
        }
      }

      // 更新 FPS 统计
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFrameTime >= 1000) { // 每秒更新一次
        this.stats.fps = this.frameCount / ((now - this.lastFrameTime) / 1000);
        this.frameCount = 0;
        this.lastFrameTime = now;
      }

      // 继续下一帧
      if (this.renderQueue.length > 0) {
        this.renderTimer = window.setTimeout(renderFrame, this.config.renderDelay);
      } else {
        this.isRendering = false;
      }
    };

    renderFrame();
  }

  /**
   * 处理单个块
   */
  private processChunk(
    chunk: string,
    container: HTMLElement | undefined,
    app: any,
    filePath?: string
  ): void {
    // 这里可以添加特殊处理逻辑
    // 例如：语法高亮、特殊格式检测等
    
    if (this.config.enableSyntaxHighlight) {
      // 检测代码块
      if (chunk.includes('```')) {
        // 处理代码块的开始或结束
        this.handleCodeBlock(chunk);
      }
    }

    // 更新渲染时间统计
    this.stats.renderTime = performance.now() - this.startTime;
  }

  /**
   * 处理代码块
   */
  private handleCodeBlock(chunk: string): void {
    // 代码块处理逻辑
    // 可以在这里添加语法高亮等功能
  }

  /**
   * 停止渲染循环
   */
  private stopRenderLoop(): void {
    this.isRendering = false;
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = undefined;
    }
  }

  /**
   * 等待渲染完成
   */
  private async finishRendering(): Promise<void> {
    return new Promise((resolve) => {
      const checkComplete = () => {
        if (this.renderQueue.length === 0 && !this.isRendering) {
          resolve();
        } else {
          setTimeout(checkComplete, 10);
        }
      };
      checkComplete();
    });
  }

  /**
   * 计算最终统计
   */
  private calculateFinalStats(): void {
    const totalTime = performance.now() - this.startTime;
    this.stats.renderTime = totalTime;
    
    if (totalTime > 0) {
      this.stats.fps = (this.stats.renderedChunks / totalTime) * 1000;
    }
  }

  /**
   * 重置状态
   */
  private reset(): void {
    this.stopRenderLoop();
    this.renderQueue = [];
    this.stats = {
      totalChunks: 0,
      renderedChunks: 0,
      totalCharacters: 0,
      renderTime: 0,
      fps: 0
    };
    this.startTime = 0;
    this.frameCount = 0;
    this.lastFrameTime = 0;
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<StreamRenderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  public getConfig(): StreamRenderConfig {
    return { ...this.config };
  }

  /**
   * 获取性能建议
   */
  public getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.stats.fps < 30) {
      recommendations.push('考虑增加 renderDelay 或减少 chunkSize 以提升性能');
    }
    
    if (this.stats.totalCharacters > this.config.maxBufferSize) {
      recommendations.push('内容过长，建议启用分页或虚拟滚动');
    }
    
    if (this.stats.renderTime > 5000) {
      recommendations.push('渲染时间过长，考虑禁用 Markdown 渲染或语法高亮');
    }
    
    return recommendations;
  }
}

// 便捷函数：创建优化的流式渲染器
export const createOptimizedRenderer = (contentLength: number): StreamRenderer => {
  let config: Partial<StreamRenderConfig> = {};
  
  if (contentLength < 1000) {
    // 短内容：高质量渲染
    config = {
      chunkSize: 100,
      renderDelay: 16,
      enableMarkdown: true,
      enableSyntaxHighlight: true
    };
  } else if (contentLength < 5000) {
    // 中等内容：平衡性能和质量
    config = {
      chunkSize: 50,
      renderDelay: 32,
      enableMarkdown: true,
      enableSyntaxHighlight: true
    };
  } else {
    // 长内容：优先性能
    config = {
      chunkSize: 25,
      renderDelay: 50,
      enableMarkdown: false,
      enableSyntaxHighlight: false
    };
  }
  
  return new StreamRenderer(config);
};

// 便捷函数：简单流式文本渲染
export const renderStreamText = (
  container: HTMLElement,
  text: string,
  onComplete?: () => void
): void => {
  const renderer = new StreamRenderer({
    enableMarkdown: false,
    chunkSize: 30,
    renderDelay: 20
  });
  
  const { addChunk, finish } = renderer.startStreaming(container, null);
  
  // 模拟流式输入
  let index = 0;
  const addNextChunk = () => {
    if (index < text.length) {
      const chunk = text.substring(index, index + 30);
      addChunk(chunk);
      index += 30;
      setTimeout(addNextChunk, 20);
    } else {
      finish();
      onComplete?.();
    }
  };
  
  addNextChunk();
};

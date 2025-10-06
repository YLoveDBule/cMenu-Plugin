import { ButtonComponent } from "obsidian";
import { validateIcon } from "src/icons/catalog";

export interface IconFallbackOptions {
  fallbackIcon?: string;
  onError?: (iconId: string, error: Error) => void;
  retryAttempts?: number;
}

export class IconFallbackManager {
  private static instance: IconFallbackManager;
  private failedIcons = new Set<string>();
  private retryCount = new Map<string, number>();

  static getInstance(): IconFallbackManager {
    if (!IconFallbackManager.instance) {
      IconFallbackManager.instance = new IconFallbackManager();
    }
    return IconFallbackManager.instance;
  }

  public setIconWithFallback(
    button: ButtonComponent, 
    iconId: string, 
    options: IconFallbackOptions = {}
  ): boolean {
    const {
      fallbackIcon = 'bot-glyph',
      onError,
      retryAttempts = 2
    } = options;

    // 如果图标已知失败且重试次数用完，直接使用回退图标
    if (this.failedIcons.has(iconId) && 
        (this.retryCount.get(iconId) || 0) >= retryAttempts) {
      button.setIcon(fallbackIcon);
      return false;
    }

    try {
      // 验证图标是否在目录中
      if (!validateIcon(iconId)) {
        throw new Error(`Icon "${iconId}" not found in catalog`);
      }

      // 尝试设置图标
      button.setIcon(iconId);
      
      // 检查是否实际渲染成功
      setTimeout(() => {
        const svg = button.buttonEl.querySelector('svg');
        if (!svg || svg.children.length === 0) {
          this.handleIconError(button, iconId, fallbackIcon, onError);
        } else {
          // 成功，清除失败记录
          this.failedIcons.delete(iconId);
          this.retryCount.delete(iconId);
        }
      }, 100);

      return true;
    } catch (error) {
      this.handleIconError(button, iconId, fallbackIcon, onError, error as Error);
      return false;
    }
  }

  private handleIconError(
    button: ButtonComponent,
    iconId: string,
    fallbackIcon: string,
    onError?: (iconId: string, error: Error) => void,
    error?: Error
  ) {
    // 记录失败
    this.failedIcons.add(iconId);
    const currentRetries = this.retryCount.get(iconId) || 0;
    this.retryCount.set(iconId, currentRetries + 1);

    // 使用回退图标
    button.setIcon(fallbackIcon);
    
    // 添加视觉提示
    button.buttonEl.style.opacity = '0.7';
    button.buttonEl.title = `图标 "${iconId}" 加载失败，使用默认图标`;

    // 触发错误回调
    if (onError) {
      onError(iconId, error || new Error(`Failed to load icon: ${iconId}`));
    }

    // 控制台警告
    console.warn(`[cMenu] Icon fallback: "${iconId}" -> "${fallbackIcon}"`, error);
  }

  public clearFailedIcons() {
    this.failedIcons.clear();
    this.retryCount.clear();
  }

  public getFailedIcons(): string[] {
    return Array.from(this.failedIcons);
  }

  public isIconFailed(iconId: string): boolean {
    return this.failedIcons.has(iconId);
  }
}

// 全局图标一致性检查器
export class IconConsistencyChecker {
  public static checkContainer(container: HTMLElement): {
    totalIcons: number;
    failedIcons: string[];
    inconsistentSizes: number;
    recommendations: string[];
  } {
    const icons = container.querySelectorAll('svg');
    const sizes = new Map<string, number>();
    const failedIcons: string[] = [];
    let totalIcons = 0;

    icons.forEach((svg) => {
      totalIcons++;
      
      // 检查尺寸
      const width = svg.getAttribute('width') || svg.style.width;
      const height = svg.getAttribute('height') || svg.style.height;
      const sizeKey = `${width}x${height}`;
      sizes.set(sizeKey, (sizes.get(sizeKey) || 0) + 1);

      // 检查是否为空图标
      if (svg.children.length === 0) {
        const button = svg.closest('button');
        const iconId = button?.getAttribute('data-icon-id') || 'unknown';
        failedIcons.push(iconId);
      }
    });

    const recommendations: string[] = [];
    
    // 尺寸一致性建议
    if (sizes.size > 1) {
      const mostCommonSize = Array.from(sizes.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
      recommendations.push(`建议统一图标尺寸为 ${mostCommonSize}`);
    }

    // 失败图标建议
    if (failedIcons.length > 0) {
      recommendations.push(`${failedIcons.length} 个图标加载失败，建议检查图标 ID`);
    }

    return {
      totalIcons,
      failedIcons,
      inconsistentSizes: sizes.size - 1,
      recommendations
    };
  }
}

// 主题适配工具
export class ThemeAdaptiveIcon {
  public static applyThemeStyles(button: ButtonComponent, theme: 'light' | 'dark' | 'auto' = 'auto') {
    const buttonEl = button.buttonEl;
    const svg = buttonEl.querySelector('svg');
    
    if (!svg) return;

    // 自动检测主题
    let actualTheme: 'light' | 'dark';
    if (theme === 'auto') {
      actualTheme = document.body.hasClass('theme-dark') ? 'dark' : 'light';
    } else {
      actualTheme = theme;
    }

    // 应用主题样式
    if (actualTheme === 'dark') {
      svg.style.filter = 'brightness(0.9) contrast(1.1)';
      buttonEl.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    } else {
      svg.style.filter = 'brightness(1) contrast(1)';
      buttonEl.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
    }

    // 高对比度模式
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      svg.style.filter += ' contrast(1.5)';
      buttonEl.style.border = '2px solid currentColor';
    }
  }

  public static observeThemeChanges(callback: (theme: 'light' | 'dark') => void) {
    const observer = new MutationObserver(() => {
      const theme = document.body.hasClass('theme-dark') ? 'dark' : 'light';
      callback(theme);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return observer;
  }
}

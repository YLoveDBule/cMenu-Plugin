import { ButtonComponent } from "obsidian";
import { validateIcon } from "src/icons/catalog";
import { IconFallbackManager, ThemeAdaptiveIcon } from "src/utils/iconFallback";

export interface IconPreviewOptions {
  iconId?: string;
  size?: 'small' | 'medium' | 'large';
  showThemeToggle?: boolean;
  showValidation?: boolean;
  container: HTMLElement;
  onChange?: (iconId: string, isValid: boolean) => void;
}

export class IconPreview {
  private options: IconPreviewOptions;
  private previewContainer: HTMLElement;
  private iconButton: ButtonComponent;
  private themeToggle?: ButtonComponent;
  private validationEl?: HTMLElement;
  private currentTheme: 'light' | 'dark' = 'light';
  private currentIconId: string = '';

  constructor(options: IconPreviewOptions) {
    this.options = options;
    this.currentIconId = options.iconId || '';
    this.detectCurrentTheme();
    this.render();
  }

  private detectCurrentTheme() {
    // 检测当前主题
    const body = document.body;
    this.currentTheme = body.hasClass('theme-dark') ? 'dark' : 'light';
  }

  private render() {
    this.previewContainer = this.options.container.createDiv({ 
      cls: 'cMenuIconPreviewContainer' 
    });

    // 主预览区域
    const previewArea = this.previewContainer.createDiv({ 
      cls: 'cMenuIconPreviewArea' 
    });

    // 图标按钮
    this.iconButton = new ButtonComponent(previewArea);
    this.iconButton.setClass('cMenuIconPreviewButton');
    this.iconButton.setClass(`size-${this.options.size || 'medium'}`);
    this.iconButton.setDisabled(true);

    // 主题切换按钮
    if (this.options.showThemeToggle) {
      const themeContainer = previewArea.createDiv({ 
        cls: 'cMenuIconPreviewThemeToggle' 
      });
      
      this.themeToggle = new ButtonComponent(themeContainer);
      this.themeToggle.setIcon(this.currentTheme === 'light' ? 'sun' : 'moon');
      this.themeToggle.setClass('cMenuIconPreviewThemeBtn');
      this.themeToggle.setTooltip(`切换到${this.currentTheme === 'light' ? '深色' : '浅色'}主题预览`);
      this.themeToggle.onClick(() => this.toggleTheme());
    }

    // 校验提示
    if (this.options.showValidation) {
      this.validationEl = this.previewContainer.createDiv({ 
        cls: 'cMenuIconPreviewValidation' 
      });
    }

    // 初始更新
    this.updatePreview();
  }

  private toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    
    // 更新主题切换按钮
    if (this.themeToggle) {
      this.themeToggle.setIcon(this.currentTheme === 'light' ? 'sun' : 'moon');
      this.themeToggle.setTooltip(`切换到${this.currentTheme === 'light' ? '深色' : '浅色'}主题预览`);
    }

    // 应用主题样式
    this.previewContainer.removeClass('theme-light', 'theme-dark');
    this.previewContainer.addClass(`theme-${this.currentTheme}`);

    // 更新预览
    this.updatePreview();
  }

  public setIcon(iconId: string) {
    this.currentIconId = iconId;
    this.updatePreview();
  }

  private updatePreview() {
    const iconId = this.currentIconId.trim();
    const isValid = iconId ? validateIcon(iconId) : true;
    const fallbackManager = IconFallbackManager.getInstance();

    // 更新图标显示
    if (iconId && isValid) {
      const success = fallbackManager.setIconWithFallback(this.iconButton, iconId, {
        fallbackIcon: 'bot-glyph',
        onError: (failedIconId, error) => {
          console.warn(`Icon preview failed for "${failedIconId}":`, error);
        }
      });
      
      this.iconButton.buttonEl.style.opacity = success ? '1' : '0.7';
      this.iconButton.buttonEl.style.color = success ? '' : 'var(--text-muted)';
    } else if (iconId) {
      // 无效图标，显示回退图标
      this.iconButton.setIcon('bot-glyph');
      this.iconButton.buttonEl.style.opacity = '0.5';
      this.iconButton.buttonEl.style.color = 'var(--text-error)';
    } else {
      // 空图标
      this.iconButton.setIcon('bot-glyph');
      this.iconButton.buttonEl.style.opacity = '0.3';
      this.iconButton.buttonEl.style.color = 'var(--text-faint)';
    }
    
    // 应用主题样式
    ThemeAdaptiveIcon.applyThemeStyles(this.iconButton, this.currentTheme);

    // 更新校验提示
    if (this.validationEl) {
      this.validationEl.empty();
      if (iconId && !isValid) {
        const errorEl = this.validationEl.createSpan({ 
          text: `图标 "${iconId}" 不存在`,
          cls: 'cMenuIconPreviewError'
        });
      } else if (iconId && isValid) {
        const successEl = this.validationEl.createSpan({ 
          text: `✓ 图标有效`,
          cls: 'cMenuIconPreviewSuccess'
        });
      }
    }

    // 触发回调
    this.options.onChange?.(iconId, isValid);
  }

  public getIconId(): string {
    return this.currentIconId;
  }

  public isValid(): boolean {
    return this.currentIconId ? validateIcon(this.currentIconId) : true;
  }

  public destroy() {
    this.previewContainer.remove();
  }
}

// 全局图标尺寸统一工具
export class IconSizeManager {
  private static instance: IconSizeManager;
  private sizeConfig = {
    small: { width: '16px', height: '16px' },
    medium: { width: '20px', height: '20px' },
    large: { width: '24px', height: '24px' },
    xlarge: { width: '32px', height: '32px' }
  };

  static getInstance(): IconSizeManager {
    if (!IconSizeManager.instance) {
      IconSizeManager.instance = new IconSizeManager();
    }
    return IconSizeManager.instance;
  }

  public applySizeToElement(element: HTMLElement, size: keyof typeof this.sizeConfig) {
    const config = this.sizeConfig[size];
    if (config) {
      const svg = element.querySelector('svg');
      if (svg) {
        svg.style.width = config.width;
        svg.style.height = config.height;
        svg.style.minWidth = config.width;
        svg.style.minHeight = config.height;
      }
    }
  }

  public createUnifiedIconButton(container: HTMLElement, iconId: string, size: keyof typeof this.sizeConfig = 'medium'): ButtonComponent {
    const btn = new ButtonComponent(container);
    const fallbackManager = IconFallbackManager.getInstance();
    
    // 使用回退机制设置图标
    fallbackManager.setIconWithFallback(btn, iconId, {
      fallbackIcon: 'bot-glyph',
      onError: (failedIconId, error) => {
        console.warn(`Unified icon failed for "${failedIconId}":`, error);
      }
    });
    
    btn.setClass('cMenuUnifiedIcon');
    btn.setClass(`cMenuUnifiedIcon-${size}`);
    
    // 应用统一尺寸和主题样式
    setTimeout(() => {
      this.applySizeToElement(btn.buttonEl, size);
      ThemeAdaptiveIcon.applyThemeStyles(btn);
    }, 0);

    return btn;
  }

  public ensureIconConsistency(container: HTMLElement) {
    // 确保容器内所有图标尺寸一致
    const icons = container.querySelectorAll('.cMenuUnifiedIcon');
    icons.forEach((icon) => {
      const sizeClass = Array.from(icon.classList).find(cls => cls.startsWith('cMenuUnifiedIcon-'));
      if (sizeClass) {
        const size = sizeClass.replace('cMenuUnifiedIcon-', '') as keyof typeof this.sizeConfig;
        this.applySizeToElement(icon as HTMLElement, size);
      }
    });
  }
}

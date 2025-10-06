import { App, Modal, ButtonComponent, Setting } from "obsidian";
import { COMMON_ICONS, searchIcons, IconInfo } from "src/icons/catalog";

interface IconPickerOptions {
  currentIcon?: string;
  onSelect: (iconId: string) => void;
  onCancel?: () => void;
}

export class IconPickerModal extends Modal {
  private options: IconPickerOptions;
  private searchInput: HTMLInputElement;
  private gridContainer: HTMLElement;
  private categoryFilter: string = 'all';
  private currentIcons: IconInfo[] = [];
  private recentIcons: string[] = [];
  private favoriteIcons: Set<string> = new Set();

  constructor(app: App, options: IconPickerOptions) {
    super(app);
    this.options = options;
    this.loadUserData();
  }

  private loadUserData() {
    // 从 localStorage 加载最近使用和收藏
    try {
      const recent = localStorage.getItem('cMenu-recent-icons');
      this.recentIcons = recent ? JSON.parse(recent) : [];
      
      const favorites = localStorage.getItem('cMenu-favorite-icons');
      this.favoriteIcons = new Set(favorites ? JSON.parse(favorites) : []);
    } catch (e) {
      console.warn('Failed to load icon picker user data:', e);
    }
  }

  private saveUserData() {
    try {
      localStorage.setItem('cMenu-recent-icons', JSON.stringify(this.recentIcons));
      localStorage.setItem('cMenu-favorite-icons', JSON.stringify([...this.favoriteIcons]));
    } catch (e) {
      console.warn('Failed to save icon picker user data:', e);
    }
  }

  private addToRecent(iconId: string) {
    // 移除已存在的
    this.recentIcons = this.recentIcons.filter(id => id !== iconId);
    // 添加到开头
    this.recentIcons.unshift(iconId);
    // 限制数量
    this.recentIcons = this.recentIcons.slice(0, 12);
    this.saveUserData();
  }

  private toggleFavorite(iconId: string) {
    if (this.favoriteIcons.has(iconId)) {
      this.favoriteIcons.delete(iconId);
    } else {
      this.favoriteIcons.add(iconId);
    }
    this.saveUserData();
    this.refreshGrid(); // 刷新显示收藏状态
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('cMenuIconPickerModal');

    // 标题
    contentEl.createEl('h2', { text: '选择图标' });

    // 搜索栏
    const searchContainer = contentEl.createDiv({ cls: 'cMenuIconPickerSearch' });
    this.searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: '搜索图标...',
      cls: 'cMenuIconPickerSearchInput'
    });

    // 分类筛选
    const filterContainer = contentEl.createDiv({ cls: 'cMenuIconPickerFilters' });
    const categories = [
      { key: 'all', name: '全部' },
      { key: 'recent', name: '最近使用' },
      { key: 'favorites', name: '收藏' },
      { key: 'ai', name: 'AI' },
      { key: 'edit', name: '编辑' },
      { key: 'action', name: '操作' },
      { key: 'document', name: '文档' },
      { key: 'language', name: '语言' },
      { key: 'verify', name: '验证' },
      { key: 'general', name: '通用' },
      { key: 'plugin', name: '插件' }
    ];

    categories.forEach(cat => {
      const btn = new ButtonComponent(filterContainer);
      btn.setButtonText(cat.name);
      btn.setClass('cMenuIconPickerFilterBtn');
      if (cat.key === this.categoryFilter) {
        btn.setClass('is-active');
      }
      btn.onClick(() => {
        // 更新按钮状态
        filterContainer.querySelectorAll('.cMenuIconPickerFilterBtn').forEach(b => {
          b.removeClass('is-active');
        });
        btn.setClass('is-active');
        
        this.categoryFilter = cat.key;
        this.refreshGrid();
      });
    });

    // 图标网格
    this.gridContainer = contentEl.createDiv({ cls: 'cMenuIconPickerGrid' });

    // 底部按钮
    const footerContainer = contentEl.createDiv({ cls: 'cMenuIconPickerFooter' });
    const cancelBtn = new ButtonComponent(footerContainer);
    cancelBtn.setButtonText('取消').onClick(() => {
      this.options.onCancel?.();
      this.close();
    });

    // 搜索事件
    this.searchInput.addEventListener('input', () => {
      this.refreshGrid();
    });

    // 初始加载
    this.refreshGrid();
    
    // 聚焦搜索框
    setTimeout(() => this.searchInput.focus(), 100);
    
    // 键盘快捷键
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  private refreshGrid() {
    this.gridContainer.empty();
    
    const query = this.searchInput.value.trim();
    let icons: IconInfo[] = [];

    if (this.categoryFilter === 'recent') {
      // 最近使用
      icons = this.recentIcons
        .map(id => COMMON_ICONS.find(icon => icon.id === id))
        .filter(Boolean) as IconInfo[];
    } else if (this.categoryFilter === 'favorites') {
      // 收藏
      icons = COMMON_ICONS.filter(icon => this.favoriteIcons.has(icon.id));
    } else if (this.categoryFilter === 'all') {
      // 全部（支持搜索）
      icons = query ? searchIcons(query, 50) : COMMON_ICONS;
    } else {
      // 按标签筛选
      icons = COMMON_ICONS.filter(icon => 
        icon.tags?.includes(this.categoryFilter) || 
        (this.categoryFilter === 'plugin' && icon.source === 'plugin')
      );
      
      // 在分类内搜索
      if (query) {
        const q = query.toLowerCase();
        icons = icons.filter(icon => 
          icon.id.toLowerCase().includes(q) ||
          icon.name.toLowerCase().includes(q) ||
          (icon.aliases && icon.aliases.some(alias => alias.toLowerCase().includes(q)))
        );
      }
    }

    this.currentIcons = icons;

    if (icons.length === 0) {
      this.gridContainer.createDiv({ 
        text: '未找到匹配的图标', 
        cls: 'cMenuIconPickerEmpty' 
      });
      return;
    }

    // 渲染图标网格
    icons.forEach(icon => {
      const item = this.gridContainer.createDiv({ cls: 'cMenuIconPickerItem' });
      
      // 图标按钮
      const iconBtn = new ButtonComponent(item);
      iconBtn.setIcon(icon.id);
      iconBtn.setClass('cMenuIconPickerItemIcon');
      iconBtn.setTooltip(`${icon.name} (${icon.id})`);
      
      // 当前选中状态
      if (icon.id === this.options.currentIcon) {
        item.addClass('is-current');
      }
      
      // 收藏状态
      if (this.favoriteIcons.has(icon.id)) {
        item.addClass('is-favorite');
      }

      // 点击选择
      iconBtn.onClick(() => {
        this.addToRecent(icon.id);
        this.options.onSelect(icon.id);
        this.close();
      });

      // 收藏按钮
      const favoriteBtn = new ButtonComponent(item);
      favoriteBtn.setIcon(this.favoriteIcons.has(icon.id) ? 'heart' : 'heart');
      favoriteBtn.setClass('cMenuIconPickerItemFavorite');
      favoriteBtn.setTooltip(this.favoriteIcons.has(icon.id) ? '取消收藏' : '收藏');
      favoriteBtn.onClick((e) => {
        e.stopPropagation();
        this.toggleFavorite(icon.id);
      });
      
      // 更新收藏按钮显示
      if (this.favoriteIcons.has(icon.id)) {
        favoriteBtn.buttonEl.style.opacity = '1';
        favoriteBtn.buttonEl.style.background = 'var(--text-accent)';
        favoriteBtn.buttonEl.style.color = 'white';
      }

      // 标签
      const label = item.createDiv({ 
        text: icon.name, 
        cls: 'cMenuIconPickerItemLabel' 
      });
      
      // 来源标识
      if (icon.source === 'plugin') {
        const badge = item.createDiv({ 
          text: '插件', 
          cls: 'cMenuIconPickerItemBadge' 
        });
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

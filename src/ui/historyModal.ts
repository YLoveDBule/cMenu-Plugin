import { Modal, App, Setting, Notice, ButtonComponent, TextComponent, DropdownComponent } from "obsidian";
import { HistoryManager, HistoryEntry, HistoryFilter } from "../features/historyManager";

export class HistoryModal extends Modal {
  private historyManager: HistoryManager;
  private currentFilter: HistoryFilter = {};
  private currentEntries: HistoryEntry[] = [];
  private selectedEntries: Set<string> = new Set();
  private searchTimeout?: number;

  constructor(app: App) {
    super(app);
    this.historyManager = HistoryManager.getInstance();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { text: "AI 历史管理" });
    
    this.renderInterface();
    this.loadEntries();
  }

  onClose() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  private renderInterface() {
    const { contentEl } = this;
    
    // 搜索和筛选区域
    this.renderSearchAndFilter();
    
    // 统计信息
    this.renderStats();
    
    // 操作按钮区域
    this.renderActions();
    
    // 历史记录列表
    this.renderHistoryList();
  }

  private renderSearchAndFilter() {
    const { contentEl } = this;
    
    const filterSection = contentEl.createDiv({ cls: "history-filter-section" });
    
    // 搜索框
    const searchContainer = filterSection.createDiv({ cls: "history-search-container" });
    searchContainer.createEl("label", { text: "搜索：", cls: "history-filter-label" });
    
    const searchInput = searchContainer.createEl("input", {
      type: "text",
      placeholder: "搜索动作名称、输入或输出内容...",
      cls: "history-search-input"
    });
    
    searchInput.addEventListener("input", () => {
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      
      this.searchTimeout = window.setTimeout(() => {
        this.currentFilter.searchQuery = searchInput.value.trim() || undefined;
        this.loadEntries();
      }, 300);
    });

    // 筛选器行
    const filterRow = filterSection.createDiv({ cls: "history-filter-row" });
    
    // 动作筛选
    const actionContainer = filterRow.createDiv({ cls: "history-filter-item" });
    actionContainer.createEl("label", { text: "动作：", cls: "history-filter-label" });
    
    const actionSelect = actionContainer.createEl("select", { cls: "history-filter-select" });
    actionSelect.createEl("option", { value: "", text: "全部动作" });
    
    const actions = this.historyManager.getAllActions();
    actions.forEach(action => {
      actionSelect.createEl("option", { value: action, text: action });
    });
    
    actionSelect.addEventListener("change", () => {
      this.currentFilter.action = actionSelect.value || undefined;
      this.loadEntries();
    });

    // 评分筛选
    const ratingContainer = filterRow.createDiv({ cls: "history-filter-item" });
    ratingContainer.createEl("label", { text: "评分：", cls: "history-filter-label" });
    
    const ratingSelect = ratingContainer.createEl("select", { cls: "history-filter-select" });
    ratingSelect.createEl("option", { value: "", text: "全部评分" });
    for (let i = 5; i >= 1; i--) {
      ratingSelect.createEl("option", { value: i.toString(), text: `${i} 星` });
    }
    
    ratingSelect.addEventListener("change", () => {
      this.currentFilter.rating = ratingSelect.value ? parseInt(ratingSelect.value) as any : undefined;
      this.loadEntries();
    });

    // 收藏筛选
    const favoriteContainer = filterRow.createDiv({ cls: "history-filter-item" });
    const favoriteCheckbox = favoriteContainer.createEl("input", { 
      type: "checkbox",
      cls: "history-filter-checkbox"
    });
    favoriteContainer.createEl("label", { text: "仅显示收藏", cls: "history-filter-label" });
    
    favoriteCheckbox.addEventListener("change", () => {
      this.currentFilter.favorite = favoriteCheckbox.checked ? true : undefined;
      this.loadEntries();
    });

    // 日期范围筛选
    const dateContainer = filterRow.createDiv({ cls: "history-filter-item" });
    dateContainer.createEl("label", { text: "时间范围：", cls: "history-filter-label" });
    
    const dateSelect = dateContainer.createEl("select", { cls: "history-filter-select" });
    dateSelect.createEl("option", { value: "", text: "全部时间" });
    dateSelect.createEl("option", { value: "today", text: "今天" });
    dateSelect.createEl("option", { value: "week", text: "本周" });
    dateSelect.createEl("option", { value: "month", text: "本月" });
    
    dateSelect.addEventListener("change", () => {
      const value = dateSelect.value;
      if (!value) {
        this.currentFilter.dateRange = undefined;
      } else {
        const now = Date.now();
        let start = 0;
        
        switch (value) {
          case 'today':
            start = now - 24 * 60 * 60 * 1000;
            break;
          case 'week':
            start = now - 7 * 24 * 60 * 60 * 1000;
            break;
          case 'month':
            start = now - 30 * 24 * 60 * 60 * 1000;
            break;
        }
        
        this.currentFilter.dateRange = { start, end: now };
      }
      this.loadEntries();
    });

    // 清除筛选按钮
    const clearBtn = filterSection.createEl("button", { 
      text: "清除筛选",
      cls: "history-clear-filter-btn"
    });
    
    clearBtn.addEventListener("click", () => {
      this.currentFilter = {};
      searchInput.value = "";
      actionSelect.value = "";
      ratingSelect.value = "";
      favoriteCheckbox.checked = false;
      dateSelect.value = "";
      this.loadEntries();
    });
  }

  private renderStats() {
    const { contentEl } = this;
    
    const statsSection = contentEl.createDiv({ cls: "history-stats-section" });
    const stats = this.historyManager.getStats();
    
    const statsGrid = statsSection.createDiv({ cls: "history-stats-grid" });
    
    this.createStatItem(statsGrid, "总记录数", stats.totalEntries.toString());
    this.createStatItem(statsGrid, "收藏数", stats.favoriteEntries.toString());
    this.createStatItem(statsGrid, "平均评分", stats.averageRating.toFixed(1));
    this.createStatItem(statsGrid, "最常用", stats.mostUsedAction || "无");
  }

  private createStatItem(container: HTMLElement, label: string, value: string) {
    const item = container.createDiv({ cls: "history-stat-item" });
    item.createEl("span", { text: label, cls: "history-stat-label" });
    item.createEl("span", { text: value, cls: "history-stat-value" });
  }

  private renderActions() {
    const { contentEl } = this;
    
    const actionsSection = contentEl.createDiv({ cls: "history-actions-section" });
    
    // 批量操作
    const bulkActions = actionsSection.createDiv({ cls: "history-bulk-actions" });
    
    const selectAllBtn = bulkActions.createEl("button", { 
      text: "全选",
      cls: "history-action-btn"
    });
    selectAllBtn.addEventListener("click", () => {
      this.currentEntries.forEach(entry => this.selectedEntries.add(entry.id));
      this.updateSelectionUI();
    });
    
    const selectNoneBtn = bulkActions.createEl("button", { 
      text: "取消全选",
      cls: "history-action-btn"
    });
    selectNoneBtn.addEventListener("click", () => {
      this.selectedEntries.clear();
      this.updateSelectionUI();
    });
    
    const deleteSelectedBtn = bulkActions.createEl("button", { 
      text: "删除选中",
      cls: "history-action-btn mod-warning"
    });
    deleteSelectedBtn.addEventListener("click", () => {
      this.deleteSelectedEntries();
    });

    // 导入导出
    const importExportActions = actionsSection.createDiv({ cls: "history-import-export" });
    
    const exportBtn = importExportActions.createEl("button", { 
      text: "导出历史",
      cls: "history-action-btn mod-cta"
    });
    exportBtn.addEventListener("click", () => {
      this.exportHistory();
    });
    
    const importBtn = importExportActions.createEl("button", { 
      text: "导入历史",
      cls: "history-action-btn"
    });
    importBtn.addEventListener("click", () => {
      this.importHistory();
    });
    
    const clearAllBtn = importExportActions.createEl("button", { 
      text: "清空全部",
      cls: "history-action-btn mod-warning"
    });
    clearAllBtn.addEventListener("click", () => {
      this.clearAllHistory();
    });
  }

  private renderHistoryList() {
    const { contentEl } = this;
    
    const listSection = contentEl.createDiv({ cls: "history-list-section" });
    listSection.createEl("h3", { text: "历史记录" });
    
    const listContainer = listSection.createDiv({ cls: "history-list-container" });
    
    if (this.currentEntries.length === 0) {
      listContainer.createEl("p", { 
        text: "没有找到匹配的历史记录",
        cls: "history-empty-message"
      });
      return;
    }

    this.currentEntries.forEach(entry => {
      this.renderHistoryItem(listContainer, entry);
    });
  }

  private renderHistoryItem(container: HTMLElement, entry: HistoryEntry) {
    const item = container.createDiv({ cls: "history-item" });
    
    // 选择框
    const checkbox = item.createEl("input", { 
      type: "checkbox",
      cls: "history-item-checkbox"
    });
    checkbox.checked = this.selectedEntries.has(entry.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        this.selectedEntries.add(entry.id);
      } else {
        this.selectedEntries.delete(entry.id);
      }
    });

    // 主要内容
    const content = item.createDiv({ cls: "history-item-content" });
    
    // 头部信息
    const header = content.createDiv({ cls: "history-item-header" });
    
    const title = header.createDiv({ cls: "history-item-title" });
    title.createEl("span", { text: entry.action, cls: "history-item-action" });
    title.createEl("span", { 
      text: new Date(entry.timestamp).toLocaleString(),
      cls: "history-item-time"
    });
    
    // 评分和收藏
    const meta = header.createDiv({ cls: "history-item-meta" });
    
    // 收藏按钮
    const favoriteBtn = meta.createEl("button", { 
      cls: `history-favorite-btn ${entry.favorite ? 'active' : ''}`,
      attr: { title: entry.favorite ? "取消收藏" : "添加收藏" }
    });
    favoriteBtn.innerHTML = entry.favorite ? "★" : "☆";
    favoriteBtn.addEventListener("click", () => {
      const newState = this.historyManager.toggleFavorite(entry.id);
      favoriteBtn.innerHTML = newState ? "★" : "☆";
      favoriteBtn.className = `history-favorite-btn ${newState ? 'active' : ''}`;
      favoriteBtn.title = newState ? "取消收藏" : "添加收藏";
    });
    
    // 评分
    const ratingContainer = meta.createDiv({ cls: "history-rating-container" });
    for (let i = 1; i <= 5; i++) {
      const star = ratingContainer.createEl("button", { 
        cls: `history-rating-star ${(entry.rating || 0) >= i ? 'active' : ''}`,
        text: "★"
      });
      star.addEventListener("click", () => {
        this.historyManager.setRating(entry.id, i as any);
        entry.rating = i as any;
        this.updateRatingDisplay(ratingContainer, i);
      });
    }

    // 输入输出内容
    const ioContainer = content.createDiv({ cls: "history-item-io" });
    
    const inputSection = ioContainer.createDiv({ cls: "history-io-section" });
    inputSection.createEl("h4", { text: "输入" });
    const inputContent = inputSection.createEl("div", { cls: "history-io-content" });
    inputContent.textContent = this.truncateText(entry.input, 200);
    
    const outputSection = ioContainer.createDiv({ cls: "history-io-section" });
    outputSection.createEl("h4", { text: "输出" });
    const outputContent = outputSection.createEl("div", { cls: "history-io-content" });
    outputContent.textContent = this.truncateText(entry.output, 200);

    // 标签
    if (entry.tags && entry.tags.length > 0) {
      const tagsContainer = content.createDiv({ cls: "history-item-tags" });
      entry.tags.forEach(tag => {
        const tagEl = tagsContainer.createEl("span", { 
          text: tag,
          cls: "history-tag"
        });
        
        // 点击标签删除
        tagEl.addEventListener("click", () => {
          this.historyManager.removeTag(entry.id, tag);
          tagEl.remove();
        });
      });
      
      // 添加标签按钮
      const addTagBtn = tagsContainer.createEl("button", { 
        text: "+ 标签",
        cls: "history-add-tag-btn"
      });
      addTagBtn.addEventListener("click", () => {
        this.showAddTagDialog(entry.id, tagsContainer);
      });
    }

    // 操作按钮
    const actions = content.createDiv({ cls: "history-item-actions" });
    
    const viewBtn = actions.createEl("button", { 
      text: "查看详情",
      cls: "history-action-btn"
    });
    viewBtn.addEventListener("click", () => {
      this.showEntryDetails(entry);
    });
    
    const reuseBtn = actions.createEl("button", { 
      text: "重新使用",
      cls: "history-action-btn mod-cta"
    });
    reuseBtn.addEventListener("click", () => {
      this.reuseEntry(entry);
    });
    
    const deleteBtn = actions.createEl("button", { 
      text: "删除",
      cls: "history-action-btn mod-warning"
    });
    deleteBtn.addEventListener("click", () => {
      this.deleteEntry(entry.id);
      item.remove();
    });
  }

  private updateRatingDisplay(container: HTMLElement, rating: number) {
    const stars = container.querySelectorAll('.history-rating-star');
    stars.forEach((star, index) => {
      if (index < rating) {
        star.addClass('active');
      } else {
        star.removeClass('active');
      }
    });
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  private loadEntries() {
    this.currentEntries = this.historyManager.searchEntries(this.currentFilter);
    this.renderHistoryList();
  }

  private updateSelectionUI() {
    const checkboxes = this.contentEl.querySelectorAll('.history-item-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox, index) => {
      const entry = this.currentEntries[index];
      if (entry) {
        checkbox.checked = this.selectedEntries.has(entry.id);
      }
    });
  }

  private deleteSelectedEntries() {
    if (this.selectedEntries.size === 0) {
      new Notice("请先选择要删除的记录");
      return;
    }
    
    if (confirm(`确定要删除选中的 ${this.selectedEntries.size} 条记录吗？`)) {
      const deletedCount = this.historyManager.deleteEntries(Array.from(this.selectedEntries));
      this.selectedEntries.clear();
      this.loadEntries();
      new Notice(`已删除 ${deletedCount} 条记录`);
    }
  }

  private exportHistory() {
    const data = this.historyManager.exportHistory(this.currentFilter);
    
    // 复制到剪贴板
    navigator.clipboard.writeText(data).then(() => {
      new Notice('历史记录已复制到剪贴板');
    }).catch(() => {
      // 创建下载链接
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai_history_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      new Notice('历史记录已下载');
    });
  }

  private importHistory() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result as string;
          const importedCount = this.historyManager.importHistory(data, 'merge');
          this.loadEntries();
          new Notice(`成功导入 ${importedCount} 条记录`);
        } catch (error) {
          new Notice(`导入失败：${error.message}`);
        }
      };
      reader.readAsText(file);
    });
    
    input.click();
  }

  private clearAllHistory() {
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复！')) {
      const count = this.historyManager.clearAll();
      this.loadEntries();
      new Notice(`已清空 ${count} 条历史记录`);
    }
  }

  private showAddTagDialog(entryId: string, container: HTMLElement) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '输入标签名称';
    input.className = 'history-tag-input';
    
    const addTag = () => {
      const tag = input.value.trim();
      if (tag) {
        this.historyManager.addTag(entryId, tag);
        
        const tagEl = container.createEl("span", { 
          text: tag,
          cls: "history-tag"
        });
        
        tagEl.addEventListener("click", () => {
          this.historyManager.removeTag(entryId, tag);
          tagEl.remove();
        });
        
        input.remove();
      }
    };
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addTag();
      } else if (e.key === 'Escape') {
        input.remove();
      }
    });
    
    input.addEventListener('blur', addTag);
    
    container.appendChild(input);
    input.focus();
  }

  private showEntryDetails(entry: HistoryEntry) {
    new HistoryDetailModal(this.app, entry).open();
  }

  private reuseEntry(entry: HistoryEntry) {
    // 复制输出内容到剪贴板
    navigator.clipboard.writeText(entry.output).then(() => {
      new Notice('AI 输出已复制到剪贴板，可以粘贴使用');
      this.close();
    }).catch(() => {
      new Notice('复制失败，请手动复制');
    });
  }

  private deleteEntry(entryId: string) {
    if (confirm('确定要删除这条记录吗？')) {
      this.historyManager.deleteEntry(entryId);
      this.loadEntries();
      new Notice('记录已删除');
    }
  }
}

class HistoryDetailModal extends Modal {
  private entry: HistoryEntry;

  constructor(app: App, entry: HistoryEntry) {
    super(app);
    this.entry = entry;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { text: "历史记录详情" });
    
    const details = contentEl.createDiv({ cls: "history-detail-container" });
    
    // 基本信息
    const infoSection = details.createDiv({ cls: "history-detail-section" });
    infoSection.createEl("h3", { text: "基本信息" });
    
    const infoGrid = infoSection.createDiv({ cls: "history-detail-grid" });
    this.addDetailItem(infoGrid, "动作", this.entry.action);
    this.addDetailItem(infoGrid, "时间", new Date(this.entry.timestamp).toLocaleString());
    this.addDetailItem(infoGrid, "模型", this.entry.model);
    this.addDetailItem(infoGrid, "来源", this.getSourceText(this.entry.metadata.source));
    this.addDetailItem(infoGrid, "评分", this.entry.rating ? `${this.entry.rating} 星` : "未评分");
    this.addDetailItem(infoGrid, "收藏", this.entry.favorite ? "是" : "否");
    
    // 模板
    const templateSection = details.createDiv({ cls: "history-detail-section" });
    templateSection.createEl("h3", { text: "AI 模板" });
    const templateContent = templateSection.createEl("pre", { cls: "history-detail-content" });
    templateContent.textContent = this.entry.template;
    
    // 输入内容
    const inputSection = details.createDiv({ cls: "history-detail-section" });
    inputSection.createEl("h3", { text: "输入内容" });
    const inputContent = inputSection.createEl("pre", { cls: "history-detail-content" });
    inputContent.textContent = this.entry.input;
    
    // 输出内容
    const outputSection = details.createDiv({ cls: "history-detail-section" });
    outputSection.createEl("h3", { text: "输出内容" });
    const outputContent = outputSection.createEl("pre", { cls: "history-detail-content" });
    outputContent.textContent = this.entry.output;
    
    // 标签
    if (this.entry.tags && this.entry.tags.length > 0) {
      const tagsSection = details.createDiv({ cls: "history-detail-section" });
      tagsSection.createEl("h3", { text: "标签" });
      const tagsContainer = tagsSection.createDiv({ cls: "history-detail-tags" });
      this.entry.tags.forEach(tag => {
        tagsContainer.createEl("span", { text: tag, cls: "history-tag" });
      });
    }
    
    // 操作按钮
    const actions = details.createDiv({ cls: "history-detail-actions" });
    
    const copyInputBtn = actions.createEl("button", { 
      text: "复制输入",
      cls: "history-action-btn"
    });
    copyInputBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(this.entry.input);
      new Notice("输入内容已复制");
    });
    
    const copyOutputBtn = actions.createEl("button", { 
      text: "复制输出",
      cls: "history-action-btn mod-cta"
    });
    copyOutputBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(this.entry.output);
      new Notice("输出内容已复制");
    });
    
    const closeBtn = actions.createEl("button", { 
      text: "关闭",
      cls: "history-action-btn"
    });
    closeBtn.addEventListener("click", () => {
      this.close();
    });
  }

  private addDetailItem(container: HTMLElement, label: string, value: string) {
    const item = container.createDiv({ cls: "history-detail-item" });
    item.createEl("span", { text: label + ":", cls: "history-detail-label" });
    item.createEl("span", { text: value, cls: "history-detail-value" });
  }

  private getSourceText(source: string): string {
    switch (source) {
      case 'menu': return '右键菜单';
      case 'shortcut': return '快捷键';
      case 'batch': return '批量处理';
      default: return source;
    }
  }
}

// 便捷函数
export const showHistoryModal = (app: App): void => {
  new HistoryModal(app).open();
};

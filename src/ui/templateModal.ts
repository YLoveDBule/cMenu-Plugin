import { Modal, App, Setting, Notice, ButtonComponent, DropdownComponent, TextComponent } from "obsidian";
import { TemplateManager, ActionTemplate, TemplateCategory, TemplateStats, TemplateVariable } from "../features/templateManager";
import { validateIcon } from "../icons/catalog";

export class TemplateManagerModal extends Modal {
  private templateManager: TemplateManager;
  private currentCategory: string = 'all';
  private currentTemplates: ActionTemplate[] = [];
  private selectedTemplates: Set<string> = new Set();
  private searchTimeout?: number;

  constructor(app: App) {
    super(app);
    this.templateManager = TemplateManager.getInstance();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { text: "动作模板管理" });
    
    this.renderInterface();
    this.loadTemplates();
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
    
    // 模板列表
    this.renderTemplateList();
  }

  private renderSearchAndFilter() {
    const { contentEl } = this;
    
    const filterSection = contentEl.createDiv({ cls: "template-filter-section" });
    
    // 搜索框
    const searchContainer = filterSection.createDiv({ cls: "template-search-container" });
    searchContainer.createEl("label", { text: "搜索：", cls: "template-filter-label" });
    
    const searchInput = searchContainer.createEl("input", {
      type: "text",
      placeholder: "搜索模板名称、描述或内容...",
      cls: "template-search-input"
    });
    
    searchInput.addEventListener("input", () => {
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      
      this.searchTimeout = window.setTimeout(() => {
        const query = searchInput.value.trim();
        if (query) {
          this.currentTemplates = this.templateManager.searchTemplates(query);
        } else {
          this.loadTemplates();
        }
        this.renderTemplateList();
      }, 300);
    });

    // 分类筛选
    const filterRow = filterSection.createDiv({ cls: "template-filter-row" });
    
    const categoryContainer = filterRow.createDiv({ cls: "template-filter-item" });
    categoryContainer.createEl("label", { text: "分类：", cls: "template-filter-label" });
    
    const categorySelect = categoryContainer.createEl("select", { cls: "template-filter-select" });
    categorySelect.createEl("option", { value: "all", text: "全部分类" });
    categorySelect.createEl("option", { value: "favorite", text: "收藏模板" });
    
    const categories = this.templateManager.getAllCategories();
    categories.forEach(category => {
      categorySelect.createEl("option", { value: category.id, text: category.name });
    });
    
    categorySelect.addEventListener("change", () => {
      this.currentCategory = categorySelect.value;
      this.loadTemplates();
    });

    // 排序选项
    const sortContainer = filterRow.createDiv({ cls: "template-filter-item" });
    sortContainer.createEl("label", { text: "排序：", cls: "template-filter-label" });
    
    const sortSelect = sortContainer.createEl("select", { cls: "template-filter-select" });
    sortSelect.createEl("option", { value: "name", text: "按名称" });
    sortSelect.createEl("option", { value: "created", text: "按创建时间" });
    sortSelect.createEl("option", { value: "updated", text: "按更新时间" });
    sortSelect.createEl("option", { value: "usage", text: "按使用次数" });
    sortSelect.createEl("option", { value: "rating", text: "按评分" });
    
    sortSelect.addEventListener("change", () => {
      this.sortTemplates(sortSelect.value);
      this.renderTemplateList();
    });

    // 清除筛选按钮
    const clearBtn = filterSection.createEl("button", { 
      text: "清除筛选",
      cls: "template-clear-filter-btn"
    });
    
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      categorySelect.value = "all";
      sortSelect.value = "name";
      this.currentCategory = "all";
      this.loadTemplates();
    });
  }

  private renderStats() {
    const { contentEl } = this;
    
    const statsSection = contentEl.createDiv({ cls: "template-stats-section" });
    const stats = this.templateManager.getStats();
    
    const statsGrid = statsSection.createDiv({ cls: "template-stats-grid" });
    
    this.createStatItem(statsGrid, "总模板数", stats.totalTemplates.toString());
    this.createStatItem(statsGrid, "收藏数", stats.favoriteTemplates.toString());
    this.createStatItem(statsGrid, "平均评分", stats.averageRating.toFixed(1));
    
    const mostUsedTemplate = stats.mostUsedTemplate 
      ? this.templateManager.getTemplate(stats.mostUsedTemplate)?.name || "无"
      : "无";
    this.createStatItem(statsGrid, "最常用", mostUsedTemplate);
  }

  private createStatItem(container: HTMLElement, label: string, value: string) {
    const item = container.createDiv({ cls: "template-stat-item" });
    item.createEl("span", { text: label, cls: "template-stat-label" });
    item.createEl("span", { text: value, cls: "template-stat-value" });
  }

  private renderActions() {
    const { contentEl } = this;
    
    const actionsSection = contentEl.createDiv({ cls: "template-actions-section" });
    
    // 主要操作
    const mainActions = actionsSection.createDiv({ cls: "template-main-actions" });
    
    const createBtn = mainActions.createEl("button", { 
      text: "新建模板",
      cls: "template-action-btn mod-cta"
    });
    createBtn.addEventListener("click", () => {
      this.showTemplateEditor();
    });
    
    const importBtn = mainActions.createEl("button", { 
      text: "导入模板",
      cls: "template-action-btn"
    });
    importBtn.addEventListener("click", () => {
      this.importTemplates();
    });
    
    const exportBtn = mainActions.createEl("button", { 
      text: "导出模板",
      cls: "template-action-btn"
    });
    exportBtn.addEventListener("click", () => {
      this.exportTemplates();
    });

    // 批量操作
    const bulkActions = actionsSection.createDiv({ cls: "template-bulk-actions" });
    
    const selectAllBtn = bulkActions.createEl("button", { 
      text: "全选",
      cls: "template-action-btn"
    });
    selectAllBtn.addEventListener("click", () => {
      this.currentTemplates.forEach(template => this.selectedTemplates.add(template.id));
      this.updateSelectionUI();
    });
    
    const selectNoneBtn = bulkActions.createEl("button", { 
      text: "取消全选",
      cls: "template-action-btn"
    });
    selectNoneBtn.addEventListener("click", () => {
      this.selectedTemplates.clear();
      this.updateSelectionUI();
    });
    
    const deleteSelectedBtn = bulkActions.createEl("button", { 
      text: "删除选中",
      cls: "template-action-btn mod-warning"
    });
    deleteSelectedBtn.addEventListener("click", () => {
      this.deleteSelectedTemplates();
    });
  }

  private renderTemplateList() {
    const { contentEl } = this;
    
    // 移除现有列表
    const existingList = contentEl.querySelector('.template-list-section');
    if (existingList) {
      existingList.remove();
    }
    
    const listSection = contentEl.createDiv({ cls: "template-list-section" });
    listSection.createEl("h3", { text: "模板列表" });
    
    const listContainer = listSection.createDiv({ cls: "template-list-container" });
    
    if (this.currentTemplates.length === 0) {
      listContainer.createEl("p", { 
        text: "没有找到匹配的模板",
        cls: "template-empty-message"
      });
      return;
    }

    this.currentTemplates.forEach(template => {
      this.renderTemplateItem(listContainer, template);
    });
  }

  private renderTemplateItem(container: HTMLElement, template: ActionTemplate) {
    const item = container.createDiv({ cls: "template-item" });
    
    // 选择框
    const checkbox = item.createEl("input", { 
      type: "checkbox",
      cls: "template-item-checkbox"
    });
    checkbox.checked = this.selectedTemplates.has(template.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        this.selectedTemplates.add(template.id);
      } else {
        this.selectedTemplates.delete(template.id);
      }
    });

    // 主要内容
    const content = item.createDiv({ cls: "template-item-content" });
    
    // 头部信息
    const header = content.createDiv({ cls: "template-item-header" });
    
    const title = header.createDiv({ cls: "template-item-title" });
    title.createEl("span", { text: template.name, cls: "template-item-name" });
    
    const category = this.templateManager.getCategory(template.category);
    if (category) {
      const categoryTag = title.createEl("span", { 
        text: category.name,
        cls: "template-category-tag"
      });
      categoryTag.style.backgroundColor = category.color;
    }
    
    title.createEl("span", { 
      text: new Date(template.updatedAt).toLocaleString(),
      cls: "template-item-time"
    });
    
    // 元数据
    const meta = header.createDiv({ cls: "template-item-meta" });
    
    // 收藏按钮
    const favoriteBtn = meta.createEl("button", { 
      cls: `template-favorite-btn ${template.favorite ? 'active' : ''}`,
      attr: { title: template.favorite ? "取消收藏" : "添加收藏" }
    });
    favoriteBtn.innerHTML = template.favorite ? "★" : "☆";
    favoriteBtn.addEventListener("click", () => {
      const newState = this.templateManager.toggleFavorite(template.id);
      favoriteBtn.innerHTML = newState ? "★" : "☆";
      favoriteBtn.className = `template-favorite-btn ${newState ? 'active' : ''}`;
      favoriteBtn.title = newState ? "取消收藏" : "添加收藏";
    });
    
    // 评分
    const ratingContainer = meta.createDiv({ cls: "template-rating-container" });
    for (let i = 1; i <= 5; i++) {
      const star = ratingContainer.createEl("button", { 
        cls: `template-rating-star ${(template.rating || 0) >= i ? 'active' : ''}`,
        text: "★"
      });
      star.addEventListener("click", () => {
        this.templateManager.setRating(template.id, i);
        template.rating = i;
        this.updateRatingDisplay(ratingContainer, i);
      });
    }

    // 描述和统计
    const description = content.createDiv({ cls: "template-item-description" });
    description.textContent = template.description;
    
    const stats = content.createDiv({ cls: "template-item-stats" });
    stats.createEl("span", { text: `使用次数: ${template.usageCount}`, cls: "template-stat" });
    stats.createEl("span", { text: `变量: ${template.variables.length}`, cls: "template-stat" });
    stats.createEl("span", { text: `标签: ${template.tags.length}`, cls: "template-stat" });

    // 标签
    if (template.tags && template.tags.length > 0) {
      const tagsContainer = content.createDiv({ cls: "template-item-tags" });
      template.tags.forEach(tag => {
        tagsContainer.createEl("span", { 
          text: tag,
          cls: "template-tag"
        });
      });
    }

    // 模板预览
    const preview = content.createDiv({ cls: "template-item-preview" });
    preview.createEl("h4", { text: "模板内容" });
    const previewContent = preview.createEl("pre", { cls: "template-preview-content" });
    previewContent.textContent = this.truncateText(template.template, 200);

    // 操作按钮
    const actions = content.createDiv({ cls: "template-item-actions" });
    
    const editBtn = actions.createEl("button", { 
      text: "编辑",
      cls: "template-action-btn"
    });
    editBtn.addEventListener("click", () => {
      this.showTemplateEditor(template);
    });
    
    const duplicateBtn = actions.createEl("button", { 
      text: "复制",
      cls: "template-action-btn"
    });
    duplicateBtn.addEventListener("click", () => {
      const newId = this.templateManager.duplicateTemplate(template.id);
      if (newId) {
        new Notice('模板已复制');
        this.loadTemplates();
      }
    });
    
    const useBtn = actions.createEl("button", { 
      text: "使用",
      cls: "template-action-btn mod-cta"
    });
    useBtn.addEventListener("click", () => {
      this.useTemplate(template);
    });
    
    const deleteBtn = actions.createEl("button", { 
      text: "删除",
      cls: "template-action-btn mod-warning"
    });
    deleteBtn.addEventListener("click", () => {
      this.deleteTemplate(template.id);
    });
  }

  private updateRatingDisplay(container: HTMLElement, rating: number) {
    const stars = container.querySelectorAll('.template-rating-star');
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

  private loadTemplates() {
    if (this.currentCategory === 'all') {
      this.currentTemplates = this.templateManager.getAllTemplates();
    } else if (this.currentCategory === 'favorite') {
      this.currentTemplates = this.templateManager.getFavoriteTemplates();
    } else {
      this.currentTemplates = this.templateManager.getTemplatesByCategory(this.currentCategory);
    }
    
    this.sortTemplates('name');
    this.renderTemplateList();
  }

  private sortTemplates(sortBy: string) {
    this.currentTemplates.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return b.createdAt - a.createdAt;
        case 'updated':
          return b.updatedAt - a.updatedAt;
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        default:
          return 0;
      }
    });
  }

  private updateSelectionUI() {
    const checkboxes = this.contentEl.querySelectorAll('.template-item-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox, index) => {
      const template = this.currentTemplates[index];
      if (template) {
        checkbox.checked = this.selectedTemplates.has(template.id);
      }
    });
  }

  private deleteSelectedTemplates() {
    if (this.selectedTemplates.size === 0) {
      new Notice("请先选择要删除的模板");
      return;
    }
    
    if (confirm(`确定要删除选中的 ${this.selectedTemplates.size} 个模板吗？`)) {
      const deletedCount = this.templateManager.deleteTemplates(Array.from(this.selectedTemplates));
      this.selectedTemplates.clear();
      this.loadTemplates();
      new Notice(`已删除 ${deletedCount} 个模板`);
    }
  }

  private exportTemplates() {
    const selectedIds = Array.from(this.selectedTemplates);
    const data = this.templateManager.exportTemplates(selectedIds.length > 0 ? selectedIds : undefined);
    
    // 复制到剪贴板
    navigator.clipboard.writeText(data).then(() => {
      new Notice('模板数据已复制到剪贴板');
    }).catch(() => {
      // 创建下载链接
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `templates_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      new Notice('模板数据已下载');
    });
  }

  private importTemplates() {
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
          const importedCount = this.templateManager.importTemplates(data, 'merge');
          this.loadTemplates();
          new Notice(`成功导入 ${importedCount} 个模板`);
        } catch (error) {
          new Notice(`导入失败：${error.message}`);
        }
      };
      reader.readAsText(file);
    });
    
    input.click();
  }

  private showTemplateEditor(template?: ActionTemplate) {
    new TemplateEditorModal(this.app, template, (savedTemplate) => {
      this.loadTemplates();
      new Notice(template ? '模板已更新' : '模板已创建');
    }).open();
  }

  private useTemplate(template: ActionTemplate) {
    // 将模板转换为AI动作并复制到剪贴板
    const aiAction = this.templateManager.templateToAIAction(template);
    const actionData = JSON.stringify(aiAction, null, 2);
    
    navigator.clipboard.writeText(actionData).then(() => {
      this.templateManager.incrementUsage(template.id);
      new Notice('模板已复制为AI动作格式，可以粘贴到AI动作列表中');
      this.close();
    }).catch(() => {
      new Notice('复制失败，请手动复制');
    });
  }

  private deleteTemplate(templateId: string) {
    if (confirm('确定要删除这个模板吗？')) {
      this.templateManager.deleteTemplate(templateId);
      this.loadTemplates();
      new Notice('模板已删除');
    }
  }
}

class TemplateEditorModal extends Modal {
  private templateManager: TemplateManager;
  private template?: ActionTemplate;
  private onSave: (template: ActionTemplate) => void;

  constructor(app: App, template: ActionTemplate | undefined, onSave: (template: ActionTemplate) => void) {
    super(app);
    this.templateManager = TemplateManager.getInstance();
    this.template = template;
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { text: this.template ? "编辑模板" : "新建模板" });
    
    this.renderEditor();
  }

  private renderEditor() {
    const { contentEl } = this;
    
    const form = contentEl.createDiv({ cls: "template-editor-form" });
    
    // 基本信息
    const basicSection = form.createDiv({ cls: "template-editor-section" });
    basicSection.createEl("h3", { text: "基本信息" });
    
    let templateName = this.template?.name || '';
    let templateDescription = this.template?.description || '';
    let templateCategory = this.template?.category || 'custom';
    let templateIcon = this.template?.icon || 'bot-glyph';
    let templateApply = this.template?.apply || 'replace';
    
    new Setting(basicSection)
      .setName('模板名称')
      .setDesc('模板的显示名称')
      .addText(text => {
        text.setValue(templateName)
          .onChange(value => templateName = value);
      });
    
    new Setting(basicSection)
      .setName('模板描述')
      .setDesc('模板的详细描述')
      .addTextArea(text => {
        text.setValue(templateDescription)
          .onChange(value => templateDescription = value);
      });
    
    new Setting(basicSection)
      .setName('分类')
      .setDesc('模板所属分类')
      .addDropdown(dropdown => {
        const categories = this.templateManager.getAllCategories();
        categories.forEach(category => {
          dropdown.addOption(category.id, category.name);
        });
        dropdown.setValue(templateCategory)
          .onChange(value => templateCategory = value);
      });
    
    new Setting(basicSection)
      .setName('图标')
      .setDesc('模板的图标ID')
      .addText(text => {
        text.setValue(templateIcon)
          .onChange(value => templateIcon = value);
      });
    
    new Setting(basicSection)
      .setName('应用方式')
      .setDesc('模板结果的应用方式')
      .addDropdown(dropdown => {
        dropdown.addOption('replace', '替换选中内容');
        dropdown.addOption('insert', '在后插入');
        dropdown.addOption('quote', '插入引用');
        dropdown.addOption('code', '插入代码块');
        dropdown.setValue(templateApply)
          .onChange(value => templateApply = value as any);
      });
    
    // 模板内容
    const contentSection = form.createDiv({ cls: "template-editor-section" });
    contentSection.createEl("h3", { text: "模板内容" });
    
    let templateContent = this.template?.template || '';
    
    new Setting(contentSection)
      .setName('模板内容')
      .setDesc('使用 {变量名} 定义变量，如 {selection} 表示选中的文本')
      .addTextArea(text => {
        text.setValue(templateContent)
          .onChange(value => templateContent = value);
        text.inputEl.rows = 10;
        text.inputEl.style.width = '100%';
      });
    
    // 标签
    const tagsSection = form.createDiv({ cls: "template-editor-section" });
    tagsSection.createEl("h3", { text: "标签" });
    
    let templateTags = this.template?.tags || [];
    
    const tagsContainer = tagsSection.createDiv({ cls: "template-tags-container" });
    const renderTags = () => {
      tagsContainer.empty();
      templateTags.forEach((tag, index) => {
        const tagEl = tagsContainer.createEl("span", { 
          text: tag,
          cls: "template-tag editable"
        });
        
        const removeBtn = tagEl.createEl("button", { text: "×", cls: "template-tag-remove" });
        removeBtn.addEventListener("click", () => {
          templateTags.splice(index, 1);
          renderTags();
        });
      });
      
      const addBtn = tagsContainer.createEl("button", { 
        text: "+ 添加标签",
        cls: "template-add-tag-btn"
      });
      addBtn.addEventListener("click", () => {
        const tag = prompt("输入标签名称:");
        if (tag && tag.trim()) {
          templateTags.push(tag.trim());
          renderTags();
        }
      });
    };
    
    renderTags();
    
    // 操作按钮
    const actions = form.createDiv({ cls: "template-editor-actions" });
    
    const saveBtn = actions.createEl("button", { 
      text: "保存",
      cls: "template-action-btn mod-cta"
    });
    saveBtn.addEventListener("click", () => {
      this.saveTemplate({
        name: templateName,
        description: templateDescription,
        category: templateCategory,
        icon: templateIcon,
        template: templateContent,
        apply: templateApply,
        tags: templateTags
      });
    });
    
    const cancelBtn = actions.createEl("button", { 
      text: "取消",
      cls: "template-action-btn"
    });
    cancelBtn.addEventListener("click", () => {
      this.close();
    });
  }

  private saveTemplate(data: any) {
    if (!data.name.trim()) {
      new Notice('请输入模板名称');
      return;
    }
    
    if (!data.template.trim()) {
      new Notice('请输入模板内容');
      return;
    }
    
    try {
      let savedTemplate: ActionTemplate;
      
      if (this.template) {
        // 更新现有模板
        this.templateManager.updateTemplate(this.template.id, data);
        savedTemplate = this.templateManager.getTemplate(this.template.id)!;
      } else {
        // 创建新模板
        const templateManager = this.templateManager;
        const variables = this.extractVariables(data.template);
        
        const newTemplateData = {
          ...data,
          variables,
          author: 'User',
          version: '1.0'
        };
        
        const templateId = templateManager.createTemplate(newTemplateData);
        savedTemplate = templateManager.getTemplate(templateId)!;
      }
      
      this.onSave(savedTemplate);
      this.close();
    } catch (error) {
      new Notice(`保存失败：${error.message}`);
    }
  }

  private extractVariables(template: string): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    const variableRegex = /\{(\w+)\}/g;
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      const varName = match[1];
      if (!variables.find(v => v.name === varName)) {
        variables.push({
          name: varName,
          description: `变量 ${varName}`,
          type: varName === 'selection' ? 'multiline' : 'text',
          required: true,
          placeholder: `请输入 ${varName}`
        });
      }
    }

    return variables;
  }
}

// 便捷函数
export const showTemplateManager = (app: App): void => {
  new TemplateManagerModal(app).open();
};

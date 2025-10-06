import { Modal, App, Setting, Notice, ButtonComponent, Modifier } from "obsidian";
import { ShortcutManager, ShortcutAction } from "../features/shortcutManager";

export class ShortcutSettingsModal extends Modal {
  private shortcutManager: ShortcutManager;
  private shortcuts: ShortcutAction[] = [];

  constructor(app: App, shortcutManager: ShortcutManager) {
    super(app);
    this.shortcutManager = shortcutManager;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { text: "AI 快捷键设置" });
    
    this.refreshShortcuts();
    this.renderSettings();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private refreshShortcuts() {
    this.shortcuts = this.shortcutManager.getAllShortcuts();
  }

  private renderSettings() {
    const { contentEl } = this;
    
    // 清除旧内容（保留标题）
    const children = Array.from(contentEl.children);
    children.slice(1).forEach(child => child.remove());

    // 统计信息
    this.renderStats();
    
    // 快捷键列表
    this.renderShortcutList();
    
    // 操作按钮
    this.renderActionButtons();
  }

  private renderStats() {
    const { contentEl } = this;
    const stats = this.shortcutManager.getStats();
    
    const statsContainer = contentEl.createDiv({ cls: "shortcut-stats" });
    statsContainer.createEl("h3", { text: "使用统计" });
    
    const statsGrid = statsContainer.createDiv({ cls: "stats-grid" });
    
    this.createStatItem(statsGrid, "总快捷键", stats.totalShortcuts.toString());
    this.createStatItem(statsGrid, "已启用", stats.enabledShortcuts.toString());
    
    if (stats.mostUsed) {
      const mostUsedShortcut = this.shortcuts.find(s => s.id === stats.mostUsed);
      if (mostUsedShortcut) {
        this.createStatItem(statsGrid, "最常用", mostUsedShortcut.name);
      }
    }
  }

  private createStatItem(container: HTMLElement, label: string, value: string) {
    const item = container.createDiv({ cls: "stat-item" });
    item.createEl("span", { text: label, cls: "stat-label" });
    item.createEl("span", { text: value, cls: "stat-value" });
  }

  private renderShortcutList() {
    const { contentEl } = this;
    
    contentEl.createEl("h3", { text: "快捷键列表" });
    
    const shortcutContainer = contentEl.createDiv({ cls: "shortcut-list" });
    
    // 按使用频率排序
    const ranking = this.shortcutManager.getUsageRanking();
    
    ranking.forEach(({ shortcut, count }) => {
      this.renderShortcutItem(shortcutContainer, shortcut, count);
    });
  }

  private renderShortcutItem(container: HTMLElement, shortcut: ShortcutAction, usageCount: number) {
    const item = container.createDiv({ cls: "shortcut-item" });
    
    // 快捷键信息
    const info = item.createDiv({ cls: "shortcut-info" });
    
    const header = info.createDiv({ cls: "shortcut-header" });
    header.createEl("span", { text: shortcut.name, cls: "shortcut-name" });
    header.createEl("span", { 
      text: this.shortcutManager.formatHotkey(shortcut.hotkey), 
      cls: "shortcut-hotkey" 
    });
    
    info.createEl("p", { text: shortcut.description, cls: "shortcut-description" });
    
    if (usageCount > 0) {
      info.createEl("small", { 
        text: `使用次数: ${usageCount}`, 
        cls: "shortcut-usage" 
      });
    }
    
    // 控制按钮
    const controls = item.createDiv({ cls: "shortcut-controls" });
    
    // 启用/禁用切换
    const toggleBtn = new ButtonComponent(controls);
    toggleBtn.setButtonText(shortcut.enabled ? "禁用" : "启用");
    toggleBtn.setClass(shortcut.enabled ? "mod-warning" : "mod-cta");
    toggleBtn.onClick(() => {
      this.toggleShortcut(shortcut.id);
    });
    
    // 编辑按钮
    const editBtn = new ButtonComponent(controls);
    editBtn.setButtonText("编辑");
    editBtn.onClick(() => {
      this.editShortcut(shortcut);
    });
    
    // 删除按钮（仅自定义快捷键）
    if (shortcut.id.startsWith('custom_')) {
      const deleteBtn = new ButtonComponent(controls);
      deleteBtn.setButtonText("删除");
      deleteBtn.setClass("mod-warning");
      deleteBtn.onClick(() => {
        this.deleteShortcut(shortcut.id);
      });
    }
  }

  private renderActionButtons() {
    const { contentEl } = this;
    
    const buttonContainer = contentEl.createDiv({ cls: "shortcut-actions" });
    
    // 添加自定义快捷键
    const addBtn = new ButtonComponent(buttonContainer);
    addBtn.setButtonText("添加自定义快捷键");
    addBtn.setClass("mod-cta");
    addBtn.onClick(() => {
      this.addCustomShortcut();
    });
    
    // 重置统计
    const resetStatsBtn = new ButtonComponent(buttonContainer);
    resetStatsBtn.setButtonText("重置统计");
    resetStatsBtn.onClick(() => {
      this.shortcutManager.resetStats();
      this.renderSettings();
    });
    
    // 导出配置
    const exportBtn = new ButtonComponent(buttonContainer);
    exportBtn.setButtonText("导出配置");
    exportBtn.onClick(() => {
      this.exportConfig();
    });
    
    // 导入配置
    const importBtn = new ButtonComponent(buttonContainer);
    importBtn.setButtonText("导入配置");
    importBtn.onClick(() => {
      this.importConfig();
    });
  }

  private toggleShortcut(shortcutId: string) {
    const shortcut = this.shortcuts.find(s => s.id === shortcutId);
    if (!shortcut) return;
    
    this.shortcutManager.updateShortcut(shortcutId, { enabled: !shortcut.enabled });
    this.refreshShortcuts();
    this.renderSettings();
    
    new Notice(`${shortcut.name} 已${shortcut.enabled ? '禁用' : '启用'}`);
  }

  private editShortcut(shortcut: ShortcutAction) {
    new ShortcutEditModal(this.app, this.shortcutManager, shortcut, () => {
      this.refreshShortcuts();
      this.renderSettings();
    }).open();
  }

  private deleteShortcut(shortcutId: string) {
    const shortcut = this.shortcuts.find(s => s.id === shortcutId);
    if (!shortcut) return;
    
    if (confirm(`确定要删除快捷键 "${shortcut.name}" 吗？`)) {
      this.shortcutManager.removeShortcut(shortcutId);
      this.refreshShortcuts();
      this.renderSettings();
      new Notice(`已删除快捷键 "${shortcut.name}"`);
    }
  }

  private addCustomShortcut() {
    new ShortcutEditModal(this.app, this.shortcutManager, null, () => {
      this.refreshShortcuts();
      this.renderSettings();
    }).open();
  }

  private exportConfig() {
    const config = this.shortcutManager.exportConfig();
    navigator.clipboard.writeText(config).then(() => {
      new Notice("快捷键配置已复制到剪贴板");
    }).catch(() => {
      // 创建临时文本区域
      const textarea = document.createElement('textarea');
      textarea.value = config;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      new Notice("快捷键配置已复制到剪贴板");
    });
  }

  private importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (this.shortcutManager.importConfig(content)) {
          this.refreshShortcuts();
          this.renderSettings();
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }
}

class ShortcutEditModal extends Modal {
  private shortcutManager: ShortcutManager;
  private shortcut: ShortcutAction | null;
  private onSave: () => void;
  private isEditing: boolean;

  constructor(
    app: App, 
    shortcutManager: ShortcutManager, 
    shortcut: ShortcutAction | null,
    onSave: () => void
  ) {
    super(app);
    this.shortcutManager = shortcutManager;
    this.shortcut = shortcut;
    this.onSave = onSave;
    this.isEditing = shortcut !== null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { 
      text: this.isEditing ? "编辑快捷键" : "添加自定义快捷键" 
    });
    
    this.renderForm();
  }

  private renderForm() {
    const { contentEl } = this;
    
    const form = contentEl.createDiv({ cls: "shortcut-form" });
    
    // 表单数据
    const formData = {
      name: this.shortcut?.name || '',
      description: this.shortcut?.description || '',
      template: this.shortcut?.template || '',
      hotkey: this.shortcut?.hotkey || { modifiers: ['Ctrl', 'Shift'], key: '' },
      apply: this.shortcut?.apply || 'replace',
      enabled: this.shortcut?.enabled ?? true
    };

    // 名称
    new Setting(form)
      .setName("名称")
      .setDesc("快捷键的显示名称")
      .addText(text => {
        text.setValue(formData.name);
        text.onChange(value => formData.name = value);
      });

    // 描述
    new Setting(form)
      .setName("描述")
      .setDesc("快捷键的功能描述")
      .addTextArea(text => {
        text.setValue(formData.description);
        text.onChange(value => formData.description = value);
      });

    // 模板
    new Setting(form)
      .setName("AI 提示模板")
      .setDesc("使用 {selection} 表示选中的文本")
      .addTextArea(text => {
        text.setValue(formData.template);
        text.onChange(value => formData.template = value);
        (text.inputEl as HTMLTextAreaElement).rows = 4;
      });

    // 热键
    new Setting(form)
      .setName("快捷键")
      .setDesc("点击输入框后按下想要的快捷键组合")
      .addText(text => {
        text.setValue(this.shortcutManager.formatHotkey(formData.hotkey));
        text.inputEl.readOnly = true;
        
        text.inputEl.addEventListener('keydown', (e) => {
          e.preventDefault();
          
          const modifiers: Modifier[] = [];
          if (e.ctrlKey) modifiers.push('Ctrl');
          if (e.shiftKey) modifiers.push('Shift');
          if (e.altKey) modifiers.push('Alt');
          if (e.metaKey) modifiers.push('Meta');
          
          if (e.key && e.key.length === 1) {
            formData.hotkey = {
              modifiers,
              key: e.key.toUpperCase()
            };
            
            text.setValue(this.shortcutManager.formatHotkey(formData.hotkey));
            
            // 检查冲突
            const conflict = this.shortcutManager.checkHotkeyConflict(
              formData.hotkey, 
              this.shortcut?.id
            );
            
            if (conflict) {
              new Notice(`快捷键冲突：已被 "${conflict.name}" 使用`);
            }
          }
        });
      });

    // 应用方式
    new Setting(form)
      .setName("应用方式")
      .setDesc("AI 结果的应用方式")
      .addDropdown(dropdown => {
        dropdown.addOption('replace', '替换选中文本');
        dropdown.addOption('insert', '在后插入');
        dropdown.addOption('quote', '插入引用');
        dropdown.addOption('code', '插入代码块');
        dropdown.setValue(formData.apply);
        dropdown.onChange(value => formData.apply = value as any);
      });

    // 启用状态
    new Setting(form)
      .setName("启用")
      .setDesc("是否启用此快捷键")
      .addToggle(toggle => {
        toggle.setValue(formData.enabled);
        toggle.onChange(value => formData.enabled = value);
      });

    // 按钮
    const buttonContainer = form.createDiv({ cls: "shortcut-form-buttons" });
    
    const saveBtn = new ButtonComponent(buttonContainer);
    saveBtn.setButtonText(this.isEditing ? "保存" : "添加");
    saveBtn.setClass("mod-cta");
    saveBtn.onClick(() => {
      this.saveShortcut(formData);
    });
    
    const cancelBtn = new ButtonComponent(buttonContainer);
    cancelBtn.setButtonText("取消");
    cancelBtn.onClick(() => {
      this.close();
    });
  }

  private saveShortcut(formData: any) {
    // 验证表单
    if (!formData.name.trim()) {
      new Notice("请输入快捷键名称");
      return;
    }
    
    if (!formData.template.trim()) {
      new Notice("请输入 AI 提示模板");
      return;
    }
    
    if (!formData.hotkey.key) {
      new Notice("请设置快捷键");
      return;
    }

    // 检查冲突
    const conflict = this.shortcutManager.checkHotkeyConflict(
      formData.hotkey, 
      this.shortcut?.id
    );
    
    if (conflict) {
      new Notice(`快捷键冲突：已被 "${conflict.name}" 使用`);
      return;
    }

    try {
      if (this.isEditing && this.shortcut) {
        // 更新现有快捷键
        this.shortcutManager.updateShortcut(this.shortcut.id, {
          name: formData.name,
          description: formData.description,
          template: formData.template,
          hotkey: formData.hotkey,
          apply: formData.apply,
          enabled: formData.enabled
        });
        
        new Notice(`快捷键 "${formData.name}" 已更新`);
      } else {
        // 添加新快捷键
        this.shortcutManager.addCustomShortcut({
          name: formData.name,
          description: formData.description,
          template: formData.template,
          hotkey: formData.hotkey,
          apply: formData.apply,
          enabled: formData.enabled
        });
        
        new Notice(`快捷键 "${formData.name}" 已添加`);
      }
      
      this.onSave();
      this.close();
      
    } catch (error) {
      new Notice(`保存失败：${error.message}`);
    }
  }
}

// 便捷函数
export const showShortcutSettings = (app: App, shortcutManager: ShortcutManager): void => {
  new ShortcutSettingsModal(app, shortcutManager).open();
};

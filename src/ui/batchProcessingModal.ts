import { Modal, App, Setting, Notice, ButtonComponent, MarkdownView } from "obsidian";
import { BatchProcessor, BatchTask } from "../features/batchProcessor";
import type { cMenuSettings } from "../settings/settingsData";

export class BatchProcessingModal extends Modal {
  private batchProcessor: BatchProcessor;
  private settings: cMenuSettings;
  private refreshInterval?: number;

  constructor(app: App, settings: cMenuSettings) {
    super(app);
    this.batchProcessor = BatchProcessor.getInstance();
    this.settings = settings;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { text: "AI 批量处理" });
    
    this.renderInterface();
    
    // 每2秒刷新一次进度
    this.refreshInterval = window.setInterval(() => {
      this.updateProgress();
    }, 2000);
  }

  onClose() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
  }

  private renderInterface() {
    const { contentEl } = this;
    
    // 清除旧内容（保留标题）
    const children = Array.from(contentEl.children);
    children.slice(1).forEach(child => child.remove());

    // 创建新任务区域
    this.renderCreateTask();
    
    // 任务列表
    this.renderTaskList();
    
    // 统计信息
    this.renderStats();
  }

  private renderCreateTask() {
    const { contentEl } = this;
    
    const createSection = contentEl.createDiv({ cls: "batch-create-section" });
    createSection.createEl("h3", { text: "创建批量处理任务" });
    
    const form = createSection.createDiv({ cls: "batch-create-form" });
    
    // 表单数据
    const formData = {
      name: '',
      template: '',
      content: '',
      chunkSize: 1000,
      overlap: 100,
      concurrency: 2,
      delimiter: 'paragraph' as 'paragraph' | 'sentence' | 'line' | 'custom',
      customDelimiter: '',
      preserveFormatting: true,
      combineResults: true
    };

    // 任务名称
    new Setting(form)
      .setName("任务名称")
      .setDesc("为这个批量处理任务起个名字")
      .addText(text => {
        text.setPlaceholder("例如：优化整篇文章");
        text.onChange(value => formData.name = value);
      });

    // AI 模板
    new Setting(form)
      .setName("AI 处理模板")
      .setDesc("使用 {selection} 表示要处理的文本块")
      .addTextArea(text => {
        text.setPlaceholder("请优化以下文本：\n\n{selection}");
        text.onChange(value => formData.template = value);
        (text.inputEl as HTMLTextAreaElement).rows = 3;
      });

    // 内容来源
    const contentSetting = new Setting(form)
      .setName("处理内容")
      .setDesc("选择要处理的内容来源");

    const contentSelect = contentSetting.controlEl.createEl("select");
    contentSelect.createEl("option", { value: "selection", text: "当前选中文本" });
    contentSelect.createEl("option", { value: "document", text: "整个文档" });
    contentSelect.createEl("option", { value: "custom", text: "自定义输入" });

    const contentTextArea = form.createEl("textarea", {
      cls: "batch-content-input",
      attr: { 
        placeholder: "或者在这里粘贴要处理的内容...",
        style: "display: none; width: 100%; min-height: 100px; margin-top: 8px;"
      }
    });

    contentSelect.addEventListener("change", () => {
      const value = contentSelect.value;
      if (value === "custom") {
        contentTextArea.style.display = "block";
        contentTextArea.addEventListener("input", () => {
          formData.content = contentTextArea.value;
        });
      } else {
        contentTextArea.style.display = "none";
        
        if (value === "selection") {
          const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (activeView) {
            formData.content = activeView.editor.getSelection();
          }
        } else if (value === "document") {
          const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (activeView) {
            formData.content = activeView.editor.getValue();
          }
        }
      }
    });

    // 分割设置
    const advancedContainer = form.createDiv({ cls: "batch-advanced-settings" });
    const advancedToggle = form.createEl("details");
    advancedToggle.createEl("summary", { text: "高级设置" });
    const advancedContent = advancedToggle.createDiv();

    // 块大小
    new Setting(advancedContent)
      .setName("块大小")
      .setDesc("每个处理块的最大字符数")
      .addSlider(slider => {
        slider.setLimits(200, 3000, 100);
        slider.setValue(formData.chunkSize);
        slider.onChange(value => formData.chunkSize = value);
        slider.setDynamicTooltip();
      });

    // 重叠大小
    new Setting(advancedContent)
      .setName("重叠大小")
      .setDesc("相邻块之间的重叠字符数，有助于保持上下文连贯性")
      .addSlider(slider => {
        slider.setLimits(0, 500, 25);
        slider.setValue(formData.overlap);
        slider.onChange(value => formData.overlap = value);
        slider.setDynamicTooltip();
      });

    // 并发数
    new Setting(advancedContent)
      .setName("并发处理数")
      .setDesc("同时处理的块数量，过高可能触发API限制")
      .addSlider(slider => {
        slider.setLimits(1, 5, 1);
        slider.setValue(formData.concurrency);
        slider.onChange(value => formData.concurrency = value);
        slider.setDynamicTooltip();
      });

    // 分割方式
    new Setting(advancedContent)
      .setName("分割方式")
      .setDesc("如何将内容分割成块")
      .addDropdown(dropdown => {
        dropdown.addOption('paragraph', '按段落');
        dropdown.addOption('sentence', '按句子');
        dropdown.addOption('line', '按行');
        dropdown.addOption('custom', '自定义分隔符');
        dropdown.setValue(formData.delimiter);
        dropdown.onChange(value => {
          formData.delimiter = value as any;
          customDelimiterSetting.settingEl.style.display = 
            value === 'custom' ? 'block' : 'none';
        });
      });

    // 自定义分隔符
    const customDelimiterSetting = new Setting(advancedContent)
      .setName("自定义分隔符")
      .setDesc("用于分割内容的自定义字符串")
      .addText(text => {
        text.setPlaceholder("例如：---");
        text.onChange(value => formData.customDelimiter = value);
      });
    
    customDelimiterSetting.settingEl.style.display = 'none';

    // 其他选项
    new Setting(advancedContent)
      .setName("保持格式")
      .setDesc("尽量保持原文的格式结构")
      .addToggle(toggle => {
        toggle.setValue(formData.preserveFormatting);
        toggle.onChange(value => formData.preserveFormatting = value);
      });

    new Setting(advancedContent)
      .setName("合并结果")
      .setDesc("将所有处理结果合并为一个文档")
      .addToggle(toggle => {
        toggle.setValue(formData.combineResults);
        toggle.onChange(value => formData.combineResults = value);
      });

    // 创建按钮
    const createBtn = new ButtonComponent(form);
    createBtn.setButtonText("创建批量任务");
    createBtn.setClass("mod-cta");
    createBtn.onClick(() => {
      this.createTask(formData);
    });
  }

  private renderTaskList() {
    const { contentEl } = this;
    
    const listSection = contentEl.createDiv({ cls: "batch-task-list" });
    listSection.createEl("h3", { text: "任务列表" });
    
    const tasks = this.batchProcessor.getAllTasks();
    
    if (tasks.length === 0) {
      listSection.createEl("p", { 
        text: "暂无批量处理任务",
        cls: "batch-empty-message"
      });
      return;
    }

    const taskContainer = listSection.createDiv({ cls: "batch-tasks" });
    
    tasks.forEach(task => {
      this.renderTaskItem(taskContainer, task);
    });
  }

  private renderTaskItem(container: HTMLElement, task: BatchTask) {
    const item = container.createDiv({ cls: "batch-task-item" });
    
    // 任务头部
    const header = item.createDiv({ cls: "batch-task-header" });
    header.createEl("span", { text: task.name, cls: "batch-task-name" });
    
    const statusEl = header.createEl("span", { 
      text: this.getStatusText(task.status),
      cls: `batch-task-status status-${task.status}`
    });

    // 进度条
    if (task.status === 'processing') {
      const progressContainer = item.createDiv({ cls: "batch-progress-container" });
      const progressBar = progressContainer.createDiv({ cls: "batch-progress-bar" });
      const progressFill = progressBar.createDiv({ cls: "batch-progress-fill" });
      progressFill.style.width = `${task.progress}%`;
      
      progressContainer.createEl("span", { 
        text: `${task.progress}%`,
        cls: "batch-progress-text"
      });
    }

    // 任务信息
    const info = item.createDiv({ cls: "batch-task-info" });
    info.createEl("div", { text: `块数量: ${task.chunks.length}` });
    info.createEl("div", { text: `并发数: ${task.settings.concurrency}` });
    
    if (task.startTime) {
      const duration = (task.endTime || Date.now()) - task.startTime;
      info.createEl("div", { text: `耗时: ${this.formatDuration(duration)}` });
    }

    // 操作按钮
    const actions = item.createDiv({ cls: "batch-task-actions" });
    
    if (task.status === 'pending') {
      const startBtn = new ButtonComponent(actions);
      startBtn.setButtonText("开始处理");
      startBtn.setClass("mod-cta");
      startBtn.onClick(() => {
        this.startTask(task.id);
      });
    }
    
    if (task.status === 'processing') {
      const cancelBtn = new ButtonComponent(actions);
      cancelBtn.setButtonText("取消");
      cancelBtn.setClass("mod-warning");
      cancelBtn.onClick(() => {
        this.cancelTask(task.id);
      });
    }
    
    if (task.status === 'completed') {
      const viewBtn = new ButtonComponent(actions);
      viewBtn.setButtonText("查看结果");
      viewBtn.onClick(() => {
        this.viewTaskResult(task.id);
      });
      
      const exportBtn = new ButtonComponent(actions);
      exportBtn.setButtonText("导出");
      exportBtn.onClick(() => {
        this.exportTask(task.id);
      });
    }
    
    const deleteBtn = new ButtonComponent(actions);
    deleteBtn.setButtonText("删除");
    deleteBtn.setClass("mod-warning");
    deleteBtn.onClick(() => {
      this.deleteTask(task.id);
    });
  }

  private renderStats() {
    const { contentEl } = this;
    
    const stats = this.batchProcessor.getStats();
    
    const statsSection = contentEl.createDiv({ cls: "batch-stats" });
    statsSection.createEl("h3", { text: "统计信息" });
    
    const statsGrid = statsSection.createDiv({ cls: "batch-stats-grid" });
    
    this.createStatItem(statsGrid, "总任务数", stats.totalTasks.toString());
    this.createStatItem(statsGrid, "已完成", stats.completedTasks.toString());
    this.createStatItem(statsGrid, "成功率", `${(stats.successRate * 100).toFixed(1)}%`);
    this.createStatItem(statsGrid, "平均处理时间", this.formatDuration(stats.averageProcessTime));
    
    // 清理按钮
    if (stats.completedTasks > 0 || stats.failedTasks > 0) {
      const cleanupBtn = new ButtonComponent(statsSection);
      cleanupBtn.setButtonText("清理已完成任务");
      cleanupBtn.onClick(() => {
        this.batchProcessor.cleanupCompletedTasks();
        this.renderInterface();
      });
    }
  }

  private createStatItem(container: HTMLElement, label: string, value: string) {
    const item = container.createDiv({ cls: "batch-stat-item" });
    item.createEl("span", { text: label, cls: "batch-stat-label" });
    item.createEl("span", { text: value, cls: "batch-stat-value" });
  }

  private async createTask(formData: any) {
    // 验证表单
    if (!formData.name.trim()) {
      new Notice("请输入任务名称");
      return;
    }
    
    if (!formData.template.trim()) {
      new Notice("请输入AI处理模板");
      return;
    }
    
    if (!formData.content.trim()) {
      new Notice("请选择或输入要处理的内容");
      return;
    }

    try {
      const taskId = this.batchProcessor.createTask(
        formData.name,
        formData.template,
        formData.content,
        {
          chunkSize: formData.chunkSize,
          overlap: formData.overlap,
          concurrency: formData.concurrency,
          delimiter: formData.delimiter,
          customDelimiter: formData.customDelimiter,
          preserveFormatting: formData.preserveFormatting,
          combineResults: formData.combineResults
        }
      );
      
      new Notice(`批量任务 "${formData.name}" 已创建`);
      this.renderInterface();
      
    } catch (error) {
      new Notice(`创建任务失败：${error.message}`);
    }
  }

  private async startTask(taskId: string) {
    const ai = (this.settings as any).ai;
    if (!ai?.apiKey) {
      new Notice('请先在设置中配置 AI 的 API Key');
      return;
    }

    try {
      // 异步开始处理，不等待完成
      this.batchProcessor.processTask(taskId, ai).catch(error => {
        console.error('Batch processing failed:', error);
      });
      
      new Notice('批量处理已开始');
      this.renderInterface();
      
    } catch (error) {
      new Notice(`开始处理失败：${error.message}`);
    }
  }

  private cancelTask(taskId: string) {
    this.batchProcessor.cancelTask(taskId);
    this.renderInterface();
  }

  private deleteTask(taskId: string) {
    const task = this.batchProcessor.getTask(taskId);
    if (!task) return;
    
    if (confirm(`确定要删除任务 "${task.name}" 吗？`)) {
      this.batchProcessor.deleteTask(taskId);
      this.renderInterface();
    }
  }

  private viewTaskResult(taskId: string) {
    const task = this.batchProcessor.getTask(taskId);
    if (!task || task.status !== 'completed') return;
    
    new BatchResultModal(this.app, task).open();
  }

  private exportTask(taskId: string) {
    const result = this.batchProcessor.exportTaskResult(taskId);
    if (!result) {
      new Notice('无法导出任务结果');
      return;
    }

    // 复制到剪贴板
    navigator.clipboard.writeText(result).then(() => {
      new Notice('任务结果已复制到剪贴板');
    }).catch(() => {
      // 创建下载链接
      const blob = new Blob([result], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch_result_${taskId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      new Notice('任务结果已下载');
    });
  }

  private updateProgress() {
    const activeTasks = this.batchProcessor.getActiveTasks();
    if (activeTasks.length === 0) return;

    // 更新进度条
    activeTasks.forEach(task => {
      const progressFill = document.querySelector(
        `.batch-task-item[data-task-id="${task.id}"] .batch-progress-fill`
      ) as HTMLElement;
      
      const progressText = document.querySelector(
        `.batch-task-item[data-task-id="${task.id}"] .batch-progress-text`
      ) as HTMLElement;
      
      if (progressFill) {
        progressFill.style.width = `${task.progress}%`;
      }
      
      if (progressText) {
        progressText.textContent = `${task.progress}%`;
      }
    });
  }

  private getStatusText(status: BatchTask['status']): string {
    switch (status) {
      case 'pending': return '等待中';
      case 'processing': return '处理中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

class BatchResultModal extends Modal {
  private task: BatchTask;

  constructor(app: App, task: BatchTask) {
    super(app);
    this.task = task;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { text: `任务结果: ${this.task.name}` });
    
    const resultContainer = contentEl.createDiv({ cls: "batch-result-container" });
    
    if (this.task.settings.combineResults && this.task.results.length === 1) {
      // 显示合并结果
      const resultEl = resultContainer.createEl("pre", { 
        text: this.task.results[0],
        cls: "batch-result-content"
      });
    } else {
      // 显示分块结果
      this.task.results.forEach((result, index) => {
        if (result.trim()) {
          const chunkEl = resultContainer.createDiv({ cls: "batch-result-chunk" });
          chunkEl.createEl("h4", { text: `块 ${index + 1}` });
          chunkEl.createEl("pre", { text: result });
        }
      });
    }
    
    // 操作按钮
    const buttonContainer = contentEl.createDiv({ cls: "batch-result-actions" });
    
    const copyBtn = new ButtonComponent(buttonContainer);
    copyBtn.setButtonText("复制结果");
    copyBtn.setClass("mod-cta");
    copyBtn.onClick(() => {
      const content = this.task.settings.combineResults 
        ? this.task.results[0] 
        : this.task.results.join('\n\n');
      
      navigator.clipboard.writeText(content).then(() => {
        new Notice('结果已复制到剪贴板');
      });
    });
    
    const closeBtn = new ButtonComponent(buttonContainer);
    closeBtn.setButtonText("关闭");
    closeBtn.onClick(() => {
      this.close();
    });
  }
}

// 便捷函数
export const showBatchProcessingModal = (app: App, settings: cMenuSettings): void => {
  new BatchProcessingModal(app, settings).open();
};

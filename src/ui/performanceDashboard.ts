import { Modal, App, Setting, Notice } from "obsidian";
import { ConfigManager, getPerformanceReport } from "../ai/configManager";

export class PerformanceDashboard extends Modal {
  private configManager: ConfigManager;
  private refreshInterval?: number;

  constructor(app: App) {
    super(app);
    this.configManager = ConfigManager.getInstance();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { text: "AI 性能监控面板" });
    
    this.renderDashboard();
    
    // 每30秒自动刷新
    this.refreshInterval = window.setInterval(() => {
      this.renderDashboard();
    }, 30000);
  }

  onClose() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
  }

  private renderDashboard() {
    const { contentEl } = this;
    
    // 清除旧内容（保留标题）
    const children = Array.from(contentEl.children);
    children.slice(1).forEach(child => child.remove());

    const report = getPerformanceReport();
    
    // 当前配置文件
    contentEl.createEl("h3", { text: "当前配置" });
    const profileContainer = contentEl.createDiv({ cls: "performance-profile" });
    profileContainer.createEl("p", { 
      text: `配置文件: ${report.currentProfile}`,
      cls: "profile-name"
    });

    // 配置文件选择
    const profileSetting = new Setting(contentEl)
      .setName("性能配置文件")
      .setDesc("选择适合您设备和使用习惯的性能配置");

    const profiles = this.configManager.getAvailableProfiles();
    const profileSelect = profileSetting.controlEl.createEl("select");
    
    profiles.forEach(({ name, profile }) => {
      const option = profileSelect.createEl("option", { 
        value: name, 
        text: profile.name 
      });
      if (profile.name === report.currentProfile) {
        option.selected = true;
      }
    });

    profileSelect.addEventListener("change", () => {
      const selectedProfile = profileSelect.value;
      if (this.configManager.applyProfile(selectedProfile)) {
        new Notice(`已切换到 ${profiles.find(p => p.name === selectedProfile)?.profile.name} 配置`);
        this.renderDashboard(); // 刷新显示
      }
    });

    // 性能指标
    contentEl.createEl("h3", { text: "性能指标" });
    const metricsContainer = contentEl.createDiv({ cls: "performance-metrics" });
    
    this.renderMetricCard(metricsContainer, "缓存性能", [
      { label: "命中率", value: `${(report.metrics.cache.hitRate * 100).toFixed(1)}%`, trend: report.trends.cacheHitRate },
      { label: "缓存条目", value: report.metrics.cache.totalEntries.toString() },
      { label: "缓存大小", value: this.formatBytes(report.metrics.cache.totalSize) }
    ]);

    this.renderMetricCard(metricsContainer, "队列性能", [
      { label: "吞吐量", value: `${report.metrics.queue.throughput}/分钟`, trend: report.trends.queueThroughput },
      { label: "平均等待", value: `${Math.round(report.metrics.queue.averageWaitTime)}ms` },
      { label: "活跃请求", value: report.metrics.queue.activeRequests.toString() }
    ]);

    this.renderMetricCard(metricsContainer, "渲染性能", [
      { label: "帧率", value: `${Math.round(report.metrics.render.fps)} fps` },
      { label: "渲染时间", value: `${Math.round(report.metrics.render.averageRenderTime)}ms` }
    ]);

    this.renderMetricCard(metricsContainer, "系统资源", [
      { label: "内存使用", value: this.formatBytes(report.metrics.system.memoryUsage), trend: report.trends.memoryUsage }
    ]);

    // 优化建议
    if (report.recommendations.length > 0) {
      contentEl.createEl("h3", { text: "优化建议" });
      const recommendationsContainer = contentEl.createDiv({ cls: "performance-recommendations" });
      
      report.recommendations.forEach(recommendation => {
        const item = recommendationsContainer.createDiv({ cls: "recommendation-item" });
        item.createEl("span", { text: "💡", cls: "recommendation-icon" });
        item.createEl("span", { text: recommendation, cls: "recommendation-text" });
      });

      // 自动优化按钮
      const autoOptimizeBtn = contentEl.createEl("button", {
        text: "应用自动优化",
        cls: "mod-cta"
      });
      
      autoOptimizeBtn.addEventListener("click", () => {
        const newRecommendations = this.configManager.autoOptimize();
        new Notice("已应用自动优化建议");
        this.renderDashboard(); // 刷新显示
      });
    }

    // 手动刷新按钮
    const refreshBtn = contentEl.createEl("button", {
      text: "刷新数据",
      cls: "refresh-btn"
    });
    
    refreshBtn.addEventListener("click", () => {
      this.renderDashboard();
      new Notice("性能数据已刷新");
    });

    // 重置按钮
    const resetBtn = contentEl.createEl("button", {
      text: "重置为默认配置",
      cls: "reset-btn"
    });
    
    resetBtn.addEventListener("click", () => {
      if (this.configManager.applyProfile('balanced')) {
        new Notice("已重置为平衡模式配置");
        this.renderDashboard();
      }
    });
  }

  private renderMetricCard(
    container: HTMLElement, 
    title: string, 
    metrics: Array<{
      label: string; 
      value: string; 
      trend?: 'improving' | 'stable' | 'declining'
    }>
  ) {
    const card = container.createDiv({ cls: "metric-card" });
    card.createEl("h4", { text: title, cls: "metric-title" });
    
    const metricsGrid = card.createDiv({ cls: "metrics-grid" });
    
    metrics.forEach(metric => {
      const item = metricsGrid.createDiv({ cls: "metric-item" });
      item.createEl("span", { text: metric.label, cls: "metric-label" });
      
      const valueContainer = item.createDiv({ cls: "metric-value-container" });
      valueContainer.createEl("span", { text: metric.value, cls: "metric-value" });
      
      if (metric.trend) {
        const trendIcon = this.getTrendIcon(metric.trend);
        const trendEl = valueContainer.createEl("span", { 
          text: trendIcon, 
          cls: `metric-trend trend-${metric.trend}` 
        });
        trendEl.title = this.getTrendDescription(metric.trend);
      }
    });
  }

  private getTrendIcon(trend: 'improving' | 'stable' | 'declining'): string {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      case 'stable': return '➡️';
    }
  }

  private getTrendDescription(trend: 'improving' | 'stable' | 'declining'): string {
    switch (trend) {
      case 'improving': return '性能提升中';
      case 'declining': return '性能下降中';
      case 'stable': return '性能稳定';
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// 便捷函数：显示性能面板
export const showPerformanceDashboard = (app: App): void => {
  new PerformanceDashboard(app).open();
};

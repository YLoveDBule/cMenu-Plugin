import { AIActionItem } from "../settings/settingsData";

export interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  template: string;
  apply: 'replace' | 'insert' | 'quote' | 'code';
  variables: TemplateVariable[];
  tags: string[];
  author?: string;
  version?: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  rating?: number;
  favorite: boolean;
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiline';
  required: boolean;
  defaultValue?: any;
  options?: string[]; // for select type
  placeholder?: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface TemplateStats {
  totalTemplates: number;
  favoriteTemplates: number;
  categoryCounts: Record<string, number>;
  mostUsedTemplate: string | null;
  recentlyUsed: string[];
  averageRating: number;
}

export class TemplateManager {
  private static instance: TemplateManager;
  private templates: Map<string, ActionTemplate> = new Map();
  private categories: Map<string, TemplateCategory> = new Map();
  private storageKey = 'cMenu-action-templates';
  private categoriesKey = 'cMenu-template-categories';

  private constructor() {
    this.initializeDefaultCategories();
    this.loadTemplates();
  }

  static getInstance(): TemplateManager {
    if (!TemplateManager.instance) {
      TemplateManager.instance = new TemplateManager();
    }
    return TemplateManager.instance;
  }

  private initializeDefaultCategories() {
    const defaultCategories: TemplateCategory[] = [
      {
        id: 'writing',
        name: '写作助手',
        description: '帮助改进和优化文本写作',
        icon: 'edit',
        color: '#4CAF50'
      },
      {
        id: 'translation',
        name: '翻译工具',
        description: '各种语言翻译和本地化',
        icon: 'languages',
        color: '#2196F3'
      },
      {
        id: 'analysis',
        name: '分析总结',
        description: '内容分析、总结和提取',
        icon: 'bar-chart',
        color: '#FF9800'
      },
      {
        id: 'coding',
        name: '编程助手',
        description: '代码生成、优化和解释',
        icon: 'code',
        color: '#9C27B0'
      },
      {
        id: 'creative',
        name: '创意写作',
        description: '创意内容生成和续写',
        icon: 'lightbulb',
        color: '#E91E63'
      },
      {
        id: 'education',
        name: '教育学习',
        description: '学习辅助和知识解释',
        icon: 'graduation-cap',
        color: '#607D8B'
      },
      {
        id: 'business',
        name: '商务办公',
        description: '商务文档和邮件处理',
        icon: 'briefcase',
        color: '#795548'
      },
      {
        id: 'custom',
        name: '自定义',
        description: '用户自定义模板',
        icon: 'settings',
        color: '#9E9E9E'
      }
    ];

    defaultCategories.forEach(category => {
      this.categories.set(category.id, category);
    });
  }

  // 模板管理
  createTemplate(template: Omit<ActionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'favorite'>): string {
    const id = this.generateId();
    const now = Date.now();
    
    const newTemplate: ActionTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      favorite: false
    };

    this.templates.set(id, newTemplate);
    this.saveTemplates();
    return id;
  }

  updateTemplate(id: string, updates: Partial<ActionTemplate>): boolean {
    const template = this.templates.get(id);
    if (!template) return false;

    const updatedTemplate = {
      ...template,
      ...updates,
      id, // 确保ID不被修改
      updatedAt: Date.now()
    };

    this.templates.set(id, updatedTemplate);
    this.saveTemplates();
    return true;
  }

  deleteTemplate(id: string): boolean {
    const deleted = this.templates.delete(id);
    if (deleted) {
      this.saveTemplates();
    }
    return deleted;
  }

  getTemplate(id: string): ActionTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): ActionTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(categoryId: string): ActionTemplate[] {
    return this.getAllTemplates().filter(template => template.category === categoryId);
  }

  getFavoriteTemplates(): ActionTemplate[] {
    return this.getAllTemplates().filter(template => template.favorite);
  }

  searchTemplates(query: string): ActionTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTemplates().filter(template => 
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.template.toLowerCase().includes(lowerQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // 使用统计
  incrementUsage(id: string): void {
    const template = this.templates.get(id);
    if (template) {
      template.usageCount++;
      template.updatedAt = Date.now();
      this.saveTemplates();
    }
  }

  setRating(id: string, rating: number): boolean {
    if (rating < 1 || rating > 5) return false;
    
    const template = this.templates.get(id);
    if (!template) return false;

    template.rating = rating;
    template.updatedAt = Date.now();
    this.saveTemplates();
    return true;
  }

  toggleFavorite(id: string): boolean {
    const template = this.templates.get(id);
    if (!template) return false;

    template.favorite = !template.favorite;
    template.updatedAt = Date.now();
    this.saveTemplates();
    return template.favorite;
  }

  // 分类管理
  createCategory(category: Omit<TemplateCategory, 'id'>): string {
    const id = this.generateId();
    const newCategory: TemplateCategory = { ...category, id };
    
    this.categories.set(id, newCategory);
    this.saveCategories();
    return id;
  }

  updateCategory(id: string, updates: Partial<TemplateCategory>): boolean {
    const category = this.categories.get(id);
    if (!category) return false;

    const updatedCategory = { ...category, ...updates, id };
    this.categories.set(id, updatedCategory);
    this.saveCategories();
    return true;
  }

  deleteCategory(id: string): boolean {
    // 不能删除默认分类
    const defaultCategories = ['writing', 'translation', 'analysis', 'coding', 'creative', 'education', 'business', 'custom'];
    if (defaultCategories.includes(id)) return false;

    // 将该分类下的模板移动到自定义分类
    const templatesInCategory = this.getTemplatesByCategory(id);
    templatesInCategory.forEach(template => {
      template.category = 'custom';
    });

    const deleted = this.categories.delete(id);
    if (deleted) {
      this.saveCategories();
      this.saveTemplates();
    }
    return deleted;
  }

  getCategory(id: string): TemplateCategory | undefined {
    return this.categories.get(id);
  }

  getAllCategories(): TemplateCategory[] {
    return Array.from(this.categories.values());
  }

  // 统计信息
  getStats(): TemplateStats {
    const templates = this.getAllTemplates();
    const categoryCounts: Record<string, number> = {};
    let totalRating = 0;
    let ratedCount = 0;

    // 计算分类统计
    this.getAllCategories().forEach(category => {
      categoryCounts[category.id] = 0;
    });

    templates.forEach(template => {
      categoryCounts[template.category] = (categoryCounts[template.category] || 0) + 1;
      
      if (template.rating) {
        totalRating += template.rating;
        ratedCount++;
      }
    });

    // 找到最常用的模板
    const mostUsedTemplate = templates.length > 0 
      ? templates.reduce((prev, current) => 
          prev.usageCount > current.usageCount ? prev : current
        ).id
      : null;

    // 最近使用的模板（按更新时间排序）
    const recentlyUsed = templates
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
      .map(template => template.id);

    return {
      totalTemplates: templates.length,
      favoriteTemplates: templates.filter(t => t.favorite).length,
      categoryCounts,
      mostUsedTemplate,
      recentlyUsed,
      averageRating: ratedCount > 0 ? totalRating / ratedCount : 0
    };
  }

  // 模板转换
  templateToAIAction(template: ActionTemplate): AIActionItem {
    return {
      id: template.id,
      name: template.name,
      icon: template.icon,
      template: template.template,
      apply: template.apply
    };
  }

  aiActionToTemplate(action: AIActionItem, category: string = 'custom'): ActionTemplate {
    const now = Date.now();
    return {
      id: action.id,
      name: action.name,
      description: `从 AI 动作转换：${action.name}`,
      category,
      icon: action.icon || 'bot-glyph',
      template: action.template,
      apply: action.apply,
      variables: this.extractVariables(action.template),
      tags: [],
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      favorite: false
    };
  }

  // 变量提取
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

  // 导入导出
  exportTemplates(templateIds?: string[]): string {
    const templatesToExport = templateIds 
      ? templateIds.map(id => this.templates.get(id)).filter(Boolean) as ActionTemplate[]
      : this.getAllTemplates();

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      templates: templatesToExport,
      categories: this.getAllCategories()
    };

    return JSON.stringify(exportData, null, 2);
  }

  importTemplates(data: string, mode: 'merge' | 'replace' = 'merge'): number {
    try {
      const importData = JSON.parse(data);
      
      if (!importData.templates || !Array.isArray(importData.templates)) {
        throw new Error('无效的模板数据格式');
      }

      if (mode === 'replace') {
        this.templates.clear();
      }

      let importedCount = 0;

      // 导入分类
      if (importData.categories && Array.isArray(importData.categories)) {
        importData.categories.forEach((category: any) => {
          if (category.id && category.name && !this.categories.has(category.id)) {
            this.categories.set(category.id, category);
          }
        });
      }

      // 导入模板
      importData.templates.forEach((template: any) => {
        if (template.id && template.name && template.template) {
          // 处理ID冲突
          let finalId = template.id;
          if (this.templates.has(finalId) && mode === 'merge') {
            finalId = this.generateId();
          }

          const importedTemplate: ActionTemplate = {
            ...template,
            id: finalId,
            createdAt: template.createdAt || Date.now(),
            updatedAt: Date.now(),
            usageCount: template.usageCount || 0,
            favorite: template.favorite || false
          };

          this.templates.set(finalId, importedTemplate);
          importedCount++;
        }
      });

      this.saveTemplates();
      this.saveCategories();
      return importedCount;
    } catch (error) {
      throw new Error(`导入失败：${error.message}`);
    }
  }

  // 批量操作
  duplicateTemplate(id: string): string | null {
    const template = this.templates.get(id);
    if (!template) return null;

    const newId = this.generateId();
    const duplicatedTemplate: ActionTemplate = {
      ...template,
      id: newId,
      name: `${template.name} (副本)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
      favorite: false
    };

    this.templates.set(newId, duplicatedTemplate);
    this.saveTemplates();
    return newId;
  }

  deleteTemplates(ids: string[]): number {
    let deletedCount = 0;
    ids.forEach(id => {
      if (this.templates.delete(id)) {
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      this.saveTemplates();
    }
    return deletedCount;
  }

  // 存储管理
  private saveTemplates(): void {
    const data = Array.from(this.templates.values());
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  private loadTemplates(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const templates: ActionTemplate[] = JSON.parse(data);
        templates.forEach(template => {
          this.templates.set(template.id, template);
        });
      }
    } catch (error) {
      console.error('[TemplateManager] Failed to load templates:', error);
    }
  }

  private saveCategories(): void {
    const data = Array.from(this.categories.values());
    localStorage.setItem(this.categoriesKey, JSON.stringify(data));
  }

  private loadCategories(): void {
    try {
      const data = localStorage.getItem(this.categoriesKey);
      if (data) {
        const categories: TemplateCategory[] = JSON.parse(data);
        categories.forEach(category => {
          this.categories.set(category.id, category);
        });
      }
    } catch (error) {
      console.error('[TemplateManager] Failed to load categories:', error);
    }
  }

  clearAll(): number {
    const count = this.templates.size;
    this.templates.clear();
    this.saveTemplates();
    return count;
  }

  private generateId(): string {
    return 'template_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// 便捷函数
export const getTemplateManager = (): TemplateManager => {
  return TemplateManager.getInstance();
};

export const createTemplateFromAIAction = (action: AIActionItem, category?: string): string => {
  const manager = TemplateManager.getInstance();
  const template = manager.aiActionToTemplate(action, category);
  return manager.createTemplate(template);
};

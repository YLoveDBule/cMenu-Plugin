import { App, Notice, MarkdownView, Plugin } from "obsidian";
import { runChat } from "../ai/aiClient";
import { addHistoryEntry } from "./historyManager";
import type { cMenuSettings } from "../settings/settingsData";

export interface AICommand {
  id: string;
  name: string;
  description: string;
  template: string;
  apply: 'replace' | 'insert' | 'quote' | 'code';
  icon?: string;
}

export class AICommandManager {
  private plugin: Plugin;
  private settings: cMenuSettings;
  
  // 预定义的 AI 命令
  private commands: AICommand[] = [
    {
      id: 'ai-optimize',
      name: '优化文本',
      description: '优化选中的文本，使其更清晰简洁',
      template: '请优化以下文本，使其更加清晰、简洁和易读：\n\n{selection}',
      apply: 'replace',
      icon: 'sparkles'
    },
    {
      id: 'ai-translate',
      name: '翻译文本',
      description: '将选中文本翻译成中文',
      template: '请将以下文本翻译成中文：\n\n{selection}',
      apply: 'replace',
      icon: 'languages'
    },
    {
      id: 'ai-summarize',
      name: '总结要点',
      description: '总结选中文本的要点',
      template: '请总结以下内容的要点：\n\n{selection}',
      apply: 'insert',
      icon: 'list'
    },
    {
      id: 'ai-continue',
      name: '续写内容',
      description: '基于选中文本继续写作',
      template: '请基于以下内容继续写作，保持风格一致：\n\n{selection}',
      apply: 'insert',
      icon: 'edit'
    },
    {
      id: 'ai-explain',
      name: '解释内容',
      description: '解释选中的代码或概念',
      template: '请解释以下内容：\n\n{selection}',
      apply: 'insert',
      icon: 'help-circle'
    },
    {
      id: 'ai-improve',
      name: '改进表达',
      description: '改进选中文本的表达方式',
      template: '请改进以下文本的表达方式，使其更专业和准确：\n\n{selection}',
      apply: 'replace',
      icon: 'trending-up'
    }
  ];

  constructor(plugin: Plugin, settings: cMenuSettings) {
    this.plugin = plugin;
    this.settings = settings;
  }

  /**
   * 注册所有 AI 命令到 Obsidian
   */
  public registerCommands(): void {
    this.commands.forEach(cmd => {
      this.plugin.addCommand({
        id: cmd.id,
        name: cmd.name,
        callback: () => this.executeCommand(cmd),
        checkCallback: (checking: boolean) => {
          const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
          if (!activeView) return false;
          
          const selection = activeView.editor.getSelection();
          if (!selection.trim()) {
            if (!checking) {
              new Notice(`请先选中文本再使用 ${cmd.name}`);
            }
            return false;
          }
          
          return true;
        }
      });
    });

    console.log(`[AICommandManager] Registered ${this.commands.length} AI commands`);
  }

  /**
   * 执行 AI 命令
   */
  private async executeCommand(command: AICommand): Promise<void> {
    const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      new Notice('请在 Markdown 编辑器中使用 AI 命令');
      return;
    }

    const editor = activeView.editor;
    const selection = editor.getSelection();
    
    if (!selection.trim()) {
      new Notice(`请先选中文本再使用 ${command.name}`);
      return;
    }

    // 检查AI配置
    const ai = (this.settings as any).ai;
    if (!ai?.apiKey) {
      new Notice('请先在设置中配置 AI 的 API Key');
      return;
    }

    // 显示处理通知
    const processingNotice = new Notice(`正在执行 ${command.name}...`, 0);
    const startTime = Date.now();

    try {
      // 构建消息
      const messages = [{
        role: 'user' as const,
        content: command.template.replace('{selection}', selection)
      }];

      // 执行AI请求
      const result = await runChat(ai, messages, command.template);
      
      // 应用结果
      this.applyResult(editor, result, command.apply, selection);
      
      // 记录历史
      const processingTime = Date.now() - startTime;
      addHistoryEntry(
        command.name,
        command.template,
        selection,
        result,
        ai.model || 'unknown',
        {
          processingTime,
          source: 'shortcut',
          fileType: activeView.file?.extension
        }
      );
      
      // 显示成功通知
      processingNotice.hide();
      new Notice(`${command.name} 完成`);
      
    } catch (error) {
      processingNotice.hide();
      new Notice(`${command.name} 失败：${error.message}`);
      console.error(`[AICommandManager] Command execution failed:`, error);
    }
  }

  /**
   * 应用AI结果
   */
  private applyResult(editor: any, result: string, applyMode: string, originalSelection: string): void {
    switch (applyMode) {
      case 'replace':
        editor.replaceSelection(result);
        break;
        
      case 'insert':
        const cursor = editor.getCursor('to') || editor.getCursor();
        const prefix = originalSelection.endsWith('\n') ? '' : '\n';
        editor.replaceRange(prefix + result + '\n', cursor);
        break;
        
      case 'quote':
        const cursor2 = editor.getCursor('to') || editor.getCursor();
        const quotedResult = result.split('\n').map(line => `> ${line}`).join('\n');
        const prefix2 = originalSelection.endsWith('\n') ? '' : '\n';
        editor.replaceRange(prefix2 + quotedResult + '\n', cursor2);
        break;
        
      case 'code':
        const cursor3 = editor.getCursor('to') || editor.getCursor();
        const codeResult = '```\n' + result + '\n```';
        const prefix3 = originalSelection.endsWith('\n') ? '' : '\n';
        editor.replaceRange(prefix3 + codeResult + '\n', cursor3);
        break;
    }
  }

  /**
   * 获取所有命令
   */
  public getCommands(): AICommand[] {
    return [...this.commands];
  }
}

// 便捷函数
export const registerAICommands = (plugin: Plugin, settings: cMenuSettings): AICommandManager => {
  const manager = new AICommandManager(plugin, settings);
  manager.registerCommands();
  return manager;
};

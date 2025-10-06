import type { Command } from "obsidian";
export const AESTHETIC_STYLES = ["glass", "default"];

// Menu item union type to support plain commands, groups (submenus), and macros
export type CommandItem = Command & { type?: undefined };
export type GroupItem = {
  type: "group";
  name: string;
  icon?: string;
  items: MenuItem[];
};
export type MacroItem = {
  type: "macro";
  name: string;
  icon?: string;
  steps: Array<{ id: string; delayMs?: number }>;
};
export type MenuItem = CommandItem | GroupItem | MacroItem;

export interface cMenuSettings {
  aestheticStyle: string;
  // Upgraded: support command/group/macro
  menuCommands: MenuItem[];
  cMenuVisibility: boolean;
  cMenuBottomValue: number;
  cMenuButtonGap: number; // px
  cMenuButtonScale: number; // em multiplier
  // Phase 1 additions
  cMenuDockMode?: 'follow' | 'fixed';
  cMenuMaxWidthPct?: number; // 30-100
  // Positioning advanced options
  cMenuAllowTableOverflow?: boolean; // allow menu to overflow editor bounds for tables
  cMenuFollowGapMin?: number;        // minimal gap for normal selections (defaults to 6)
  cMenuTableGapMin?: number;         // minimal gap for table selections (defaults to 10)
  cMenuTableGapAbove?: number;       // smaller gap when placing above in tables (defaults to 6)
  cMenuUseStartRectVertical?: boolean; // use start-caret rect as vertical baseline
  cMenuOverflowMode?: string; // overflow handling mode
  cMenuCompactInTable?: boolean; // compact mode in tables
  // AI assistant settings
  ai?: AISettings;
  aiActions?: AIActionItem[];
}

export type AIProvider = 'deepseek' | 'openai';
export interface AISettings {
  // 基本设置
  provider?: AIProvider;           // deepseek (default) | openai
  baseUrl?: string;               // override base url. deepseek: https://api.deepseek.com
  apiKey?: string;                // secret in local settings
  model?: string;                 // deepseek-chat (default)
  systemPrompt?: string;          // global system prompt
  timeoutMs?: number;             // default 30000
  temperature?: number;           // 0-2
  maxTokens?: number;             // optional
  stream?: boolean;               // enable SSE stream
  previewEnabled?: boolean;       // show preview panel before applying
  previewType?: 'anchored' | 'modal'; // preview panel type
  mruLimit?: number;              // max recent used items in AI submenu
  
  // Phase 2: 性能优化
  enableCache?: boolean;
  cacheExpiry?: number;
  enableStreaming?: boolean;
  enablePreload?: boolean;
  maxConcurrent?: number;
  queueTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface AIActionItem {
  id: string;
  name: string;
  icon: string;
  template: string;
  apply: 'replace' | 'insert' | 'quote' | 'code';
  description?: string;
}

export const DEFAULT_SETTINGS: cMenuSettings = {
  aestheticStyle: "default",
  menuCommands: [
    {
      id: "cmenu-plugin:editor:toggle-bold",
      name: "cMenu: Toggle bold",
      icon: "bold-glyph",
    },
    {
      id: "cmenu-plugin:editor:toggle-italics",
      name: "cMenu: Toggle italics",
      icon: "italic-glyph",
    },
    {
      id: "cmenu-plugin:editor:toggle-strikethrough",
      name: "cMenu: Toggle strikethrough",
      icon: "strikethrough-glyph",
    },
    {
      id: "cmenu-plugin:underline",
      name: "cMenu: Toggle underline",
      icon: "underline-glyph",
    },
    {
      id: "cmenu-plugin:superscript",
      name: "cMenu: Toggle superscript",
      icon: "superscript-glyph",
    },
    {
      id: "cmenu-plugin:subscript",
      name: "cMenu: Toggle subscript",
      icon: "subscript-glyph",
    },
    {
      id: "cmenu-plugin:editor:toggle-code",
      name: "cMenu: Toggle code",
      icon: "code-glyph",
    },
    {
      id: "cmenu-plugin:codeblock",
      name: "cMenu: Toggle codeblock",
      icon: "codeblock-glyph",
    },
    {
      id: "cmenu-plugin:editor:toggle-blockquote",
      name: "cMenu: Toggle blockquote",
      icon: "quote-glyph",
    },
  ],
  cMenuVisibility: true,
  cMenuBottomValue: 8,
  cMenuButtonGap: 6,
  cMenuButtonScale: 1.0,
  // Phase 1 defaults
  cMenuDockMode: 'follow',
  cMenuOverflowMode: 'wrap',
  cMenuMaxWidthPct: 100,
  // Positioning advanced defaults
  cMenuAllowTableOverflow: true,
  cMenuCompactInTable: false,
  cMenuFollowGapMin: 6,
  cMenuTableGapMin: 10,
  cMenuTableGapAbove: 6,
  cMenuUseStartRectVertical: false,
  // AI defaults (DeepSeek)
  ai: {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-chat',
    systemPrompt: 'You are a helpful writing assistant. Keep output in Markdown, concise and clear. Do not add explanations unless asked.',
    timeoutMs: 30000,
    temperature: 0.7,
    maxTokens: 800,
    stream: false,
    previewEnabled: true,
    previewType: 'anchored',
    mruLimit: 6,
  },
  // 默认 AI 子菜单动作
  aiActions: [
    {
      id: 'ai_optimize',
      name: '优化',
      icon: 'bot-glyph',
      template: '请对以下内容进行优化润色，保持原意，尽量简洁清晰:\n\n{selection}',
      apply: 'replace',
    },
    {
      id: 'ai_translate',
      name: '翻译文本',
      icon: 'languages',
      template: '请将以下文本翻译成中文，保持原文的格式和语气：\n\n{selection}',
      apply: 'replace',
    },
    {
      id: 'ai_summarize',
      name: '总结要点',
      icon: 'list',
      template: '请总结以下内容的要点，用简洁的条目形式列出：\n\n{selection}',
      apply: 'insert',
    },
    {
      id: 'ai_explain',
      name: '解释内容',
      icon: 'help-circle',
      template: '请详细解释以下内容，帮助理解其含义和背景：\n\n{selection}',
      apply: 'insert',
    },
    {
      id: 'ai_improve',
      name: '改进表达',
      icon: 'trending-up',
      template: '请改进以下文本的表达方式，使其更专业、准确和易懂：\n\n{selection}',
      apply: 'replace',
    },
    {
      id: 'ai_continue',
      name: '续写',
      icon: 'pencil',
      template: '请基于以下上下文自然续写一段，风格保持一致:\n\n{selection}',
      apply: 'insert',
    },
  ],
};

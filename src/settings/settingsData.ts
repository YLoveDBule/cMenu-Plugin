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
  cMenuOverflowMode?: 'wrap' | 'scroll';
  cMenuMaxWidthPct?: number; // 30-100
  // Positioning advanced options
  cMenuAllowTableOverflow?: boolean; // allow menu to overflow editor bounds for tables
  cMenuCompactInTable?: boolean;     // compact mode when table area is too narrow (future use)
  cMenuFollowGapMin?: number;        // minimal gap for normal selections (defaults to 6)
  cMenuTableGapMin?: number;         // minimal gap for table selections (defaults to 10)
  cMenuTableGapAbove?: number;       // smaller gap when placing above in tables (defaults to 6)
  cMenuUseStartRectVertical?: boolean; // use start-caret rect as vertical baseline
  // AI assistant settings
  ai?: AISettings;
  aiActions?: AIActionItem[];
}

export type AIProvider = 'deepseek' | 'openai';
export interface AISettings {
  provider: AIProvider;           // default deepseek
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
  mruLimit?: number;              // 最近使用数量（AI 子菜单）
}

export interface AIActionItem {
  id: string;                     // stable id
  name: string;                   // 菜单显示名
  icon?: string;                  // 图标名（兼容性不确定时建议留空或用现有 glyph）
  template: string;               // 用户消息模版，含 {selection}
  apply: 'replace' | 'insert' | 'quote' | 'code';    // 结果落地方式
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
      id: 'ai_continue',
      name: '续写',
      icon: 'pencil',
      template: '请基于以下上下文自然续写一段，风格保持一致:\n\n{selection}',
      apply: 'insert',
    },
  ],
};

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
};

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
};

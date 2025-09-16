// Minimal global DOM helper declarations used by Obsidian environment
// These functions exist at runtime in Obsidian, but are not part of TypeScript lib.dom types.
declare function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: { cls?: string | string[]; text?: string; attr?: Record<string, string>; href?: string }
): HTMLElementTagNameMap[K];

declare function createDiv(
  options?: { cls?: string | string[]; text?: string },
  parent?: Element
): HTMLDivElement;

declare function createSpan(options?: { cls?: string | string[]; text?: string }): HTMLSpanElement;

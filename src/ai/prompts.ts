import type { AISettings } from "src/settings/settingsData";
import type { ChatMessage } from "./aiClient";

export function buildOptimizeMessages(ai: AISettings | undefined, selection: string, extra?: { title?: string }) : ChatMessage[] {
  const system = (ai?.systemPrompt?.trim()) || 'You are a helpful writing assistant. Keep output in Markdown. Improve clarity, fluency and structure without changing the meaning.';
  const user = `请对以下内容进行优化润色，保持原意，尽量简洁清晰：\n\n${selection}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function buildContinueMessages(ai: AISettings | undefined, selection: string, extra?: { title?: string }) : ChatMessage[] {
  const system = (ai?.systemPrompt?.trim()) || 'You are a helpful writing assistant. Keep output in Markdown.';
  const user = `请基于以下上下文自然续写一段，风格保持一致：\n\n${selection}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

import type { AISettings } from "src/settings/settingsData";

export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage { role: ChatRole; content: string }

export function runChatStream(
  ai: AISettings | undefined,
  messages: ChatMessage[],
  handlers: { onDelta: (t: string) => void; onDone: (full: string) => void; onError: (err: any) => void }
) {
  if (!ai) { handlers.onError(new Error('AI settings missing')); return { cancel(){} } as const; }
  const provider = ai.provider || 'deepseek';
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek;
  const baseUrl = (ai.baseUrl && ai.baseUrl.trim()) ? ai.baseUrl.trim().replace(/\/$/, '') : defaults.baseUrl;
  const endpoint = baseUrl + (defaults.path || '/v1/chat/completions');
  const apiKey = ai.apiKey?.trim();
  if (!apiKey) { handlers.onError(new Error('API Key 未配置')); return { cancel(){} } as const; }
  const model = (ai.model && ai.model.trim()) || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo');
  const temperature = typeof ai.temperature === 'number' ? ai.temperature : 0.7;
  const maxTokens = typeof ai.maxTokens === 'number' ? ai.maxTokens : undefined;
  const timeoutMs = typeof ai.timeoutMs === 'number' ? ai.timeoutMs : 30000;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let buffer = '';
  let full = '';

  fetch(endpoint, {
    method: 'POST',
    signal: ctrl.signal,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      const text = await (async ()=>{ try{return await res.text();}catch{return ''} })();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') {
            handlers.onDone(full);
            return;
          }
          try {
            const obj = JSON.parse(payload);
            const delta = obj?.choices?.[0]?.delta?.content || '';
            if (delta) { full += delta; handlers.onDelta(delta); }
          } catch (e) {
            // ignore json error
          }
        }
      }
    }
    handlers.onDone(full);
  }).catch((err) => {
    handlers.onError(err);
  }).finally(() => clearTimeout(t));

  return {
    cancel() { try { ctrl.abort(); } catch {} },
  } as const;
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; path: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', path: '/v1/chat/completions' },
  openai: { baseUrl: 'https://api.openai.com', path: '/v1/chat/completions' },
};

export async function runChat(ai: AISettings | undefined, messages: ChatMessage[]): Promise<string> {
  if (!ai) throw new Error('AI settings missing');
  const provider = ai.provider || 'deepseek';
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek;
  const baseUrl = (ai.baseUrl && ai.baseUrl.trim()) ? ai.baseUrl.trim().replace(/\/$/, '') : defaults.baseUrl;
  const endpoint = baseUrl + (defaults.path || '/v1/chat/completions');
  const apiKey = ai.apiKey?.trim();
  if (!apiKey) throw new Error('API Key 未配置');
  const model = (ai.model && ai.model.trim()) || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo');
  const temperature = typeof ai.temperature === 'number' ? ai.temperature : 0.7;
  const maxTokens = typeof ai.maxTokens === 'number' ? ai.maxTokens : undefined;
  const timeoutMs = typeof ai.timeoutMs === 'number' ? ai.timeoutMs : 30000;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('AI 返回为空');
    return content.trim();
  } finally {
    clearTimeout(t);
  }
}

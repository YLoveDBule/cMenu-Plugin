import type { AISettings } from "src/settings/settingsData";
import { withRetry, RETRY_CONFIGS } from "./retryManager";
import { NetworkDetector, isNetworkGoodForAI } from "src/utils/networkDetector";
import { CacheManager } from "./cacheManager";

export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage { role: ChatRole; content: string }

export function runChatStream(
  ai: AISettings | undefined,
  messages: ChatMessage[],
  handlers: { onDelta: (t: string) => void; onDone: (full: string) => void; onError: (err: any) => void }
) {
  if (!ai) { handlers.onError(new Error('AI settings missing')); return { cancel(){} } as const; }
  
  // 检查网络状态
  if (!isNetworkGoodForAI()) {
    const detector = NetworkDetector.getInstance();
    const status = detector.getStatus();
    if (!status.online) {
      handlers.onError(new Error('网络已断开，请检查网络连接'));
      return { cancel(){} } as const;
    } else if (status.quality === 'poor') {
      console.warn('[cMenu AI] Poor network quality detected, request may be slow');
    }
  }
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
  
  // 包装fetch请求以支持重试
  const makeRequest = async () => {

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
        stream: true,
      }),
    });
    
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
  };
  
  // 使用重试机制执行请求
  withRetry(makeRequest, RETRY_CONFIGS.STANDARD)
    .catch((err) => {
      handlers.onError(err);
    })
    .finally(() => clearTimeout(t));

  return {
    cancel() { try { ctrl.abort(); } catch {} },
  } as const;
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; path: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', path: '/v1/chat/completions' },
  openai: { baseUrl: 'https://api.openai.com', path: '/v1/chat/completions' },
};

export async function runChat(ai: AISettings | undefined, messages: ChatMessage[], template?: string): Promise<string> {
  if (!ai) throw new Error('AI settings missing');
  
  // 检查网络状态
  if (!isNetworkGoodForAI()) {
    const detector = NetworkDetector.getInstance();
    const status = detector.getStatus();
    if (!status.online) {
      throw new Error('网络已断开，请检查网络连接');
    } else if (status.quality === 'poor') {
      console.warn('[cMenu AI] Poor network quality detected, request may be slow');
    }
  }
  
  // 检查缓存
  if (template && messages.length > 0) {
    const cache = CacheManager.getInstance();
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    const model = (ai.model && ai.model.trim()) || (ai.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo');
    
    const cachedResult = cache.get(cache.generateKey(template, userMessage, model));
    if (cachedResult) {
      console.log('[cMenu AI] Using cached result');
      return cachedResult;
    }
  }
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
  
  // 包装请求以支持重试
  const makeRequest = async (): Promise<string> => {
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
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('AI 返回为空');
    }
    return content.trim();
  };
  
  try {
    const result = await withRetry(makeRequest, RETRY_CONFIGS.STANDARD);
    
    // 缓存结果
    if (template && messages.length > 0) {
      const cache = CacheManager.getInstance();
      const userMessage = messages.find(m => m.role === 'user')?.content || '';
      const model = (ai.model && ai.model.trim()) || (ai.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo');
      
      cache.set(template, userMessage, model, result);
    }
    
    return result;
  } finally {
    clearTimeout(t);
  }
}

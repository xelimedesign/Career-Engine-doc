import {
  clearAiErrorBanner,
  normalizeOllamaBaseUrl,
  reportAiErrorBanner,
  updateAiLiveStream,
} from './aiProviderConfig';

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaModelInfo {
  name: string;
  size?: number;
  parameterSize?: string;
  quantization?: string;
  modifiedAt?: string;
}

export class OllamaClientError extends Error {
  readonly isCorsOrNetwork: boolean;
  readonly guidance: string;
  readonly statusCode?: number;

  constructor(
    message: string,
    options: { isCorsOrNetwork: boolean; guidance: string; statusCode?: number }
  ) {
    super(message);
    this.name = 'OllamaClientError';
    this.isCorsOrNetwork = options.isCorsOrNetwork;
    this.guidance = options.guidance;
    this.statusCode = options.statusCode;
  }
}

export function buildOllamaCorsGuidance(baseUrl: string): string {
  const isHttpsPage =
    typeof window !== 'undefined' && window.location?.protocol === 'https:';
  const isHttpTarget = /^http:\/\//i.test(baseUrl);
  const isLocalHost = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(baseUrl);

  const lines = [
    'Make sure Ollama is running and allows browser requests by setting OLLAMA_ORIGINS="*" before starting Ollama (for example: OLLAMA_ORIGINS="*" ollama serve).',
  ];

  if (isHttpsPage && isHttpTarget) {
    lines.push(
      isLocalHost
        ? 'Because this app is loaded over HTTPS, your browser may block http://localhost requests — use an HTTPS Cloudflare Tunnel URL (e.g., https://ollama.yourdomain.com) if localhost is blocked.'
        : 'Because this app is loaded over HTTPS, browsers block plain http:// URLs — use an HTTPS Cloudflare Tunnel URL (e.g., https://ollama.yourdomain.com).'
    );
  } else {
    lines.push(
      'When accessing remotely over HTTPS, expose Ollama via an HTTPS Cloudflare Tunnel URL (e.g., https://ollama.yourdomain.com).'
    );
  }

  return lines.join(' ');
}

export function validateOllamaBaseUrl(rawUrl: string): string {
  const normalized = normalizeOllamaBaseUrl(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new OllamaClientError(
      `Invalid Ollama Base URL "${rawUrl}". Enter a valid http:// or https:// URL.`,
      {
        isCorsOrNetwork: false,
        guidance: 'Example: http://localhost:11434 or https://ollama.yourdomain.com',
      }
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new OllamaClientError(
      `Unsupported URL protocol "${parsed.protocol}". Use http:// or https://.`,
      {
        isCorsOrNetwork: false,
        guidance: 'Example: http://localhost:11434 or https://ollama.yourdomain.com',
      }
    );
  }

  return normalized;
}

export function buildOllamaHeaders(
  apiKey?: string,
  includeJsonContentType = false
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const cleanKey = (apiKey || '').trim();
  if (cleanKey) {
    headers['Authorization'] = `Bearer ${cleanKey}`;
  }
  return headers;
}

export function classifyOllamaError(err: unknown, baseUrl: string): OllamaClientError {
  if (err instanceof OllamaClientError) return err;

  const rawMsg = err instanceof Error ? err.message : String(err || 'Unknown error');
  const lower = rawMsg.toLowerCase();
  const guidance = buildOllamaCorsGuidance(baseUrl);

  const isAbort =
    (err instanceof DOMException && err.name === 'AbortError') ||
    lower.includes('aborted') ||
    lower.includes('timed out');

  if (isAbort) {
    return new OllamaClientError(
      `Request to ${baseUrl} timed out (${rawMsg || 'AbortError'}).`,
      {
        isCorsOrNetwork: true,
        guidance,
      }
    );
  }

  const isNetworkOrCors =
    err instanceof TypeError ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('cors') ||
    lower.includes('mixed content') ||
    lower.includes('err_connection_refused');

  if (isNetworkOrCors) {
    return new OllamaClientError(
      `Network / CORS error reaching ${baseUrl}: ${rawMsg || 'Failed to fetch'}.`,
      {
        isCorsOrNetwork: true,
        guidance,
      }
    );
  }

  return new OllamaClientError(rawMsg || 'Ollama request failed.', {
    isCorsOrNetwork: false,
    guidance,
  });
}

export function parseSseLine(line: string): { done: boolean; token: string } {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) {
    return { done: false, token: '' };
  }

  const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  if (!payload) {
    return { done: false, token: '' };
  }
  if (payload === '[DONE]') {
    return { done: true, token: '' };
  }

  try {
    const parsed = JSON.parse(payload) as {
      choices?: Array<{
        delta?: { content?: string };
        message?: { content?: string };
        text?: string;
      }>;
      message?: { content?: string };
      response?: string;
      done?: boolean;
      error?: { message?: string } | string;
    };

    if (parsed.error) {
      const errMsg =
        typeof parsed.error === 'string'
          ? parsed.error
          : parsed.error.message || 'Ollama stream error';
      throw new Error(errMsg);
    }

    const token =
      parsed.choices?.[0]?.delta?.content ??
      parsed.choices?.[0]?.message?.content ??
      parsed.choices?.[0]?.text ??
      parsed.message?.content ??
      parsed.response ??
      '';

    return {
      done: Boolean(parsed.done),
      token: typeof token === 'string' ? token : '',
    };
  } catch (err) {
    if (err instanceof Error && err.message && !err.message.includes('JSON')) {
      throw err;
    }
    return { done: false, token: '' };
  }
}

export function extractJsonObjectSafe<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  const withoutThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const stripped = withoutThink
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Attempt to locate the first balanced JSON object inside surrounding prose
    const startIdx = stripped.indexOf('{');
    if (startIdx >= 0) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = startIdx; i < stripped.length; i++) {
        const ch = stripped[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) {
              const candidate = stripped.slice(startIdx, i + 1);
              try {
                return JSON.parse(candidate) as T;
              } catch {
                break;
              }
            }
          }
        }
      }
    }
    return fallback;
  }
}

export async function fetchOllamaModels(params: {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<{
  baseUrl: string;
  models: string[];
  details: OllamaModelInfo[];
  endpointUsed: '/v1/models' | '/api/tags';
}> {
  const baseUrl = validateOllamaBaseUrl(params.baseUrl);
  const headers = buildOllamaHeaders(params.apiKey, false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 15000);

  try {
    // 1. Try OpenAI-compatible GET {baseUrl}/v1/models first
    let v1FallbackNote = '';
    const v1Res = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (v1Res.ok) {
      const v1Data = (await v1Res.json().catch(() => null)) as {
        data?: Array<{ id?: string; owned_by?: string; created?: number }>;
      } | null;

      if (v1Data && Array.isArray(v1Data.data)) {
        const seen = new Set<string>();
        const models: string[] = [];
        const details: OllamaModelInfo[] = [];

        for (const item of v1Data.data) {
          const id = typeof item?.id === 'string' ? item.id.trim() : '';
          if (!id || seen.has(id)) continue;
          seen.add(id);
          models.push(id);
          details.push({ name: id });
        }

        clearAiErrorBanner();
        return { baseUrl, models, details, endpointUsed: '/v1/models' };
      }

      v1FallbackNote = 'HTTP 200 without OpenAI data[] list';
    } else if (v1Res.status === 401 || v1Res.status === 403) {
      const bodyText = await v1Res.text().catch(() => '');
      const statusLabel = `HTTP ${v1Res.status}${v1Res.statusText ? ` ${v1Res.statusText}` : ''}`;
      const err = new OllamaClientError(
        v1Res.status === 403
          ? `GET ${baseUrl}/v1/models failed (${statusLabel}). Check OLLAMA_ORIGINS="*" or gateway CORS/API key settings.${bodyText ? ` Response: ${bodyText.slice(0, 140)}` : ''}`
          : `GET ${baseUrl}/v1/models failed (${statusLabel}). Verify your API key / Bearer token.${bodyText ? ` Response: ${bodyText.slice(0, 140)}` : ''}`,
        {
          isCorsOrNetwork: true,
          guidance: buildOllamaCorsGuidance(baseUrl),
          statusCode: v1Res.status,
        }
      );
      reportAiErrorBanner({
        provider: 'ollama',
        title: `Model discovery failed (${statusLabel})`,
        message: err.message,
        guidance: err.guidance,
        baseUrl,
        isCorsOrNetwork: true,
      });
      throw err;
    } else {
      v1FallbackNote = `HTTP ${v1Res.status}${v1Res.statusText ? ` ${v1Res.statusText}` : ''}`;
    }

    // 2. Fallback to raw Ollama GET {baseUrl}/api/tags
    const tagsRes = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (!tagsRes.ok) {
      const bodyText = await tagsRes.text().catch(() => '');
      const statusLabel = `HTTP ${tagsRes.status}${tagsRes.statusText ? ` ${tagsRes.statusText}` : ''}`;
      const isCorsOrAuth = tagsRes.status === 403 || tagsRes.status === 401;
      const err = new OllamaClientError(
        `Model discovery failed: GET ${baseUrl}/api/tags returned ${statusLabel}${v1FallbackNote ? ` (/v1/models returned ${v1FallbackNote})` : ''}${bodyText ? ` — ${bodyText.slice(0, 140)}` : ''}.`,
        {
          isCorsOrNetwork: isCorsOrAuth,
          guidance: buildOllamaCorsGuidance(baseUrl),
          statusCode: tagsRes.status,
        }
      );
      reportAiErrorBanner({
        provider: 'ollama',
        title: `Model discovery failed (${statusLabel})`,
        message: err.message,
        guidance: err.guidance,
        baseUrl,
        isCorsOrNetwork: isCorsOrAuth,
      });
      throw err;
    }

    const data = (await tagsRes.json().catch(() => ({}))) as {
      models?: Array<{
        name?: string;
        size?: number;
        modified_at?: string;
        details?: { parameter_size?: string; quantization_level?: string };
      }>;
    };

    const rawModels = Array.isArray(data.models) ? data.models : [];
    const seen = new Set<string>();
    const models: string[] = [];
    const details: OllamaModelInfo[] = [];

    for (const item of rawModels) {
      const name = typeof item?.name === 'string' ? item.name.trim() : '';
      if (!name || seen.has(name)) continue;
      seen.add(name);
      models.push(name);
      details.push({
        name,
        size: typeof item.size === 'number' ? item.size : undefined,
        parameterSize: item.details?.parameter_size,
        quantization: item.details?.quantization_level,
        modifiedAt: item.modified_at,
      });
    }

    clearAiErrorBanner();
    return { baseUrl, models, details, endpointUsed: '/api/tags' };
  } catch (err) {
    const classified = classifyOllamaError(err, baseUrl);
    if (!classified.statusCode) {
      reportAiErrorBanner({
        provider: 'ollama',
        title: 'Cannot reach Ollama / AI gateway',
        message: classified.message,
        guidance: classified.guidance,
        baseUrl,
        isCorsOrNetwork: classified.isCorsOrNetwork,
      });
    }
    throw classified;
  } finally {
    clearTimeout(timer);
  }
}

export async function ollamaChatCompletion(params: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: OllamaChatMessage[];
  temperature?: number;
  taskLabel?: string;
  onToken?: (token: string, accumulated: string) => void;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{ content: string; usedFallback: boolean }> {
  const baseUrl = validateOllamaBaseUrl(params.baseUrl);
  const model = (params.model || '').trim();
  if (!model) {
    throw new OllamaClientError(
      'No Ollama model selected. Open AI Connection Settings and click "Test Connection & Refresh Models".',
      {
        isCorsOrNetwork: false,
        guidance: 'Select an installed model (such as gemma4) in Connection Settings.',
      }
    );
  }

  const endpoint = `${baseUrl}/v1/chat/completions`;
  const headers = buildOllamaHeaders(params.apiKey, true);
  const timeoutMs = params.timeoutMs ?? 120000;

  const runNonStreaming = async (): Promise<string> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: params.messages,
          stream: false,
          ...(typeof params.temperature === 'number' ? { temperature: params.temperature } : {}),
        }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as {
        choices?: Array<{ message?: { content?: string }; text?: string }>;
        message?: { content?: string };
        error?: { message?: string } | string;
      };

      if (!res.ok) {
        const detail =
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || '';
        const msg = detail
          ? `HTTP ${res.status}: ${detail}`
          : `Server returned HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
        const isCors = res.status === 403 || res.status === 401;
        const err = new OllamaClientError(msg, {
          isCorsOrNetwork: isCors,
          guidance: buildOllamaCorsGuidance(baseUrl),
          statusCode: res.status,
        });
        reportAiErrorBanner({
          provider: 'ollama',
          title: `Chat request failed (HTTP ${res.status})`,
          message: err.message,
          guidance: err.guidance,
          baseUrl,
          isCorsOrNetwork: isCors,
        });
        throw err;
      }

      const content =
        data.choices?.[0]?.message?.content ??
        data.choices?.[0]?.text ??
        data.message?.content ??
        '';

      clearAiErrorBanner();
      updateAiLiveStream({
        active: true,
        taskLabel: params.taskLabel || 'Ollama Inference',
        provider: 'ollama',
        model,
        tokensText: content,
        usedFallback: true,
      });
      if (content) {
        params.onToken?.(content, content);
      }
      return content;
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onAbort);
    }
  };

  updateAiLiveStream({
    active: true,
    taskLabel: params.taskLabel || 'Ollama Inference',
    provider: 'ollama',
    model,
    tokensText: '',
    usedFallback: false,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  params.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: params.messages,
        stream: true,
        ...(typeof params.temperature === 'number' ? { temperature: params.temperature } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        const errText = await res.text().catch(() => '');
        const authErr = new OllamaClientError(
          res.status === 403
            ? `Ollama rejected the request (HTTP 403). Check OLLAMA_ORIGINS="*" or your API key.`
            : `Ollama authentication failed (HTTP 401). ${errText.slice(0, 120)}`,
          {
            isCorsOrNetwork: true,
            guidance: buildOllamaCorsGuidance(baseUrl),
            statusCode: res.status,
          }
        );
        reportAiErrorBanner({
          provider: 'ollama',
          title: 'Ollama connection blocked',
          message: authErr.message,
          guidance: authErr.guidance,
          baseUrl,
          isCorsOrNetwork: true,
        });
        throw authErr;
      }

      // Some proxies or configurations fail only on streaming; attempt non-streaming fallback
      const fallbackText = await runNonStreaming();
      return { content: fallbackText, usedFallback: true };
    }

    if (!res.body) {
      const fallbackText = await runNonStreaming();
      return { content: fallbackText, usedFallback: true };
    }

    clearAiErrorBanner();
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';
    let streamDone = false;

    try {
      while (!streamDone) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const parsed = parseSseLine(line);
          if (parsed.token) {
            accumulated += parsed.token;
            params.onToken?.(parsed.token, accumulated);
            updateAiLiveStream({
              active: true,
              taskLabel: params.taskLabel || 'Ollama Inference',
              provider: 'ollama',
              model,
              tokensText: accumulated,
              usedFallback: false,
            });
          }
          if (parsed.done) {
            streamDone = true;
            break;
          }
        }
      }

      buffer += decoder.decode();
      if (buffer.trim() && !streamDone) {
        const tail = parseSseLine(buffer);
        if (tail.token) {
          accumulated += tail.token;
          params.onToken?.(tail.token, accumulated);
          updateAiLiveStream({
            active: true,
            taskLabel: params.taskLabel || 'Ollama Inference',
            provider: 'ollama',
            model,
            tokensText: accumulated,
            usedFallback: false,
          });
        }
      }

      if (!accumulated.trim()) {
        const fallbackText = await runNonStreaming();
        return { content: fallbackText, usedFallback: true };
      }

      return { content: accumulated, usedFallback: false };
    } catch (streamErr) {
      if (params.signal?.aborted) throw streamErr;
      if (accumulated.trim().length > 0) {
        return { content: accumulated, usedFallback: false };
      }
      const fallbackText = await runNonStreaming();
      return { content: fallbackText, usedFallback: true };
    } finally {
      reader.releaseLock();
    }
  } catch (err) {
    const classified = classifyOllamaError(err, baseUrl);
    if (!classified.statusCode) {
      reportAiErrorBanner({
        provider: 'ollama',
        title: 'Cannot reach Ollama / AI gateway',
        message: classified.message,
        guidance: classified.guidance,
        baseUrl,
        isCorsOrNetwork: classified.isCorsOrNetwork,
      });
    }
    throw classified;
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', onAbort);
    updateAiLiveStream({ active: false });
  }
}

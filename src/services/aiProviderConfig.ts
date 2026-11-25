import { getProviderDef, ProviderKind } from './aiProviderRegistry';

export type AiProviderType = 'gemini' | 'ollama' | 'openai' | 'openrouter' | 'anthropic' | 'custom';

export interface AiProviderConfig {
  provider: AiProviderType;
  ollamaBaseUrl: string;
  ollamaApiKey: string;
  ollamaModel: string;
  availableOllamaModels: string[];
}

export interface AiConnectivityBannerState {
  id: string;
  provider: AiProviderType;
  title: string;
  message: string;
  guidance: string;
  baseUrl?: string;
  isCorsOrNetwork: boolean;
  timestamp: string;
}

export interface AiLiveStreamState {
  active: boolean;
  taskLabel: string;
  provider: AiProviderType;
  model: string;
  tokensText: string;
  usedFallback: boolean;
}

export const AI_PROVIDER_STORAGE_KEY = 'career_engine_ai_provider_v1';
export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

export function normalizeOllamaBaseUrl(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return DEFAULT_OLLAMA_BASE_URL;
  return trimmed.replace(/\/+$/, '');
}

const DEFAULT_AI_PROVIDER_CONFIG: AiProviderConfig = {
  provider: 'gemini',
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
  ollamaApiKey: '',
  ollamaModel: '',
  availableOllamaModels: [],
};

function sanitizeConfig(raw: Partial<AiProviderConfig> | null | undefined): AiProviderConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AI_PROVIDER_CONFIG };
  }
  const provider = (raw.provider && ['gemini', 'ollama', 'openai', 'openrouter', 'anthropic', 'custom'].includes(raw.provider)
    ? raw.provider
    : 'gemini') as AiProviderType;

  const def = getProviderDef(provider);
  const ollamaBaseUrl = normalizeOllamaBaseUrl(
    typeof raw.ollamaBaseUrl === 'string' && raw.ollamaBaseUrl.trim()
      ? raw.ollamaBaseUrl
      : def.defaultBaseUrl || DEFAULT_OLLAMA_BASE_URL
  );
  const ollamaApiKey = typeof raw.ollamaApiKey === 'string' ? raw.ollamaApiKey : '';
  const availableOllamaModels = Array.isArray(raw.availableOllamaModels)
    ? Array.from(
        new Set(
          raw.availableOllamaModels
            .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
            .map((m) => m.trim())
        )
      )
    : [];
  const ollamaModel = typeof raw.ollamaModel === 'string' && raw.ollamaModel.trim()
    ? raw.ollamaModel.trim()
    : def.defaultModel;

  return {
    provider,
    ollamaBaseUrl,
    ollamaApiKey,
    ollamaModel,
    availableOllamaModels,
  };
}

export function loadAiProviderConfig(): AiProviderConfig {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_AI_PROVIDER_CONFIG };
    }
    const raw = localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_PROVIDER_CONFIG };
    return sanitizeConfig(JSON.parse(raw) as Partial<AiProviderConfig>);
  } catch {
    return { ...DEFAULT_AI_PROVIDER_CONFIG };
  }
}

let currentConfig: AiProviderConfig = loadAiProviderConfig();
let currentBanner: AiConnectivityBannerState | null = null;
let currentLiveStream: AiLiveStreamState = {
  active: false,
  taskLabel: '',
  provider: currentConfig.provider,
  model: currentConfig.provider === 'gemini' ? DEFAULT_GEMINI_MODEL : currentConfig.ollamaModel,
  tokensText: '',
  usedFallback: false,
};

const configListeners = new Set<(cfg: AiProviderConfig) => void>();
const bannerListeners = new Set<(banner: AiConnectivityBannerState | null) => void>();
const streamListeners = new Set<(stream: AiLiveStreamState) => void>();

export function getAiProviderConfig(): AiProviderConfig {
  return currentConfig;
}

export function saveAiProviderConfig(next: Partial<AiProviderConfig>): AiProviderConfig {
  const merged = { ...currentConfig, ...next };
  // If provider changed, auto-fill default base url and model if not explicitly provided
  if (next.provider && next.provider !== currentConfig.provider) {
    const def = getProviderDef(next.provider);
    if (!next.ollamaBaseUrl && def.defaultBaseUrl) {
      merged.ollamaBaseUrl = def.defaultBaseUrl;
    }
    if (!next.ollamaModel && def.defaultModel) {
      merged.ollamaModel = def.defaultModel;
    }
  }
  currentConfig = sanitizeConfig(merged);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AI_PROVIDER_STORAGE_KEY, JSON.stringify(currentConfig));
    }
  } catch {
    // Ignore storage quota errors
  }
  configListeners.forEach((fn) => fn(currentConfig));
  return currentConfig;
}

export function subscribeAiProviderConfig(listener: (cfg: AiProviderConfig) => void): () => void {
  configListeners.add(listener);
  return () => {
    configListeners.delete(listener);
  };
}

export function getAiErrorBanner(): AiConnectivityBannerState | null {
  return currentBanner;
}

export function reportAiErrorBanner(
  payload: Omit<AiConnectivityBannerState, 'id' | 'timestamp'>
): AiConnectivityBannerState {
  currentBanner = {
    ...payload,
    id: `ai-err-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
  };
  bannerListeners.forEach((fn) => fn(currentBanner));
  return currentBanner;
}

export function clearAiErrorBanner(): void {
  if (!currentBanner) return;
  currentBanner = null;
  bannerListeners.forEach((fn) => fn(null));
}

export function subscribeAiErrorBanner(
  listener: (banner: AiConnectivityBannerState | null) => void
): () => void {
  bannerListeners.add(listener);
  return () => {
    bannerListeners.delete(listener);
  };
}

export function getAiLiveStream(): AiLiveStreamState {
  return currentLiveStream;
}

export function updateAiLiveStream(patch: Partial<AiLiveStreamState>): void {
  currentLiveStream = { ...currentLiveStream, ...patch };
  streamListeners.forEach((fn) => fn(currentLiveStream));
}

export function resetAiLiveStream(): void {
  currentLiveStream = {
    active: false,
    taskLabel: '',
    provider: currentConfig.provider,
    model: currentConfig.provider === 'gemini' ? DEFAULT_GEMINI_MODEL : currentConfig.ollamaModel,
    tokensText: '',
    usedFallback: false,
  };
  streamListeners.forEach((fn) => fn(currentLiveStream));
}

export function subscribeAiLiveStream(listener: (stream: AiLiveStreamState) => void): () => void {
  streamListeners.add(listener);
  return () => {
    streamListeners.delete(listener);
  };
}

export function formatHeaderProviderLabel(config: AiProviderConfig): {
  providerName: string;
  modelName: string;
  fullLabel: string;
} {
  const def = getProviderDef(config.provider);
  const modelName = config.ollamaModel.trim() || def.defaultModel || 'No model';
  return {
    providerName: def.name,
    modelName,
    fullLabel: `${def.name.split(' ')[0]} • ${modelName}`,
  };
}

export type AiProviderType = 'gemini' | 'ollama';

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
  const provider: AiProviderType = raw.provider === 'ollama' ? 'ollama' : 'gemini';
  const ollamaBaseUrl = normalizeOllamaBaseUrl(
    typeof raw.ollamaBaseUrl === 'string' ? raw.ollamaBaseUrl : DEFAULT_OLLAMA_BASE_URL
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
  const ollamaModel = typeof raw.ollamaModel === 'string' ? raw.ollamaModel.trim() : '';

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
  model: currentConfig.provider === 'ollama' ? currentConfig.ollamaModel : DEFAULT_GEMINI_MODEL,
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
  currentConfig = sanitizeConfig({ ...currentConfig, ...next });
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
    model: currentConfig.provider === 'ollama' ? currentConfig.ollamaModel : DEFAULT_GEMINI_MODEL,
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
  if (config.provider === 'ollama') {
    const modelName = config.ollamaModel.trim() || 'No model';
    return {
      providerName: 'Ollama',
      modelName,
      fullLabel: `Ollama • ${modelName}`,
    };
  }
  return {
    providerName: 'Gemini',
    modelName: DEFAULT_GEMINI_MODEL,
    fullLabel: `Gemini • ${DEFAULT_GEMINI_MODEL}`,
  };
}

export type ProviderKind = 'gemini' | 'openai-compatible' | 'anthropic';

export interface ProviderDefinition {
  id: string;
  name: string;
  kind: ProviderKind;
  defaultBaseUrl: string;
  defaultModel: string;
  needsApiKey: boolean;
  description: string;
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'gemini',
    name: 'Gemini (Cloud)',
    kind: 'gemini',
    defaultBaseUrl: '',
    defaultModel: 'gemini-4-hydrogen',
    needsApiKey: false,
    description: 'Server-managed Gemini 4 Hydrogen with search grounding.',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local / Custom)',
    kind: 'openai-compatible',
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    needsApiKey: false,
    description: 'Local Ollama server or Cloudflare tunnel via /v1/chat/completions.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o-mini',
    needsApiKey: true,
    description: 'Official OpenAI API (GPT-4o-mini, GPT-4o). Server key used securely.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai-compatible',
    defaultBaseUrl: 'https://openrouter.ai/api',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    needsApiKey: true,
    description: 'Unified OpenRouter gateway for leading open and proprietary models.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    kind: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    needsApiKey: true,
    description: 'Direct Anthropic Messages API.',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI Compatible',
    kind: 'openai-compatible',
    defaultBaseUrl: 'http://localhost:8000',
    defaultModel: 'default-model',
    needsApiKey: true,
    description: 'Custom vLLM, LM Studio, TGI, or local OpenAI-compatible endpoint.',
  },
];

export function getProviderDef(id: string): ProviderDefinition {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
}

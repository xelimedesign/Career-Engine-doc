import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Send,
  Server,
  X,
} from 'lucide-react';
import {
  AiProviderConfig,
  AiProviderType,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  getAiProviderConfig,
  normalizeOllamaBaseUrl,
  saveAiProviderConfig,
  subscribeAiProviderConfig,
} from '../services/aiProviderConfig';
import {
  fetchOllamaModels,
  ollamaChatCompletion,
  OllamaClientError,
  OllamaModelInfo,
} from '../services/ollamaClient';

export interface AiProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiProviderModal({ isOpen, onClose }: AiProviderModalProps) {
  const [config, setConfig] = useState<AiProviderConfig>(() => getAiProviderConfig());
  const [baseUrlInput, setBaseUrlInput] = useState<string>(config.ollamaBaseUrl);
  const [apiKeyInput, setApiKeyInput] = useState<string>(config.ollamaApiKey);
  const [selectedModel, setSelectedModel] = useState<string>(config.ollamaModel);
  const [showApiKey, setShowApiKey] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testSuccessMsg, setTestSuccessMsg] = useState<string | null>(null);
  const [testError, setTestError] = useState<{
    message: string;
    guidance: string;
    isCorsOrNetwork: boolean;
  } | null>(null);
  const [modelDetails, setModelDetails] = useState<OllamaModelInfo[]>([]);

  const [geminiHealth, setGeminiHealth] = useState<{
    checked: boolean;
    configured: boolean;
    error?: string;
  }>({ checked: false, configured: true });

  // Interactive SSE Streaming Test Prompt
  const [testPrompt, setTestPrompt] = useState('Say hello in one short sentence.');
  const [streamingReply, setStreamingReply] = useState('');
  const [streamingBusy, setStreamingBusy] = useState(false);
  const [streamingUsedFallback, setStreamingUsedFallback] = useState(false);

  useEffect(() => {
    return subscribeAiProviderConfig((next) => {
      setConfig(next);
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const latest = getAiProviderConfig();
    setConfig(latest);
    setBaseUrlInput(latest.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL);
    setApiKeyInput(latest.ollamaApiKey || '');
    setSelectedModel(latest.ollamaModel || latest.availableOllamaModels[0] || '');
    setTestError(null);
    setTestSuccessMsg(null);

    let cancelled = false;
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: { ok?: boolean; aiConfigured?: boolean }) => {
        if (!cancelled) {
          setGeminiHealth({
            checked: true,
            configured: Boolean(data?.aiConfigured),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGeminiHealth({
            checked: true,
            configured: false,
            error: 'Unable to check server health.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const persistCurrentFields = (overrides?: Partial<AiProviderConfig>) => {
    const cleanUrl = normalizeOllamaBaseUrl(baseUrlInput);
    setBaseUrlInput(cleanUrl);
    const saved = saveAiProviderConfig({
      provider: config.provider,
      ollamaBaseUrl: cleanUrl,
      ollamaApiKey: apiKeyInput,
      ollamaModel: selectedModel.trim(),
      availableOllamaModels: config.availableOllamaModels,
      ...overrides,
    });
    setConfig(saved);
    return saved;
  };

  const handleSelectProvider = (provider: AiProviderType) => {
    setTestError(null);
    setTestSuccessMsg(null);
    persistCurrentFields({ provider });
  };

  const handleTestConnection = async () => {
    const cleanUrl = normalizeOllamaBaseUrl(baseUrlInput);
    setBaseUrlInput(cleanUrl);
    setTesting(true);
    setTestError(null);
    setTestSuccessMsg(null);

    try {
      const result = await fetchOllamaModels({
        baseUrl: cleanUrl,
        apiKey: apiKeyInput,
      });

      const nextModel =
        selectedModel && result.models.includes(selectedModel)
          ? selectedModel
          : result.models[0] || selectedModel || '';

      setSelectedModel(nextModel);
      setModelDetails(result.details);

      const saved = saveAiProviderConfig({
        provider: config.provider,
        ollamaBaseUrl: result.baseUrl,
        ollamaApiKey: apiKeyInput,
        ollamaModel: nextModel,
        availableOllamaModels: result.models,
      });
      setConfig(saved);

      setTestSuccessMsg(
        result.models.length > 0
          ? `Connected to ${result.baseUrl} (${result.endpointUsed}) — found ${result.models.length} model${result.models.length === 1 ? '' : 's'}.`
          : `Connected to ${result.baseUrl} (${result.endpointUsed}), but no models were returned. Type any model name manually below.`
      );
    } catch (err) {
      if (err instanceof OllamaClientError) {
        setTestError({
          message: err.message,
          guidance: err.guidance,
          isCorsOrNetwork: err.isCorsOrNetwork,
        });
      } else {
        setTestError({
          message: err instanceof Error ? err.message : 'Connection failed.',
          guidance: 'Verify the Base URL, API key, and CORS configuration.',
          isCorsOrNetwork: false,
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestStream = async (e: React.FormEvent) => {
    e.preventDefault();
    const promptText = testPrompt.trim();
    if (!promptText) return;

    const current = persistCurrentFields();
    setStreamingBusy(true);
    setStreamingReply('');
    setStreamingUsedFallback(false);
    setTestError(null);

    try {
      const result = await ollamaChatCompletion({
        baseUrl: current.ollamaBaseUrl,
        apiKey: current.ollamaApiKey,
        model: current.ollamaModel,
        taskLabel: 'Connection Test Chat',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Reply concisely in plain text.',
          },
          { role: 'user', content: promptText },
        ],
        onToken: (_token, accumulated) => {
          setStreamingReply(accumulated);
        },
      });
      setStreamingReply(result.content);
      setStreamingUsedFallback(result.usedFallback);
    } catch (err) {
      if (err instanceof OllamaClientError) {
        setTestError({
          message: err.message,
          guidance: err.guidance,
          isCorsOrNetwork: err.isCorsOrNetwork,
        });
      } else {
        setTestError({
          message: err instanceof Error ? err.message : 'Streaming test failed.',
          guidance: '',
          isCorsOrNetwork: false,
        });
      }
    } finally {
      setStreamingBusy(false);
    }
  };

  const handleSaveAndClose = () => {
    persistCurrentFields();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-provider-modal-title"
        className="w-full max-w-2xl max-h-[90vh] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-900"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2
              id="ai-provider-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              AI Model Provider & Connection
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose between cloud Gemini or a local/tunneled Ollama server. Settings persist in browser storage.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close connection settings"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Provider Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Model Provider
            </label>
            <div
              role="radiogroup"
              aria-label="Model Provider"
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={config.provider === 'gemini'}
                onClick={() => handleSelectProvider('gemini')}
                className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer flex items-start gap-3 ${
                  config.provider === 'gemini'
                    ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <Cloud
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    config.provider === 'gemini' ? 'text-slate-900' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    Gemini (Cloud)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Server-managed {DEFAULT_GEMINI_MODEL} with search grounding.
                  </div>
                </div>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={config.provider === 'ollama'}
                onClick={() => handleSelectProvider('ollama')}
                className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer flex items-start gap-3 ${
                  config.provider === 'ollama'
                    ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <Server
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    config.provider === 'ollama' ? 'text-slate-900' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    Ollama (Custom / Local)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Localhost or HTTPS Cloudflare Tunnel via /v1/chat/completions.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {config.provider === 'gemini' ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  Active Model: {DEFAULT_GEMINI_MODEL}
                </span>
                {geminiHealth.checked && (
                  <span
                    className={`text-xs font-medium ${
                      geminiHealth.configured ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {geminiHealth.configured
                      ? 'Server API key configured'
                      : geminiHealth.error || 'Server API key missing'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                All AI actions (Resume Builder, Cover Letter Maker, Job Analysis, Company Research, Review Center, AI Writing Companion, and Sticky Note tasks) route securely through the backend Gemini API.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Base URL */}
              <div>
                <label
                  htmlFor="ollama-base-url"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Ollama Base URL
                </label>
                <input
                  id="ollama-base-url"
                  type="url"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  onBlur={() => {
                    const clean = normalizeOllamaBaseUrl(baseUrlInput);
                    setBaseUrlInput(clean);
                    saveAiProviderConfig({ ollamaBaseUrl: clean });
                  }}
                  placeholder="http://localhost:11434 or https://ollama.yourdomain.com"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
                <p className="text-[11.5px] text-slate-500 mt-1">
                  Trailing slashes are removed automatically. Use an HTTPS Cloudflare Tunnel URL when accessing this app over HTTPS.
                </p>
              </div>

              {/* Optional API Key / Auth Header */}
              <div>
                <label
                  htmlFor="ollama-api-key"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Optional API Key / Auth Header
                </label>
                <div className="relative">
                  <input
                    id="ollama-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setApiKeyInput(val);
                      saveAiProviderConfig({ ollamaApiKey: val });
                    }}
                    placeholder="Leave blank for unauthenticated local Ollama"
                    autoComplete="off"
                    className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((prev) => !prev)}
                    aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-1">
                  If provided, requests include{' '}
                  <code className="font-mono text-slate-700">Authorization: Bearer &lt;key&gt;</code>. Leave blank to omit the header.
                </p>
              </div>

              {/* Test Connection & Model Selector */}
              <div className="pt-1 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={testing}
                    onClick={() => void handleTestConnection()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {testing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Test Connection & Refresh Models</span>
                  </button>

                  <span className="text-xs text-slate-500 font-mono truncate">
                    GET {normalizeOllamaBaseUrl(baseUrlInput)}/v1/models (fallback: /api/tags)
                  </span>
                </div>

                {testSuccessMsg && (
                  <div
                    role="status"
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-emerald-900"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>{testSuccessMsg}</span>
                  </div>
                )}

                {testError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 space-y-1.5 text-xs text-rose-900"
                  >
                    <div className="flex items-start gap-2 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                      <span>{testError.message}</span>
                    </div>
                    {testError.guidance && (
                      <p className="text-rose-800 pl-6 leading-relaxed">
                        {testError.guidance}
                      </p>
                    )}
                  </div>
                )}

                {/* Model Input + Discovered Models Dropdown */}
                <div className="space-y-2">
                  <label
                    htmlFor="ollama-model-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Installed Ollama Model
                  </label>

                  {config.availableOllamaModels.length > 0 && (
                    <select
                      aria-label="Discovered models"
                      value={
                        config.availableOllamaModels.includes(selectedModel)
                          ? selectedModel
                          : ''
                      }
                      onChange={(e) => {
                        const model = e.target.value;
                        if (!model) return;
                        setSelectedModel(model);
                        saveAiProviderConfig({ ollamaModel: model });
                      }}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                    >
                      <option value="">
                        Select a discovered model ({config.availableOllamaModels.length}) or type below...
                      </option>
                      {config.availableOllamaModels.map((modelName) => {
                        const info = modelDetails.find((d) => d.name === modelName);
                        const meta = info?.parameterSize
                          ? ` (${info.parameterSize}${info.quantization ? ` · ${info.quantization}` : ''})`
                          : '';
                        return (
                          <option key={modelName} value={modelName}>
                            {modelName}
                            {meta}
                          </option>
                        );
                      })}
                    </select>
                  )}

                  <input
                    id="ollama-model-select"
                    type="text"
                    value={selectedModel}
                    onChange={(e) => {
                      const model = e.target.value;
                      setSelectedModel(model);
                      saveAiProviderConfig({ ollamaModel: model });
                    }}
                    placeholder="Enter model name (e.g. gemma4, llama3.2, gpt-4o)"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                  <p className="text-[11.5px] text-slate-500">
                    Type any model name manually at any time, even if model discovery returns empty.
                  </p>
                </div>
              </div>

              {/* Interactive Streaming Chat Test */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Streaming Chat Test (SSE)
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    POST /v1/chat/completions
                  </span>
                </div>
                <form onSubmit={handleSendTestStream} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder="Send a test prompt to verify real-time token streaming..."
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={streamingBusy || !selectedModel.trim()}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                  >
                    {streamingBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{streamingBusy ? 'Streaming...' : 'Stream Test'}</span>
                  </button>
                </form>

                {(streamingReply || streamingBusy) && (
                  <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>
                        Response from {selectedModel || 'Ollama'}
                      </span>
                      <span>
                        {streamingUsedFallback ? 'Non-streaming fallback' : streamingBusy ? 'Streaming tokens...' : 'SSE stream complete'}
                      </span>
                    </div>
                    <div>{streamingReply || 'Waiting for first token...'}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4 shrink-0">
          <span className="text-xs text-slate-500">
            Active:{' '}
            <strong className="font-semibold text-slate-800">
              {config.provider === 'ollama'
                ? `Ollama • ${selectedModel.trim() || 'No model'}`
                : `Gemini • ${DEFAULT_GEMINI_MODEL}`}
            </strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

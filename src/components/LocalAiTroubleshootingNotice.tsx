import { useState } from 'react';
import { Check, Copy, ExternalLink, ShieldAlert } from 'lucide-react';

const LOCAL_AI_RUNTIMES = [
  {
    id: 'ollama',
    name: 'Ollama',
    url: 'https://ollama.com',
    displayUrl: 'ollama.com',
    searchQuery: 'how to set up Ollama local server and allow browser connections',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    url: 'https://lmstudio.ai',
    displayUrl: 'lmstudio.ai',
    searchQuery: 'how to set up LM Studio local server and allow CORS connections',
  },
] as const;

interface LocalAiTroubleshootingNoticeProps {
  compact?: boolean;
}

export function LocalAiTroubleshootingNotice({
  compact = false,
}: LocalAiTroubleshootingNoticeProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2000);
    } catch {
      // Clipboard API may be unavailable; input remains directly selectable
    }
  };

  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50/60 ${
        compact ? 'p-3.5 space-y-2.5' : 'p-4 space-y-3'
      } text-slate-800`}
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert
          className="w-4 h-4 text-amber-700 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="space-y-1.5 min-w-0">
          <h4 className="text-xs font-semibold text-slate-900">
            AI Model Guidance &amp; Local Setup Troubleshooting (Ollama / LM Studio)
          </h4>
          <p className="text-xs text-slate-700 leading-relaxed">
            <strong className="font-semibold text-slate-900">Gemini</strong> generally gives a better answer — offering stronger reasoning, richer synthesis, and more reliable detail than smaller local models — while{' '}
            <strong className="font-semibold text-slate-900">Ollama</strong> and{' '}
            <strong className="font-semibold text-slate-900">LM Studio</strong> remain available when you prefer local or offline setups.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Connections to local AI runtimes such as{' '}
            <strong className="font-semibold text-slate-800">Ollama</strong> and{' '}
            <strong className="font-semibold text-slate-800">LM Studio</strong>{' '}
            can sometimes get blocked by browser security or network checks (such as Local Network Access checks, CORS/origin rules, or local firewall and port settings) or fail if the local server is not running yet. You or a teammate may need to change browser permissions/flags or local server settings to allow local connections.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 pt-1">
        {LOCAL_AI_RUNTIMES.map((runtime) => {
          const isCopied = copiedId === runtime.id;
          return (
            <div
              key={runtime.id}
              className="rounded-md border border-slate-200 bg-white p-2.5 space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  {runtime.name}
                </span>
                <a
                  href={runtime.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-950 underline underline-offset-2"
                >
                  <span>{runtime.url}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                </a>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  aria-label={`${runtime.name} setup search query`}
                  value={runtime.searchQuery}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 text-[11.5px] font-mono text-slate-800 select-all focus:outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={() => void handleCopy(runtime.id, runtime.searchQuery)}
                  title={`Copy ${runtime.name} search text`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[11.5px] font-medium text-slate-700 hover:text-slate-900 transition-colors shrink-0 cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-500" aria-hidden="true" />
                      <span>Copy search</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

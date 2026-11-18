import React from 'react';
import { Check, X, AlertCircle } from 'lucide-react';

interface AiDiffModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  rationale?: string;
  warnings?: string[];
  notes?: string[];
  children: React.ReactNode;
  onApply: () => void;
  onDiscard: () => void;
  applyLabel?: string;
}

export function AiDiffModal({
  isOpen,
  title,
  subtitle,
  rationale,
  warnings = [],
  notes = [],
  children,
  onApply,
  onDiscard,
  applyLabel = 'Apply Changes',
}: AiDiffModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onDiscard}
            aria-label="Close review modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm">
          {rationale && (
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs leading-relaxed">
              <span className="font-semibold text-slate-900">Editorial Note: </span>
              {rationale}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <AlertCircle className="w-3.5 h-3.5" />
                Missing or Incomplete Information
              </div>
              <ul className="list-disc pl-5 text-xs text-amber-800 space-y-1">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {notes.length > 0 && (
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-semibold text-slate-900">Alignment & Grounding Notes</div>
              <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                {notes.map((n, idx) => (
                  <li key={idx}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          {children}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onApply}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            {applyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

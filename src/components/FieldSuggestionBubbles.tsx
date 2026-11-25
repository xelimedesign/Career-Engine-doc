import React, { useState } from 'react';
import { Sparkles, RefreshCw, X, Check } from 'lucide-react';

export interface SuggestionItem {
  id: string;
  label: string;
  value: string;
  mode: 'replace' | 'append' | 'ai-rewrite';
}

interface FieldSuggestionBubblesProps {
  suggestions: SuggestionItem[];
  onSelect: (value: string, mode: 'replace' | 'append' | 'ai-rewrite') => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function FieldSuggestionBubbles({
  suggestions,
  onSelect,
  onRefresh,
  isLoading = false,
  className = '',
}: FieldSuggestionBubblesProps) {
  const [activeRewriteItem, setActiveRewriteItem] = useState<SuggestionItem | null>(null);
  const [rewritePreview, setRewritePreview] = useState<string>('');

  if ((!suggestions || suggestions.length === 0) && !isLoading) return null;

  return (
    <div className={`space-y-2 mt-1.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {suggestions.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.mode === 'ai-rewrite') {
                setActiveRewriteItem(item);
                setRewritePreview(item.value);
              } else {
                onSelect(item.value, item.mode);
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-full transition-colors cursor-pointer"
          >
            {item.mode === 'ai-rewrite' && <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />}
            <span>{item.label}</span>
          </button>
        ))}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh suggestions"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {activeRewriteItem && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2 text-xs">
          <div className="flex items-center justify-between font-medium text-purple-900">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              AI Rewrite Preview: {activeRewriteItem.label}
            </span>
            <button
              type="button"
              onClick={() => setActiveRewriteItem(null)}
              className="text-purple-400 hover:text-purple-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-2 bg-white rounded border border-purple-100 text-slate-800 leading-relaxed">
            {rewritePreview}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveRewriteItem(null)}
              className="px-2.5 py-1 text-slate-600 hover:bg-purple-100 rounded transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => {
                onSelect(rewritePreview, 'replace');
                setActiveRewriteItem(null);
              }}
              className="inline-flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded transition-colors"
            >
              <Check className="w-3 h-3" />
              Accept
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

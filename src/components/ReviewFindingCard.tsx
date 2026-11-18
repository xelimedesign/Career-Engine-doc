import { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit3,
  Info,
  RefreshCw,
  X,
} from 'lucide-react';
import { ReviewFinding, ReviewSeverity } from '../types/career';

interface ReviewFindingCardProps {
  finding: ReviewFinding;
  selectedForBatch: boolean;
  onToggleBatchSelect: (findingId: string) => void;
  onAccept: (findingId: string) => void;
  onReject: (findingId: string) => void;
  onSaveEdit: (findingId: string, editedText: string) => void;
  onRegenerate: (finding: ReviewFinding) => Promise<void>;
  onApplySingle: (findingId: string) => void;
}

const SEVERITY_META: Record<
  ReviewSeverity,
  { label: string; textCls: string; Icon: typeof AlertOctagon }
> = {
  critical: { label: 'Critical', textCls: 'text-rose-800', Icon: AlertOctagon },
  high: { label: 'High', textCls: 'text-amber-800', Icon: AlertTriangle },
  medium: { label: 'Medium', textCls: 'text-slate-800', Icon: Info },
  low: { label: 'Low', textCls: 'text-slate-600', Icon: Info },
};

export function ReviewFindingCard({
  finding,
  selectedForBatch,
  onToggleBatchSelect,
  onAccept,
  onReject,
  onSaveEdit,
  onRegenerate,
  onApplySingle,
}: ReviewFindingCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    finding.editedCorrection ?? finding.recommendedCorrection
  );
  const [regenerating, setRegenerating] = useState(false);

  const sev = SEVERITY_META[finding.severity];
  const SevIcon = sev.Icon;
  const isApplicable =
    Boolean(finding.targetField) && finding.targetField?.kind !== 'advisory_only';
  const effectiveSuggestion = finding.editedCorrection ?? finding.recommendedCorrection;

  const handleRegenerateClick = async () => {
    setRegenerating(true);
    try {
      await onRegenerate(finding);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div
      className={`p-4 border rounded-lg space-y-3 transition-colors ${
        finding.status === 'rejected'
          ? 'bg-slate-50/70 border-slate-200 opacity-75'
          : finding.status === 'applied'
            ? 'bg-emerald-50/30 border-emerald-200'
            : 'bg-white border-slate-200'
      }`}
    >
      {/* Metadata Header (Zero-pill discipline) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isApplicable && finding.status !== 'applied' && finding.status !== 'rejected' && (
            <input
              type="checkbox"
              aria-label={`Select finding ${finding.id} for batch apply`}
              checked={selectedForBatch}
              onChange={() => onToggleBatchSelect(finding.id)}
              className="cursor-pointer"
            />
          )}
          <span className={`inline-flex items-center gap-1 font-semibold ${sev.textCls}`}>
            <SevIcon className="w-3.5 h-3.5 shrink-0" />
            {sev.label}
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="font-semibold text-slate-900">{finding.category}</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="text-slate-600">{finding.documentReference}</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="font-mono-tabular text-slate-400">{finding.id}</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-medium">
          <span className="text-slate-500 capitalize">Confidence: {finding.confidence}</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span
            className={
              finding.status === 'applied'
                ? 'text-emerald-800 font-semibold'
                : finding.status === 'accepted'
                  ? 'text-slate-900 font-semibold'
                  : finding.status === 'rejected'
                    ? 'text-slate-400'
                    : 'text-amber-800'
            }
          >
            {finding.status === 'applied'
              ? 'Applied to Document'
              : finding.status === 'accepted'
                ? 'Accepted (Pending Apply)'
                : finding.status === 'rejected'
                  ? 'Rejected'
                  : 'Open'}
          </span>
        </div>
      </div>

      {/* Explanation & Evidence */}
      <div className="space-y-1 text-xs">
        <p className="text-slate-800 leading-relaxed">{finding.explanation}</p>
        {finding.supportingEvidence && (
          <p className="text-[11px] text-slate-500">
            <strong>Supporting Evidence:</strong> {finding.supportingEvidence}
          </p>
        )}
      </div>

      {/* Original vs Recommended Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
          <div className="text-[11px] font-semibold text-slate-500">Original Text</div>
          <p className="text-slate-700 leading-relaxed whitespace-pre-line">
            {finding.originalText || '(No original snippet referenced)'}
          </p>
        </div>

        <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-md space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-900">
              {finding.editedCorrection ? 'Edited Recommendation' : 'Recommended Correction'}
            </span>
          </div>
          {editing ? (
            <div className="space-y-2">
              <textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-slate-900 leading-relaxed"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onSaveEdit(finding.id, draft);
                    setEditing(false);
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 rounded cursor-pointer"
                >
                  Save Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(effectiveSuggestion);
                    setEditing(false);
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-900 leading-relaxed whitespace-pre-line">
              {effectiveSuggestion}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      {finding.status !== 'applied' && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onAccept(finding.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border cursor-pointer whitespace-nowrap shrink-0 ${
                finding.status === 'accepted'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}
            >
              <Check className="w-3 h-3" />
              Accept
            </button>
            <button
              type="button"
              onClick={() => onReject(finding.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border cursor-pointer whitespace-nowrap shrink-0 ${
                finding.status === 'rejected'
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-rose-600'
              }`}
            >
              <X className="w-3 h-3" />
              Reject
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(effectiveSuggestion);
                setEditing(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-400 rounded cursor-pointer whitespace-nowrap shrink-0"
            >
              <Edit3 className="w-3 h-3" />
              Edit Suggestion
            </button>
            <button
              type="button"
              disabled={regenerating}
              onClick={handleRegenerateClick}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-400 rounded cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>

          {isApplicable ? (
            <button
              type="button"
              onClick={() => onApplySingle(finding.id)}
              className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded cursor-pointer whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="w-3 h-3" />
              Apply Change
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">
              Advisory finding — update source field manually
            </span>
          )}
        </div>
      )}
    </div>
  );
}

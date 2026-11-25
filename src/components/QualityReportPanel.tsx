import { CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { DocumentQualityReport } from '../types/career';
import { DOCUMENT_PROFILES } from '../services/standardsEngine';

interface QualityReportPanelProps {
  report: DocumentQualityReport;
  onOptimizeWithAi?: () => void;
  aiLoading?: boolean;
  optimizeLabel?: string;
}

export function QualityReportPanel({
  report,
  onOptimizeWithAi,
  aiLoading = false,
  optimizeLabel = 'Improve Weak Bullets & Writing with AI',
}: QualityReportPanelProps) {
  const profileMeta = DOCUMENT_PROFILES[report.documentProfile];

  const scoreTone =
    report.totalScore >= 85
      ? 'text-emerald-700'
      : report.totalScore >= 70
        ? 'text-amber-700'
        : 'text-rose-700';

  return (
    <div className="space-y-5">
      {/* Header Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">
              {report.documentKind === 'resume' ? 'Resume Quality Report' : 'Cover Letter Quality Report'} · {profileMeta.label}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold font-mono-tabular ${scoreTone}`}>
                {report.totalScore}
              </span>
              <span className="text-sm font-mono-tabular text-slate-400">/ {report.maxScore}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Career Doc Standards Model inspired by Harvard Career Services writing and formatting guidelines.
            </p>
          </div>

          {onOptimizeWithAi && (
            <button
              type="button"
              disabled={aiLoading}
              onClick={onOptimizeWithAi}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? 'Analyzing...' : optimizeLabel}
            </button>
          )}
        </div>

        {/* 7-Category Score Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
          {report.categories.map((cat) => {
            const pct = Math.round((cat.score / cat.maxScore) * 100);
            return (
              <div key={cat.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">{cat.label}</span>
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {cat.score}/{cat.maxScore}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      pct >= 85 ? 'bg-emerald-600' : pct >= 65 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Findings & Deductions */}
      <div className="space-y-3">
        {report.categories.map((cat) => (
          <div key={`detail-${cat.key}`} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="text-xs font-semibold text-slate-900">{cat.label}</h4>
                <div className="text-[11px] text-slate-400">{cat.component}</div>
              </div>
              <span className="text-xs font-mono-tabular font-semibold text-slate-800">
                {cat.score} / {cat.maxScore}
              </span>
            </div>

            {cat.deductions.map((ded, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs bg-amber-50/50 border border-amber-200/80 rounded-md p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-medium text-slate-900">
                    {ded.reason}{' '}
                    <span className="font-mono-tabular text-amber-800">(-{ded.pointsDeducted} pts)</span>
                  </div>
                  <div className="text-slate-600">{ded.recommendation}</div>
                </div>
              </div>
            ))}

            {cat.checksPassed.map((pass, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{pass}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

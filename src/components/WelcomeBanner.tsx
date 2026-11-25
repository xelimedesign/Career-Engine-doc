import { BookOpen, X } from 'lucide-react';

interface WelcomeBannerProps {
  onGoToProfile: () => void;
  onOpenStickyNotes: () => void;
  onGoToBuilder: () => void;
  onOpenQuickGuide: () => void;
  onDismiss: () => void;
}

export function WelcomeBanner({
  onGoToProfile,
  onOpenStickyNotes,
  onGoToBuilder,
  onOpenQuickGuide,
  onDismiss,
}: WelcomeBannerProps) {
  return (
    <section
      aria-label="Welcome Banner"
      className="max-w-6xl mx-auto w-full px-6 pt-5 shrink-0"
    >
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-2.5 min-w-0">
          <h2 className="font-ui text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
            Welcome to Career Doc
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onGoToProfile}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] font-semibold flex items-center justify-center shrink-0 tabular-nums">
                1
              </span>
              <span>Fill in your Profile</span>
            </button>

            <button
              type="button"
              onClick={onOpenStickyNotes}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] font-semibold flex items-center justify-center shrink-0 tabular-nums">
                2
              </span>
              <span>Open Sticky Notes</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-300 rounded text-slate-700">
                Alt+S
              </kbd>
            </button>

            <button
              type="button"
              onClick={onGoToBuilder}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] font-semibold flex items-center justify-center shrink-0 tabular-nums">
                3
              </span>
              <span>Queue a Resume / Cover Letter</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
          <button
            type="button"
            onClick={onOpenQuickGuide}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Quick Guide</span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss welcome banner"
            title="Dismiss welcome banner"
            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

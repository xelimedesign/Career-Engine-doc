import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { CareerEngineIcon } from './CareerEngineIcon';
import { LocalAiTroubleshootingNotice } from './LocalAiTroubleshootingNotice';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const getStartedBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const focusTimer = setTimeout(() => {
      getStartedBtnRef.current?.focus();
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#121316] text-white flex items-center justify-center shrink-0">
              <CareerEngineIcon size={20} />
            </div>
            <div className="min-w-0">
              <h2
                id="welcome-modal-title"
                className="font-ui text-lg font-bold tracking-tight text-slate-900"
              >
                Welcome to Career Doc
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                A quick guide before you start.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close welcome guide"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold tracking-wide text-slate-900">
              What the app is for
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Career Engine helps you write resumes and cover letters from your own career profile, track the jobs you apply to, and review each application before you send it.
            </p>
          </section>

          <section className="space-y-2.5 pt-4 border-t border-slate-200">
            <h3 className="text-xs font-semibold tracking-wide text-slate-900">
              Main features
            </h3>
            <ul className="space-y-2 text-sm text-slate-600 leading-snug">
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-slate-900">Profile:</strong> your verified work history, skills, and education.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-slate-900">Jobs:</strong> save job links or descriptions and track their status.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-slate-900">Resumes and Cover Letters:</strong> build, edit, and export as PDF or Word.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-slate-900">Review:</strong> check documents for accuracy and fit before you apply.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-slate-900">Documents:</strong> all your saved resumes and letters in one place.
                </span>
              </li>
            </ul>
          </section>

          <section className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5">
            <h3 className="text-xs font-semibold tracking-wide text-slate-900">
              Where to start
            </h3>
            <ol className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                  1
                </span>
                <span>Fill in your Profile.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                  2
                </span>
                <span>
                  Open Sticky Notes (or press{' '}
                  <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-white border border-slate-300 rounded text-slate-800">
                    Alt+S
                  </kbd>
                  ) and save a job.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                  3
                </span>
                <span>Queue a resume or cover letter for that job.</span>
              </li>
            </ol>
          </section>

          <section className="space-y-2.5 pt-4 border-t border-slate-200">
            <h3 className="text-xs font-semibold tracking-wide text-slate-900">
              Using local AI models (optional)
            </h3>
            <LocalAiTroubleshootingNotice compact />
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            ref={getStartedBtnRef}
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}

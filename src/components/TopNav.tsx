import { useEffect, useState } from 'react';
import {
  BookOpen,
  Cloud,
  CloudAlert,
  Loader2,
  LogIn,
  LogOut,
  RotateCcw,
  SlidersHorizontal,
  UserX,
} from 'lucide-react';
import { AppModule } from '../types/career';
import { useCareer } from '../store/CareerContext';
import {
  AiProviderConfig,
  formatHeaderProviderLabel,
  getAiProviderConfig,
  subscribeAiProviderConfig,
} from '../services/aiProviderConfig';
import { formatFirebaseAuthError } from '../firebase';
import { CareerEngineIcon } from './CareerEngineIcon';

const NAV_ITEMS: Array<{ id: AppModule; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'resumes', label: 'Resumes' },
  { id: 'cover-letters', label: 'Cover Letters' },
  { id: 'review', label: 'Review' },
  { id: 'documents', label: 'Documents' },
];

export function TopNav({
  onOpenAiSettings,
  onOpenWelcomeModal,
  onOpenResetModal,
}: {
  onOpenAiSettings: () => void;
  onOpenWelcomeModal: () => void;
  onOpenResetModal: () => void;
}) {
  const {
    activeModule,
    setActiveModule,
    createResume,
    createCoverLetter,
    user,
    isGuest,
    authLoading,
    syncStatus,
    signInWithGoogle,
    signOutUser,
    exitGuestMode,
    openStickyNotes,
    isStickyNotesOpen,
    isStickyNotesMinimized,
  } = useCareer();
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AiProviderConfig>(() => getAiProviderConfig());

  useEffect(() => {
    return subscribeAiProviderConfig(setAiConfig);
  }, []);

  const handlePrimaryAction = () => {
    if (activeModule === 'cover-letters') {
      createCoverLetter({ prefillFromProfile: true });
    } else if (activeModule === 'jobs') {
      setActiveModule('jobs');
      window.dispatchEvent(new CustomEvent('career-engine:new-job'));
    } else {
      createResume({ fromProfile: true });
      setActiveModule('resumes');
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      if (msg) {
        setAuthMessage(msg);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      await signOutUser();
    } catch {
      setAuthMessage('Could not sign out.');
    } finally {
      setAuthBusy(false);
    }
  };

  const primaryLabel =
    activeModule === 'cover-letters'
      ? 'New Cover Letter'
      : activeModule === 'jobs'
        ? 'Add Job'
        : 'New Resume';

  const providerDisplay = formatHeaderProviderLabel(aiConfig);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3 sm:px-6 py-2 flex flex-col gap-2 shadow-2xs">
      {/* Top Row: Brand & Primary Actions */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setActiveModule('profile')}
          className="inline-flex items-center gap-2 font-ui text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <span
            className="w-7 h-7 rounded-lg bg-[#121316] text-white inline-flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <CareerEngineIcon size={15} />
          </span>
          <span>Career Doc</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAiSettings}
            title={`AI Provider: ${providerDisplay.fullLabel}`}
            aria-label="AI Provider settings"
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate max-w-[90px] sm:max-w-[130px] hidden sm:inline">{providerDisplay.fullLabel}</span>
          </button>

          <button
            type="button"
            onClick={openStickyNotes}
            title="Sticky Notes (Alt+S)"
            aria-pressed={isStickyNotesOpen && !isStickyNotesMinimized}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isStickyNotesOpen && !isStickyNotesMinimized
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="4" fill="#FCD116" />
              <path d="M14 21L21 14H15.5C14.6716 14 14 14.6716 14 15.5V21Z" fill="#9B4F96" />
            </svg>
            <span className="hidden md:inline">Notes</span>
          </button>

          <button
            type="button"
            onClick={handlePrimaryAction}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {primaryLabel}
          </button>
        </div>
      </div>

      {/* Bottom Row: Navigation Tabs & Secondary Status / Controls */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav aria-label="Primary" className="flex items-center gap-3 shrink-0 py-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`relative py-1 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive ? 'text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-slate-900" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          {authMessage && (
            <span className="hidden md:inline text-[11px] text-rose-600 font-medium">
              {authMessage}
            </span>
          )}

          {!authLoading && !user && isGuest && (
            <div className="flex items-center gap-1 border border-amber-200 rounded px-2 py-0.5 bg-amber-50/70 text-[11px] shrink-0">
              <span className="font-semibold text-amber-900">Guest</span>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void handleGoogleSignIn()}
                title="Sign in with Google"
                className="text-slate-700 hover:text-slate-900 font-medium pl-1 border-l border-amber-200 cursor-pointer"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={exitGuestMode}
                title="Exit Guest mode"
                className="text-slate-600 hover:text-slate-900 pl-1 border-l border-amber-200 cursor-pointer"
              >
                Exit
              </button>
            </div>
          )}

          {!authLoading && user && (
            <div className="flex items-center gap-1.5 border border-slate-200 rounded px-2 py-0.5 bg-slate-50 text-[11px] shrink-0">
              <span className="inline-flex items-center">
                {syncStatus === 'syncing' ? (
                  <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />
                ) : syncStatus === 'error' ? (
                  <CloudAlert className="w-3 h-3 text-rose-600" />
                ) : (
                  <Cloud className="w-3 h-3 text-emerald-600" />
                )}
              </span>
              <span className="hidden xl:inline text-slate-700 truncate max-w-[100px]">
                {user.email || user.displayName || 'Signed in'}
              </span>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void handleSignOut()}
                title="Sign out"
                className="text-slate-600 hover:text-slate-900 pl-1 border-l border-slate-200 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenResetModal}
            title="Reset workspace data"
            aria-label="Reset workspace data"
            className="p-1 text-slate-600 bg-white border border-slate-300 rounded hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

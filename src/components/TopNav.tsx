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
    <header className="sticky top-0 z-30 min-h-14 bg-white border-b border-slate-200 px-4 sm:px-6 py-1.5 lg:py-0 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-4">
      {/* Zone 1: Single-line Brand Wordmark */}
      <button
        type="button"
        onClick={() => setActiveModule('profile')}
        className="inline-flex items-center gap-2.5 font-ui text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <span
          className="w-8 h-8 rounded-lg bg-[#121316] text-white inline-flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <CareerEngineIcon size={16} />
        </span>
        <span>Career Doc</span>
      </button>

      {/* Zone 2: Clean single-line text navigation links */}
      <nav aria-label="Primary" className="order-3 lg:order-2 w-full lg:w-auto flex items-center gap-4 lg:gap-5 overflow-x-auto border-t lg:border-t-0 border-slate-100 pt-1 lg:pt-0">
        {NAV_ITEMS.map((item) => {
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveModule(item.id)}
              className={`relative py-2 lg:py-4 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900 ${
                isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {item.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Active AI Provider, Auth / Guest, Reset, Sticky Notes & Primary Action */}
      <div className="order-2 lg:order-3 flex flex-wrap items-center gap-2 shrink-0">
        {authMessage && (
          <span className="hidden md:inline text-[11px] text-rose-600 font-medium">
            {authMessage}
          </span>
        )}

        <button
          type="button"
          onClick={onOpenAiSettings}
          title={`AI Provider: ${providerDisplay.fullLabel} — Click to configure`}
          aria-label={`AI Provider settings (${providerDisplay.fullLabel})`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-md hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 max-w-[160px]"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">{providerDisplay.fullLabel}</span>
        </button>

        <button
          type="button"
          onClick={onOpenWelcomeModal}
          title="Open Welcome Guide"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <BookOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="hidden xl:inline">Welcome Guide</span>
        </button>

        {!authLoading && !user && isGuest && (
          <div className="flex items-center gap-1.5 border border-amber-200 rounded-md px-2.5 py-1 bg-amber-50/70 shrink-0">
            <span
              title="Guest mode saves data only in this browser and is not linked to a Google account."
              className="text-[11px] font-semibold text-amber-900 whitespace-nowrap"
            >
              Guest (Local)
            </span>
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void handleGoogleSignIn()}
              title="Sign in with Google to use your personal cloud account"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50 cursor-pointer pl-1.5 border-l border-amber-200 whitespace-nowrap shrink-0"
            >
              {authBusy ? (
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              ) : (
                <LogIn className="w-3 h-3 shrink-0" />
              )}
              <span>Sign in</span>
            </button>
            <button
              type="button"
              onClick={exitGuestMode}
              title="Leave Guest mode and return to start screen"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer pl-1.5 border-l border-amber-200 whitespace-nowrap shrink-0"
            >
              <UserX className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        )}

        {!authLoading && user && (
          <div className="flex items-center gap-2 border border-slate-200 rounded-md px-2.5 py-1 bg-slate-50 shrink-0">
            <span
              title={
                syncStatus === 'syncing'
                  ? 'Syncing with Firestore'
                  : syncStatus === 'error'
                    ? 'Firestore sync error'
                    : 'Synced with Firestore'
              }
              className="inline-flex items-center shrink-0"
            >
              {syncStatus === 'syncing' ? (
                <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
              ) : syncStatus === 'error' ? (
                <CloudAlert className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </span>
            <span className="hidden xl:inline text-xs font-medium text-slate-700 max-w-[130px] truncate">
              {user.email || user.displayName || 'Signed in'}
            </span>
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void handleSignOut()}
              title="Sign out"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 cursor-pointer pl-1.5 border-l border-slate-200 whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenResetModal}
          title="Clear workspace data and start fresh"
          aria-label="Reset workspace data"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden xl:inline">Reset</span>
        </button>

        <button
          type="button"
          onClick={openStickyNotes}
          title="Sticky Notes (Alt+S)"
          aria-pressed={isStickyNotesOpen && !isStickyNotesMinimized}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
            isStickyNotesOpen && !isStickyNotesMinimized
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4" fill="#FCD116" />
            <path d="M14 21L21 14H15.5C14.6716 14 14 14.6716 14 15.5V21Z" fill="#9B4F96" />
          </svg>
          <span className="hidden sm:inline">Sticky Notes</span>
        </button>

        <button
          type="button"
          onClick={handlePrimaryAction}
          className="px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          {primaryLabel}
        </button>
      </div>
    </header>
  );
}

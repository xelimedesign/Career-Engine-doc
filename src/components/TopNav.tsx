import { useEffect, useState } from 'react';
import { Cloud, CloudAlert, Loader2, LogIn, LogOut, SlidersHorizontal } from 'lucide-react';
import { AppModule } from '../types/career';
import { useCareer } from '../store/CareerContext';
import {
  AiProviderConfig,
  formatHeaderProviderLabel,
  getAiProviderConfig,
  subscribeAiProviderConfig,
} from '../services/aiProviderConfig';

const NAV_ITEMS: Array<{ id: AppModule; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'resumes', label: 'Resumes' },
  { id: 'cover-letters', label: 'Cover Letters' },
  { id: 'review', label: 'Review' },
  { id: 'documents', label: 'Documents' },
];

export function TopNav({ onOpenAiSettings }: { onOpenAiSettings: () => void }) {
  const {
    activeModule,
    setActiveModule,
    createResume,
    createCoverLetter,
    user,
    authLoading,
    syncStatus,
    signInWithGoogle,
    signOutUser,
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
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setAuthMessage('Sign-in failed. Please try again.');
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
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4">
      {/* Zone 1: Single-line Brand Wordmark */}
      <button
        type="button"
        onClick={() => setActiveModule('resumes')}
        className="font-ui text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        Career Engine
      </button>

      {/* Zone 2: Clean single-line text navigation links */}
      <nav aria-label="Primary" className="flex items-center gap-5 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveModule(item.id)}
              className={`relative py-4 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900 ${
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

      {/* Zone 3: Active AI Provider, Auth, Sticky Notes & Primary Action */}
      <div className="flex items-center gap-2.5 shrink-0">
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
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-md hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 max-w-[200px]"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">{providerDisplay.fullLabel}</span>
        </button>

        {!authLoading && !user && (
          <button
            type="button"
            disabled={authBusy}
            onClick={() => void handleGoogleSignIn()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {authBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogIn className="w-3.5 h-3.5" />
            )}
            <span>Sign in with Google</span>
          </button>
        )}

        {!authLoading && user && (
          <div className="flex items-center gap-2 border border-slate-200 rounded-md px-2.5 py-1 bg-slate-50">
            <span
              title={
                syncStatus === 'syncing'
                  ? 'Syncing with Firestore'
                  : syncStatus === 'error'
                    ? 'Firestore sync error'
                    : 'Synced with Firestore'
              }
              className="inline-flex items-center"
            >
              {syncStatus === 'syncing' ? (
                <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
              ) : syncStatus === 'error' ? (
                <CloudAlert className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </span>
            <span className="hidden xl:inline text-xs font-medium text-slate-700 max-w-[140px] truncate">
              {user.email || user.displayName || 'Signed in'}
            </span>
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void handleSignOut()}
              title="Sign out"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50 cursor-pointer pl-1 border-l border-slate-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">Sign out</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={openStickyNotes}
          title="Sticky Notes (Alt+S)"
          aria-pressed={isStickyNotesOpen && !isStickyNotesMinimized}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
            isStickyNotesOpen && !isStickyNotesMinimized
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4" fill="#FCD116" />
            <path d="M14 21L21 14H15.5C14.6716 14 14 14.6716 14 15.5V21Z" fill="#9B4F96" />
          </svg>
          <span>Sticky Notes</span>
        </button>

        <button
          type="button"
          onClick={handlePrimaryAction}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          {primaryLabel}
        </button>
      </div>
    </header>
  );
}

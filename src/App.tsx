/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { CareerProvider, useCareer } from './store/CareerContext';
import { TopNav } from './components/TopNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StickyNotesPopup } from './components/StickyNotesPopup';
import { AiProviderModal } from './components/AiProviderModal';
import { SignInGate } from './components/SignInGate';
import { WelcomeModal } from './components/WelcomeModal';
import { WelcomeBanner } from './components/WelcomeBanner';
import { CareerProfileModule } from './modules/CareerProfileModule';
import { JobTrackerModule } from './modules/JobTrackerModule';
import { ResumeBuilderModule } from './modules/ResumeBuilderModule';
import { CoverLetterModule } from './modules/CoverLetterModule';
import { ReviewCenterModule } from './modules/ReviewCenterModule';
import { DocumentManagerModule } from './modules/DocumentManagerModule';
import {
  AiConnectivityBannerState,
  AiLiveStreamState,
  clearAiErrorBanner,
  getAiErrorBanner,
  getAiLiveStream,
  subscribeAiErrorBanner,
  subscribeAiLiveStream,
} from './services/aiProviderConfig';

const WELCOME_SEEN_KEY = 'career_engine_welcome_seen';
const WELCOME_BANNER_DISMISSED_KEY = 'career_engine_welcome_banner_dismissed';

function loadBannerDismissed(scopeId: string): boolean {
  try {
    return sessionStorage.getItem(`${WELCOME_BANNER_DISMISSED_KEY}_${scopeId}`) === 'true';
  } catch {
    return false;
  }
}

function CareerEngineShell() {
  const {
    user,
    isGuest,
    authLoading,
    activeModule,
    setActiveModule,
    openStickyNotes,
    syncError,
    driveConnected,
    pendingDriveExports,
    driveError,
    clearDriveError,
    connectGoogleDrive,
    flushPendingDriveExports,
    isFlushingDriveQueue,
    resetWorkspaceData,
    signInWithGoogle,
  } = useCareer();
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const scopeId = user ? user.uid : 'guest';
  const [welcomeBannerDismissed, setWelcomeBannerDismissed] = useState<boolean>(() =>
    loadBannerDismissed(scopeId)
  );
  const [aiErrorBanner, setAiErrorBanner] = useState<AiConnectivityBannerState | null>(() =>
    getAiErrorBanner()
  );
  const [aiLiveStream, setAiLiveStream] = useState<AiLiveStreamState>(() => getAiLiveStream());

  useEffect(() => {
    setWelcomeBannerDismissed(loadBannerDismissed(scopeId));
  }, [scopeId]);

  useEffect(() => {
    if (!syncError) {
      setDismissedError(null);
    }
  }, [syncError]);

  useEffect(() => {
    const unsubErr = subscribeAiErrorBanner(setAiErrorBanner);
    const unsubStream = subscribeAiLiveStream(setAiLiveStream);
    return () => {
      unsubErr();
      unsubStream();
    };
  }, []);

  // Open Welcome Modal automatically on first visit per authenticated account or guest session
  useEffect(() => {
    if (authLoading) return;
    if (!user && !isGuest) {
      setWelcomeModalOpen(false);
      return;
    }
    try {
      const seen = localStorage.getItem(`${WELCOME_SEEN_KEY}_${scopeId}`);
      if (seen !== 'true') {
        setWelcomeModalOpen(true);
      }
    } catch {
      setWelcomeModalOpen(true);
    }
  }, [authLoading, user, isGuest, scopeId]);

  const handleCloseWelcomeModal = useCallback(() => {
    try {
      if (user || isGuest) {
        localStorage.setItem(`${WELCOME_SEEN_KEY}_${scopeId}`, 'true');
      }
    } catch {
      // Ignore storage errors
    }
    setWelcomeModalOpen(false);
  }, [user, isGuest, scopeId]);

  const handleDismissBanner = useCallback(() => {
    setWelcomeBannerDismissed(true);
    try {
      sessionStorage.setItem(`${WELCOME_BANNER_DISMISSED_KEY}_${scopeId}`, 'true');
    } catch {
      // Ignore storage errors
    }
  }, [scopeId]);

  const handleConfirmReset = useCallback(async () => {
    setResetBusy(true);
    try {
      await resetWorkspaceData();
      setResetModalOpen(false);
    } finally {
      setResetBusy(false);
    }
  }, [resetWorkspaceData]);

  // Gate workspace before rendering until Firebase auth resolves and user is either signed in or in Guest mode
  if (authLoading || (!user && !isGuest)) {
    return <SignInGate />;
  }

  const showSyncError = Boolean(user && syncError && syncError !== dismissedError);
  const showDrivePendingBanner = Boolean(user && pendingDriveExports.length > 0 && !driveConnected);
  const showDriveErrorBanner = Boolean(user && driveError && !showDrivePendingBanner);
  const isFixedViewportModule = activeModule === 'resumes' || activeModule === 'cover-letters';

  return (
    <div
      className={`${
        isFixedViewportModule ? 'h-screen overflow-hidden' : 'min-h-screen'
      } flex flex-col bg-slate-50 text-slate-900`}
    >
      <TopNav
        onOpenAiSettings={() => setAiSettingsOpen(true)}
        onOpenWelcomeModal={() => setWelcomeModalOpen(true)}
        onOpenResetModal={() => setResetModalOpen(true)}
      />
      {!user && isGuest && (
        <div
          role="status"
          className="bg-amber-50/90 border-b border-amber-200 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 shrink-0"
        >
          <span>
            <strong>Guest mode:</strong> Your workspace starts blank and stays saved only in this browser unless you sign in to a personal account.
          </span>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="px-2.5 py-1 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 cursor-pointer shrink-0"
          >
            Sign in with Google
          </button>
        </div>
      )}
      {showSyncError && syncError && (
        <div
          role="alert"
          className="bg-rose-50 border-b border-rose-200 px-6 py-2 flex items-center justify-between gap-4 text-xs text-rose-800 shrink-0"
        >
          <span className="truncate">
            Cloud sync issue: {syncError}
          </span>
          <button
            type="button"
            onClick={() => setDismissedError(syncError)}
            className="text-rose-700 hover:text-rose-950 font-medium shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {showDrivePendingBanner && (
        <div
          role="status"
          className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 shrink-0"
        >
          <span className="truncate">
            Google Drive permission needed to auto-export {pendingDriveExports.length} pending document
            {pendingDriveExports.length === 1 ? '' : 's'} into Career Engine DOC.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isFlushingDriveQueue}
              onClick={() => void connectGoogleDrive()}
              className="px-3 py-1 rounded bg-amber-900 text-white font-semibold hover:bg-amber-800 disabled:opacity-50 cursor-pointer"
            >
              {isFlushingDriveQueue ? 'Uploading...' : 'Connect Google Drive'}
            </button>
          </div>
        </div>
      )}
      {showDriveErrorBanner && driveError && (
        <div
          role="alert"
          className="bg-rose-50 border-b border-rose-200 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900 shrink-0"
        >
          <span className="truncate">Google Drive export error: {driveError}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isFlushingDriveQueue}
              onClick={() =>
                void (driveConnected ? flushPendingDriveExports() : connectGoogleDrive())
              }
              className="px-2.5 py-1 rounded bg-rose-900 text-white font-semibold hover:bg-rose-800 disabled:opacity-50 cursor-pointer"
            >
              {driveConnected ? 'Retry Pending' : 'Reconnect Google Drive'}
            </button>
            <button
              type="button"
              onClick={clearDriveError}
              className="text-rose-700 hover:text-rose-950 font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {aiErrorBanner && (
        <div
          role="alert"
          className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex flex-wrap items-start justify-between gap-4 text-xs text-rose-900 shrink-0"
        >
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-0.5">
              <div className="font-semibold">
                {aiErrorBanner.title}: {aiErrorBanner.message}
              </div>
              {aiErrorBanner.guidance && (
                <p className="text-rose-800 leading-relaxed">
                  {aiErrorBanner.guidance}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAiSettingsOpen(true)}
              className="px-3 py-1.5 rounded-md bg-rose-900 text-white font-semibold hover:bg-rose-800 transition-colors cursor-pointer"
            >
              Connection Settings
            </button>
            <button
              type="button"
              onClick={() => clearAiErrorBanner()}
              className="px-2.5 py-1.5 rounded-md text-rose-700 hover:text-rose-950 hover:bg-rose-100 font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {aiLiveStream.active && !aiSettingsOpen && (
        <div
          role="status"
          aria-live="polite"
          className="bg-slate-900 text-slate-100 border-b border-slate-800 px-6 py-2 text-xs flex items-center gap-3 shrink-0"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300 shrink-0" />
          <span className="font-semibold text-white shrink-0">
            Ollama • {aiLiveStream.model}
          </span>
          <span className="text-slate-400 shrink-0">
            {aiLiveStream.taskLabel}
          </span>
          <span className="font-mono text-[11px] text-slate-300 truncate flex-1">
            {aiLiveStream.tokensText ? aiLiveStream.tokensText.slice(-160) : 'Streaming tokens...'}
          </span>
        </div>
      )}
      {!welcomeBannerDismissed && (
        <WelcomeBanner
          onGoToProfile={() => setActiveModule('profile')}
          onOpenStickyNotes={openStickyNotes}
          onGoToBuilder={() => setActiveModule('resumes')}
          onOpenQuickGuide={() => setWelcomeModalOpen(true)}
          onDismiss={handleDismissBanner}
        />
      )}
      <div className={`flex-1 min-h-0 ${isFixedViewportModule ? 'flex flex-col' : ''}`}>
        {activeModule === 'profile' && <CareerProfileModule />}
        {activeModule === 'jobs' && <JobTrackerModule />}
        {activeModule === 'resumes' && <ResumeBuilderModule />}
        {activeModule === 'cover-letters' && <CoverLetterModule />}
        {activeModule === 'review' && <ReviewCenterModule />}
        {activeModule === 'documents' && <DocumentManagerModule />}
      </div>
      <StickyNotesPopup />
      <AiProviderModal
        isOpen={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
      />
      <WelcomeModal
        isOpen={welcomeModalOpen}
        onClose={handleCloseWelcomeModal}
      />
      {resetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-workspace-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="space-y-1.5">
              <h2 id="reset-workspace-title" className="text-sm font-semibold text-slate-900">
                Reset Workspace Data?
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {user
                  ? 'This will clear your saved Career Profile, jobs, resumes, cover letters, research, reviews, and sticky notes from this browser and your cloud account so you can start completely empty.'
                  : 'This will clear all local Guest Career Profile entries, jobs, resumes, cover letters, research, reviews, and sticky notes stored in this browser.'}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={resetBusy}
                onClick={() => setResetModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetBusy}
                onClick={() => void handleConfirmReset()}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-md cursor-pointer disabled:opacity-50"
              >
                {resetBusy ? 'Resetting...' : 'Clear & Start Fresh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CareerProvider>
        <CareerEngineShell />
      </CareerProvider>
    </ErrorBoundary>
  );
}

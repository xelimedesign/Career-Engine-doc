/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { CareerProvider, useCareer } from './store/CareerContext';
import { TopNav } from './components/TopNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StickyNotesPopup } from './components/StickyNotesPopup';
import { AiProviderModal } from './components/AiProviderModal';
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

function CareerEngineShell() {
  const {
    activeModule,
    syncError,
    driveConnected,
    pendingDriveExports,
    driveError,
    clearDriveError,
    connectGoogleDrive,
    flushPendingDriveExports,
    isFlushingDriveQueue,
  } = useCareer();
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiErrorBanner, setAiErrorBanner] = useState<AiConnectivityBannerState | null>(() =>
    getAiErrorBanner()
  );
  const [aiLiveStream, setAiLiveStream] = useState<AiLiveStreamState>(() => getAiLiveStream());

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

  const showSyncError = Boolean(syncError && syncError !== dismissedError);
  const showDrivePendingBanner = pendingDriveExports.length > 0 && !driveConnected;
  const showDriveErrorBanner = Boolean(driveError) && !showDrivePendingBanner;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNav onOpenAiSettings={() => setAiSettingsOpen(true)} />
      {showSyncError && syncError && (
        <div
          role="alert"
          className="bg-rose-50 border-b border-rose-200 px-6 py-2 flex items-center justify-between gap-4 text-xs text-rose-800"
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
          className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950"
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
          className="bg-rose-50 border-b border-rose-200 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900"
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
          className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex flex-wrap items-start justify-between gap-4 text-xs text-rose-900"
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
          className="bg-slate-900 text-slate-100 border-b border-slate-800 px-6 py-2 text-xs flex items-center gap-3"
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
      <div className="flex-1 min-h-0">
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

import { useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  FolderUp,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCareer } from '../store/CareerContext';
import { exportResumeToDocx, exportResumeToPdf } from '../services/resumeExport';
import { exportCoverLetterToDocx, exportCoverLetterToPdf } from '../services/coverLetterExport';
import {
  buildCompanyReportTextBlob,
  sanitizeFilename,
  triggerBlobDownload,
} from '../services/exportHelpers';
import { CompanyResearch, DriveExportFormat } from '../types/career';

function downloadCompanyReportText(research: CompanyResearch) {
  const blob = buildCompanyReportTextBlob(research);
  triggerBlobDownload(
    blob,
    `${sanitizeFilename(research.companyName, 'Company')}_Company_Intelligence.txt`
  );
}

interface PendingReplaceTarget {
  kind: 'resume' | 'cover-letter' | 'research';
  id: string;
  title: string;
  folderName?: string;
}

export function DocumentManagerModule() {
  const {
    resumes,
    coverLetters,
    jobs,
    companyResearches,
    setActiveResumeId,
    setActiveCoverLetterId,
    setSelectedJobId,
    setActiveModule,
    createResume,
    createCoverLetter,
    duplicateResume,
    duplicateCoverLetter,
    deleteResume,
    deleteCoverLetter,
    applicationReviews,
    openReviewCenter,
    driveConnected,
    driveExportSettings,
    updateDriveExportSettings,
    pendingDriveExports,
    driveError,
    clearDriveError,
    isFlushingDriveQueue,
    connectGoogleDrive,
    exportDocumentToDrive,
    flushPendingDriveExports,
    exportAllDocumentsToDrive,
  } = useCareer();

  const [filterType, setFilterType] = useState<'all' | 'resume' | 'cover-letter' | 'research'>(
    'all'
  );
  const [query, setQuery] = useState('');
  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null);
  const [driveNotice, setDriveNotice] = useState<string | null>(null);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<PendingReplaceTarget | null>(null);

  const completedResearches = companyResearches.filter((r) => r.status === 'completed');

  const items = [
    ...resumes.map((r) => ({
      kind: 'resume' as const,
      id: r.id,
      title: r.name,
      subtitle: `Resume · ${r.template}`,
      versionLabel: r.isMaster ? 'Master' : `v${r.version}`,
      linkedJobId: r.linkedJobId,
      updatedAt: r.updatedAt,
      driveFileId: r.driveFileId,
      driveWebViewLink: r.driveWebViewLink,
      driveFolderName: r.driveFolderName,
      driveSyncStatus: r.driveSyncStatus,
      driveSyncError: r.driveSyncError,
      rawResume: r,
    })),
    ...coverLetters.map((c) => ({
      kind: 'cover-letter' as const,
      id: c.id,
      title: c.title,
      subtitle: `Cover Letter · ${c.template}`,
      versionLabel: `v${c.version}`,
      linkedJobId: c.linkedJobId,
      updatedAt: c.updatedAt,
      driveFileId: c.driveFileId,
      driveWebViewLink: c.driveWebViewLink,
      driveFolderName: c.driveFolderName,
      driveSyncStatus: c.driveSyncStatus,
      driveSyncError: c.driveSyncError,
      rawLetter: c,
    })),
    ...completedResearches.map((res) => ({
      kind: 'research' as const,
      id: res.id,
      title: `${res.companyName} — Company Intelligence`,
      subtitle: `Research Report · ${res.overallConfidence} confidence`,
      versionLabel: `${res.findings.filter((f) => f.verificationStatus === 'approved').length}/${res.findings.length} approved`,
      linkedJobId: res.jobApplicationId,
      updatedAt: res.researchDate,
      driveFileId: res.driveFileId,
      driveWebViewLink: res.driveWebViewLink,
      driveFolderName: res.driveFolderName,
      driveSyncStatus: res.driveSyncStatus,
      driveSyncError: res.driveSyncError,
      rawResearch: res,
    })),
  ]
    .filter((item) => (filterType === 'all' ? true : item.kind === filterType))
    .filter((item) => item.title.toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const handleConnectDrive = async () => {
    setConnectingDrive(true);
    setDriveNotice(null);
    clearDriveError();
    try {
      const token = await connectGoogleDrive();
      if (token) {
        setDriveNotice('Google Drive connected to Career Engine DOC.');
      }
    } catch (err) {
      setDriveNotice(
        err instanceof Error ? err.message : 'Unable to connect Google Drive.'
      );
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleExportSingleToDrive = async (
    kind: 'resume' | 'cover-letter' | 'research',
    id: string,
    title: string,
    replaceExisting = false
  ) => {
    const key = `${kind}:${id}`;
    setUploadingDocKey(key);
    setDriveNotice(null);
    clearDriveError();
    try {
      const res = await exportDocumentToDrive({ kind, id, replaceExisting });
      if (res) {
        setDriveNotice(
          `${replaceExisting ? 'Updated' : 'Saved'} "${res.fileName}" in ${res.folderName}.`
        );
      } else {
        setDriveNotice(`Queued "${title}" for Career Engine DOC.`);
      }
    } catch {
      // Captured via driveError
    } finally {
      setUploadingDocKey(null);
    }
  };

  const handleSyncAll = async () => {
    setDriveNotice(null);
    clearDriveError();
    const res = await exportAllDocumentsToDrive();
    if (res.exported > 0 || res.failed > 0) {
      setDriveNotice(
        `Exported ${res.exported} document${res.exported === 1 ? '' : 's'} to Career Engine DOC${
          res.failed > 0 ? ` (${res.failed} failed)` : ''
        }.`
      );
    }
  };

  const handleFlushPending = async () => {
    setDriveNotice(null);
    clearDriveError();
    if (!driveConnected) {
      await handleConnectDrive();
      return;
    }
    const res = await flushPendingDriveExports();
    setDriveNotice(
      `Exported ${res.exported} pending document${res.exported === 1 ? '' : 's'} to Career Engine DOC.`
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Document Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            All saved resumes, cover letters, and company intelligence reports with version tracking, job links, and Google Drive export.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              createResume({ fromProfile: true });
              setActiveModule('resumes');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Resume
          </button>
          <button
            type="button"
            onClick={() => {
              createCoverLetter({ prefillFromProfile: true });
              setActiveModule('cover-letters');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Cover Letter
          </button>
        </div>
      </div>

      {/* Google Drive Auto-Export Settings Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <FolderUp className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold text-slate-900">
                  Google Drive — Career Engine DOC Folder
                </h2>
                {driveConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-600">
                    Not connected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Saves documents into a dedicated <span className="font-medium text-slate-700">Career Engine DOC</span> folder in your Google Drive.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {driveExportSettings.folderWebViewLink && (
              <a
                href={driveExportSettings.folderWebViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-md"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Open Folder
              </a>
            )}
            {pendingDriveExports.length > 0 && (
              <button
                type="button"
                disabled={isFlushingDriveQueue || connectingDrive}
                onClick={() => void handleFlushPending()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 rounded-md cursor-pointer"
              >
                {isFlushingDriveQueue ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Export Pending ({pendingDriveExports.length})
              </button>
            )}
            {!driveConnected ? (
              <button
                type="button"
                disabled={connectingDrive}
                onClick={() => void handleConnectDrive()}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-md cursor-pointer"
              >
                {connectingDrive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                )}
                <span>Connect Google Drive</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isFlushingDriveQueue || items.length === 0}
                onClick={() => void handleSyncAll()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md cursor-pointer"
              >
                {isFlushingDriveQueue ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FolderUp className="w-3.5 h-3.5" />
                )}
                Export All to Drive
              </button>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={driveExportSettings.autoExportEnabled}
              onChange={(e) =>
                updateDriveExportSettings((prev) => ({
                  ...prev,
                  autoExportEnabled: e.target.checked,
                }))
              }
              className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <div>
              <div className="font-medium text-slate-900">
                Auto-export to Career Engine DOC
              </div>
              <div className="text-[11px] text-slate-500">
                Automatically exports newly AI-tailored resumes, cover letters, review updates, and company reports.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={driveExportSettings.organizeByJobFolder}
              onChange={(e) =>
                updateDriveExportSettings((prev) => ({
                  ...prev,
                  organizeByJobFolder: e.target.checked,
                }))
              }
              className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <div>
              <div className="font-medium text-slate-900">
                Organize into job subfolders
              </div>
              <div className="text-[11px] text-slate-500">
                Places job-linked files inside <span className="font-mono text-[10px]">Career Engine DOC / Company - Role</span>.
              </div>
            </div>
          </label>

          <div className="flex items-center justify-between md:justify-end gap-2.5">
            <label htmlFor="drive-export-format" className="font-medium text-slate-700 whitespace-nowrap">
              Drive file format
            </label>
            <select
              id="drive-export-format"
              value={driveExportSettings.format}
              onChange={(e) =>
                updateDriveExportSettings((prev) => ({
                  ...prev,
                  format: e.target.value as DriveExportFormat,
                }))
              }
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-slate-900"
            >
              <option value="pdf">PDF (.pdf)</option>
              <option value="docx">Word / Text (.docx / .txt)</option>
              <option value="google_doc">Google Doc (Editable)</option>
            </select>
          </div>
        </div>

        {(driveError || driveNotice) && (
          <div
            className={`px-3 py-2 rounded-md text-xs flex items-center justify-between gap-3 ${
              driveError
                ? 'bg-rose-50 border border-rose-200 text-rose-800'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            }`}
          >
            <span className="flex items-center gap-1.5 min-w-0 truncate">
              {driveError ? (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{driveError || driveNotice}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                clearDriveError();
                setDriveNotice(null);
              }}
              className="font-medium underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-md">
          {(
            [
              {
                id: 'all',
                label: `All (${resumes.length + coverLetters.length + completedResearches.length})`,
              },
              { id: 'resume', label: `Resumes (${resumes.length})` },
              { id: 'cover-letter', label: `Cover Letters (${coverLetters.length})` },
              { id: 'research', label: `Company Reports (${completedResearches.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                filterType === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter documents..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-slate-900"
          />
        </div>
      </div>

      {/* Document Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Document</th>
                <th className="py-3 px-4">Type &amp; Details</th>
                <th className="py-3 px-4">Linked Job</th>
                <th className="py-3 px-4">Version / Status</th>
                <th className="py-3 px-4">Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {items.map((item) => {
                const job = item.linkedJobId
                  ? jobs.find((j) => j.id === item.linkedJobId)
                  : undefined;

                const openItem = () => {
                  if (item.kind === 'resume') {
                    setActiveResumeId(item.id);
                    setActiveModule('resumes');
                  } else if (item.kind === 'cover-letter') {
                    setActiveCoverLetterId(item.id);
                    setActiveModule('cover-letters');
                  } else if (item.linkedJobId) {
                    setSelectedJobId(item.linkedJobId);
                    setActiveModule('jobs');
                  }
                };

                const latestReview =
                  item.kind === 'resume'
                    ? applicationReviews.find((r) => r.resumeId === item.id)
                    : item.kind === 'cover-letter'
                      ? applicationReviews.find((r) => r.coverLetterId === item.id)
                      : undefined;

                const rowKey = `${item.kind}:${item.id}`;
                const isUploadingRow = uploadingDocKey === rowKey;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={openItem}
                        className="inline-flex items-center gap-2 hover:underline text-left cursor-pointer"
                      >
                        {item.kind === 'resume' ? (
                          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        ) : item.kind === 'cover-letter' ? (
                          <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <span>{item.title}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-600 capitalize">{item.subtitle}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {job ? `${job.company || 'Untitled'} — ${job.jobTitle || 'Role'}` : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-600">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{item.versionLabel}</span>
                        {latestReview && (
                          <span className="text-emerald-800 font-semibold">
                            · Review {latestReview.scores.overallScore}/100
                          </span>
                        )}
                        {item.driveSyncStatus === 'synced' && item.driveWebViewLink && (
                          <a
                            href={item.driveWebViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={
                              item.driveFolderName
                                ? `Open in ${item.driveFolderName}`
                                : 'Open in Google Drive'
                            }
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-sans font-semibold text-emerald-800 hover:bg-emerald-100"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            Drive
                          </a>
                        )}
                        {item.driveSyncStatus === 'pending_auth' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-sans font-medium text-amber-800">
                            Pending Drive
                          </span>
                        )}
                        {item.driveSyncStatus === 'error' && (
                          <span
                            title={item.driveSyncError || 'Google Drive export failed'}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-[10px] font-sans font-medium text-rose-800"
                          >
                            Drive Error
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-500">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={openItem}
                          title="Open"
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={isUploadingRow || isFlushingDriveQueue}
                          onClick={() =>
                            void handleExportSingleToDrive(item.kind, item.id, item.title, false)
                          }
                          title="Save a new copy to Career Engine DOC in Google Drive"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded cursor-pointer"
                        >
                          {isUploadingRow ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <FolderUp className="w-3 h-3 text-emerald-700" />
                          )}
                          Drive
                        </button>

                        {item.driveFileId && (
                          <button
                            type="button"
                            disabled={isUploadingRow || isFlushingDriveQueue}
                            onClick={() =>
                              setReplaceTarget({
                                kind: item.kind,
                                id: item.id,
                                title: item.title,
                                folderName: item.driveFolderName,
                              })
                            }
                            title="Replace existing file in Google Drive"
                            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-40 rounded cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {item.kind === 'research' ? (
                          <button
                            type="button"
                            onClick={() => downloadCompanyReportText(item.rawResearch)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            TXT
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                openReviewCenter({
                                  resumeId: item.kind === 'resume' ? item.id : undefined,
                                  coverLetterId: item.kind === 'cover-letter' ? item.id : undefined,
                                  jobId: item.linkedJobId,
                                  scope:
                                    item.kind === 'resume'
                                      ? item.linkedJobId
                                        ? 'full_application'
                                        : 'resume_only'
                                      : 'cover_letter_only',
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded cursor-pointer"
                            >
                              <ShieldCheck className="w-3 h-3 text-emerald-700" />
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                item.kind === 'resume'
                                  ? duplicateResume(item.id)
                                  : duplicateCoverLetter(item.id)
                              }
                              title="Duplicate"
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                item.kind === 'resume'
                                  ? exportResumeToDocx(item.rawResume)
                                  : exportCoverLetterToDocx(item.rawLetter)
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              DOCX
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                item.kind === 'resume'
                                  ? exportResumeToPdf(item.rawResume)
                                  : exportCoverLetterToPdf(item.rawLetter)
                              }
                              className="px-2 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              PDF
                            </button>
                            <button
                              type="button"
                              disabled={
                                item.kind === 'resume'
                                  ? resumes.length <= 1
                                  : coverLetters.length <= 1
                              }
                              onClick={() =>
                                item.kind === 'resume'
                                  ? deleteResume(item.id)
                                  : deleteCoverLetter(item.id)
                              }
                              title="Delete"
                              className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No documents match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explicit Confirmation Dialog Before Overwriting Existing Drive File */}
      {replaceTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-replace-title"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="space-y-1.5">
              <h3 id="drive-replace-title" className="text-sm font-semibold text-slate-900">
                Replace existing file in Google Drive?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This will overwrite the existing Google Drive file for{' '}
                <span className="font-semibold text-slate-900">"{replaceTarget.title}"</span>{' '}
                inside{' '}
                <span className="font-medium text-slate-800">
                  {replaceTarget.folderName || 'Career Engine DOC'}
                </span>
                . This replaces its previous content in Drive.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReplaceTarget(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = replaceTarget;
                  setReplaceTarget(null);
                  void handleExportSingleToDrive(
                    target.kind,
                    target.id,
                    target.title,
                    true
                  );
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
              >
                Confirm Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

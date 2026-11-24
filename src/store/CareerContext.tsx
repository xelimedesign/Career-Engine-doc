import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AIWritingSessionRecord,
  ApplicationReviewRecord,
  AppModule,
  CareerProfile,
  CompanyProfile,
  CompanyResearch,
  CoverLetterDocument,
  DocumentRevisionSnapshot,
  DriveExportSettings,
  FactDiscrepancy,
  FindingVerificationStatus,
  JobApplication,
  JobMatch,
  JobTaskType,
  PendingDriveExport,
  ResumeDocument,
  ReviewFinding,
  ReviewScope,
  ReviewScoringConfig,
  StickyNoteItem,
} from '../types/career';
import {
  assistResumeWithAi,
  generateCoverLetterWithAi,
} from '../services/aiService';
import {
  applyAssistResponseToResume,
  buildCoverLetterPayloadFromJob,
  buildTailoredJobLabel,
  evaluateQueuedJobEligibility,
  formatTaskReason,
} from '../services/jobTaskRunner';
import {
  createResumeFromProfile,
  DEFAULT_COVER_LETTER_FORMATTING,
  INITIAL_CAREER_PROFILE,
  INITIAL_COVER_LETTERS,
  INITIAL_JOBS,
  INITIAL_RESUMES,
} from '../data/defaultData';
import {
  DEFAULT_STICKY_CATEGORIES,
  DEFAULT_STICKY_NOTES,
} from '../data/stickyNotesData';
import { DEFAULT_REVIEW_SCORING_CONFIG } from '../services/reviewScoring';
import {
  OperationType,
  auth,
  clearDriveAccessToken,
  db,
  getDriveAccessToken,
  googleProvider,
  handleFirestoreError,
  hasDriveAccessToken,
  setDriveAccessToken,
  subscribeDriveTokenState,
} from '../firebase';
import {
  DriveAuthExpiredError,
  DriveUploadResult,
  exportCompanyResearchToGoogleDrive,
  exportCoverLetterToGoogleDrive,
  exportResumeToGoogleDrive,
  findOrCreateCareerEngineFolder,
} from '../services/googleDriveExport';
import { ensureStableProfileIds, stripUndefinedForFirestore } from '../utils/profileIds';

const STORAGE_KEY = 'career_engine_workspace_v1';
const STICKY_WINDOW_SESSION_KEY = 'career_engine_sticky_window_v1';

const DEFAULT_DRIVE_EXPORT_SETTINGS: DriveExportSettings = {
  autoExportEnabled: false,
  format: 'pdf',
  organizeByJobFolder: false,
};

export type WorkspaceSyncStatus = 'local' | 'syncing' | 'synced' | 'error';

interface PersistedWorkspace {
  profile: CareerProfile;
  jobs: JobApplication[];
  resumes: ResumeDocument[];
  coverLetters: CoverLetterDocument[];
  companies: CompanyProfile[];
  companyResearches: CompanyResearch[];
  jobMatches: JobMatch[];
  applicationReviews: ApplicationReviewRecord[];
  documentSnapshots: DocumentRevisionSnapshot[];
  aiWritingHistory: AIWritingSessionRecord[];
  reviewScoringConfig: ReviewScoringConfig;
  stickyNotes: StickyNoteItem[];
  stickyCategories: string[];
  driveExportSettings: DriveExportSettings;
  activeResumeId: string;
  activeCoverLetterId: string;
  activeReviewId: string;
}

export interface ReviewLaunchTarget {
  jobId?: string;
  resumeId?: string;
  coverLetterId?: string;
  scope?: ReviewScope;
}

export type AddJobInput = Omit<
  JobApplication,
  'id' | 'createdAt' | 'updatedAt' | 'company' | 'jobTitle'
> & {
  company?: string;
  jobTitle?: string;
};

interface CareerContextValue {
  // Auth & Cloud Sync State
  user: User | null;
  authLoading: boolean;
  syncStatus: WorkspaceSyncStatus;
  syncError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;

  // Google Drive Export & Auto-Sync
  driveConnected: boolean;
  driveExportSettings: DriveExportSettings;
  updateDriveExportSettings: (
    updater: (prev: DriveExportSettings) => DriveExportSettings
  ) => void;
  pendingDriveExports: PendingDriveExport[];
  driveError: string | null;
  clearDriveError: () => void;
  isFlushingDriveQueue: boolean;
  connectGoogleDrive: () => Promise<string | null>;
  exportDocumentToDrive: (params: {
    kind: 'resume' | 'cover-letter' | 'research';
    id: string;
    replaceExisting?: boolean;
  }) => Promise<DriveUploadResult | null>;
  notifyDocumentMilestoneExport: (
    kind: 'resume' | 'cover-letter' | 'research',
    id: string
  ) => void;
  flushPendingDriveExports: () => Promise<{ exported: number; failed: number }>;
  exportAllDocumentsToDrive: () => Promise<{ exported: number; failed: number }>;

  activeModule: AppModule;
  setActiveModule: (mod: AppModule) => void;

  profile: CareerProfile;
  updateProfile: (updater: (prev: CareerProfile) => CareerProfile) => void;

  jobs: JobApplication[];
  addJob: (job: AddJobInput) => JobApplication;
  updateJob: (
    id: string,
    updater: (prev: JobApplication) => JobApplication,
    options?: { immediate?: boolean }
  ) => void;
  queueJobTask: (jobId: string, task: JobTaskType) => void;
  deleteJob: (id: string) => void;

  // Sticky Notes (plain notes + popup window state)
  stickyNotes: StickyNoteItem[];
  stickyCategories: string[];
  addStickyNote: (
    note: Omit<StickyNoteItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => StickyNoteItem;
  updateStickyNote: (id: string, updater: (prev: StickyNoteItem) => StickyNoteItem) => void;
  deleteStickyNote: (id: string) => void;
  addStickyCategory: (category: string) => string;
  resetDemoStickyNotes: () => void;
  isStickyNotesOpen: boolean;
  isStickyNotesMinimized: boolean;
  openStickyNotes: () => void;
  closeStickyNotes: () => void;
  minimizeStickyNotes: () => void;
  restoreStickyNotes: () => void;

  resumes: ResumeDocument[];
  activeResumeId: string;
  setActiveResumeId: (id: string) => void;
  activeResume: ResumeDocument | undefined;
  createResume: (options?: { name?: string; fromProfile?: boolean; linkedJobId?: string }) => ResumeDocument;
  duplicateResume: (id: string, customName?: string, linkedJobId?: string) => ResumeDocument | undefined;
  renameResume: (id: string, newName: string) => void;
  updateResume: (id: string, updater: (prev: ResumeDocument) => ResumeDocument) => void;
  deleteResume: (id: string) => void;
  importProfileIntoResume: (resumeId: string) => void;

  coverLetters: CoverLetterDocument[];
  activeCoverLetterId: string;
  setActiveCoverLetterId: (id: string) => void;
  activeCoverLetter: CoverLetterDocument | undefined;
  createCoverLetter: (options?: {
    title?: string;
    linkedJobId?: string;
    linkedResumeId?: string;
    prefillFromProfile?: boolean;
  }) => CoverLetterDocument;
  duplicateCoverLetter: (id: string, customTitle?: string) => CoverLetterDocument | undefined;
  renameCoverLetter: (id: string, newTitle: string) => void;
  updateCoverLetter: (id: string, updater: (prev: CoverLetterDocument) => CoverLetterDocument) => void;
  deleteCoverLetter: (id: string) => void;

  // Cross-module actions from Job Tracker
  openTailoredResumeForJob: (jobId: string) => ResumeDocument | undefined;
  openCoverLetterForJob: (jobId: string, resumeId?: string) => CoverLetterDocument | undefined;

  // Company Intelligence & Job Matching
  selectedJobId: string;
  setSelectedJobId: (id: string) => void;
  companies: CompanyProfile[];
  companyResearches: CompanyResearch[];
  jobMatches: JobMatch[];
  getCompanyResearchForJob: (jobId: string) => CompanyResearch | undefined;
  getJobMatchForJob: (jobId: string) => JobMatch | undefined;
  saveCompanyResearch: (
    jobId: string,
    research: CompanyResearch,
    companyProfile: CompanyProfile
  ) => void;
  updateFindingStatus: (
    researchId: string,
    findingId: string,
    status: FindingVerificationStatus
  ) => void;
  saveJobMatch: (jobId: string, match: JobMatch) => void;

  // Application Review System & Undo Snapshots
  applicationReviews: ApplicationReviewRecord[];
  activeReviewId: string;
  setActiveReviewId: (id: string) => void;
  documentSnapshots: DocumentRevisionSnapshot[];
  reviewScoringConfig: ReviewScoringConfig;
  setReviewScoringConfig: React.Dispatch<React.SetStateAction<ReviewScoringConfig>>;
  reviewLaunchTarget: ReviewLaunchTarget | null;
  clearReviewLaunchTarget: () => void;
  openReviewCenter: (options?: ReviewLaunchTarget) => void;
  saveApplicationReview: (review: ApplicationReviewRecord) => void;
  updateReviewFinding: (
    reviewId: string,
    findingId: string,
    updater: (prev: ReviewFinding) => ReviewFinding
  ) => void;
  resolveFactDiscrepancy: (
    reviewId: string,
    discrepancyId: string,
    resolutionStatus: FactDiscrepancy['resolutionStatus']
  ) => void;
  applyReviewChanges: (reviewId: string, findingIds: string[]) => void;
  undoReviewSnapshot: (snapshotId: string) => void;

  // AI Writing Companion Persistence & Field History
  aiWritingHistory: AIWritingSessionRecord[];
  upsertAiWritingSession: (session: AIWritingSessionRecord) => void;
  recordDocumentSnapshot: (
    documentKind: 'resume' | 'cover-letter',
    documentId: string,
    sessionId: string,
    label: string
  ) => void;
  undoLatestSnapshotForDocument: (
    documentKind: 'resume' | 'cover-letter',
    documentId: string
  ) => void;

  lastSavedAt: string;
}

const CareerContext = createContext<CareerContextValue | null>(null);

function loadLocalWorkspace(): PersistedWorkspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>;
      const profile = ensureStableProfileIds(parsed.profile ?? INITIAL_CAREER_PROFILE);
      const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : INITIAL_JOBS;
      const resumes =
        Array.isArray(parsed.resumes) && parsed.resumes.length > 0
          ? parsed.resumes
          : INITIAL_RESUMES;
      const coverLetters =
        Array.isArray(parsed.coverLetters) && parsed.coverLetters.length > 0
          ? parsed.coverLetters
          : INITIAL_COVER_LETTERS;

      const companies = Array.isArray(parsed.companies) ? parsed.companies : [];
      const companyResearches = Array.isArray(parsed.companyResearches)
        ? parsed.companyResearches
        : [];
      const jobMatches = Array.isArray(parsed.jobMatches) ? parsed.jobMatches : [];
      const applicationReviews = Array.isArray(parsed.applicationReviews)
        ? parsed.applicationReviews
        : [];
      const documentSnapshots = Array.isArray(parsed.documentSnapshots)
        ? parsed.documentSnapshots
        : [];
      const aiWritingHistory = Array.isArray(parsed.aiWritingHistory)
        ? parsed.aiWritingHistory
        : [];
      const reviewScoringConfig =
        parsed.reviewScoringConfig && parsed.reviewScoringConfig.version
          ? parsed.reviewScoringConfig
          : DEFAULT_REVIEW_SCORING_CONFIG;
      const stickyNotes = Array.isArray(parsed.stickyNotes)
        ? parsed.stickyNotes
        : DEFAULT_STICKY_NOTES;
      const stickyCategories =
        Array.isArray(parsed.stickyCategories) && parsed.stickyCategories.length > 0
          ? parsed.stickyCategories
          : DEFAULT_STICKY_CATEGORIES;
      const driveExportSettings: DriveExportSettings = parsed.driveExportSettings
        ? {
            autoExportEnabled: Boolean(parsed.driveExportSettings.autoExportEnabled),
            format:
              parsed.driveExportSettings.format === 'docx' ||
              parsed.driveExportSettings.format === 'google_doc'
                ? parsed.driveExportSettings.format
                : 'pdf',
            organizeByJobFolder: Boolean(parsed.driveExportSettings.organizeByJobFolder),
            folderId: parsed.driveExportSettings.folderId,
            folderWebViewLink: parsed.driveExportSettings.folderWebViewLink,
          }
        : DEFAULT_DRIVE_EXPORT_SETTINGS;

      return {
        profile,
        jobs,
        resumes,
        coverLetters,
        companies,
        companyResearches,
        jobMatches,
        applicationReviews,
        documentSnapshots,
        aiWritingHistory,
        reviewScoringConfig,
        stickyNotes,
        stickyCategories,
        driveExportSettings,
        activeResumeId:
          parsed.activeResumeId && resumes.some((r) => r.id === parsed.activeResumeId)
            ? parsed.activeResumeId
            : resumes[0].id,
        activeCoverLetterId:
          parsed.activeCoverLetterId && coverLetters.some((c) => c.id === parsed.activeCoverLetterId)
            ? parsed.activeCoverLetterId
            : coverLetters[0].id,
        activeReviewId:
          parsed.activeReviewId &&
          applicationReviews.some((rv) => rv.id === parsed.activeReviewId)
            ? parsed.activeReviewId
            : applicationReviews[0]?.id || '',
      };
    }
  } catch {
    // Fallback to initial workspace if localStorage is unavailable or corrupt
  }

  return {
    profile: ensureStableProfileIds(INITIAL_CAREER_PROFILE),
    jobs: INITIAL_JOBS,
    resumes: INITIAL_RESUMES,
    coverLetters: INITIAL_COVER_LETTERS,
    companies: [],
    companyResearches: [],
    jobMatches: [],
    applicationReviews: [],
    documentSnapshots: [],
    aiWritingHistory: [],
    reviewScoringConfig: DEFAULT_REVIEW_SCORING_CONFIG,
    stickyNotes: DEFAULT_STICKY_NOTES,
    stickyCategories: DEFAULT_STICKY_CATEGORIES,
    driveExportSettings: DEFAULT_DRIVE_EXPORT_SETTINGS,
    activeResumeId: INITIAL_RESUMES[0].id,
    activeCoverLetterId: INITIAL_COVER_LETTERS[0].id,
    activeReviewId: '',
  };
}

function loadStickyWindowSessionState(): { isOpen: boolean; isMinimized: boolean } {
  try {
    const raw = sessionStorage.getItem(STICKY_WINDOW_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<{ isOpen: boolean; isMinimized: boolean }>;
      return {
        isOpen: Boolean(parsed.isOpen),
        isMinimized: Boolean(parsed.isOpen && parsed.isMinimized),
      };
    }
  } catch {
    // Ignore sessionStorage read errors
  }
  return { isOpen: false, isMinimized: false };
}

export function CareerProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState<PersistedWorkspace>(() => loadLocalWorkspace());
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<WorkspaceSyncStatus>('local');
  const [syncError, setSyncError] = useState<string | null>(null);

  const [activeModule, setActiveModule] = useState<AppModule>('resumes');
  const [profile, setProfile] = useState<CareerProfile>(initial.profile);
  const [jobs, setJobs] = useState<JobApplication[]>(initial.jobs);
  const [resumes, setResumes] = useState<ResumeDocument[]>(initial.resumes);
  const [coverLetters, setCoverLetters] = useState<CoverLetterDocument[]>(initial.coverLetters);
  const [companies, setCompanies] = useState<CompanyProfile[]>(initial.companies);
  const [companyResearches, setCompanyResearches] = useState<CompanyResearch[]>(
    initial.companyResearches
  );
  const [jobMatches, setJobMatches] = useState<JobMatch[]>(initial.jobMatches);
  const [applicationReviews, setApplicationReviews] = useState<ApplicationReviewRecord[]>(
    initial.applicationReviews
  );
  const [documentSnapshots, setDocumentSnapshots] = useState<DocumentRevisionSnapshot[]>(
    initial.documentSnapshots
  );
  const [aiWritingHistory, setAiWritingHistory] = useState<AIWritingSessionRecord[]>(
    initial.aiWritingHistory
  );
  const [reviewScoringConfig, setReviewScoringConfig] = useState<ReviewScoringConfig>(
    initial.reviewScoringConfig
  );
  const [stickyNotes, setStickyNotes] = useState<StickyNoteItem[]>(initial.stickyNotes);
  const [stickyCategories, setStickyCategories] = useState<string[]>(initial.stickyCategories);
  const [driveExportSettings, setDriveExportSettings] = useState<DriveExportSettings>(
    initial.driveExportSettings
  );
  const [driveConnected, setDriveConnected] = useState<boolean>(() => hasDriveAccessToken());
  const [pendingDriveExports, setPendingDriveExports] = useState<PendingDriveExport[]>([]);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [isFlushingDriveQueue, setIsFlushingDriveQueue] = useState<boolean>(false);
  const [initialStickyWindow] = useState(() => loadStickyWindowSessionState());
  const [isStickyNotesOpen, setIsStickyNotesOpen] = useState<boolean>(initialStickyWindow.isOpen);
  const [isStickyNotesMinimized, setIsStickyNotesMinimized] = useState<boolean>(
    initialStickyWindow.isMinimized
  );
  const [activeReviewId, setActiveReviewId] = useState<string>(initial.activeReviewId);
  const [reviewLaunchTarget, setReviewLaunchTarget] = useState<ReviewLaunchTarget | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>(initial.jobs[0]?.id || '');
  const [activeResumeId, setActiveResumeId] = useState<string>(initial.activeResumeId);
  const [activeCoverLetterId, setActiveCoverLetterId] = useState<string>(initial.activeCoverLetterId);
  const [lastSavedAt, setLastSavedAt] = useState<string>(new Date().toISOString());

  // Refs for latest local snapshot, debounced Firestore writes, and sequential AI task execution
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isTaskRunningRef = useRef(false);
  const pendingDriveExportsRef = useRef<PendingDriveExport[]>(pendingDriveExports);
  pendingDriveExportsRef.current = pendingDriveExports;
  const stateRef = useRef({
    profile,
    jobs,
    resumes,
    coverLetters,
    companies,
    companyResearches,
    jobMatches,
    applicationReviews,
    documentSnapshots,
    aiWritingHistory,
    reviewScoringConfig,
    stickyNotes,
    stickyCategories,
    driveExportSettings,
    activeResumeId,
    activeCoverLetterId,
    activeReviewId,
  });
  stateRef.current = {
    profile,
    jobs,
    resumes,
    coverLetters,
    companies,
    companyResearches,
    jobMatches,
    applicationReviews,
    documentSnapshots,
    aiWritingHistory,
    reviewScoringConfig,
    stickyNotes,
    stickyCategories,
    driveExportSettings,
    activeResumeId,
    activeCoverLetterId,
    activeReviewId,
  };

  // Clear pending debounce timers on unmount
  useEffect(() => {
    return () => {
      debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
      debounceTimersRef.current.clear();
    };
  }, []);

  // Persist Sticky Notes open/minimized state for the current session
  useEffect(() => {
    try {
      sessionStorage.setItem(
        STICKY_WINDOW_SESSION_KEY,
        JSON.stringify({
          isOpen: isStickyNotesOpen,
          isMinimized: isStickyNotesMinimized,
        })
      );
    } catch {
      // Ignore sessionStorage write errors
    }
  }, [isStickyNotesOpen, isStickyNotesMinimized]);

  // Signed-out localStorage fallback persistence (also keeps local copy warm)
  useEffect(() => {
    try {
      const payload: PersistedWorkspace = {
        profile,
        jobs,
        resumes,
        coverLetters,
        companies,
        companyResearches,
        jobMatches,
        applicationReviews,
        documentSnapshots,
        aiWritingHistory,
        reviewScoringConfig,
        stickyNotes,
        stickyCategories,
        driveExportSettings,
        activeResumeId,
        activeCoverLetterId,
        activeReviewId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setLastSavedAt(new Date().toISOString());
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [
    profile,
    jobs,
    resumes,
    coverLetters,
    companies,
    companyResearches,
    jobMatches,
    applicationReviews,
    documentSnapshots,
    aiWritingHistory,
    reviewScoringConfig,
    stickyNotes,
    stickyCategories,
    driveExportSettings,
    activeResumeId,
    activeCoverLetterId,
    activeReviewId,
  ]);

  const writeDocToFirestore = useCallback(
    async (
      segments: [string, ...string[]],
      data: unknown,
      op: OperationType = OperationType.WRITE
    ) => {
      const path = segments.join('/');
      try {
        await setDoc(doc(db, ...segments), stripUndefinedForFirestore(data));
        setSyncStatus('synced');
        setSyncError(null);
        setLastSavedAt(new Date().toISOString());
      } catch (err) {
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Failed to sync changes to Firestore.');
        handleFirestoreError(err, op, path);
      }
    },
    []
  );

  const scheduleDocWrite = useCallback(
    (segments: [string, ...string[]], data: unknown, delayMs = 300) => {
      if (!user) return;
      const key = segments.join('/');
      const existingTimer = debounceTimersRef.current.get(key);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        debounceTimersRef.current.delete(key);
        void writeDocToFirestore(segments, data, OperationType.WRITE).catch(() => {
          // Error already captured in syncError & logged via handleFirestoreError
        });
      }, delayMs);

      debounceTimersRef.current.set(key, timer);
    },
    [user, writeDocToFirestore]
  );

  const writeDocImmediate = useCallback(
    (segments: [string, ...string[]], data: unknown, op: OperationType = OperationType.WRITE) => {
      if (!user) return;
      const key = segments.join('/');
      const existingTimer = debounceTimersRef.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimersRef.current.delete(key);
      }
      void writeDocToFirestore(segments, data, op).catch(() => {
        // Error already captured in syncError & logged via handleFirestoreError
      });
    },
    [user, writeDocToFirestore]
  );

  const deleteDocImmediate = useCallback(
    (segments: [string, ...string[]]) => {
      if (!user) return;
      const key = segments.join('/');
      const existingTimer = debounceTimersRef.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimersRef.current.delete(key);
      }
      void deleteDoc(doc(db, ...segments))
        .then(() => {
          setSyncStatus('synced');
          setSyncError(null);
          setLastSavedAt(new Date().toISOString());
        })
        .catch((err) => {
          setSyncStatus('error');
          setSyncError(err instanceof Error ? err.message : 'Failed to delete Firestore document.');
          try {
            handleFirestoreError(err, OperationType.DELETE, key);
          } catch {
            // Logged
          }
        });
    },
    [user]
  );

  // Keep in-memory Drive token subscription in sync
  useEffect(() => {
    setDriveConnected(hasDriveAccessToken());
    return subscribeDriveTokenState(setDriveConnected);
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (!firebaseUser) {
        clearDriveAccessToken();
        setPendingDriveExports([]);
        setDriveError(null);
        setSyncStatus('local');
        setSyncError(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore real-time synchronization & first-login cloud seeding
  useEffect(() => {
    if (!user) return;

    const uid = user.uid;
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    setSyncStatus('syncing');
    setSyncError(null);

    const seedCloudWorkspaceIfEmpty = async () => {
      const profileRef = doc(db, 'users', uid, 'profile', 'master');
      let profileSnap;
      try {
        profileSnap = await getDoc(profileRef);
      } catch (err) {
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Unable to read cloud profile.');
        try {
          handleFirestoreError(err, OperationType.GET, `users/${uid}/profile/master`);
        } catch {
          // Logged
        }
        return false;
      }

      if (cancelled) return false;

      if (!profileSnap.exists()) {
        const snapshot = stateRef.current;
        const normalizedProfile = ensureStableProfileIds(snapshot.profile);
        const batch = writeBatch(db);

        batch.set(profileRef, stripUndefinedForFirestore(normalizedProfile));

        snapshot.jobs.forEach((job) => {
          batch.set(doc(db, 'users', uid, 'jobs', job.id), stripUndefinedForFirestore(job));
        });
        snapshot.resumes.forEach((resDoc) => {
          batch.set(doc(db, 'users', uid, 'resumes', resDoc.id), stripUndefinedForFirestore(resDoc));
        });
        snapshot.coverLetters.forEach((clDoc) => {
          batch.set(
            doc(db, 'users', uid, 'coverLetters', clDoc.id),
            stripUndefinedForFirestore(clDoc)
          );
        });
        snapshot.companyResearches.forEach((cr) => {
          batch.set(
            doc(db, 'users', uid, 'companyResearch', cr.id),
            stripUndefinedForFirestore(cr)
          );
        });
        snapshot.companies.forEach((comp) => {
          batch.set(
            doc(db, 'users', uid, 'companies', comp.id),
            stripUndefinedForFirestore(comp)
          );
        });
        snapshot.jobMatches.forEach((m) => {
          batch.set(doc(db, 'users', uid, 'jobMatches', m.id), stripUndefinedForFirestore(m));
        });
        snapshot.applicationReviews.forEach((rev) => {
          batch.set(doc(db, 'users', uid, 'reviews', rev.id), stripUndefinedForFirestore(rev));
        });
        snapshot.documentSnapshots.forEach((snapDoc) => {
          batch.set(
            doc(db, 'users', uid, 'snapshots', snapDoc.id),
            stripUndefinedForFirestore(snapDoc)
          );
        });
        snapshot.aiWritingHistory.forEach((sess) => {
          batch.set(
            doc(db, 'users', uid, 'aiWritingSessions', sess.id),
            stripUndefinedForFirestore(sess)
          );
        });
        snapshot.stickyNotes.forEach((note) => {
          batch.set(
            doc(db, 'users', uid, 'stickyNotes', note.id),
            stripUndefinedForFirestore(note)
          );
        });
        batch.set(
          doc(db, 'users', uid, 'workspace', 'stickyNotesMeta'),
          stripUndefinedForFirestore({
            categories: snapshot.stickyCategories,
            seeded: true,
            updatedAt: new Date().toISOString(),
          })
        );
        batch.set(
          doc(db, 'users', uid, 'workspace', 'preferences'),
          stripUndefinedForFirestore({
            activeResumeId: snapshot.activeResumeId,
            activeCoverLetterId: snapshot.activeCoverLetterId,
            activeReviewId: snapshot.activeReviewId,
            reviewScoringConfig: snapshot.reviewScoringConfig,
            driveExportSettings: snapshot.driveExportSettings,
            updatedAt: new Date().toISOString(),
          })
        );

        try {
          await batch.commit();
        } catch (err) {
          setSyncStatus('error');
          setSyncError(err instanceof Error ? err.message : 'Failed to initialize cloud workspace.');
          try {
            handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
          } catch {
            // Logged
          }
          return false;
        }
      } else {
        // Seed sticky notes once for accounts created in Part 1 before stickyNotes existed
        const stickyMetaRef = doc(db, 'users', uid, 'workspace', 'stickyNotesMeta');
        try {
          const stickyMetaSnap = await getDoc(stickyMetaRef);
          if (!stickyMetaSnap.exists() && !cancelled) {
            const snapshot = stateRef.current;
            const stickyBatch = writeBatch(db);
            snapshot.stickyNotes.forEach((note) => {
              stickyBatch.set(
                doc(db, 'users', uid, 'stickyNotes', note.id),
                stripUndefinedForFirestore(note)
              );
            });
            stickyBatch.set(
              stickyMetaRef,
              stripUndefinedForFirestore({
                categories: snapshot.stickyCategories,
                seeded: true,
                updatedAt: new Date().toISOString(),
              })
            );
            await stickyBatch.commit();
          }
        } catch (err) {
          setSyncStatus('error');
          setSyncError(err instanceof Error ? err.message : 'Unable to sync sticky notes metadata.');
          try {
            handleFirestoreError(err, OperationType.WRITE, `users/${uid}/workspace/stickyNotesMeta`);
          } catch {
            // Logged
          }
          return false;
        }
      }
      return true;
    };

    const attachListeners = async () => {
      const ok = await seedCloudWorkspaceIfEmpty();
      if (!ok || cancelled) return;

      const onListenerError = (path: string) => (err: unknown) => {
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : `Firestore sync error on ${path}`);
        try {
          handleFirestoreError(err, OperationType.GET, path);
        } catch {
          // Logged
        }
      };

      unsubs.push(
        onSnapshot(
          doc(db, 'users', uid, 'profile', 'master'),
          (snap) => {
            if (snap.exists()) {
              setProfile(ensureStableProfileIds(snap.data() as CareerProfile));
            }
            setSyncStatus('synced');
          },
          onListenerError(`users/${uid}/profile/master`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'jobs'),
          (snap) => {
            const list = snap.docs
              .map((d) => d.data() as JobApplication)
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setJobs(list);
            setSelectedJobId((prev) =>
              prev && list.some((j) => j.id === prev) ? prev : list[0]?.id || ''
            );
            setSyncStatus('synced');
          },
          onListenerError(`users/${uid}/jobs`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'resumes'),
          (snap) => {
            const list = snap.docs
              .map((d) => d.data() as ResumeDocument)
              .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
            if (list.length > 0) {
              setResumes(list);
              setActiveResumeId((prev) =>
                prev && list.some((r) => r.id === prev) ? prev : list[0].id
              );
            }
            setSyncStatus('synced');
          },
          onListenerError(`users/${uid}/resumes`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'coverLetters'),
          (snap) => {
            const list = snap.docs
              .map((d) => d.data() as CoverLetterDocument)
              .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
            if (list.length > 0) {
              setCoverLetters(list);
              setActiveCoverLetterId((prev) =>
                prev && list.some((c) => c.id === prev) ? prev : list[0].id
              );
            }
            setSyncStatus('synced');
          },
          onListenerError(`users/${uid}/coverLetters`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'companyResearch'),
          (snap) => {
            setCompanyResearches(snap.docs.map((d) => d.data() as CompanyResearch));
          },
          onListenerError(`users/${uid}/companyResearch`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'companies'),
          (snap) => {
            setCompanies(snap.docs.map((d) => d.data() as CompanyProfile));
          },
          onListenerError(`users/${uid}/companies`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'jobMatches'),
          (snap) => {
            setJobMatches(snap.docs.map((d) => d.data() as JobMatch));
          },
          onListenerError(`users/${uid}/jobMatches`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'reviews'),
          (snap) => {
            const list = snap.docs
              .map((d) => d.data() as ApplicationReviewRecord)
              .sort((a, b) => (b.reviewDate || '').localeCompare(a.reviewDate || ''));
            setApplicationReviews(list);
          },
          onListenerError(`users/${uid}/reviews`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'snapshots'),
          (snap) => {
            const list = snap.docs
              .map((d) => d.data() as DocumentRevisionSnapshot)
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setDocumentSnapshots(list);
          },
          onListenerError(`users/${uid}/snapshots`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'aiWritingSessions'),
          (snap) => {
            const list = snap.docs
              .map((d) => d.data() as AIWritingSessionRecord)
              .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
            setAiWritingHistory(list.slice(0, 120));
          },
          onListenerError(`users/${uid}/aiWritingSessions`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'stickyNotes'),
          (snap) => {
            const list = snap.docs
              .map((d) => d.data() as StickyNoteItem)
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setStickyNotes(list);
          },
          onListenerError(`users/${uid}/stickyNotes`)
        )
      );

      unsubs.push(
        onSnapshot(
          doc(db, 'users', uid, 'workspace', 'stickyNotesMeta'),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as Partial<{ categories: string[] }>;
              if (Array.isArray(data.categories) && data.categories.length > 0) {
                setStickyCategories(data.categories);
              }
            }
          },
          onListenerError(`users/${uid}/workspace/stickyNotesMeta`)
        )
      );

      unsubs.push(
        onSnapshot(
          doc(db, 'users', uid, 'workspace', 'preferences'),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as Partial<{
                reviewScoringConfig: ReviewScoringConfig;
                driveExportSettings: DriveExportSettings;
                activeResumeId: string;
                activeCoverLetterId: string;
                activeReviewId: string;
              }>;
              if (data.reviewScoringConfig?.version) {
                setReviewScoringConfig(data.reviewScoringConfig);
              }
              if (data.driveExportSettings) {
                setDriveExportSettings((prev) => ({
                  ...prev,
                  autoExportEnabled: Boolean(data.driveExportSettings?.autoExportEnabled),
                  format:
                    data.driveExportSettings?.format === 'docx' ||
                    data.driveExportSettings?.format === 'google_doc'
                      ? data.driveExportSettings.format
                      : 'pdf',
                  organizeByJobFolder: Boolean(data.driveExportSettings?.organizeByJobFolder),
                  folderId: data.driveExportSettings?.folderId || prev.folderId,
                  folderWebViewLink:
                    data.driveExportSettings?.folderWebViewLink || prev.folderWebViewLink,
                }));
              }
              if (data.activeReviewId) {
                setActiveReviewId(data.activeReviewId);
              }
            }
          },
          onListenerError(`users/${uid}/workspace/preferences`)
        )
      );
    };

    void attachListeners();

    return () => {
      cancelled = true;
      unsubs.forEach((unsub) => unsub());
    };
  }, [user]);

  const updateDriveExportSettings = useCallback(
    (updater: (prev: DriveExportSettings) => DriveExportSettings) => {
      setDriveExportSettings((prev) => {
        const next = updater(prev);
        if (user) {
          const snapshot = stateRef.current;
          writeDocImmediate(
            ['users', user.uid, 'workspace', 'preferences'],
            {
              activeResumeId: snapshot.activeResumeId,
              activeCoverLetterId: snapshot.activeCoverLetterId,
              activeReviewId: snapshot.activeReviewId,
              reviewScoringConfig: snapshot.reviewScoringConfig,
              driveExportSettings: next,
              updatedAt: new Date().toISOString(),
            },
            OperationType.WRITE
          );
        }
        return next;
      });
    },
    [user, writeDocImmediate]
  );

  const enqueuePendingDriveExport = useCallback(
    (kind: 'resume' | 'cover-letter' | 'research', id: string, title: string) => {
      setPendingDriveExports((prev) => {
        if (prev.some((item) => item.kind === kind && item.id === id)) {
          return prev;
        }
        return [
          ...prev,
          {
            kind,
            id,
            title,
            queuedAt: new Date().toISOString(),
          },
        ];
      });
    },
    []
  );

  const dequeuePendingDriveExport = useCallback(
    (kind: 'resume' | 'cover-letter' | 'research', id: string) => {
      setPendingDriveExports((prev) =>
        prev.filter((item) => !(item.kind === kind && item.id === id))
      );
    },
    []
  );

  const applyDriveResultToDocument = useCallback(
    (
      kind: 'resume' | 'cover-letter' | 'research',
      id: string,
      result: DriveUploadResult
    ) => {
      const uid = auth.currentUser?.uid || user?.uid;
      if (kind === 'resume') {
        setResumes((prev) =>
          prev.map((r) => {
            if (r.id !== id) return r;
            const updated: ResumeDocument = {
              ...r,
              driveFileId: result.fileId,
              driveWebViewLink: result.webViewLink,
              driveExportedAt: result.exportedAt,
              driveFolderName: result.folderName,
              driveSyncStatus: 'synced',
              driveSyncError: undefined,
            };
            if (uid) {
              writeDocImmediate(['users', uid, 'resumes', id], updated, OperationType.UPDATE);
            }
            return updated;
          })
        );
      } else if (kind === 'cover-letter') {
        setCoverLetters((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            const updated: CoverLetterDocument = {
              ...c,
              driveFileId: result.fileId,
              driveWebViewLink: result.webViewLink,
              driveExportedAt: result.exportedAt,
              driveFolderName: result.folderName,
              driveSyncStatus: 'synced',
              driveSyncError: undefined,
            };
            if (uid) {
              writeDocImmediate(['users', uid, 'coverLetters', id], updated, OperationType.UPDATE);
            }
            return updated;
          })
        );
      } else {
        setCompanyResearches((prev) =>
          prev.map((res) => {
            if (res.id !== id) return res;
            const updated: CompanyResearch = {
              ...res,
              driveFileId: result.fileId,
              driveWebViewLink: result.webViewLink,
              driveExportedAt: result.exportedAt,
              driveFolderName: result.folderName,
              driveSyncStatus: 'synced',
              driveSyncError: undefined,
            };
            if (uid) {
              writeDocImmediate(
                ['users', uid, 'companyResearch', id],
                updated,
                OperationType.UPDATE
              );
            }
            return updated;
          })
        );
      }
      dequeuePendingDriveExport(kind, id);
    },
    [dequeuePendingDriveExport, user, writeDocImmediate]
  );

  const markDocumentDriveStatus = useCallback(
    (
      kind: 'resume' | 'cover-letter' | 'research',
      id: string,
      status: 'pending_auth' | 'error',
      errorMsg?: string
    ) => {
      const uid = auth.currentUser?.uid || user?.uid;
      if (kind === 'resume') {
        setResumes((prev) =>
          prev.map((r) => {
            if (r.id !== id) return r;
            const updated: ResumeDocument = {
              ...r,
              driveSyncStatus: status,
              driveSyncError: errorMsg,
            };
            if (uid) {
              writeDocImmediate(['users', uid, 'resumes', id], updated, OperationType.UPDATE);
            }
            return updated;
          })
        );
      } else if (kind === 'cover-letter') {
        setCoverLetters((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            const updated: CoverLetterDocument = {
              ...c,
              driveSyncStatus: status,
              driveSyncError: errorMsg,
            };
            if (uid) {
              writeDocImmediate(['users', uid, 'coverLetters', id], updated, OperationType.UPDATE);
            }
            return updated;
          })
        );
      } else {
        setCompanyResearches((prev) =>
          prev.map((res) => {
            if (res.id !== id) return res;
            const updated: CompanyResearch = {
              ...res,
              driveSyncStatus: status,
              driveSyncError: errorMsg,
            };
            if (uid) {
              writeDocImmediate(
                ['users', uid, 'companyResearch', id],
                updated,
                OperationType.UPDATE
              );
            }
            return updated;
          })
        );
      }
    },
    [user, writeDocImmediate]
  );

  const executeSingleDriveUpload = useCallback(
    async (params: {
      accessToken: string;
      kind: 'resume' | 'cover-letter' | 'research';
      id: string;
      overrideDoc?: ResumeDocument | CoverLetterDocument | CompanyResearch;
      overrideLinkedJob?: JobApplication;
      replaceExisting?: boolean;
    }): Promise<DriveUploadResult | null> => {
      const snapshot = stateRef.current;
      const settings = snapshot.driveExportSettings;

      if (params.kind === 'resume') {
        const resume =
          (params.overrideDoc as ResumeDocument | undefined) ||
          snapshot.resumes.find((r) => r.id === params.id);
        if (!resume) return null;
        const linkedJob =
          params.overrideLinkedJob ||
          (resume.linkedJobId
            ? snapshot.jobs.find((j) => j.id === resume.linkedJobId)
            : undefined);

        const result = await exportResumeToGoogleDrive({
          accessToken: params.accessToken,
          resume,
          format: settings.format,
          linkedJob,
          organizeByJobFolder: settings.organizeByJobFolder,
          existingFileIdToReplace: params.replaceExisting ? resume.driveFileId : undefined,
        });
        applyDriveResultToDocument('resume', resume.id, result);
        if (
          result.folderId &&
          (settings.folderId !== result.folderId ||
            settings.folderWebViewLink !== result.folderWebViewLink)
        ) {
          updateDriveExportSettings((prev) => ({
            ...prev,
            folderId: result.folderId,
            folderWebViewLink: result.folderWebViewLink,
          }));
        }
        return result;
      }

      if (params.kind === 'cover-letter') {
        const letter =
          (params.overrideDoc as CoverLetterDocument | undefined) ||
          snapshot.coverLetters.find((c) => c.id === params.id);
        if (!letter) return null;
        const linkedJob =
          params.overrideLinkedJob ||
          (letter.linkedJobId
            ? snapshot.jobs.find((j) => j.id === letter.linkedJobId)
            : undefined);

        const result = await exportCoverLetterToGoogleDrive({
          accessToken: params.accessToken,
          letter,
          format: settings.format,
          linkedJob,
          organizeByJobFolder: settings.organizeByJobFolder,
          existingFileIdToReplace: params.replaceExisting ? letter.driveFileId : undefined,
        });
        applyDriveResultToDocument('cover-letter', letter.id, result);
        if (
          result.folderId &&
          (settings.folderId !== result.folderId ||
            settings.folderWebViewLink !== result.folderWebViewLink)
        ) {
          updateDriveExportSettings((prev) => ({
            ...prev,
            folderId: result.folderId,
            folderWebViewLink: result.folderWebViewLink,
          }));
        }
        return result;
      }

      const research =
        (params.overrideDoc as CompanyResearch | undefined) ||
        snapshot.companyResearches.find((r) => r.id === params.id);
      if (!research || research.status !== 'completed') return null;
      const linkedJob =
        params.overrideLinkedJob ||
        snapshot.jobs.find((j) => j.id === research.jobApplicationId);

      const result = await exportCompanyResearchToGoogleDrive({
        accessToken: params.accessToken,
        research,
        format: settings.format,
        linkedJob,
        organizeByJobFolder: settings.organizeByJobFolder,
        existingFileIdToReplace: params.replaceExisting ? research.driveFileId : undefined,
      });
      applyDriveResultToDocument('research', research.id, result);
      if (
        result.folderId &&
        (settings.folderId !== result.folderId ||
          settings.folderWebViewLink !== result.folderWebViewLink)
      ) {
        updateDriveExportSettings((prev) => ({
          ...prev,
          folderId: result.folderId,
          folderWebViewLink: result.folderWebViewLink,
        }));
      }
      return result;
    },
    [applyDriveResultToDocument, updateDriveExportSettings]
  );

  const flushPendingDriveExportsWithToken = useCallback(
    async (accessToken: string): Promise<{ exported: number; failed: number }> => {
      const queue = [...pendingDriveExportsRef.current];
      if (queue.length === 0) return { exported: 0, failed: 0 };

      setIsFlushingDriveQueue(true);
      let exported = 0;
      let failed = 0;
      try {
        for (const item of queue) {
          try {
            const res = await executeSingleDriveUpload({
              accessToken,
              kind: item.kind,
              id: item.id,
            });
            if (res) {
              exported += 1;
            } else {
              dequeuePendingDriveExport(item.kind, item.id);
            }
          } catch (err) {
            if (err instanceof DriveAuthExpiredError) {
              clearDriveAccessToken();
              setDriveError(err.message);
              markDocumentDriveStatus(item.kind, item.id, 'pending_auth', err.message);
              failed += 1;
              break;
            }
            const msg = err instanceof Error ? err.message : 'Google Drive upload failed.';
            setDriveError(msg);
            markDocumentDriveStatus(item.kind, item.id, 'error', msg);
            failed += 1;
          }
        }
      } finally {
        setIsFlushingDriveQueue(false);
      }
      return { exported, failed };
    },
    [dequeuePendingDriveExport, executeSingleDriveUpload, markDocumentDriveStatus]
  );

  const flushPendingDriveExports = useCallback(async (): Promise<{
    exported: number;
    failed: number;
  }> => {
    const token = getDriveAccessToken();
    if (!token) {
      return { exported: 0, failed: pendingDriveExportsRef.current.length };
    }
    return flushPendingDriveExportsWithToken(token);
  }, [flushPendingDriveExportsWithToken]);

  const connectGoogleDrive = useCallback(async (): Promise<string | null> => {
    setSyncError(null);
    setDriveError(null);
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || null;
    if (!accessToken) {
      const msg =
        'Google Drive permission token was not returned by sign-in. Please allow Google Drive access when prompted.';
      setDriveError(msg);
      return null;
    }

    setDriveAccessToken(accessToken);
    try {
      const folder = await findOrCreateCareerEngineFolder(accessToken);
      updateDriveExportSettings((prev) => ({
        ...prev,
        folderId: folder.id,
        folderWebViewLink: folder.webViewLink,
      }));
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        clearDriveAccessToken();
        setDriveError(err.message);
        return null;
      }
      // Folder creation can also retry on next upload
    }

    if (pendingDriveExportsRef.current.length > 0) {
      void flushPendingDriveExportsWithToken(accessToken);
    }

    return accessToken;
  }, [flushPendingDriveExportsWithToken, updateDriveExportSettings]);

  const signInWithGoogle = useCallback(async () => {
    setSyncError(null);
    setDriveError(null);
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setDriveAccessToken(credential.accessToken);
      if (pendingDriveExportsRef.current.length > 0) {
        void flushPendingDriveExportsWithToken(credential.accessToken);
      }
    }
  }, [flushPendingDriveExportsWithToken]);

  const signOutUser = useCallback(async () => {
    debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
    debounceTimersRef.current.clear();
    clearDriveAccessToken();
    setPendingDriveExports([]);
    setDriveError(null);
    await signOut(auth);
  }, []);

  const clearDriveError = useCallback(() => {
    setDriveError(null);
  }, []);

  const getDocTitleForQueue = useCallback(
    (
      kind: 'resume' | 'cover-letter' | 'research',
      id: string,
      overrideDoc?: ResumeDocument | CoverLetterDocument | CompanyResearch
    ): string => {
      const snapshot = stateRef.current;
      if (kind === 'resume') {
        const docItem =
          (overrideDoc as ResumeDocument | undefined) ||
          snapshot.resumes.find((r) => r.id === id);
        return docItem?.name || 'Resume';
      }
      if (kind === 'cover-letter') {
        const docItem =
          (overrideDoc as CoverLetterDocument | undefined) ||
          snapshot.coverLetters.find((c) => c.id === id);
        return docItem?.title || 'Cover Letter';
      }
      const resItem =
        (overrideDoc as CompanyResearch | undefined) ||
        snapshot.companyResearches.find((r) => r.id === id);
      return resItem ? `${resItem.companyName} — Company Intelligence` : 'Company Intelligence';
    },
    []
  );

  const autoExportMilestone = useCallback(
    async (params: {
      kind: 'resume' | 'cover-letter' | 'research';
      id: string;
      overrideDoc?: ResumeDocument | CoverLetterDocument | CompanyResearch;
      overrideLinkedJob?: JobApplication;
    }) => {
      if (!stateRef.current.driveExportSettings.autoExportEnabled) return;
      const title = getDocTitleForQueue(params.kind, params.id, params.overrideDoc);
      const token = getDriveAccessToken();
      if (!token) {
        enqueuePendingDriveExport(params.kind, params.id, title);
        markDocumentDriveStatus(
          params.kind,
          params.id,
          'pending_auth',
          'Connect Google Drive to auto-export to Career Engine DOC.'
        );
        return;
      }

      try {
        await executeSingleDriveUpload({
          accessToken: token,
          kind: params.kind,
          id: params.id,
          overrideDoc: params.overrideDoc,
          overrideLinkedJob: params.overrideLinkedJob,
        });
      } catch (err) {
        if (err instanceof DriveAuthExpiredError) {
          clearDriveAccessToken();
          setDriveError(err.message);
          enqueuePendingDriveExport(params.kind, params.id, title);
          markDocumentDriveStatus(params.kind, params.id, 'pending_auth', err.message);
        } else {
          const msg = err instanceof Error ? err.message : 'Auto-export to Google Drive failed.';
          setDriveError(msg);
          markDocumentDriveStatus(params.kind, params.id, 'error', msg);
        }
      }
    },
    [
      enqueuePendingDriveExport,
      executeSingleDriveUpload,
      getDocTitleForQueue,
      markDocumentDriveStatus,
    ]
  );

  const notifyDocumentMilestoneExport = useCallback(
    (kind: 'resume' | 'cover-letter' | 'research', id: string) => {
      void autoExportMilestone({ kind, id });
    },
    [autoExportMilestone]
  );

  const exportDocumentToDrive = useCallback(
    async (params: {
      kind: 'resume' | 'cover-letter' | 'research';
      id: string;
      replaceExisting?: boolean;
    }): Promise<DriveUploadResult | null> => {
      setDriveError(null);
      let token = getDriveAccessToken();
      if (!token) {
        token = await connectGoogleDrive();
      }
      if (!token) {
        const title = getDocTitleForQueue(params.kind, params.id);
        enqueuePendingDriveExport(params.kind, params.id, title);
        markDocumentDriveStatus(
          params.kind,
          params.id,
          'pending_auth',
          'Connect Google Drive to export to Career Engine DOC.'
        );
        return null;
      }

      try {
        return await executeSingleDriveUpload({
          accessToken: token,
          kind: params.kind,
          id: params.id,
          replaceExisting: params.replaceExisting,
        });
      } catch (err) {
        if (err instanceof DriveAuthExpiredError) {
          clearDriveAccessToken();
          setDriveError(err.message);
          const title = getDocTitleForQueue(params.kind, params.id);
          enqueuePendingDriveExport(params.kind, params.id, title);
          markDocumentDriveStatus(params.kind, params.id, 'pending_auth', err.message);
          return null;
        }
        const msg = err instanceof Error ? err.message : 'Failed to export document to Google Drive.';
        setDriveError(msg);
        markDocumentDriveStatus(params.kind, params.id, 'error', msg);
        throw err;
      }
    },
    [
      connectGoogleDrive,
      enqueuePendingDriveExport,
      executeSingleDriveUpload,
      getDocTitleForQueue,
      markDocumentDriveStatus,
    ]
  );

  const exportAllDocumentsToDrive = useCallback(async (): Promise<{
    exported: number;
    failed: number;
  }> => {
    setDriveError(null);
    let token = getDriveAccessToken();
    if (!token) {
      token = await connectGoogleDrive();
    }
    if (!token) {
      return { exported: 0, failed: 0 };
    }

    const snapshot = stateRef.current;
    const targets: Array<{ kind: 'resume' | 'cover-letter' | 'research'; id: string }> = [
      ...snapshot.resumes.map((r) => ({ kind: 'resume' as const, id: r.id })),
      ...snapshot.coverLetters.map((c) => ({ kind: 'cover-letter' as const, id: c.id })),
      ...snapshot.companyResearches
        .filter((res) => res.status === 'completed')
        .map((res) => ({ kind: 'research' as const, id: res.id })),
    ];

    setIsFlushingDriveQueue(true);
    let exported = 0;
    let failed = 0;
    try {
      for (const target of targets) {
        try {
          const uploaded = await executeSingleDriveUpload({
            accessToken: token,
            kind: target.kind,
            id: target.id,
          });
          if (uploaded) exported += 1;
        } catch (err) {
          failed += 1;
          if (err instanceof DriveAuthExpiredError) {
            clearDriveAccessToken();
            setDriveError(err.message);
            break;
          }
          const msg = err instanceof Error ? err.message : 'Bulk Drive export error.';
          setDriveError(msg);
          markDocumentDriveStatus(target.kind, target.id, 'error', msg);
        }
      }
    } finally {
      setIsFlushingDriveQueue(false);
    }

    return { exported, failed };
  }, [connectGoogleDrive, executeSingleDriveUpload, markDocumentDriveStatus]);

  const updateProfile = useCallback(
    (updater: (prev: CareerProfile) => CareerProfile) => {
      setProfile((prev) => {
        const next = ensureStableProfileIds({
          ...updater(prev),
          updatedAt: new Date().toISOString(),
        });
        if (user) {
          scheduleDocWrite(['users', user.uid, 'profile', 'master'], next);
        }
        return next;
      });
    },
    [scheduleDocWrite, user]
  );

  const addJob = useCallback(
    (jobInput: AddJobInput): JobApplication => {
      const now = new Date().toISOString();
      const trimmedUrl = typeof jobInput.sourceUrl === 'string' ? jobInput.sourceUrl.trim() : '';
      const created: JobApplication = {
        ...jobInput,
        company: typeof jobInput.company === 'string' ? jobInput.company : '',
        jobTitle: typeof jobInput.jobTitle === 'string' ? jobInput.jobTitle : '',
        sourceUrl: trimmedUrl || undefined,
        id: `job-${crypto.randomUUID().slice(0, 8)}`,
        createdAt: now,
        updatedAt: now,
      };
      setJobs((prev) => [created, ...prev]);
      if (user) {
        writeDocImmediate(['users', user.uid, 'jobs', created.id], created, OperationType.CREATE);
      }
      return created;
    },
    [user, writeDocImmediate]
  );

  const updateJob = useCallback(
    (
      id: string,
      updater: (prev: JobApplication) => JobApplication,
      options?: { immediate?: boolean }
    ) => {
      setJobs((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const rawNext = updater(item);
          const trimmedUrl = typeof rawNext.sourceUrl === 'string' ? rawNext.sourceUrl.trim() : '';
          const next: JobApplication = {
            ...rawNext,
            sourceUrl: trimmedUrl || undefined,
            updatedAt: new Date().toISOString(),
          };
          if (user) {
            if (options?.immediate) {
              writeDocImmediate(['users', user.uid, 'jobs', id], next, OperationType.UPDATE);
            } else {
              scheduleDocWrite(['users', user.uid, 'jobs', id], next);
            }
          }
          return next;
        })
      );
    },
    [scheduleDocWrite, user, writeDocImmediate]
  );

  const queueJobTask = useCallback(
    (jobId: string, task: JobTaskType) => {
      updateJob(
        jobId,
        (prev) => ({
          ...prev,
          selectedTask: task,
          taskStatus: 'queued',
          taskReason: undefined,
        }),
        { immediate: true }
      );
    },
    [updateJob]
  );

  const deleteJob = useCallback(
    (id: string) => {
      setJobs((prev) => prev.filter((item) => item.id !== id));
      if (user) {
        deleteDocImmediate(['users', user.uid, 'jobs', id]);
      }
    },
    [deleteDocImmediate, user]
  );

  const addStickyNote = useCallback(
    (noteInput: Omit<StickyNoteItem, 'id' | 'createdAt' | 'updatedAt'>): StickyNoteItem => {
      const now = new Date().toISOString();
      const created: StickyNoteItem = {
        ...noteInput,
        id: `note-${crypto.randomUUID().slice(0, 8)}`,
        createdAt: now,
        updatedAt: now,
      };
      setStickyNotes((prev) => [created, ...prev]);
      if (user) {
        writeDocImmediate(
          ['users', user.uid, 'stickyNotes', created.id],
          created,
          OperationType.CREATE
        );
      }
      return created;
    },
    [user, writeDocImmediate]
  );

  const updateStickyNote = useCallback(
    (id: string, updater: (prev: StickyNoteItem) => StickyNoteItem) => {
      setStickyNotes((prev) =>
        prev.map((note) => {
          if (note.id !== id) return note;
          const next: StickyNoteItem = {
            ...updater(note),
            updatedAt: new Date().toISOString(),
          };
          if (user) {
            scheduleDocWrite(['users', user.uid, 'stickyNotes', id], next);
          }
          return next;
        })
      );
    },
    [scheduleDocWrite, user]
  );

  const deleteStickyNote = useCallback(
    (id: string) => {
      setStickyNotes((prev) => prev.filter((note) => note.id !== id));
      if (user) {
        deleteDocImmediate(['users', user.uid, 'stickyNotes', id]);
      }
    },
    [deleteDocImmediate, user]
  );

  const addStickyCategory = useCallback(
    (rawCategory: string): string => {
      const trimmed = rawCategory.trim();
      if (!trimmed) return 'All';
      const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1, 40);
      if (formatted.toLowerCase() === 'all') return 'All';

      const existingMatch = stickyCategories.find(
        (c) => c.toLowerCase() === formatted.toLowerCase()
      );
      if (existingMatch) return existingMatch;

      const next = [...stickyCategories, formatted];
      setStickyCategories(next);
      if (user) {
        writeDocImmediate(['users', user.uid, 'workspace', 'stickyNotesMeta'], {
          categories: next,
          seeded: true,
          updatedAt: new Date().toISOString(),
        });
      }
      return formatted;
    },
    [stickyCategories, user, writeDocImmediate]
  );

  const resetDemoStickyNotes = useCallback(() => {
    const existingIds = stateRef.current.stickyNotes.map((n) => n.id);
    const defaultCopy = DEFAULT_STICKY_NOTES.map((n) => ({ ...n }));
    const defaultCats = [...DEFAULT_STICKY_CATEGORIES];
    setStickyNotes(defaultCopy);
    setStickyCategories(defaultCats);

    if (user) {
      const batch = writeBatch(db);
      const defaultIdSet = new Set(defaultCopy.map((n) => n.id));
      existingIds.forEach((oldId) => {
        if (!defaultIdSet.has(oldId)) {
          batch.delete(doc(db, 'users', user.uid, 'stickyNotes', oldId));
        }
      });
      defaultCopy.forEach((note) => {
        batch.set(
          doc(db, 'users', user.uid, 'stickyNotes', note.id),
          stripUndefinedForFirestore(note)
        );
      });
      batch.set(
        doc(db, 'users', user.uid, 'workspace', 'stickyNotesMeta'),
        stripUndefinedForFirestore({
          categories: defaultCats,
          seeded: true,
          updatedAt: new Date().toISOString(),
        })
      );
      void batch.commit().catch((err) => {
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Failed to reset demo sticky notes.');
        try {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/stickyNotes`);
        } catch {
          // Logged
        }
      });
    }
  }, [user]);

  const openStickyNotes = useCallback(() => {
    setIsStickyNotesOpen(true);
    setIsStickyNotesMinimized(false);
  }, []);

  const closeStickyNotes = useCallback(() => {
    setIsStickyNotesOpen(false);
    setIsStickyNotesMinimized(false);
  }, []);

  const minimizeStickyNotes = useCallback(() => {
    setIsStickyNotesOpen(true);
    setIsStickyNotesMinimized(true);
  }, []);

  const restoreStickyNotes = useCallback(() => {
    setIsStickyNotesOpen(true);
    setIsStickyNotesMinimized(false);
  }, []);

  const createResume = useCallback(
    (options?: { name?: string; fromProfile?: boolean; linkedJobId?: string }): ResumeDocument => {
      const sourceProfile: CareerProfile =
        options?.fromProfile === false
          ? {
              personal: {
                fullName: '',
                title: '',
                email: '',
                phone: '',
                location: '',
                linkedin: '',
                portfolio: '',
                website: '',
              },
              summary: { headline: '', summary: '', careerObjectives: '' },
              workExperience: [],
              education: [],
              skills: { technical: [], software: [], professional: [], industry: [] },
              projects: [],
              certifications: [],
              awards: [],
              volunteer: [],
              languages: [],
              publications: [],
              updatedAt: new Date().toISOString(),
            }
          : profile;

      const created = createResumeFromProfile(sourceProfile, {
        name: options?.name || `Untitled Resume ${resumes.length + 1}`,
        isMaster: false,
        linkedJobId: options?.linkedJobId,
      });

      setResumes((prev) => [created, ...prev]);
      setActiveResumeId(created.id);
      if (user) {
        writeDocImmediate(['users', user.uid, 'resumes', created.id], created, OperationType.CREATE);
      }
      return created;
    },
    [profile, resumes.length, user, writeDocImmediate]
  );

  const duplicateResume = useCallback(
    (id: string, customName?: string, linkedJobId?: string): ResumeDocument | undefined => {
      const target = resumes.find((r) => r.id === id);
      if (!target) return undefined;
      const now = new Date().toISOString();
      const copy: ResumeDocument = {
        ...structuredClone(target),
        id: `res-${crypto.randomUUID().slice(0, 8)}`,
        name: customName || `${target.name} (v${target.version + 1})`,
        version: target.version + 1,
        isMaster: false,
        linkedJobId: linkedJobId ?? target.linkedJobId,
        createdAt: now,
        updatedAt: now,
      };
      setResumes((prev) => [copy, ...prev]);
      setActiveResumeId(copy.id);
      if (user) {
        writeDocImmediate(['users', user.uid, 'resumes', copy.id], copy, OperationType.CREATE);
      }
      return copy;
    },
    [resumes, user, writeDocImmediate]
  );

  const renameResume = useCallback(
    (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      setResumes((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, name: trimmed, updatedAt: new Date().toISOString() };
          if (user) {
            writeDocImmediate(['users', user.uid, 'resumes', id], next, OperationType.UPDATE);
          }
          return next;
        })
      );
    },
    [user, writeDocImmediate]
  );

  const updateResume = useCallback(
    (id: string, updater: (prev: ResumeDocument) => ResumeDocument) => {
      setResumes((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const next = { ...updater(r), updatedAt: new Date().toISOString() };
          if (user) {
            scheduleDocWrite(['users', user.uid, 'resumes', id], next);
          }
          return next;
        })
      );
    },
    [scheduleDocWrite, user]
  );

  const deleteResume = useCallback(
    (id: string) => {
      setResumes((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((r) => r.id !== id);
        if (activeResumeId === id && filtered.length > 0) {
          setActiveResumeId(filtered[0].id);
        }
        return filtered;
      });
      if (user) {
        deleteDocImmediate(['users', user.uid, 'resumes', id]);
      }
    },
    [activeResumeId, deleteDocImmediate, user]
  );

  const importProfileIntoResume = useCallback(
    (resumeId: string) => {
      setResumes((prev) =>
        prev.map((r) => {
          if (r.id !== resumeId) return r;
          const next: ResumeDocument = {
            ...r,
            personal: structuredClone(profile.personal),
            summary: structuredClone(profile.summary),
            workExperience: structuredClone(profile.workExperience),
            education: structuredClone(profile.education),
            skills: structuredClone(profile.skills),
            projects: structuredClone(profile.projects),
            certifications: structuredClone(profile.certifications),
            awards: structuredClone(profile.awards),
            volunteer: structuredClone(profile.volunteer),
            languages: structuredClone(profile.languages),
            publications: structuredClone(profile.publications),
            updatedAt: new Date().toISOString(),
          };
          if (user) {
            writeDocImmediate(['users', user.uid, 'resumes', resumeId], next, OperationType.UPDATE);
          }
          return next;
        })
      );
    },
    [profile, user, writeDocImmediate]
  );

  const createCoverLetter = useCallback(
    (options?: {
      title?: string;
      linkedJobId?: string;
      linkedResumeId?: string;
      prefillFromProfile?: boolean;
    }): CoverLetterDocument => {
      const now = new Date().toISOString();
      const job = options?.linkedJobId ? jobs.find((j) => j.id === options.linkedJobId) : undefined;
      const useProfile = options?.prefillFromProfile !== false;
      const formattedDate = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      const created: CoverLetterDocument = {
        id: `cl-${crypto.randomUUID().slice(0, 8)}`,
        title:
          options?.title ||
          (job ? buildTailoredJobLabel(job) : `Cover Letter ${coverLetters.length + 1}`),
        version: 1,
        linkedJobId: options?.linkedJobId,
        linkedResumeId: options?.linkedResumeId || resumes[0]?.id,
        documentProfile: 'modern-professional',
        applicant: useProfile
          ? {
              fullName: profile.personal.fullName,
              email: profile.personal.email,
              phone: profile.personal.phone,
              location: profile.personal.location,
              linkedin: profile.personal.linkedin,
              portfolio: profile.personal.portfolio,
              website: profile.personal.website,
            }
          : {
              fullName: '',
              email: '',
              phone: '',
              location: '',
              linkedin: '',
              portfolio: '',
              website: '',
            },
        employer: {
          companyName: job?.company || '',
          hiringManager: job?.hiringManager || '',
          jobTitle: job?.jobTitle || '',
          department: job?.department || '',
          companyAddress: job?.companyAddress || '',
          applicationDate: formattedDate,
        },
        jobInfo: {
          jobDescription: job?.jobDescription || '',
          requiredQualifications: job ? [...job.requiredQualifications] : [],
          preferredQualifications: job ? [...job.preferredQualifications] : [],
          responsibilities: job ? [...job.responsibilities] : [],
          technicalRequirements: job ? [...job.technicalRequirements] : [],
        },
        content: {
          salutation: job?.hiringManager ? `Dear ${job.hiringManager},` : 'Dear Hiring Team,',
          paragraphs: [
            {
              id: `p-${crypto.randomUUID().slice(0, 6)}`,
              label: 'Opening',
              text: job
                ? job.jobTitle || job.company
                  ? `I am writing to apply for the ${job.jobTitle || 'open'} role${job.company ? ` at ${job.company}` : ''}.`
                  : 'I am writing to apply for this position.'
                : 'I am writing to express my interest in joining your team.',
            },
            {
              id: `p-${crypto.randomUUID().slice(0, 6)}`,
              label: 'Relevant Experience',
              text: '',
            },
            {
              id: `p-${crypto.randomUUID().slice(0, 6)}`,
              label: 'Closing',
              text: 'Thank you for your time and consideration. I look forward to discussing how my background aligns with your team.',
            },
          ],
          closingSignOff: 'Sincerely,',
          signatureName: useProfile ? profile.personal.fullName : '',
        },
        writingStyle: 'Professional',
        length: 'Standard',
        template: 'modern',
        formatting: structuredClone(DEFAULT_COVER_LETTER_FORMATTING),
        createdAt: now,
        updatedAt: now,
      };

      setCoverLetters((prev) => [created, ...prev]);
      setActiveCoverLetterId(created.id);
      if (user) {
        writeDocImmediate(
          ['users', user.uid, 'coverLetters', created.id],
          created,
          OperationType.CREATE
        );
      }
      return created;
    },
    [coverLetters.length, jobs, profile.personal, resumes, user, writeDocImmediate]
  );

  const duplicateCoverLetter = useCallback(
    (id: string, customTitle?: string): CoverLetterDocument | undefined => {
      const target = coverLetters.find((c) => c.id === id);
      if (!target) return undefined;
      const now = new Date().toISOString();
      const copy: CoverLetterDocument = {
        ...structuredClone(target),
        id: `cl-${crypto.randomUUID().slice(0, 8)}`,
        title: customTitle || `${target.title} (v${target.version + 1})`,
        version: target.version + 1,
        createdAt: now,
        updatedAt: now,
      };
      setCoverLetters((prev) => [copy, ...prev]);
      setActiveCoverLetterId(copy.id);
      if (user) {
        writeDocImmediate(['users', user.uid, 'coverLetters', copy.id], copy, OperationType.CREATE);
      }
      return copy;
    },
    [coverLetters, user, writeDocImmediate]
  );

  const renameCoverLetter = useCallback(
    (id: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return;
      setCoverLetters((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c, title: trimmed, updatedAt: new Date().toISOString() };
          if (user) {
            writeDocImmediate(['users', user.uid, 'coverLetters', id], next, OperationType.UPDATE);
          }
          return next;
        })
      );
    },
    [user, writeDocImmediate]
  );

  const updateCoverLetter = useCallback(
    (id: string, updater: (prev: CoverLetterDocument) => CoverLetterDocument) => {
      setCoverLetters((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const next = { ...updater(c), updatedAt: new Date().toISOString() };
          if (user) {
            scheduleDocWrite(['users', user.uid, 'coverLetters', id], next);
          }
          return next;
        })
      );
    },
    [scheduleDocWrite, user]
  );

  const deleteCoverLetter = useCallback(
    (id: string) => {
      setCoverLetters((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((c) => c.id !== id);
        if (activeCoverLetterId === id && filtered.length > 0) {
          setActiveCoverLetterId(filtered[0].id);
        }
        return filtered;
      });
      if (user) {
        deleteDocImmediate(['users', user.uid, 'coverLetters', id]);
      }
    },
    [activeCoverLetterId, deleteDocImmediate, user]
  );

  const openTailoredResumeForJob = useCallback(
    (jobId: string): ResumeDocument | undefined => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return undefined;
      const master = resumes.find((r) => r.isMaster) || resumes[0];
      if (!master) return undefined;
      const tailoredName = buildTailoredJobLabel(job);
      const created = duplicateResume(master.id, tailoredName, job.id);
      setActiveModule('resumes');
      return created;
    },
    [duplicateResume, jobs, resumes]
  );

  const openCoverLetterForJob = useCallback(
    (jobId: string, resumeId?: string): CoverLetterDocument | undefined => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return undefined;
      const existingCount = coverLetters.filter((c) => c.linkedJobId === jobId).length;
      const suffix = existingCount > 0 ? ` (v${existingCount + 1})` : '';
      const created = createCoverLetter({
        title: `${buildTailoredJobLabel(job)}${suffix}`,
        linkedJobId: job.id,
        linkedResumeId: resumeId || resumes.find((r) => r.linkedJobId === job.id)?.id || resumes[0]?.id,
        prefillFromProfile: true,
      });
      setActiveModule('cover-letters');
      return created;
    },
    [coverLetters, createCoverLetter, jobs, resumes]
  );

  // In-app 30-second task checker for queued Jobs notes (runs strictly one task at a time)
  useEffect(() => {
    const runResumeTaskForJob = async (job: JobApplication): Promise<ResumeDocument> => {
      const snapshot = stateRef.current;
      const master = snapshot.resumes.find((r) => r.isMaster) || snapshot.resumes[0];
      const now = new Date().toISOString();
      const jobLabel = buildTailoredJobLabel(job);
      const baseDraft: ResumeDocument = master
        ? {
            ...structuredClone(master),
            id: `res-${crypto.randomUUID().slice(0, 8)}`,
            name: `${jobLabel} — Tailored`,
            version: 1,
            isMaster: false,
            linkedJobId: job.id,
            createdAt: now,
            updatedAt: now,
          }
        : createResumeFromProfile(snapshot.profile, {
            name: `${jobLabel} — Tailored`,
            isMaster: false,
            linkedJobId: job.id,
          });

      const companyResearch = snapshot.companyResearches.find(
        (r) => r.jobApplicationId === job.id
      );
      const jobMatch = snapshot.jobMatches.find((m) => m.jobId === job.id);

      const proposal = await assistResumeWithAi({
        action: 'tailor_to_job',
        resume: baseDraft,
        targetJob: job,
        companyResearch,
        jobMatch,
      });

      const tailoredResume: ResumeDocument = {
        ...applyAssistResponseToResume(baseDraft, proposal),
        updatedAt: new Date().toISOString(),
      };

      setResumes((prev) => [tailoredResume, ...prev]);
      setActiveResumeId(tailoredResume.id);
      if (user) {
        writeDocImmediate(
          ['users', user.uid, 'resumes', tailoredResume.id],
          tailoredResume,
          OperationType.CREATE
        );
      }
      return tailoredResume;
    };

    const runCoverLetterTaskForJob = async (
      job: JobApplication,
      preferredResume?: ResumeDocument
    ): Promise<CoverLetterDocument> => {
      const snapshot = stateRef.current;
      const linkedResume =
        preferredResume ||
        snapshot.resumes.find((r) => r.linkedJobId === job.id) ||
        snapshot.resumes.find((r) => r.isMaster) ||
        snapshot.resumes[0];

      const now = new Date().toISOString();
      const jobLabel = buildTailoredJobLabel(job);
      const existingCount = snapshot.coverLetters.filter((c) => c.linkedJobId === job.id).length;
      const suffix = existingCount > 0 ? ` (v${existingCount + 1})` : '';
      const formattedDate = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      const draftLetter: CoverLetterDocument = {
        id: `cl-${crypto.randomUUID().slice(0, 8)}`,
        title: `${jobLabel}${suffix}`,
        version: 1,
        linkedJobId: job.id,
        linkedResumeId: linkedResume?.id,
        documentProfile: 'modern-professional',
        applicant: {
          fullName: snapshot.profile.personal.fullName,
          email: snapshot.profile.personal.email,
          phone: snapshot.profile.personal.phone,
          location: snapshot.profile.personal.location,
          linkedin: snapshot.profile.personal.linkedin,
          portfolio: snapshot.profile.personal.portfolio,
          website: snapshot.profile.personal.website,
        },
        employer: {
          companyName: job.company || '',
          hiringManager: job.hiringManager || '',
          jobTitle: job.jobTitle || '',
          department: job.department || '',
          companyAddress: job.companyAddress || '',
          applicationDate: formattedDate,
        },
        jobInfo: {
          jobDescription: job.jobDescription || '',
          requiredQualifications: [...job.requiredQualifications],
          preferredQualifications: [...job.preferredQualifications],
          responsibilities: [...job.responsibilities],
          technicalRequirements: [...job.technicalRequirements],
        },
        content: {
          salutation: job.hiringManager ? `Dear ${job.hiringManager},` : 'Dear Hiring Team,',
          paragraphs: [
            {
              id: `p-${crypto.randomUUID().slice(0, 6)}`,
              label: 'Opening',
              text: '',
            },
            {
              id: `p-${crypto.randomUUID().slice(0, 6)}`,
              label: 'Relevant Experience',
              text: '',
            },
            {
              id: `p-${crypto.randomUUID().slice(0, 6)}`,
              label: 'Closing',
              text: '',
            },
          ],
          closingSignOff: 'Sincerely,',
          signatureName: snapshot.profile.personal.fullName,
        },
        writingStyle: 'Professional',
        length: 'Standard',
        template: 'modern',
        formatting: structuredClone(DEFAULT_COVER_LETTER_FORMATTING),
        createdAt: now,
        updatedAt: now,
      };

      const payload = buildCoverLetterPayloadFromJob(job, snapshot.profile, draftLetter);
      const companyResearch = snapshot.companyResearches.find(
        (r) => r.jobApplicationId === job.id
      );
      const jobMatch = snapshot.jobMatches.find((m) => m.jobId === job.id);

      const generated = await generateCoverLetterWithAi({
        applicant: payload.applicant,
        employer: payload.employer,
        jobInfo: payload.jobInfo,
        careerProfile: snapshot.profile,
        selectedResume: linkedResume,
        writingStyle: draftLetter.writingStyle,
        length: draftLetter.length,
        companyResearch,
        jobMatch,
      });

      const finishedLetter: CoverLetterDocument = {
        ...draftLetter,
        content: {
          salutation: generated.salutation || draftLetter.content.salutation,
          paragraphs:
            Array.isArray(generated.paragraphs) && generated.paragraphs.length > 0
              ? generated.paragraphs.map((p, idx) => ({
                  id: `p-${crypto.randomUUID().slice(0, 6)}-${idx}`,
                  label: p.label,
                  text: p.text,
                }))
              : draftLetter.content.paragraphs,
          closingSignOff: generated.closingSignOff || draftLetter.content.closingSignOff,
          signatureName: draftLetter.content.signatureName || snapshot.profile.personal.fullName,
        },
        updatedAt: new Date().toISOString(),
      };

      setCoverLetters((prev) => [finishedLetter, ...prev]);
      setActiveCoverLetterId(finishedLetter.id);
      if (user) {
        writeDocImmediate(
          ['users', user.uid, 'coverLetters', finishedLetter.id],
          finishedLetter,
          OperationType.CREATE
        );
      }
      return finishedLetter;
    };

    const checkQueuedTasks = async () => {
      if (isTaskRunningRef.current) return;

      const queuedJobs = stateRef.current.jobs.filter((j) => j.taskStatus === 'queued');
      if (queuedJobs.length === 0) return;

      let jobToRun: JobApplication | null = null;

      for (const candidate of queuedJobs) {
        const verdict = evaluateQueuedJobEligibility(candidate);
        if (verdict.action === 'fail') {
          updateJob(
            candidate.id,
            (prev) => ({
              ...prev,
              taskStatus: 'failed',
              taskReason: verdict.reason,
            }),
            { immediate: true }
          );
          continue;
        }
        if (verdict.action === 'wait') {
          continue;
        }
        if (verdict.action === 'run') {
          jobToRun = candidate;
          break;
        }
      }

      if (!jobToRun) return;

      isTaskRunningRef.current = true;
      updateJob(
        jobToRun.id,
        (prev) => ({
          ...prev,
          jobStatus: 'tailoring',
          taskStatus: 'running',
          taskReason: undefined,
        }),
        { immediate: true }
      );

      try {
        if (jobToRun.selectedTask === 'resume') {
          const generatedResume = await runResumeTaskForJob(jobToRun);
          void autoExportMilestone({
            kind: 'resume',
            id: generatedResume.id,
            overrideDoc: generatedResume,
            overrideLinkedJob: jobToRun,
          });
        } else if (jobToRun.selectedTask === 'cover_letter') {
          const generatedLetter = await runCoverLetterTaskForJob(jobToRun);
          void autoExportMilestone({
            kind: 'cover-letter',
            id: generatedLetter.id,
            overrideDoc: generatedLetter,
            overrideLinkedJob: jobToRun,
          });
        } else if (jobToRun.selectedTask === 'both') {
          const generatedResume = await runResumeTaskForJob(jobToRun);
          void autoExportMilestone({
            kind: 'resume',
            id: generatedResume.id,
            overrideDoc: generatedResume,
            overrideLinkedJob: jobToRun,
          });
          const generatedLetter = await runCoverLetterTaskForJob(jobToRun, generatedResume);
          void autoExportMilestone({
            kind: 'cover-letter',
            id: generatedLetter.id,
            overrideDoc: generatedLetter,
            overrideLinkedJob: jobToRun,
          });
        }

        updateJob(
          jobToRun.id,
          (prev) => ({
            ...prev,
            jobStatus: 'tailored',
            taskStatus: 'done',
            taskReason: undefined,
          }),
          { immediate: true }
        );
      } catch (err) {
        updateJob(
          jobToRun.id,
          (prev) => ({
            ...prev,
            jobStatus: 'ready_for_tailoring',
            taskStatus: 'failed',
            taskReason: formatTaskReason(err),
          }),
          { immediate: true }
        );
      } finally {
        isTaskRunningRef.current = false;
      }
    };

    const timer = setInterval(() => {
      void checkQueuedTasks();
    }, 30_000);

    return () => clearInterval(timer);
  }, [autoExportMilestone, updateJob, user, writeDocImmediate]);

  const getCompanyResearchForJob = useCallback(
    (jobId: string): CompanyResearch | undefined =>
      companyResearches.find((r) => r.jobApplicationId === jobId),
    [companyResearches]
  );

  const getJobMatchForJob = useCallback(
    (jobId: string): JobMatch | undefined => jobMatches.find((m) => m.jobId === jobId),
    [jobMatches]
  );

  const saveCompanyResearch = useCallback(
    (jobId: string, research: CompanyResearch, companyProfile: CompanyProfile) => {
      setCompanies((prev) => {
        const idx = prev.findIndex(
          (c) =>
            c.id === companyProfile.id ||
            c.companyName.toLowerCase() === companyProfile.companyName.toLowerCase()
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = companyProfile;
          return next;
        }
        return [companyProfile, ...prev];
      });

      setCompanyResearches((prev) => {
        const idx = prev.findIndex((r) => r.jobApplicationId === jobId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = research;
          return next;
        }
        return [research, ...prev];
      });

      setJobs((prev) =>
        prev.map((j) => {
          if (j.id !== jobId) return j;
          const updatedJob: JobApplication = {
            ...j,
            companyId: companyProfile.id,
            companyWebsite: j.companyWebsite || companyProfile.officialWebsite || '',
            updatedAt: new Date().toISOString(),
          };
          if (user) {
            writeDocImmediate(['users', user.uid, 'jobs', jobId], updatedJob, OperationType.UPDATE);
          }
          return updatedJob;
        })
      );

      if (user) {
        writeDocImmediate(
          ['users', user.uid, 'companyResearch', research.id],
          research,
          OperationType.WRITE
        );
        writeDocImmediate(
          ['users', user.uid, 'companies', companyProfile.id],
          companyProfile,
          OperationType.WRITE
        );
      }

      if (research.status === 'completed') {
        const linkedJob = stateRef.current.jobs.find((j) => j.id === jobId);
        void autoExportMilestone({
          kind: 'research',
          id: research.id,
          overrideDoc: research,
          overrideLinkedJob: linkedJob,
        });
      }
    },
    [autoExportMilestone, user, writeDocImmediate]
  );

  const updateFindingStatus = useCallback(
    (researchId: string, findingId: string, status: FindingVerificationStatus) => {
      setCompanyResearches((prev) =>
        prev.map((r) => {
          if (r.id !== researchId) return r;
          const nextFindings = r.findings.map((f) =>
            f.id === findingId ? { ...f, verificationStatus: status } : f
          );
          const allReviewed = nextFindings.every((f) => f.verificationStatus !== 'pending');
          const nextResearch: CompanyResearch = {
            ...r,
            findings: nextFindings,
            verificationStatus: allReviewed ? 'reviewed' : 'pending_review',
          };
          if (user) {
            writeDocImmediate(
              ['users', user.uid, 'companyResearch', researchId],
              nextResearch,
              OperationType.UPDATE
            );
          }
          return nextResearch;
        })
      );
    },
    [user, writeDocImmediate]
  );

  const saveJobMatch = useCallback(
    (jobId: string, match: JobMatch) => {
      setJobMatches((prev) => {
        const idx = prev.findIndex((m) => m.jobId === jobId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = match;
          return next;
        }
        return [match, ...prev];
      });
      if (user) {
        writeDocImmediate(['users', user.uid, 'jobMatches', match.id], match, OperationType.WRITE);
      }
    },
    [user, writeDocImmediate]
  );

  const clearReviewLaunchTarget = useCallback(() => {
    setReviewLaunchTarget(null);
  }, []);

  const openReviewCenter = useCallback((options?: ReviewLaunchTarget) => {
    if (options) {
      setReviewLaunchTarget(options);
    }
    setActiveModule('review');
  }, []);

  const saveApplicationReview = useCallback(
    (review: ApplicationReviewRecord) => {
      setApplicationReviews((prev) => [review, ...prev]);
      setActiveReviewId(review.id);
      if (user) {
        writeDocImmediate(['users', user.uid, 'reviews', review.id], review, OperationType.CREATE);
      }
    },
    [user, writeDocImmediate]
  );

  const updateReviewFinding = useCallback(
    (
      reviewId: string,
      findingId: string,
      updater: (prev: ReviewFinding) => ReviewFinding
    ) => {
      setApplicationReviews((prev) =>
        prev.map((rev) => {
          if (rev.id !== reviewId) return rev;
          const nextFindings = rev.findings.map((f) =>
            f.id === findingId ? updater(f) : f
          );
          const acceptedChangeIds = nextFindings
            .filter((f) => f.status === 'accepted' || f.status === 'applied')
            .map((f) => f.id);
          const rejectedChangeIds = nextFindings
            .filter((f) => f.status === 'rejected')
            .map((f) => f.id);
          const nextRev: ApplicationReviewRecord = {
            ...rev,
            findings: nextFindings,
            acceptedChangeIds,
            rejectedChangeIds,
          };
          if (user) {
            scheduleDocWrite(['users', user.uid, 'reviews', reviewId], nextRev);
          }
          return nextRev;
        })
      );
    },
    [scheduleDocWrite, user]
  );

  const resolveFactDiscrepancy = useCallback(
    (
      reviewId: string,
      discrepancyId: string,
      resolutionStatus: FactDiscrepancy['resolutionStatus']
    ) => {
      setApplicationReviews((prev) =>
        prev.map((rev) => {
          if (rev.id !== reviewId) return rev;
          const nextRev: ApplicationReviewRecord = {
            ...rev,
            factDiscrepancies: rev.factDiscrepancies.map((d) =>
              d.id === discrepancyId ? { ...d, resolutionStatus } : d
            ),
          };
          if (user) {
            writeDocImmediate(['users', user.uid, 'reviews', reviewId], nextRev, OperationType.UPDATE);
          }
          return nextRev;
        })
      );
    },
    [user, writeDocImmediate]
  );

  const applyReviewChanges = useCallback(
    (reviewId: string, findingIds: string[]) => {
      const review = applicationReviews.find((r) => r.id === reviewId);
      if (!review || findingIds.length === 0) return;

      const selectedSet = new Set(findingIds);
      const targetFindings = review.findings.filter(
        (f) => selectedSet.has(f.id) && f.targetField && f.targetField.kind !== 'advisory_only'
      );
      if (targetFindings.length === 0) return;

      const resumeFindings = targetFindings.filter((f) => f.documentTarget === 'resume');
      const letterFindings = targetFindings.filter((f) => f.documentTarget === 'cover-letter');
      const now = new Date().toISOString();

      const newSnapshots: DocumentRevisionSnapshot[] = [];

      if (resumeFindings.length > 0 && review.resumeId) {
        const targetResume = resumes.find((r) => r.id === review.resumeId);
        if (targetResume) {
          const snapDoc: DocumentRevisionSnapshot = {
            id: `snap-res-${crypto.randomUUID().slice(0, 8)}`,
            documentKind: 'resume',
            documentId: targetResume.id,
            reviewId: review.id,
            label: `Before Review Changes (v${targetResume.version})`,
            createdAt: now,
            snapshotData: structuredClone(targetResume),
          };
          newSnapshots.push(snapDoc);

          setResumes((prevList) =>
            prevList.map((r) => {
              if (r.id !== targetResume.id) return r;
              const next = structuredClone(r);
              for (const f of resumeFindings) {
                const text = (f.editedCorrection ?? f.recommendedCorrection).trim();
                const tf = f.targetField!;
                if (tf.kind === 'resume_headline') {
                  next.summary.headline = text;
                } else if (tf.kind === 'resume_summary') {
                  next.summary.summary = text;
                } else if (tf.kind === 'resume_experience_bullet') {
                  next.workExperience = next.workExperience.map((exp) => {
                    if (tf.itemId && exp.id !== tf.itemId) return exp;
                    const copy = {
                      ...exp,
                      responsibilities: [...exp.responsibilities],
                      achievements: [...exp.achievements],
                    };
                    if (
                      tf.bulletGroup === 'achievements' &&
                      typeof tf.bulletIndex === 'number' &&
                      copy.achievements[tf.bulletIndex] !== undefined
                    ) {
                      copy.achievements[tf.bulletIndex] = text;
                    } else if (
                      tf.bulletGroup === 'responsibilities' &&
                      typeof tf.bulletIndex === 'number' &&
                      copy.responsibilities[tf.bulletIndex] !== undefined
                    ) {
                      copy.responsibilities[tf.bulletIndex] = text;
                    } else {
                      const rIdx = copy.responsibilities.findIndex(
                        (b) => b.trim() === f.originalText.trim()
                      );
                      if (rIdx >= 0) {
                        copy.responsibilities[rIdx] = text;
                      } else {
                        const aIdx = copy.achievements.findIndex(
                          (b) => b.trim() === f.originalText.trim()
                        );
                        if (aIdx >= 0) copy.achievements[aIdx] = text;
                      }
                    }
                    return copy;
                  });
                } else if (tf.kind === 'resume_skills') {
                  const additions = text
                    .split(/[,·\n]/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const existing = new Set(next.skills.technical.map((s) => s.toLowerCase()));
                  additions.forEach((skill) => {
                    if (!existing.has(skill.toLowerCase())) {
                      next.skills.technical.push(skill);
                      existing.add(skill.toLowerCase());
                    }
                  });
                }
              }
              const updatedResume: ResumeDocument = {
                ...next,
                version: r.version + 1,
                updatedAt: now,
              };
              if (user) {
                writeDocImmediate(
                  ['users', user.uid, 'resumes', updatedResume.id],
                  updatedResume,
                  OperationType.UPDATE
                );
              }
              return updatedResume;
            })
          );
        }
      }

      if (letterFindings.length > 0 && review.coverLetterId) {
        const targetLetter = coverLetters.find((c) => c.id === review.coverLetterId);
        if (targetLetter) {
          const snapDoc: DocumentRevisionSnapshot = {
            id: `snap-cl-${crypto.randomUUID().slice(0, 8)}`,
            documentKind: 'cover-letter',
            documentId: targetLetter.id,
            reviewId: review.id,
            label: `Before Review Changes (v${targetLetter.version})`,
            createdAt: now,
            snapshotData: structuredClone(targetLetter),
          };
          newSnapshots.push(snapDoc);

          setCoverLetters((prevList) =>
            prevList.map((cl) => {
              if (cl.id !== targetLetter.id) return cl;
              const next = structuredClone(cl);
              for (const f of letterFindings) {
                const text = (f.editedCorrection ?? f.recommendedCorrection).trim();
                const tf = f.targetField!;
                if (tf.kind === 'cover_letter_salutation') {
                  next.content.salutation = text;
                } else if (tf.kind === 'cover_letter_closing') {
                  if (text.length < 40) {
                    next.content.closingSignOff = text;
                  } else if (next.content.paragraphs.length > 0) {
                    next.content.paragraphs[next.content.paragraphs.length - 1].text = text;
                  }
                } else if (tf.kind === 'cover_letter_paragraph') {
                  const idxById = tf.itemId
                    ? next.content.paragraphs.findIndex((p) => p.id === tf.itemId)
                    : -1;
                  const idxByText =
                    idxById >= 0
                      ? idxById
                      : next.content.paragraphs.findIndex(
                          (p) =>
                            p.text.trim() === f.originalText.trim() ||
                            (f.originalText.trim().length > 20 &&
                              p.text.includes(f.originalText.trim().slice(0, 35)))
                        );
                  if (idxByText >= 0) {
                    next.content.paragraphs[idxByText].text = text;
                  }
                }
              }
              const updatedLetter: CoverLetterDocument = {
                ...next,
                version: cl.version + 1,
                updatedAt: now,
              };
              if (user) {
                writeDocImmediate(
                  ['users', user.uid, 'coverLetters', updatedLetter.id],
                  updatedLetter,
                  OperationType.UPDATE
                );
              }
              return updatedLetter;
            })
          );
        }
      }

      if (newSnapshots.length > 0) {
        setDocumentSnapshots((prev) => [...newSnapshots, ...prev]);
        if (user) {
          newSnapshots.forEach((s) =>
            writeDocImmediate(['users', user.uid, 'snapshots', s.id], s, OperationType.CREATE)
          );
        }
      }

      const appliedSet = new Set(targetFindings.map((f) => f.id));
      setApplicationReviews((prev) =>
        prev.map((rev) => {
          if (rev.id !== reviewId) return rev;
          const nextFindings = rev.findings.map((f) =>
            appliedSet.has(f.id) ? { ...f, status: 'applied' as const } : f
          );
          const nextRev: ApplicationReviewRecord = {
            ...rev,
            findings: nextFindings,
            appliedChangeIds: Array.from(
              new Set([...rev.appliedChangeIds, ...Array.from(appliedSet)])
            ),
            acceptedChangeIds: nextFindings
              .filter((f) => f.status === 'accepted' || f.status === 'applied')
              .map((f) => f.id),
          };
          if (user) {
            writeDocImmediate(['users', user.uid, 'reviews', reviewId], nextRev, OperationType.UPDATE);
          }
          return nextRev;
        })
      );

      if (resumeFindings.length > 0 && review.resumeId) {
        setTimeout(() => {
          void autoExportMilestone({ kind: 'resume', id: review.resumeId! });
        }, 0);
      }
      if (letterFindings.length > 0 && review.coverLetterId) {
        setTimeout(() => {
          void autoExportMilestone({ kind: 'cover-letter', id: review.coverLetterId! });
        }, 0);
      }
    },
    [applicationReviews, autoExportMilestone, coverLetters, resumes, user, writeDocImmediate]
  );

  const undoReviewSnapshot = useCallback(
    (snapshotId: string) => {
      const snap = documentSnapshots.find((s) => s.id === snapshotId);
      if (!snap) return;

      const now = new Date().toISOString();
      if (snap.documentKind === 'resume') {
        const restored: ResumeDocument = {
          ...structuredClone(snap.snapshotData as ResumeDocument),
          updatedAt: now,
        };
        setResumes((prev) =>
          prev.map((r) => (r.id === snap.documentId ? restored : r))
        );
        if (user) {
          writeDocImmediate(['users', user.uid, 'resumes', snap.documentId], restored, OperationType.UPDATE);
        }
      } else {
        const restored: CoverLetterDocument = {
          ...structuredClone(snap.snapshotData as CoverLetterDocument),
          updatedAt: now,
        };
        setCoverLetters((prev) =>
          prev.map((c) => (c.id === snap.documentId ? restored : c))
        );
        if (user) {
          writeDocImmediate(
            ['users', user.uid, 'coverLetters', snap.documentId],
            restored,
            OperationType.UPDATE
          );
        }
      }

      setApplicationReviews((prev) =>
        prev.map((rev) => {
          if (rev.id !== snap.reviewId) return rev;
          const targetKind = snap.documentKind === 'resume' ? 'resume' : 'cover-letter';
          const nextFindings = rev.findings.map((f) =>
            f.status === 'applied' && f.documentTarget === targetKind
              ? { ...f, status: 'accepted' as const }
              : f
          );
          const nextRev: ApplicationReviewRecord = {
            ...rev,
            findings: nextFindings,
            appliedChangeIds: nextFindings
              .filter((f) => f.status === 'applied')
              .map((f) => f.id),
          };
          if (user) {
            writeDocImmediate(['users', user.uid, 'reviews', rev.id], nextRev, OperationType.UPDATE);
          }
          return nextRev;
        })
      );

      setDocumentSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      if (user) {
        deleteDocImmediate(['users', user.uid, 'snapshots', snapshotId]);
      }
    },
    [deleteDocImmediate, documentSnapshots, user, writeDocImmediate]
  );

  const upsertAiWritingSession = useCallback(
    (session: AIWritingSessionRecord) => {
      setAiWritingHistory((prev) => {
        const idx = prev.findIndex((s) => s.id === session.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = session;
          return next;
        }
        return [session, ...prev].slice(0, 120);
      });
      if (user) {
        writeDocImmediate(
          ['users', user.uid, 'aiWritingSessions', session.id],
          session,
          OperationType.WRITE
        );
      }
    },
    [user, writeDocImmediate]
  );

  const recordDocumentSnapshot = useCallback(
    (
      documentKind: 'resume' | 'cover-letter',
      documentId: string,
      sessionId: string,
      label: string
    ) => {
      const now = new Date().toISOString();
      if (documentKind === 'resume') {
        const target = resumes.find((r) => r.id === documentId);
        if (!target) return;
        const snapDoc: DocumentRevisionSnapshot = {
          id: `snap-ai-${crypto.randomUUID().slice(0, 8)}`,
          documentKind: 'resume',
          documentId,
          reviewId: sessionId,
          label,
          createdAt: now,
          snapshotData: structuredClone(target),
        };
        setDocumentSnapshots((prev) => [snapDoc, ...prev]);
        if (user) {
          writeDocImmediate(['users', user.uid, 'snapshots', snapDoc.id], snapDoc, OperationType.CREATE);
        }
      } else {
        const target = coverLetters.find((c) => c.id === documentId);
        if (!target) return;
        const snapDoc: DocumentRevisionSnapshot = {
          id: `snap-ai-${crypto.randomUUID().slice(0, 8)}`,
          documentKind: 'cover-letter',
          documentId,
          reviewId: sessionId,
          label,
          createdAt: now,
          snapshotData: structuredClone(target),
        };
        setDocumentSnapshots((prev) => [snapDoc, ...prev]);
        if (user) {
          writeDocImmediate(['users', user.uid, 'snapshots', snapDoc.id], snapDoc, OperationType.CREATE);
        }
      }
    },
    [coverLetters, resumes, user, writeDocImmediate]
  );

  const undoLatestSnapshotForDocument = useCallback(
    (documentKind: 'resume' | 'cover-letter', documentId: string) => {
      const latest = documentSnapshots.find(
        (s) => s.documentKind === documentKind && s.documentId === documentId
      );
      if (latest) {
        undoReviewSnapshot(latest.id);
      }
    },
    [documentSnapshots, undoReviewSnapshot]
  );

  const activeResume = resumes.find((r) => r.id === activeResumeId) || resumes[0];
  const activeCoverLetter = coverLetters.find((c) => c.id === activeCoverLetterId) || coverLetters[0];

  return (
    <CareerContext.Provider
      value={{
        user,
        authLoading,
        syncStatus,
        syncError,
        signInWithGoogle,
        signOutUser,
        driveConnected,
        driveExportSettings,
        updateDriveExportSettings,
        pendingDriveExports,
        driveError,
        clearDriveError,
        isFlushingDriveQueue,
        connectGoogleDrive,
        exportDocumentToDrive,
        notifyDocumentMilestoneExport,
        flushPendingDriveExports,
        exportAllDocumentsToDrive,
        activeModule,
        setActiveModule,
        profile,
        updateProfile,
        jobs,
        addJob,
        updateJob,
        queueJobTask,
        deleteJob,
        stickyNotes,
        stickyCategories,
        addStickyNote,
        updateStickyNote,
        deleteStickyNote,
        addStickyCategory,
        resetDemoStickyNotes,
        isStickyNotesOpen,
        isStickyNotesMinimized,
        openStickyNotes,
        closeStickyNotes,
        minimizeStickyNotes,
        restoreStickyNotes,
        resumes,
        activeResumeId,
        setActiveResumeId,
        activeResume,
        createResume,
        duplicateResume,
        renameResume,
        updateResume,
        deleteResume,
        importProfileIntoResume,
        coverLetters,
        activeCoverLetterId,
        setActiveCoverLetterId,
        activeCoverLetter,
        createCoverLetter,
        duplicateCoverLetter,
        renameCoverLetter,
        updateCoverLetter,
        deleteCoverLetter,
        openTailoredResumeForJob,
        openCoverLetterForJob,
        selectedJobId,
        setSelectedJobId,
        companies,
        companyResearches,
        jobMatches,
        getCompanyResearchForJob,
        getJobMatchForJob,
        saveCompanyResearch,
        updateFindingStatus,
        saveJobMatch,
        applicationReviews,
        activeReviewId,
        setActiveReviewId,
        documentSnapshots,
        reviewScoringConfig,
        setReviewScoringConfig,
        reviewLaunchTarget,
        clearReviewLaunchTarget,
        openReviewCenter,
        saveApplicationReview,
        updateReviewFinding,
        resolveFactDiscrepancy,
        applyReviewChanges,
        undoReviewSnapshot,
        aiWritingHistory,
        upsertAiWritingSession,
        recordDocumentSnapshot,
        undoLatestSnapshotForDocument,
        lastSavedAt,
      }}
    >
      {children}
    </CareerContext.Provider>
  );
}

export function useCareer(): CareerContextValue {
  const ctx = useContext(CareerContext);
  if (!ctx) {
    throw new Error('useCareer must be used within a CareerProvider');
  }
  return ctx;
}

export function useOptionalCareer(): CareerContextValue | null {
  return useContext(CareerContext);
}

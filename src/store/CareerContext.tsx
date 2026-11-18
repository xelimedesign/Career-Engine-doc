import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AIWritingSessionRecord,
  ApplicationReviewRecord,
  AppModule,
  CareerProfile,
  CompanyProfile,
  CompanyResearch,
  CoverLetterDocument,
  DocumentRevisionSnapshot,
  FactDiscrepancy,
  FindingVerificationStatus,
  JobApplication,
  JobMatch,
  ResumeDocument,
  ReviewFinding,
  ReviewScope,
  ReviewScoringConfig,
} from '../types/career';
import {
  createResumeFromProfile,
  DEFAULT_COVER_LETTER_FORMATTING,
  INITIAL_CAREER_PROFILE,
  INITIAL_COVER_LETTERS,
  INITIAL_JOBS,
  INITIAL_RESUMES,
} from '../data/defaultData';
import { DEFAULT_REVIEW_SCORING_CONFIG } from '../services/reviewScoring';

const STORAGE_KEY = 'career_engine_workspace_v1';

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

interface CareerContextValue {
  activeModule: AppModule;
  setActiveModule: (mod: AppModule) => void;

  profile: CareerProfile;
  updateProfile: (updater: (prev: CareerProfile) => CareerProfile) => void;

  jobs: JobApplication[];
  addJob: (job: Omit<JobApplication, 'id' | 'createdAt' | 'updatedAt'>) => JobApplication;
  updateJob: (id: string, updater: (prev: JobApplication) => JobApplication) => void;
  deleteJob: (id: string) => void;

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

function loadInitialState(): PersistedWorkspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>;
      const profile = parsed.profile ?? INITIAL_CAREER_PROFILE;
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
    profile: INITIAL_CAREER_PROFILE,
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
    activeResumeId: INITIAL_RESUMES[0].id,
    activeCoverLetterId: INITIAL_COVER_LETTERS[0].id,
    activeReviewId: '',
  };
}

export function CareerProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState<PersistedWorkspace>(() => loadInitialState());
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
  const [activeReviewId, setActiveReviewId] = useState<string>(initial.activeReviewId);
  const [reviewLaunchTarget, setReviewLaunchTarget] = useState<ReviewLaunchTarget | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>(initial.jobs[0]?.id || '');
  const [activeResumeId, setActiveResumeId] = useState<string>(initial.activeResumeId);
  const [activeCoverLetterId, setActiveCoverLetterId] = useState<string>(initial.activeCoverLetterId);
  const [lastSavedAt, setLastSavedAt] = useState<string>(new Date().toISOString());

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
        activeResumeId,
        activeCoverLetterId,
        activeReviewId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setLastSavedAt(new Date().toISOString());
    } catch {
      // Ignore quota errors cleanly
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
    activeResumeId,
    activeCoverLetterId,
    activeReviewId,
  ]);

  const updateProfile = useCallback((updater: (prev: CareerProfile) => CareerProfile) => {
    setProfile((prev) => ({
      ...updater(prev),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const addJob = useCallback(
    (jobInput: Omit<JobApplication, 'id' | 'createdAt' | 'updatedAt'>): JobApplication => {
      const now = new Date().toISOString();
      const created: JobApplication = {
        ...jobInput,
        id: `job-${crypto.randomUUID().slice(0, 8)}`,
        createdAt: now,
        updatedAt: now,
      };
      setJobs((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const updateJob = useCallback((id: string, updater: (prev: JobApplication) => JobApplication) => {
    setJobs((prev) =>
      prev.map((item) =>
        item.id === id ? { ...updater(item), updatedAt: new Date().toISOString() } : item
      )
    );
  }, []);

  const deleteJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((item) => item.id !== id));
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
      return created;
    },
    [profile, resumes.length]
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
      return copy;
    },
    [resumes]
  );

  const renameResume = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setResumes((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, name: trimmed, updatedAt: new Date().toISOString() } : r
      )
    );
  }, []);

  const updateResume = useCallback((id: string, updater: (prev: ResumeDocument) => ResumeDocument) => {
    setResumes((prev) =>
      prev.map((r) =>
        r.id === id ? { ...updater(r), updatedAt: new Date().toISOString() } : r
      )
    );
  }, []);

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
    },
    [activeResumeId]
  );

  const importProfileIntoResume = useCallback(
    (resumeId: string) => {
      setResumes((prev) =>
        prev.map((r) => {
          if (r.id !== resumeId) return r;
          return {
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
        })
      );
    },
    [profile]
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
          (job ? `${job.company} — ${job.jobTitle}` : `Cover Letter ${coverLetters.length + 1}`),
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
                ? `I am writing to apply for the ${job.jobTitle} role at ${job.company}.`
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
      return created;
    },
    [coverLetters.length, jobs, profile.personal, resumes]
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
      return copy;
    },
    [coverLetters]
  );

  const renameCoverLetter = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setCoverLetters((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, title: trimmed, updatedAt: new Date().toISOString() } : c
      )
    );
  }, []);

  const updateCoverLetter = useCallback(
    (id: string, updater: (prev: CoverLetterDocument) => CoverLetterDocument) => {
      setCoverLetters((prev) =>
        prev.map((c) =>
          c.id === id ? { ...updater(c), updatedAt: new Date().toISOString() } : c
        )
      );
    },
    []
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
    },
    [activeCoverLetterId]
  );

  const openTailoredResumeForJob = useCallback(
    (jobId: string): ResumeDocument | undefined => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return undefined;
      const master = resumes.find((r) => r.isMaster) || resumes[0];
      if (!master) return undefined;
      const tailoredName = `${job.company} — ${job.jobTitle}`;
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
        title: `${job.company} — ${job.jobTitle}${suffix}`,
        linkedJobId: job.id,
        linkedResumeId: resumeId || resumes.find((r) => r.linkedJobId === job.id)?.id || resumes[0]?.id,
        prefillFromProfile: true,
      });
      setActiveModule('cover-letters');
      return created;
    },
    [coverLetters, createCoverLetter, jobs, resumes]
  );

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
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                companyId: companyProfile.id,
                companyWebsite: j.companyWebsite || companyProfile.officialWebsite || '',
                updatedAt: new Date().toISOString(),
              }
            : j
        )
      );
    },
    []
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
          return {
            ...r,
            findings: nextFindings,
            verificationStatus: allReviewed ? 'reviewed' : 'pending_review',
          };
        })
      );
    },
    []
  );

  const saveJobMatch = useCallback((jobId: string, match: JobMatch) => {
    setJobMatches((prev) => {
      const idx = prev.findIndex((m) => m.jobId === jobId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = match;
        return next;
      }
      return [match, ...prev];
    });
  }, []);

  const clearReviewLaunchTarget = useCallback(() => {
    setReviewLaunchTarget(null);
  }, []);

  const openReviewCenter = useCallback((options?: ReviewLaunchTarget) => {
    if (options) {
      setReviewLaunchTarget(options);
    }
    setActiveModule('review');
  }, []);

  const saveApplicationReview = useCallback((review: ApplicationReviewRecord) => {
    setApplicationReviews((prev) => [review, ...prev]);
    setActiveReviewId(review.id);
  }, []);

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
          return {
            ...rev,
            findings: nextFindings,
            acceptedChangeIds,
            rejectedChangeIds,
          };
        })
      );
    },
    []
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
          return {
            ...rev,
            factDiscrepancies: rev.factDiscrepancies.map((d) =>
              d.id === discrepancyId ? { ...d, resolutionStatus } : d
            ),
          };
        })
      );
    },
    []
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

      // Snapshot originals before applying changes so Undo / original recovery always works
      const newSnapshots: DocumentRevisionSnapshot[] = [];

      if (resumeFindings.length > 0 && review.resumeId) {
        const targetResume = resumes.find((r) => r.id === review.resumeId);
        if (targetResume) {
          newSnapshots.push({
            id: `snap-res-${crypto.randomUUID().slice(0, 8)}`,
            documentKind: 'resume',
            documentId: targetResume.id,
            reviewId: review.id,
            label: `Before Review Changes (v${targetResume.version})`,
            createdAt: now,
            snapshotData: structuredClone(targetResume),
          });

          setResumes((prevList) =>
            prevList.map((r) => {
              if (r.id !== targetResume.id) return r;
              let next = structuredClone(r);
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
              return {
                ...next,
                version: r.version + 1,
                updatedAt: now,
              };
            })
          );
        }
      }

      if (letterFindings.length > 0 && review.coverLetterId) {
        const targetLetter = coverLetters.find((c) => c.id === review.coverLetterId);
        if (targetLetter) {
          newSnapshots.push({
            id: `snap-cl-${crypto.randomUUID().slice(0, 8)}`,
            documentKind: 'cover-letter',
            documentId: targetLetter.id,
            reviewId: review.id,
            label: `Before Review Changes (v${targetLetter.version})`,
            createdAt: now,
            snapshotData: structuredClone(targetLetter),
          });

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
              return {
                ...next,
                version: cl.version + 1,
                updatedAt: now,
              };
            })
          );
        }
      }

      if (newSnapshots.length > 0) {
        setDocumentSnapshots((prev) => [...newSnapshots, ...prev]);
      }

      const appliedSet = new Set(targetFindings.map((f) => f.id));
      setApplicationReviews((prev) =>
        prev.map((rev) => {
          if (rev.id !== reviewId) return rev;
          const nextFindings = rev.findings.map((f) =>
            appliedSet.has(f.id) ? { ...f, status: 'applied' as const } : f
          );
          return {
            ...rev,
            findings: nextFindings,
            appliedChangeIds: Array.from(
              new Set([...rev.appliedChangeIds, ...Array.from(appliedSet)])
            ),
            acceptedChangeIds: nextFindings
              .filter((f) => f.status === 'accepted' || f.status === 'applied')
              .map((f) => f.id),
          };
        })
      );
    },
    [applicationReviews, coverLetters, resumes]
  );

  const undoReviewSnapshot = useCallback(
    (snapshotId: string) => {
      const snap = documentSnapshots.find((s) => s.id === snapshotId);
      if (!snap) return;

      const now = new Date().toISOString();
      if (snap.documentKind === 'resume') {
        const restored = structuredClone(snap.snapshotData as ResumeDocument);
        setResumes((prev) =>
          prev.map((r) =>
            r.id === snap.documentId
              ? { ...restored, updatedAt: now }
              : r
          )
        );
      } else {
        const restored = structuredClone(snap.snapshotData as CoverLetterDocument);
        setCoverLetters((prev) =>
          prev.map((c) =>
            c.id === snap.documentId
              ? { ...restored, updatedAt: now }
              : c
          )
        );
      }

      // Reset applied findings for that document back to 'accepted'
      setApplicationReviews((prev) =>
        prev.map((rev) => {
          if (rev.id !== snap.reviewId) return rev;
          const targetKind = snap.documentKind === 'resume' ? 'resume' : 'cover-letter';
          const nextFindings = rev.findings.map((f) =>
            f.status === 'applied' && f.documentTarget === targetKind
              ? { ...f, status: 'accepted' as const }
              : f
          );
          return {
            ...rev,
            findings: nextFindings,
            appliedChangeIds: nextFindings
              .filter((f) => f.status === 'applied')
              .map((f) => f.id),
          };
        })
      );

      setDocumentSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
    },
    [documentSnapshots]
  );

  const upsertAiWritingSession = useCallback((session: AIWritingSessionRecord) => {
    setAiWritingHistory((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = session;
        return next;
      }
      return [session, ...prev].slice(0, 120);
    });
  }, []);

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
        setDocumentSnapshots((prev) => [
          {
            id: `snap-ai-${crypto.randomUUID().slice(0, 8)}`,
            documentKind: 'resume',
            documentId,
            reviewId: sessionId,
            label,
            createdAt: now,
            snapshotData: structuredClone(target),
          },
          ...prev,
        ]);
      } else {
        const target = coverLetters.find((c) => c.id === documentId);
        if (!target) return;
        setDocumentSnapshots((prev) => [
          {
            id: `snap-ai-${crypto.randomUUID().slice(0, 8)}`,
            documentKind: 'cover-letter',
            documentId,
            reviewId: sessionId,
            label,
            createdAt: now,
            snapshotData: structuredClone(target),
          },
          ...prev,
        ]);
      }
    },
    [coverLetters, resumes]
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
        activeModule,
        setActiveModule,
        profile,
        updateProfile,
        jobs,
        addJob,
        updateJob,
        deleteJob,
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

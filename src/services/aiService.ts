import {
  AIWritingAnalyzeResponse,
  AIWritingGenerateResponse,
  AIWritingQuestion,
  AIWritingQuestionAnswer,
  ApplicantInfo,
  ApplicationReviewRecord,
  CareerProfile,
  CompanionDocumentType,
  CompanionFieldType,
  CompanyIntelligenceReport,
  CompanyResearch,
  CoverLetterDocument,
  CoverLetterEditAction,
  CoverLetterEditResponse,
  CoverLetterGenerateResponse,
  CoverLetterJobInfo,
  CoverLetterLength,
  CoverLetterParagraph,
  CoverLetterWritingStyle,
  EmployerInfo,
  JobAnalysis,
  JobApplication,
  JobMatch,
  ResearchConfidence,
  ResearchFinding,
  ResearchSource,
  ResumeAssistAction,
  ResumeAssistResponse,
  ResumeDocument,
  ReviewFinding,
  ReviewScope,
  ReviewScoringConfig,
} from '../types/career';

const DEFAULT_AI_REQUEST_TIMEOUT_MS = 90000;

async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs = DEFAULT_AI_REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
    }
    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('The AI request timed out after 90 seconds. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface JobAnalyzeResult extends JobAnalysis {
  requiredQualifications: string[];
  preferredQualifications: string[];
  responsibilities: string[];
  technicalRequirements: string[];
}

export interface CompanyResearchApiResponse {
  officialWebsite: string;
  industry: string;
  services: string[];
  description: string;
  overallConfidence: ResearchConfidence;
  searchQueries: string[];
  findings: ResearchFinding[];
  sources: ResearchSource[];
  report: CompanyIntelligenceReport;
  fromCache?: boolean;
}

function sanitizeReportField(
  text: string | undefined,
  dismissedTexts: string[]
): string {
  if (!text) return '';
  if (dismissedTexts.length === 0) return text;
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return !dismissedTexts.some((dismissed) => {
      if (dismissed.length < 8) return false;
      if (lower.includes(dismissed)) return true;
      const keywords = dismissed.split(/\W+/).filter((w) => w.length >= 5);
      if (keywords.length < 3) return false;
      const hits = keywords.filter((kw) => lower.includes(kw)).length;
      return hits >= Math.ceil(keywords.length * 0.7);
    });
  });
  return kept.join(' ').trim();
}

function sanitizeCompanyReport(
  report: CompanyIntelligenceReport,
  dismissedFindings: ResearchFinding[]
): CompanyIntelligenceReport {
  const dismissedTexts = dismissedFindings
    .map((f) => f.extractedInfo.trim().toLowerCase())
    .filter(Boolean);
  if (dismissedTexts.length === 0) return report;
  return {
    ...report,
    companyOverview: sanitizeReportField(report.companyOverview, dismissedTexts),
    servicesAndProducts: report.servicesAndProducts.filter(
      (item) => !dismissedTexts.some((d) => item.toLowerCase().includes(d) || d.includes(item.toLowerCase()))
    ),
    targetAudienceAndMarket: sanitizeReportField(report.targetAudienceAndMarket, dismissedTexts),
    missionAndValues: sanitizeReportField(report.missionAndValues, dismissedTexts),
    notableProjectsOrInitiatives: sanitizeReportField(report.notableProjectsOrInitiatives, dismissedTexts),
    technicalOrOperationalSignals: report.technicalOrOperationalSignals.filter(
      (item) => !dismissedTexts.some((d) => item.toLowerCase().includes(d) || d.includes(item.toLowerCase()))
    ),
    roleAlignmentInsights: sanitizeReportField(report.roleAlignmentInsights, dismissedTexts),
  };
}

export function buildApprovedCompanyIntelligencePayload(research?: CompanyResearch) {
  if (!research || research.status !== 'completed') return undefined;
  const dismissedFindings = research.findings.filter(
    (f) => f.verificationStatus === 'dismissed'
  );
  const approvedFindings = research.findings.filter(
    (f) => f.verificationStatus === 'approved'
  );
  const unreviewedCount = research.findings.filter(
    (f) => f.verificationStatus === 'unreviewed' || f.verificationStatus === 'needs_verification'
  ).length;
  return {
    companyName: research.companyName,
    companyWebsite: research.companyWebsite,
    overallConfidence: research.overallConfidence,
    report: sanitizeCompanyReport(research.report, dismissedFindings),
    approvedFindings,
    excludedDismissedCount: dismissedFindings.length,
    unreviewedFindingsOmitted: unreviewedCount,
  };
}

export function sanitizeCompanyResearchForReview(
  research?: CompanyResearch
): CompanyResearch | undefined {
  if (!research || research.status !== 'completed') return undefined;
  const dismissedFindings = research.findings.filter(
    (f) => f.verificationStatus === 'dismissed'
  );
  const approvedFindings = research.findings.filter(
    (f) => f.verificationStatus === 'approved'
  );
  return {
    ...research,
    findings: approvedFindings,
    report: sanitizeCompanyReport(research.report, dismissedFindings),
  };
}

export async function researchCompanyWithAi(params: {
  companyName: string;
  companyWebsite?: string;
  jobTitle?: string;
  jobDescription?: string;
  jobLocation?: string;
  forceRefresh?: boolean;
}): Promise<CompanyResearchApiResponse> {
  return postJson<CompanyResearchApiResponse>('/api/research/company', params);
}

export async function runThreeWayJobMatchWithAi(params: {
  job: JobApplication;
  companyResearch?: CompanyResearch;
  careerProfile: CareerProfile;
}): Promise<Omit<JobMatch, 'id' | 'jobId' | 'userProfileId' | 'matchedAt'>> {
  return postJson('/api/research/job-match', {
    job: params.job,
    companyResearch: buildApprovedCompanyIntelligencePayload(params.companyResearch),
    careerProfile: params.careerProfile,
  });
}

export async function analyzeJobWithAi(params: {
  jobTitle: string;
  company: string;
  jobDescription: string;
  profile: CareerProfile;
}): Promise<JobAnalyzeResult> {
  const res = await postJson<Omit<JobAnalyzeResult, 'analyzedAt'>>('/api/ai/job-analyze', params);
  return {
    ...res,
    analyzedAt: new Date().toISOString(),
  };
}

export async function assistResumeWithAi(params: {
  action: ResumeAssistAction;
  resume: ResumeDocument;
  targetJob?: JobApplication;
  experienceId?: string;
  companyResearch?: CompanyResearch;
  jobMatch?: JobMatch;
}): Promise<ResumeAssistResponse> {
  return postJson<ResumeAssistResponse>('/api/ai/resume-assist', {
    action: params.action,
    resume: params.resume,
    targetJob: params.targetJob,
    experienceId: params.experienceId,
    companyIntelligence: buildApprovedCompanyIntelligencePayload(params.companyResearch),
    jobMatch: params.jobMatch,
  });
}

export async function generateCoverLetterWithAi(params: {
  applicant: ApplicantInfo;
  employer: EmployerInfo;
  jobInfo: CoverLetterJobInfo;
  careerProfile: CareerProfile;
  selectedResume?: ResumeDocument;
  writingStyle: CoverLetterWritingStyle;
  length: CoverLetterLength;
  companyResearch?: CompanyResearch;
  jobMatch?: JobMatch;
}): Promise<CoverLetterGenerateResponse> {
  return postJson<CoverLetterGenerateResponse>('/api/ai/cover-letter-generate', {
    ...params,
    companyIntelligence: buildApprovedCompanyIntelligencePayload(params.companyResearch),
  });
}

export async function editCoverLetterWithAi(params: {
  action: CoverLetterEditAction;
  paragraphId?: string;
  currentParagraphText?: string;
  allParagraphs: CoverLetterParagraph[];
  writingStyle: CoverLetterWritingStyle;
  employer: EmployerInfo;
  jobInfo: CoverLetterJobInfo;
  careerProfile: CareerProfile;
  selectedResume?: ResumeDocument;
  companyResearch?: CompanyResearch;
  jobMatch?: JobMatch;
}): Promise<CoverLetterEditResponse> {
  return postJson<CoverLetterEditResponse>('/api/ai/cover-letter-edit', {
    action: params.action,
    paragraphId: params.paragraphId,
    currentParagraphText: params.currentParagraphText,
    allParagraphs: params.allParagraphs,
    writingStyle: params.writingStyle,
    employer: params.employer,
    jobInfo: params.jobInfo,
    careerProfile: params.careerProfile,
    selectedResume: params.selectedResume,
    companyIntelligence: buildApprovedCompanyIntelligencePayload(params.companyResearch),
    jobMatch: params.jobMatch,
  });
}

export async function runApplicationReviewWithAi(params: {
  scope: ReviewScope;
  careerProfile: CareerProfile;
  resume?: ResumeDocument;
  coverLetter?: CoverLetterDocument;
  job?: JobApplication;
  companyResearch?: CompanyResearch;
  previousApplications?: Array<{
    jobTitle: string;
    company: string;
    coverLetterTitle?: string;
    employerClaims?: string[];
  }>;
  scoringConfig?: ReviewScoringConfig;
}): Promise<ApplicationReviewRecord> {
  return postJson<ApplicationReviewRecord>('/api/review/analyze', {
    ...params,
    companyResearch: sanitizeCompanyResearchForReview(params.companyResearch),
  });
}

export async function regenerateReviewSuggestionWithAi(params: {
  finding: ReviewFinding;
  careerProfile: CareerProfile;
  targetJob?: JobApplication;
  userGuidance?: string;
}): Promise<{ recommendedCorrection: string; explanation: string }> {
  return postJson('/api/review/regenerate-suggestion', params);
}

export async function analyzeCompanionFieldWithAi(params: {
  fieldType: CompanionFieldType;
  currentValue: string;
  fieldLabel?: string;
  documentType: CompanionDocumentType;
  careerProfile: CareerProfile;
  documentContext?: unknown;
  jobContext?: JobApplication;
  companyResearch?: CompanyResearch;
}): Promise<AIWritingAnalyzeResponse> {
  return postJson<AIWritingAnalyzeResponse>('/api/ai/companion/analyze', {
    fieldType: params.fieldType,
    currentValue: params.currentValue,
    fieldLabel: params.fieldLabel,
    documentType: params.documentType,
    careerProfile: params.careerProfile,
    documentContext: params.documentContext,
    jobContext: params.jobContext,
    companyResearch: buildApprovedCompanyIntelligencePayload(params.companyResearch),
  });
}

export async function adaptCompanionQuestionsWithAi(params: {
  fieldType: CompanionFieldType;
  currentValue: string;
  fieldLabel?: string;
  documentType: CompanionDocumentType;
  careerProfile: CareerProfile;
  documentContext?: unknown;
  jobContext?: JobApplication;
  companyResearch?: CompanyResearch;
  answeredQuestions: AIWritingQuestionAnswer[];
  remainingQuestions: AIWritingQuestion[];
}): Promise<{ questions: AIWritingQuestion[]; adaptationNote?: string }> {
  return postJson<{ questions: AIWritingQuestion[]; adaptationNote?: string }>(
    '/api/ai/companion/adapt',
    {
      fieldType: params.fieldType,
      currentValue: params.currentValue,
      fieldLabel: params.fieldLabel,
      documentType: params.documentType,
      careerProfile: params.careerProfile,
      documentContext: params.documentContext,
      jobContext: params.jobContext,
      companyResearch: buildApprovedCompanyIntelligencePayload(params.companyResearch),
      answeredQuestions: params.answeredQuestions,
      remainingQuestions: params.remainingQuestions,
    }
  );
}

export async function generateCompanionSuggestionWithAi(params: {
  fieldType: CompanionFieldType;
  currentValue: string;
  fieldLabel?: string;
  documentType: CompanionDocumentType;
  careerProfile: CareerProfile;
  documentContext?: unknown;
  jobContext?: JobApplication;
  companyResearch?: CompanyResearch;
  qaPairs: AIWritingQuestionAnswer[];
  regenerationInstruction?: string;
}): Promise<AIWritingGenerateResponse> {
  return postJson<AIWritingGenerateResponse>('/api/ai/companion/generate', {
    fieldType: params.fieldType,
    currentValue: params.currentValue,
    fieldLabel: params.fieldLabel,
    documentType: params.documentType,
    careerProfile: params.careerProfile,
    documentContext: params.documentContext,
    jobContext: params.jobContext,
    companyResearch: buildApprovedCompanyIntelligencePayload(params.companyResearch),
    qaPairs: params.qaPairs,
    regenerationInstruction: params.regenerationInstruction,
  });
}

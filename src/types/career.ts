export type AppModule = 'profile' | 'jobs' | 'resumes' | 'cover-letters' | 'review' | 'documents';

export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Freelance' | 'Internship';

export interface PersonalInfo {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
  website: string;
}

export interface ProfessionalSummary {
  headline: string;
  summary: string;
  careerObjectives: string;
}

export interface WorkExperienceItem {
  id: string;
  company: string;
  position: string;
  location: string;
  employmentType: EmploymentType;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities: string[];
  achievements: string[];
  technologies: string[];
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  graduationDate: string;
  details: string;
}

export interface SkillsGroup {
  technical: string[];
  software: string[];
  professional: string[];
  industry: string[];
}

export type SkillCategoryKey = keyof SkillsGroup;

export interface SkillEntry {
  id: string;
  category: SkillCategoryKey;
  name: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  role: string;
  url: string;
  startDate: string;
  endDate: string;
  description: string;
  technologies: string[];
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
  credentialId: string;
  url: string;
}

export interface AwardItem {
  id: string;
  title: string;
  issuer: string;
  date: string;
  description: string;
}

export interface VolunteerItem {
  id: string;
  organization: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface LanguageItem {
  id: string;
  language: string;
  proficiency: string;
}

export interface PublicationItem {
  id: string;
  title: string;
  publisher: string;
  date: string;
  url: string;
  summary: string;
}

export interface CareerProfile {
  personal: PersonalInfo;
  summary: ProfessionalSummary;
  workExperience: WorkExperienceItem[];
  education: EducationItem[];
  skills: SkillsGroup;
  skillEntries?: SkillEntry[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  awards: AwardItem[];
  volunteer: VolunteerItem[];
  languages: LanguageItem[];
  publications: PublicationItem[];
  updatedAt: string;
}

export type ResumeSectionKey =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'awards'
  | 'volunteer'
  | 'languages'
  | 'publications';

export interface ResumeSectionConfig {
  id: ResumeSectionKey;
  label: string;
  enabled: boolean;
}

export type ResumeTemplateId = 'professional' | 'modern' | 'minimal' | 'technical' | 'creative';
export type DocumentFontFamily = 'sans' | 'serif' | 'editorial' | 'mono';
export type DocumentProfileId = 'harvard-professional' | 'modern-professional' | 'technical-professional';

export interface ResumeFormatting {
  fontFamily: DocumentFontFamily;
  fontSize: number; // pt (9.5 - 12)
  headingSize: number; // pt (12 - 20)
  accentColor: string;
  sectionSpacing: number; // px (10 - 26)
  pageMargins: number; // inches (0.45 - 1.0)
  lineSpacing: number; // 1.15 - 1.6
  headerAlignment: 'left' | 'center';
}

export interface ResumeDocument {
  id: string;
  name: string;
  version: number;
  isMaster: boolean;
  linkedJobId?: string;
  documentProfile?: DocumentProfileId;
  personal: PersonalInfo;
  summary: ProfessionalSummary;
  workExperience: WorkExperienceItem[];
  education: EducationItem[];
  skills: SkillsGroup;
  projects: ProjectItem[];
  certifications: CertificationItem[];
  awards: AwardItem[];
  volunteer: VolunteerItem[];
  languages: LanguageItem[];
  publications: PublicationItem[];
  sections: ResumeSectionConfig[];
  template: ResumeTemplateId;
  formatting: ResumeFormatting;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveExportedAt?: string;
  driveFolderName?: string;
  driveSyncStatus?: DriveSyncStatus;
  driveSyncError?: string;
  createdAt: string;
  updatedAt: string;
}

export type JobStatus = 'Saved' | 'Applied' | 'Interviewing' | 'Offer' | 'Archived';

export interface JobAnalysis {
  matchedSkills: string[];
  missingSkills: string[];
  keyThemes: string[];
  tailoringSuggestions: string[];
  analyzedAt: string;
}

export type JobIntakeStatus =
  | 'needs_extraction'
  | 'ready_for_tailoring'
  | 'needs_manual_input'
  | 'tailoring'
  | 'tailored'
  | 'failed';

export type JobTaskType = 'resume' | 'cover_letter' | 'both';

export type JobTaskStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed';

export type StickyNoteThemeId = 'purple' | 'yellow' | 'green' | 'blue' | 'pink' | 'graphite';

export interface StickyNoteItem {
  id: string;
  theme: StickyNoteThemeId;
  category: string;
  date: string;
  bannerType: string;
  customImage?: string | null;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplication {
  id: string;
  companyId?: string;
  company: string;
  companyWebsite?: string;
  sourceUrl?: string;
  jobStatus?: JobIntakeStatus;
  selectedTask?: JobTaskType | null;
  taskStatus?: JobTaskStatus;
  taskReason?: string;
  jobTitle: string;
  jobLocation?: string;
  department: string;
  companyAddress: string;
  hiringManager: string;
  applicationDate: string;
  status: JobStatus;
  jobDescription: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
  responsibilities: string[];
  technicalRequirements: string[];
  applicationNotes?: string;
  analysis?: JobAnalysis;
  noteCategory?: string;
  noteTheme?: StickyNoteThemeId;
  noteDate?: string;
  noteBannerType?: string;
  noteCustomImage?: string | null;
  isNoteOnly?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CoverLetterWritingStyle =
  | 'Professional'
  | 'Conversational'
  | 'Confident'
  | 'Technical'
  | 'Entry-Level'
  | 'Career Change'
  | 'Concise';

export type CoverLetterLength = 'Short' | 'Standard' | 'Detailed';

export type CoverLetterTemplateId = 'traditional' | 'modern' | 'minimal' | 'technical' | 'creative';

export type CoverLetterEditAction =
  | 'Improve Writing'
  | 'Rewrite Paragraph'
  | 'Improve Opening'
  | 'Improve Closing'
  | 'Make More Professional'
  | 'Make More Natural'
  | 'Shorten'
  | 'Expand'
  | 'Fix Grammar'
  | 'Remove Repetition';

export interface ApplicantInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
  website: string;
}

export interface EmployerInfo {
  companyName: string;
  hiringManager: string;
  jobTitle: string;
  department: string;
  companyAddress: string;
  applicationDate: string;
}

export interface CoverLetterJobInfo {
  jobDescription: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
  responsibilities: string[];
  technicalRequirements: string[];
}

export interface CoverLetterParagraph {
  id: string;
  label: string;
  text: string;
}

export interface CoverLetterContent {
  salutation: string;
  paragraphs: CoverLetterParagraph[];
  closingSignOff: string;
  signatureName: string;
}

export interface CoverLetterFormatting {
  fontFamily: DocumentFontFamily;
  fontSize: number; // pt (10 - 12.5)
  headingSize: number; // pt (13 - 22)
  textAlignment: 'left' | 'justify';
  pageMargins: number; // inches (0.6 - 1.1)
  lineSpacing: number; // 1.15 - 1.65
  paragraphSpacing: number; // px (8 - 22)
  accentColor: string;
}

export interface CoverLetterDocument {
  id: string;
  title: string;
  version: number;
  linkedResumeId?: string;
  linkedJobId?: string;
  documentProfile?: DocumentProfileId;
  applicant: ApplicantInfo;
  employer: EmployerInfo;
  jobInfo: CoverLetterJobInfo;
  content: CoverLetterContent;
  writingStyle: CoverLetterWritingStyle;
  length: CoverLetterLength;
  template: CoverLetterTemplateId;
  formatting: CoverLetterFormatting;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveExportedAt?: string;
  driveFolderName?: string;
  driveSyncStatus?: DriveSyncStatus;
  driveSyncError?: string;
  createdAt: string;
  updatedAt: string;
}

export type ResumeAssistAction =
  | 'write_summary'
  | 'improve_experience'
  | 'fix_grammar'
  | 'audit_gaps'
  | 'tailor_to_job';

export interface ResumeAssistResponse {
  rationale: string;
  proposedHeadline?: string;
  proposedSummary?: string;
  experienceUpdates: Array<{
    id: string;
    position?: string;
    company?: string;
    responsibilities: string[];
    achievements: string[];
  }>;
  suggestedSkillsToHighlight: string[];
  missingInformationWarnings: string[];
  jobAlignmentNotes: string[];
}

export interface CoverLetterGenerateResponse {
  salutation: string;
  paragraphs: Array<{ label: string; text: string }>;
  closingSignOff: string;
  groundingNotes: string[];
}

export interface CoverLetterEditResponse {
  rationale: string;
  updatedParagraphs: Array<{ id: string; label: string; text: string }>;
}

export type StandardsCategoryKey =
  | 'formatting'
  | 'content'
  | 'relevance'
  | 'experience'
  | 'grammar'
  | 'organization'
  | 'ats';

export interface StandardsDeduction {
  reason: string;
  recommendation: string;
  pointsDeducted: number;
}

export interface StandardsCategoryScore {
  key: StandardsCategoryKey;
  label: string;
  component: string;
  score: number;
  maxScore: number;
  checksPassed: string[];
  deductions: StandardsDeduction[];
}

export interface DocumentQualityReport {
  documentKind: 'resume' | 'cover-letter';
  documentProfile: DocumentProfileId;
  totalScore: number;
  maxScore: 100;
  categories: StandardsCategoryScore[];
  summaryRecommendations: string[];
}

export type ResearchConfidence = 'high' | 'medium' | 'low';
export type FindingVerificationStatus = 'pending' | 'approved' | 'dismissed' | 'needs_verification';
export type SourceType = 'official_website' | 'careers_page' | 'news_press' | 'third_party';

export type ResearchCategory =
  | 'Company Overview'
  | 'Services & Specialties'
  | 'Industry'
  | 'Projects & Portfolio'
  | 'Technology & Software'
  | 'Mission & Values'
  | 'Recent News & Developments'
  | 'Careers & Expectations'
  | 'Job Requirements';

export interface CompanyProfile {
  id: string;
  companyName: string;
  officialWebsite: string;
  industry: string;
  services: string[];
  description: string;
  updatedAt: string;
}

export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  sourceType: SourceType;
  isOfficial: boolean;
  publicationDate?: string;
  accessedAt: string;
}

export interface ResearchFinding {
  id: string;
  category: ResearchCategory;
  extractedInfo: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceType: SourceType;
  publicationDate?: string;
  dateResearched: string;
  confidence: ResearchConfidence;
  verificationStatus: FindingVerificationStatus;
  isAiInterpretation?: boolean;
  conflictNote?: string;
}

export interface CompanyIntelligenceReport {
  companyOverview: string;
  servicesAndSpecialties: string;
  industry: string;
  projectsAndPortfolio: string;
  technology: string;
  missionAndValues: string;
  recentDevelopments: string;
  employeeExpectations: string;
  relevantCompanyInformation: string;
  applicationRecommendations: string[];
  sourceConflicts: string[];
}

export interface CompanyResearch {
  id: string;
  companyId: string;
  jobApplicationId: string;
  companyName: string;
  companyWebsite: string;
  jobLocation: string;
  researchDate: string;
  status: 'idle' | 'researching' | 'completed' | 'error';
  errorMessage?: string;
  overallConfidence: ResearchConfidence;
  verificationStatus: 'pending_review' | 'reviewed';
  searchQueries: string[];
  findings: ResearchFinding[];
  sources: ResearchSource[];
  report: CompanyIntelligenceReport;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveExportedAt?: string;
  driveFolderName?: string;
  driveSyncStatus?: DriveSyncStatus;
  driveSyncError?: string;
}

export type DriveExportFormat = 'pdf' | 'docx' | 'google_doc';
export type DriveSyncStatus = 'synced' | 'pending_auth' | 'error';

export interface DriveExportSettings {
  autoExportEnabled: boolean;
  format: DriveExportFormat;
  organizeByJobFolder: boolean;
  folderId?: string;
  folderWebViewLink?: string;
}

export interface PendingDriveExport {
  kind: 'resume' | 'cover-letter' | 'research';
  id: string;
  title: string;
  queuedAt: string;
}

export interface JobMatch {
  id: string;
  jobId: string;
  userProfileId: string;
  matchedAt: string;
  strongMatches: string[];
  partialMatches: string[];
  missingQualifications: string[];
  relevantAchievements: string[];
  recommendedResumeEmphasis: {
    experienceToEmphasize: string[];
    skillsToPrioritize: string[];
    relevantAchievements: string[];
    suggestedSectionOrder: ResumeSectionKey[];
    descriptionImprovements: string[];
  };
  recommendedCoverLetterTalkingPoints: string[];
}

export type ReviewScope = 'full_application' | 'resume_only' | 'cover_letter_only';
export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ReviewFindingStatus = 'open' | 'accepted' | 'rejected' | 'applied';
export type JobRequirementMatchStatus =
  | 'Verified Match'
  | 'Partial Match'
  | 'Missing'
  | 'Not Applicable'
  | 'Requires Verification';

export interface ReviewTargetField {
  kind:
    | 'resume_headline'
    | 'resume_summary'
    | 'resume_experience_bullet'
    | 'resume_skills'
    | 'cover_letter_paragraph'
    | 'cover_letter_salutation'
    | 'cover_letter_closing'
    | 'advisory_only';
  itemId?: string;
  bulletGroup?: 'responsibilities' | 'achievements';
  bulletIndex?: number;
}

export interface ReviewFinding {
  id: string;
  category:
    | 'Resume Audit'
    | 'Cover Letter Audit'
    | 'Job Match'
    | 'Company Alignment'
    | 'Fact Verification'
    | 'ATS Validation';
  severity: ReviewSeverity;
  documentTarget: 'resume' | 'cover-letter' | 'application';
  documentReference: string;
  targetField?: ReviewTargetField;
  originalText: string;
  explanation: string;
  recommendedCorrection: string;
  editedCorrection?: string;
  supportingEvidence: string;
  confidence: ResearchConfidence;
  status: ReviewFindingStatus;
}

export interface FactDiscrepancy {
  id: string;
  fieldName: string;
  originalValue: string;
  conflictingValue: string;
  sourceDocument: string;
  recommendedAction: string;
  resolutionStatus: 'unresolved' | 'confirmed_profile' | 'confirmed_document' | 'dismissed';
}

export interface RequirementComparisonItem {
  id: string;
  requirementType:
    | 'Required Qualification'
    | 'Preferred Qualification'
    | 'Technical Skill'
    | 'Responsibility'
    | 'Company Priority';
  requirement: string;
  classification: JobRequirementMatchStatus;
  evidenceFromProfileOrDocs: string;
  gapOrActionNote: string;
}

export interface AtsValidationCheck {
  id: string;
  checkName: string;
  category: 'structural' | 'keyword';
  status: 'pass' | 'warning' | 'fail';
  detail: string;
  recommendation: string;
}

export interface ReviewScoreCategory {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  supportingFindings: string[];
}

export interface ReviewScoringConfig {
  version: string;
  applicationWeights: {
    resume: number; // default 0.40
    coverLetter: number; // default 0.30
    jobMatch: number; // default 0.20
    companyAlignment: number; // default 0.10
  };
  resumeWeights: {
    formatting: number; // 15
    experienceQuality: number; // 20
    skillsAlignment: number; // 15
    achievementStatements: number; // 15
    jobRelevance: number; // 15
    grammar: number; // 10
    atsReadability: number; // 10
  };
  coverLetterWeights: {
    professionalWriting: number; // 15
    jobRelevance: number; // 20
    companyPersonalization: number; // 20
    relevantExperience: number; // 15
    openingAndClosing: number; // 10
    grammar: number; // 10
    formatting: number; // 10
  };
}

export interface DocumentRevisionSnapshot {
  id: string;
  documentKind: 'resume' | 'cover-letter';
  documentId: string;
  reviewId: string;
  label: string;
  createdAt: string;
  snapshotData: ResumeDocument | CoverLetterDocument;
}

export interface ApplicationReviewRecord {
  id: string;
  reviewDate: string;
  scope: ReviewScope;
  resumeId?: string;
  resumeTitle?: string;
  coverLetterId?: string;
  coverLetterTitle?: string;
  jobId?: string;
  jobTitle?: string;
  companyName?: string;
  aiProvider: string;
  aiModel: string;
  configVersion: string;
  scores: {
    overallScore: number;
    resumeScore: number;
    coverLetterScore: number;
    jobMatchScore: number;
    companyAlignmentScore: number;
    resumeBreakdown: ReviewScoreCategory[];
    coverLetterBreakdown: ReviewScoreCategory[];
  };
  findings: ReviewFinding[];
  factDiscrepancies: FactDiscrepancy[];
  requirementComparison: RequirementComparisonItem[];
  atsValidation: {
    structuralScore: number;
    keywordScore: number;
    disclaimer: string;
    checks: AtsValidationCheck[];
  };
  companyAlignmentSummary: {
    alignedClaims: string[];
    unsupportedOrOutdatedClaims: string[];
    missingCompanyContext: string[];
    notes: string;
  };
  verifiedInformation: string[];
  acceptedChangeIds: string[];
  rejectedChangeIds: string[];
  appliedChangeIds: string[];
}

export type CompanionFieldType =
  | 'Professional Summary'
  | 'Work Experience'
  | 'Job Responsibilities'
  | 'Achievements'
  | 'Technical Skills'
  | 'Education'
  | 'Projects'
  | 'Certifications'
  | 'Cover Letter Opening'
  | 'Cover Letter Body'
  | 'Cover Letter Closing'
  | 'Career Objectives'
  | 'Application Notes';

export type CompanionDocumentType =
  | 'resume'
  | 'cover-letter'
  | 'career-profile'
  | 'job-application';

export interface AIWritingQuestion {
  id: string;
  question: string;
  purpose: string;
  choices: string[];
  allowMultipleChoices: boolean;
  placeholder: string;
}

export interface AIWritingQuestionAnswer {
  questionId: string;
  question: string;
  selectedChoices: string[];
  customAnswer: string;
  combinedAnswer: string;
  skipped: boolean;
}

export interface AIWritingValidationFlag {
  id: string;
  category:
    | 'invented_metric'
    | 'unsupported_achievement'
    | 'unverified_software'
    | 'incorrect_date'
    | 'incorrect_employer'
    | 'unsupported_qualification';
  severity: 'high' | 'medium';
  claim: string;
  reason: string;
  clarificationPrompt: string;
}

export interface AIWritingAnalyzeResponse {
  assistantIntro: string;
  knownFacts: string[];
  missingInformation: string[];
  hasEnoughInformation: boolean;
  questions: AIWritingQuestion[];
}

export interface AIWritingGenerateResponse {
  suggestedContent: string;
  changes: string[];
  usedFacts: string[];
  validation: {
    status: 'verified' | 'warnings_found';
    summary: string;
    flags: AIWritingValidationFlag[];
  };
}

export interface AIWritingSuggestionEntry {
  id: string;
  generatedAt: string;
  suggestedText: string;
  editedText?: string;
  changes: string[];
  validationStatus: 'verified' | 'warnings_found';
  validationFlags: AIWritingValidationFlag[];
  status: 'pending' | 'accepted' | 'rejected' | 'restored';
  resolvedAt?: string;
}

export interface AIWritingSessionRecord {
  id: string;
  documentType: CompanionDocumentType;
  documentId: string;
  documentTitle?: string;
  documentVersion?: number;
  fieldType: CompanionFieldType;
  fieldKey: string;
  fieldLabel?: string;
  originalContent: string;
  answers: AIWritingQuestionAnswer[];
  suggestions: AIWritingSuggestionEntry[];
  acceptedContent?: string;
  status: 'in_progress' | 'accepted' | 'rejected' | 'cancelled' | 'restored';
  createdAt: string;
  updatedAt: string;
}




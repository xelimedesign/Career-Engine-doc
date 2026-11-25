import {
  AIWritingAnalyzeResponse,
  AIWritingGenerateResponse,
  AIWritingQuestion,
  AIWritingQuestionAnswer,
  AIWritingValidationFlag,
  ApplicantInfo,
  ApplicationReviewRecord,
  AtsValidationCheck,
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
  JobRequirementMatchStatus,
  RequirementComparisonItem,
  ResearchConfidence,
  ResearchFinding,
  ResearchSource,
  ResumeAssistAction,
  ResumeAssistResponse,
  ResumeDocument,
  ResumeSectionKey,
  ReviewFinding,
  ReviewScope,
  ReviewScoreCategory,
  ReviewScoringConfig,
  ReviewSeverity,
  ReviewTargetField,
} from '../types/career';
import { getAiProviderConfig } from './aiProviderConfig';
import { extractJsonObjectSafe, ollamaChatCompletion } from './ollamaClient';
import {
  calculateWeightedApplicationScore,
  DEFAULT_REVIEW_SCORING_CONFIG,
} from './reviewScoring';
import { isJobBoardOrAggregatorUrl, isPlaceholderOrAggregatorName } from '../utils/companyResolver';

const STRICT_GROUNDING_RULE = `
CRITICAL FACTUAL INTEGRITY RULES:
1. NEVER invent, fabricate, or hallucinate employment history, job titles, company names, employment dates, degrees, institutions, certifications, awards, skills, software, projects, metrics, percentages, dollar figures, or accomplishments that are NOT explicitly present in the provided user profile, resume, or interview answers.
2. Only rephrase, tighten, clarify, reorganize, improve grammar, or emphasize verified facts provided by the user.
3. If the target job asks for a qualification or skill the candidate has NOT listed, do NOT claim they have it.
4. Keep prose crisp, natural, concrete, and free of generic AI filler clichés.
5. Return ONLY a valid JSON object matching the exact schema requested—no markdown fences or commentary outside JSON.
`.trim();

async function runOllamaJsonTask<T>(params: {
  taskLabel: string;
  systemPrompt: string;
  userPayload: unknown;
  fallback: T;
  temperature?: number;
  onToken?: (token: string, accumulated: string) => void;
}): Promise<T> {
  const cfg = getAiProviderConfig();
  const { content } = await ollamaChatCompletion({
    baseUrl: cfg.ollamaBaseUrl,
    apiKey: cfg.ollamaApiKey,
    model: cfg.ollamaModel,
    taskLabel: params.taskLabel,
    temperature: params.temperature ?? 0.2,
    onToken: params.onToken,
    messages: [
      { role: 'system', content: params.systemPrompt },
      {
        role: 'user',
        content:
          typeof params.userPayload === 'string'
            ? params.userPayload
            : JSON.stringify(params.userPayload),
      },
    ],
  });

  const parsed = extractJsonObjectSafe<T>(content, params.fallback);
  return parsed;
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
}

export interface OllamaJobAnalyzeResult extends JobAnalysis {
  requiredQualifications: string[];
  preferredQualifications: string[];
  responsibilities: string[];
  technicalRequirements: string[];
  analyzedAt: string;
}

export async function ollamaAnalyzeJob(params: {
  jobTitle: string;
  company: string;
  jobDescription: string;
  profile: CareerProfile;
}): Promise<OllamaJobAnalyzeResult> {
  const fallback = {
    requiredQualifications: [] as string[],
    preferredQualifications: [] as string[],
    responsibilities: [] as string[],
    technicalRequirements: [] as string[],
    matchedSkills: [] as string[],
    missingSkills: [] as string[],
    keyThemes: [] as string[],
    tailoringSuggestions: [] as string[],
  };

  const parsed = await runOllamaJsonTask({
    taskLabel: 'Analyzing job description',
    systemPrompt: `You are an expert technical recruiter and career strategist.
${STRICT_GROUNDING_RULE}
Return a JSON object with EXACTLY these keys (all arrays of strings):
{
  "requiredQualifications": string[],
  "preferredQualifications": string[],
  "responsibilities": string[],
  "technicalRequirements": string[],
  "matchedSkills": string[],
  "missingSkills": string[],
  "keyThemes": string[],
  "tailoringSuggestions": string[]
}`,
    userPayload: {
      jobTitle: params.jobTitle,
      company: params.company,
      jobDescription: params.jobDescription,
      candidateProfile: params.profile,
    },
    fallback,
  });

  return {
    requiredQualifications: asStringArray(parsed.requiredQualifications),
    preferredQualifications: asStringArray(parsed.preferredQualifications),
    responsibilities: asStringArray(parsed.responsibilities),
    technicalRequirements: asStringArray(parsed.technicalRequirements),
    matchedSkills: asStringArray(parsed.matchedSkills),
    missingSkills: asStringArray(parsed.missingSkills),
    keyThemes: asStringArray(parsed.keyThemes),
    tailoringSuggestions: asStringArray(parsed.tailoringSuggestions),
    analyzedAt: new Date().toISOString(),
  };
}

export async function ollamaAssistResume(params: {
  action: ResumeAssistAction;
  resume: ResumeDocument;
  careerProfile?: CareerProfile;
  targetJob?: JobApplication;
  experienceId?: string;
  companyIntelligence?: unknown;
  jobMatch?: JobMatch;
}): Promise<ResumeAssistResponse> {
  const fallback: ResumeAssistResponse = {
    rationale: 'Unable to parse structured suggestions from Ollama response.',
    proposedHeadline: '',
    proposedSummary: '',
    experienceUpdates: [],
    suggestedSkillsToHighlight: [],
    missingInformationWarnings: [],
    jobAlignmentNotes: [],
  };

  const parsed = await runOllamaJsonTask<ResumeAssistResponse>({
    taskLabel: `Resume assist (${params.action})`,
    systemPrompt: `You are a meticulous executive resume editor following Harvard Career Services writing standards.
${STRICT_GROUNDING_RULE}
HARVARD RESUME STANDARDS:
- Start every bullet point with a strong action verb.
- Omit personal pronouns completely (no "I", "me", "my", "we", "our").
- Only update existing experience entries matching IDs present in resume.workExperience.

Return a JSON object with EXACTLY this shape:
{
  "rationale": string,
  "proposedHeadline": string,
  "proposedSummary": string,
  "experienceUpdates": [
    {
      "id": string,
      "position": string,
      "company": string,
      "responsibilities": string[],
      "achievements": string[]
    }
  ],
  "suggestedSkillsToHighlight": string[],
  "missingInformationWarnings": string[],
  "jobAlignmentNotes": string[]
}`,
    userPayload: {
      action: params.action,
      experienceId: params.experienceId || null,
      resume: params.resume,
      careerProfile: params.careerProfile || null,
      targetJob: params.targetJob || null,
      companyIntelligence: params.companyIntelligence || null,
      jobMatch: params.jobMatch || null,
    },
    fallback,
  });

  return {
    rationale: typeof parsed.rationale === 'string' && parsed.rationale ? parsed.rationale : fallback.rationale,
    proposedHeadline: typeof parsed.proposedHeadline === 'string' ? parsed.proposedHeadline : '',
    proposedSummary: typeof parsed.proposedSummary === 'string' ? parsed.proposedSummary : '',
    experienceUpdates: Array.isArray(parsed.experienceUpdates)
      ? parsed.experienceUpdates
          .filter((eu) => eu && typeof eu.id === 'string')
          .map((eu) => ({
            id: eu.id,
            position: typeof eu.position === 'string' ? eu.position : undefined,
            company: typeof eu.company === 'string' ? eu.company : undefined,
            responsibilities: asStringArray(eu.responsibilities),
            achievements: asStringArray(eu.achievements),
          }))
      : [],
    suggestedSkillsToHighlight: asStringArray(parsed.suggestedSkillsToHighlight),
    missingInformationWarnings: asStringArray(parsed.missingInformationWarnings),
    jobAlignmentNotes: asStringArray(parsed.jobAlignmentNotes),
  };
}

export async function ollamaGenerateCoverLetter(params: {
  applicant: ApplicantInfo;
  employer: EmployerInfo;
  jobInfo: CoverLetterJobInfo;
  careerProfile: CareerProfile;
  selectedResume?: ResumeDocument;
  writingStyle: CoverLetterWritingStyle;
  length: CoverLetterLength;
  companyIntelligence?: unknown;
  jobMatch?: JobMatch;
}): Promise<CoverLetterGenerateResponse> {
  const fallback: CoverLetterGenerateResponse = {
    salutation: params.employer.hiringManager
      ? `Dear ${params.employer.hiringManager},`
      : 'Dear Hiring Team,',
    paragraphs: [],
    closingSignOff: 'Sincerely,',
    groundingNotes: [],
  };

  const lengthGuidance =
    params.length === 'Short'
      ? '3 concise paragraphs (~180-230 words total)'
      : params.length === 'Detailed'
        ? '4-5 rich paragraphs (~360-440 words total)'
        : '4 well-paced paragraphs (~260-330 words total)';

  const parsed = await runOllamaJsonTask<CoverLetterGenerateResponse>({
    taskLabel: 'Generating cover letter',
    systemPrompt: `You are a master career writer composing a tailored cover letter following Harvard Career Services standards.
${STRICT_GROUNDING_RULE}
STYLE: ${params.writingStyle || 'Professional'}
LENGTH TARGET: ${lengthGuidance} (max 1 page)
Return a JSON object with EXACTLY this shape:
{
  "salutation": string,
  "paragraphs": [{ "label": string, "text": string }],
  "closingSignOff": string,
  "groundingNotes": string[]
}`,
    userPayload: {
      applicant: params.applicant,
      employer: params.employer,
      jobInfo: params.jobInfo,
      careerProfile: params.careerProfile,
      selectedResume: params.selectedResume,
      companyIntelligence: params.companyIntelligence || null,
      jobMatch: params.jobMatch || null,
      writingStyle: params.writingStyle || 'Professional',
      length: params.length || 'Standard',
    },
    fallback,
  });

  return {
    salutation: typeof parsed.salutation === 'string' && parsed.salutation ? parsed.salutation : fallback.salutation,
    paragraphs: Array.isArray(parsed.paragraphs)
      ? parsed.paragraphs
          .filter((p) => p && typeof p.text === 'string' && p.text.trim())
          .map((p, idx) => ({
            label: typeof p.label === 'string' && p.label.trim() ? p.label.trim() : `Paragraph ${idx + 1}`,
            text: p.text.trim(),
          }))
      : [],
    closingSignOff:
      typeof parsed.closingSignOff === 'string' && parsed.closingSignOff
        ? parsed.closingSignOff
        : 'Sincerely,',
    groundingNotes: asStringArray(parsed.groundingNotes),
  };
}

export async function ollamaEditCoverLetter(params: {
  action: CoverLetterEditAction;
  paragraphId?: string;
  currentParagraphText?: string;
  allParagraphs: CoverLetterParagraph[];
  writingStyle: CoverLetterWritingStyle;
  employer: EmployerInfo;
  jobInfo: CoverLetterJobInfo;
  careerProfile: CareerProfile;
  selectedResume?: ResumeDocument;
  companyIntelligence?: unknown;
  jobMatch?: JobMatch;
}): Promise<CoverLetterEditResponse> {
  const fallback: CoverLetterEditResponse = {
    rationale: 'No changes generated.',
    updatedParagraphs: [],
  };

  const parsed = await runOllamaJsonTask<CoverLetterEditResponse>({
    taskLabel: `Cover letter edit (${params.action})`,
    systemPrompt: `You are an expert editorial coach refining a cover letter.
${STRICT_GROUNDING_RULE}
If targetScope is "single_paragraph", return a single item in updatedParagraphs preserving that paragraph's id and label.
If targetScope is "full_letter", return all paragraphs revised in updatedParagraphs preserving each id and label.
Return a JSON object with EXACTLY this shape:
{
  "rationale": string,
  "updatedParagraphs": [{ "id": string, "label": string, "text": string }]
}`,
    userPayload: {
      action: params.action,
      targetScope: params.paragraphId ? 'single_paragraph' : 'full_letter',
      paragraphId: params.paragraphId || null,
      currentParagraphText: params.currentParagraphText || null,
      allParagraphs: params.allParagraphs || [],
      writingStyle: params.writingStyle || 'Professional',
      employer: params.employer,
      jobInfo: params.jobInfo,
      careerProfile: params.careerProfile,
      selectedResume: params.selectedResume,
      companyIntelligence: params.companyIntelligence || null,
      jobMatch: params.jobMatch || null,
    },
    fallback,
  });

  return {
    rationale: typeof parsed.rationale === 'string' && parsed.rationale ? parsed.rationale : fallback.rationale,
    updatedParagraphs: Array.isArray(parsed.updatedParagraphs)
      ? parsed.updatedParagraphs
          .filter((p) => p && typeof p.id === 'string' && typeof p.text === 'string')
          .map((p) => ({
            id: p.id,
            label: typeof p.label === 'string' ? p.label : 'Paragraph',
            text: p.text,
          }))
      : [],
  };
}

export interface OllamaCompanyResearchResponse {
  companyName: string;
  website: string | null;
  headquarters: string | null;
  overview: string | null;
  coreFocus: string[];
  missingInfo: string[];
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

export async function ollamaResearchCompany(params: {
  companyName: string;
  companyWebsite?: string;
  jobTitle?: string;
  jobDescription?: string;
  jobLocation?: string;
  sourceUrl?: string;
  retrievedSnippets?: Array<{
    title: string;
    url: string;
    snippet: string;
    sourceType?: ResearchSource['sourceType'];
    isOfficial?: boolean;
  }>;
  sources?: Array<{
    title: string;
    url: string;
    sourceType?: ResearchSource['sourceType'];
    isOfficial?: boolean;
  }>;
  searchQueries?: string[];
}): Promise<OllamaCompanyResearchResponse> {
  const nowIso = new Date().toISOString();
  const serverSources: ResearchSource[] = (Array.isArray(params.sources) ? params.sources : []).map(
    (s, idx) => ({
      id: `src-ol-${idx + 1}-${Date.now().toString(36)}`,
      title: s.title || s.url,
      url: s.url,
      sourceType: s.sourceType || 'third_party',
      isOfficial: Boolean(s.isOfficial),
      accessedAt: nowIso,
    })
  );
  const allowedUrlSet = new Set(serverSources.map((s) => s.url));
  const sourceLookup = new Map(serverSources.map((s) => [s.url, s]));

  const fallbackReport: CompanyIntelligenceReport = {
    companyOverview: `Summary for ${params.companyName} grounded strictly in retrieved snippets and job posting.`,
    servicesAndSpecialties: 'Requires verification.',
    industry: 'Requires verification.',
    projectsAndPortfolio: 'Requires verification.',
    technology: 'Requires verification.',
    missionAndValues: 'Requires verification.',
    recentDevelopments: 'Requires verification.',
    employeeExpectations: 'Requires verification.',
    relevantCompanyInformation: 'Verify directly against the company website and job posting.',
    applicationRecommendations: [],
    sourceConflicts: [],
  };

  const safeProvidedWebsite =
    params.companyWebsite && !isJobBoardOrAggregatorUrl(params.companyWebsite)
      ? params.companyWebsite.trim()
      : '';
  const officialServerWebsite =
    serverSources.find((s) => s.isOfficial && !isJobBoardOrAggregatorUrl(s.url))?.url || null;

  const safeInputCompany = !isPlaceholderOrAggregatorName(params.companyName)
    ? params.companyName.trim()
    : '';

  const fallback = {
    companyName: safeInputCompany,
    website: safeProvidedWebsite || officialServerWebsite,
    headquarters: null as string | null,
    overview: null as string | null,
    coreFocus: [] as string[],
    missingInfo: [
      ...(safeInputCompany
        ? []
        : ['Employer name could not be reliably identified from the provided fields, description, or link.']),
      'Could not verify employer website or full company profile from the provided link/text.',
    ],
    officialWebsite: safeProvidedWebsite || officialServerWebsite || '',
    industry: '',
    services: [] as string[],
    description: '',
    overallConfidence: serverSources.length > 0 ? 'medium' : 'low',
    findings: [] as Array<{
      category: string;
      extractedInfo: string;
      sourceTitle?: string;
      sourceUrl?: string;
      sourceType?: string;
      confidence?: string;
    }>,
    report: fallbackReport,
  };

  let parsed = fallback;
  try {
    parsed = await runOllamaJsonTask({
      taskLabel: `Company research (${safeInputCompany || 'Employer lookup'})`,
      systemPrompt: `You are a rigorous Company Intelligence Analyst extracting structured facts strictly from retrievedSnippets and the job posting.
STRICT ANTI-FABRICATION RULES:
"Only state facts supported by the provided snippets or job posting. Do not guess or invent a company name, website, headquarters, hiring managers, street addresses, employee counts, or claims. Set unknown fields to null (or "" for companyName if unidentified) and list any unverified or missing items in missingInfo."

Return ONLY a JSON object with this exact shape:
{
  "companyName": string,
  "website": string | null,
  "headquarters": string | null,
  "overview": string | null,
  "coreFocus": string[],
  "missingInfo": string[],
  "officialWebsite": string,
  "industry": string,
  "services": string[],
  "description": string,
  "overallConfidence": "high" | "medium" | "low",
  "findings": [{ "category": "Company Overview"|"Services & Specialties"|"Industry"|"Projects & Portfolio"|"Technology & Software"|"Mission & Values"|"Recent News & Developments"|"Careers & Expectations"|"Job Requirements", "extractedInfo": string, "sourceTitle": string, "sourceUrl": string, "confidence": "high"|"medium"|"low" }],
  "report": {
    "companyOverview": string,
    "servicesAndSpecialties": string,
    "industry": string,
    "projectsAndPortfolio": string,
    "technology": string,
    "missionAndValues": string,
    "recentDevelopments": string,
    "employeeExpectations": string,
    "relevantCompanyInformation": string,
    "applicationRecommendations": string[],
    "sourceConflicts": string[]
  }
}`,
      userPayload: {
        companyName: safeInputCompany,
        companyWebsite: params.companyWebsite || '',
        jobTitle: params.jobTitle || '',
        jobLocation: params.jobLocation || '',
        sourceUrl: params.sourceUrl || '',
        jobDescription: (params.jobDescription || '').slice(0, 6000),
        retrievedSnippets: params.retrievedSnippets || [],
        sources: serverSources,
      },
      fallback,
    });
  } catch {
    parsed = fallback;
  }

  const VALID_CATS = new Set([
    'Company Overview',
    'Services & Specialties',
    'Industry',
    'Projects & Portfolio',
    'Technology & Software',
    'Mission & Values',
    'Recent News & Developments',
    'Careers & Expectations',
    'Job Requirements',
  ]);

  const findings: ResearchFinding[] = (Array.isArray(parsed.findings) ? parsed.findings : [])
    .filter((f) => f && typeof f.extractedInfo === 'string' && f.extractedInfo.trim())
    .map((f, idx) => {
      const candidateUrl = typeof f.sourceUrl === 'string' ? f.sourceUrl.trim() : '';
      const verifiedUrl = candidateUrl && allowedUrlSet.has(candidateUrl) ? candidateUrl : '';
      const matched = verifiedUrl ? sourceLookup.get(verifiedUrl) : undefined;
      const conf: ResearchConfidence = verifiedUrl
        ? f.confidence === 'high' || f.confidence === 'medium' || f.confidence === 'low'
          ? f.confidence
          : 'medium'
        : 'low';
      return {
        id: `fnd-ol-${idx + 1}-${Date.now().toString(36)}`,
        category: (VALID_CATS.has(f.category)
          ? f.category
          : 'Company Overview') as ResearchFinding['category'],
        extractedInfo: f.extractedInfo.trim(),
        sourceTitle: matched?.title || (verifiedUrl ? f.sourceTitle || verifiedUrl : 'Job Posting / Snippet Note'),
        sourceUrl: verifiedUrl,
        sourceType: matched?.sourceType || 'third_party',
        publicationDate: '',
        dateResearched: nowIso,
        confidence: conf,
        verificationStatus: 'pending',
        isAiInterpretation: !verifiedUrl,
        conflictNote: '',
      };
    });

  const report: CompanyIntelligenceReport = {
    ...fallbackReport,
    ...(parsed.report && typeof parsed.report === 'object' ? parsed.report : {}),
    applicationRecommendations: asStringArray(parsed.report?.applicationRecommendations),
    sourceConflicts: asStringArray(parsed.report?.sourceConflicts),
  };

  const rawParsedWebsite = typeof parsed.website === 'string' ? parsed.website.trim() : '';
  const websiteVal =
    rawParsedWebsite &&
    /^https?:\/\//i.test(rawParsedWebsite) &&
    !isJobBoardOrAggregatorUrl(rawParsedWebsite)
      ? rawParsedWebsite
      : safeProvidedWebsite || officialServerWebsite;

  const coreFocus = asStringArray(parsed.coreFocus);
  const services = asStringArray(parsed.services);
  const missingInfo = asStringArray(parsed.missingInfo);
  if (!websiteVal && !missingInfo.some((m) => m.toLowerCase().includes('website'))) {
    missingInfo.push('Official company website was not verified in retrieved snippets.');
  }
  if (!parsed.headquarters && !missingInfo.some((m) => m.toLowerCase().includes('headquarters'))) {
    missingInfo.push('Headquarters location was not verified in retrieved snippets.');
  }

  const rawParsedName = typeof parsed.companyName === 'string' ? parsed.companyName.trim() : '';
  const finalOllamaCompany =
    (!isPlaceholderOrAggregatorName(rawParsedName) ? rawParsedName : '') || safeInputCompany;
  if (
    !finalOllamaCompany &&
    !missingInfo.some((m) => m.toLowerCase().includes('employer name'))
  ) {
    missingInfo.unshift(
      'Employer name could not be reliably identified from the provided fields, description, or link.'
    );
  }

  return {
    companyName: finalOllamaCompany,
    website: websiteVal,
    headquarters:
      typeof parsed.headquarters === 'string' && parsed.headquarters.trim()
        ? parsed.headquarters.trim()
        : null,
    overview:
      typeof parsed.overview === 'string' && parsed.overview.trim()
        ? parsed.overview.trim()
        : typeof parsed.description === 'string' && parsed.description.trim()
        ? parsed.description.trim()
        : null,
    coreFocus: coreFocus.length > 0 ? coreFocus : services,
    missingInfo,
    officialWebsite: websiteVal || '',
    industry: typeof parsed.industry === 'string' ? parsed.industry : '',
    services: services.length > 0 ? services : coreFocus,
    description:
      (typeof parsed.overview === 'string' && parsed.overview.trim()) ||
      parsed.description ||
      report.companyOverview,
    overallConfidence:
      serverSources.length === 0
        ? 'low'
        : parsed.overallConfidence === 'high' || parsed.overallConfidence === 'medium' || parsed.overallConfidence === 'low'
        ? parsed.overallConfidence
        : 'medium',
    searchQueries:
      Array.isArray(params.searchQueries) && params.searchQueries.length > 0
        ? params.searchQueries
        : [params.companyName],
    findings,
    sources: serverSources,
    report,
    fromCache: false,
  };
}

export async function ollamaRunThreeWayJobMatch(params: {
  job: JobApplication;
  companyIntelligence?: unknown;
  careerProfile: CareerProfile;
}): Promise<Omit<JobMatch, 'id' | 'jobId' | 'userProfileId' | 'matchedAt'>> {
  const fallback: Omit<JobMatch, 'id' | 'jobId' | 'userProfileId' | 'matchedAt'> = {
    strongMatches: [],
    partialMatches: [],
    missingQualifications: [],
    relevantAchievements: [],
    recommendedResumeEmphasis: {
      experienceToEmphasize: [],
      skillsToPrioritize: [],
      relevantAchievements: [],
      suggestedSectionOrder: ['summary', 'experience', 'skills', 'projects', 'education'],
      descriptionImprovements: [],
    },
    recommendedCoverLetterTalkingPoints: [],
  };

  const parsed = await runOllamaJsonTask({
    taskLabel: 'Three-way job match',
    systemPrompt: `You are a three-way Career Matching Engine comparing Company Intelligence, Target Job Description, and Candidate Career Profile.
${STRICT_GROUNDING_RULE}
Return a JSON object with EXACTLY this shape:
{
  "strongMatches": string[],
  "partialMatches": string[],
  "missingQualifications": string[],
  "relevantAchievements": string[],
  "recommendedResumeEmphasis": {
    "experienceToEmphasize": string[],
    "skillsToPrioritize": string[],
    "relevantAchievements": string[],
    "suggestedSectionOrder": string[],
    "descriptionImprovements": string[]
  },
  "recommendedCoverLetterTalkingPoints": string[]
}`,
    userPayload: {
      job: params.job,
      companyResearch: params.companyIntelligence || null,
      careerProfile: params.careerProfile,
    },
    fallback,
  });

  const VALID_SECTIONS = new Set<ResumeSectionKey>([
    'summary',
    'experience',
    'education',
    'skills',
    'projects',
    'certifications',
    'awards',
    'volunteer',
    'languages',
    'publications',
  ]);

  const rawOrder = asStringArray(parsed.recommendedResumeEmphasis?.suggestedSectionOrder);
  const filteredOrder = rawOrder.filter((s): s is ResumeSectionKey =>
    VALID_SECTIONS.has(s as ResumeSectionKey)
  );

  return {
    strongMatches: asStringArray(parsed.strongMatches),
    partialMatches: asStringArray(parsed.partialMatches),
    missingQualifications: asStringArray(parsed.missingQualifications),
    relevantAchievements: asStringArray(parsed.relevantAchievements),
    recommendedResumeEmphasis: {
      experienceToEmphasize: asStringArray(parsed.recommendedResumeEmphasis?.experienceToEmphasize),
      skillsToPrioritize: asStringArray(parsed.recommendedResumeEmphasis?.skillsToPrioritize),
      relevantAchievements: asStringArray(parsed.recommendedResumeEmphasis?.relevantAchievements),
      suggestedSectionOrder:
        filteredOrder.length > 0
          ? filteredOrder
          : fallback.recommendedResumeEmphasis.suggestedSectionOrder,
      descriptionImprovements: asStringArray(
        parsed.recommendedResumeEmphasis?.descriptionImprovements
      ),
    },
    recommendedCoverLetterTalkingPoints: asStringArray(parsed.recommendedCoverLetterTalkingPoints),
  };
}

export async function ollamaRunApplicationReview(params: {
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
  const cfg = getAiProviderConfig();
  const config = params.scoringConfig || DEFAULT_REVIEW_SCORING_CONFIG;
  const nowIso = new Date().toISOString();

  const parsed = await runOllamaJsonTask<{
    resumeBreakdown?: Array<{ key?: string; label?: string; score?: number; maxScore?: number; supportingFindings?: string[] }>;
    coverLetterBreakdown?: Array<{ key?: string; label?: string; score?: number; maxScore?: number; supportingFindings?: string[] }>;
    jobMatchScore?: number;
    companyAlignmentScore?: number;
    findings?: Array<Record<string, unknown>>;
    requirementComparison?: Array<Record<string, unknown>>;
    atsChecks?: Array<{ checkName?: string; category?: string; status?: string; detail?: string; recommendation?: string }>;
    companyAlignmentSummary?: {
      alignedClaims?: string[];
      unsupportedOrOutdatedClaims?: string[];
      missingCompanyContext?: string[];
      notes?: string;
    };
  }>({
    taskLabel: 'Running application review',
    systemPrompt: `You are an expert ATS auditor, fact-checker, and Harvard Career Services reviewer auditing an application.
${STRICT_GROUNDING_RULE}
Compare resume and coverLetter strictly against careerProfile, job, and companyResearch.
Return ONLY JSON with this structure:
{
  "resumeBreakdown": [{ "key": "formatting"|"experienceQuality"|"skillsAlignment"|"achievementStatements"|"jobRelevance"|"grammar"|"atsReadability", "label": string, "score": number, "maxScore": number, "supportingFindings": string[] }],
  "coverLetterBreakdown": [{ "key": "professionalWriting"|"jobRelevance"|"companyPersonalization"|"relevantExperience"|"openingAndClosing"|"grammar"|"formatting", "label": string, "score": number, "maxScore": number, "supportingFindings": string[] }],
  "jobMatchScore": number,
  "companyAlignmentScore": number,
  "findings": [
    {
      "category": "Resume Audit"|"Cover Letter Audit"|"Job Match"|"Company Alignment"|"Fact Verification"|"ATS Validation",
      "severity": "critical"|"high"|"medium"|"low",
      "documentTarget": "resume"|"cover-letter"|"application",
      "documentReference": string,
      "targetKind": "resume_headline"|"resume_summary"|"resume_experience_bullet"|"resume_skills"|"cover_letter_paragraph"|"cover_letter_salutation"|"cover_letter_closing"|"advisory_only",
      "originalText": string,
      "explanation": string,
      "recommendedCorrection": string,
      "supportingEvidence": string,
      "confidence": "high"|"medium"|"low"
    }
  ],
  "requirementComparison": [
    {
      "requirementType": "Required Qualification"|"Preferred Qualification"|"Technical Skill"|"Responsibility"|"Company Priority",
      "requirement": string,
      "classification": "Verified Match"|"Partial Match"|"Missing"|"Not Applicable"|"Requires Verification",
      "evidenceFromProfileOrDocs": string,
      "gapOrActionNote": string
    }
  ],
  "companyAlignmentSummary": {
    "alignedClaims": string[],
    "unsupportedOrOutdatedClaims": string[],
    "missingCompanyContext": string[],
    "notes": string
  }
}`,
    userPayload: {
      scope: params.scope,
      careerProfile: params.careerProfile,
      resume: params.resume || null,
      coverLetter: params.coverLetter || null,
      job: params.job || null,
      companyResearch: params.companyResearch || null,
      previousApplications: params.previousApplications || [],
    },
    fallback: {},
  });

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));

  const resumeMaxMap: Array<{ key: keyof ReviewScoringConfig['resumeWeights']; label: string }> = [
    { key: 'formatting', label: 'Formatting' },
    { key: 'experienceQuality', label: 'Experience Quality' },
    { key: 'skillsAlignment', label: 'Skills Alignment' },
    { key: 'achievementStatements', label: 'Achievement Statements' },
    { key: 'jobRelevance', label: 'Job Relevance' },
    { key: 'grammar', label: 'Grammar' },
    { key: 'atsReadability', label: 'ATS Readability' },
  ];

  const coverLetterMaxMap: Array<{
    key: keyof ReviewScoringConfig['coverLetterWeights'];
    label: string;
  }> = [
    { key: 'professionalWriting', label: 'Professional Writing' },
    { key: 'jobRelevance', label: 'Job Relevance' },
    { key: 'companyPersonalization', label: 'Company Personalization' },
    { key: 'relevantExperience', label: 'Relevant Experience' },
    { key: 'openingAndClosing', label: 'Opening and Closing' },
    { key: 'grammar', label: 'Grammar' },
    { key: 'formatting', label: 'Formatting' },
  ];

  const rawResume = Array.isArray(parsed.resumeBreakdown) ? parsed.resumeBreakdown : [];
  const resumeBreakdown: ReviewScoreCategory[] =
    params.scope === 'cover_letter_only'
      ? []
      : resumeMaxMap.map((spec) => {
          const maxScore = config.resumeWeights[spec.key];
          const found = rawResume.find(
            (r) =>
              (r.key || '').toLowerCase() === spec.key.toLowerCase() ||
              (r.label || '').toLowerCase() === spec.label.toLowerCase()
          );
          const ratio =
            found && typeof found.maxScore === 'number' && found.maxScore > 0 && typeof found.score === 'number'
              ? found.score / found.maxScore
              : 0.82;
          return {
            key: spec.key,
            label: spec.label,
            score: clamp(ratio * maxScore, 0, maxScore),
            maxScore,
            supportingFindings: asStringArray(found?.supportingFindings),
          };
        });

  const rawCl = Array.isArray(parsed.coverLetterBreakdown) ? parsed.coverLetterBreakdown : [];
  const coverLetterBreakdown: ReviewScoreCategory[] =
    params.scope === 'resume_only'
      ? []
      : coverLetterMaxMap.map((spec) => {
          const maxScore = config.coverLetterWeights[spec.key];
          const found = rawCl.find(
            (r) =>
              (r.key || '').toLowerCase() === spec.key.toLowerCase() ||
              (r.label || '').toLowerCase() === spec.label.toLowerCase()
          );
          const ratio =
            found && typeof found.maxScore === 'number' && found.maxScore > 0 && typeof found.score === 'number'
              ? found.score / found.maxScore
              : 0.82;
          return {
            key: spec.key,
            label: spec.label,
            score: clamp(ratio * maxScore, 0, maxScore),
            maxScore,
            supportingFindings: asStringArray(found?.supportingFindings),
          };
        });

  const sumScorePct = (list: ReviewScoreCategory[]) => {
    const s = list.reduce((acc, item) => acc + item.score, 0);
    const m = list.reduce((acc, item) => acc + item.maxScore, 0);
    return m > 0 ? clamp((s / m) * 100, 0, 100) : 0;
  };

  const resumeScore = params.scope === 'cover_letter_only' ? 0 : sumScorePct(resumeBreakdown);
  const coverLetterScore = params.scope === 'resume_only' ? 0 : sumScorePct(coverLetterBreakdown);
  const jobMatchScore = clamp(Number(parsed.jobMatchScore ?? 76), 0, 100);
  const companyAlignmentScore = clamp(Number(parsed.companyAlignmentScore ?? 72), 0, 100);

  const overallScore = calculateWeightedApplicationScore({
    scope: params.scope,
    resumeScore,
    coverLetterScore,
    jobMatchScore,
    companyAlignmentScore,
    config,
  });

  const VALID_SEVERITIES = new Set<ReviewSeverity>(['critical', 'high', 'medium', 'low']);
  const VALID_CATEGORIES = new Set<ReviewFinding['category']>([
    'Resume Audit',
    'Cover Letter Audit',
    'Job Match',
    'Company Alignment',
    'Fact Verification',
    'ATS Validation',
  ]);
  const VALID_TARGET_KINDS = new Set<ReviewTargetField['kind']>([
    'resume_headline',
    'resume_summary',
    'resume_experience_bullet',
    'resume_skills',
    'cover_letter_paragraph',
    'cover_letter_salutation',
    'cover_letter_closing',
    'advisory_only',
  ]);

  const findings: ReviewFinding[] = (Array.isArray(parsed.findings) ? parsed.findings : []).map(
    (f, idx) => {
      const sev = String(f.severity || 'medium').toLowerCase() as ReviewSeverity;
      const cat = String(f.category || 'Resume Audit') as ReviewFinding['category'];
      const kind = String(f.targetKind || 'advisory_only') as ReviewTargetField['kind'];
      const docTarget =
        f.documentTarget === 'resume' ||
        f.documentTarget === 'cover-letter' ||
        f.documentTarget === 'application'
          ? f.documentTarget
          : 'application';
      const conf =
        f.confidence === 'high' || f.confidence === 'medium' || f.confidence === 'low'
          ? (f.confidence as ResearchConfidence)
          : 'medium';
      return {
        id: `rev-ol-${idx + 1}-${Date.now().toString(36)}`,
        category: VALID_CATEGORIES.has(cat) ? cat : 'Resume Audit',
        severity: VALID_SEVERITIES.has(sev) ? sev : 'medium',
        documentTarget: docTarget,
        documentReference: String(f.documentReference || 'Document'),
        targetField: {
          kind: VALID_TARGET_KINDS.has(kind) ? kind : 'advisory_only',
        },
        originalText: String(f.originalText || ''),
        explanation: String(f.explanation || ''),
        recommendedCorrection: String(f.recommendedCorrection || ''),
        supportingEvidence: String(f.supportingEvidence || ''),
        confidence: conf,
        status: 'open',
      };
    }
  );

  const VALID_MATCH_STATUSES = new Set<JobRequirementMatchStatus>([
    'Verified Match',
    'Partial Match',
    'Missing',
    'Not Applicable',
    'Requires Verification',
  ]);

  const requirementComparison: RequirementComparisonItem[] = (
    Array.isArray(parsed.requirementComparison) ? parsed.requirementComparison : []
  ).map((item, idx) => {
    const cls = String(item.classification || 'Requires Verification') as JobRequirementMatchStatus;
    return {
      id: `req-ol-${idx + 1}`,
      requirementType: String(
        item.requirementType || 'Required Qualification'
      ) as RequirementComparisonItem['requirementType'],
      requirement: String(item.requirement || ''),
      classification: VALID_MATCH_STATUSES.has(cls) ? cls : 'Requires Verification',
      evidenceFromProfileOrDocs: String(item.evidenceFromProfileOrDocs || ''),
      gapOrActionNote: String(item.gapOrActionNote || ''),
    };
  });

  const atsChecks: AtsValidationCheck[] = params.resume
    ? [
        {
          id: 'ats-contact',
          checkName: 'Contact Header Completeness',
          category: 'structural',
          status:
            params.resume.personal.fullName && params.resume.personal.email ? 'pass' : 'warning',
          detail:
            params.resume.personal.fullName && params.resume.personal.email
              ? 'Full name and email are present.'
              : 'Name or email is missing.',
          recommendation: 'Ensure full name and email are filled in the header.',
        },
        {
          id: 'ats-sections',
          checkName: 'Standard Section Headings',
          category: 'structural',
          status: params.resume.workExperience.length > 0 ? 'pass' : 'warning',
          detail: `${params.resume.workExperience.length} experience role(s) listed.`,
          recommendation: 'Keep standard ATS-readable headings (Experience, Education, Skills).',
        },
      ]
    : [];

  return {
    id: `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    reviewDate: nowIso,
    scope: params.scope,
    resumeId: params.resume?.id,
    resumeTitle: params.resume?.name,
    coverLetterId: params.coverLetter?.id,
    coverLetterTitle: params.coverLetter?.title,
    jobId: params.job?.id,
    jobTitle: params.job?.jobTitle,
    companyName: params.job?.company || params.coverLetter?.employer.companyName,
    aiProvider: 'Ollama',
    aiModel: cfg.ollamaModel || 'ollama',
    configVersion: config.version,
    scores: {
      overallScore,
      resumeScore,
      coverLetterScore,
      jobMatchScore,
      companyAlignmentScore,
      resumeBreakdown,
      coverLetterBreakdown,
    },
    findings,
    factDiscrepancies: [],
    requirementComparison,
    atsValidation: {
      structuralScore: params.resume ? 88 : 0,
      keywordScore: jobMatchScore,
      disclaimer:
        'ATS checks run client-side structural validation paired with local Ollama model analysis.',
      checks: atsChecks,
    },
    companyAlignmentSummary: {
      alignedClaims: asStringArray(parsed.companyAlignmentSummary?.alignedClaims),
      unsupportedOrOutdatedClaims: asStringArray(
        parsed.companyAlignmentSummary?.unsupportedOrOutdatedClaims
      ),
      missingCompanyContext: asStringArray(parsed.companyAlignmentSummary?.missingCompanyContext),
      notes:
        typeof parsed.companyAlignmentSummary?.notes === 'string'
          ? parsed.companyAlignmentSummary.notes
          : 'Reviewed using local Ollama provider.',
    },
    verifiedInformation: [],
    acceptedChangeIds: [],
    rejectedChangeIds: [],
    appliedChangeIds: [],
  };
}

export async function ollamaRegenerateReviewSuggestion(params: {
  finding: ReviewFinding;
  careerProfile: CareerProfile;
  targetJob?: JobApplication;
  userGuidance?: string;
}): Promise<{ recommendedCorrection: string; explanation: string }> {
  const fallback = {
    recommendedCorrection: params.finding.recommendedCorrection,
    explanation: params.finding.explanation,
  };

  const parsed = await runOllamaJsonTask({
    taskLabel: 'Regenerating review suggestion',
    systemPrompt: `You are an executive document editor regenerating an alternative revision for a single review finding.
${STRICT_GROUNDING_RULE}
Return a JSON object with EXACTLY this shape:
{
  "recommendedCorrection": string,
  "explanation": string
}`,
    userPayload: params,
    fallback,
  });

  return {
    recommendedCorrection: parsed.recommendedCorrection || fallback.recommendedCorrection,
    explanation: parsed.explanation || fallback.explanation,
  };
}

export async function ollamaAnalyzeCompanionField(params: {
  fieldType: CompanionFieldType;
  currentValue: string;
  fieldLabel?: string;
  documentType: CompanionDocumentType;
  careerProfile: CareerProfile;
  documentContext?: unknown;
  jobContext?: JobApplication;
  companyResearch?: unknown;
}): Promise<AIWritingAnalyzeResponse> {
  const fallback: AIWritingAnalyzeResponse = {
    assistantIntro: `Let’s strengthen your ${params.fieldType} using your verified background.`,
    knownFacts: [],
    missingInformation: [],
    hasEnoughInformation: false,
    questions: [
      {
        id: 'q-1',
        question: `What specific impact, tools, or scope should be highlighted in your ${params.fieldType}?`,
        purpose: 'Clarify concrete verified details.',
        choices: ['Highlight technical depth', 'Highlight measurable outcomes', 'Keep concise'],
        allowMultipleChoices: true,
        placeholder: 'Add verified details or context...',
      },
    ],
  };

  const parsed = await runOllamaJsonTask<AIWritingAnalyzeResponse>({
    taskLabel: `Analyzing ${params.fieldType}`,
    systemPrompt: `You are a thoughtful Career Engine writing coach helping strengthen "${params.fieldType}".
${STRICT_GROUNDING_RULE}
Generate 2 to 5 concise, context-aware interview questions without repeating facts already present in careerProfile or currentValue.
Return ONLY JSON with this exact shape:
{
  "assistantIntro": string,
  "knownFacts": string[],
  "missingInformation": string[],
  "hasEnoughInformation": boolean,
  "questions": [
    {
      "id": string,
      "question": string,
      "purpose": string,
      "choices": string[],
      "allowMultipleChoices": boolean,
      "placeholder": string
    }
  ]
}`,
    userPayload: {
      fieldType: params.fieldType,
      fieldLabel: params.fieldLabel || params.fieldType,
      documentType: params.documentType,
      currentValue: params.currentValue,
      careerProfile: params.careerProfile,
      documentContext: params.documentContext || null,
      jobContext: params.jobContext || null,
      companyResearch: params.companyResearch || null,
    },
    fallback,
  });

  const questions: AIWritingQuestion[] =
    Array.isArray(parsed.questions) && parsed.questions.length > 0
      ? parsed.questions.slice(0, 6).map((q, idx) => ({
          id: q.id || `q-${idx + 1}`,
          question: q.question || fallback.questions[0].question,
          purpose: q.purpose || 'Clarify context.',
          choices: asStringArray(q.choices).slice(0, 4),
          allowMultipleChoices: Boolean(q.allowMultipleChoices),
          placeholder: q.placeholder || 'Type your answer...',
        }))
      : fallback.questions;

  return {
    assistantIntro: parsed.assistantIntro || fallback.assistantIntro,
    knownFacts: asStringArray(parsed.knownFacts),
    missingInformation: asStringArray(parsed.missingInformation),
    hasEnoughInformation: Boolean(parsed.hasEnoughInformation),
    questions,
  };
}

export async function ollamaAdaptCompanionQuestions(params: {
  fieldType: CompanionFieldType;
  currentValue: string;
  fieldLabel?: string;
  documentType: CompanionDocumentType;
  careerProfile: CareerProfile;
  documentContext?: unknown;
  jobContext?: JobApplication;
  companyResearch?: unknown;
  answeredQuestions: AIWritingQuestionAnswer[];
  remainingQuestions: AIWritingQuestion[];
}): Promise<{ questions: AIWritingQuestion[]; adaptationNote?: string }> {
  if (!params.remainingQuestions || params.remainingQuestions.length === 0) {
    return { questions: [] };
  }

  const parsed = await runOllamaJsonTask<{
    adaptationNote?: string;
    questions: AIWritingQuestion[];
  }>({
    taskLabel: `Adapting questions (${params.fieldType})`,
    systemPrompt: `You adapt remaining interview questions based on answeredQuestions.
${STRICT_GROUNDING_RULE}
Return ONLY JSON:
{
  "adaptationNote": string,
  "questions": [
    {
      "id": string,
      "question": string,
      "purpose": string,
      "choices": string[],
      "allowMultipleChoices": boolean,
      "placeholder": string
    }
  ]
}`,
    userPayload: {
      fieldType: params.fieldType,
      currentValue: params.currentValue,
      answeredQuestions: params.answeredQuestions.map((a) => ({
        question: a.question,
        answer: a.skipped ? '(Skipped)' : a.combinedAnswer,
      })),
      remainingQuestions: params.remainingQuestions,
    },
    fallback: { questions: params.remainingQuestions },
  });

  return {
    adaptationNote: parsed.adaptationNote,
    questions:
      Array.isArray(parsed.questions) && parsed.questions.length > 0
        ? parsed.questions
        : params.remainingQuestions,
  };
}

function runDeterministicMetricValidation(
  suggestedContent: string,
  verifiedCorpus: string
): AIWritingValidationFlag[] {
  const matches = suggestedContent.match(
    /(?:\$[\d,]+(?:\.\d+)?[kKmMbB]?|\b\d+(?:\.\d+)?%|\b\d+(?:,\d{3})+(?:\+)?|\b\d+\s*(?:\+|x|years?|yrs?|months?|mos?|ms|seconds?|minutes?|hours?|users?|accounts?|customers?|clients?|engineers?|developers?|teams?|projects?|applications?|apps?|services?)\b)/gi
  );
  if (!matches) return [];
  const lowerCorpus = verifiedCorpus.toLowerCase();
  const flags: AIWritingValidationFlag[] = [];

  for (const metric of Array.from(new Set(matches.map((m) => m.trim())))) {
    const normalized = metric.toLowerCase();
    const numericCore = normalized.replace(/[^0-9.]/g, '');
    if (!numericCore) continue;
    const coreRegex = new RegExp(`\\b${numericCore.replace(/\./g, '\\.')}\\b`);
    if (!lowerCorpus.includes(normalized) && !coreRegex.test(lowerCorpus)) {
      flags.push({
        id: `det-metric-${flags.length + 1}`,
        category: 'invented_metric',
        severity: 'high',
        claim: metric,
        reason: `Metric "${metric}" does not appear in your original text, answers, or Career Profile.`,
        clarificationPrompt: `Did you achieve "${metric}"? Edit or remove if unverified.`,
      });
    }
  }
  return flags;
}

export async function ollamaGenerateCompanionSuggestion(params: {
  fieldType: CompanionFieldType;
  currentValue: string;
  fieldLabel?: string;
  documentType: CompanionDocumentType;
  careerProfile: CareerProfile;
  documentContext?: unknown;
  jobContext?: JobApplication;
  companyResearch?: unknown;
  qaPairs: AIWritingQuestionAnswer[];
  regenerationInstruction?: string;
}): Promise<AIWritingGenerateResponse> {
  const fallbackGenerated = {
    suggestedContent: params.currentValue,
    changes: [] as string[],
    usedFacts: [] as string[],
  };

  const parsed = await runOllamaJsonTask({
    taskLabel: `Writing ${params.fieldType}`,
    systemPrompt: `You are an expert career editor improving "${params.fieldType}" inside a "${params.documentType}".
${STRICT_GROUNDING_RULE}
Return ONLY JSON:
{
  "suggestedContent": string,
  "changes": string[],
  "usedFacts": string[]
}`,
    userPayload: {
      fieldType: params.fieldType,
      fieldLabel: params.fieldLabel || params.fieldType,
      documentType: params.documentType,
      originalContent: params.currentValue,
      userAnswers: params.qaPairs.map((qa) => ({
        question: qa.question,
        answer: qa.skipped ? '(Skipped)' : qa.combinedAnswer || '(No answer)',
      })),
      careerProfile: params.careerProfile,
      documentContext: params.documentContext || null,
      jobContext: params.jobContext || null,
      companyResearch: params.companyResearch || null,
      regenerationInstruction: params.regenerationInstruction || null,
    },
    fallback: fallbackGenerated,
  });

  const suggestedContent = (parsed.suggestedContent || params.currentValue).trim();
  const verifiedCorpus = JSON.stringify({
    originalContent: params.currentValue,
    qaPairs: params.qaPairs,
    careerProfile: params.careerProfile,
    documentContext: params.documentContext || null,
  });
  const flags = runDeterministicMetricValidation(suggestedContent, verifiedCorpus);
  const hasWarnings = flags.length > 0;

  return {
    suggestedContent,
    changes: asStringArray(parsed.changes),
    usedFacts: asStringArray(parsed.usedFacts),
    validation: {
      status: hasWarnings ? 'warnings_found' : 'verified',
      summary: hasWarnings
        ? `${flags.length} unverified numeric metric${flags.length > 1 ? 's' : ''} flagged for review.`
        : 'Checked against your Career Profile, original entry, and answers.',
      flags,
    },
  };
}

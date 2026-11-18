import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AIWritingAnalyzeResponse,
  AIWritingGenerateResponse,
  AIWritingQuestion,
  AIWritingQuestionAnswer,
  AIWritingValidationFlag,
  CareerProfile,
  CompanionDocumentType,
  CompanionFieldType,
  JobApplication,
} from '../src/types/career';

const MODEL_NAME = 'gemini-4-hydrogen';

export interface CompanionCompanyIntelligencePayload {
  companyName: string;
  companyWebsite?: string;
  overallConfidence?: string;
  report?: {
    companyOverview?: string;
    servicesAndSpecialties?: string;
    industry?: string;
    projectsAndPortfolio?: string;
    technology?: string;
    missionAndValues?: string;
    recentDevelopments?: string;
    employeeExpectations?: string;
    relevantCompanyInformation?: string;
    applicationRecommendations?: string[];
  };
  approvedFindings?: Array<{ category: string; extractedInfo: string }>;
}

export interface CompanionAnalyzeInput {
  fieldType: CompanionFieldType;
  currentValue: string;
  fieldLabel?: string;
  documentType: CompanionDocumentType;
  careerProfile: CareerProfile;
  documentContext?: unknown;
  jobContext?: JobApplication;
  companyResearch?: CompanionCompanyIntelligencePayload;
}

export interface CompanionAdaptInput extends CompanionAnalyzeInput {
  answeredQuestions: AIWritingQuestionAnswer[];
  remainingQuestions: AIWritingQuestion[];
}

export interface CompanionGenerateInput extends CompanionAnalyzeInput {
  qaPairs: AIWritingQuestionAnswer[];
  regenerationInstruction?: string;
}

function parseJsonSafe<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      return fallback;
    }
  }
}

function isDailyQuotaError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('generaterequestsperday') ||
    lower.includes('perday') ||
    lower.includes('daily limit') ||
    lower.includes('quota exceeded for metric')
  );
}

export function isTransientAiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (isDailyQuotaError(msg)) {
    return false;
  }
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('fetch failed')
  );
}

export function getAiErrorHttpStatus(err: unknown): number {
  const raw = err instanceof Error ? err.message : String(err || '');
  if (raw.includes('GEMINI_API_KEY')) return 500;
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) return 429;
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) return 503;
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED')) return 403;
  if (raw.includes('400') || raw.includes('API_KEY_INVALID') || raw.includes('INVALID_ARGUMENT')) {
    return 400;
  }
  return 500;
}

function unwrapGoogleErrorMessage(raw: string): { code?: number; status?: string; message?: string } {
  let current = raw.trim();
  for (let depth = 0; depth < 3; depth++) {
    try {
      const parsed = JSON.parse(current) as {
        error?: { message?: string; code?: number; status?: string } | string;
        message?: string;
        code?: number;
        status?: string;
      };
      if (parsed?.error && typeof parsed.error === 'object') {
        const innerMsg = parsed.error.message;
        if (innerMsg && innerMsg.trim().startsWith('{')) {
          current = innerMsg;
          continue;
        }
        return {
          code: parsed.error.code,
          status: parsed.error.status,
          message: parsed.error.message,
        };
      }
      if (typeof parsed?.error === 'string') {
        if (parsed.error.trim().startsWith('{')) {
          current = parsed.error;
          continue;
        }
        return { message: parsed.error };
      }
      if (parsed?.message) {
        return { code: parsed.code, status: parsed.status, message: parsed.message };
      }
    } catch {
      break;
    }
  }
  return { message: raw };
}

export function formatFriendlyAiError(err: unknown, fallbackMessage: string): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  const unwrapped = unwrapGoogleErrorMessage(raw);
  const combined = `${raw} ${unwrapped.message || ''} ${unwrapped.status || ''}`;

  if (unwrapped.code === 429 || combined.includes('429') || combined.includes('RESOURCE_EXHAUSTED')) {
    if (isDailyQuotaError(combined)) {
      return 'Daily AI API quota reached for the configured key. Upgrade to a billing-enabled Gemini API key in Settings > Secrets or retry after the quota window resets.';
    }
    return 'AI service rate limit reached temporarily. Please wait a few seconds and try again.';
  }

  if (unwrapped.code === 503 || combined.includes('503') || combined.includes('UNAVAILABLE')) {
    return 'The AI writing service is experiencing temporary high demand. Please retry in a few seconds.';
  }

  if (
    unwrapped.code === 403 ||
    combined.includes('PERMISSION_DENIED') ||
    combined.includes('API_KEY_INVALID')
  ) {
    return 'The Gemini API key could not be verified. Check GEMINI_API_KEY in Settings > Secrets.';
  }

  return (unwrapped.message && unwrapped.message.trim()) || raw || fallbackMessage;
}

export async function withAiRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && isTransientAiError(err)) {
        const delayMs = 700 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

const withRetry = withAiRetry;

function summarizeCareerProfile(profile: CareerProfile) {
  return {
    personal: {
      fullName: profile.personal.fullName,
      title: profile.personal.title,
      location: profile.personal.location,
    },
    summary: profile.summary,
    workExperience: profile.workExperience.map((w) => ({
      id: w.id,
      company: w.company,
      position: w.position,
      startDate: w.startDate,
      endDate: w.isCurrent ? 'Present' : w.endDate,
      employmentType: w.employmentType,
      responsibilities: w.responsibilities,
      achievements: w.achievements,
      technologies: w.technologies,
    })),
    education: profile.education.map((e) => ({
      institution: e.institution,
      degree: e.degree,
      fieldOfStudy: e.fieldOfStudy,
      startDate: e.startDate,
      graduationDate: e.graduationDate,
      details: e.details,
    })),
    skills: profile.skills,
    projects: profile.projects.map((p) => ({
      name: p.name,
      role: p.role,
      startDate: p.startDate,
      endDate: p.endDate,
      description: p.description,
      technologies: p.technologies,
    })),
    certifications: profile.certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer,
      date: c.date,
      credentialId: c.credentialId,
    })),
    awards: profile.awards,
    publications: profile.publications,
  };
}

function summarizeJobContext(job?: JobApplication) {
  if (!job) return null;
  return {
    company: job.company,
    jobTitle: job.jobTitle,
    jobLocation: job.jobLocation,
    department: job.department,
    hiringManager: job.hiringManager,
    status: job.status,
    jobDescription: job.jobDescription,
    requiredQualifications: job.requiredQualifications,
    preferredQualifications: job.preferredQualifications,
    responsibilities: job.responsibilities,
    technicalRequirements: job.technicalRequirements,
    applicationNotes: job.applicationNotes || '',
  };
}

function fieldGuidanceForType(fieldType: CompanionFieldType, documentType: CompanionDocumentType): string {
  switch (fieldType) {
    case 'Professional Summary':
      return 'Write a concise 2-3 sentence executive summary grounded strictly in verified roles, skills, and domain experience. Omit personal pronouns (I, me, my, we, our). Avoid filler clichés.';
    case 'Career Objectives':
      return 'Write a focused, authentic career objective targeting the candidate’s next role using verified strengths and realistic goals without buzzword padding.';
    case 'Work Experience':
      return 'Format cleanly with "Responsibilities:" followed by bullet lines (- ...) and "Achievements:" followed by bullet lines (- ...). Start every bullet with a strong action verb. Omit personal pronouns. Prioritize concrete outcomes over passive duties.';
    case 'Job Responsibilities':
      return 'Return concise, action-verb-led bullet lines (one per line, no bullet symbols needed or clean "- " prefixes) describing concrete ownership, architecture, or scope without personal pronouns.';
    case 'Achievements':
      return 'Return accomplishment-focused bullet lines (one per line) emphasizing verified impact, efficiency, quality, or delivery outcomes. Never invent numbers or percentages.';
    case 'Technical Skills':
      return 'Return a clean comma-separated list of verified technical skills, prioritized for clarity and ATS readability (only include skills evidenced in the current entry, answers, profile, or document).';
    case 'Education':
      return 'Refine academic details (honors, relevant coursework, thesis, GPA if provided) concisely and professionally without inventing honors or grades.';
    case 'Projects':
      return 'Write a crisp 1-3 sentence project description highlighting architecture, technical choices, and verified outcomes without personal pronouns.';
    case 'Certifications':
      return 'Refine and standardize the official certification title cleanly without inventing credential IDs, dates, or issuing bodies.';
    case 'Cover Letter Opening':
      return 'Write an engaging, personalized opening paragraph identifying the exact target role and company, stating genuine interest, and anchoring in 1-2 verified core qualifications.';
    case 'Cover Letter Body':
      return 'Write a natural, specific body paragraph connecting the candidate’s verified experience and projects to the target job requirements and company context. Never present company research facts as candidate work history.';
    case 'Cover Letter Closing':
      return 'Write a confident, courteous closing paragraph reaffirming interest, thanking the reader, and inviting an interview conversation.';
    case 'Application Notes':
      return 'Write structured, actionable application notes (interview talking points, verified alignment highlights, gaps to prepare for, and thoughtful questions for the team) grounded in the job description, company intelligence, and candidate profile.';
  }
}

function extractNumericMetrics(text: string): string[] {
  const matches = text.match(/(?:\$[\d,]+(?:\.\d+)?[kKmMbB]?|\b\d+(?:\.\d+)?%|\b\d+(?:,\d{3})+(?:\+)?|\b\d+\s*(?:\+|x|years?|yrs?|months?|mos?|ms|seconds?|minutes?|hours?|users?|accounts?|customers?|clients?|engineers?|developers?|teams?|projects?|applications?|apps?|services?)\b)/gi);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.trim())));
}

export function runDeterministicMetricCheck(
  suggestedContent: string,
  verifiedCorpus: string
): AIWritingValidationFlag[] {
  const flags: AIWritingValidationFlag[] = [];
  const suggestedMetrics = extractNumericMetrics(suggestedContent);
  const lowerCorpus = verifiedCorpus.toLowerCase();

  for (const metric of suggestedMetrics) {
    const normalized = metric.toLowerCase().trim();
    const numericCore = normalized.replace(/[^0-9.]/g, '');
    if (!numericCore) continue;

    // Check if the exact metric token or the numeric core appears in the verified corpus
    const exactPresent = lowerCorpus.includes(normalized);
    const coreRegex = new RegExp(`\\b${numericCore.replace(/\./g, '\\.')}\\b`);
    const corePresent = coreRegex.test(lowerCorpus);

    if (!exactPresent && !corePresent) {
      flags.push({
        id: `det-metric-${flags.length + 1}`,
        category: 'invented_metric',
        severity: 'high',
        claim: metric,
        reason: `Metric "${metric}" does not appear in the original entry, your interview answers, your Career Profile, or the active document.`,
        clarificationPrompt: `Did you actually achieve "${metric}"? Edit or remove it if unverified.`,
      });
    }
  }
  return flags;
}

export async function analyzeAndGenerateQuestions(
  ai: GoogleGenAI,
  input: CompanionAnalyzeInput
): Promise<AIWritingAnalyzeResponse> {
  const profileSummary = summarizeCareerProfile(input.careerProfile);
  const jobSummary = summarizeJobContext(input.jobContext);

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: JSON.stringify({
        fieldType: input.fieldType,
        fieldLabel: input.fieldLabel || input.fieldType,
        documentType: input.documentType,
        currentValue: input.currentValue,
        careerProfile: profileSummary,
        documentContext: input.documentContext || null,
        jobContext: jobSummary,
        companyResearch: input.companyResearch || null,
      }),
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: `You are a thoughtful, human-sounding Career Engine writing coach helping a candidate strengthen a specific editable field ("${input.fieldType}").

YOUR GOALS FOR THIS STEP (ANALYSIS & INTERVIEW PLANNING):
1. First, read "currentValue", "careerProfile", "documentContext", "jobContext", and "companyResearch" carefully.
2. Identify what verified facts ALREADY exist ("knownFacts") so you NEVER ask repetitive questions for information already available in the Career Profile, document, or current entry (e.g., do not ask for their job title, company, software skills, or education if already listed!).
3. Identify genuinely missing or under-specified details ("missingInformation") that would elevate this specific field ("${input.fieldType}") — such as unclear scope, missing concrete outcome/impact, vague responsibilities, missing connection to the target job/company, or unstated context.
4. Decide "hasEnoughInformation":
   - Set true if "currentValue" + "careerProfile" already contain rich, concrete facts (e.g. specific tools, scope, and verified outcomes) so the user can choose to generate immediately without an interview, while still offering 2 optional high-leverage refinement questions.
   - Set false if the entry is empty, very brief, vague, or missing key context where 3-6 targeted questions will substantially improve the writing.
5. Generate 2 to 6 context-aware questions:
   - Ask ONE focused question per item in plain, everyday English.
   - Never ask for information already in Career Profile or currentValue.
   - Include 2-4 concise, helpful "choices" when useful (e.g. scope/focus angles, tone preferences, or referencing verified skills/projects already in their profile to ask which to emphasize). NEVER invent fake metrics inside choices! If asking about metrics, offer qualitative framing choices or leave choices empty/neutral like "Improved performance / speed", "Reduced manual effort", "Increased reliability".
   - Set "allowMultipleChoices" true when selecting more than one focus makes sense, false for single-choice focus.
   - Provide a short, helpful "placeholder" example for the free-text box.
6. Write a warm, concise 1-2 sentence "assistantIntro" acknowledging what is already strong/known and what a few quick questions will help clarify.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            assistantIntro: { type: Type.STRING },
            knownFacts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            missingInformation: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            hasEnoughInformation: { type: Type.BOOLEAN },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  question: { type: Type.STRING },
                  purpose: { type: Type.STRING },
                  choices: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  allowMultipleChoices: { type: Type.BOOLEAN },
                  placeholder: { type: Type.STRING },
                },
                required: ['id', 'question', 'purpose', 'choices', 'allowMultipleChoices', 'placeholder'],
              },
            },
          },
          required: [
            'assistantIntro',
            'knownFacts',
            'missingInformation',
            'hasEnoughInformation',
            'questions',
          ],
        },
      },
    })
  );

  const parsed = parseJsonSafe<AIWritingAnalyzeResponse>(response.text, {
    assistantIntro: `Let’s strengthen your ${input.fieldType} using your verified background.`,
    knownFacts: [],
    missingInformation: [],
    hasEnoughInformation: false,
    questions: [],
  });

  const questions = (parsed.questions || []).slice(0, 6).map((q, idx) => ({
    ...q,
    id: q.id || `q-${idx + 1}`,
    choices: Array.isArray(q.choices) ? q.choices.slice(0, 4) : [],
    placeholder: q.placeholder || 'Type your own answer or add specific details...',
  }));

  return {
    assistantIntro: parsed.assistantIntro,
    knownFacts: parsed.knownFacts || [],
    missingInformation: parsed.missingInformation || [],
    hasEnoughInformation: Boolean(parsed.hasEnoughInformation),
    questions,
  };
}

export async function adaptRemainingQuestions(
  ai: GoogleGenAI,
  input: CompanionAdaptInput
): Promise<{ questions: AIWritingQuestion[]; adaptationNote?: string }> {
  if (!input.remainingQuestions || input.remainingQuestions.length === 0) {
    return { questions: [] };
  }

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: JSON.stringify({
        fieldType: input.fieldType,
        fieldLabel: input.fieldLabel || input.fieldType,
        currentValue: input.currentValue,
        answeredQuestions: input.answeredQuestions.map((a) => ({
          question: a.question,
          answer: a.skipped ? '(Skipped)' : a.combinedAnswer,
        })),
        remainingQuestions: input.remainingQuestions,
        careerProfileSummary: {
          title: input.careerProfile.personal.title,
          skills: input.careerProfile.skills,
        },
        jobTarget: input.jobContext
          ? `${input.jobContext.jobTitle} at ${input.jobContext.company}`
          : null,
      }),
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: `You adapt remaining interview questions based on the user's previous answers.
RULES:
1. Review "answeredQuestions". If the user already answered something covered by an upcoming question, remove the redundant question or refine it into a smarter follow-up that builds on their answer.
2. If the user skipped a question, do not repeat the exact same question; move smoothly to the next useful angle.
3. Preserve question IDs when refining an existing question, or keep 1-4 concise remaining questions max.
4. Keep plain, natural language and never fabricate metrics in choices.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            adaptationNote: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  question: { type: Type.STRING },
                  purpose: { type: Type.STRING },
                  choices: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  allowMultipleChoices: { type: Type.BOOLEAN },
                  placeholder: { type: Type.STRING },
                },
                required: ['id', 'question', 'purpose', 'choices', 'allowMultipleChoices', 'placeholder'],
              },
            },
          },
          required: ['questions'],
        },
      },
    })
  );

  const parsed = parseJsonSafe<{ adaptationNote?: string; questions: AIWritingQuestion[] }>(
    response.text,
    { questions: input.remainingQuestions }
  );

  return {
    adaptationNote: parsed.adaptationNote,
    questions: Array.isArray(parsed.questions) && parsed.questions.length > 0
      ? parsed.questions
      : input.remainingQuestions,
  };
}

export async function generateAndValidateSuggestion(
  ai: GoogleGenAI,
  input: CompanionGenerateInput
): Promise<AIWritingGenerateResponse> {
  const profileSummary = summarizeCareerProfile(input.careerProfile);
  const jobSummary = summarizeJobContext(input.jobContext);
  const fieldGuidance = fieldGuidanceForType(input.fieldType, input.documentType);

  const qaFormatted = input.qaPairs.map((qa) => ({
    question: qa.question,
    answer: qa.skipped ? '(Skipped by user)' : qa.combinedAnswer || '(No answer provided)',
  }));

  // Pass 1: Content Generation strictly grounded in verified sources + user answers
  const genResponse = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: JSON.stringify({
        fieldType: input.fieldType,
        fieldLabel: input.fieldLabel || input.fieldType,
        documentType: input.documentType,
        originalContent: input.currentValue,
        userAnswers: qaFormatted,
        careerProfile: profileSummary,
        documentContext: input.documentContext || null,
        jobContext: jobSummary,
        companyResearch: input.companyResearch || null,
        regenerationInstruction: input.regenerationInstruction || null,
      }),
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: `You are an expert career editor improving a specific field ("${input.fieldType}") inside a "${input.documentType}".

FIELD-SPECIFIC WRITING REQUIREMENTS:
${fieldGuidance}

STRICT GROUNDING & ACCURACY RULES:
1. Base your writing EXCLUSIVELY on facts verified in:
   - "originalContent"
   - "userAnswers" (non-skipped answers explicitly provided by the candidate)
   - "careerProfile"
   - "documentContext"
2. You may use "jobContext" and "companyResearch" ONLY to align terminology, prioritize relevant verified skills/experience, or (for Cover Letters / Application Notes) explain why the candidate's verified background fits the company's actual work.
3. NEVER present company research facts or job requirements as the candidate's own past experience.
4. NEVER invent metrics, percentages, dollar figures, user counts, dates, employer names, job titles, degrees, certifications, or software tools that do not appear in the verified sources above.
5. If a detail is uncertain or missing, omit it rather than guessing—and note it in "changes" or leave it out cleanly.
6. Write concise, strong, natural prose with zero AI filler clichés ("results-driven", "dynamic self-starter", "synergy", "cutting-edge").
7. Return:
   - "suggestedContent": the exact ready-to-apply replacement text for this field.
   - "changes": 2-5 concise bullet points explaining specifically what was improved.
   - "usedFacts": list of verified facts from profile/answers/job context incorporated.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedContent: { type: Type.STRING },
            changes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            usedFacts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['suggestedContent', 'changes', 'usedFacts'],
        },
      },
    })
  );

  const generated = parseJsonSafe<{
    suggestedContent: string;
    changes: string[];
    usedFacts: string[];
  }>(genResponse.text, {
    suggestedContent: input.currentValue,
    changes: [],
    usedFacts: [],
  });

  const suggestedContent = (generated.suggestedContent || input.currentValue).trim();

  // Pass 2: Accuracy Validation (AI Grounding Audit + Deterministic Metric Audit)
  // Exclude jobContext/companyResearch so numbers/metrics from a job posting never pass as verified candidate metrics.
  const verifiedCorpus = JSON.stringify({
    originalContent: input.currentValue,
    userAnswers: qaFormatted,
    careerProfile: profileSummary,
    documentContext: input.documentContext || null,
  });

  const deterministicFlags = runDeterministicMetricCheck(suggestedContent, verifiedCorpus);

  const auditResponse = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: JSON.stringify({
        fieldType: input.fieldType,
        suggestedContent,
        verifiedSources: {
          originalContent: input.currentValue,
          userAnswers: qaFormatted,
          careerProfile: profileSummary,
          documentContext: input.documentContext || null,
        },
        externalContextNotPersonalExperience: {
          jobContext: jobSummary,
          companyResearch: input.companyResearch || null,
        },
      }),
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: `You are a strict factual accuracy auditor verifying an AI-generated writing suggestion before it is shown to the user.

Compare "suggestedContent" strictly against "verifiedSources" (originalContent, userAnswers, careerProfile, documentContext).
Flag ANY claim in "suggestedContent" that is not clearly supported by "verifiedSources":
- "invented_metric": numbers, percentages, dollar figures, team sizes, or timeframes not in verifiedSources.
- "unsupported_achievement": outcome or impact claims not evidenced in verifiedSources.
- "unverified_software": software, frameworks, or tools mentioned as candidate experience when not in verifiedSources (especially if copied from jobContext!).
- "incorrect_date": dates or durations differing from or absent in verifiedSources.
- "incorrect_employer": company names or titles differing from verifiedSources, or external companyResearch facts phrased as candidate's past employer experience.
- "unsupported_qualification": degrees, certifications, or credentials not in verifiedSources.

NOTE: Rewriting/polishing existing verified facts with stronger verbs or cleaner grammar is VALID and should NOT be flagged. Only flag actual unverified factual claims.
If everything is grounded and faithful to verifiedSources, return status "verified" and an empty flags array.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING },
            summary: { type: Type.STRING },
            flags: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  category: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  claim: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  clarificationPrompt: { type: Type.STRING },
                },
                required: ['id', 'category', 'severity', 'claim', 'reason', 'clarificationPrompt'],
              },
            },
          },
          required: ['status', 'summary', 'flags'],
        },
      },
    })
  );

  const auditParsed = parseJsonSafe<{
    status: string;
    summary: string;
    flags: AIWritingValidationFlag[];
  }>(auditResponse.text, {
    status: 'verified',
    summary: 'All claims verified against your Career Profile, original entry, and answers.',
    flags: [],
  });

  const validCategories = new Set([
    'invented_metric',
    'unsupported_achievement',
    'unverified_software',
    'incorrect_date',
    'incorrect_employer',
    'unsupported_qualification',
  ]);

  const aiFlags: AIWritingValidationFlag[] = (auditParsed.flags || []).map((f, idx) => ({
    id: f.id || `ai-flag-${idx + 1}`,
    category: validCategories.has(f.category)
      ? (f.category as AIWritingValidationFlag['category'])
      : 'unsupported_achievement',
    severity: f.severity === 'high' ? 'high' : 'medium',
    claim: f.claim,
    reason: f.reason,
    clarificationPrompt: f.clarificationPrompt,
  }));

  // Merge deterministic & AI flags, avoiding duplicates by claim text
  const mergedFlags = [...aiFlags];
  for (const df of deterministicFlags) {
    const alreadyCovered = mergedFlags.some(
      (f) =>
        f.claim.toLowerCase().includes(df.claim.toLowerCase()) ||
        df.claim.toLowerCase().includes(f.claim.toLowerCase())
    );
    if (!alreadyCovered) {
      mergedFlags.push(df);
    }
  }

  const hasWarnings = mergedFlags.length > 0;

  return {
    suggestedContent,
    changes: generated.changes || [],
    usedFacts: generated.usedFacts || [],
    validation: {
      status: hasWarnings ? 'warnings_found' : 'verified',
      summary: hasWarnings
        ? `${mergedFlags.length} potential factual gap${mergedFlags.length > 1 ? 's' : ''} flagged for your review before applying.`
        : auditParsed.summary ||
          'Verified against your Career Profile, original text, and interview answers.',
      flags: mergedFlags,
    },
  };
}

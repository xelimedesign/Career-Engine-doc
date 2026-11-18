import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { orchestrateCompanyResearch, runThreeWayJobMatch } from './server/researchService.ts';
import {
  orchestrateApplicationReview,
  regenerateReviewSuggestion,
} from './server/reviewService.ts';
import {
  adaptRemainingQuestions,
  analyzeAndGenerateQuestions,
  formatFriendlyAiError,
  generateAndValidateSuggestion,
  getAiErrorHttpStatus,
  withAiRetry,
} from './server/companionService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

const STRICT_GROUNDING_RULE = `
CRITICAL FACTUAL INTEGRITY RULES:
1. NEVER invent, fabricate, or hallucinate employment history, job titles, company names, employment dates, degrees, institutions, certifications, awards, skills, software, projects, metrics, percentages, dollar figures, or accomplishments that are NOT explicitly present in the provided user profile or resume data.
2. You may only rephrase, tighten, clarify, reorganize, improve grammar, or emphasize existing verified facts provided by the user.
3. If the target job asks for a qualification or skill the candidate has NOT listed, do NOT claim they have it—instead surface it honestly in gap analysis or omit it from generated text.
4. Keep prose crisp, natural, concrete, and free of generic AI filler clichés (e.g., avoid "dynamic self-starter", "results-driven rockstar", "synergy", "leveraged cutting-edge").
`.trim();

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, aiConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  // 1. Job Description Analyzer
  app.post('/api/ai/job-analyze', async (req, res) => {
    try {
      const { jobTitle, company, jobDescription, profile } = req.body ?? {};
      if (!jobDescription || typeof jobDescription !== 'string') {
        res.status(400).json({ error: 'Job description text is required.' });
        return;
      }

      const ai = getAiClient();
      const response = await withAiRetry(() =>
        ai.models.generateContent({
        model: MODEL_NAME,
        contents: JSON.stringify({
          task: 'Analyze this job description and compare against the candidate career profile.',
          jobTitle: jobTitle || '',
          company: company || '',
          jobDescription,
          candidateProfile: profile || null,
        }),
        config: {
          systemInstruction: `You are an expert technical recruiter and career strategist.\n${STRICT_GROUNDING_RULE}\nExtract structured requirements from the job description and compare them strictly against the candidate profile.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              requiredQualifications: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              preferredQualifications: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              responsibilities: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              technicalRequirements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              matchedSkills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              missingSkills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              keyThemes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              tailoringSuggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'requiredQualifications',
              'preferredQualifications',
              'responsibilities',
              'technicalRequirements',
              'matchedSkills',
              'missingSkills',
              'keyThemes',
              'tailoringSuggestions',
            ],
          },
        },
        })
      );

      const parsed = parseJsonSafe(response.text, {
        requiredQualifications: [],
        preferredQualifications: [],
        responsibilities: [],
        technicalRequirements: [],
        matchedSkills: [],
        missingSkills: [],
        keyThemes: [],
        tailoringSuggestions: [],
      });
      res.json(parsed);
    } catch (err) {
      res.status(getAiErrorHttpStatus(err)).json({ error: formatFriendlyAiError(err, 'Job analysis failed.') });
    }
  });

  // 2. Resume Writing Assistant
  app.post('/api/ai/resume-assist', async (req, res) => {
    try {
      const { action, resume, targetJob, experienceId, companyIntelligence, jobMatch } = req.body ?? {};
      if (!action || !resume) {
        res.status(400).json({ error: 'Action and resume payload are required.' });
        return;
      }

      const ai = getAiClient();
      const response = await withAiRetry(() =>
        ai.models.generateContent({
        model: MODEL_NAME,
        contents: JSON.stringify({
          action,
          experienceId: experienceId || null,
          resume,
          targetJob: targetJob || null,
          companyIntelligence: companyIntelligence || null,
          jobMatch: jobMatch || null,
        }),
        config: {
          systemInstruction: `You are a meticulous executive resume editor following Harvard Career Services writing standards.\n${STRICT_GROUNDING_RULE}
HARVARD RESUME WRITING STANDARDS (DEFAULT):
- Start every bullet point with a strong action verb (never "Responsible for", "Duties included", "Helped with", or "Assisted in").
- Describe accomplishments and concrete outcomes rather than passive duties, using specific tools/technologies and verified results.
- Omit personal pronouns completely (never use "I", "me", "my", "we", "our").
- Avoid slang, unnecessary abbreviations, or vague filler.

Actions supported:
- "write_summary": Produce an improved headline and 2-3 sentence summary grounded strictly in the resume's actual roles, years, and skills without personal pronouns.
- "improve_experience": For the specified experienceId (or all roles needing stronger phrasing if omitted), rewrite responsibilities and achievements into crisp, action-verb-led accomplishment bullets using ONLY verified facts from that role. Do not invent numbers or tools.
- "fix_grammar": Fix grammar, tighten phrasing, eliminate personal pronouns, and remove repetitive leading verbs across summary and experience bullets.
- "audit_gaps": Identify missing optional resume information (e.g. missing dates, empty achievements, missing portfolio/LinkedIn) and suggest skills ONLY if clearly evidenced in the user's listed work experience or projects.
- "tailor_to_job": Given targetJob, propose a tailored summary, prioritized experience bullet refinements, and prioritized skill suggestions grounded 100% in the candidate's existing resume without fabricating qualifications.

Return only the structured JSON object matching the schema.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rationale: { type: Type.STRING },
              proposedHeadline: { type: Type.STRING },
              proposedSummary: { type: Type.STRING },
              experienceUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    position: { type: Type.STRING },
                    company: { type: Type.STRING },
                    responsibilities: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    achievements: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['id', 'responsibilities', 'achievements'],
                },
              },
              suggestedSkillsToHighlight: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              missingInformationWarnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              jobAlignmentNotes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['rationale', 'experienceUpdates', 'suggestedSkillsToHighlight', 'missingInformationWarnings', 'jobAlignmentNotes'],
          },
        },
        })
      );

      const parsed = parseJsonSafe(response.text, {
        rationale: 'Unable to parse AI suggestion.',
        proposedHeadline: '',
        proposedSummary: '',
        experienceUpdates: [],
        suggestedSkillsToHighlight: [],
        missingInformationWarnings: [],
        jobAlignmentNotes: [],
      });
      res.json(parsed);
    } catch (err) {
      res.status(getAiErrorHttpStatus(err)).json({ error: formatFriendlyAiError(err, 'Resume assistant failed.') });
    }
  });

  // 3. Cover Letter Generator
  app.post('/api/ai/cover-letter-generate', async (req, res) => {
    try {
      const {
        applicant,
        employer,
        jobInfo,
        careerProfile,
        selectedResume,
        writingStyle,
        length,
        companyIntelligence,
        jobMatch,
      } = req.body ?? {};

      const ai = getAiClient();
      const lengthGuidance =
        length === 'Short'
          ? '3 concise paragraphs (~180-230 words total)'
          : length === 'Detailed'
            ? '4-5 rich paragraphs (~360-440 words total)'
            : '4 well-paced paragraphs (~260-330 words total)';

      const response = await withAiRetry(() =>
        ai.models.generateContent({
        model: MODEL_NAME,
        contents: JSON.stringify({
          applicant,
          employer,
          jobInfo,
          careerProfile,
          selectedResume,
          companyIntelligence: companyIntelligence || null,
          jobMatch: jobMatch || null,
          writingStyle: writingStyle || 'Professional',
          length: length || 'Standard',
        }),
        config: {
          systemInstruction: `You are a master career writer composing a tailored cover letter following Harvard Career Services standards.\n${STRICT_GROUNDING_RULE}
STYLE: ${writingStyle || 'Professional'}
LENGTH TARGET: ${lengthGuidance} (must fit comfortably on 1 page max)
COMPANY INTELLIGENCE RULES (when companyIntelligence/jobMatch provided):
- Use verified company services, projects, mission, or technical stack naturally in Paragraph 3 ("Employer Connection") to explain why the candidate's verified experience is directly relevant to the employer's actual work.
- NEVER produce generic praise ("I admire your industry-leading innovation").
- NEVER fabricate personal connections, prior conversations, or unverified company facts.

HARVARD COVER LETTER STRUCTURE:
- Salutation: Address a specific hiring manager by name if provided (e.g. "Dear Maya Chen,"), otherwise "Dear Hiring Team," or "Dear [Company] Hiring Committee,".
- Four concise, specific, fact-based paragraphs:
  1. "Introduction": Identify the exact position, explain genuine interest, and briefly establish verified core qualifications.
  2. "Relevant Experience": Highlight verified employment, technical skills, and specific examples from selectedResume/careerProfile.
  3. "Employer Connection": Explain how the candidate's verified experience relates directly to the employer's actual services, projects, or requirements.
  4. "Closing": Reaffirm interest, thank the employer, and welcome an interview conversation with contact availability.
- Professional sign-off (e.g. "Sincerely,").
- Keep every sentence concise, factual, active, and grounded in provided facts. Never invent company familiarity, dates, degrees, or achievements.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              salutation: { type: Type.STRING },
              paragraphs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    text: { type: Type.STRING },
                  },
                  required: ['label', 'text'],
                },
              },
              closingSignOff: { type: Type.STRING },
              groundingNotes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['salutation', 'paragraphs', 'closingSignOff', 'groundingNotes'],
          },
          },
        })
      );

      const parsed = parseJsonSafe(response.text, {
        salutation: 'Dear Hiring Team,',
        paragraphs: [],
        closingSignOff: 'Sincerely,',
        groundingNotes: [],
      });
      res.json(parsed);
    } catch (err) {
      res.status(getAiErrorHttpStatus(err)).json({ error: formatFriendlyAiError(err, 'Cover letter generation failed.') });
    }
  });

  // 4. Cover Letter Paragraph / Full Letter Editor
  app.post('/api/ai/cover-letter-edit', async (req, res) => {
    try {
      const {
        action,
        paragraphId,
        currentParagraphText,
        allParagraphs,
        writingStyle,
        employer,
        jobInfo,
        careerProfile,
        selectedResume,
        companyIntelligence,
        jobMatch,
      } = req.body ?? {};

      if (!action) {
        res.status(400).json({ error: 'Editing action is required.' });
        return;
      }

      const ai = getAiClient();
      const response = await withAiRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: JSON.stringify({
            action,
            targetScope: paragraphId ? 'single_paragraph' : 'full_letter',
            paragraphId: paragraphId || null,
            currentParagraphText: currentParagraphText || null,
            allParagraphs: allParagraphs || [],
            writingStyle: writingStyle || 'Professional',
            employer,
            jobInfo,
            careerProfile,
            selectedResume,
            companyIntelligence: companyIntelligence || null,
            jobMatch: jobMatch || null,
          }),
        config: {
          systemInstruction: `You are an expert editorial coach refining a cover letter.\n${STRICT_GROUNDING_RULE}
Supported actions:
- "Improve Writing"
- "Rewrite Paragraph"
- "Improve Opening"
- "Improve Closing"
- "Make More Professional"
- "Make More Natural"
- "Shorten"
- "Expand"
- "Fix Grammar"
- "Remove Repetition"

If targetScope is "single_paragraph", return a single item in updatedParagraphs with that paragraph's id, label, and revised text.
If targetScope is "full_letter", return all paragraphs revised in updatedParagraphs preserving each id and label.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rationale: { type: Type.STRING },
              updatedParagraphs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    text: { type: Type.STRING },
                  },
                  required: ['id', 'label', 'text'],
                },
              },
            },
            required: ['rationale', 'updatedParagraphs'],
          },
        },
        })
      );

      const parsed = parseJsonSafe(response.text, {
        rationale: 'No changes generated.',
        updatedParagraphs: [],
      });
      res.json(parsed);
    } catch (err) {
      res.status(getAiErrorHttpStatus(err)).json({ error: formatFriendlyAiError(err, 'Cover letter edit failed.') });
    }
  });

  // 5. Company Intelligence & Google Search Grounding Research
  app.post('/api/research/company', async (req, res) => {
    try {
      const { companyName, companyWebsite, jobTitle, jobDescription, jobLocation, forceRefresh } =
        req.body ?? {};
      if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
        res.status(400).json({ error: 'Company name is required to run Company Research.' });
        return;
      }

      const ai = getAiClient();
      const result = await withAiRetry(() =>
        orchestrateCompanyResearch(ai, {
          companyName: companyName.trim(),
          companyWebsite: typeof companyWebsite === 'string' ? companyWebsite.trim() : undefined,
          jobTitle: typeof jobTitle === 'string' ? jobTitle.trim() : undefined,
          jobDescription: typeof jobDescription === 'string' ? jobDescription.trim() : undefined,
          jobLocation: typeof jobLocation === 'string' ? jobLocation.trim() : undefined,
          forceRefresh: Boolean(forceRefresh),
        })
      );

      res.json(result);
    } catch (err) {
      res.status(getAiErrorHttpStatus(err)).json({ error: formatFriendlyAiError(err, 'Company research failed.') });
    }
  });

  // 6. Three-Way Job Matching Engine (Company Intelligence + Job Description + Career Profile)
  app.post('/api/research/job-match', async (req, res) => {
    try {
      const { job, companyResearch, careerProfile } = req.body ?? {};
      if (!job || !careerProfile) {
        res.status(400).json({ error: 'Job and careerProfile payloads are required.' });
        return;
      }

      const ai = getAiClient();
      const match = await withAiRetry(() =>
        runThreeWayJobMatch(ai, {
          job,
          companyResearch: companyResearch || null,
          careerProfile,
        })
      );

      res.json(match);
    } catch (err) {
      res.status(getAiErrorHttpStatus(err)).json({ error: formatFriendlyAiError(err, 'Three-way job matching failed.') });
    }
  });

  // 7. Application Review System — Full/Partial Audit, Fact-Check, ATS & Scoring
  app.post('/api/review/analyze', async (req, res) => {
    try {
      const {
        scope,
        careerProfile,
        resume,
        coverLetter,
        job,
        companyResearch,
        previousApplications,
        scoringConfig,
      } = req.body ?? {};
      if (!careerProfile) {
        res.status(400).json({ error: 'Career Profile is required for Application Review.' });
        return;
      }
      if (!resume && !coverLetter) {
        res.status(400).json({ error: 'Select at least a Resume or Cover Letter to review.' });
        return;
      }

      const ai = getAiClient();
      const reviewRecord = await withAiRetry(() =>
        orchestrateApplicationReview(ai, {
          scope: scope || 'full_application',
          careerProfile,
          resume,
          coverLetter,
          job,
          companyResearch,
          previousApplications,
          scoringConfig,
        })
      );

      res.json(reviewRecord);
    } catch (err) {
      res.status(getAiErrorHttpStatus(err)).json({ error: formatFriendlyAiError(err, 'Application review failed.') });
    }
  });

  // 8. Regenerate Individual Review Suggestion
  app.post('/api/review/regenerate-suggestion', async (req, res) => {
    try {
      const { finding, careerProfile, targetJob, userGuidance } = req.body ?? {};
      if (!finding || !careerProfile) {
        res.status(400).json({ error: 'Finding and careerProfile are required.' });
        return;
      }

      const ai = getAiClient();
      const updated = await withAiRetry(() =>
        regenerateReviewSuggestion(ai, {
          finding,
          careerProfile,
          targetJob,
          userGuidance,
        })
      );

      res.json(updated);
    } catch (err) {
      res.status(getAiErrorHttpStatus(err)).json({ error: formatFriendlyAiError(err, 'Suggestion regeneration failed.') });
    }
  });

  // 9. AI Writing Companion — Field Analysis & Context-Aware Question Engine
  app.post('/api/ai/companion/analyze', async (req, res) => {
    try {
      const {
        fieldType,
        currentValue,
        fieldLabel,
        documentType,
        careerProfile,
        documentContext,
        jobContext,
        companyResearch,
      } = req.body ?? {};
      if (!fieldType || !documentType || !careerProfile) {
        res.status(400).json({
          error: 'fieldType, documentType, and careerProfile are required.',
        });
        return;
      }

      const ai = getAiClient();
      const result = await analyzeAndGenerateQuestions(ai, {
        fieldType,
        currentValue: typeof currentValue === 'string' ? currentValue : '',
        fieldLabel,
        documentType,
        careerProfile,
        documentContext,
        jobContext,
        companyResearch,
      });
      res.json(result);
    } catch (err) {
      const message = formatFriendlyAiError(err, 'AI Companion analysis failed.');
      res.status(getAiErrorHttpStatus(err)).json({ error: message });
    }
  });

  // 10. AI Writing Companion — Adaptive Question Refinement
  app.post('/api/ai/companion/adapt', async (req, res) => {
    try {
      const {
        fieldType,
        currentValue,
        fieldLabel,
        documentType,
        careerProfile,
        documentContext,
        jobContext,
        companyResearch,
        answeredQuestions,
        remainingQuestions,
      } = req.body ?? {};
      if (!fieldType || !documentType || !careerProfile) {
        res.status(400).json({
          error: 'fieldType, documentType, and careerProfile are required.',
        });
        return;
      }

      const ai = getAiClient();
      const result = await adaptRemainingQuestions(ai, {
        fieldType,
        currentValue: typeof currentValue === 'string' ? currentValue : '',
        fieldLabel,
        documentType,
        careerProfile,
        documentContext,
        jobContext,
        companyResearch,
        answeredQuestions: Array.isArray(answeredQuestions) ? answeredQuestions : [],
        remainingQuestions: Array.isArray(remainingQuestions) ? remainingQuestions : [],
      });
      res.json(result);
    } catch (err) {
      const message = formatFriendlyAiError(err, 'Question adaptation failed.');
      res.status(getAiErrorHttpStatus(err)).json({ error: message });
    }
  });

  // 11. AI Writing Companion — Content Generation & Accuracy Validation
  app.post('/api/ai/companion/generate', async (req, res) => {
    try {
      const {
        fieldType,
        currentValue,
        fieldLabel,
        documentType,
        careerProfile,
        documentContext,
        jobContext,
        companyResearch,
        qaPairs,
        regenerationInstruction,
      } = req.body ?? {};
      if (!fieldType || !documentType || !careerProfile) {
        res.status(400).json({
          error: 'fieldType, documentType, and careerProfile are required.',
        });
        return;
      }

      const ai = getAiClient();
      const result = await generateAndValidateSuggestion(ai, {
        fieldType,
        currentValue: typeof currentValue === 'string' ? currentValue : '',
        fieldLabel,
        documentType,
        careerProfile,
        documentContext,
        jobContext,
        companyResearch,
        qaPairs: Array.isArray(qaPairs) ? qaPairs : [],
        regenerationInstruction,
      });
      res.json(result);
    } catch (err) {
      const message = formatFriendlyAiError(err, 'AI Companion generation failed.');
      res.status(getAiErrorHttpStatus(err)).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Career Engine server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start Career Engine server:', err);
  process.exit(1);
});

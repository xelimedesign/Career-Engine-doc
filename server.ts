import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import * as mammoth from 'mammoth';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildGracefulResearchFallback,
  fetchPublicCompanySnippets,
  isJobBoardOrAggregatorUrl,
  isPlaceholderOrAggregatorNameServer,
  orchestrateCompanyResearch,
  resolveCompanyOnServer,
  runThreeWayJobMatch,
  type SearchProviderResult,
} from './server/researchService.ts';
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

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, aiConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  // Resume Import & Structured AI Parsing
  app.post('/api/profile/import-resume', upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No resume file provided.' });
        return;
      }

      let extractedText = '';
      const mime = file.mimetype;
      const originalName = file.originalname.toLowerCase();

      if (mime === 'application/pdf' || originalName.endsWith('.pdf')) {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: file.buffer });
        await parser.load();
        const textResult = await parser.getText();
        extractedText = textResult?.text || '';
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        originalName.endsWith('.docx')
      ) {
        const parsedDocx = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = parsedDocx.value || '';
      } else {
        res.status(400).json({ error: 'Unsupported file format. Please upload a PDF or DOCX file.' });
        return;
      }

      if (!extractedText.trim()) {
        res.status(400).json({
          error: 'Extracted resume text is empty. This may be a scanned or image-only PDF. Please paste your resume text instead.',
        });
        return;
      }

      // Extract contact details directly from raw text before any processing
      const extractedEmail = extractedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
      const extractedPhone = extractedText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || '';
      const extractedLinkedin = extractedText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_.-]+/i)?.[0] || '';
      const extractedPortfolio = extractedText.match(/(?:https?:\/\/)?(?:www\.)?(?:github\.com\/[a-zA-Z0-9_.-]+|[a-zA-Z0-9-]+\.(?:dev|me|io|design)[^\s]*)/i)?.[0] || '';

      const aiEnabled = req.body?.aiEnabled === 'true';
      if (!aiEnabled) {
        const lines = extractedText.split('\n').map((l) => l.trim()).filter(Boolean);
        const fullName = lines[0] || '';
        const title = lines[1] && !lines[1].includes('@') ? lines[1] : '';
        const headline = title || fullName || 'Imported Professional Profile';
        res.json({
          personal: {
            fullName,
            title,
            email: extractedEmail,
            phone: extractedPhone,
            location: '',
            linkedin: extractedLinkedin,
            portfolio: extractedPortfolio,
            website: '',
          },
          summary: { headline, summary: lines.slice(1, 4).join(' ') },
          workExperience: [],
          education: [],
          skills: { technical: [], software: [], professional: [], industry: [] },
          projects: [],
          certifications: [],
          awards: [],
          volunteer: [],
          languages: [],
          publications: [],
          unclear: lines.slice(4),
          lastImportedAt: new Date().toISOString(),
        });
        return;
      }

      // Privacy: Strip personal contact details locally before Gemini
      const sanitizedText = extractedText
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[CONTACT_EMAIL]')
        .replace(/(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[CONTACT_PHONE]');

      const ai = getAiClient();
      const response = await withAiRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: JSON.stringify({
            task: 'Extract structured CareerProfile data strictly from the resume text.',
            resumeText: sanitizedText,
          }),
          config: {
            systemInstruction: `You are an expert resume parser.\n${STRICT_GROUNDING_RULE}\nExtract only what is written in this resume. Do not add or infer facts. Extract the candidate's personal details (fullName, professional title, location, LinkedIn link/handle, portfolio or GitHub link, and personal website) into the personal object. Put anything ambiguous—such as dates missing a month—into unclear rather than guessing.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                personal: {
                  type: Type.OBJECT,
                  properties: {
                    fullName: { type: Type.STRING },
                    title: { type: Type.STRING },
                    email: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    location: { type: Type.STRING },
                    linkedin: { type: Type.STRING },
                    portfolio: { type: Type.STRING },
                    website: { type: Type.STRING },
                  },
                  required: ['fullName', 'title', 'location', 'linkedin', 'portfolio', 'website'],
                },
                summary: {
                  type: Type.OBJECT,
                  properties: {
                    headline: { type: Type.STRING },
                    summary: { type: Type.STRING },
                  },
                  required: ['headline', 'summary'],
                },
                workExperience: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      company: { type: Type.STRING },
                      position: { type: Type.STRING },
                      location: { type: Type.STRING },
                      startDate: { type: Type.STRING },
                      endDate: { type: Type.STRING },
                      current: { type: Type.BOOLEAN },
                      responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
                      achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
                      technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['company', 'position', 'startDate', 'endDate', 'responsibilities', 'achievements'],
                  },
                },
                education: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      institution: { type: Type.STRING },
                      degree: { type: Type.STRING },
                      fieldOfStudy: { type: Type.STRING },
                      graduationDate: { type: Type.STRING },
                      details: { type: Type.STRING },
                    },
                    required: ['institution', 'degree', 'graduationDate'],
                  },
                },
                skills: {
                  type: Type.OBJECT,
                  properties: {
                    technical: { type: Type.ARRAY, items: { type: Type.STRING } },
                    software: { type: Type.ARRAY, items: { type: Type.STRING } },
                    professional: { type: Type.ARRAY, items: { type: Type.STRING } },
                    industry: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['technical', 'software', 'professional', 'industry'],
                },
                projects: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      url: { type: Type.STRING },
                      highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['name', 'description'],
                  },
                },
                certifications: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      issuer: { type: Type.STRING },
                      date: { type: Type.STRING },
                      url: { type: Type.STRING },
                    },
                    required: ['name', 'issuer'],
                  },
                },
                awards: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      issuer: { type: Type.STRING },
                      date: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                    required: ['title'],
                  },
                },
                volunteer: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      organization: { type: Type.STRING },
                      role: { type: Type.STRING },
                      startDate: { type: Type.STRING },
                      endDate: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                    required: ['organization', 'role'],
                  },
                },
                languages: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      language: { type: Type.STRING },
                      proficiency: { type: Type.STRING },
                    },
                    required: ['language'],
                  },
                },
                publications: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      publisher: { type: Type.STRING },
                      date: { type: Type.STRING },
                      url: { type: Type.STRING },
                    },
                    required: ['title'],
                  },
                },
                unclear: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['personal', 'summary', 'workExperience', 'education', 'skills', 'projects', 'certifications', 'awards', 'volunteer', 'languages', 'publications', 'unclear'],
            },
          },
        })
      );

      const parsed = parseJsonSafe(response.text, {
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
        unclear: [],
      });

      const mergedPersonal = {
        fullName: parsed.personal?.fullName?.trim() || '',
        title: parsed.personal?.title?.trim() || parsed.summary?.headline?.trim() || '',
        email: extractedEmail || (parsed.personal?.email?.includes('[') ? '' : parsed.personal?.email) || '',
        phone: extractedPhone || (parsed.personal?.phone?.includes('[') ? '' : parsed.personal?.phone) || '',
        location: parsed.personal?.location?.trim() || '',
        linkedin: parsed.personal?.linkedin?.trim() || extractedLinkedin || '',
        portfolio: parsed.personal?.portfolio?.trim() || extractedPortfolio || '',
        website: parsed.personal?.website?.trim() || '',
      };

      res.json({
        ...parsed,
        personal: mergedPersonal,
        lastImportedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(getAiErrorHttpStatus(err)).json({ error: formatFriendlyAiError(err, 'Resume import parsing failed.') });
    }
  });

  // Multi-Provider LLM Chat Proxy
  app.post('/api/llm/chat', async (req, res) => {
    try {
      const { provider, baseUrl, apiKey, model, messages, stream } = req.body ?? {};
      if (!provider || typeof provider !== 'string' || !model || typeof model !== 'string') {
        res.status(400).json({ error: 'Provider and model are required for LLM proxy.' });
        return;
      }

      const OFFICIAL_BASES: Record<string, string> = {
        anthropic: 'https://api.anthropic.com',
        openai: 'https://api.openai.com',
        openrouter: 'https://openrouter.ai/api',
      };

      const officialBase = OFFICIAL_BASES[provider];
      const requestedBase = typeof baseUrl === 'string' && baseUrl.trim() ? baseUrl.trim().replace(/\/+$/, '') : '';
      let targetBase = officialBase || 'http://127.0.0.1:11434';
      let isCustomTarget = false;

      if (requestedBase) {
        let parsedBase: URL;
        try {
          parsedBase = new URL(requestedBase);
        } catch {
          res.status(400).json({ error: 'Invalid LLM baseUrl format.' });
          return;
        }
        if (parsedBase.protocol !== 'http:' && parsedBase.protocol !== 'https:') {
          res.status(400).json({ error: 'LLM baseUrl must use http or https.' });
          return;
        }
        if (officialBase && parsedBase.origin === new URL(officialBase).origin) {
          targetBase = officialBase;
        } else if (
          (parsedBase.hostname === 'localhost' || parsedBase.hostname === '127.0.0.1') &&
          (provider === 'ollama' || provider === 'lmstudio' || provider === 'local')
        ) {
          targetBase = parsedBase.toString().replace(/\/+$/, '');
          isCustomTarget = true;
        } else {
          res.status(400).json({ error: 'Custom LLM baseUrl is restricted to local runtimes or official provider endpoints.' });
          return;
        }
      }

      const clientApiKey = typeof apiKey === 'string' ? apiKey.trim() : '';
      const serverEnvKey = !isCustomTarget
        ? process.env[`${provider.toUpperCase()}_API_KEY`] ||
          (provider === 'openai' ? process.env.OPENAI_API_KEY : '') ||
          (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : '') ||
          (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : '') ||
          ''
        : '';
      const resolvedApiKey = clientApiKey || serverEnvKey;

      if (provider === 'anthropic') {
        const targetUrl = targetBase + '/v1/messages';
        let systemPrompt = '';
        const anthropicMessages = [];
        for (const m of messages || []) {
          if (m.role === 'system') {
            systemPrompt += (systemPrompt ? '\n\n' : '') + m.content;
          } else {
            anthropicMessages.push({ role: m.role, content: m.content });
          }
        }

        const anthropicRes = await fetch(targetUrl, {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(90000),
          headers: {
            'content-type': 'application/json',
            'x-api-key': resolvedApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            ...(systemPrompt ? { system: systemPrompt } : {}),
            messages: anthropicMessages,
            stream: Boolean(stream),
          }),
        });

        if (!anthropicRes.ok) {
          const errText = await anthropicRes.text().catch(() => '');
          res.status(anthropicRes.status).json({ error: errText || `Anthropic error (${anthropicRes.status})` });
          return;
        }

        if (stream && anthropicRes.body) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          const reader = anthropicRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (line.startsWith('data:')) {
                const dataStr = line.slice(5).trim();
                if (dataStr === '[DONE]') {
                  res.write('data: [DONE]\n\n');
                  continue;
                }
                try {
                  const json = JSON.parse(dataStr);
                  if (json.type === 'content_block_delta' && json.delta?.text) {
                    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: json.delta.text } }] })}\n\n`);
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
          res.end();
          return;
        }

        const data = (await anthropicRes.json().catch(() => ({}))) as {
          content?: Array<{ text?: string }>;
        };
        const text = data.content?.[0]?.text || '';
        res.json({ choices: [{ message: { content: text } }] });
        return;
      }

      const targetUrl = targetBase + '/v1/chat/completions';

      const proxyRes = await fetch(targetUrl, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(90000),
        headers: {
          'content-type': 'application/json',
          ...(resolvedApiKey ? { authorization: `Bearer ${resolvedApiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          stream: Boolean(stream),
        }),
      });

      if (!proxyRes.ok) {
        const errText = await proxyRes.text().catch(() => '');
        res.status(proxyRes.status).json({ error: errText || `LLM proxy error (${proxyRes.status})` });
        return;
      }

      if (stream && proxyRes.body) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const reader = proxyRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            res.write(line + '\n');
          }
        }
        res.end();
        return;
      }

      const data = await proxyRes.json().catch(() => ({}));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'LLM proxy failed.' });
    }
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
      const { action, resume, targetJob, experienceId, companyIntelligence, jobMatch, careerProfile } = req.body ?? {};
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
          careerProfile: careerProfile || null,
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
- Salutation: Address a specific hiring manager by name if provided (e.g. "Dear [Hiring Manager Name],"), otherwise "Dear Hiring Team," or "Dear [Company] Hiring Committee,".
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

  // 5. Company Intelligence & Server-Side Grounded Web Retrieval
  const handleCompanyResearch = async (req: express.Request, res: express.Response) => {
    try {
      const {
        jobId,
        resolvedCompanyName,
        companyName,
        companyWebsite,
        jobTitle,
        jobDescription,
        jobLocation,
        sourceUrl,
        forceRefresh,
        aiConfig,
      } = req.body ?? {};

      const resolved = resolveCompanyOnServer({
        resolvedCompanyName: typeof resolvedCompanyName === 'string' ? resolvedCompanyName : undefined,
        companyName: typeof companyName === 'string' ? companyName : undefined,
        companyWebsite: typeof companyWebsite === 'string' ? companyWebsite : undefined,
        jobTitle: typeof jobTitle === 'string' ? jobTitle : undefined,
        jobDescription: typeof jobDescription === 'string' ? jobDescription : undefined,
        sourceUrl: typeof sourceUrl === 'string' ? sourceUrl : undefined,
      });

      const rawProvidedWebsite =
        typeof companyWebsite === 'string' && companyWebsite.trim() ? companyWebsite.trim() : '';
      const cleanWebsite =
        (rawProvidedWebsite && !isJobBoardOrAggregatorUrl(rawProvidedWebsite)
          ? rawProvidedWebsite
          : '') ||
        (resolved.candidateWebsite && !isJobBoardOrAggregatorUrl(resolved.candidateWebsite)
          ? resolved.candidateWebsite
          : '') ||
        undefined;
      const cleanSourceUrl = typeof sourceUrl === 'string' ? sourceUrl.trim() : undefined;
      const cleanJobTitle = typeof jobTitle === 'string' ? jobTitle.trim() : '';
      const cleanJobDescription = typeof jobDescription === 'string' ? jobDescription.trim() : '';
      const cleanJobLocation = typeof jobLocation === 'string' ? jobLocation.trim() : '';

      // Always execute deterministic server-side public search/fetch snippets first (never throw on blocked/sparse sites)
      let preFetchedSearch: SearchProviderResult = {
        rawSummaryText: '',
        sources: [],
        searchQueries: [],
        retrievedSnippets: [],
        candidateWebsite: cleanWebsite || '',
      };
      try {
        preFetchedSearch = await fetchPublicCompanySnippets({
          companyName: resolved.companyName,
          companyWebsite: cleanWebsite,
          sourceUrl: cleanSourceUrl,
          jobTitle: cleanJobTitle || undefined,
          jobDescription: cleanJobDescription || undefined,
          jobLocation: cleanJobLocation || undefined,
        });
      } catch {
        // Proceed gracefully with empty snippets
      }

      const hasAnyClues = Boolean(
        resolved.companyName ||
          cleanWebsite ||
          preFetchedSearch.retrievedSnippets.length > 0 ||
          cleanJobDescription
      );
      if (!hasAnyClues) {
        res.json({
          jobId: jobId || undefined,
          ...buildGracefulResearchFallback(
            {
              companyName: '',
              companyWebsite: cleanWebsite,
              sourceUrl: cleanSourceUrl,
              jobTitle: cleanJobTitle || undefined,
              jobDescription: cleanJobDescription || undefined,
              jobLocation: cleanJobLocation || undefined,
            },
            preFetchedSearch
          ),
        });
        return;
      }

      // If the user configured local Ollama, synthesize via reachable Ollama endpoint or return server snippets for client-side Ollama synthesis
      if (aiConfig?.provider === 'ollama') {
        const baseUrl =
          typeof aiConfig.ollamaBaseUrl === 'string' ? aiConfig.ollamaBaseUrl.trim().replace(/\/+$/, '') : '';
        const model = typeof aiConfig.ollamaModel === 'string' ? aiConfig.ollamaModel.trim() : '';
        const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl);
        const isHostedEnv = Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB);

        if (baseUrl && model && !(isHostedEnv && isLoopback)) {
          try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (typeof aiConfig.ollamaApiKey === 'string' && aiConfig.ollamaApiKey.trim()) {
              headers.Authorization = `Bearer ${aiConfig.ollamaApiKey.trim()}`;
            }
            const ollamaRes = await fetch(`${baseUrl}/api/chat`, {
              method: 'POST',
              headers,
              signal: AbortSignal.timeout(35000),
              body: JSON.stringify({
                model,
                stream: false,
                format: 'json',
                options: { temperature: 0.1 },
                messages: [
                  {
                    role: 'system',
                    content: `You are a rigorous Company Intelligence Analyst extracting structured company intelligence strictly from retrievedSnippets and jobPosting.
STRICT ANTI-FABRICATION RULES:
"Only state facts supported by the provided snippets or job posting. Do not guess or invent a company name, website, headquarters, hiring managers, street addresses, employee counts, or claims. Set unknown fields to null (or "" for companyName if unidentified) and list any unverified or missing items in missingInfo."
Return ONLY JSON with keys:
{
  "companyName": string,
  "website": string | null,
  "headquarters": string | null,
  "overview": string | null,
  "coreFocus": string[],
  "missingInfo": string[],
  "industry": string,
  "services": string[],
  "overallConfidence": "high"|"medium"|"low",
  "findings": [{ "category": string, "extractedInfo": string, "sourceTitle": string, "sourceUrl": string, "sourceType": "official_website"|"careers_page"|"news_press"|"third_party", "confidence": "high"|"medium"|"low", "conflictNote": string }],
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
                  },
                  {
                    role: 'user',
                    content: JSON.stringify({
                      jobId: jobId || null,
                      companyName: resolved.companyName,
                      candidateWebsite: preFetchedSearch.candidateWebsite || cleanWebsite || null,
                      jobTitle: jobTitle || '',
                      jobLocation: jobLocation || '',
                      jobDescription: (jobDescription || '').slice(0, 6000),
                      retrievedSnippets: preFetchedSearch.retrievedSnippets,
                      sources: preFetchedSearch.sources,
                    }),
                  },
                ],
              }),
            });

            if (ollamaRes.ok) {
              const json = (await ollamaRes.json()) as { message?: { content?: string } };
              const rawContent = json?.message?.content || '';
              const parsed = parseJsonSafe<Record<string, unknown>>(rawContent, {});
              if (parsed && (parsed.overview || parsed.report || parsed.findings)) {
                const nowIso = new Date().toISOString();
                const sources = preFetchedSearch.sources.map((s, idx) => ({
                  id: `src-${idx + 1}-${Date.now().toString(36)}`,
                  title: s.title,
                  url: s.url,
                  sourceType: s.sourceType,
                  isOfficial: s.isOfficial,
                  accessedAt: nowIso,
                }));
                const allowedUrls = new Set(preFetchedSearch.sources.map((s) => s.url));
                const rawFindings = Array.isArray(parsed.findings) ? (parsed.findings as Array<Record<string, unknown>>) : [];
                const findings = rawFindings
                  .filter((f) => f && typeof f.extractedInfo === 'string' && String(f.extractedInfo).trim())
                  .map((f, idx) => {
                    const urlStr = typeof f.sourceUrl === 'string' && allowedUrls.has(f.sourceUrl.trim()) ? f.sourceUrl.trim() : '';
                    return {
                      id: `fnd-ol-${idx + 1}-${Date.now().toString(36)}`,
                      category: typeof f.category === 'string' ? f.category : 'Company Overview',
                      extractedInfo: String(f.extractedInfo).trim(),
                      sourceTitle: typeof f.sourceTitle === 'string' && urlStr ? f.sourceTitle : 'Job Posting / Retrieved Snippet',
                      sourceUrl: urlStr,
                      sourceType: (typeof f.sourceType === 'string' ? f.sourceType : 'third_party'),
                      publicationDate: '',
                      dateResearched: nowIso,
                      confidence: urlStr ? (f.confidence === 'high' || f.confidence === 'low' ? f.confidence : 'medium') : 'low',
                      verificationStatus: 'pending',
                      isAiInterpretation: !urlStr,
                      conflictNote: typeof f.conflictNote === 'string' ? f.conflictNote : '',
                    };
                  });
                const rawParsedWebsite = typeof parsed.website === 'string' ? parsed.website.trim() : '';
                const candidateFallbackWebsite =
                  preFetchedSearch.candidateWebsite &&
                  !isJobBoardOrAggregatorUrl(preFetchedSearch.candidateWebsite)
                    ? preFetchedSearch.candidateWebsite
                    : null;
                const websiteVal =
                  rawParsedWebsite &&
                  /^https?:\/\//i.test(rawParsedWebsite) &&
                  !isJobBoardOrAggregatorUrl(rawParsedWebsite)
                    ? rawParsedWebsite
                    : candidateFallbackWebsite;
                const missingInfoList = Array.isArray(parsed.missingInfo)
                  ? parsed.missingInfo.map(String).filter(Boolean)
                  : [];
                if (!websiteVal && !missingInfoList.some((m) => m.toLowerCase().includes('website'))) {
                  missingInfoList.push('Official company website was not verified in retrieved snippets.');
                }
                const rawParsedCompanyName =
                  typeof parsed.companyName === 'string' ? parsed.companyName.trim() : '';
                const finalOllamaCompanyName = (
                  (!isPlaceholderOrAggregatorNameServer(rawParsedCompanyName)
                    ? rawParsedCompanyName
                    : '') ||
                  (!isPlaceholderOrAggregatorNameServer(resolved.companyName)
                    ? resolved.companyName
                    : '')
                )
                  .trim()
                  .slice(0, 200);
                if (
                  !finalOllamaCompanyName &&
                  !missingInfoList.some((m) => m.toLowerCase().includes('employer name'))
                ) {
                  missingInfoList.unshift(
                    'Employer name could not be reliably identified from the provided fields, description, or link.'
                  );
                }
                res.json({
                  jobId: jobId || undefined,
                  companyName: finalOllamaCompanyName,
                  website: websiteVal,
                  headquarters: typeof parsed.headquarters === 'string' && parsed.headquarters.trim() ? parsed.headquarters.trim() : null,
                  overview: typeof parsed.overview === 'string' && parsed.overview.trim() ? parsed.overview.trim() : null,
                  coreFocus: Array.isArray(parsed.coreFocus) ? parsed.coreFocus.map(String).filter(Boolean) : [],
                  missingInfo: missingInfoList,
                  officialWebsite: websiteVal || '',
                  industry: typeof parsed.industry === 'string' ? parsed.industry : '',
                  services: Array.isArray(parsed.services) ? parsed.services.map(String).filter(Boolean) : [],
                  description: typeof parsed.overview === 'string' ? parsed.overview : '',
                  overallConfidence: sources.length > 0 ? 'medium' : 'low',
                  searchQueries: preFetchedSearch.searchQueries,
                  findings,
                  sources,
                  report: parsed.report || {},
                  fromCache: false,
                });
                return;
              }
            }
          } catch {
            // Fall through cleanly to client-side Ollama synthesis with server-retrieved snippets
          }
        }

        res.json({
          needsClientSynthesis: true,
          jobId: jobId || undefined,
          companyName: resolved.companyName,
          resolvedCompanyName: resolved.companyName,
          candidateWebsite:
            (preFetchedSearch.candidateWebsite && !isJobBoardOrAggregatorUrl(preFetchedSearch.candidateWebsite)
              ? preFetchedSearch.candidateWebsite
              : '') ||
            cleanWebsite ||
            '',
          retrievedSnippets: preFetchedSearch.retrievedSnippets,
          sources: preFetchedSearch.sources,
          searchQueries: preFetchedSearch.searchQueries,
        });
        return;
      }

      try {
        const ai = getAiClient();
        const result = await withAiRetry(() =>
          orchestrateCompanyResearch(ai, {
            companyName: resolved.companyName,
            resolvedCompanyName: resolved.companyName,
            companyWebsite: cleanWebsite,
            sourceUrl: cleanSourceUrl,
            jobTitle: cleanJobTitle || undefined,
            jobDescription: cleanJobDescription || undefined,
            jobLocation: cleanJobLocation || undefined,
            forceRefresh: Boolean(forceRefresh),
            preFetchedSearch,
          })
        );

        res.json({ jobId: jobId || undefined, ...result });
      } catch {
        res.json({
          jobId: jobId || undefined,
          ...buildGracefulResearchFallback(
            {
              companyName: resolved.companyName,
              companyWebsite: cleanWebsite,
              sourceUrl: cleanSourceUrl,
              jobTitle: cleanJobTitle || undefined,
              jobDescription: cleanJobDescription || undefined,
              jobLocation: cleanJobLocation || undefined,
            },
            preFetchedSearch
          ),
        });
      }
    } catch {
      res.json(
        buildGracefulResearchFallback({
          companyName: '',
          jobTitle: typeof req.body?.jobTitle === 'string' ? req.body.jobTitle : undefined,
          jobDescription: typeof req.body?.jobDescription === 'string' ? req.body.jobDescription : undefined,
          sourceUrl: typeof req.body?.sourceUrl === 'string' ? req.body.sourceUrl : undefined,
        })
      );
    }
  };

  app.post('/api/jobs/company-research', handleCompanyResearch);
  app.post('/api/research/company', handleCompanyResearch);

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

  app.use('/api', (err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'Uploaded file exceeds the 15 MB size limit.' });
        return;
      }
      res.status(400).json({ error: `File upload error: ${err.message}` });
      return;
    }
    if (err instanceof SyntaxError && 'status' in err) {
      res.status(400).json({ error: 'Invalid JSON request payload.' });
      return;
    }
    res.status(500).json({ error: 'Unexpected server error occurred.' });
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

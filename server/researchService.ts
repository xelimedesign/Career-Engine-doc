import { GoogleGenAI, Type } from '@google/genai';

export type ResearchConfidence = 'high' | 'medium' | 'low';
export type SourceType = 'official_website' | 'careers_page' | 'news_press' | 'third_party';

export interface SearchQueryInput {
  companyName: string;
  companyWebsite?: string;
  jobTitle?: string;
  jobDescription?: string;
  jobLocation?: string;
  forceRefresh?: boolean;
}

export interface GroundedSourceRaw {
  title: string;
  url: string;
  sourceType: SourceType;
  isOfficial: boolean;
}

export interface SearchProviderResult {
  rawSummaryText: string;
  sources: GroundedSourceRaw[];
  searchQueries: string[];
}

export interface SearchProviderAdapter {
  readonly name: string;
  searchCompany(input: SearchQueryInput): Promise<SearchProviderResult>;
}

function extractHostname(urlStr?: string): string {
  if (!urlStr) return '';
  try {
    const normalized = /^https?:\/\//i.test(urlStr) ? urlStr : `https://${urlStr}`;
    return new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function classifySource(
  url: string,
  title: string,
  companyName: string,
  providedWebsite?: string
): { sourceType: SourceType; isOfficial: boolean } {
  const host = extractHostname(url);
  const targetHost = extractHostname(providedWebsite);
  const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hostSlug = host.replace(/[^a-z0-9]/g, '');
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();

  const matchesProvidedHost = Boolean(
    targetHost && (host === targetHost || host.endsWith(`.${targetHost}`))
  );
  const matchesCompanySlug = Boolean(
    companySlug.length >= 3 && hostSlug.includes(companySlug)
  );

  const isOfficial = matchesProvidedHost || matchesCompanySlug;

  if (
    /\/(careers|jobs|join-us)/i.test(lowerUrl) ||
    /(greenhouse\.io|lever\.co|ashbyhq\.com|workdayjobs|myworkdayjobs)/i.test(host) ||
    lowerTitle.includes('careers')
  ) {
    return { sourceType: 'careers_page', isOfficial };
  }

  if (isOfficial) {
    return { sourceType: 'official_website', isOfficial: true };
  }

  let pathname = '';
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    pathname = new URL(normalized).pathname.toLowerCase();
  } catch {
    pathname = lowerUrl;
  }

  if (
    /(techcrunch\.com|reuters\.com|bloomberg\.com|businesswire\.com|prnewswire\.com|forbes\.com|wsj\.com|cnbc\.com|ft\.com|apnews\.com|venturebeat\.com)/i.test(
      host
    ) ||
    /^(news|press|blog)\./i.test(host) ||
    /^\/(news|press|newsroom|blog)(\/|$)/i.test(pathname)
  ) {
    return { sourceType: 'news_press', isOfficial: false };
  }

  return { sourceType: 'third_party', isOfficial: false };
}

export function verifyAndRankSources(
  rawChunks: Array<{ uri?: string; title?: string }>,
  companyName: string,
  providedWebsite?: string
): GroundedSourceRaw[] {
  const seen = new Set<string>();
  const sources: GroundedSourceRaw[] = [];

  for (const chunk of rawChunks) {
    const url = (chunk.uri || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = (chunk.title || extractHostname(url) || 'Web Source').trim();
    const { sourceType, isOfficial } = classifySource(
      url,
      title,
      companyName,
      providedWebsite
    );
    sources.push({ title, url, sourceType, isOfficial });
  }

  // Prioritize official company sources first, then careers, news, third-party
  const priority: Record<SourceType, number> = {
    official_website: 0,
    careers_page: 1,
    news_press: 2,
    third_party: 3,
  };

  return sources.sort((a, b) => {
    if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1;
    return priority[a.sourceType] - priority[b.sourceType];
  });
}

export class GeminiGoogleSearchAdapter implements SearchProviderAdapter {
  readonly name = 'gemini-google-search-grounding';
  private ai: GoogleGenAI;

  constructor(ai: GoogleGenAI) {
    this.ai = ai;
  }

  async searchCompany(input: SearchQueryInput): Promise<SearchProviderResult> {
    const cleanUrl = input.companyWebsite?.trim()
      ? /^https?:\/\//i.test(input.companyWebsite.trim())
        ? input.companyWebsite.trim()
        : `https://${input.companyWebsite.trim()}`
      : '';

    const tools: Array<Record<string, unknown>> = [{ googleSearch: {} }];
    if (cleanUrl) {
      tools.push({ urlContext: {} });
    }

    const prompt = [
      `Research the employer "${input.companyName}"${cleanUrl ? ` (official website: ${cleanUrl})` : ''}${input.jobLocation ? ` in/near ${input.jobLocation}` : ''}.`,
      input.jobTitle ? `Target role context: ${input.jobTitle}.` : '',
      'Using Google Search (and the official website URL if accessible), gather verified factual information across these 10 areas:',
      '1. Company overview and founding/scale context',
      '2. Core products, services, and specialties',
      '3. Industry and market sector',
      '4. Notable company projects, customers, or portfolio work',
      '5. Technology stack, engineering tools, and software platforms used or built',
      '6. Stated mission, vision, and company values',
      '7. Recent company news (funding, launches, partnerships, leadership)',
      '8. Expansion, hiring trends, or recent organizational developments',
      '9. Careers page & employee expectations / engineering culture',
      '10. Relevant job qualifications or domain context for the role',
      '',
      'CRITICAL RULES:',
      '- Prioritize official company domain pages and official press releases.',
      '- Cite specific facts with dates and URLs where found.',
      '- If different sources conflict (e.g., headquarters, headcount, product focus), explicitly report both claims and the disagreement.',
      '- If an area has no reliable public information, explicitly state "No reliable public information found" instead of guessing or inventing.',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await this.ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools,
      },
    });

    const metadata = response.candidates?.[0]?.groundingMetadata;
    const rawWebChunks = (metadata?.groundingChunks || [])
      .map((c) => c.web)
      .filter((w): w is { uri?: string; title?: string } => Boolean(w && w.uri));

    const sources = verifyAndRankSources(
      rawWebChunks,
      input.companyName,
      input.companyWebsite
    );

    return {
      rawSummaryText: response.text || '',
      sources,
      searchQueries: metadata?.webSearchQueries || [],
    };
  }
}

export async function analyzeCompanyIntelligence(
  ai: GoogleGenAI,
  input: SearchQueryInput,
  searchResult: SearchProviderResult
) {
  const nowIso = new Date().toISOString();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: JSON.stringify({
      companyName: input.companyName,
      providedWebsite: input.companyWebsite || '',
      jobTitle: input.jobTitle || '',
      jobLocation: input.jobLocation || '',
      jobDescription: input.jobDescription || '',
      groundedSearchDossier: searchResult.rawSummaryText,
      groundedSources: searchResult.sources,
    }),
    config: {
      systemInstruction: `You are a rigorous Company Intelligence Analyst.
Your job is to convert grounded web search findings into a structured Company Intelligence Report with strict source provenance.

CRITICAL ACCURACY RULES:
1. NEVER invent company facts, URLs, publication dates, customer names, technologies, or news not present in the groundedSearchDossier or groundedSources.
2. Every finding in "findings" MUST reference a real sourceUrl and sourceTitle from groundedSources (or mark sourceUrl as "" and confidence as "low" if unattributed).
3. Distinguish verified facts from AI interpretations: sections 1–9 of "report" must summarize factual findings with inline source citations like [Source Title], while "applicationRecommendations" holds strategic AI recommendations clearly separated from raw facts.
4. If groundedSources or groundedSearchDossier contain conflicting claims, record each disagreement explicitly in "sourceConflicts" and in the relevant finding's "conflictNote" rather than silently picking one.
5. Prioritize official_website and careers_page sources over third_party sources when assessing confidence.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          officialWebsite: { type: Type.STRING },
          industry: { type: Type.STRING },
          services: { type: Type.ARRAY, items: { type: Type.STRING } },
          description: { type: Type.STRING },
          overallConfidence: { type: Type.STRING },
          findings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                extractedInfo: { type: Type.STRING },
                sourceTitle: { type: Type.STRING },
                sourceUrl: { type: Type.STRING },
                sourceType: { type: Type.STRING },
                publicationDate: { type: Type.STRING },
                confidence: { type: Type.STRING },
                conflictNote: { type: Type.STRING },
              },
              required: ['category', 'extractedInfo', 'sourceTitle', 'sourceUrl', 'sourceType', 'confidence'],
            },
          },
          report: {
            type: Type.OBJECT,
            properties: {
              companyOverview: { type: Type.STRING },
              servicesAndSpecialties: { type: Type.STRING },
              industry: { type: Type.STRING },
              projectsAndPortfolio: { type: Type.STRING },
              technology: { type: Type.STRING },
              missionAndValues: { type: Type.STRING },
              recentDevelopments: { type: Type.STRING },
              employeeExpectations: { type: Type.STRING },
              relevantCompanyInformation: { type: Type.STRING },
              applicationRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              sourceConflicts: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'companyOverview',
              'servicesAndSpecialties',
              'industry',
              'projectsAndPortfolio',
              'technology',
              'missionAndValues',
              'recentDevelopments',
              'employeeExpectations',
              'relevantCompanyInformation',
              'applicationRecommendations',
              'sourceConflicts',
            ],
          },
        },
        required: ['officialWebsite', 'industry', 'services', 'description', 'overallConfidence', 'findings', 'report'],
      },
    },
  });

  const fallback = {
    officialWebsite: input.companyWebsite || '',
    industry: '',
    services: [] as string[],
    description: searchResult.rawSummaryText.slice(0, 500),
    overallConfidence: 'low',
    findings: [] as Array<{
      category: string;
      extractedInfo: string;
      sourceTitle: string;
      sourceUrl: string;
      sourceType: string;
      publicationDate?: string;
      confidence: string;
      conflictNote?: string;
    }>,
    report: {
      companyOverview: searchResult.rawSummaryText || 'No summary extracted.',
      servicesAndSpecialties: 'Not verified.',
      industry: 'Not verified.',
      projectsAndPortfolio: 'Not verified.',
      technology: 'Not verified.',
      missionAndValues: 'Not verified.',
      recentDevelopments: 'Not verified.',
      employeeExpectations: 'Not verified.',
      relevantCompanyInformation: 'Not verified.',
      applicationRecommendations: [],
      sourceConflicts: [],
    },
  };

  let parsed = fallback;
  try {
    const raw = (response.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    if (raw) parsed = JSON.parse(raw);
  } catch {
    // keep fallback
  }

  const normalizeConfidence = (c: string): ResearchConfidence =>
    c === 'high' || c === 'medium' || c === 'low' ? c : 'medium';

  const normalizeSourceType = (s: string): SourceType =>
    s === 'official_website' || s === 'careers_page' || s === 'news_press' || s === 'third_party'
      ? s
      : 'third_party';

  const VALID_CATEGORIES = [
    'Company Overview',
    'Services & Specialties',
    'Industry',
    'Projects & Portfolio',
    'Technology & Software',
    'Mission & Values',
    'Recent News & Developments',
    'Careers & Expectations',
    'Job Requirements',
  ] as const;

  const normalizeCategory = (cat: string) => {
    const exact = VALID_CATEGORIES.find((v) => v.toLowerCase() === (cat || '').trim().toLowerCase());
    if (exact) return exact;
    const lower = (cat || '').toLowerCase();
    if (lower.includes('service') || lower.includes('product')) return 'Services & Specialties';
    if (lower.includes('industry')) return 'Industry';
    if (lower.includes('project') || lower.includes('portfolio')) return 'Projects & Portfolio';
    if (lower.includes('tech') || lower.includes('software') || lower.includes('stack'))
      return 'Technology & Software';
    if (lower.includes('mission') || lower.includes('value')) return 'Mission & Values';
    if (lower.includes('news') || lower.includes('develop') || lower.includes('expan'))
      return 'Recent News & Developments';
    if (lower.includes('career') || lower.includes('employ') || lower.includes('culture'))
      return 'Careers & Expectations';
    if (lower.includes('require') || lower.includes('job')) return 'Job Requirements';
    return 'Company Overview';
  };

  const allowedUrlSet = new Set(searchResult.sources.map((s) => s.url));
  const sourceLookup = new Map(searchResult.sources.map((s) => [s.url, s]));

  const findings = (parsed.findings || []).map((f, idx) => {
    const candidateUrl = (f.sourceUrl || '').trim();
    const hasVerifiedUrl = candidateUrl.length > 0 && allowedUrlSet.has(candidateUrl);
    const safeUrl = hasVerifiedUrl ? candidateUrl : '';
    const matchedSource = safeUrl ? sourceLookup.get(safeUrl) : undefined;
    return {
      id: `fnd-${idx + 1}-${Date.now().toString(36)}`,
      category: normalizeCategory(f.category),
      extractedInfo: f.extractedInfo,
      sourceTitle: matchedSource?.title || (hasVerifiedUrl ? f.sourceTitle : 'Unattributed Note'),
      sourceUrl: safeUrl,
      sourceType: matchedSource?.sourceType || normalizeSourceType(f.sourceType),
      publicationDate: f.publicationDate || '',
      dateResearched: nowIso,
      confidence: safeUrl ? normalizeConfidence(f.confidence) : ('low' as ResearchConfidence),
      verificationStatus: 'pending' as const,
      isAiInterpretation: !safeUrl,
      conflictNote: f.conflictNote || '',
    };
  });

  const sources = searchResult.sources.map((s, idx) => ({
    id: `src-${idx + 1}-${Date.now().toString(36)}`,
    title: s.title,
    url: s.url,
    sourceType: s.sourceType,
    isOfficial: s.isOfficial,
    accessedAt: nowIso,
  }));

  return {
    officialWebsite: parsed.officialWebsite || input.companyWebsite || sources.find((s) => s.isOfficial)?.url || '',
    industry: parsed.industry || '',
    services: parsed.services || [],
    description: parsed.description || '',
    overallConfidence: sources.length === 0 ? ('low' as ResearchConfidence) : normalizeConfidence(parsed.overallConfidence),
    searchQueries: searchResult.searchQueries,
    findings,
    sources,
    report: parsed.report,
  };
}

// In-memory TTL cache to prevent duplicate searches and respect provider rate limits
const CACHE_TTL_MS = 30 * 60 * 1000;
const researchCache = new Map<string, { expiresAt: number; payload: Awaited<ReturnType<typeof analyzeCompanyIntelligence>> }>();

export async function orchestrateCompanyResearch(
  ai: GoogleGenAI,
  input: SearchQueryInput,
  adapter?: SearchProviderAdapter
) {
  const cacheKey = [
    input.companyName.trim().toLowerCase(),
    (input.companyWebsite || '').trim().toLowerCase(),
    (input.jobTitle || '').trim().toLowerCase(),
    (input.jobLocation || '').trim().toLowerCase(),
  ].join('|');

  if (!input.forceRefresh) {
    const cached = researchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.payload, fromCache: true };
    }
  }

  const searchAdapter = adapter || new GeminiGoogleSearchAdapter(ai);
  const searchResult = await searchAdapter.searchCompany(input);
  const analyzed = await analyzeCompanyIntelligence(ai, input, searchResult);

  researchCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload: analyzed,
  });

  return { ...analyzed, fromCache: false };
}

export async function runThreeWayJobMatch(
  ai: GoogleGenAI,
  params: {
    job: unknown;
    companyResearch: unknown;
    careerProfile: unknown;
  }
) {
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: JSON.stringify(params),
    config: {
      systemInstruction: `You are a three-way Career Matching Engine comparing:
A. Verified Company Intelligence (findings, services, tech stack, projects, expectations)
B. Target Job Description & Requirements
C. Candidate Career Profile (verified work history, education, skills, software, industry knowledge, projects)

CRITICAL INTEGRITY RULES:
1. NEVER invent qualifications, skills, dates, employers, projects, or accomplishments not present in the Candidate Career Profile.
2. NEVER recommend adding company research facts as the candidate's own experience.
3. Only recommend emphasizing, reordering, or clarifying verified information from the Candidate Career Profile.
4. For cover letter talking points, explain specifically how verified candidate achievements relate to the company's actual services, projects, or technical stack—without fabricating personal connections.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          strongMatches: { type: Type.ARRAY, items: { type: Type.STRING } },
          partialMatches: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingQualifications: { type: Type.ARRAY, items: { type: Type.STRING } },
          relevantAchievements: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedResumeEmphasis: {
            type: Type.OBJECT,
            properties: {
              experienceToEmphasize: { type: Type.ARRAY, items: { type: Type.STRING } },
              skillsToPrioritize: { type: Type.ARRAY, items: { type: Type.STRING } },
              relevantAchievements: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedSectionOrder: { type: Type.ARRAY, items: { type: Type.STRING } },
              descriptionImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'experienceToEmphasize',
              'skillsToPrioritize',
              'relevantAchievements',
              'suggestedSectionOrder',
              'descriptionImprovements',
            ],
          },
          recommendedCoverLetterTalkingPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          'strongMatches',
          'partialMatches',
          'missingQualifications',
          'relevantAchievements',
          'recommendedResumeEmphasis',
          'recommendedCoverLetterTalkingPoints',
        ],
      },
    },
  });

  const raw = (response.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(raw);
  const VALID_SECTIONS = new Set([
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
  if (parsed?.recommendedResumeEmphasis?.suggestedSectionOrder) {
    parsed.recommendedResumeEmphasis.suggestedSectionOrder = (
      parsed.recommendedResumeEmphasis.suggestedSectionOrder as string[]
    ).filter((s) => VALID_SECTIONS.has(s));
  }
  return parsed;
}

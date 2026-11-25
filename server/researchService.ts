import { GoogleGenAI, Type } from '@google/genai';
import dns from 'node:dns/promises';
import net from 'node:net';

export type ResearchConfidence = 'high' | 'medium' | 'low';
export type SourceType = 'official_website' | 'careers_page' | 'news_press' | 'third_party';

export interface SearchQueryInput {
  companyName: string;
  resolvedCompanyName?: string;
  companyWebsite?: string;
  sourceUrl?: string;
  jobTitle?: string;
  jobDescription?: string;
  jobLocation?: string;
  forceRefresh?: boolean;
  preFetchedSearch?: SearchProviderResult;
}

export interface GroundedSourceRaw {
  title: string;
  url: string;
  sourceType: SourceType;
  isOfficial: boolean;
}

export interface RetrievedSnippet {
  title: string;
  url: string;
  snippet: string;
  sourceType: SourceType;
  isOfficial: boolean;
}

export interface SearchProviderResult {
  rawSummaryText: string;
  sources: GroundedSourceRaw[];
  searchQueries: string[];
  retrievedSnippets: RetrievedSnippet[];
  candidateWebsite?: string;
}

export interface SearchProviderAdapter {
  readonly name: string;
  searchCompany(input: SearchQueryInput): Promise<SearchProviderResult>;
}

const PLACEHOLDER_OR_AGGREGATOR_NAMES = new Set([
  'new company',
  'company',
  'unverified employer',
  'unknown',
  'tbd',
  'n/a',
  'na',
  'none',
  'it',
  'we',
  'our',
  'they',
  'this',
  'equal',
  'affirmative',
  'lensa',
  'jooble',
  'indeed',
  'linkedin',
  'ziprecruiter',
  'glassdoor',
  'monster',
  'simplyhired',
  'careerbuilder',
  'talent',
  'adzuna',
  'getwork',
  'jobcase',
  'the role',
  'this role',
  'the position',
  'this position',
  'the job',
  'the team',
  'our team',
  'the company',
  'this company',
  'our company',
  'your role',
  'about us',
  'us',
]);

export function isPlaceholderOrAggregatorNameServer(name?: string): boolean {
  const trimmed = (name || '').trim().toLowerCase();
  if (!trimmed) return true;
  return PLACEHOLDER_OR_AGGREGATOR_NAMES.has(trimmed);
}

export const JOB_BOARD_AGGREGATOR_HOSTS = new Set([
  'lensa.com',
  'jooble.org',
  'jooble.com',
  'indeed.com',
  'linkedin.com',
  'ziprecruiter.com',
  'glassdoor.com',
  'monster.com',
  'simplyhired.com',
  'dice.com',
  'wellfound.com',
  'angel.co',
  'builtin.com',
  'themuse.com',
  'snagajob.com',
  'careerbuilder.com',
  'flexjobs.com',
  'weworkremotely.com',
  'remoteok.com',
  'hired.com',
  'levels.fyi',
  'google.com',
  'talent.com',
  'adzuna.com',
  'careerjet.com',
  'jobrapido.com',
  'neuvoo.com',
  'whatjobs.com',
  'getwork.com',
  'ladders.com',
  'theladders.com',
  'idealist.org',
  'jobcase.com',
  'linkup.com',
  'wayup.com',
  'ripplematch.com',
  'joinhandshake.com',
  'handshake.com',
  'comparably.com',
  'upwork.com',
  'fiverr.com',
  'toptal.com',
  'wikipedia.org',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
]);

const ATS_BOARD_HOSTS = [
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'smartrecruiters.com',
  'workable.com',
  'bamboohr.com',
  'jobvite.com',
  'icims.com',
  'myworkdayjobs.com',
  'workday.com',
  'taleo.net',
  'adp.com',
  'paylocity.com',
  'paycomonline.net',
  'ultipro.com',
  'breezy.hr',
  'recruitee.com',
];

const EXCLUDED_ACRONYMS = new Set([
  'SQL', 'API', 'REST', 'AWS', 'GCP', 'AZURE', 'HTML', 'CSS', 'PDF', 'DOCX', 'JSON', 'XML',
  'HTTP', 'HTTPS', 'HVAC', 'MEP', 'CAD', 'BIM', 'REVIT', 'EIT', 'PMP', 'OSHA', 'USA', 'US',
  'UK', 'EU', 'EEO', 'EOE', 'ADA', 'FMLA', 'PTO', 'FTE', 'KPI', 'ROI', 'ATS', 'LLM', 'AI',
  'ML', 'UI', 'UX', 'QA', 'CI', 'CD', 'HR', 'IT', 'VP', 'CEO', 'CTO', 'CFO', 'COO', 'STEM',
  'STEMI', 'MBA', 'PHD', 'BS', 'MS', 'BA', 'MA', 'EST', 'PST', 'CST', 'MST', 'USD', 'EUR',
  'GBP', 'FAQ', 'GDPR', 'SOC', 'ISO', 'HIPAA', 'REMOTE', 'HYBRID', 'ONSITE', 'FULL', 'PART',
  'TIME', 'NEW', 'JOB', 'ROLE',
]);

function normalizeHttpUrl(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
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

export function isJobBoardOrAggregatorUrl(rawUrl?: string): boolean {
  const host = extractHostname(rawUrl);
  if (!host) return false;
  if (JOB_BOARD_AGGREGATOR_HOSTS.has(host)) return true;
  if (Array.from(JOB_BOARD_AGGREGATOR_HOSTS).some((h) => host.endsWith(`.${h}`))) return true;
  if (ATS_BOARD_HOSTS.some((ats) => host === ats || host.endsWith(`.${ats}`))) return true;
  return false;
}

function normalizeCompanyRootWebsite(raw?: string): string {
  const full = normalizeHttpUrl(raw);
  if (!full) return '';
  try {
    const parsed = new URL(full);
    const candidate = `${parsed.protocol}//${parsed.hostname}`;
    if (isJobBoardOrAggregatorUrl(candidate)) return '';
    return candidate;
  } catch {
    return '';
  }
}

function normalizeCompanyVerifiedUrl(raw?: string): string {
  const full = normalizeHttpUrl(raw);
  if (!full || isJobBoardOrAggregatorUrl(full)) return '';
  return full;
}

function isValidCandidateNameServer(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (trimmed.length < 2) return false;
  if (PLACEHOLDER_OR_AGGREGATOR_NAMES.has(trimmed.toLowerCase())) return false;
  if (EXCLUDED_ACRONYMS.has(trimmed.toUpperCase())) return false;
  if (/^(?:the|this|our|your|an?)\s+(?:role|job|position|team|company|opportunity)$/i.test(trimmed)) {
    return false;
  }
  return true;
}

function formatBrandFromSlug(slug: string): string {
  const cleaned = slug.replace(/[^a-zA-Z0-9\-_ ]/g, ' ').trim();
  if (!cleaned) return '';
  const parts = cleaned
    .split(/[\-_ ]+/)
    .filter((p) => p && !/^(?:inc|llc|ltd|corp|jobs|job|careers|view|apply|opening)$/i.test(p));
  const finalParts = parts.length > 0 ? parts : cleaned.split(/[\-_ ]+/).filter(Boolean);
  const formatted = finalParts
    .map((part) => {
      if (part.length <= 4 && !/[aeiouy]{2}/i.test(part)) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
  return isValidCandidateNameServer(formatted) ? formatted : '';
}

function extractFromJobBoardUrlServer(
  parsed: URL,
  depth = 0
): { companyName: string; website: string } {
  if (depth > 2) return { companyName: '', website: '' };
  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const pathSegments = parsed.pathname.split('/').filter(Boolean);

  const redirectParamKeys = [
    'url',
    'u',
    'q',
    'redirect',
    'redirect_url',
    'target',
    'dest',
    'destination',
    'rd',
    'joburl',
    'external_url',
    'apply_url',
  ];
  for (const key of redirectParamKeys) {
    const val = parsed.searchParams.get(key);
    if (val && /^https?:\/\//i.test(val.trim())) {
      const nested = extractEmployerFromUrlServer(val.trim(), depth + 1);
      if (nested.companyName || nested.website) {
        return nested;
      }
    }
  }

  const companyParamKeys = ['company', 'employer', 'cname', 'cmp', 'companyName', 'org'];
  for (const key of companyParamKeys) {
    const val = parsed.searchParams.get(key);
    if (val) {
      const formatted = formatBrandFromSlug(val);
      if (formatted) return { companyName: formatted, website: '' };
    }
  }

  if (host.includes('linkedin.com')) {
    if (pathSegments[0] === 'company' && pathSegments[1]) {
      return { companyName: formatBrandFromSlug(pathSegments[1]), website: '' };
    }
    const jobsAtMatch = parsed.pathname.match(/-at-([a-z0-9-]+?)(?:-\d+)?(?:\/|$)/i);
    if (jobsAtMatch && jobsAtMatch[1]) {
      return { companyName: formatBrandFromSlug(jobsAtMatch[1]), website: '' };
    }
  }

  if (host.includes('indeed.com') && pathSegments[0] === 'cmp' && pathSegments[1]) {
    return { companyName: formatBrandFromSlug(pathSegments[1]), website: '' };
  }

  if (host.includes('glassdoor.com')) {
    const workingAtMatch = parsed.pathname.match(/Working-at-([A-Za-z0-9-]+)-EI/i);
    if (workingAtMatch && workingAtMatch[1]) {
      return { companyName: formatBrandFromSlug(workingAtMatch[1]), website: '' };
    }
  }

  const explicitDirMatch = parsed.pathname.match(
    /\/(?:company|companies|employer|employers|cmp|org|organizations?)\/([a-z0-9][a-z0-9\-_]{1,80})/i
  );
  if (explicitDirMatch && explicitDirMatch[1]) {
    const formatted = formatBrandFromSlug(explicitDirMatch[1]);
    if (formatted) return { companyName: formatted, website: '' };
  }

  const slugAtMatch = parsed.pathname.match(/-at-([a-z0-9-]+?)(?:-\d{3,}|\/j\/|\/|$)/i);
  if (slugAtMatch && slugAtMatch[1]) {
    const cleanedSlug = slugAtMatch[1].replace(/-(?:[a-z]{2}|usa|us|remote)$/i, '');
    const formatted = formatBrandFromSlug(cleanedSlug);
    if (formatted) return { companyName: formatted, website: '' };
  }

  return { companyName: '', website: '' };
}

function extractEmployerFromUrlServer(
  rawUrl?: string,
  depth = 0
): { companyName: string; website: string } {
  const full = normalizeHttpUrl(rawUrl);
  if (!full || depth > 2) return { companyName: '', website: '' };
  try {
    const parsed = new URL(full);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    if (
      JOB_BOARD_AGGREGATOR_HOSTS.has(host) ||
      Array.from(JOB_BOARD_AGGREGATOR_HOSTS).some((h) => host.endsWith(`.${h}`))
    ) {
      return extractFromJobBoardUrlServer(parsed, depth);
    }

    const matchedAts = ATS_BOARD_HOSTS.find((ats) => host === ats || host.endsWith(`.${ats}`));
    if (matchedAts) {
      const hostPrefix = host.replace(new RegExp(`\\.?${matchedAts.replace('.', '\\.')}$`), '');
      const subParts = hostPrefix
        .split('.')
        .filter((p) => p && !/^(boards|jobs|careers|apply|wd\d+)$/i.test(p));
      if (subParts.length > 0 && subParts[0].length >= 2) {
        return { companyName: formatBrandFromSlug(subParts[0]), website: '' };
      }
      const firstPath = pathSegments[0];
      if (firstPath && !/^(jobs|careers|v1|embed|search)$/i.test(firstPath)) {
        return { companyName: formatBrandFromSlug(firstPath), website: '' };
      }
      return { companyName: '', website: '' };
    }

    const strippedHost = host.replace(/^(careers|jobs|apply|talent|work|join)\./i, '');
    const domainParts = strippedHost.split('.');
    if (domainParts.length >= 2 && domainParts[0].length >= 2) {
      return {
        companyName: formatBrandFromSlug(domainParts[0]),
        website: `${parsed.protocol}//${strippedHost}`,
      };
    }
    return { companyName: '', website: '' };
  } catch {
    return { companyName: '', website: '' };
  }
}

function extractEmployerFromTextServer(text: string): string {
  if (!text.trim()) return '';
  const patterns: RegExp[] = [
    /(?:^|\n)\s*(?:Company|Employer|Organization|Client|About the Company)\s*[:\-]\s*([A-Z0-9][A-Za-z0-9&.,'’\- ]{1,65})/im,
    /\b(?:About|Why Join|Join|Welcome to)\s+(?:us at\s+)?([A-Z][A-Za-z0-9&.'’\-]*(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]*|Inc\.?|LLC|Ltd\.?|Corp\.?|Group|Systems|Solutions|Technologies|Engineering)){0,3})\b/,
    /(?:^|\n|[.!?]\s+)At\s+([A-Z][A-Za-z0-9&.'’\-]+(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]+|Inc\.?|LLC|Corp\.?|Group)){0,3})\s*,/,
    /\b([A-Z][A-Za-z0-9&.'’\-]+(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]+|Inc\.?|LLC|Corp\.?|Group)){0,3})\s+(?:is\s+(?:currently\s+|actively\s+|now\s+)?(?:seeking|hiring|looking\s+for|recruiting|a\s+leading|an?\s+(?:global|national|international|premier|architecture|engineering|design|software|technology|consulting))|offers\s+competitive)\b/,
    /\bat\s+([A-Z][A-Za-z0-9&.'’\-]+(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]+|Inc\.?|LLC|Corp\.?|Group)){0,3})(?=\s*(?:[,.\-–|(\n]|$|\s+(?:in|we|you|for|to|as|where)))/,
    /\b([A-Z][A-Za-z0-9&.'’\-]+(?:\s+[A-Z][A-Za-z0-9&.'’\-]+){0,3}\s+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|LLP|PLLC|Group))\b/,
    /\b([A-Z][A-Za-z0-9&.'’\-]+(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]+|Inc\.?|LLC|Ltd\.?|Corp\.?|Group)){0,3})\s+is\s+(?:proud\s+to\s+be\s+)?an?\s+(?:[Ee]qual\s+(?:[Ee]mployment\s+)?[Oo]pportunity|EEO|[Aa]ffirmative\s+[Aa]ction)\b/,
    /(?:©|Copyright\s*(?:©|\(c\))?)\s*(?:20\d{2}\s+)?([A-Z][A-Za-z0-9&.'’\-]+(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]+|Inc\.?|LLC|Ltd\.?|Corp\.?|Group)){0,3})\b/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const cleaned = match[1]
        .replace(/^["'“‘(\[]+|["'”’)\],.:;!?]+$/g, '')
        .replace(/\s+(?:is|are|was|were|has|have|offers|provides|seeks|looking|hiring|for|in|with|on|to)\b.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
      if (isValidCandidateNameServer(cleaned)) {
        return cleaned;
      }
    }
  }

  const domainMatches =
    text.match(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]{2,}\.(?:com|org|io|co|net|ai|dev))\b/gi) || [];
  for (const rawDom of domainMatches) {
    if (isJobBoardOrAggregatorUrl(rawDom)) continue;
    const fromDomain = extractEmployerFromUrlServer(rawDom);
    if (fromDomain.companyName && isValidCandidateNameServer(fromDomain.companyName)) {
      return fromDomain.companyName;
    }
  }

  const acronymCounts = new Map<string, number>();
  const acronyms = text.match(/\b[A-Z]{3,8}\b/g) || [];
  for (const token of acronyms) {
    if (EXCLUDED_ACRONYMS.has(token) || PLACEHOLDER_OR_AGGREGATOR_NAMES.has(token.toLowerCase())) {
      continue;
    }
    acronymCounts.set(token, (acronymCounts.get(token) || 0) + 1);
  }
  let topAcronym = '';
  let topCount = 1;
  for (const [token, count] of acronymCounts.entries()) {
    if (count > topCount) {
      topCount = count;
      topAcronym = token;
    }
  }
  return topAcronym;
}

export function resolveCompanyOnServer(params: {
  resolvedCompanyName?: string;
  companyName?: string;
  companyWebsite?: string;
  jobTitle?: string;
  jobDescription?: string;
  sourceUrl?: string;
}): { companyName: string; candidateWebsite: string } {
  const urlInfo = extractEmployerFromUrlServer(params.sourceUrl || params.companyWebsite);
  const websiteCandidate =
    normalizeCompanyRootWebsite(params.companyWebsite) ||
    normalizeCompanyRootWebsite(urlInfo.website);

  const candidates = [
    (params.companyName || '').trim(),
    (params.resolvedCompanyName || '').trim(),
    extractEmployerFromTextServer(params.jobDescription || ''),
    extractEmployerFromTextServer(params.jobTitle || ''),
    urlInfo.companyName,
  ];

  for (const cand of candidates) {
    if (
      cand &&
      !['new company', 'company', 'unknown', 'tbd', 'n/a', 'na'].includes(cand.toLowerCase())
    ) {
      return {
        companyName: cand.slice(0, 200),
        candidateWebsite: websiteCandidate,
      };
    }
  }

  return {
    companyName: '',
    candidateWebsite: websiteCandidate,
  };
}

function classifySource(
  url: string,
  title: string,
  companyName: string,
  providedWebsite?: string
): { sourceType: SourceType; isOfficial: boolean } {
  const host = extractHostname(url);
  if (isJobBoardOrAggregatorUrl(url)) {
    return { sourceType: 'third_party', isOfficial: false };
  }

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
    const url = normalizeHttpUrl(chunk.uri);
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

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : ' ';
    });
}

function stripHtmlToReadableText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : '';

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(?:br|p|div|li|h[1-6]|tr|section|article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const cleaned = decodeHtmlEntities(body)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, text: cleaned };
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local / cloud metadata 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast & reserved
  return false;
}

function isBlockedIpAddress(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();
  const ver = net.isIP(normalized);
  if (ver === 4) return isBlockedIpv4(normalized);
  if (ver === 6) {
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true; // link-local fe80::/10
    }
    const v4Match = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (v4Match) return isBlockedIpv4(v4Match[1]);
    return false;
  }
  return true;
}

async function assertSafePublicHttpUrl(rawUrl: string): Promise<string> {
  const safeUrl = normalizeHttpUrl(rawUrl);
  if (!safeUrl || safeUrl.length > 2048) return '';
  let parsed: URL;
  try {
    parsed = new URL(safeUrl);
  } catch {
    return '';
  }
  if (parsed.username || parsed.password) return '';
  const host = parsed.hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return '';
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    return '';
  }

  if (net.isIP(host)) {
    return isBlockedIpAddress(host) ? '' : parsed.toString();
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) return '';
    for (const rec of records) {
      if (isBlockedIpAddress(rec.address)) {
        return '';
      }
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

async function fetchHtmlPage(url: string, maxChars = 2400, timeoutMs = 5500): Promise<{ title: string; text: string; finalUrl: string } | null> {
  let currentUrl = await assertSafePublicHttpUrl(url);
  if (!currentUrl) return null;

  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= 3; hop += 1) {
      const attempt = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CareerEngineResearchBot/1.0)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
      });

      if (attempt.status >= 300 && attempt.status < 400) {
        const location = attempt.headers.get('location');
        if (!location || hop === 3) return null;
        const resolvedNext = new URL(location, currentUrl).toString();
        const checkedNext = await assertSafePublicHttpUrl(resolvedNext);
        if (!checkedNext) return null;
        currentUrl = checkedNext;
        continue;
      }

      res = attempt;
      break;
    }

    if (!res || !res.ok) return null;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/') && !contentType.includes('html') && !contentType.includes('json')) {
      return null;
    }
    const rawHtml = (await res.text()).slice(0, 1_500_000);
    const { title, text } = stripHtmlToReadableText(rawHtml);
    if (!text || text.length < 40) return null;
    return {
      title: title || extractHostname(currentUrl),
      text: text.slice(0, maxChars),
      finalUrl: currentUrl,
    };
  } catch {
    return null;
  }
}

function unwrapDuckDuckGoUrl(rawHref: string): string {
  const cleaned = decodeHtmlEntities(rawHref.trim());
  if (!cleaned) return '';
  try {
    const normalized = cleaned.startsWith('//')
      ? `https:${cleaned}`
      : cleaned.startsWith('/')
      ? `https://duckduckgo.com${cleaned}`
      : cleaned;
    const parsed = new URL(normalized);
    const uddg = parsed.searchParams.get('uddg');
    if (uddg) {
      const target = normalizeHttpUrl(decodeURIComponent(uddg));
      if (target && !target.includes('duckduckgo.com/y.js')) return target;
    }
    if (!parsed.hostname.includes('duckduckgo.com')) {
      return normalizeHttpUrl(parsed.toString());
    }
  } catch {
    return '';
  }
  return '';
}

async function searchDuckDuckGoHtml(
  query: string,
  companyName: string,
  providedWebsite?: string
): Promise<RetrievedSnippet[]> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(6000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: RetrievedSnippet[] = [];

    const anchorRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<(?:a|div|span)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/gi;

    const anchors: Array<{ url: string; title: string; index: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = anchorRegex.exec(html)) !== null && anchors.length < 8) {
      const url = unwrapDuckDuckGoUrl(m[1]);
      const title = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      if (url && title) {
        anchors.push({ url, title, index: m.index });
      }
    }

    const snippets: Array<{ text: string; index: number }> = [];
    while ((m = snippetRegex.exec(html)) !== null) {
      const text = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      snippets.push({ text, index: m.index });
    }

    for (let i = 0; i < anchors.length; i++) {
      const item = anchors[i];
      const nextIndex = anchors[i + 1]?.index ?? Number.MAX_SAFE_INTEGER;
      const matchedSnippet = snippets.find((s) => s.index > item.index && s.index < nextIndex);
      const { sourceType, isOfficial } = classifySource(
        item.url,
        item.title,
        companyName,
        providedWebsite
      );
      results.push({
        title: item.title,
        url: item.url,
        snippet: matchedSnippet?.text || '',
        sourceType,
        isOfficial,
      });
    }

    return results;
  } catch {
    return [];
  }
}

async function fetchWikipediaCompanySummary(companyName: string): Promise<RetrievedSnippet | null> {
  const cleaned = companyName.trim().replace(/\s+/g, '_');
  if (!cleaned) return null;
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleaned)}`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(4500),
        headers: {
          'User-Agent': 'CareerEngineResearchBot/1.0',
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      extract?: string;
      type?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    if (!data?.extract || data.type === 'disambiguation') return null;
    const pageUrl = data.content_urls?.desktop?.page;
    if (!pageUrl) return null;
    return {
      title: `${data.title || companyName} — Wikipedia`,
      url: pageUrl,
      snippet: data.extract.slice(0, 1400),
      sourceType: 'third_party',
      isOfficial: false,
    };
  } catch {
    return null;
  }
}

export async function fetchPublicCompanySnippets(
  input: SearchQueryInput
): Promise<SearchProviderResult> {
  const company = input.companyName.trim();
  const baseWebsite =
    normalizeCompanyRootWebsite(input.companyWebsite) ||
    normalizeCompanyRootWebsite(extractEmployerFromUrlServer(input.sourceUrl).website);
  const sourceIsAggregator = isJobBoardOrAggregatorUrl(input.sourceUrl);
  const shouldFetchSourceUrl = Boolean(input.sourceUrl) && !sourceIsAggregator;

  const searchQueries = company
    ? [
        `"${company}" official website about headquarters`,
        `${company} ${input.jobLocation ? `${input.jobLocation} ` : ''}company overview services careers`,
      ]
    : [];

  const [ddgPrimary, ddgAbout, wikiSummary, jobPostingPage] = await Promise.all([
    company ? searchDuckDuckGoHtml(searchQueries[0], company, baseWebsite) : Promise.resolve([]),
    company ? searchDuckDuckGoHtml(searchQueries[1], company, baseWebsite) : Promise.resolve([]),
    company ? fetchWikipediaCompanySummary(company) : Promise.resolve(null),
    shouldFetchSourceUrl ? fetchHtmlPage(input.sourceUrl!, 2800, 5000) : Promise.resolve(null),
  ]);

  const snippetMap = new Map<string, RetrievedSnippet>();
  const addSnippet = (item: RetrievedSnippet) => {
    const url = normalizeHttpUrl(item.url);
    if (!url) return;
    const existing = snippetMap.get(url);
    if (!existing) {
      snippetMap.set(url, { ...item, url });
    } else if (item.snippet.length > existing.snippet.length) {
      snippetMap.set(url, {
        ...existing,
        snippet: item.snippet,
        title: item.title || existing.title,
      });
    }
  };

  // Prefer non-aggregator results, keep third-party non-job-board company profiles (Wikipedia, Bloomberg, etc.)
  for (const s of [...ddgPrimary, ...ddgAbout]) {
    if (isJobBoardOrAggregatorUrl(s.url) && !s.url.includes('wikipedia.org')) {
      continue;
    }
    addSnippet(s);
  }
  if (wikiSummary) {
    addSnippet(wikiSummary);
  }
  if (jobPostingPage && input.sourceUrl && !isJobBoardOrAggregatorUrl(jobPostingPage.finalUrl)) {
    const cls = classifySource(jobPostingPage.finalUrl, jobPostingPage.title, company, baseWebsite);
    addSnippet({
      title: jobPostingPage.title || 'Source Job Posting',
      url: jobPostingPage.finalUrl,
      snippet: jobPostingPage.text,
      sourceType: cls.sourceType,
      isOfficial: cls.isOfficial,
    });
  }

  // Determine candidate official website to crawl /, /about, /careers directly (NEVER crawl a job board)
  const rankedInitial = Array.from(snippetMap.values()).sort((a, b) =>
    a.isOfficial === b.isOfficial ? 0 : a.isOfficial ? -1 : 1
  );
  const officialRoot =
    baseWebsite ||
    normalizeCompanyRootWebsite(rankedInitial.find((s) => s.isOfficial)?.url) ||
    '';

  const pagesToCrawl: string[] = [];
  if (officialRoot && !isJobBoardOrAggregatorUrl(officialRoot)) {
    pagesToCrawl.push(officialRoot, `${officialRoot}/about`, `${officialRoot}/careers`);
  } else {
    for (const item of rankedInitial) {
      if (!isJobBoardOrAggregatorUrl(item.url)) {
        pagesToCrawl.push(item.url);
        if (pagesToCrawl.length >= 2) break;
      }
    }
  }

  const crawledPages = await Promise.all(
    pagesToCrawl.slice(0, 3).map(async (pageUrl) => ({
      requestedUrl: pageUrl,
      page: await fetchHtmlPage(pageUrl, 2200, 5000),
    }))
  );

  for (const entry of crawledPages) {
    if (!entry.page || isJobBoardOrAggregatorUrl(entry.page.finalUrl)) continue;
    const cls = classifySource(
      entry.page.finalUrl,
      entry.page.title,
      company,
      officialRoot || baseWebsite
    );
    addSnippet({
      title: entry.page.title,
      url: entry.page.finalUrl,
      snippet: entry.page.text,
      sourceType: cls.sourceType,
      isOfficial: cls.isOfficial,
    });
  }

  const retrievedSnippets = Array.from(snippetMap.values()).slice(0, 12);
  const sources = verifyAndRankSources(
    retrievedSnippets.map((s) => ({ uri: s.url, title: s.title })),
    company,
    officialRoot || baseWebsite
  );

  const summaryBlocks = retrievedSnippets.map(
    (s, i) => `[${i + 1}] ${s.title} (${s.url}) [${s.sourceType}]\n${s.snippet}`
  );

  return {
    rawSummaryText: summaryBlocks.join('\n\n---\n\n'),
    sources,
    searchQueries,
    retrievedSnippets,
    candidateWebsite:
      officialRoot ||
      normalizeCompanyRootWebsite(sources.find((s) => s.isOfficial)?.url) ||
      '',
  };
}

export class GeminiGoogleSearchAdapter implements SearchProviderAdapter {
  readonly name = 'gemini-google-search-grounding';
  private ai: GoogleGenAI;

  constructor(ai: GoogleGenAI) {
    this.ai = ai;
  }

  async searchCompany(input: SearchQueryInput): Promise<SearchProviderResult> {
    const preFetched = input.preFetchedSearch || (await fetchPublicCompanySnippets(input));
    const cleanUrl = normalizeHttpUrl(
      input.companyWebsite || preFetched.candidateWebsite || ''
    );

    const tools: Array<Record<string, unknown>> = [{ googleSearch: {} }];
    if (cleanUrl) {
      tools.push({ urlContext: {} });
    }

    const prompt = [
      `Research the employer "${input.companyName}"${cleanUrl ? ` (official website candidate: ${cleanUrl})` : ''}${input.jobLocation ? ` in/near ${input.jobLocation}` : ''}.`,
      input.jobTitle ? `Target role context: ${input.jobTitle}.` : '',
      preFetched.rawSummaryText
        ? `\nServer-retrieved public web snippets to cross-verify:\n${preFetched.rawSummaryText.slice(0, 7000)}\n`
        : '',
      'Using Google Search and verified public pages, gather ONLY verifiable factual information covering:',
      '- Official website URL',
      '- Headquarters city/state/country (only if explicitly confirmed)',
      '- Concise grounded company overview',
      '- Core focus areas / services / specialties',
      '- Industry, notable projects/portfolio, tech stack, mission/values, recent developments, careers/culture',
      '',
      'CRITICAL ANTI-FABRICATION RULES:',
      '- Only state facts supported by retrieved search results, official pages, or the job posting.',
      '- Do NOT guess or invent hiring managers, street addresses, employee counts, or unverified claims.',
      '- If an item cannot be verified from sources, explicitly state what is missing rather than guessing.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: { tools },
      });

      const metadata = response.candidates?.[0]?.groundingMetadata;
      const rawWebChunks = (metadata?.groundingChunks || [])
        .map((c) => c.web)
        .filter((w): w is { uri?: string; title?: string } => Boolean(w && w.uri));

      const mergedRawChunks = [
        ...preFetched.sources.map((s) => ({ uri: s.url, title: s.title })),
        ...rawWebChunks,
      ];

      const sources = verifyAndRankSources(
        mergedRawChunks,
        input.companyName,
        cleanUrl || input.companyWebsite
      );

      const combinedText = [
        response.text || '',
        preFetched.rawSummaryText ? `\n\nRETRIEVED PAGE SNIPPETS:\n${preFetched.rawSummaryText}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      return {
        rawSummaryText: combinedText,
        sources,
        searchQueries: Array.from(
          new Set([...preFetched.searchQueries, ...(metadata?.webSearchQueries || [])])
        ),
        retrievedSnippets: preFetched.retrievedSnippets,
        candidateWebsite: cleanUrl || preFetched.candidateWebsite,
      };
    } catch {
      // Fall back cleanly to deterministic server search/fetch snippets if search grounding errors
      return preFetched;
    }
  }
}

export async function analyzeCompanyIntelligence(
  ai: GoogleGenAI,
  input: SearchQueryInput,
  searchResult: SearchProviderResult
) {
  const nowIso = new Date().toISOString();
  const effectiveCompany = input.companyName.trim().slice(0, 200);

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: JSON.stringify({
      companyName: effectiveCompany,
      providedWebsite: input.companyWebsite || searchResult.candidateWebsite || '',
      jobTitle: input.jobTitle || '',
      jobLocation: input.jobLocation || '',
      sourceUrl: input.sourceUrl || '',
      jobDescription: input.jobDescription || '',
      retrievedSnippets: searchResult.retrievedSnippets.slice(0, 10),
      groundedSearchDossier: searchResult.rawSummaryText.slice(0, 12000),
      groundedSources: searchResult.sources,
    }),
    config: {
      systemInstruction: `You are a rigorous Company Intelligence Analyst converting retrieved public web snippets and the job posting into a structured Company Intelligence brief.

STRICT ANTI-FABRICATION RULES:
"Only state facts supported by the provided snippets or job posting. Do not guess or invent hiring managers, street addresses, employee counts, or claims. Set unknown fields to null and list any unverified or missing items in missingInfo."

ADDITIONAL PROVENANCE RULES:
1. Return structured top-level fields:
   - "companyName": resolved employer name ONLY if explicitly identified in the snippets, URL, or job posting (NOT a job board name like Lensa, Jooble, Indeed, or LinkedIn); return "" if no employer name can be reliably identified
   - "website": verified official employer domain URL string (e.g. "https://example.com") OR null if not verified. NEVER return a job aggregator/board domain (lensa.com, jooble.org, indeed.com, linkedin.com, ziprecruiter.com, glassdoor.com) as website.
   - "headquarters": verified HQ city/state/country OR null if not verified in snippets/posting
   - "overview": concise 2-3 sentence factual overview grounded ONLY in retrieved snippets / posting, OR null if insufficient evidence
   - "coreFocus": array of core services/focus areas grounded in snippets/posting
   - "missingInfo": array listing unverified or missing details (e.g., "Could not verify employer website or full company profile from the provided link/text.", "Official headquarters not verified in retrieved sources.", "Hiring manager name not disclosed.")
2. Every finding in "findings" MUST reference a real sourceUrl and sourceTitle from groundedSources (or mark sourceUrl as "" and confidence as "low" if only supported by the pasted jobDescription).
3. Record conflicting claims in "sourceConflicts" and "conflictNote".
4. Prioritize official_website and careers_page sources when setting confidence.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          companyName: { type: Type.STRING },
          website: { type: Type.STRING, nullable: true },
          headquarters: { type: Type.STRING, nullable: true },
          overview: { type: Type.STRING, nullable: true },
          coreFocus: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
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
        required: [
          'companyName',
          'website',
          'headquarters',
          'overview',
          'coreFocus',
          'missingInfo',
          'officialWebsite',
          'industry',
          'services',
          'description',
          'overallConfidence',
          'findings',
          'report',
        ],
      },
    },
  });

  const fallback = {
    companyName: effectiveCompany,
    website: normalizeCompanyRootWebsite(input.companyWebsite || searchResult.candidateWebsite) || null,
    headquarters: null as string | null,
    overview: searchResult.rawSummaryText ? searchResult.rawSummaryText.slice(0, 450) : null,
    coreFocus: [] as string[],
    missingInfo: ['Live verification could not confirm all company details.'],
    officialWebsite: input.companyWebsite || searchResult.candidateWebsite || '',
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
      companyOverview: searchResult.rawSummaryText.slice(0, 600) || 'No verified overview extracted.',
      servicesAndSpecialties: 'Not verified in retrieved sources.',
      industry: 'Not verified in retrieved sources.',
      projectsAndPortfolio: 'Not verified in retrieved sources.',
      technology: 'Not verified in retrieved sources.',
      missionAndValues: 'Not verified in retrieved sources.',
      recentDevelopments: 'Not verified in retrieved sources.',
      employeeExpectations: 'Not verified in retrieved sources.',
      relevantCompanyInformation: 'Not verified in retrieved sources.',
      applicationRecommendations: [],
      sourceConflicts: [],
    },
  };

  let parsed = fallback;
  try {
    const raw = (response.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    if (raw) parsed = { ...fallback, ...JSON.parse(raw) };
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
    const candidateUrl = normalizeHttpUrl(f.sourceUrl) || (f.sourceUrl || '').trim();
    const hasVerifiedUrl = candidateUrl.length > 0 && allowedUrlSet.has(candidateUrl);
    const safeUrl = hasVerifiedUrl ? candidateUrl : '';
    const matchedSource = safeUrl ? sourceLookup.get(safeUrl) : undefined;
    return {
      id: `fnd-${idx + 1}-${Date.now().toString(36)}`,
      category: normalizeCategory(f.category),
      extractedInfo: f.extractedInfo,
      sourceTitle: matchedSource?.title || (hasVerifiedUrl ? f.sourceTitle : 'Job Posting / Unattributed Note'),
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

  const verifiedWebsite =
    normalizeCompanyVerifiedUrl(parsed.website || undefined) ||
    normalizeCompanyVerifiedUrl(parsed.officialWebsite) ||
    normalizeCompanyVerifiedUrl(input.companyWebsite) ||
    normalizeCompanyVerifiedUrl(sources.find((s) => s.isOfficial)?.url) ||
    null;

  const coreFocus = Array.isArray(parsed.coreFocus)
    ? parsed.coreFocus.map((s) => String(s).trim()).filter(Boolean)
    : Array.isArray(parsed.services)
    ? parsed.services.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const missingInfo = Array.isArray(parsed.missingInfo)
    ? parsed.missingInfo.map((s) => String(s).trim()).filter(Boolean)
    : [];

  if (!verifiedWebsite && !missingInfo.some((m) => m.toLowerCase().includes('website'))) {
    missingInfo.push('Official company website was not verified in retrieved sources.');
  }
  if (!parsed.headquarters && !missingInfo.some((m) => m.toLowerCase().includes('headquarters'))) {
    missingInfo.push('Headquarters location was not verified in retrieved sources.');
  }

  const rawAiCompanyName = typeof parsed.companyName === 'string' ? parsed.companyName.trim() : '';
  const finalCompanyName = (
    (!isPlaceholderOrAggregatorNameServer(rawAiCompanyName) ? rawAiCompanyName : '') ||
    (!isPlaceholderOrAggregatorNameServer(effectiveCompany) ? effectiveCompany : '')
  )
    .trim()
    .slice(0, 200);

  if (!finalCompanyName && !missingInfo.some((m) => m.toLowerCase().includes('employer name'))) {
    missingInfo.unshift('Employer name could not be reliably identified from the provided fields, description, or link.');
  }

  return {
    companyName: finalCompanyName,
    website: verifiedWebsite,
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
    coreFocus,
    missingInfo,
    officialWebsite: verifiedWebsite || '',
    industry: parsed.industry || '',
    services:
      Array.isArray(parsed.services) && parsed.services.length > 0
        ? parsed.services
        : coreFocus,
    description:
      (typeof parsed.overview === 'string' && parsed.overview.trim()) ||
      parsed.description ||
      '',
    overallConfidence:
      sources.length === 0
        ? ('low' as ResearchConfidence)
        : normalizeConfidence(parsed.overallConfidence),
    searchQueries: searchResult.searchQueries,
    findings,
    sources,
    report: parsed.report,
  };
}

export function buildGracefulResearchFallback(
  input: SearchQueryInput,
  preFetched?: SearchProviderResult
) {
  const nowIso = new Date().toISOString();
  const safeName = !isPlaceholderOrAggregatorNameServer(input.companyName)
    ? input.companyName.trim().slice(0, 200)
    : '';
  const safeWebsite =
    normalizeCompanyVerifiedUrl(input.companyWebsite) ||
    normalizeCompanyVerifiedUrl(preFetched?.candidateWebsite) ||
    normalizeCompanyVerifiedUrl(preFetched?.sources?.find((s) => s.isOfficial)?.url) ||
    null;

  const sources = (preFetched?.sources || []).map((s, idx) => ({
    id: `src-fb-${idx + 1}-${Date.now().toString(36)}`,
    title: s.title,
    url: s.url,
    sourceType: s.sourceType,
    isOfficial: s.isOfficial,
    accessedAt: nowIso,
  }));

  const snippetFindings = (preFetched?.retrievedSnippets || [])
    .filter((s) => s.snippet && s.snippet.trim())
    .slice(0, 5)
    .map((s, idx) => ({
      id: `fnd-fb-${idx + 1}-${Date.now().toString(36)}`,
      category: 'Company Overview' as const,
      extractedInfo: s.snippet.trim().slice(0, 500),
      sourceTitle: s.title || s.url,
      sourceUrl: s.url,
      sourceType: s.sourceType,
      publicationDate: '',
      dateResearched: nowIso,
      confidence: (s.isOfficial ? 'medium' : 'low') as ResearchConfidence,
      verificationStatus: 'pending' as const,
      isAiInterpretation: false,
      conflictNote: '',
    }));

  const leadSnippetText =
    preFetched?.retrievedSnippets.find((s) => s.snippet && s.snippet.trim())?.snippet.trim() || '';
  const overview = leadSnippetText ? leadSnippetText.slice(0, 380) : null;

  const missingInfo: string[] = [];
  if (!safeName) {
    missingInfo.push(
      'Employer name could not be reliably identified from the provided fields, description, or link.'
    );
  }
  if (!safeWebsite || sources.length === 0) {
    missingInfo.push(
      'Could not verify employer website or full company profile from the provided link/text.'
    );
  }
  missingInfo.push('Headquarters location was not verified in retrieved sources.');

  const summaryMessage = overview
    ? overview
    : 'Not verified — insufficient public company details were retrieved from the provided fields or link.';

  return {
    companyName: safeName,
    website: safeWebsite,
    headquarters: null as string | null,
    overview,
    coreFocus: [] as string[],
    missingInfo,
    officialWebsite: safeWebsite || '',
    industry: '',
    services: [] as string[],
    description: overview || '',
    overallConfidence: 'low' as ResearchConfidence,
    searchQueries: preFetched?.searchQueries || [],
    findings: snippetFindings,
    sources,
    report: {
      companyOverview: summaryMessage,
      servicesAndSpecialties: 'Not verified in retrieved sources.',
      industry: 'Not verified in retrieved sources.',
      projectsAndPortfolio: 'Not verified in retrieved sources.',
      technology: 'Not verified in retrieved sources.',
      missionAndValues: 'Not verified in retrieved sources.',
      recentDevelopments: 'Not verified in retrieved sources.',
      employeeExpectations: 'Not verified in retrieved sources.',
      relevantCompanyInformation:
        'Add or verify Company Name, official company website, or fuller posting text to expand grounded company intelligence.',
      applicationRecommendations: [],
      sourceConflicts: [],
    },
    fromCache: false,
  };
}

// In-memory TTL cache to prevent duplicate searches and respect provider rate limits
const CACHE_TTL_MS = 30 * 60 * 1000;
const researchCache = new Map<
  string,
  { expiresAt: number; payload: Awaited<ReturnType<typeof analyzeCompanyIntelligence>> }
>();

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
    (input.sourceUrl || '').trim().toLowerCase(),
    !input.companyName.trim() ? (input.jobDescription || '').trim().slice(0, 120).toLowerCase() : '',
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

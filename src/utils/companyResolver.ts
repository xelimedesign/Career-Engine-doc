import { JobApplication } from '../types/career';

export interface CompanyResolutionResult {
  resolvedCompanyName: string;
  candidateWebsite: string;
  resolutionSource: 'company_field' | 'job_description' | 'job_title' | 'source_url' | 'none';
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
]);

export const ATS_BOARD_HOSTS = [
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

export function isPlaceholderOrAggregatorName(name?: string): boolean {
  const trimmed = (name || '').trim().toLowerCase();
  if (!trimmed) return true;
  return PLACEHOLDER_OR_AGGREGATOR_NAMES.has(trimmed);
}

export function extractHostnameClean(rawUrl?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProto).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

export function isJobBoardOrAggregatorUrl(rawUrl?: string): boolean {
  const host = extractHostnameClean(rawUrl);
  if (!host) return false;
  if (JOB_BOARD_AGGREGATOR_HOSTS.has(host)) return true;
  if (Array.from(JOB_BOARD_AGGREGATOR_HOSTS).some((h) => host.endsWith(`.${h}`))) return true;
  if (ATS_BOARD_HOSTS.some((ats) => host === ats || host.endsWith(`.${ats}`))) return true;
  return false;
}

function normalizeCompanyWebsiteUrl(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const candidate = `${parsed.protocol}//${parsed.hostname}`;
    if (isJobBoardOrAggregatorUrl(candidate)) return '';
    return candidate;
  } catch {
    return '';
  }
}

function cleanCompanyCandidate(raw: string): string {
  return raw
    .replace(/^["'“‘(\[]+|["'”’)\],.:;!?]+$/g, '')
    .replace(/\s+(?:is|are|was|were|has|have|offers|provides|seeks|looking|hiring|for|in|with|on|to)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function isValidCandidateName(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (trimmed.length < 2) return false;
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_OR_AGGREGATOR_NAMES.has(lower)) return false;
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
  return isValidCandidateName(formatted) ? formatted : '';
}

function extractFromJobBoardUrl(parsed: URL, depth = 0): { companyName: string; website: string } {
  if (depth > 2) return { companyName: '', website: '' };
  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const pathSegments = parsed.pathname.split('/').filter(Boolean);

  // 1. Inspect redirect / tracking / company query parameters first
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
      const nested = extractFromUrl(val.trim(), depth + 1);
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

  // 2. Host-specific path slugs
  if (host.includes('linkedin.com')) {
    if (pathSegments[0] === 'company' && pathSegments[1]) {
      return { companyName: formatBrandFromSlug(pathSegments[1]), website: '' };
    }
    const jobsAtMatch = parsed.pathname.match(/-at-([a-z0-9-]+?)(?:-\d+)?(?:\/|$)/i);
    if (jobsAtMatch && jobsAtMatch[1]) {
      return { companyName: formatBrandFromSlug(jobsAtMatch[1]), website: '' };
    }
  }

  if (host.includes('indeed.com')) {
    if (pathSegments[0] === 'cmp' && pathSegments[1]) {
      return { companyName: formatBrandFromSlug(pathSegments[1]), website: '' };
    }
  }

  if (host.includes('glassdoor.com')) {
    const workingAtMatch = parsed.pathname.match(/Working-at-([A-Za-z0-9-]+)-EI/i);
    if (workingAtMatch && workingAtMatch[1]) {
      return { companyName: formatBrandFromSlug(workingAtMatch[1]), website: '' };
    }
  }

  // Generic aggregator path slugs (Lensa, Jooble, ZipRecruiter, etc.):
  // e.g. /j/senior-engineer-at-example-group-city-state or /company/example-group or /employer/example
  const explicitDirMatch = parsed.pathname.match(
    /\/(?:company|companies|employer|employers|cmp|org|organizations?)\/([a-z0-9][a-z0-9\-_]{1,80})/i
  );
  if (explicitDirMatch && explicitDirMatch[1]) {
    const formatted = formatBrandFromSlug(explicitDirMatch[1]);
    if (formatted) return { companyName: formatted, website: '' };
  }

  // Match `-at-<company>` in slugs like `/senior-engineer-at-example-group/...` or `/job/...-at-example-12345`
  const slugAtMatch = parsed.pathname.match(/-at-([a-z0-9-]+?)(?:-\d{3,}|\/j\/|\/|$)/i);
  if (slugAtMatch && slugAtMatch[1]) {
    const cleanedSlug = slugAtMatch[1].replace(/-(?:[a-z]{2}|usa|us|remote)$/i, '');
    const formatted = formatBrandFromSlug(cleanedSlug);
    if (formatted) return { companyName: formatted, website: '' };
  }

  return { companyName: '', website: '' };
}

function extractFromUrl(rawUrl?: string, depth = 0): { companyName: string; website: string } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || depth > 2) return { companyName: '', website: '' };
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { companyName: '', website: '' };
    }
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    if (
      JOB_BOARD_AGGREGATOR_HOSTS.has(host) ||
      Array.from(JOB_BOARD_AGGREGATOR_HOSTS).some((h) => host.endsWith(`.${h}`))
    ) {
      // NEVER treat a job board / aggregator URL as candidate company website
      return extractFromJobBoardUrl(parsed, depth);
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

    // Genuine company-owned domain (including careers.company.com / jobs.company.com)
    const strippedHost = host.replace(/^(careers|jobs|apply|talent|work|join)\./i, '');
    const domainParts = strippedHost.split('.');
    if (domainParts.length >= 2) {
      const brandSlug = domainParts[0];
      if (brandSlug && brandSlug.length >= 2) {
        const companyName = formatBrandFromSlug(brandSlug);
        return {
          companyName,
          website: `${parsed.protocol}//${strippedHost}`,
        };
      }
    }
    return { companyName: '', website: '' };
  } catch {
    return { companyName: '', website: '' };
  }
}

function extractFromText(text: string): string {
  if (!text.trim()) return '';

  const patterns: RegExp[] = [
    // Explicit labels e.g. "Company: Example Group"
    /(?:^|\n)\s*(?:Company|Employer|Organization|Client|About the Company)\s*[:\-]\s*([A-Z0-9][A-Za-z0-9&.,'’\- ]{1,65})/im,
    // "About Example", "About Example Group", "Why Join Example", "Welcome to Example"
    /\b(?:About|Why Join|Join|Welcome to)\s+(?:us at\s+)?([A-Z][A-Za-z0-9&.'’\-]*(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]*|Inc\.?|LLC|Ltd\.?|Corp\.?|Group|Systems|Solutions|Technologies|Engineering)){0,3})\b/,
    // "At Example, we..." or "At Example Group, ..."
    /(?:^|\n|[.!?]\s+)At\s+([A-Z][A-Za-z0-9&.'’\-]+(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]+|Inc\.?|LLC|Corp\.?|Group)){0,3})\s*,/,
    // "<Company> is [currently/actively] seeking / hiring / looking for / a leading ..."
    /\b([A-Z][A-Za-z0-9&.'’\-]+(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]+|Inc\.?|LLC|Corp\.?|Group)){0,3})\s+(?:is\s+(?:currently\s+|actively\s+|now\s+)?(?:seeking|hiring|looking\s+for|recruiting|a\s+leading|an?\s+(?:global|national|international|premier|architecture|engineering|design|software|technology|consulting))|offers\s+competitive)\b/,
    // "Engineer at Example Group" / "at Example"
    /\bat\s+([A-Z][A-Za-z0-9&.'’\-]+(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]+|Inc\.?|LLC|Corp\.?|Group)){0,3})(?=\s*(?:[,.\-–|(\n]|$|\s+(?:in|we|you|for|to|as|where)))/,
    // Legal entity suffix anywhere
    /\b([A-Z][A-Za-z0-9&.'’\-]+(?:\s+[A-Z][A-Za-z0-9&.'’\-]+){0,3}\s+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|LLP|PLLC|Group))\b/,
    // EEO / Affirmative Action employer statement
    /\b([A-Z][A-Za-z0-9&.'’\-]+(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]+|Inc\.?|LLC|Ltd\.?|Corp\.?|Group)){0,3})\s+is\s+(?:proud\s+to\s+be\s+)?an?\s+(?:[Ee]qual\s+(?:[Ee]mployment\s+)?[Oo]pportunity|EEO|[Aa]ffirmative\s+[Aa]ction)\b/,
    // Copyright / footer sign-off
    /(?:©|Copyright\s*(?:©|\(c\))?)\s*(?:20\d{2}\s+)?([A-Z][A-Za-z0-9&.'’\-]+(?:\s+(?:[A-Z][A-Za-z0-9&.'’\-]+|Inc\.?|LLC|Ltd\.?|Corp\.?|Group)){0,3})\b/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = cleanCompanyCandidate(match[1]);
      if (isValidCandidateName(candidate)) {
        return candidate;
      }
    }
  }

  // Fallback: look for non-job-board domain mentions in description (e.g., example.com or www.example.com)
  const domainMatches = text.match(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]{2,}\.(?:com|org|io|co|net|ai|dev))\b/gi) || [];
  for (const rawDom of domainMatches) {
    if (isJobBoardOrAggregatorUrl(rawDom)) continue;
    const urlRes = extractFromUrl(rawDom);
    if (urlRes.companyName && isValidCandidateName(urlRes.companyName)) {
      return urlRes.companyName;
    }
  }

  // Fallback: repeated uppercase company acronyms (e.g., ACME mentioned 2+ times)
  const acronymCounts = new Map<string, number>();
  const acronymMatches = text.match(/\b[A-Z]{3,8}\b/g) || [];
  for (const token of acronymMatches) {
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
  if (topAcronym) {
    return topAcronym;
  }

  return '';
}

export function resolveCandidateCompany(
  job: Partial<Pick<JobApplication, 'company' | 'companyWebsite' | 'jobTitle' | 'jobDescription' | 'sourceUrl'>>
): CompanyResolutionResult {
  const existingWebsite = normalizeCompanyWebsiteUrl(job.companyWebsite);
  const urlInfo = extractFromUrl(job.sourceUrl || job.companyWebsite);
  const explicitCompany = (job.company || '').trim();

  if (
    explicitCompany &&
    !['new company', 'company', 'unknown', 'tbd', 'n/a', 'na'].includes(explicitCompany.toLowerCase())
  ) {
    return {
      resolvedCompanyName: explicitCompany.slice(0, 200),
      candidateWebsite: existingWebsite || normalizeCompanyWebsiteUrl(urlInfo.website),
      resolutionSource: 'company_field',
    };
  }

  const desc = job.jobDescription || '';
  const title = job.jobTitle || '';

  const fromDesc = extractFromText(desc);
  if (fromDesc) {
    return {
      resolvedCompanyName: fromDesc.slice(0, 200),
      candidateWebsite: existingWebsite || normalizeCompanyWebsiteUrl(urlInfo.website),
      resolutionSource: 'job_description',
    };
  }

  const fromTitle = extractFromText(title);
  if (fromTitle) {
    return {
      resolvedCompanyName: fromTitle.slice(0, 200),
      candidateWebsite: existingWebsite || normalizeCompanyWebsiteUrl(urlInfo.website),
      resolutionSource: 'job_title',
    };
  }

  if (urlInfo.companyName) {
    return {
      resolvedCompanyName: urlInfo.companyName.slice(0, 200),
      candidateWebsite: existingWebsite || normalizeCompanyWebsiteUrl(urlInfo.website),
      resolutionSource: 'source_url',
    };
  }

  return {
    resolvedCompanyName: '',
    candidateWebsite: existingWebsite || normalizeCompanyWebsiteUrl(urlInfo.website),
    resolutionSource: 'none',
  };
}

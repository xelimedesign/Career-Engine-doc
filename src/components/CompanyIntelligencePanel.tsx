import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import {
  CompanyProfile,
  CompanyResearch,
  FindingVerificationStatus,
  JobApplication,
  JobMatch,
  ResearchCategory,
  ResearchConfidence,
  SourceType,
} from '../types/career';
import {
  isJobBoardOrAggregatorUrl,
  isPlaceholderOrAggregatorName,
  resolveCandidateCompany,
} from '../utils/companyResolver';
import { toSafeHttpUrl } from '../utils/urlSafety';

interface CompanyIntelligencePanelProps {
  job: JobApplication;
  companyProfile?: CompanyProfile;
  research?: CompanyResearch;
  jobMatch?: JobMatch;
  researching: boolean;
  matching: boolean;
  researchError: string | null;
  matchError: string | null;
  onRunResearch: (forceRefresh: boolean) => void;
  onUpdateFindingStatus: (
    researchId: string,
    findingId: string,
    status: FindingVerificationStatus
  ) => void;
  onRunJobMatch: () => void;
  onOpenTailoredResume: () => void;
  onOpenTailoredCoverLetter: () => void;
}

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  official_website: 'Official Website',
  careers_page: 'Official Careers',
  news_press: 'News & Press',
  third_party: 'Third-Party Source',
};

const CONFIDENCE_LABELS: Record<ResearchConfidence, { text: string; cls: string }> = {
  high: { text: 'High Confidence', cls: 'text-emerald-800' },
  medium: { text: 'Medium Confidence', cls: 'text-amber-800' },
  low: { text: 'Low Confidence', cls: 'text-rose-800' },
};

const VERIFICATION_LABELS: Record<
  FindingVerificationStatus,
  { text: string; cls: string }
> = {
  pending: { text: 'Pending Review', cls: 'text-slate-600' },
  approved: { text: 'Approved', cls: 'text-emerald-800' },
  needs_verification: { text: 'Needs Verification', cls: 'text-amber-800' },
  dismissed: { text: 'Dismissed', cls: 'text-slate-400 line-through' },
};

const REPORT_FACT_SECTIONS: Array<{
  key: keyof Pick<
    CompanyResearch['report'],
    | 'companyOverview'
    | 'servicesAndSpecialties'
    | 'industry'
    | 'projectsAndPortfolio'
    | 'technology'
    | 'missionAndValues'
    | 'recentDevelopments'
    | 'employeeExpectations'
    | 'relevantCompanyInformation'
  >;
  title: string;
}> = [
  { key: 'companyOverview', title: 'Company Overview' },
  { key: 'servicesAndSpecialties', title: 'Services and Specialties' },
  { key: 'industry', title: 'Industry' },
  { key: 'projectsAndPortfolio', title: 'Projects and Portfolio' },
  { key: 'technology', title: 'Technology' },
  { key: 'missionAndValues', title: 'Mission and Values' },
  { key: 'recentDevelopments', title: 'Recent Developments' },
  { key: 'employeeExpectations', title: 'Employee Expectations' },
  { key: 'relevantCompanyInformation', title: 'Relevant Company Information' },
];

export function CompanyIntelligencePanel({
  job,
  companyProfile,
  research,
  jobMatch,
  researching,
  matching,
  researchError,
  matchError,
  onRunResearch,
  onUpdateFindingStatus,
  onRunJobMatch,
  onOpenTailoredResume,
  onOpenTailoredCoverLetter,
}: CompanyIntelligencePanelProps) {
  const [subTab, setSubTab] = useState<'report' | 'findings' | 'match'>('report');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ResearchCategory>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | FindingVerificationStatus>('All');

  const findingsCounts = useMemo(() => {
    const counts = {
      total: 0,
      approved: 0,
      pending: 0,
      needs_verification: 0,
      dismissed: 0,
    };
    if (!research) return counts;
    counts.total = research.findings.length;
    research.findings.forEach((f) => {
      counts[f.verificationStatus] += 1;
    });
    return counts;
  }, [research]);

  const categoriesPresent = useMemo(() => {
    if (!research) return [];
    return Array.from(new Set(research.findings.map((f) => f.category)));
  }, [research]);

  const filteredFindings = useMemo(() => {
    if (!research) return [];
    return research.findings.filter((f) => {
      const catOk = categoryFilter === 'All' || f.category === categoryFilter;
      const statusOk = statusFilter === 'All' || f.verificationStatus === statusFilter;
      return catOk && statusOk;
    });
  }, [research, categoryFilter, statusFilter]);

  const candidateResolution = useMemo(() => resolveCandidateCompany(job), [job]);
  const effectiveDisplayCompany =
    job.company.trim() && !isPlaceholderOrAggregatorName(job.company)
      ? job.company.trim()
      : candidateResolution.resolvedCompanyName ||
        (research?.companyName && !isPlaceholderOrAggregatorName(research.companyName)
          ? research.companyName
          : 'Target Employer');

  const effectiveWebsite =
    [
      research?.website,
      companyProfile?.officialWebsite,
      research?.companyWebsite,
      job.companyWebsite,
    ].find(
      (candidate) =>
        typeof candidate === 'string' &&
        candidate.trim() &&
        !isJobBoardOrAggregatorUrl(candidate)
    ) || '';

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Company Intelligence · {effectiveDisplayCompany}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
              <span>
                Status:{' '}
                <strong className="font-medium text-slate-800">
                  {researching
                    ? 'Researching public sources...'
                    : research?.status === 'completed'
                    ? 'Completed'
                    : research?.status === 'error'
                    ? 'Error'
                    : 'Not Researched'}
                </strong>
              </span>
              {research?.researchDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    Researched {new Date(research.researchDate).toLocaleDateString()}
                  </span>
                </>
              )}
              {research?.status === 'completed' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={CONFIDENCE_LABELS[research.overallConfidence].cls + ' font-medium'}>
                    {CONFIDENCE_LABELS[research.overallConfidence].text}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    {findingsCounts.approved}/{findingsCounts.total} Findings Approved
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={researching}
              onClick={() => onRunResearch(Boolean(research && research.status === 'completed'))}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer disabled:opacity-50"
            >
              {researching ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              {researching
                ? 'Researching...'
                : research?.status === 'completed'
                ? 'Refresh Research'
                : 'Research Company'}
            </button>

            <button
              type="button"
              disabled={matching || researching || !job.jobDescription.trim()}
              onClick={onRunJobMatch}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer disabled:opacity-50"
            >
              {matching ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Target className="w-3.5 h-3.5" />
              )}
              {matching ? 'Matching...' : 'Run 3-Way Job Match'}
            </button>
          </div>
        </div>

        {(researchError || matchError || (research?.status === 'error' && research.errorMessage)) && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{researchError || matchError || research?.errorMessage}</div>
          </div>
        )}

        {/* Company Profile Snapshot */}
        {(companyProfile || effectiveWebsite) && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-[11px] font-medium text-slate-500">Official Website</div>
              {toSafeHttpUrl(effectiveWebsite) ? (
                <a
                  href={toSafeHttpUrl(effectiveWebsite)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-slate-900 font-medium hover:underline mt-0.5 break-all"
                >
                  <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{effectiveWebsite}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                </a>
              ) : (
                <div className="text-slate-500 mt-0.5">Not verified yet</div>
              )}
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Industry</div>
              <div className="text-slate-900 font-medium mt-0.5">
                {companyProfile?.industry || research?.report.industry || '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Core Services</div>
              <div className="text-slate-700 mt-0.5">
                {companyProfile?.services.length
                  ? companyProfile.services.join(' · ')
                  : 'See report below'}
              </div>
            </div>
          </div>
        )}

        {/* Sub-tab Switcher */}
        {(research?.status === 'completed' || jobMatch) && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
            <button
              type="button"
              onClick={() => setSubTab('report')}
              className={`flex-1 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors ${
                subTab === 'report'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Intelligence Report
            </button>
            <button
              type="button"
              onClick={() => setSubTab('findings')}
              className={`flex-1 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors font-mono-tabular ${
                subTab === 'findings'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Findings &amp; Sources ({findingsCounts.total})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('match')}
              className={`flex-1 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors ${
                subTab === 'match'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3-Way Job Match {jobMatch ? '· Ready' : ''}
            </button>
          </div>
        )}
      </div>

      {/* Active Loading State */}
      {researching && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 flex items-start gap-3">
          <RefreshCw className="w-5 h-5 text-slate-700 animate-spin shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">
              Researching {effectiveDisplayCompany} from public web sources...
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Retrieving official company pages, overview, headquarters, focus areas, and verifiable source links while strictly excluding unverified claims.
            </p>
          </div>
        </div>
      )}

      {/* Empty State before research */}
      {!researching && (!research || research.status !== 'completed') && !jobMatch && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-2.5">
          <Search className="w-6 h-6 text-slate-400 mx-auto" />
          <div className="text-sm font-semibold text-slate-900">
            Run Grounded Company Research
          </div>
          <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
            Retrieves public company pages, overview, headquarters, focus areas, and role context—even if Company Name is blank and only the job posting mentions the employer. Unverified facts are set to missing instead of guessed.
          </p>
        </div>
      )}

      {/* TAB 1: Company Intelligence Report */}
      {subTab === 'report' && research?.status === 'completed' && (
        <div className="space-y-5">
          {/* Structured Grounded Intelligence Brief */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {research.companyName} — Grounded Research Brief
                </h4>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    HQ: {research.headquarters || 'Not verified'}
                  </span>
                  {toSafeHttpUrl(effectiveWebsite) ? (
                    <a
                      href={toSafeHttpUrl(effectiveWebsite)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-slate-800 hover:underline font-medium"
                    >
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      <span>{effectiveWebsite}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  ) : (
                    <span className="text-slate-500">Website: Not verified</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {research.autofilledFields?.company && (
                  <span className="px-2 py-0.5 text-[11px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-800 rounded">
                    Company Name Auto-Filled
                  </span>
                )}
                {research.autofilledFields?.companyWebsite && (
                  <span className="px-2 py-0.5 text-[11px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-800 rounded">
                    Website Auto-Filled
                  </span>
                )}
              </div>
            </div>

            {research.overview && (
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {research.overview}
              </p>
            )}

            {(research.coreFocus?.length || 0) > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Core Focus
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {research.coreFocus!.map((focus, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded"
                    >
                      {focus}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(research.missingInfo?.length || 0) > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                <div className="text-[11px] font-semibold text-slate-700">
                  Unverified or Missing Details (Not Fabricated)
                </div>
                <ul className="list-disc pl-4 text-xs text-slate-600 space-y-0.5">
                  {research.missingInfo!.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Source Conflicts Warning */}
          {research.report.sourceConflicts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                Source Disagreements Detected ({research.report.sourceConflicts.length})
              </div>
              <ul className="list-disc pl-5 text-xs text-amber-900 space-y-1">
                {research.report.sourceConflicts.map((conflict, idx) => (
                  <li key={idx}>{conflict}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Verified Fact Sections */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Company Research Report
                </h4>
                <p className="text-[11px] text-slate-500">
                  Automated research synthesis — verify company facts against the cited sources in Findings &amp; Sources before citing them in applications.
                </p>
              </div>
              <span className="text-[11px] font-medium text-slate-600">
                Fact-Grounded Report
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {REPORT_FACT_SECTIONS.map((sec) => (
                <div
                  key={sec.key}
                  className={`p-3.5 bg-slate-50/60 border border-slate-200 rounded-md space-y-1 ${
                    sec.key === 'companyOverview' || sec.key === 'relevantCompanyInformation'
                      ? 'md:col-span-2'
                      : ''
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-900">{sec.title}</div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {research.report[sec.key] || 'Not confirmed in retrieved sources.'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* AI Recommendations (Clearly Separated from Verified Facts) */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-slate-600" />
                <h4 className="text-sm font-semibold text-slate-900">
                  Application Recommendations
                </h4>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                AI Interpretation · Advisory Only
              </span>
            </div>
            {research.report.applicationRecommendations.length === 0 ? (
              <p className="text-xs text-slate-500">No application recommendations generated.</p>
            ) : (
              <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1.5 leading-relaxed">
                {research.report.applicationRecommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Sources List */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-semibold text-slate-900">
                Retrieved Sources ({research.sources.length})
              </h4>
              <span className="text-[11px] text-slate-500">
                Official sources prioritized
              </span>
            </div>

            {research.sources.length === 0 ? (
              <p className="text-xs text-slate-500">No source URLs were returned.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {research.sources.map((src) => (
                  <div
                    key={src.id}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      {toSafeHttpUrl(src.url) ? (
                        <a
                          href={toSafeHttpUrl(src.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:underline break-all"
                        >
                          <span>{src.title || src.url}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                        </a>
                      ) : (
                        <span className="font-medium text-slate-700 break-all">
                          {src.title || src.url}
                        </span>
                      )}
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                        <span className={src.isOfficial ? 'font-semibold text-emerald-800' : ''}>
                          {SOURCE_TYPE_LABELS[src.sourceType]}
                        </span>
                        {src.publicationDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">Published {src.publicationDate}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-md">{src.url}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {research.searchQueries.length > 0 && (
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                Search queries: {research.searchQueries.join(' · ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Findings & Verification */}
      {subTab === 'findings' && research?.status === 'completed' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Verified Facts &amp; Findings Review
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Approve, flag for verification, or dismiss individual findings. Dismissed findings are excluded from resume and cover letter generation.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                aria-label="Filter findings by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'All' | ResearchCategory)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
              >
                <option value="All">All Categories</option>
                {categoriesPresent.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter findings by status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'All' | FindingVerificationStatus)
                }
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
              >
                <option value="All">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="needs_verification">Needs Verification</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>

          {filteredFindings.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No findings match the selected filters.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredFindings.map((finding) => {
                const conf = CONFIDENCE_LABELS[finding.confidence];
                const ver = VERIFICATION_LABELS[finding.verificationStatus];
                return (
                  <div
                    key={finding.id}
                    className={`p-4 border rounded-md space-y-2.5 ${
                      finding.verificationStatus === 'dismissed'
                        ? 'border-slate-200 bg-slate-50/50 opacity-70'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex flex-wrap items-center gap-x-2 text-slate-500">
                        <span className="font-mono-tabular text-slate-400">{finding.id}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-slate-800">{finding.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className={conf.cls + ' font-medium'}>{conf.text}</span>
                        <span aria-hidden="true">·</span>
                        <span className={ver.cls + ' font-medium'}>{ver.text}</span>
                        {finding.isAiInterpretation && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-slate-600 font-medium">AI Interpretation</span>
                          </>
                        )}
                      </div>
                      <span className="font-mono-tabular text-slate-400">
                        Researched {new Date(finding.dateResearched).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 leading-relaxed">
                      {finding.extractedInfo}
                    </p>

                    {finding.conflictNote && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <span>{finding.conflictNote}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 min-w-0">
                        {toSafeHttpUrl(finding.sourceUrl) ? (
                          <a
                            href={toSafeHttpUrl(finding.sourceUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline font-medium truncate max-w-sm"
                          >
                            <span>{finding.sourceTitle || finding.sourceUrl}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <span>{finding.sourceTitle || 'Unlinked / Synthesis Note'}</span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>{SOURCE_TYPE_LABELS[finding.sourceType]}</span>
                        {finding.publicationDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">Pub: {finding.publicationDate}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateFindingStatus(research.id, finding.id, 'approved')
                          }
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border cursor-pointer ${
                            finding.verificationStatus === 'approved'
                              ? 'bg-emerald-900 text-white border-emerald-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-700'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateFindingStatus(research.id, finding.id, 'needs_verification')
                          }
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border cursor-pointer ${
                            finding.verificationStatus === 'needs_verification'
                              ? 'bg-amber-800 text-white border-amber-800'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-amber-700'
                          }`}
                        >
                          <HelpCircle className="w-3 h-3" />
                          Needs Verification
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateFindingStatus(research.id, finding.id, 'dismissed')
                          }
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border cursor-pointer ${
                            finding.verificationStatus === 'dismissed'
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-rose-700'
                          }`}
                        >
                          <XCircle className="w-3 h-3" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 3-Way Job Match */}
      {subTab === 'match' && (
        <div className="space-y-5">
          {!jobMatch ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-3">
              <Target className="w-6 h-6 text-slate-400 mx-auto" />
              <div className="text-sm font-semibold text-slate-900">
                3-Way Job Matching Engine
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Compares Company Intelligence, the Job Description, and your verified Career Profile to identify strong matches, gaps, resume emphasis order, and factual cover letter talking points.
              </p>
              <button
                type="button"
                disabled={matching || !job.jobDescription.trim()}
                onClick={onRunJobMatch}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer disabled:opacity-50"
              >
                <Target className="w-3.5 h-3.5" />
                {matching ? 'Running 3-Way Match...' : 'Run 3-Way Job Match'}
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      3-Way Match Report
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono-tabular">
                      Matched {new Date(jobMatch.matchedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenTailoredResume}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Tailor Resume with Intelligence
                    </button>
                    <button
                      type="button"
                      onClick={onOpenTailoredCoverLetter}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Create Company-Tailored Cover Letter
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 border border-emerald-200 bg-emerald-50/40 rounded-md space-y-1.5">
                    <div className="font-semibold text-emerald-900">
                      Strong Matches ({jobMatch.strongMatches.length})
                    </div>
                    <ul className="list-disc pl-4 text-slate-700 space-y-1">
                      {jobMatch.strongMatches.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 border border-amber-200 bg-amber-50/40 rounded-md space-y-1.5">
                    <div className="font-semibold text-amber-900">
                      Partial Matches ({jobMatch.partialMatches.length})
                    </div>
                    <ul className="list-disc pl-4 text-slate-700 space-y-1">
                      {jobMatch.partialMatches.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 border border-rose-200 bg-rose-50/40 rounded-md space-y-1.5">
                    <div className="font-semibold text-rose-900">
                      Missing Qualifications ({jobMatch.missingQualifications.length})
                    </div>
                    <ul className="list-disc pl-4 text-slate-700 space-y-1">
                      {jobMatch.missingQualifications.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {jobMatch.relevantAchievements.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="font-semibold text-slate-900">
                      Most Relevant Verified Achievements
                    </div>
                    <ul className="list-disc pl-5 text-slate-700 space-y-1">
                      {jobMatch.relevantAchievements.map((ach, i) => (
                        <li key={i}>{ach}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Resume & Cover Letter Guidance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
                  <div className="font-semibold text-slate-900">
                    Recommended Resume Emphasis
                  </div>
                  {jobMatch.recommendedResumeEmphasis.experienceToEmphasize.length > 0 && (
                    <div>
                      <div className="font-medium text-slate-600 mb-1">
                        Experience to Emphasize
                      </div>
                      <ul className="list-disc pl-4 text-slate-700 space-y-1">
                        {jobMatch.recommendedResumeEmphasis.experienceToEmphasize.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {jobMatch.recommendedResumeEmphasis.skillsToPrioritize.length > 0 && (
                    <div>
                      <div className="font-medium text-slate-600 mb-1">Skills to Prioritize</div>
                      <p className="text-slate-700">
                        {jobMatch.recommendedResumeEmphasis.skillsToPrioritize.join(' · ')}
                      </p>
                    </div>
                  )}
                  {jobMatch.recommendedResumeEmphasis.suggestedSectionOrder.length > 0 && (
                    <div>
                      <div className="font-medium text-slate-600 mb-1">
                        Suggested Section Order
                      </div>
                      <p className="text-slate-700 capitalize">
                        {jobMatch.recommendedResumeEmphasis.suggestedSectionOrder.join(' → ')}
                      </p>
                    </div>
                  )}
                  {jobMatch.recommendedResumeEmphasis.descriptionImprovements.length > 0 && (
                    <div>
                      <div className="font-medium text-slate-600 mb-1">
                        Description Improvements
                      </div>
                      <ul className="list-disc pl-4 text-slate-700 space-y-1">
                        {jobMatch.recommendedResumeEmphasis.descriptionImprovements.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
                  <div className="font-semibold text-slate-900">
                    Recommended Cover Letter Talking Points
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Factual intersections between your Career Profile and verified company facts:
                  </p>
                  <ul className="list-disc pl-4 text-slate-700 space-y-1.5 leading-relaxed">
                    {jobMatch.recommendedCoverLetterTalkingPoints.map((tp, i) => (
                      <li key={i}>{tp}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

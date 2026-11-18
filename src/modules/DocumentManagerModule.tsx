import { useState } from 'react';
import {
  Building2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCareer } from '../store/CareerContext';
import { exportResumeToDocx, exportResumeToPdf } from '../services/resumeExport';
import { exportCoverLetterToDocx, exportCoverLetterToPdf } from '../services/coverLetterExport';
import { CompanyResearch } from '../types/career';

function downloadCompanyReportText(research: CompanyResearch) {
  const lines = [
    `COMPANY INTELLIGENCE REPORT: ${research.companyName}`,
    `Official Website: ${research.companyWebsite || 'Not specified'}`,
    `Researched: ${new Date(research.researchDate).toLocaleString()}`,
    `Overall Confidence: ${research.overallConfidence.toUpperCase()}`,
    '',
    '1. COMPANY OVERVIEW',
    research.report.companyOverview,
    '',
    '2. SERVICES AND SPECIALTIES',
    research.report.servicesAndSpecialties,
    '',
    '3. INDUSTRY',
    research.report.industry,
    '',
    '4. PROJECTS AND PORTFOLIO',
    research.report.projectsAndPortfolio,
    '',
    '5. TECHNOLOGY',
    research.report.technology,
    '',
    '6. MISSION AND VALUES',
    research.report.missionAndValues,
    '',
    '7. RECENT DEVELOPMENTS',
    research.report.recentDevelopments,
    '',
    '8. EMPLOYEE EXPECTATIONS',
    research.report.employeeExpectations,
    '',
    '9. RELEVANT COMPANY INFORMATION',
    research.report.relevantCompanyInformation,
    '',
    '10. APPLICATION RECOMMENDATIONS (AI INTERPRETATION)',
    ...research.report.applicationRecommendations.map((r, i) => `${i + 1}. ${r}`),
    '',
    'SOURCES',
    ...research.sources.map((s) => `- ${s.title} (${s.sourceType}): ${s.url}`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${research.companyName.replace(/[^a-z0-9]+/gi, '_')}_Company_Intelligence.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DocumentManagerModule() {
  const {
    resumes,
    coverLetters,
    jobs,
    companyResearches,
    setActiveResumeId,
    setActiveCoverLetterId,
    setSelectedJobId,
    setActiveModule,
    createResume,
    createCoverLetter,
    duplicateResume,
    duplicateCoverLetter,
    deleteResume,
    deleteCoverLetter,
    applicationReviews,
    openReviewCenter,
  } = useCareer();

  const [filterType, setFilterType] = useState<'all' | 'resume' | 'cover-letter' | 'research'>(
    'all'
  );
  const [query, setQuery] = useState('');

  const completedResearches = companyResearches.filter((r) => r.status === 'completed');

  const items = [
    ...resumes.map((r) => ({
      kind: 'resume' as const,
      id: r.id,
      title: r.name,
      subtitle: `Resume · ${r.template}`,
      versionLabel: r.isMaster ? 'Master' : `v${r.version}`,
      linkedJobId: r.linkedJobId,
      updatedAt: r.updatedAt,
      rawResume: r,
    })),
    ...coverLetters.map((c) => ({
      kind: 'cover-letter' as const,
      id: c.id,
      title: c.title,
      subtitle: `Cover Letter · ${c.template}`,
      versionLabel: `v${c.version}`,
      linkedJobId: c.linkedJobId,
      updatedAt: c.updatedAt,
      rawLetter: c,
    })),
    ...completedResearches.map((res) => ({
      kind: 'research' as const,
      id: res.id,
      title: `${res.companyName} — Company Intelligence`,
      subtitle: `Research Report · ${res.overallConfidence} confidence`,
      versionLabel: `${res.findings.filter((f) => f.verificationStatus === 'approved').length}/${res.findings.length} approved`,
      linkedJobId: res.jobApplicationId,
      updatedAt: res.researchDate,
      rawResearch: res,
    })),
  ]
    .filter((item) => (filterType === 'all' ? true : item.kind === filterType))
    .filter((item) => item.title.toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Document Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            All saved resumes, cover letters, and company intelligence reports with version tracking, job links, and exports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              createResume({ fromProfile: true });
              setActiveModule('resumes');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Resume
          </button>
          <button
            type="button"
            onClick={() => {
              createCoverLetter({ prefillFromProfile: true });
              setActiveModule('cover-letters');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Cover Letter
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-md">
          {(
            [
              {
                id: 'all',
                label: `All (${resumes.length + coverLetters.length + completedResearches.length})`,
              },
              { id: 'resume', label: `Resumes (${resumes.length})` },
              { id: 'cover-letter', label: `Cover Letters (${coverLetters.length})` },
              { id: 'research', label: `Company Reports (${completedResearches.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                filterType === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter documents..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-slate-900"
          />
        </div>
      </div>

      {/* Document Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Document</th>
                <th className="py-3 px-4">Type &amp; Details</th>
                <th className="py-3 px-4">Linked Job</th>
                <th className="py-3 px-4">Version / Status</th>
                <th className="py-3 px-4">Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {items.map((item) => {
                const job = item.linkedJobId
                  ? jobs.find((j) => j.id === item.linkedJobId)
                  : undefined;

                const openItem = () => {
                  if (item.kind === 'resume') {
                    setActiveResumeId(item.id);
                    setActiveModule('resumes');
                  } else if (item.kind === 'cover-letter') {
                    setActiveCoverLetterId(item.id);
                    setActiveModule('cover-letters');
                  } else if (item.linkedJobId) {
                    setSelectedJobId(item.linkedJobId);
                    setActiveModule('jobs');
                  }
                };

                const latestReview =
                  item.kind === 'resume'
                    ? applicationReviews.find((r) => r.resumeId === item.id)
                    : item.kind === 'cover-letter'
                      ? applicationReviews.find((r) => r.coverLetterId === item.id)
                      : undefined;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={openItem}
                        className="inline-flex items-center gap-2 hover:underline text-left cursor-pointer"
                      >
                        {item.kind === 'resume' ? (
                          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        ) : item.kind === 'cover-letter' ? (
                          <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <span>{item.title}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-600 capitalize">{item.subtitle}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {job ? `${job.company} — ${job.jobTitle}` : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-600">
                      <span>{item.versionLabel}</span>
                      {latestReview && (
                        <span className="ml-2 text-emerald-800 font-semibold">
                          · Review {latestReview.scores.overallScore}/100
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-500">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={openItem}
                          title="Open"
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        {item.kind === 'research' ? (
                          <button
                            type="button"
                            onClick={() => downloadCompanyReportText(item.rawResearch)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            TXT
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                openReviewCenter({
                                  resumeId: item.kind === 'resume' ? item.id : undefined,
                                  coverLetterId: item.kind === 'cover-letter' ? item.id : undefined,
                                  jobId: item.linkedJobId,
                                  scope:
                                    item.kind === 'resume'
                                      ? item.linkedJobId
                                        ? 'full_application'
                                        : 'resume_only'
                                      : 'cover_letter_only',
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded cursor-pointer"
                            >
                              <ShieldCheck className="w-3 h-3 text-emerald-700" />
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                item.kind === 'resume'
                                  ? duplicateResume(item.id)
                                  : duplicateCoverLetter(item.id)
                              }
                              title="Duplicate"
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                item.kind === 'resume'
                                  ? exportResumeToDocx(item.rawResume)
                                  : exportCoverLetterToDocx(item.rawLetter)
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              DOCX
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                item.kind === 'resume'
                                  ? exportResumeToPdf(item.rawResume)
                                  : exportCoverLetterToPdf(item.rawLetter)
                              }
                              className="px-2 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              PDF
                            </button>
                            <button
                              type="button"
                              disabled={
                                item.kind === 'resume'
                                  ? resumes.length <= 1
                                  : coverLetters.length <= 1
                              }
                              onClick={() =>
                                item.kind === 'resume'
                                  ? deleteResume(item.id)
                                  : deleteCoverLetter(item.id)
                              }
                              title="Delete"
                              className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No documents match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

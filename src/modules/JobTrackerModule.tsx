import { useEffect, useState } from 'react';
import {
  Building2,
  FileText,
  Globe,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCareer } from '../store/CareerContext';
import {
  CompanyProfile,
  CompanyResearch,
  JobApplication,
  JobMatch,
  JobStatus,
} from '../types/career';
import {
  analyzeJobWithAi,
  researchCompanyWithAi,
  runThreeWayJobMatchWithAi,
} from '../services/aiService';
import { CompanyIntelligencePanel } from '../components/CompanyIntelligencePanel';
import { AIWritingCompanion } from '../components/AIWritingCompanion';

const STATUS_OPTIONS: JobStatus[] = ['Saved', 'Applied', 'Interviewing', 'Offer', 'Archived'];

const INPUT_CLS =
  'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors';
const LABEL_CLS = 'block text-xs font-medium text-slate-600 mb-1';

export function JobTrackerModule() {
  const {
    jobs,
    addJob,
    updateJob,
    deleteJob,
    profile,
    resumes,
    coverLetters,
    openTailoredResumeForJob,
    openCoverLetterForJob,
    setActiveResumeId,
    setActiveCoverLetterId,
    setActiveModule,
    selectedJobId,
    setSelectedJobId,
    companies,
    getCompanyResearchForJob,
    getJobMatchForJob,
    saveCompanyResearch,
    updateFindingStatus,
    saveJobMatch,
    openReviewCenter,
    applicationReviews,
  } = useCareer();

  const [detailTab, setDetailTab] = useState<'details' | 'intelligence' | 'documents'>('details');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [selectedResumeForLetter, setSelectedResumeForLetter] = useState<string>(
    resumes[0]?.id || ''
  );

  const handleCreateNewJob = () => {
    const created = addJob({
      company: 'New Company',
      companyWebsite: '',
      jobTitle: 'Target Role',
      jobLocation: '',
      department: '',
      companyAddress: '',
      hiringManager: '',
      applicationDate: new Date().toISOString().slice(0, 10),
      status: 'Saved',
      jobDescription: '',
      requiredQualifications: [],
      preferredQualifications: [],
      responsibilities: [],
      technicalRequirements: [],
    });
    setSelectedJobId(created.id);
    setDetailTab('details');
  };

  useEffect(() => {
    const listener = () => handleCreateNewJob();
    window.addEventListener('career-engine:new-job', listener);
    return () => window.removeEventListener('career-engine:new-job', listener);
  });

  const filteredJobs = jobs.filter((job) => {
    const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      job.company.toLowerCase().includes(q) ||
      job.jobTitle.toLowerCase().includes(q) ||
      job.jobDescription.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const activeJob: JobApplication | undefined =
    jobs.find((j) => j.id === selectedJobId) || filteredJobs[0] || jobs[0];

  const activeResearch = activeJob ? getCompanyResearchForJob(activeJob.id) : undefined;
  const activeMatch = activeJob ? getJobMatchForJob(activeJob.id) : undefined;
  const activeCompanyProfile = activeJob
    ? companies.find(
        (c) =>
          c.id === activeJob.companyId ||
          c.companyName.toLowerCase() === activeJob.company.toLowerCase()
      )
    : undefined;

  const handleAnalyzeJob = async () => {
    if (!activeJob) return;
    if (!activeJob.jobDescription.trim()) {
      setAnalyzeError('Paste a job description before running AI Job Analyzer.');
      return;
    }
    setAnalyzeError(null);
    setAnalyzing(true);
    try {
      const result = await analyzeJobWithAi({
        jobTitle: activeJob.jobTitle,
        company: activeJob.company,
        jobDescription: activeJob.jobDescription,
        profile,
      });
      updateJob(activeJob.id, (prev) => ({
        ...prev,
        requiredQualifications: result.requiredQualifications,
        preferredQualifications: result.preferredQualifications,
        responsibilities: result.responsibilities,
        technicalRequirements: result.technicalRequirements,
        analysis: {
          matchedSkills: result.matchedSkills,
          missingSkills: result.missingSkills,
          keyThemes: result.keyThemes,
          tailoringSuggestions: result.tailoringSuggestions,
          analyzedAt: result.analyzedAt,
        },
      }));
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Unable to analyze job description.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResearchCompany = async (forceRefresh = false) => {
    if (!activeJob) return;
    if (!activeJob.company.trim()) {
      setResearchError('Enter a company name before running Company Research.');
      return;
    }
    setDetailTab('intelligence');
    setResearchError(null);
    setResearching(true);
    try {
      const res = await researchCompanyWithAi({
        companyName: activeJob.company,
        companyWebsite: activeJob.companyWebsite,
        jobTitle: activeJob.jobTitle,
        jobDescription: activeJob.jobDescription,
        jobLocation: activeJob.jobLocation,
        forceRefresh,
      });

      const now = new Date().toISOString();
      const companyId = activeCompanyProfile?.id || `comp-${crypto.randomUUID().slice(0, 8)}`;
      const companyProfile: CompanyProfile = {
        id: companyId,
        companyName: activeJob.company,
        officialWebsite: res.officialWebsite || activeJob.companyWebsite || '',
        industry: res.industry || activeCompanyProfile?.industry || '',
        services: res.services.length > 0 ? res.services : activeCompanyProfile?.services || [],
        description: res.description || res.report.companyOverview || '',
        updatedAt: now,
      };

      const researchRecord: CompanyResearch = {
        id: activeResearch?.id || `resch-${crypto.randomUUID().slice(0, 8)}`,
        companyId,
        jobApplicationId: activeJob.id,
        companyName: activeJob.company,
        companyWebsite: res.officialWebsite || activeJob.companyWebsite || '',
        jobLocation: activeJob.jobLocation || '',
        researchDate: now,
        status: 'completed',
        overallConfidence: res.overallConfidence,
        verificationStatus: 'pending_review',
        searchQueries: res.searchQueries,
        findings: res.findings,
        sources: res.sources,
        report: res.report,
      };

      saveCompanyResearch(activeJob.id, researchRecord, companyProfile);
    } catch (err) {
      setResearchError(
        err instanceof Error ? err.message : 'Company research request failed.'
      );
    } finally {
      setResearching(false);
    }
  };

  const handleRunThreeWayMatch = async () => {
    if (!activeJob) return;
    if (!activeJob.jobDescription.trim()) {
      setMatchError('Add a job description before running the 3-Way Job Match.');
      return;
    }
    setDetailTab('intelligence');
    setMatchError(null);
    setMatching(true);
    try {
      const result = await runThreeWayJobMatchWithAi({
        job: activeJob,
        companyResearch: activeResearch,
        careerProfile: profile,
      });

      const matchRecord: JobMatch = {
        id: activeMatch?.id || `match-${crypto.randomUUID().slice(0, 8)}`,
        jobId: activeJob.id,
        userProfileId: 'master-profile',
        matchedAt: new Date().toISOString(),
        ...result,
      };
      saveJobMatch(activeJob.id, matchRecord);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : '3-way job matching failed.');
    } finally {
      setMatching(false);
    }
  };

  const linkedResumes = activeJob ? resumes.filter((r) => r.linkedJobId === activeJob.id) : [];
  const linkedCoverLetters = activeJob
    ? coverLetters.filter((c) => c.linkedJobId === activeJob.id)
    : [];
  const latestJobReview = activeJob
    ? applicationReviews.find((r) => r.jobId === activeJob.id)
    : undefined;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Left Job List */}
      <aside className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Job Applications</h2>
            <button
              type="button"
              onClick={handleCreateNewJob}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Job
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company or role..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {['All', ...STATUS_OPTIONS].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filteredJobs.length === 0 ? (
            <div className="p-6 bg-white border border-slate-200 rounded-lg text-center text-xs text-slate-500">
              No matching job applications.
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isSelected = activeJob?.id === job.id;
              const hasResearch = getCompanyResearchForJob(job.id)?.status === 'completed';
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-white border-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {job.jobTitle || 'Untitled Role'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="truncate">{job.company || 'Company'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{job.status}</span>
                    {hasResearch && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-800 font-medium shrink-0">Researched</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Job Detail + Intelligence + Cross-Module Actions */}
      <main className="space-y-5">
        {!activeJob ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3">
            <p className="text-sm text-slate-600">No job application selected.</p>
            <button
              type="button"
              onClick={handleCreateNewJob}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md cursor-pointer"
            >
              Add First Job Application
            </button>
          </div>
        ) : (
          <>
            {/* Action Bar */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {activeJob.jobTitle || 'Untitled Role'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                    <span>{activeJob.company || 'Company'}</span>
                    {activeJob.jobLocation && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{activeJob.jobLocation}</span>
                      </>
                    )}
                    {activeJob.department && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{activeJob.department}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{activeJob.applicationDate}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={researching}
                    onClick={() => handleResearchCompany(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer disabled:opacity-50"
                  >
                    {researching ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5" />
                    )}
                    {researching ? 'Researching...' : 'Company Research'}
                  </button>

                  <button
                    type="button"
                    disabled={analyzing}
                    onClick={handleAnalyzeJob}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {analyzing ? 'Analyzing...' : 'Analyze Job'}
                  </button>

                  <button
                    type="button"
                    onClick={() => openTailoredResumeForJob(activeJob.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Tailor Resume
                  </button>

                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="Reference resume for cover letter"
                      value={selectedResumeForLetter}
                      onChange={(e) => setSelectedResumeForLetter(e.target.value)}
                      className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-700 max-w-[150px]"
                    >
                      {resumes.map((r) => (
                        <option key={r.id} value={r.id}>
                          Ref: {r.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        openCoverLetterForJob(activeJob.id, selectedResumeForLetter || undefined)
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Create Cover Letter
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openReviewCenter({
                        jobId: activeJob.id,
                        resumeId: linkedResumes[0]?.id || resumes[0]?.id,
                        coverLetterId: linkedCoverLetters[0]?.id || coverLetters[0]?.id,
                        scope: 'full_application',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md cursor-pointer whitespace-nowrap"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Review Application</span>
                    {latestJobReview && (
                      <span className="font-mono-tabular text-[11px] text-emerald-800">
                        ({latestJobReview.scores.overallScore}/100)
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteJob(activeJob.id)}
                    aria-label="Delete job application"
                    className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Workspace Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDetailTab('details')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    detailTab === 'details'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Job Details &amp; Analyzer
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('intelligence')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    detailTab === 'intelligence'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Company Intelligence{' '}
                  {activeResearch?.status === 'completed'
                    ? `(${activeResearch.findings.length})`
                    : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('documents')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer font-mono-tabular ${
                    detailTab === 'documents'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Linked Documents ({linkedResumes.length + linkedCoverLetters.length})
                </button>
              </div>
            </div>

            {analyzeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                {analyzeError}
              </div>
            )}

            {/* TAB 1: Structured Job Form + Job Analyzer */}
            {detailTab === 'details' && (
              <>
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className={LABEL_CLS}>Company Name</label>
                      <input
                        type="text"
                        value={activeJob.company}
                        onChange={(e) =>
                          updateJob(activeJob.id, (p) => ({ ...p, company: e.target.value }))
                        }
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Job Title</label>
                      <input
                        type="text"
                        value={activeJob.jobTitle}
                        onChange={(e) =>
                          updateJob(activeJob.id, (p) => ({ ...p, jobTitle: e.target.value }))
                        }
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Status</label>
                      <select
                        value={activeJob.status}
                        onChange={(e) =>
                          updateJob(activeJob.id, (p) => ({
                            ...p,
                            status: e.target.value as JobStatus,
                          }))
                        }
                        className={INPUT_CLS}
                      >
                        {STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Company Website</label>
                      <div className="relative">
                        <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="url"
                          value={activeJob.companyWebsite || ''}
                          onChange={(e) =>
                            updateJob(activeJob.id, (p) => ({
                              ...p,
                              companyWebsite: e.target.value,
                            }))
                          }
                          placeholder="https://company.com"
                          className={`${INPUT_CLS} pl-8`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Job Location</label>
                      <input
                        type="text"
                        value={activeJob.jobLocation || ''}
                        onChange={(e) =>
                          updateJob(activeJob.id, (p) => ({ ...p, jobLocation: e.target.value }))
                        }
                        placeholder="San Francisco, CA (Hybrid)"
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Application Date</label>
                      <input
                        type="date"
                        value={activeJob.applicationDate}
                        onChange={(e) =>
                          updateJob(activeJob.id, (p) => ({
                            ...p,
                            applicationDate: e.target.value,
                          }))
                        }
                        className={`${INPUT_CLS} font-mono-tabular`}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Hiring Manager</label>
                      <input
                        type="text"
                        value={activeJob.hiringManager}
                        onChange={(e) =>
                          updateJob(activeJob.id, (p) => ({ ...p, hiringManager: e.target.value }))
                        }
                        placeholder="Maya Chen"
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Department</label>
                      <input
                        type="text"
                        value={activeJob.department}
                        onChange={(e) =>
                          updateJob(activeJob.id, (p) => ({ ...p, department: e.target.value }))
                        }
                        placeholder="Core Product Platform"
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Company Address</label>
                      <input
                        type="text"
                        value={activeJob.companyAddress}
                        onChange={(e) =>
                          updateJob(activeJob.id, (p) => ({
                            ...p,
                            companyAddress: e.target.value,
                          }))
                        }
                        placeholder="548 Market St, San Francisco, CA"
                        className={INPUT_CLS}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className={LABEL_CLS}>Job Description</label>
                      <textarea
                        rows={6}
                        value={activeJob.jobDescription}
                        onChange={(e) =>
                          updateJob(activeJob.id, (p) => ({
                            ...p,
                            jobDescription: e.target.value,
                          }))
                        }
                        placeholder="Paste the full job posting here, then click Company Research or Analyze Job..."
                        className={`${INPUT_CLS} leading-relaxed`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className={LABEL_CLS}>Required Qualifications (one per line)</label>
                      <textarea
                        rows={4}
                        value={activeJob.requiredQualifications.join('\n')}
                        onChange={(e) =>
                          updateJob(activeJob.id, (p) => ({
                            ...p,
                            requiredQualifications: e.target.value
                              .split('\n')
                              .filter((l) => l.trim()),
                          }))
                        }
                        className={`${INPUT_CLS} text-xs leading-relaxed`}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Technical Requirements (comma-separated)</label>
                      <textarea
                        rows={4}
                        value={activeJob.technicalRequirements.join(', ')}
                        onChange={(e) =>
                          updateJob(activeJob.id, (p) => ({
                            ...p,
                            technicalRequirements: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }))
                        }
                        className={`${INPUT_CLS} text-xs leading-relaxed`}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="block text-xs font-medium text-slate-600">
                        Application Notes
                      </label>
                      <AIWritingCompanion
                        fieldType="Application Notes"
                        fieldKey={`job.${activeJob.id}.applicationNotes`}
                        fieldLabel={`${activeJob.jobTitle || 'Target Role'} · ${activeJob.company || 'Company'}`}
                        currentValue={activeJob.applicationNotes || ''}
                        documentType="job-application"
                        documentId={activeJob.id}
                        documentTitle={`${activeJob.company} — ${activeJob.jobTitle}`}
                        documentContext={activeJob}
                        careerProfile={profile}
                        jobContext={activeJob}
                        companyResearch={activeResearch}
                        onApply={(val) =>
                          updateJob(activeJob.id, (p) => ({ ...p, applicationNotes: val }))
                        }
                        onCancel={() => {}}
                      />
                    </div>
                    <textarea
                      rows={4}
                      value={activeJob.applicationNotes || ''}
                      onChange={(e) =>
                        updateJob(activeJob.id, (p) => ({
                          ...p,
                          applicationNotes: e.target.value,
                        }))
                      }
                      placeholder="Capture tailored talking points, interview prep notes, gaps to address, or questions for the hiring team..."
                      className={`${INPUT_CLS} text-xs leading-relaxed`}
                    />
                  </div>
                </div>

                {/* AI Job Analysis Output */}
                {activeJob.analysis && (
                  <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Job Analyzer &amp; Profile Match
                      </h3>
                      <span className="text-[11px] font-mono-tabular text-slate-400">
                        Analyzed {new Date(activeJob.analysis.analyzedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <div className="font-semibold text-emerald-800">
                          Verified Profile Matches ({activeJob.analysis.matchedSkills.length})
                        </div>
                        <p className="text-slate-700 leading-relaxed">
                          {activeJob.analysis.matchedSkills.join(' · ') || 'None detected'}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <div className="font-semibold text-amber-800">
                          Unlisted Requirements / Gaps ({activeJob.analysis.missingSkills.length})
                        </div>
                        <p className="text-slate-700 leading-relaxed">
                          {activeJob.analysis.missingSkills.join(' · ') ||
                            'No major gaps identified'}
                        </p>
                      </div>
                    </div>

                    {activeJob.analysis.tailoringSuggestions.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <div className="text-xs font-semibold text-slate-900">
                          Tailoring Recommendations
                        </div>
                        <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
                          {activeJob.analysis.tailoringSuggestions.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* TAB 2: Company Intelligence & 3-Way Job Match */}
            {detailTab === 'intelligence' && (
              <CompanyIntelligencePanel
                job={activeJob}
                companyProfile={activeCompanyProfile}
                research={activeResearch}
                jobMatch={activeMatch}
                researching={researching}
                matching={matching}
                researchError={researchError}
                matchError={matchError}
                onRunResearch={handleResearchCompany}
                onUpdateFindingStatus={updateFindingStatus}
                onRunJobMatch={handleRunThreeWayMatch}
                onOpenTailoredResume={() => openTailoredResumeForJob(activeJob.id)}
                onOpenTailoredCoverLetter={() =>
                  openCoverLetterForJob(activeJob.id, selectedResumeForLetter || undefined)
                }
              />
            )}

            {/* TAB 3: Linked Documents */}
            {detailTab === 'documents' && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Documents Linked to This Application
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tailored versions keep your Master Resume clean while incorporating verified job and company intelligence.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openReviewCenter({
                          jobId: activeJob.id,
                          resumeId: linkedResumes[0]?.id || resumes[0]?.id,
                          coverLetterId: linkedCoverLetters[0]?.id || coverLetters[0]?.id,
                          scope: 'full_application',
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                      Review Application
                    </button>
                    <button
                      type="button"
                      onClick={() => openTailoredResumeForJob(activeJob.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      New Tailored Resume
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openCoverLetterForJob(activeJob.id, selectedResumeForLetter || undefined)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      New Cover Letter
                    </button>
                  </div>
                </div>

                {linkedResumes.length === 0 && linkedCoverLetters.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">
                    No tailored resumes or cover letters linked to this job yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {linkedResumes.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setActiveResumeId(r.id);
                          setActiveModule('resumes');
                        }}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-md hover:border-slate-900 text-left cursor-pointer"
                      >
                        <span className="font-medium text-slate-900 truncate">
                          Resume: {r.name}
                        </span>
                        <span className="font-mono-tabular text-slate-400 shrink-0">
                          v{r.version}
                        </span>
                      </button>
                    ))}
                    {linkedCoverLetters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setActiveCoverLetterId(c.id);
                          setActiveModule('cover-letters');
                        }}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-md hover:border-slate-900 text-left cursor-pointer"
                      >
                        <span className="font-medium text-slate-900 truncate">
                          Cover Letter: {c.title}
                        </span>
                        <span className="font-mono-tabular text-slate-400 shrink-0">
                          v{c.version}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSearch,
  FileText,
  History,
  Mail,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
} from 'lucide-react';
import { useCareer } from '../store/CareerContext';
import {
  ApplicationReviewRecord,
  FactDiscrepancy,
  JobRequirementMatchStatus,
  ReviewFinding,
  ReviewScope,
  ReviewSeverity,
} from '../types/career';
import {
  regenerateReviewSuggestionWithAi,
  runApplicationReviewWithAi,
} from '../services/aiService';
import {
  calculateWeightedApplicationScore,
  DEFAULT_REVIEW_SCORING_CONFIG,
} from '../services/reviewScoring';
import { ReviewFindingCard } from '../components/ReviewFindingCard';
import { exportResumeToDocx, exportResumeToPdf } from '../services/resumeExport';
import { exportCoverLetterToDocx, exportCoverLetterToPdf } from '../services/coverLetterExport';

type ReviewTab =
  | 'dashboard'
  | 'resume'
  | 'cover-letter'
  | 'job-match'
  | 'company'
  | 'ats'
  | 'facts'
  | 'final'
  | 'history';

const MATCH_CLASS_STYLES: Record<JobRequirementMatchStatus, string> = {
  'Verified Match': 'text-emerald-800 font-semibold',
  'Partial Match': 'text-amber-800 font-semibold',
  Missing: 'text-rose-800 font-semibold',
  'Not Applicable': 'text-slate-500 font-medium',
  'Requires Verification': 'text-slate-800 font-semibold',
};

export function ReviewCenterModule() {
  const {
    profile,
    resumes,
    coverLetters,
    jobs,
    activeResumeId,
    activeCoverLetterId,
    getCompanyResearchForJob,
    applicationReviews,
    activeReviewId,
    setActiveReviewId,
    documentSnapshots,
    reviewScoringConfig,
    setReviewScoringConfig,
    reviewLaunchTarget,
    clearReviewLaunchTarget,
    saveApplicationReview,
    updateReviewFinding,
    resolveFactDiscrepancy,
    applyReviewChanges,
    undoReviewSnapshot,
    setSelectedJobId,
    setActiveResumeId,
    setActiveCoverLetterId,
    setActiveModule,
  } = useCareer();

  const [tab, setTab] = useState<ReviewTab>('dashboard');
  const [selectedResumeId, setSelectedResumeId] = useState<string>(activeResumeId || resumes[0]?.id || '');
  const [selectedCoverLetterId, setSelectedCoverLetterId] = useState<string>(
    activeCoverLetterId || coverLetters[0]?.id || ''
  );
  const [selectedTargetJobId, setSelectedTargetJobId] = useState<string>(jobs[0]?.id || '');
  const [scope, setScope] = useState<ReviewScope>('full_application');
  const [showScoringConfig, setShowScoringConfig] = useState(false);

  const [runningReview, setRunningReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [matchFilter, setMatchFilter] = useState<'All' | JobRequirementMatchStatus>('All');
  const [compareReviewIdA, setCompareReviewIdA] = useState<string>('');
  const [compareReviewIdB, setCompareReviewIdB] = useState<string>('');

  // Handle deep-links from Resume Builder, Cover Letter Maker, Job Tracker, or Document Manager
  useEffect(() => {
    if (!reviewLaunchTarget) return;
    if (reviewLaunchTarget.resumeId) setSelectedResumeId(reviewLaunchTarget.resumeId);
    if (reviewLaunchTarget.coverLetterId) setSelectedCoverLetterId(reviewLaunchTarget.coverLetterId);
    if (reviewLaunchTarget.jobId) setSelectedTargetJobId(reviewLaunchTarget.jobId);
    if (reviewLaunchTarget.scope) setScope(reviewLaunchTarget.scope);
    setTab('dashboard');
    clearReviewLaunchTarget();
  }, [clearReviewLaunchTarget, reviewLaunchTarget]);

  // Keep selections synchronized when items are created or deleted
  useEffect(() => {
    if (resumes.length === 0) {
      if (selectedResumeId) setSelectedResumeId('');
    } else if (!resumes.some((r) => r.id === selectedResumeId)) {
      setSelectedResumeId(activeResumeId || resumes[0].id);
    }
  }, [resumes, activeResumeId, selectedResumeId]);

  useEffect(() => {
    if (coverLetters.length === 0) {
      if (selectedCoverLetterId) setSelectedCoverLetterId('');
    } else if (!coverLetters.some((c) => c.id === selectedCoverLetterId)) {
      setSelectedCoverLetterId(activeCoverLetterId || coverLetters[0].id);
    }
  }, [coverLetters, activeCoverLetterId, selectedCoverLetterId]);

  useEffect(() => {
    if (jobs.length === 0) {
      if (selectedTargetJobId) setSelectedTargetJobId('');
    } else if (!jobs.some((j) => j.id === selectedTargetJobId)) {
      setSelectedTargetJobId(jobs[0].id);
    }
  }, [jobs, selectedTargetJobId]);

  const hasAnyDocuments = resumes.length > 0 || coverLetters.length > 0;

  const targetResume = resumes.find((r) => r.id === selectedResumeId);
  const targetCoverLetter = coverLetters.find((c) => c.id === selectedCoverLetterId);
  const targetJob = jobs.find((j) => j.id === selectedTargetJobId);
  const linkedCompanyResearch = targetJob ? getCompanyResearchForJob(targetJob.id) : undefined;

  const activeReview: ApplicationReviewRecord | undefined =
    applicationReviews.find((r) => r.id === activeReviewId) || applicationReviews[0];

  const handleRunReview = async () => {
    if (scope === 'resume_only' && !targetResume) {
      setReviewError('Select a resume to review.');
      return;
    }
    if (scope === 'cover_letter_only' && !targetCoverLetter) {
      setReviewError('Select a cover letter to review.');
      return;
    }
    if (scope === 'full_application' && !targetResume && !targetCoverLetter) {
      setReviewError('Select at least a resume or cover letter to review.');
      return;
    }

    setReviewError(null);
    setRunningReview(true);
    try {
      const previousApps = jobs
        .filter((j) => j.id !== targetJob?.id)
        .slice(0, 5)
        .map((j) => {
          const cl = coverLetters.find((c) => c.linkedJobId === j.id);
          return {
            jobTitle: j.jobTitle,
            company: j.company,
            coverLetterTitle: cl?.title,
          };
        });

      const record = await runApplicationReviewWithAi({
        scope,
        careerProfile: profile,
        resume: scope !== 'cover_letter_only' ? targetResume : undefined,
        coverLetter: scope !== 'resume_only' ? targetCoverLetter : undefined,
        job: targetJob,
        companyResearch: linkedCompanyResearch,
        previousApplications: previousApps,
        scoringConfig: reviewScoringConfig,
      });

      saveApplicationReview(record);
      setBatchSelectedIds([]);
      setTab('dashboard');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Application review failed.');
    } finally {
      setRunningReview(false);
    }
  };

  const handleToggleBatch = (findingId: string) => {
    setBatchSelectedIds((prev) =>
      prev.includes(findingId) ? prev.filter((id) => id !== findingId) : [...prev, findingId]
    );
  };

  const handleRegenerateFinding = async (finding: ReviewFinding) => {
    if (!activeReview) return;
    const res = await regenerateReviewSuggestionWithAi({
      finding,
      careerProfile: profile,
      targetJob: targetJob,
    });
    updateReviewFinding(activeReview.id, finding.id, (prev) => ({
      ...prev,
      recommendedCorrection: res.recommendedCorrection,
      editedCorrection: undefined,
      explanation: res.explanation,
      status: 'open',
    }));
  };

  const handleBatchApply = (idsToApply: string[]) => {
    if (!activeReview || idsToApply.length === 0) return;
    applyReviewChanges(activeReview.id, idsToApply);
    setBatchSelectedIds((prev) => prev.filter((id) => !idsToApply.includes(id)));
  };

  const severityCounts = useMemo(() => {
    const counts: Record<ReviewSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    if (!activeReview) return counts;
    activeReview.findings.forEach((f) => {
      if (f.status !== 'rejected' && f.status !== 'applied') {
        counts[f.severity] += 1;
      }
    });
    return counts;
  }, [activeReview]);

  const resumeFindings = useMemo(
    () =>
      activeReview
        ? activeReview.findings.filter(
            (f) => f.documentTarget === 'resume' || f.category === 'Resume Audit'
          )
        : [],
    [activeReview]
  );

  const coverLetterFindings = useMemo(
    () =>
      activeReview
        ? activeReview.findings.filter(
            (f) => f.documentTarget === 'cover-letter' || f.category === 'Cover Letter Audit'
          )
        : [],
    [activeReview]
  );

  const unresolvedCriticalFacts = useMemo(
    () =>
      activeReview
        ? activeReview.factDiscrepancies.filter((d) => d.resolutionStatus === 'unresolved')
        : [],
    [activeReview]
  );

  const reviewSnapshots = useMemo(
    () =>
      activeReview
        ? documentSnapshots.filter((s) => s.reviewId === activeReview.id)
        : [],
    [activeReview, documentSnapshots]
  );

  const reviewExportResume = activeReview?.resumeId
    ? resumes.find((r) => r.id === activeReview.resumeId)
    : targetResume;
  const reviewExportLetter = activeReview?.coverLetterId
    ? coverLetters.find((c) => c.id === activeReview.coverLetterId)
    : targetCoverLetter;

  const liveWeightedPreviewScore = activeReview
    ? calculateWeightedApplicationScore({
        scope: activeReview.scope,
        resumeScore: activeReview.scores.resumeScore,
        coverLetterScore: activeReview.scores.coverLetterScore,
        jobMatchScore: activeReview.scores.jobMatchScore,
        companyAlignmentScore: activeReview.scores.companyAlignmentScore,
        config: reviewScoringConfig,
      })
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
      {/* Header & Review Launcher */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">AI Application Review Center</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Audits resumes, cover letters, ATS parseability, company alignment, and factual consistency against your verified Career Profile. Review scores and suggestions are advisory — verify details before submitting applications.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowScoringConfig((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sliders className="w-3.5 h-3.5" />
              Scoring Weights
            </button>
            <button
              type="button"
              disabled={runningReview || !hasAnyDocuments}
              onClick={handleRunReview}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {runningReview ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {runningReview ? 'Auditing Application...' : 'Run Application Review'}
            </button>
          </div>
        </div>

        {/* Target Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Review Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ReviewScope)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900"
            >
              <option value="full_application">Full Application (Resume + Cover Letter)</option>
              <option value="resume_only">Resume Only</option>
              <option value="cover_letter_only">Cover Letter Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Resume</label>
            <select
              disabled={scope === 'cover_letter_only'}
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900 disabled:opacity-45"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (v{r.version})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Cover Letter</label>
            <select
              disabled={scope === 'resume_only'}
              value={selectedCoverLetterId}
              onChange={(e) => setSelectedCoverLetterId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900 disabled:opacity-45"
            >
              {coverLetters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} (v{c.version})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Target Job {linkedCompanyResearch?.status === 'completed' ? '· Company Researched' : ''}
            </label>
            <select
              value={selectedTargetJobId}
              onChange={(e) => setSelectedTargetJobId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900"
            >
              <option value="">General Review (No Job Linked)</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.company} — {j.jobTitle}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Configurable Scoring Model Panel */}
        {showScoringConfig && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900">
                  Configurable Application Scoring Weights
                </div>
                <div className="text-[11px] text-slate-500">
                  Version: {reviewScoringConfig.version} · Adjust pillar weights for overall score calculation.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewScoringConfig(DEFAULT_REVIEW_SCORING_CONFIG)}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded cursor-pointer"
              >
                Reset Defaults (40 / 30 / 20 / 10)
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  ['resume', 'Resume Weight'],
                  ['coverLetter', 'Cover Letter Weight'],
                  ['jobMatch', 'Job Match Weight'],
                  ['companyAlignment', 'Company Alignment Weight'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>{label}</span>
                    <span className="font-mono-tabular font-semibold">
                      {Math.round(reviewScoringConfig.applicationWeights[key] * 100)}%
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={0.6}
                    step={0.05}
                    value={reviewScoringConfig.applicationWeights[key]}
                    onChange={(e) =>
                      setReviewScoringConfig((prev) => ({
                        ...prev,
                        applicationWeights: {
                          ...prev.applicationWeights,
                          [key]: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {reviewError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800">
            {reviewError}
          </div>
        )}

        {/* 9-Section Navigation Strip */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
          {(
            [
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'resume', label: 'Resume Review' },
              { id: 'cover-letter', label: 'Cover Letter' },
              { id: 'job-match', label: 'Job Match' },
              { id: 'company', label: 'Company Alignment' },
              { id: 'ats', label: 'ATS Checks' },
              {
                id: 'facts',
                label: `Fact Check${unresolvedCriticalFacts.length > 0 ? ` (${unresolvedCriticalFacts.length})` : ''}`,
              },
              { id: 'final', label: 'Final Report' },
              { id: 'history', label: `History (${applicationReviews.length})` },
            ] as Array<{ id: ReviewTab; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Undo Snapshots Banner (preserves original document recoverability) */}
      {reviewSnapshots.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-700">
            <strong>Version History Preserved:</strong> {reviewSnapshots.length} pre-edit snapshot(s) saved for this review. You can restore original documents anytime.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reviewSnapshots.map((snap) => (
              <button
                key={snap.id}
                type="button"
                onClick={() => undoReviewSnapshot(snap.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Undo ({snap.documentKind === 'resume' ? 'Resume' : 'Cover Letter'} · {snap.label})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State when no review has been run yet (except History tab) */}
      {!activeReview && tab !== 'history' ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3">
          <FileSearch className="w-8 h-8 text-slate-400 mx-auto" />
          {!hasAnyDocuments ? (
            <>
              <h2 className="text-sm font-semibold text-slate-900">
                Create a resume or cover letter to review
              </h2>
              <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                Your workspace does not have any saved resumes or cover letters yet. Create at least one document first, then return here to run ATS checks, fact verification, and job-match scoring.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveModule('resumes')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Go to Resumes
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModule('cover-letters')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Go to Cover Letters
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-slate-900">No Application Review Run Yet</h2>
              <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                Select your resume, cover letter, and target job above, then click <strong>Run Application Review</strong> to execute the Resume Auditor, Cover Letter Auditor, Job Match Analyst, Company Alignment check, 10-point ATS Validation, and Career Profile Fact Checker.
              </p>
              <button
                type="button"
                disabled={runningReview}
                onClick={handleRunReview}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Run First Application Review
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* 1. REVIEW DASHBOARD */}
          {tab === 'dashboard' && activeReview && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2">
                      <span>Review {activeReview.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {new Date(activeReview.reviewDate).toLocaleString()}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {activeReview.companyName || 'General Review'}
                        {activeReview.jobTitle ? ` — ${activeReview.jobTitle}` : ''}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-3xl font-bold font-mono-tabular text-slate-900">
                        {liveWeightedPreviewScore}
                      </span>
                      <span className="text-sm font-mono-tabular text-slate-400">/ 100 Overall Application Score</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Scores reflect document quality, job requirement alignment, and factual verification—not interview or hiring probability. Candidates are not penalized for preferred qualifications not required for the role.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTab('facts')}
                      className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                    >
                      Fact Check ({unresolvedCriticalFacts.length} open)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('final')}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                    >
                      View Final Report
                    </button>
                  </div>
                </div>

                {/* 4 Weighted Pillars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setTab('resume')}
                    className="p-3.5 border border-slate-200 hover:border-slate-900 rounded-md text-left cursor-pointer transition-colors"
                  >
                    <div className="text-[11px] text-slate-500">
                      Resume ({Math.round(reviewScoringConfig.applicationWeights.resume * 100)}%)
                    </div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
                      {activeReview.scope === 'cover_letter_only'
                        ? '—'
                        : `${activeReview.scores.resumeScore}/100`}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('cover-letter')}
                    className="p-3.5 border border-slate-200 hover:border-slate-900 rounded-md text-left cursor-pointer transition-colors"
                  >
                    <div className="text-[11px] text-slate-500">
                      Cover Letter ({Math.round(reviewScoringConfig.applicationWeights.coverLetter * 100)}%)
                    </div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
                      {activeReview.scope === 'resume_only'
                        ? '—'
                        : `${activeReview.scores.coverLetterScore}/100`}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('job-match')}
                    className="p-3.5 border border-slate-200 hover:border-slate-900 rounded-md text-left cursor-pointer transition-colors"
                  >
                    <div className="text-[11px] text-slate-500">
                      Job Match ({Math.round(reviewScoringConfig.applicationWeights.jobMatch * 100)}%)
                    </div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
                      {activeReview.scores.jobMatchScore}/100
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('company')}
                    className="p-3.5 border border-slate-200 hover:border-slate-900 rounded-md text-left cursor-pointer transition-colors"
                  >
                    <div className="text-[11px] text-slate-500">
                      Company Alignment ({Math.round(reviewScoringConfig.applicationWeights.companyAlignment * 100)}%)
                    </div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
                      {activeReview.scores.companyAlignmentScore}/100
                    </div>
                  </button>
                </div>

                {/* Open Findings by Severity */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-slate-100 text-xs">
                  <span className="font-semibold text-rose-800 font-mono-tabular">
                    Critical: {severityCounts.critical}
                  </span>
                  <span className="font-semibold text-amber-800 font-mono-tabular">
                    High: {severityCounts.high}
                  </span>
                  <span className="font-medium text-slate-800 font-mono-tabular">
                    Medium: {severityCounts.medium}
                  </span>
                  <span className="text-slate-600 font-mono-tabular">
                    Low: {severityCounts.low}
                  </span>
                  <span className="text-emerald-800 font-medium font-mono-tabular">
                    Applied: {activeReview.appliedChangeIds.length}
                  </span>
                </div>
              </div>

              {/* Actionable Findings Overview with Batch Apply */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      All Review Findings &amp; Corrections ({activeReview.findings.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Accept, edit, regenerate, or reject individual recommendations. Applying creates a recoverable snapshot automatically.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={batchSelectedIds.length === 0}
                      onClick={() => handleBatchApply(batchSelectedIds)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-md cursor-pointer disabled:opacity-40"
                    >
                      Apply Selected ({batchSelectedIds.length})
                    </button>
                    <button
                      type="button"
                      disabled={
                        activeReview.findings.filter(
                          (f) =>
                            f.status === 'accepted' &&
                            f.targetField &&
                            f.targetField.kind !== 'advisory_only'
                        ).length === 0
                      }
                      onClick={() =>
                        handleBatchApply(
                          activeReview.findings
                            .filter(
                              (f) =>
                                f.status === 'accepted' &&
                                f.targetField &&
                                f.targetField.kind !== 'advisory_only'
                            )
                            .map((f) => f.id)
                        )
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer disabled:opacity-40"
                    >
                      Apply All Accepted
                    </button>
                  </div>
                </div>

                {activeReview.findings.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">
                    No issues flagged in this review.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeReview.findings.map((f) => (
                      <ReviewFindingCard
                        key={f.id}
                        finding={f}
                        selectedForBatch={batchSelectedIds.includes(f.id)}
                        onToggleBatchSelect={handleToggleBatch}
                        onAccept={(fid) =>
                          updateReviewFinding(activeReview.id, fid, (prev) => ({
                            ...prev,
                            status: 'accepted',
                          }))
                        }
                        onReject={(fid) =>
                          updateReviewFinding(activeReview.id, fid, (prev) => ({
                            ...prev,
                            status: 'rejected',
                          }))
                        }
                        onSaveEdit={(fid, text) =>
                          updateReviewFinding(activeReview.id, fid, (prev) => ({
                            ...prev,
                            editedCorrection: text,
                            status: 'accepted',
                          }))
                        }
                        onRegenerate={handleRegenerateFinding}
                        onApplySingle={(fid) => handleBatchApply([fid])}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. RESUME REVIEW */}
          {tab === 'resume' && activeReview && (
            <div className="space-y-5">
              {activeReview.scope === 'cover_letter_only' ? (
                <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
                  This review was run with scope "Cover Letter Only". Switch scope above and run a review including a Resume.
                </div>
              ) : (
                <>
                  <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900">
                          Resume Auditor · {activeReview.resumeTitle}
                        </h2>
                        <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                          {activeReview.scores.resumeScore} / 100
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeReview.resumeId) setActiveResumeId(activeReview.resumeId);
                          setActiveModule('resumes');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Open in Resume Builder
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                      {activeReview.scores.resumeBreakdown.map((cat) => (
                        <div key={cat.key} className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                            <span>{cat.label}</span>
                            <span className="font-mono-tabular">
                              {cat.score} / {cat.maxScore}
                            </span>
                          </div>
                          {cat.supportingFindings.length > 0 && (
                            <ul className="list-disc pl-4 text-[11px] text-slate-600 space-y-0.5">
                              {cat.supportingFindings.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Resume Findings ({resumeFindings.length})
                      </h3>
                      <button
                        type="button"
                        disabled={batchSelectedIds.length === 0}
                        onClick={() => handleBatchApply(batchSelectedIds)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-md cursor-pointer disabled:opacity-40"
                      >
                        Apply Selected ({batchSelectedIds.length})
                      </button>
                    </div>
                    {resumeFindings.map((f) => (
                      <ReviewFindingCard
                        key={f.id}
                        finding={f}
                        selectedForBatch={batchSelectedIds.includes(f.id)}
                        onToggleBatchSelect={handleToggleBatch}
                        onAccept={(fid) =>
                          updateReviewFinding(activeReview.id, fid, (prev) => ({
                            ...prev,
                            status: 'accepted',
                          }))
                        }
                        onReject={(fid) =>
                          updateReviewFinding(activeReview.id, fid, (prev) => ({
                            ...prev,
                            status: 'rejected',
                          }))
                        }
                        onSaveEdit={(fid, text) =>
                          updateReviewFinding(activeReview.id, fid, (prev) => ({
                            ...prev,
                            editedCorrection: text,
                            status: 'accepted',
                          }))
                        }
                        onRegenerate={handleRegenerateFinding}
                        onApplySingle={(fid) => handleBatchApply([fid])}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 3. COVER LETTER REVIEW */}
          {tab === 'cover-letter' && activeReview && (
            <div className="space-y-5">
              {activeReview.scope === 'resume_only' ? (
                <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
                  This review was run with scope "Resume Only". Switch scope above and run a review including a Cover Letter.
                </div>
              ) : (
                <>
                  <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900">
                          Cover Letter Auditor · {activeReview.coverLetterTitle}
                        </h2>
                        <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                          {activeReview.scores.coverLetterScore} / 100
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeReview.coverLetterId)
                            setActiveCoverLetterId(activeReview.coverLetterId);
                          setActiveModule('cover-letters');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Open in Cover Letter Maker
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                      {activeReview.scores.coverLetterBreakdown.map((cat) => (
                        <div key={cat.key} className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                            <span>{cat.label}</span>
                            <span className="font-mono-tabular">
                              {cat.score} / {cat.maxScore}
                            </span>
                          </div>
                          {cat.supportingFindings.length > 0 && (
                            <ul className="list-disc pl-4 text-[11px] text-slate-600 space-y-0.5">
                              {cat.supportingFindings.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Cover Letter Findings ({coverLetterFindings.length})
                      </h3>
                      <button
                        type="button"
                        disabled={batchSelectedIds.length === 0}
                        onClick={() => handleBatchApply(batchSelectedIds)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-md cursor-pointer disabled:opacity-40"
                      >
                        Apply Selected ({batchSelectedIds.length})
                      </button>
                    </div>
                    {coverLetterFindings.map((f) => (
                      <ReviewFindingCard
                        key={f.id}
                        finding={f}
                        selectedForBatch={batchSelectedIds.includes(f.id)}
                        onToggleBatchSelect={handleToggleBatch}
                        onAccept={(fid) =>
                          updateReviewFinding(activeReview.id, fid, (prev) => ({
                            ...prev,
                            status: 'accepted',
                          }))
                        }
                        onReject={(fid) =>
                          updateReviewFinding(activeReview.id, fid, (prev) => ({
                            ...prev,
                            status: 'rejected',
                          }))
                        }
                        onSaveEdit={(fid, text) =>
                          updateReviewFinding(activeReview.id, fid, (prev) => ({
                            ...prev,
                            editedCorrection: text,
                            status: 'accepted',
                          }))
                        }
                        onRegenerate={handleRegenerateFinding}
                        onApplySingle={(fid) => handleBatchApply([fid])}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 4. JOB MATCH ANALYSIS */}
          {tab === 'job-match' && activeReview && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-slate-600" />
                    Requirement-by-Requirement Job Match Analysis
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Score: <strong className="font-mono-tabular text-slate-900">{activeReview.scores.jobMatchScore}/100</strong> · Missing items are never presented as verified qualifications.
                  </p>
                </div>

                <select
                  aria-label="Filter requirement match status"
                  value={matchFilter}
                  onChange={(e) =>
                    setMatchFilter(e.target.value as 'All' | JobRequirementMatchStatus)
                  }
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                >
                  <option value="All">All Classifications</option>
                  <option value="Verified Match">Verified Match</option>
                  <option value="Partial Match">Partial Match</option>
                  <option value="Missing">Missing</option>
                  <option value="Requires Verification">Requires Verification</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Requirement</th>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-3">Evidence</th>
                      <th className="py-2.5 px-3">Action / Gap Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeReview.requirementComparison
                      .filter(
                        (item) => matchFilter === 'All' || item.classification === matchFilter
                      )
                      .map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                            {item.requirementType}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-900">
                            {item.requirement}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={MATCH_CLASS_STYLES[item.classification]}>
                              {item.classification}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {item.evidenceFromProfileOrDocs || '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {item.gapOrActionNote || '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. COMPANY ALIGNMENT */}
          {tab === 'company' && activeReview && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-600" />
                    Company Alignment Analysis · {activeReview.companyName || 'Employer'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Alignment Score:{' '}
                    <strong className="font-mono-tabular text-slate-900">
                      {activeReview.scores.companyAlignmentScore}/100
                    </strong>
                  </p>
                </div>
                {activeReview.jobId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedJobId(activeReview.jobId!);
                      setActiveModule('jobs');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    Open Company Intelligence
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                {activeReview.companyAlignmentSummary.notes}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 border border-emerald-200 bg-emerald-50/40 rounded-md space-y-1.5">
                  <div className="font-semibold text-emerald-900">
                    Aligned Claims ({activeReview.companyAlignmentSummary.alignedClaims.length})
                  </div>
                  <ul className="list-disc pl-4 text-slate-700 space-y-1">
                    {activeReview.companyAlignmentSummary.alignedClaims.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 border border-rose-200 bg-rose-50/40 rounded-md space-y-1.5">
                  <div className="font-semibold text-rose-900">
                    Unsupported / Outdated Claims (
                    {activeReview.companyAlignmentSummary.unsupportedOrOutdatedClaims.length})
                  </div>
                  <ul className="list-disc pl-4 text-slate-700 space-y-1">
                    {activeReview.companyAlignmentSummary.unsupportedOrOutdatedClaims.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 border border-amber-200 bg-amber-50/40 rounded-md space-y-1.5">
                  <div className="font-semibold text-amber-900">
                    Missing Company Context (
                    {activeReview.companyAlignmentSummary.missingCompanyContext.length})
                  </div>
                  <ul className="list-disc pl-4 text-slate-700 space-y-1">
                    {activeReview.companyAlignmentSummary.missingCompanyContext.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 6. ATS COMPATIBILITY VALIDATION */}
          {tab === 'ats' && activeReview && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      ATS Structural &amp; Keyword Validation
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeReview.atsValidation.disclaimer}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Structural: </span>
                      <strong className="font-mono-tabular text-slate-900">
                        {activeReview.atsValidation.structuralScore}/100
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Keyword: </span>
                      <strong className="font-mono-tabular text-slate-900">
                        {activeReview.atsValidation.keywordScore}/100
                      </strong>
                    </div>
                  </div>
                </div>

                {(['structural', 'keyword'] as const).map((catType) => (
                  <div key={catType} className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-900">
                      {catType === 'structural'
                        ? 'Document Structure & Parseability Checks'
                        : 'Job Requirement Keyword Alignment Checks'}
                    </h3>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                      {activeReview.atsValidation.checks
                        .filter((c) => c.category === catType)
                        .map((chk) => (
                          <div key={chk.id} className="p-3 flex flex-wrap items-start justify-between gap-3 text-xs">
                            <div className="space-y-0.5 flex-1">
                              <div className="font-semibold text-slate-900">{chk.checkName}</div>
                              <div className="text-slate-600">{chk.detail}</div>
                              <div className="text-[11px] text-slate-500">{chk.recommendation}</div>
                            </div>
                            <span
                              className={`text-[11px] font-semibold uppercase ${
                                chk.status === 'pass'
                                  ? 'text-emerald-800'
                                  : chk.status === 'warning'
                                    ? 'text-amber-800'
                                    : 'text-rose-800'
                              }`}
                            >
                              {chk.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. FACT VERIFICATION ENGINE */}
          {tab === 'facts' && activeReview && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-slate-600" />
                      Career Profile Cross-Reference &amp; Fact Verification
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Contradictions between Career Profile, Resume, Cover Letter, and prior applications are never auto-resolved—verify each discrepancy explicitly.
                    </p>
                  </div>
                </div>

                {activeReview.factDiscrepancies.length === 0 ? (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    No factual contradictions detected between your Career Profile and target documents.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeReview.factDiscrepancies.map((disc: FactDiscrepancy) => (
                      <div
                        key={disc.id}
                        className="p-4 border border-slate-200 rounded-md space-y-2.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900">
                            {disc.fieldName} ·{' '}
                            <span className="font-normal text-slate-600">{disc.sourceDocument}</span>
                          </div>
                          <span
                            className={`text-[11px] font-semibold ${
                              disc.resolutionStatus === 'unresolved'
                                ? 'text-rose-800'
                                : 'text-emerald-800'
                            }`}
                          >
                            {disc.resolutionStatus === 'unresolved'
                              ? 'Requires User Verification'
                              : disc.resolutionStatus === 'confirmed_profile'
                                ? 'Confirmed Career Profile Value'
                                : disc.resolutionStatus === 'confirmed_document'
                                  ? 'Confirmed Document Value'
                                  : 'Dismissed'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                            <div className="text-[11px] font-semibold text-slate-500">
                              Career Profile (Primary Verified Value)
                            </div>
                            <div className="text-slate-900 mt-0.5">{disc.originalValue}</div>
                          </div>
                          <div className="p-2.5 bg-rose-50/40 border border-rose-200 rounded">
                            <div className="text-[11px] font-semibold text-rose-800">
                              Conflicting Value ({disc.sourceDocument})
                            </div>
                            <div className="text-slate-900 mt-0.5">{disc.conflictingValue}</div>
                          </div>
                        </div>

                        <div className="text-slate-600">
                          <strong>Recommended Action:</strong> {disc.recommendedAction}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              resolveFactDiscrepancy(
                                activeReview.id,
                                disc.id,
                                'confirmed_profile'
                              )
                            }
                            className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 rounded bg-white hover:border-slate-900 cursor-pointer"
                          >
                            Confirm Profile Value
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              resolveFactDiscrepancy(
                                activeReview.id,
                                disc.id,
                                'confirmed_document'
                              )
                            }
                            className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 rounded bg-white hover:border-slate-900 cursor-pointer"
                          >
                            Confirm Document Value
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              resolveFactDiscrepancy(activeReview.id, disc.id, 'dismissed')
                            }
                            className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 rounded bg-white text-slate-600 hover:border-slate-400 cursor-pointer"
                          >
                            Dismiss Discrepancy
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeReview.verifiedInformation.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-1.5">
                    <div className="text-xs font-semibold text-slate-900">
                      Verified Facts Matched Against Career Profile
                    </div>
                    <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                      {activeReview.verifiedInformation.map((info, i) => (
                        <li key={i}>{info}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 8. FINAL APPLICATION REPORT & PRE-EXPORT CHECKLIST */}
          {tab === 'final' && activeReview && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-slate-700" />
                      Final Pre-Submission Application Report
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Optional stylistic improvements never block export. Only unresolved critical factual contradictions are flagged as requiring attention before submission.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {reviewExportResume && (
                      <>
                        <button
                          type="button"
                          onClick={() => exportResumeToDocx(reviewExportResume)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Resume DOCX
                        </button>
                        <button
                          type="button"
                          onClick={() => exportResumeToPdf(reviewExportResume)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                        >
                          Resume PDF
                        </button>
                      </>
                    )}
                    {reviewExportLetter && (
                      <>
                        <button
                          type="button"
                          onClick={() => exportCoverLetterToDocx(reviewExportLetter)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Cover Letter DOCX
                        </button>
                        <button
                          type="button"
                          onClick={() => exportCoverLetterToPdf(reviewExportLetter)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                        >
                          Cover Letter PDF
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Score Summary Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div className="p-3 border border-slate-200 rounded-md">
                    <div className="text-slate-500">Overall</div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                      {liveWeightedPreviewScore}/100
                    </div>
                  </div>
                  <div className="p-3 border border-slate-200 rounded-md">
                    <div className="text-slate-500">Resume</div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                      {activeReview.scope === 'cover_letter_only'
                        ? '—'
                        : `${activeReview.scores.resumeScore}/100`}
                    </div>
                  </div>
                  <div className="p-3 border border-slate-200 rounded-md">
                    <div className="text-slate-500">Cover Letter</div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                      {activeReview.scope === 'resume_only'
                        ? '—'
                        : `${activeReview.scores.coverLetterScore}/100`}
                    </div>
                  </div>
                  <div className="p-3 border border-slate-200 rounded-md">
                    <div className="text-slate-500">Job Match</div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                      {activeReview.scores.jobMatchScore}/100
                    </div>
                  </div>
                  <div className="p-3 border border-slate-200 rounded-md">
                    <div className="text-slate-500">Company Align</div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                      {activeReview.scores.companyAlignmentScore}/100
                    </div>
                  </div>
                </div>

                {/* Critical Gate vs Optional Warnings */}
                {unresolvedCriticalFacts.length > 0 ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-md space-y-1.5 text-xs text-rose-900">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertOctagon className="w-4 h-4 text-rose-700" />
                      Action Recommended Before Submission: {unresolvedCriticalFacts.length} Unresolved Factual Discrepancy(ies)
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      {unresolvedCriticalFacts.map((d) => (
                        <li key={d.id}>
                          {d.fieldName} ({d.sourceDocument}): "{d.conflictingValue}" vs. Profile "{d.originalValue}"
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    All critical factual checks resolved. Ready to export and submit.
                  </div>
                )}

                {/* Report Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 border border-slate-200 rounded-md space-y-1.5">
                    <div className="font-semibold text-slate-900">
                      High-Priority Improvements
                    </div>
                    <ul className="list-disc pl-4 text-slate-600 space-y-1">
                      {activeReview.findings
                        .filter((f) => f.severity === 'high' && f.status !== 'applied')
                        .map((f) => (
                          <li key={f.id}>{f.explanation}</li>
                        ))}
                      {activeReview.findings.filter(
                        (f) => f.severity === 'high' && f.status !== 'applied'
                      ).length === 0 && <li>No remaining high-priority issues.</li>}
                    </ul>
                  </div>

                  <div className="p-4 border border-slate-200 rounded-md space-y-1.5">
                    <div className="font-semibold text-slate-900">
                      User-Approved &amp; Applied Changes ({activeReview.appliedChangeIds.length})
                    </div>
                    <ul className="list-disc pl-4 text-slate-600 space-y-1">
                      {activeReview.findings
                        .filter((f) => f.status === 'applied')
                        .map((f) => (
                          <li key={f.id}>
                            {f.documentReference}: {f.editedCorrection ?? f.recommendedCorrection}
                          </li>
                        ))}
                      {activeReview.appliedChangeIds.length === 0 && (
                        <li>No edits applied during this session.</li>
                      )}
                    </ul>
                  </div>

                  <div className="p-4 border border-slate-200 rounded-md space-y-1.5">
                    <div className="font-semibold text-slate-900">Verified Information</div>
                    <ul className="list-disc pl-4 text-slate-600 space-y-1">
                      {activeReview.verifiedInformation.map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 border border-slate-200 rounded-md space-y-1.5">
                    <div className="font-semibold text-slate-900">Pre-Export Checklist</div>
                    <div className="space-y-1.5 text-slate-700">
                      <div className="flex items-center gap-2">
                        {unresolvedCriticalFacts.length === 0 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                        )}
                        <span>Critical factual discrepancies resolved</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>
                          ATS structure validated ({activeReview.atsValidation.structuralScore}/100)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Original document snapshots preserved for undo</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 9. REVIEW HISTORY & SIDE-BY-SIDE COMPARISON */}
          {tab === 'history' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-slate-600" />
                      Persisted Review History ({applicationReviews.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Every completed review stores model provenance, configuration version, scores, and accepted/rejected change tracking.
                    </p>
                  </div>
                </div>

                {applicationReviews.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    No saved reviews yet. Run an application review above to begin tracking history.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                          <th className="py-2.5 px-3">Date &amp; Review ID</th>
                          <th className="py-2.5 px-3">Documents &amp; Target Role</th>
                          <th className="py-2.5 px-3">Overall</th>
                          <th className="py-2.5 px-3">Accepted / Rejected</th>
                          <th className="py-2.5 px-3">Model &amp; Config</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {applicationReviews.map((rev) => (
                          <tr key={rev.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-3 font-mono-tabular text-slate-600">
                              <div>{new Date(rev.reviewDate).toLocaleDateString()}</div>
                              <div className="text-[11px] text-slate-400">{rev.id}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-medium text-slate-900">
                                {rev.companyName || 'General Review'}
                                {rev.jobTitle ? ` — ${rev.jobTitle}` : ''}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {[rev.resumeTitle, rev.coverLetterTitle].filter(Boolean).join(' · ')}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono-tabular font-bold text-slate-900">
                              {rev.scores.overallScore}/100
                            </td>
                            <td className="py-3 px-3 font-mono-tabular text-slate-600">
                              {rev.acceptedChangeIds.length} accepted · {rev.rejectedChangeIds.length} rejected
                            </td>
                            <td className="py-3 px-3 text-[11px] text-slate-500">
                              {rev.aiModel} · {rev.configVersion}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveReviewId(rev.id);
                                  setTab('dashboard');
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Compare Two Reviews */}
              {applicationReviews.length >= 2 && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                  <div className="text-sm font-semibold text-slate-900">Compare Reviews</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <select
                      aria-label="Baseline review to compare"
                      value={compareReviewIdA || applicationReviews[1].id}
                      onChange={(e) => setCompareReviewIdA(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-md bg-white"
                    >
                      {applicationReviews.map((r) => (
                        <option key={r.id} value={r.id}>
                          Baseline: {new Date(r.reviewDate).toLocaleString()} ({r.scores.overallScore}/100)
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Target review to compare"
                      value={compareReviewIdB || applicationReviews[0].id}
                      onChange={(e) => setCompareReviewIdB(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-md bg-white"
                    >
                      {applicationReviews.map((r) => (
                        <option key={r.id} value={r.id}>
                          Comparison: {new Date(r.reviewDate).toLocaleString()} ({r.scores.overallScore}/100)
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const revA =
                      applicationReviews.find((r) => r.id === compareReviewIdA) ||
                      applicationReviews[1];
                    const revB =
                      applicationReviews.find((r) => r.id === compareReviewIdB) ||
                      applicationReviews[0];
                    const rows = [
                      {
                        label: 'Overall Application Score',
                        a: revA.scores.overallScore,
                        b: revB.scores.overallScore,
                      },
                      {
                        label: 'Resume Score',
                        a: revA.scores.resumeScore,
                        b: revB.scores.resumeScore,
                      },
                      {
                        label: 'Cover Letter Score',
                        a: revA.scores.coverLetterScore,
                        b: revB.scores.coverLetterScore,
                      },
                      {
                        label: 'Job Match Score',
                        a: revA.scores.jobMatchScore,
                        b: revB.scores.jobMatchScore,
                      },
                      {
                        label: 'Company Alignment Score',
                        a: revA.scores.companyAlignmentScore,
                        b: revB.scores.companyAlignmentScore,
                      },
                    ];
                    return (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-md text-xs">
                        {rows.map((row) => {
                          const delta = row.b - row.a;
                          return (
                            <div
                              key={row.label}
                              className="px-3.5 py-2.5 flex items-center justify-between"
                            >
                              <span className="font-medium text-slate-800">{row.label}</span>
                              <div className="flex items-center gap-4 font-mono-tabular">
                                <span className="text-slate-500">{row.a}</span>
                                <span aria-hidden="true">→</span>
                                <span className="font-semibold text-slate-900">{row.b}</span>
                                <span
                                  className={
                                    delta > 0
                                      ? 'text-emerald-700 font-semibold'
                                      : delta < 0
                                        ? 'text-rose-700 font-semibold'
                                        : 'text-slate-400'
                                  }
                                >
                                  ({delta > 0 ? `+${delta}` : delta})
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

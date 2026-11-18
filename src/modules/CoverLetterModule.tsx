import { useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  UserCheck,
  Wand2,
} from 'lucide-react';
import { useCareer } from '../store/CareerContext';
import {
  CompanionFieldType,
  CoverLetterEditAction,
  CoverLetterLength,
  CoverLetterParagraph,
  CoverLetterTemplateId,
  CoverLetterWritingStyle,
  DocumentFontFamily,
  DocumentProfileId,
  JobApplication,
} from '../types/career';
import { PaginatedPaperPreview } from '../components/PaginatedPaperPreview';
import { buildCoverLetterPreviewBlocks } from '../components/CoverLetterBlocksBuilder';
import { exportCoverLetterToDocx, exportCoverLetterToPdf } from '../services/coverLetterExport';
import { editCoverLetterWithAi, generateCoverLetterWithAi } from '../services/aiService';
import { AiDiffModal } from '../components/AiDiffModal';
import { AIWritingCompanion } from '../components/AIWritingCompanion';
import { DOCUMENT_PROFILES, evaluateCoverLetterStandards } from '../services/standardsEngine';
import { QualityReportPanel } from '../components/QualityReportPanel';

const CL_TEMPLATES: Array<{ id: CoverLetterTemplateId; label: string; desc: string }> = [
  { id: 'traditional', label: 'Traditional Business', desc: 'Formal business letter structure' },
  { id: 'modern', label: 'Modern Professional', desc: 'Clean editorial header & crisp pacing' },
  { id: 'minimal', label: 'Minimal', desc: 'Generous whitespace & understated ink' },
  { id: 'technical', label: 'Technical', desc: 'Structured RE line & monospace accents' },
  { id: 'creative', label: 'Creative', desc: 'Accent rule & bold typographic contrast' },
];

const WRITING_STYLES: CoverLetterWritingStyle[] = [
  'Professional',
  'Conversational',
  'Confident',
  'Technical',
  'Entry-Level',
  'Career Change',
  'Concise',
];

const LENGTH_OPTIONS: CoverLetterLength[] = ['Short', 'Standard', 'Detailed'];

const FULL_LETTER_ACTIONS: CoverLetterEditAction[] = [
  'Improve Writing',
  'Improve Opening',
  'Improve Closing',
  'Make More Professional',
  'Make More Natural',
  'Shorten',
  'Expand',
  'Fix Grammar',
  'Remove Repetition',
];

const PARAGRAPH_ACTIONS: CoverLetterEditAction[] = [
  'Rewrite Paragraph',
  'Improve Writing',
  'Shorten',
  'Expand',
  'Fix Grammar',
  'Remove Repetition',
];

const ACCENT_PRESETS = ['#1C1917', '#0F172A', '#1E3A5F', '#1D4ED8', '#14532D', '#7F1D1D'];

const INPUT_CLS =
  'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors';
const LABEL_CLS = 'block text-xs font-medium text-slate-600 mb-1';

interface PendingAiReview {
  mode: 'generate' | 'edit';
  title: string;
  rationale?: string;
  groundingNotes?: string[];
  salutation?: string;
  closingSignOff?: string;
  paragraphs: Array<{ id?: string; label: string; text: string }>;
}

export function CoverLetterModule() {
  const {
    coverLetters,
    activeCoverLetter,
    setActiveCoverLetterId,
    createCoverLetter,
    duplicateCoverLetter,
    renameCoverLetter,
    updateCoverLetter,
    deleteCoverLetter,
    profile,
    resumes,
    jobs,
    getCompanyResearchForJob,
    getJobMatchForJob,
    setSelectedJobId,
    setActiveModule,
    openReviewCenter,
    documentSnapshots,
    recordDocumentSnapshot,
    undoLatestSnapshotForDocument,
  } = useCareer();

  const [centerTab, setCenterTab] = useState<'letter' | 'parties' | 'job' | 'formatting' | 'quality'>('letter');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [exportingDocx, setExportingDocx] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'left' | 'center' | 'right'>('center');
  const [pageCount, setPageCount] = useState(1);

  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingAiReview | null>(null);

  const previewData = useMemo(() => {
    if (!activeCoverLetter) return { blocks: [], paperColor: '#FFFFFF' };
    return buildCoverLetterPreviewBlocks(activeCoverLetter);
  }, [activeCoverLetter]);

  const linkedResumeForScore = activeCoverLetter?.linkedResumeId
    ? resumes.find((r) => r.id === activeCoverLetter.linkedResumeId)
    : undefined;

  const qualityReport = useMemo(() => {
    if (!activeCoverLetter) return null;
    return evaluateCoverLetterStandards(activeCoverLetter, linkedResumeForScore, pageCount);
  }, [activeCoverLetter, linkedResumeForScore, pageCount]);

  if (!activeCoverLetter) {
    return (
      <div className="p-12 text-center">
        <button
          type="button"
          onClick={() => createCoverLetter({ prefillFromProfile: true })}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md cursor-pointer"
        >
          Create First Cover Letter
        </button>
      </div>
    );
  }

  const linkedResume = activeCoverLetter.linkedResumeId
    ? resumes.find((r) => r.id === activeCoverLetter.linkedResumeId)
    : undefined;
  const linkedJob = activeCoverLetter.linkedJobId
    ? jobs.find((j) => j.id === activeCoverLetter.linkedJobId)
    : undefined;
  const linkedResearch = linkedJob ? getCompanyResearchForJob(linkedJob.id) : undefined;
  const linkedMatch = linkedJob ? getJobMatchForJob(linkedJob.id) : undefined;

  const effectiveJobContext: JobApplication | undefined =
    linkedJob ||
    (activeCoverLetter.employer.companyName || activeCoverLetter.jobInfo.jobDescription
      ? {
          id: `manual-${activeCoverLetter.id}`,
          company: activeCoverLetter.employer.companyName,
          jobTitle: activeCoverLetter.employer.jobTitle,
          department: activeCoverLetter.employer.department,
          companyAddress: activeCoverLetter.employer.companyAddress,
          hiringManager: activeCoverLetter.employer.hiringManager,
          applicationDate: activeCoverLetter.employer.applicationDate,
          status: 'Saved',
          jobDescription: activeCoverLetter.jobInfo.jobDescription,
          requiredQualifications: activeCoverLetter.jobInfo.requiredQualifications,
          preferredQualifications: activeCoverLetter.jobInfo.preferredQualifications,
          responsibilities: activeCoverLetter.jobInfo.responsibilities,
          technicalRequirements: activeCoverLetter.jobInfo.technicalRequirements,
          createdAt: activeCoverLetter.createdAt,
          updatedAt: activeCoverLetter.updatedAt,
        }
      : undefined);

  const getParagraphFieldType = (
    para: CoverLetterParagraph,
    idx: number,
    total: number
  ): CompanionFieldType => {
    const lbl = para.label.toLowerCase();
    if (lbl.includes('open') || lbl.includes('intro') || idx === 0) {
      return 'Cover Letter Opening';
    }
    if (lbl.includes('clos') || (total > 1 && idx === total - 1)) {
      return 'Cover Letter Closing';
    }
    return 'Cover Letter Body';
  };

  const importProfileApplicant = () => {
    updateCoverLetter(activeCoverLetter.id, (prev) => ({
      ...prev,
      applicant: {
        fullName: profile.personal.fullName,
        email: profile.personal.email,
        phone: profile.personal.phone,
        location: profile.personal.location,
        linkedin: profile.personal.linkedin,
        portfolio: profile.personal.portfolio,
        website: profile.personal.website,
      },
      content: {
        ...prev.content,
        signatureName: profile.personal.fullName,
      },
    }));
  };

  const importFromJob = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) {
      updateCoverLetter(activeCoverLetter.id, (prev) => ({ ...prev, linkedJobId: undefined }));
      return;
    }
    updateCoverLetter(activeCoverLetter.id, (prev) => ({
      ...prev,
      linkedJobId: job.id,
      employer: {
        ...prev.employer,
        companyName: job.company,
        hiringManager: job.hiringManager,
        jobTitle: job.jobTitle,
        department: job.department,
        companyAddress: job.companyAddress,
      },
      jobInfo: {
        jobDescription: job.jobDescription,
        requiredQualifications: [...job.requiredQualifications],
        preferredQualifications: [...job.preferredQualifications],
        responsibilities: [...job.responsibilities],
        technicalRequirements: [...job.technicalRequirements],
      },
      content: {
        ...prev.content,
        salutation: job.hiringManager ? `Dear ${job.hiringManager},` : prev.content.salutation,
      },
    }));
  };

  const handleGenerateLetter = async () => {
    setAiError(null);
    setAiLoading(true);
    try {
      const res = await generateCoverLetterWithAi({
        applicant: activeCoverLetter.applicant,
        employer: activeCoverLetter.employer,
        jobInfo: activeCoverLetter.jobInfo,
        careerProfile: profile,
        selectedResume: linkedResume,
        writingStyle: activeCoverLetter.writingStyle,
        length: activeCoverLetter.length,
        companyResearch: linkedResearch,
        jobMatch: linkedMatch,
      });

      setPendingReview({
        mode: 'generate',
        title: 'Review Generated Cover Letter',
        rationale: `Generated in ${activeCoverLetter.writingStyle} style (${activeCoverLetter.length} length) grounded strictly in your Career Profile${linkedResume ? ` and "${linkedResume.name}"` : ''}${linkedResearch?.status === 'completed' ? ` + verified Company Intelligence for ${linkedResearch.companyName}` : ''}.`,
        groundingNotes: res.groundingNotes,
        salutation: res.salutation,
        closingSignOff: res.closingSignOff,
        paragraphs: res.paragraphs.map((p, idx) => ({
          id: `gen-${idx}-${crypto.randomUUID().slice(0, 5)}`,
          label: p.label,
          text: p.text,
        })),
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Cover letter generation failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleEditLetterOrParagraph = async (
    action: CoverLetterEditAction,
    paragraph?: CoverLetterParagraph
  ) => {
    setAiError(null);
    setAiLoading(true);
    try {
      const res = await editCoverLetterWithAi({
        action,
        paragraphId: paragraph?.id,
        currentParagraphText: paragraph?.text,
        allParagraphs: activeCoverLetter.content.paragraphs,
        writingStyle: activeCoverLetter.writingStyle,
        employer: activeCoverLetter.employer,
        jobInfo: activeCoverLetter.jobInfo,
        careerProfile: profile,
        selectedResume: linkedResume,
        companyResearch: linkedResearch,
        jobMatch: linkedMatch,
      });

      setPendingReview({
        mode: 'edit',
        title: paragraph ? `Review "${action}" on ${paragraph.label}` : `Review "${action}"`,
        rationale: res.rationale,
        paragraphs: res.updatedParagraphs,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Cover letter edit failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const applyPendingReview = () => {
    if (!pendingReview) return;
    recordDocumentSnapshot(
      'cover-letter',
      activeCoverLetter.id,
      `ai-cl-${pendingReview.mode}-${Date.now()}`,
      `Before AI Cover Letter ${pendingReview.mode === 'generate' ? 'Generate' : 'Edit'} (v${activeCoverLetter.version})`
    );
    updateCoverLetter(activeCoverLetter.id, (prev) => {
      if (pendingReview.mode === 'generate') {
        return {
          ...prev,
          version: prev.version + 1,
          content: {
            ...prev.content,
            salutation: pendingReview.salutation || prev.content.salutation,
            closingSignOff: pendingReview.closingSignOff || prev.content.closingSignOff,
            paragraphs: pendingReview.paragraphs.map((p, idx) => ({
              id: p.id || `p-${idx}-${crypto.randomUUID().slice(0, 5)}`,
              label: p.label,
              text: p.text,
            })),
          },
        };
      }

      // Edit mode: replace matching paragraphs by id, or replace full paragraph list if all ids match
      const nextParagraphs = prev.content.paragraphs.map((existing) => {
        const match = pendingReview.paragraphs.find((u) => u.id === existing.id);
        return match ? { ...existing, text: match.text } : existing;
      });
      return {
        ...prev,
        version: prev.version + 1,
        content: {
          ...prev.content,
          paragraphs: nextParagraphs,
        },
      };
    });
    setPendingReview(null);
  };

  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      await exportCoverLetterToDocx(activeCoverLetter);
    } finally {
      setExportingDocx(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Mobile Panel Switcher */}
      <div className="lg:hidden flex items-center border-b border-slate-200 bg-white px-4 py-2 gap-2 shrink-0">
        {(['left', 'center', 'right'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMobilePanel(p)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              mobilePanel === p ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {p === 'left' ? 'Letters & Templates' : p === 'center' ? 'Editor' : 'Live Preview'}
          </button>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_520px] xl:grid-cols-[270px_minmax(0,1fr)_570px] min-h-0 overflow-hidden">
        {/* LEFT SIDEBAR: Create New, Saved Letters, Recent, Templates, Settings */}
        <aside
          className={`${
            mobilePanel === 'left' ? 'flex' : 'hidden lg:flex'
          } flex-col bg-white border-r border-slate-200 min-h-0 overflow-y-auto p-4 space-y-5`}
        >
          <button
            type="button"
            onClick={() => createCoverLetter({ prefillFromProfile: true })}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create New Cover Letter
          </button>

          {/* Saved Cover Letters */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-900">Saved Cover Letters</div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
              {coverLetters.map((cl) => {
                const isSelected = cl.id === activeCoverLetter.id;
                return (
                  <button
                    key={cl.id}
                    type="button"
                    onClick={() => setActiveCoverLetterId(cl.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{cl.title}</div>
                    <div
                      className={`text-[11px] mt-0.5 truncate ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      v{cl.version} · {cl.writingStyle}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => duplicateCoverLetter(activeCoverLetter.id)}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                Duplicate
              </button>
              <button
                type="button"
                disabled={coverLetters.length <= 1}
                onClick={() => deleteCoverLetter(activeCoverLetter.id)}
                aria-label="Delete cover letter"
                className="px-2.5 py-1.5 text-[11px] text-slate-600 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 rounded cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Recent Documents */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-900">Recent Documents</div>
            {[...coverLetters]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 3)
              .map((doc) => (
                <button
                  key={`rec-${doc.id}`}
                  type="button"
                  onClick={() => setActiveCoverLetterId(doc.id)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 truncate cursor-pointer"
                >
                  {doc.title}
                </button>
              ))}
          </div>

          <hr className="border-slate-200" />

          {/* Document Profile Presets */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-900">Document Profile</div>
            <div className="space-y-1.5">
              {(Object.keys(DOCUMENT_PROFILES) as DocumentProfileId[]).map((profId) => {
                const prof = DOCUMENT_PROFILES[profId];
                const isSelected =
                  (activeCoverLetter.documentProfile || 'modern-professional') === profId;
                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() =>
                      updateCoverLetter(activeCoverLetter.id, (prev) => ({
                        ...prev,
                        documentProfile: prof.id,
                        template: prof.coverLetterTemplate,
                        formatting: { ...prof.coverLetterFormatting },
                      }))
                    }
                    className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 hover:border-slate-300 text-slate-900'
                    }`}
                  >
                    <div className="text-xs font-semibold">{prof.label}</div>
                    <div
                      className={`text-[11px] line-clamp-2 mt-0.5 ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {prof.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Templates */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-900">Templates</div>
            <div className="space-y-1.5">
              {CL_TEMPLATES.map((tpl) => {
                const isSelected = activeCoverLetter.template === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() =>
                      updateCoverLetter(activeCoverLetter.id, (prev) => ({
                        ...prev,
                        template: tpl.id,
                      }))
                    }
                    className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-900">{tpl.label}</div>
                    <div className="text-[11px] text-slate-500 truncate">{tpl.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCenterTab('formatting');
              setMobilePanel('center');
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            Document Settings
          </button>
        </aside>

        {/* CENTER EDITOR */}
        <section
          className={`${
            mobilePanel === 'center' ? 'flex' : 'hidden lg:flex'
          } flex-col bg-slate-50 min-h-0 overflow-hidden`}
        >
          <div className="shrink-0 bg-white border-b border-slate-200 px-5 py-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              {editingTitle ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        renameCoverLetter(activeCoverLetter.id, titleDraft);
                        setEditingTitle(false);
                      }
                    }}
                    className="px-2.5 py-1 text-sm font-semibold border border-slate-300 rounded-md flex-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      renameCoverLetter(activeCoverLetter.id, titleDraft);
                      setEditingTitle(false);
                    }}
                    className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-sm font-semibold text-slate-900 truncate">
                    {activeCoverLetter.title}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(activeCoverLetter.title);
                      setEditingTitle(true);
                    }}
                    aria-label="Rename cover letter"
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 shrink-0">
                {documentSnapshots.some(
                  (s) => s.documentKind === 'cover-letter' && s.documentId === activeCoverLetter.id
                ) && (
                  <button
                    type="button"
                    onClick={() =>
                      undoLatestSnapshotForDocument('cover-letter', activeCoverLetter.id)
                    }
                    title="Restore the version saved right before the last AI edit"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Undo AI Edit
                  </button>
                )}
                {qualityReport && (
                  <button
                    type="button"
                    onClick={() => setCenterTab('quality')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap font-mono-tabular"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    {qualityReport.totalScore}/100
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    openReviewCenter({
                      coverLetterId: activeCoverLetter.id,
                      resumeId: activeCoverLetter.linkedResumeId,
                      jobId: activeCoverLetter.linkedJobId,
                      scope: activeCoverLetter.linkedResumeId
                        ? 'full_application'
                        : 'cover_letter_only',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  AI Review
                </button>
                <button
                  type="button"
                  onClick={importProfileApplicant}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Import Profile
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(
                [
                  { id: 'letter', label: 'Writing & AI' },
                  { id: 'parties', label: 'Parties' },
                  { id: 'job', label: 'Job Context' },
                  { id: 'formatting', label: 'Formatting' },
                  { id: 'quality', label: 'Quality Report' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCenterTab(t.id)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    centerTab === t.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {aiError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                {aiError}
              </div>
            )}

            {centerTab === 'letter' && (
              <div className="space-y-5">
                {/* Context & AI Generator Bar */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLS}>Reference Resume</label>
                      <select
                        value={activeCoverLetter.linkedResumeId || ''}
                        onChange={(e) =>
                          updateCoverLetter(activeCoverLetter.id, (prev) => ({
                            ...prev,
                            linkedResumeId: e.target.value || undefined,
                          }))
                        }
                        className={INPUT_CLS}
                      >
                        <option value="">Career Profile Only</option>
                        {resumes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={LABEL_CLS}>Target Job Application</label>
                      <select
                        value={activeCoverLetter.linkedJobId || ''}
                        onChange={(e) => importFromJob(e.target.value)}
                        className={INPUT_CLS}
                      >
                        <option value="">Custom / Manual Entry</option>
                        {jobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.company} — {j.jobTitle}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={LABEL_CLS}>Writing Style</label>
                      <select
                        value={activeCoverLetter.writingStyle}
                        onChange={(e) =>
                          updateCoverLetter(activeCoverLetter.id, (prev) => ({
                            ...prev,
                            writingStyle: e.target.value as CoverLetterWritingStyle,
                          }))
                        }
                        className={INPUT_CLS}
                      >
                        {WRITING_STYLES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={LABEL_CLS}>Target Length</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {LENGTH_OPTIONS.map((len) => (
                          <button
                            key={len}
                            type="button"
                            onClick={() =>
                              updateCoverLetter(activeCoverLetter.id, (prev) => ({
                                ...prev,
                                length: len,
                              }))
                            }
                            className={`py-2 text-xs font-medium rounded-md border cursor-pointer ${
                              activeCoverLetter.length === len
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            {len}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={handleGenerateLetter}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {aiLoading
                        ? 'Generating Tailored Letter...'
                        : 'Generate Tailored Cover Letter with AI'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openReviewCenter({
                          coverLetterId: activeCoverLetter.id,
                          resumeId: activeCoverLetter.linkedResumeId,
                          jobId: activeCoverLetter.linkedJobId,
                          scope: activeCoverLetter.linkedResumeId
                            ? 'full_application'
                            : 'cover_letter_only',
                        })
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                      AI Application Review
                    </button>
                  </div>

                  {linkedJob && (
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {linkedResearch?.status === 'completed' ? (
                          <span>
                            Company Intelligence ready for{' '}
                            <strong className="text-slate-900">{linkedResearch.companyName}</strong>{' '}
                            <span className="font-mono-tabular text-emerald-800">
                              (
                              {
                                linkedResearch.findings.filter(
                                  (f) => f.verificationStatus === 'approved'
                                ).length
                              }{' '}
                              approved findings)
                            </span>
                          </span>
                        ) : (
                          <span>
                            No Company Research linked for <strong>{linkedJob.company}</strong> yet.
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJobId(linkedJob.id);
                          setActiveModule('jobs');
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 underline cursor-pointer"
                      >
                        <span>
                          {linkedResearch?.status === 'completed'
                            ? 'Inspect Research'
                            : 'Research Company'}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Full-Letter AI Editing Actions */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <Wand2 className="w-3.5 h-3.5 text-slate-600" />
                    AI Editing Actions (Review Before Applying)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {FULL_LETTER_ACTIONS.map((action) => (
                      <button
                        key={action}
                        type="button"
                        disabled={aiLoading}
                        onClick={() => handleEditLetterOrParagraph(action)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer disabled:opacity-50"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Structured Letter Content Editor */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
                  <div>
                    <label className={LABEL_CLS}>Salutation</label>
                    <input
                      type="text"
                      value={activeCoverLetter.content.salutation}
                      onChange={(e) =>
                        updateCoverLetter(activeCoverLetter.id, (prev) => ({
                          ...prev,
                          content: { ...prev.content, salutation: e.target.value },
                        }))
                      }
                      className={INPUT_CLS}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">
                        Letter Paragraphs ({activeCoverLetter.content.paragraphs.length})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateCoverLetter(activeCoverLetter.id, (prev) => ({
                            ...prev,
                            content: {
                              ...prev.content,
                              paragraphs: [
                                ...prev.content.paragraphs,
                                {
                                  id: `p-${crypto.randomUUID().slice(0, 6)}`,
                                  label: `Paragraph ${prev.content.paragraphs.length + 1}`,
                                  text: '',
                                },
                              ],
                            },
                          }))
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Add Paragraph
                      </button>
                    </div>

                    {activeCoverLetter.content.paragraphs.map((para, idx) => (
                      <div
                        key={para.id}
                        className="p-3.5 border border-slate-200 rounded-lg space-y-2.5 bg-slate-50/50"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <input
                            type="text"
                            value={para.label}
                            onChange={(e) =>
                              updateCoverLetter(activeCoverLetter.id, (prev) => ({
                                ...prev,
                                content: {
                                  ...prev.content,
                                  paragraphs: prev.content.paragraphs.map((p) =>
                                    p.id === para.id ? { ...p, label: e.target.value } : p
                                  ),
                                },
                              }))
                            }
                            className="text-xs font-semibold text-slate-900 bg-transparent border-b border-transparent focus:border-slate-400 focus:outline-none"
                          />
                          <div className="flex items-center gap-1 flex-wrap">
                            <AIWritingCompanion
                              fieldType={getParagraphFieldType(
                                para,
                                idx,
                                activeCoverLetter.content.paragraphs.length
                              )}
                              fieldKey={`cl.para.${para.id}`}
                              fieldLabel={`${para.label}${activeCoverLetter.employer.companyName ? ` · ${activeCoverLetter.employer.companyName}` : ''}`}
                              currentValue={para.text}
                              documentType="cover-letter"
                              documentId={activeCoverLetter.id}
                              documentTitle={activeCoverLetter.title}
                              documentVersion={activeCoverLetter.version}
                              documentContext={{
                                coverLetter: activeCoverLetter,
                                selectedResume: linkedResume,
                              }}
                              careerProfile={profile}
                              jobContext={effectiveJobContext}
                              companyResearch={linkedResearch}
                              onApply={(newText) =>
                                updateCoverLetter(activeCoverLetter.id, (prev) => ({
                                  ...prev,
                                  content: {
                                    ...prev.content,
                                    paragraphs: prev.content.paragraphs.map((p) =>
                                      p.id === para.id ? { ...p, text: newText } : p
                                    ),
                                  },
                                }))
                              }
                              onCancel={() => {}}
                            />
                            {PARAGRAPH_ACTIONS.map((act) => (
                              <button
                                key={act}
                                type="button"
                                disabled={aiLoading}
                                onClick={() => handleEditLetterOrParagraph(act, para)}
                                className="px-2 py-0.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 hover:border-slate-400 rounded cursor-pointer disabled:opacity-40"
                              >
                                {act === 'Rewrite Paragraph' ? 'Rewrite' : act}
                              </button>
                            ))}
                            <button
                              type="button"
                              disabled={activeCoverLetter.content.paragraphs.length <= 1}
                              onClick={() =>
                                updateCoverLetter(activeCoverLetter.id, (prev) => ({
                                  ...prev,
                                  content: {
                                    ...prev.content,
                                    paragraphs: prev.content.paragraphs.filter(
                                      (_, i) => i !== idx
                                    ),
                                  },
                                }))
                              }
                              aria-label="Delete paragraph"
                              className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={4}
                          value={para.text}
                          onChange={(e) =>
                            updateCoverLetter(activeCoverLetter.id, (prev) => ({
                              ...prev,
                              content: {
                                ...prev.content,
                                paragraphs: prev.content.paragraphs.map((p) =>
                                  p.id === para.id ? { ...p, text: e.target.value } : p
                                ),
                              },
                            }))
                          }
                          placeholder="Write or generate paragraph content..."
                          className={`${INPUT_CLS} leading-relaxed`}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className={LABEL_CLS}>Closing Sign-Off</label>
                      <input
                        type="text"
                        value={activeCoverLetter.content.closingSignOff}
                        onChange={(e) =>
                          updateCoverLetter(activeCoverLetter.id, (prev) => ({
                            ...prev,
                            content: { ...prev.content, closingSignOff: e.target.value },
                          }))
                        }
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Signature Name</label>
                      <input
                        type="text"
                        value={activeCoverLetter.content.signatureName}
                        onChange={(e) =>
                          updateCoverLetter(activeCoverLetter.id, (prev) => ({
                            ...prev,
                            content: { ...prev.content, signatureName: e.target.value },
                          }))
                        }
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {centerTab === 'parties' && (
              <div className="space-y-5">
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Applicant Information</h3>
                    <button
                      type="button"
                      onClick={importProfileApplicant}
                      className="text-xs font-medium text-slate-700 hover:text-slate-900 underline cursor-pointer"
                    >
                      Sync from Career Profile
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      [
                        ['fullName', 'Full Name'],
                        ['email', 'Email'],
                        ['phone', 'Phone'],
                        ['location', 'Location'],
                        ['linkedin', 'LinkedIn'],
                        ['portfolio', 'Portfolio'],
                        ['website', 'Website'],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className={key === 'website' ? 'sm:col-span-2' : ''}>
                        <label className={LABEL_CLS}>{label}</label>
                        <input
                          type="text"
                          value={activeCoverLetter.applicant[key]}
                          onChange={(e) =>
                            updateCoverLetter(activeCoverLetter.id, (prev) => ({
                              ...prev,
                              applicant: { ...prev.applicant, [key]: e.target.value },
                            }))
                          }
                          className={INPUT_CLS}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3.5">
                  <h3 className="text-sm font-semibold text-slate-900">Employer Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      [
                        ['companyName', 'Company Name'],
                        ['hiringManager', 'Hiring Manager'],
                        ['jobTitle', 'Job Title'],
                        ['department', 'Department'],
                        ['applicationDate', 'Application Date'],
                        ['companyAddress', 'Company Address'],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className={key === 'companyAddress' ? 'sm:col-span-2' : ''}>
                        <label className={LABEL_CLS}>{label}</label>
                        <input
                          type="text"
                          value={activeCoverLetter.employer[key]}
                          onChange={(e) =>
                            updateCoverLetter(activeCoverLetter.id, (prev) => ({
                              ...prev,
                              employer: { ...prev.employer, [key]: e.target.value },
                            }))
                          }
                          className={INPUT_CLS}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {centerTab === 'job' && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-slate-500" />
                      Job Information
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Import from Job Tracker or paste custom requirements for AI cover letter tailoring.
                    </p>
                  </div>
                  <select
                    value={activeCoverLetter.linkedJobId || ''}
                    onChange={(e) => importFromJob(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
                  >
                    <option value="">Import from Job Tracker...</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.company} — {j.jobTitle}
                      </option>
                    ))}
                  </select>
                </div>

                {linkedJob && (linkedResearch?.status === 'completed' || linkedMatch) && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        Verified Company Intelligence · {linkedJob.company}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJobId(linkedJob.id);
                          setActiveModule('jobs');
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:underline cursor-pointer"
                      >
                        <span>Manage Findings</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    {linkedResearch?.report.servicesAndSpecialties && (
                      <p className="text-slate-600 leading-relaxed">
                        <strong>Services:</strong> {linkedResearch.report.servicesAndSpecialties}
                      </p>
                    )}
                    {linkedResearch?.report.projectsAndPortfolio && (
                      <p className="text-slate-600 leading-relaxed">
                        <strong>Projects:</strong> {linkedResearch.report.projectsAndPortfolio}
                      </p>
                    )}
                    {linkedMatch && linkedMatch.recommendedCoverLetterTalkingPoints.length > 0 && (
                      <div className="pt-1">
                        <div className="font-semibold text-slate-800 mb-1">
                          Recommended Cover Letter Talking Points
                        </div>
                        <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                          {linkedMatch.recommendedCoverLetterTalkingPoints.map((tp, idx) => (
                            <li key={idx}>{tp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className={LABEL_CLS}>Job Description</label>
                  <textarea
                    rows={5}
                    value={activeCoverLetter.jobInfo.jobDescription}
                    onChange={(e) =>
                      updateCoverLetter(activeCoverLetter.id, (prev) => ({
                        ...prev,
                        jobInfo: { ...prev.jobInfo, jobDescription: e.target.value },
                      }))
                    }
                    className={`${INPUT_CLS} leading-relaxed`}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={LABEL_CLS}>Required Qualifications (one per line)</label>
                    <textarea
                      rows={4}
                      value={activeCoverLetter.jobInfo.requiredQualifications.join('\n')}
                      onChange={(e) =>
                        updateCoverLetter(activeCoverLetter.id, (prev) => ({
                          ...prev,
                          jobInfo: {
                            ...prev.jobInfo,
                            requiredQualifications: e.target.value
                              .split('\n')
                              .filter((l) => l.trim()),
                          },
                        }))
                      }
                      className={`${INPUT_CLS} text-xs`}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Preferred Qualifications (one per line)</label>
                    <textarea
                      rows={4}
                      value={activeCoverLetter.jobInfo.preferredQualifications.join('\n')}
                      onChange={(e) =>
                        updateCoverLetter(activeCoverLetter.id, (prev) => ({
                          ...prev,
                          jobInfo: {
                            ...prev.jobInfo,
                            preferredQualifications: e.target.value
                              .split('\n')
                              .filter((l) => l.trim()),
                          },
                        }))
                      }
                      className={`${INPUT_CLS} text-xs`}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Key Responsibilities (one per line)</label>
                    <textarea
                      rows={4}
                      value={activeCoverLetter.jobInfo.responsibilities.join('\n')}
                      onChange={(e) =>
                        updateCoverLetter(activeCoverLetter.id, (prev) => ({
                          ...prev,
                          jobInfo: {
                            ...prev.jobInfo,
                            responsibilities: e.target.value.split('\n').filter((l) => l.trim()),
                          },
                        }))
                      }
                      className={`${INPUT_CLS} text-xs`}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Technical Requirements (comma-separated)</label>
                    <textarea
                      rows={4}
                      value={activeCoverLetter.jobInfo.technicalRequirements.join(', ')}
                      onChange={(e) =>
                        updateCoverLetter(activeCoverLetter.id, (prev) => ({
                          ...prev,
                          jobInfo: {
                            ...prev.jobInfo,
                            technicalRequirements: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        }))
                      }
                      className={`${INPUT_CLS} text-xs`}
                    />
                  </div>
                </div>
              </div>
            )}

            {centerTab === 'formatting' && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Cover Letter Formatting</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Shared settings apply cleanly across live preview, DOCX export, and PDF export.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLS}>Font Family</label>
                    <select
                      value={activeCoverLetter.formatting.fontFamily}
                      onChange={(e) =>
                        updateCoverLetter(activeCoverLetter.id, (prev) => ({
                          ...prev,
                          formatting: {
                            ...prev.formatting,
                            fontFamily: e.target.value as DocumentFontFamily,
                          },
                        }))
                      }
                      className={INPUT_CLS}
                    >
                      <option value="editorial">Editorial Serif (Fraunces / Garamond)</option>
                      <option value="serif">Classic Serif (Source Serif / Georgia)</option>
                      <option value="sans">Modern Sans (Plus Jakarta / Calibri)</option>
                      <option value="mono">Technical Mono (JetBrains / Consolas)</option>
                    </select>
                  </div>

                  <div>
                    <label className={LABEL_CLS}>Text Alignment</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['left', 'justify'] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() =>
                            updateCoverLetter(activeCoverLetter.id, (prev) => ({
                              ...prev,
                              formatting: { ...prev.formatting, textAlignment: align },
                            }))
                          }
                          className={`py-2 text-xs font-medium rounded-md border capitalize cursor-pointer ${
                            activeCoverLetter.formatting.textAlignment === align
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                      <span>Font Size</span>
                      <span className="font-mono-tabular">
                        {activeCoverLetter.formatting.fontSize}pt
                      </span>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={12.5}
                      step={0.5}
                      value={activeCoverLetter.formatting.fontSize}
                      onChange={(e) =>
                        updateCoverLetter(activeCoverLetter.id, (prev) => ({
                          ...prev,
                          formatting: { ...prev.formatting, fontSize: Number(e.target.value) },
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                      <span>Heading Size</span>
                      <span className="font-mono-tabular">
                        {activeCoverLetter.formatting.headingSize}pt
                      </span>
                    </label>
                    <input
                      type="range"
                      min={13}
                      max={22}
                      step={0.5}
                      value={activeCoverLetter.formatting.headingSize}
                      onChange={(e) =>
                        updateCoverLetter(activeCoverLetter.id, (prev) => ({
                          ...prev,
                          formatting: { ...prev.formatting, headingSize: Number(e.target.value) },
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                      <span>Margins</span>
                      <span className="font-mono-tabular">
                        {activeCoverLetter.formatting.pageMargins.toFixed(2)} in
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0.6}
                      max={1.1}
                      step={0.05}
                      value={activeCoverLetter.formatting.pageMargins}
                      onChange={(e) =>
                        updateCoverLetter(activeCoverLetter.id, (prev) => ({
                          ...prev,
                          formatting: { ...prev.formatting, pageMargins: Number(e.target.value) },
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                      <span>Line Spacing</span>
                      <span className="font-mono-tabular">
                        {activeCoverLetter.formatting.lineSpacing}x
                      </span>
                    </label>
                    <input
                      type="range"
                      min={1.15}
                      max={1.65}
                      step={0.05}
                      value={activeCoverLetter.formatting.lineSpacing}
                      onChange={(e) =>
                        updateCoverLetter(activeCoverLetter.id, (prev) => ({
                          ...prev,
                          formatting: { ...prev.formatting, lineSpacing: Number(e.target.value) },
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                      <span>Paragraph Spacing</span>
                      <span className="font-mono-tabular">
                        {activeCoverLetter.formatting.paragraphSpacing}px
                      </span>
                    </label>
                    <input
                      type="range"
                      min={8}
                      max={22}
                      step={2}
                      value={activeCoverLetter.formatting.paragraphSpacing}
                      onChange={(e) =>
                        updateCoverLetter(activeCoverLetter.id, (prev) => ({
                          ...prev,
                          formatting: {
                            ...prev.formatting,
                            paragraphSpacing: Number(e.target.value),
                          },
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLS}>Accent Color</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {ACCENT_PRESETS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() =>
                            updateCoverLetter(activeCoverLetter.id, (prev) => ({
                              ...prev,
                              formatting: { ...prev.formatting, accentColor: hex },
                            }))
                          }
                          className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                            activeCoverLetter.formatting.accentColor === hex
                              ? 'border-slate-900 scale-110'
                              : 'border-white shadow-xs'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                      <input
                        type="color"
                        aria-label="Custom cover letter accent color"
                        value={activeCoverLetter.formatting.accentColor}
                        onChange={(e) =>
                          updateCoverLetter(activeCoverLetter.id, (prev) => ({
                            ...prev,
                            formatting: { ...prev.formatting, accentColor: e.target.value },
                          }))
                        }
                        className="w-7 h-7 rounded cursor-pointer border border-slate-200"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {centerTab === 'quality' && qualityReport && (
              <QualityReportPanel
                report={qualityReport}
                aiLoading={aiLoading}
                onOptimizeWithAi={() => handleEditLetterOrParagraph('Improve Writing')}
                optimizeLabel="Improve Letter to Standards with AI"
              />
            )}
          </div>
        </section>

        {/* RIGHT PANEL: Live Document Preview & Export */}
        <section
          className={`${
            mobilePanel === 'right' ? 'flex' : 'hidden lg:flex'
          } flex-col min-h-0 overflow-hidden`}
        >
          <PaginatedPaperPreview
            blocks={previewData.blocks}
            paperColor={previewData.paperColor}
            pageMarginsInches={activeCoverLetter.formatting.pageMargins}
            documentTitle={activeCoverLetter.title}
            onExportDocx={handleExportDocx}
            onExportPdf={() => exportCoverLetterToPdf(activeCoverLetter)}
            isExportingDocx={exportingDocx}
            onPageCountChange={setPageCount}
          />
        </section>
      </div>

      {/* Reviewable AI Diff Modal */}
      <AiDiffModal
        isOpen={Boolean(pendingReview)}
        title={pendingReview?.title || 'Review AI Proposal'}
        subtitle="Inspect every proposed paragraph before applying it to your cover letter."
        rationale={pendingReview?.rationale}
        notes={pendingReview?.groundingNotes}
        onDiscard={() => setPendingReview(null)}
        onApply={applyPendingReview}
        applyLabel="Apply to Cover Letter"
      >
        {pendingReview && (
          <div className="space-y-3">
            {pendingReview.salutation && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs">
                <span className="font-semibold text-slate-700">Salutation: </span>
                <span className="text-slate-900">{pendingReview.salutation}</span>
              </div>
            )}
            {pendingReview.paragraphs.map((p, idx) => {
              const original = activeCoverLetter.content.paragraphs.find((o) => o.id === p.id);
              return (
                <div key={p.id || idx} className="border border-slate-200 rounded-lg p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-slate-900">{p.label}</div>
                  {original ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
                      <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-600">
                        <div className="font-semibold text-slate-500 mb-1">Current</div>
                        {original.text || '(Empty)'}
                      </div>
                      <div className="p-2.5 bg-emerald-50/50 rounded border border-emerald-200 text-slate-900">
                        <div className="font-semibold text-emerald-800 mb-1">Proposed</div>
                        {p.text}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50/50 rounded border border-emerald-200 text-xs text-slate-900 leading-relaxed">
                      {p.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AiDiffModal>
    </div>
  );
}

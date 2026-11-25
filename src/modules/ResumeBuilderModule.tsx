import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ListOrdered,
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
  DocumentFontFamily,
  DocumentProfileId,
  ResumeAssistAction,
  ResumeAssistResponse,
  ResumeSectionKey,
  ResumeTemplateId,
} from '../types/career';
import { ResumeSectionsEditor } from '../components/ResumeSectionsEditor';
import { PaginatedPaperPreview } from '../components/PaginatedPaperPreview';
import { buildResumePreviewBlocks } from '../components/ResumeBlocksBuilder';
import { exportResumeToDocx, exportResumeToPdf } from '../services/resumeExport';
import { assistResumeWithAi } from '../services/aiService';
import { AiDiffModal } from '../components/AiDiffModal';
import { DOCUMENT_PROFILES, evaluateResumeStandards } from '../services/standardsEngine';
import { QualityReportPanel } from '../components/QualityReportPanel';

const TEMPLATES: Array<{ id: ResumeTemplateId; label: string; desc: string }> = [
  { id: 'modern', label: 'Modern', desc: 'Clean editorial serif & refined spacing' },
  { id: 'professional', label: 'Professional', desc: 'Traditional structured executive layout' },
  { id: 'minimal', label: 'Minimal', desc: 'Understated typography & open margins' },
  { id: 'technical', label: 'Technical', desc: 'Monospace accents & stack clarity' },
  { id: 'creative', label: 'Creative', desc: 'Expressive accent rule & contrast' },
];

const ACCENT_PRESETS = [
  { label: 'Charcoal', value: '#1C1917' },
  { label: 'Slate', value: '#0F172A' },
  { label: 'Navy', value: '#1E3A5F' },
  { label: 'Cobalt', value: '#1D4ED8' },
  { label: 'Forest', value: '#14532D' },
  { label: 'Burgundy', value: '#7F1D1D' },
];

export function ResumeBuilderModule() {
  const {
    resumes,
    activeResume,
    setActiveResumeId,
    createResume,
    duplicateResume,
    renameResume,
    updateResume,
    deleteResume,
    importProfileIntoResume,
    profile,
    jobs,
    getCompanyResearchForJob,
    getJobMatchForJob,
    setSelectedJobId,
    setActiveModule,
    openReviewCenter,
    tailorLaunchRequest,
    clearTailorLaunchRequest,
    documentSnapshots,
    recordDocumentSnapshot,
    undoLatestSnapshotForDocument,
    exportDocumentToDrive,
    notifyDocumentMilestoneExport,
  } = useCareer();

  const [activeSection, setActiveSection] = useState<'personal' | ResumeSectionKey>('personal');
  const [centerTab, setCenterTab] = useState<'content' | 'formatting' | 'ai' | 'quality'>('content');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingDrive, setExportingDrive] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'left' | 'center' | 'right'>('center');
  const [pageCount, setPageCount] = useState(1);

  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProposal, setAiProposal] = useState<ResumeAssistResponse | null>(null);
  const [applySummaryCheck, setApplySummaryCheck] = useState(true);
  const [applyExpChecks, setApplyExpChecks] = useState<Record<string, boolean>>({});
  const [applySkillsCheck, setApplySkillsCheck] = useState(true);

  const previewData = useMemo(() => {
    if (!activeResume) return { blocks: [], paperColor: '#FFFFFF' };
    return buildResumePreviewBlocks(activeResume);
  }, [activeResume]);

  const linkedJobForScore = activeResume?.linkedJobId
    ? jobs.find((j) => j.id === activeResume.linkedJobId)
    : undefined;

  const qualityReport = useMemo(() => {
    if (!activeResume) return null;
    return evaluateResumeStandards(activeResume, linkedJobForScore, pageCount);
  }, [activeResume, linkedJobForScore, pageCount]);

  useEffect(() => {
    if (!tailorLaunchRequest || !activeResume) return;
    if (tailorLaunchRequest.resumeId !== activeResume.id) return;
    clearTailorLaunchRequest();
    setCenterTab('ai');

    const jobTarget = jobs.find((j) => j.id === tailorLaunchRequest.jobId);
    const jobResearch = jobTarget ? getCompanyResearchForJob(jobTarget.id) : undefined;
    const jobMatchObj = jobTarget ? getJobMatchForJob(jobTarget.id) : undefined;

    setAiError(null);
    setAiLoading(true);
    assistResumeWithAi({
      action: 'tailor_to_job',
      resume: activeResume,
      careerProfile: profile,
      targetJob: jobTarget,
      companyResearch: jobResearch,
      jobMatch: jobMatchObj,
    })
      .then((res) => {
        const expFlags: Record<string, boolean> = {};
        res.experienceUpdates.forEach((eu) => {
          expFlags[eu.id] = true;
        });
        setApplyExpChecks(expFlags);
        setApplySummaryCheck(Boolean(res.proposedHeadline || res.proposedSummary));
        setApplySkillsCheck(res.suggestedSkillsToHighlight.length > 0);
        setAiProposal(res);
      })
      .catch((err) => {
        setAiError(err instanceof Error ? err.message : 'AI tailoring request failed.');
      })
      .finally(() => {
        setAiLoading(false);
      });
  }, [
    activeResume,
    clearTailorLaunchRequest,
    getCompanyResearchForJob,
    getJobMatchForJob,
    jobs,
    profile,
    tailorLaunchRequest,
  ]);

  if (!activeResume) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white border border-slate-200 rounded-lg p-10 text-center space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-slate-900">No resumes created yet</h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            Create your Master Resume seeded from your Career Profile, start a blank resume from scratch, or fill out your profile details first.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => createResume({ name: 'Master Resume', fromProfile: true })}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Master Resume (From Profile)
          </button>
          <button
            type="button"
            onClick={() => createResume({ name: 'Blank Resume', fromProfile: false })}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
          >
            Create Blank Resume
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('profile')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Open Career Profile
          </button>
        </div>
      </div>
    );
  }

  const linkedJob = activeResume.linkedJobId
    ? jobs.find((j) => j.id === activeResume.linkedJobId)
    : undefined;
  const linkedResearch = linkedJob ? getCompanyResearchForJob(linkedJob.id) : undefined;
  const linkedMatch = linkedJob ? getJobMatchForJob(linkedJob.id) : undefined;

  const moveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= activeResume.sections.length) return;
    updateResume(activeResume.id, (prev) => {
      const next = [...prev.sections];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return { ...prev, sections: next };
    });
  };

  const toggleSection = (secId: ResumeSectionKey) => {
    updateResume(activeResume.id, (prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === secId ? { ...s, enabled: !s.enabled } : s)),
    }));
  };

  const applyRecommendedSectionOrder = (recommendedOrder: ResumeSectionKey[]) => {
    if (!recommendedOrder.length) return;
    updateResume(activeResume.id, (prev) => {
      const orderMap = new Map(recommendedOrder.map((k, idx) => [k, idx]));
      const sorted = [...prev.sections].sort(
        (a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99)
      );
      return { ...prev, sections: sorted };
    });
  };

  const handleRunAi = async (action: ResumeAssistAction, experienceId?: string) => {
    setAiError(null);
    setAiLoading(true);
    try {
      const res = await assistResumeWithAi({
        action,
        resume: activeResume,
        careerProfile: profile,
        targetJob: linkedJob,
        experienceId,
        companyResearch: linkedResearch,
        jobMatch: linkedMatch,
      });
      const expFlags: Record<string, boolean> = {};
      res.experienceUpdates.forEach((eu) => {
        expFlags[eu.id] = true;
      });
      setApplyExpChecks(expFlags);
      setApplySummaryCheck(Boolean(res.proposedHeadline || res.proposedSummary));
      setApplySkillsCheck(res.suggestedSkillsToHighlight.length > 0);
      setAiProposal(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI assistant request failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyProposal = () => {
    if (!aiProposal) return;
    recordDocumentSnapshot(
      'resume',
      activeResume.id,
      `ai-resume-assist-${Date.now()}`,
      `Before AI Resume Assist (v${activeResume.version})`
    );
    updateResume(activeResume.id, (prev) => {
      let nextSummary = prev.summary;
      if (applySummaryCheck && (aiProposal.proposedHeadline || aiProposal.proposedSummary)) {
        nextSummary = {
          ...prev.summary,
          headline: aiProposal.proposedHeadline?.trim() || prev.summary.headline,
          summary: aiProposal.proposedSummary?.trim() || prev.summary.summary,
        };
      }

      const nextExp = prev.workExperience.map((exp) => {
        const update = aiProposal.experienceUpdates.find((u) => u.id === exp.id);
        if (!update || !applyExpChecks[exp.id]) return exp;
        return {
          ...exp,
          responsibilities:
            update.responsibilities.length > 0 ? update.responsibilities : exp.responsibilities,
          achievements: update.achievements.length > 0 ? update.achievements : exp.achievements,
        };
      });

      let nextSkills = prev.skills;
      if (applySkillsCheck && aiProposal.suggestedSkillsToHighlight.length > 0) {
        const existingSet = new Set(
          [
            ...prev.skills.technical,
            ...prev.skills.software,
            ...prev.skills.professional,
            ...prev.skills.industry,
          ].map((s) => s.trim().toLowerCase())
        );
        const additions: string[] = [];
        for (const rawSkill of aiProposal.suggestedSkillsToHighlight) {
          const clean = rawSkill.trim();
          if (clean && !existingSet.has(clean.toLowerCase())) {
            existingSet.add(clean.toLowerCase());
            additions.push(clean);
          }
        }
        if (additions.length > 0) {
          nextSkills = {
            ...prev.skills,
            technical: [...prev.skills.technical, ...additions],
          };
        }
      }

      return {
        ...prev,
        version: prev.version + 1,
        summary: nextSummary,
        workExperience: nextExp,
        skills: nextSkills,
      };
    });
    setAiProposal(null);
    setTimeout(() => {
      notifyDocumentMilestoneExport('resume', activeResume.id);
    }, 0);
  };

  const handleCreateTailoredCopy = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    duplicateResume(activeResume.id, `${job.company} — ${job.jobTitle}`, job.id);
  };

  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      await exportResumeToDocx(activeResume);
    } finally {
      setExportingDocx(false);
    }
  };

  const handleExportDrive = async () => {
    setExportingDrive(true);
    try {
      await exportDocumentToDrive({ kind: 'resume', id: activeResume.id });
    } catch {
      // Error surfaced cleanly via CareerContext driveError banner
    } finally {
      setExportingDrive(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
            {p === 'left' ? 'Sections & Versions' : p === 'center' ? 'Editor' : 'Live Preview'}
          </button>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_520px] xl:grid-cols-[270px_minmax(0,1fr)_570px] min-h-0 overflow-hidden">
        {/* LEFT PANEL: Versions, Sections, Templates */}
        <aside
          className={`${
            mobilePanel === 'left' ? 'flex' : 'hidden lg:flex'
          } flex-col bg-white border-r border-slate-200 min-h-0 overflow-y-auto p-4 space-y-5`}
        >
          {/* Saved Resumes & Versions */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">Saved Resumes</span>
              <button
                type="button"
                onClick={() => createResume({ fromProfile: true })}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
              {resumes.map((r) => {
                const isSelected = r.id === activeResume.id;
                const rJob = r.linkedJobId ? jobs.find((j) => j.id === r.linkedJobId) : undefined;
                return (
                  <div
                    key={r.id}
                    className={`group rounded-md border px-2.5 py-2 transition-colors ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveResumeId(r.id)}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="text-xs font-semibold truncate">{r.name}</div>
                      <div
                        className={`text-[11px] mt-0.5 flex items-center gap-1.5 truncate ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        <span>{r.isMaster ? 'Master' : `v${r.version}`}</span>
                        {rJob && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{rJob.company}</span>
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => duplicateResume(activeResume.id)}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => deleteResume(activeResume.id)}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 rounded cursor-pointer"
                aria-label="Delete active resume"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Section Navigation & Reorder / Toggle */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-900">Resume Sections</div>
            <button
              type="button"
              onClick={() => {
                setActiveSection('personal');
                setCenterTab('content');
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-md cursor-pointer ${
                activeSection === 'personal' && centerTab === 'content'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>Personal Information</span>
              <span className="text-[10px] text-slate-400">Header</span>
            </button>

            <div className="space-y-1">
              {activeResume.sections.map((sec, idx) => {
                const isSelected = activeSection === sec.id && centerTab === 'content';
                return (
                  <div
                    key={sec.id}
                    className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-md transition-colors ${
                      isSelected ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection(sec.id);
                        setCenterTab('content');
                      }}
                      className={`flex-1 text-left text-xs truncate cursor-pointer ${
                        !sec.enabled ? 'line-through text-slate-400' : 'font-medium'
                      }`}
                    >
                      {sec.label}
                    </button>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSection(idx, -1)}
                        aria-label={`Move ${sec.label} up`}
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-25 cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === activeResume.sections.length - 1}
                        onClick={() => moveSection(idx, 1)}
                        aria-label={`Move ${sec.label} down`}
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-25 cursor-pointer"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSection(sec.id)}
                        aria-label={sec.enabled ? `Hide ${sec.label}` : `Show ${sec.label}`}
                        className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
                      >
                        {sec.enabled ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-slate-300" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Document Profile Presets */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-900">Document Profile</div>
            <div className="space-y-1.5">
              {(Object.keys(DOCUMENT_PROFILES) as DocumentProfileId[]).map((profId) => {
                const prof = DOCUMENT_PROFILES[profId];
                const isSelected = (activeResume.documentProfile || 'modern-professional') === profId;
                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() =>
                      updateResume(activeResume.id, (prev) => {
                        const orderMap = new Map(
                          prof.recommendedSectionOrder.map((k, idx) => [k, idx])
                        );
                        const reorderedSections = [...prev.sections].sort(
                          (a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99)
                        );
                        return {
                          ...prev,
                          documentProfile: prof.id,
                          template: prof.resumeTemplate,
                          formatting: { ...prof.resumeFormatting },
                          sections: reorderedSections,
                        };
                      })
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

          {/* Template Selection */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-900">Template</div>
            <div className="space-y-1.5">
              {TEMPLATES.map((tpl) => {
                const isSelected = activeResume.template === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() =>
                      updateResume(activeResume.id, (prev) => ({ ...prev, template: tpl.id }))
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
        </aside>

        {/* CENTER PANEL: Forms, Formatting, Job & AI */}
        <section
          className={`${
            mobilePanel === 'center' ? 'flex' : 'hidden lg:flex'
          } flex-col bg-slate-50 min-h-0 overflow-hidden`}
        >
          {/* Resume Header & Tab Switcher */}
          <div className="shrink-0 bg-white border-b border-slate-200 px-5 py-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              {editingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        renameResume(activeResume.id, nameDraft);
                        setEditingName(false);
                      }
                    }}
                    className="px-2.5 py-1 text-sm font-semibold border border-slate-300 rounded-md flex-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      renameResume(activeResume.id, nameDraft);
                      setEditingName(false);
                    }}
                    className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-sm font-semibold text-slate-900 truncate">
                    {activeResume.name}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(activeResume.name);
                      setEditingName(true);
                    }}
                    aria-label="Rename resume"
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 shrink-0">
                {documentSnapshots.some(
                  (s) => s.documentKind === 'resume' && s.documentId === activeResume.id
                ) && (
                  <button
                    type="button"
                    onClick={() => undoLatestSnapshotForDocument('resume', activeResume.id)}
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
                      resumeId: activeResume.id,
                      jobId: activeResume.linkedJobId,
                      scope: activeResume.linkedJobId ? 'full_application' : 'resume_only',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  AI Review
                </button>
                <button
                  type="button"
                  onClick={() => importProfileIntoResume(activeResume.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Import Profile
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setCenterTab('content')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  centerTab === 'content'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Content
              </button>
              <button
                type="button"
                onClick={() => setCenterTab('formatting')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  centerTab === 'formatting'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Formatting
              </button>
              <button
                type="button"
                onClick={() => setCenterTab('ai')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  centerTab === 'ai'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Job &amp; AI
              </button>
              <button
                type="button"
                onClick={() => setCenterTab('quality')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  centerTab === 'quality'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Quality Report
              </button>
            </div>
          </div>

          {/* Center Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {aiError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                {aiError}
              </div>
            )}

            {centerTab === 'content' && (
              <ResumeSectionsEditor
                activeSection={activeSection}
                data={activeResume}
                aiLoading={aiLoading}
                onAiAssist={(action, expId) => handleRunAi(action, expId)}
                companionContext={{
                  documentType: 'resume',
                  documentId: activeResume.id,
                  documentTitle: activeResume.name,
                  documentVersion: activeResume.version,
                  careerProfile: profile,
                  jobContext: linkedJob,
                  companyResearch: linkedResearch,
                }}
                onChange={(updater) =>
                  updateResume(activeResume.id, (prev) => ({
                    ...prev,
                    ...updater(prev),
                  }))
                }
              />
            )}

            {centerTab === 'formatting' && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Document Typography &amp; Layout</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Formatting controls apply synchronously to the live preview, DOCX export, and PDF export.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Font Family</label>
                    <select
                      value={activeResume.formatting.fontFamily}
                      onChange={(e) =>
                        updateResume(activeResume.id, (prev) => ({
                          ...prev,
                          formatting: {
                            ...prev.formatting,
                            fontFamily: e.target.value as DocumentFontFamily,
                          },
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                    >
                      <option value="editorial">Editorial Serif (Fraunces / Garamond)</option>
                      <option value="serif">Classic Serif (Source Serif / Georgia)</option>
                      <option value="sans">Modern Sans (Plus Jakarta / Calibri)</option>
                      <option value="mono">Technical Mono (JetBrains / Consolas)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Header Alignment
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['left', 'center'] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() =>
                            updateResume(activeResume.id, (prev) => ({
                              ...prev,
                              formatting: { ...prev.formatting, headerAlignment: align },
                            }))
                          }
                          className={`py-2 text-xs font-medium rounded-md border capitalize cursor-pointer ${
                            activeResume.formatting.headerAlignment === align
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
                      <span>Body Font Size</span>
                      <span className="font-mono-tabular">{activeResume.formatting.fontSize}pt</span>
                    </label>
                    <input
                      type="range"
                      min={9}
                      max={12}
                      step={0.5}
                      value={activeResume.formatting.fontSize}
                      onChange={(e) =>
                        updateResume(activeResume.id, (prev) => ({
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
                      <span className="font-mono-tabular">{activeResume.formatting.headingSize}pt</span>
                    </label>
                    <input
                      type="range"
                      min={12}
                      max={18}
                      step={0.5}
                      value={activeResume.formatting.headingSize}
                      onChange={(e) =>
                        updateResume(activeResume.id, (prev) => ({
                          ...prev,
                          formatting: { ...prev.formatting, headingSize: Number(e.target.value) },
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                      <span>Section Spacing</span>
                      <span className="font-mono-tabular">{activeResume.formatting.sectionSpacing}px</span>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={26}
                      step={2}
                      value={activeResume.formatting.sectionSpacing}
                      onChange={(e) =>
                        updateResume(activeResume.id, (prev) => ({
                          ...prev,
                          formatting: {
                            ...prev.formatting,
                            sectionSpacing: Number(e.target.value),
                          },
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                      <span>Page Margins</span>
                      <span className="font-mono-tabular">
                        {activeResume.formatting.pageMargins.toFixed(2)} in
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0.45}
                      max={1.0}
                      step={0.05}
                      value={activeResume.formatting.pageMargins}
                      onChange={(e) =>
                        updateResume(activeResume.id, (prev) => ({
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
                      <span className="font-mono-tabular">{activeResume.formatting.lineSpacing}x</span>
                    </label>
                    <input
                      type="range"
                      min={1.15}
                      max={1.6}
                      step={0.05}
                      value={activeResume.formatting.lineSpacing}
                      onChange={(e) =>
                        updateResume(activeResume.id, (prev) => ({
                          ...prev,
                          formatting: { ...prev.formatting, lineSpacing: Number(e.target.value) },
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Accent Color</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {ACCENT_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          title={preset.label}
                          onClick={() =>
                            updateResume(activeResume.id, (prev) => ({
                              ...prev,
                              formatting: { ...prev.formatting, accentColor: preset.value },
                            }))
                          }
                          className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                            activeResume.formatting.accentColor === preset.value
                              ? 'border-slate-900 scale-110'
                              : 'border-white shadow-xs'
                          }`}
                          style={{ backgroundColor: preset.value }}
                        />
                      ))}
                      <input
                        type="color"
                        aria-label="Custom accent color"
                        value={activeResume.formatting.accentColor}
                        onChange={(e) =>
                          updateResume(activeResume.id, (prev) => ({
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

            {centerTab === 'ai' && (
              <div className="space-y-5">
                {/* Target Job Integration */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-slate-500" />
                        Job Application Integration
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Link a tracked job or branch a separate tailored resume version without overwriting your Master resume.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={activeResume.linkedJobId || ''}
                      onChange={(e) =>
                        updateResume(activeResume.id, (prev) => ({
                          ...prev,
                          linkedJobId: e.target.value || undefined,
                        }))
                      }
                      className="flex-1 min-w-[200px] px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
                    >
                      <option value="">No target job linked</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.company} — {j.jobTitle}
                        </option>
                      ))}
                    </select>

                    {activeResume.isMaster && jobs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCreateTailoredCopy(linkedJob?.id || jobs[0].id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer whitespace-nowrap"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Create Tailored Version
                      </button>
                    )}
                  </div>

                  {linkedJob && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5 text-xs">
                      <div className="font-semibold text-slate-900">
                        {linkedJob.jobTitle} · {linkedJob.company}
                      </div>
                      <p className="text-slate-600 line-clamp-3 leading-relaxed">
                        {linkedJob.jobDescription}
                      </p>
                    </div>
                  )}

                  {activeResume.isMaster && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900">
                      Editing Master Resume. Use <strong>Create Tailored Version</strong> above to keep your master career baseline untouched when tailoring for a company.
                    </div>
                  )}
                </div>

                {/* Company Intelligence & 3-Way Job Match Insights */}
                {linkedJob && (
                  <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          Company Intelligence &amp; Match Insights
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Advisory guidance for emphasizing your verified experience. Company info is never added as personal history.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJobId(linkedJob.id);
                          setActiveModule('jobs');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                      >
                        <span>Open in Job Tracker</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>

                    {linkedResearch?.status === 'completed' ? (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">
                            {linkedResearch.companyName} · {linkedResearch.report.industry || 'Researched'}
                          </span>
                          <span className="text-[11px] font-mono-tabular text-emerald-800 font-medium">
                            {
                              linkedResearch.findings.filter(
                                (f) => f.verificationStatus === 'approved'
                              ).length
                            }{' '}
                            approved /{' '}
                            {
                              linkedResearch.findings.filter(
                                (f) => f.verificationStatus !== 'dismissed'
                              ).length
                            }{' '}
                            active findings
                          </span>
                        </div>
                        {linkedResearch.overview && (
                          <p className="text-slate-600 leading-relaxed">
                            <strong>Overview:</strong> {linkedResearch.overview}
                          </p>
                        )}
                        {linkedResearch.coreFocus && linkedResearch.coreFocus.length > 0 && (
                          <p className="text-slate-600 leading-relaxed">
                            <strong>Core Focus:</strong> {linkedResearch.coreFocus.join(' · ')}
                          </p>
                        )}
                        {linkedResearch.report.technology && (
                          <p className="text-slate-600 leading-relaxed">
                            <strong>Tech &amp; Tools:</strong> {linkedResearch.report.technology}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
                        No Company Research saved yet for {linkedJob.company}. Open Job Tracker and click <strong>Company Research</strong> to gather grounded facts.
                      </div>
                    )}

                    {linkedMatch && (
                      <div className="space-y-2.5 text-xs pt-1">
                        {linkedMatch.recommendedResumeEmphasis.experienceToEmphasize.length > 0 && (
                          <div>
                            <div className="font-semibold text-slate-800 mb-1">
                              Experiences to Emphasize
                            </div>
                            <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                              {linkedMatch.recommendedResumeEmphasis.experienceToEmphasize.map(
                                (item, idx) => (
                                  <li key={idx}>{item}</li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                        {linkedMatch.recommendedResumeEmphasis.skillsToPrioritize.length > 0 && (
                          <div>
                            <div className="font-semibold text-slate-800 mb-0.5">
                              Verified Skills to Prioritize
                            </div>
                            <p className="text-slate-600">
                              {linkedMatch.recommendedResumeEmphasis.skillsToPrioritize.join(' · ')}
                            </p>
                          </div>
                        )}
                        {linkedMatch.recommendedResumeEmphasis.suggestedSectionOrder.length > 0 && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <div className="text-[11px] text-slate-600">
                              <strong>Suggested Order:</strong>{' '}
                              <span className="capitalize">
                                {linkedMatch.recommendedResumeEmphasis.suggestedSectionOrder.join(
                                  ' → '
                                )}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                applyRecommendedSectionOrder(
                                  linkedMatch.recommendedResumeEmphasis.suggestedSectionOrder
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded cursor-pointer"
                            >
                              <ListOrdered className="w-3 h-3" />
                              Apply Section Order
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Writing Assistant Actions */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      <Wand2 className="w-4 h-4 text-slate-600" />
                      AI Writing Assistant
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Grounded strictly in your verified history. All suggestions open in a review panel before any changes are applied. AI drafts are advisory — review and verify details before sending.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={() => handleRunAi('write_summary')}
                      className="text-left p-3 border border-slate-200 hover:border-slate-900 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <div className="text-xs font-semibold text-slate-900">
                        Draft Professional Summary
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Refine headline &amp; summary from your actual career track.
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={() => handleRunAi('improve_experience')}
                      className="text-left p-3 border border-slate-200 hover:border-slate-900 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <div className="text-xs font-semibold text-slate-900">
                        Achievement-Focused Bullets
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Convert responsibilities into crisp active-voice bullets.
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={() => handleRunAi('fix_grammar')}
                      className="text-left p-3 border border-slate-200 hover:border-slate-900 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <div className="text-xs font-semibold text-slate-900">
                        Grammar &amp; Deduplication
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Tighten phrasing and eliminate repetitive lead verbs.
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={() => handleRunAi('audit_gaps')}
                      className="text-left p-3 border border-slate-200 hover:border-slate-900 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <div className="text-xs font-semibold text-slate-900">
                        Audit Missing Info &amp; Skills
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Identify incomplete fields and evidenced skills to highlight.
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={aiLoading || !linkedJob}
                      onClick={() => handleRunAi('tailor_to_job')}
                      className="sm:col-span-2 text-left p-3 border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">
                          Tailor Resume to Linked Job Description
                        </span>
                        {aiLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        {linkedJob
                          ? `Target: ${linkedJob.jobTitle} at ${linkedJob.company}`
                          : 'Link a job application above to unlock job-specific tailoring.'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openReviewCenter({
                          resumeId: activeResume.id,
                          jobId: activeResume.linkedJobId,
                          scope: activeResume.linkedJobId ? 'full_application' : 'resume_only',
                        })
                      }
                      className="sm:col-span-2 text-left p-3 border border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                          Open AI Application Review
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-800 mt-0.5">
                        Run full fact-checking, ATS compatibility checks, and requirement matching before exporting.
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {centerTab === 'quality' && qualityReport && (
              <QualityReportPanel
                report={qualityReport}
                aiLoading={aiLoading}
                onOptimizeWithAi={() => handleRunAi('improve_experience')}
                optimizeLabel="Strengthen Bullets to Standards with AI"
              />
            )}
          </div>
        </section>

        {/* RIGHT PANEL: Live Multi-Page Preview & Exports */}
        <section
          className={`${
            mobilePanel === 'right' ? 'flex' : 'hidden lg:flex'
          } flex-col min-h-0 overflow-hidden`}
        >
          <PaginatedPaperPreview
            blocks={previewData.blocks}
            paperColor={previewData.paperColor}
            pageMarginsInches={activeResume.formatting.pageMargins}
            documentTitle={activeResume.name}
            onExportDocx={handleExportDocx}
            onExportPdf={() => exportResumeToPdf(activeResume)}
            isExportingDocx={exportingDocx}
            onExportDrive={handleExportDrive}
            isExportingDrive={exportingDrive}
            driveWebViewLink={activeResume.driveWebViewLink}
            driveSyncStatus={activeResume.driveSyncStatus}
            onPageCountChange={setPageCount}
          />
        </section>
      </div>

      {/* Reviewable AI Diff Modal */}
      <AiDiffModal
        isOpen={Boolean(aiProposal)}
        title="Review AI Resume Suggestions"
        subtitle="Verify accuracy before applying. Your original data remains untouched until you confirm."
        rationale={aiProposal?.rationale}
        warnings={aiProposal?.missingInformationWarnings}
        notes={aiProposal?.jobAlignmentNotes}
        onDiscard={() => setAiProposal(null)}
        onApply={handleApplyProposal}
        applyLabel="Apply Selected Suggestions"
      >
        {aiProposal && (
          <div className="space-y-4">
            {(aiProposal.proposedHeadline || aiProposal.proposedSummary) && (
              <div className="border border-slate-200 rounded-lg p-4 space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applySummaryCheck}
                    onChange={(e) => setApplySummaryCheck(e.target.checked)}
                  />
                  Apply Proposed Summary Update
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <div className="font-semibold text-slate-500 mb-1">Current</div>
                    <p className="text-slate-700 font-medium">{activeResume.summary.headline}</p>
                    <p className="text-slate-600 mt-1">{activeResume.summary.summary}</p>
                  </div>
                  <div className="p-2.5 bg-emerald-50/50 rounded border border-emerald-200">
                    <div className="font-semibold text-emerald-800 mb-1">Proposed</div>
                    {aiProposal.proposedHeadline && (
                      <p className="text-slate-900 font-medium">{aiProposal.proposedHeadline}</p>
                    )}
                    {aiProposal.proposedSummary && (
                      <p className="text-slate-800 mt-1">{aiProposal.proposedSummary}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {aiProposal.experienceUpdates.map((eu) => {
              const currentExp = activeResume.workExperience.find((e) => e.id === eu.id);
              if (!currentExp) return null;
              return (
                <div key={eu.id} className="border border-slate-200 rounded-lg p-4 space-y-2.5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(applyExpChecks[eu.id])}
                      onChange={(e) =>
                        setApplyExpChecks((prev) => ({ ...prev, [eu.id]: e.target.checked }))
                      }
                    />
                    {currentExp.position} · {currentExp.company}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-1">
                      <div className="font-semibold text-slate-500">Current Bullets</div>
                      <ul className="list-disc pl-4 text-slate-600 space-y-1">
                        {[...currentExp.responsibilities, ...currentExp.achievements].map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-2.5 bg-emerald-50/50 rounded border border-emerald-200 space-y-1">
                      <div className="font-semibold text-emerald-800">Proposed Bullets</div>
                      <ul className="list-disc pl-4 text-slate-800 space-y-1">
                        {[...eu.responsibilities, ...eu.achievements].map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}

            {aiProposal.suggestedSkillsToHighlight.length > 0 && (
              <div className="border border-slate-200 rounded-lg p-4 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applySkillsCheck}
                    onChange={(e) => setApplySkillsCheck(e.target.checked)}
                  />
                  Evidenced Skills to Highlight
                </label>
                <p className="text-xs text-slate-700">
                  {aiProposal.suggestedSkillsToHighlight.join(' · ')}
                </p>
              </div>
            )}
          </div>
        )}
      </AiDiffModal>
    </div>
  );
}

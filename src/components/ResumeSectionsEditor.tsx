import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  AwardItem,
  CareerProfile,
  CertificationItem,
  CompanionDocumentType,
  CompanyResearch,
  EducationItem,
  EmploymentType,
  JobApplication,
  LanguageItem,
  PersonalInfo,
  ProfessionalSummary,
  ProjectItem,
  PublicationItem,
  ResumeSectionKey,
  SkillsGroup,
  VolunteerItem,
  WorkExperienceItem,
} from '../types/career';
import { AIWritingCompanion } from './AIWritingCompanion';

export interface CompanionEditorContext {
  documentType: CompanionDocumentType;
  documentId: string;
  documentTitle?: string;
  documentVersion?: number;
  careerProfile: CareerProfile;
  jobContext?: JobApplication;
  companyResearch?: CompanyResearch;
}

export interface StructuredResumeData {
  personal: PersonalInfo;
  summary: ProfessionalSummary;
  workExperience: WorkExperienceItem[];
  education: EducationItem[];
  skills: SkillsGroup;
  projects: ProjectItem[];
  certifications: CertificationItem[];
  awards: AwardItem[];
  volunteer: VolunteerItem[];
  languages: LanguageItem[];
  publications: PublicationItem[];
}

interface ResumeSectionsEditorProps {
  activeSection: 'personal' | ResumeSectionKey;
  data: StructuredResumeData;
  onChange: (updater: (prev: StructuredResumeData) => StructuredResumeData) => void;
  onAiAssist?: (action: 'write_summary' | 'improve_experience' | 'fix_grammar', experienceId?: string) => void;
  aiLoading?: boolean;
  companionContext?: CompanionEditorContext;
}

const INPUT_CLS =
  'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors';
const LABEL_CLS = 'block text-xs font-medium text-slate-600 mb-1';

function StringListEditor({
  label,
  items,
  placeholder,
  onChange,
  companionTrigger,
}: {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
  companionTrigger?: React.ReactNode;
}) {
  const [draft, setDraft] = useState('');
  const [dupNotice, setDupNotice] = useState(false);

  const addDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const isDup = items.some((existing) => existing.trim().toLowerCase() === trimmed.toLowerCase());
    if (isDup) {
      setDupNotice(true);
      return;
    }
    setDupNotice(false);
    onChange([...items, trimmed]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={LABEL_CLS}>{label}</span>
        <div className="flex items-center gap-2">
          {companionTrigger}
          <span className="text-[11px] font-mono-tabular text-slate-400">{items.length} items</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <textarea
              rows={2}
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[idx] = e.target.value;
                onChange(next);
              }}
              className={`${INPUT_CLS} resize-y text-xs leading-relaxed`}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              aria-label={`Remove ${label} item`}
              className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (dupNotice) setDupNotice(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder={placeholder}
          className={`${INPUT_CLS} text-xs`}
        />
        <button
          type="button"
          onClick={addDraft}
          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
      {dupNotice && (
        <p className="text-[11px] text-amber-700">This entry is already listed above.</p>
      )}
    </div>
  );
}

function TagInputList({
  label,
  items,
  placeholder,
  onChange,
  companionTrigger,
}: {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
  companionTrigger?: React.ReactNode;
}) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const seen = new Set(items.map((x) => x.trim().toLowerCase()));
    const parts: string[] = [];
    for (const raw of draft.split(',')) {
      const cleaned = raw.trim();
      const key = cleaned.toLowerCase();
      if (cleaned && !seen.has(key)) {
        seen.add(key);
        parts.push(cleaned);
      }
    }
    if (parts.length > 0) {
      onChange([...items, ...parts]);
    }
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className={LABEL_CLS}>{label}</label>
        {companionTrigger}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          className={`${INPUT_CLS} text-xs`}
        />
        <button
          type="button"
          onClick={commit}
          className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer shrink-0"
        >
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {items.map((item, idx) => (
            <span
              key={`${item}-${idx}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-100 text-slate-800 rounded border border-slate-200"
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                aria-label={`Remove ${item}`}
                className="text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function moveItem<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const target = idx + dir;
  if (target < 0 || target >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(idx, 1);
  copy.splice(target, 0, item);
  return copy;
}

function parseLinesToBullets(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s+/, '').trim())
    .filter(Boolean);
}

function parseCommaOrLineSkills(text: string): string[] {
  const rawParts = text.includes(',') ? text.split(',') : text.split('\n');
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of rawParts) {
    const cleaned = part.replace(/^[-•*]\s+/, '').trim();
    if (cleaned && !seen.has(cleaned.toLowerCase())) {
      seen.add(cleaned.toLowerCase());
      result.push(cleaned);
    }
  }
  return result;
}

function formatWorkExpForCompanion(exp: WorkExperienceItem): string {
  const lines: string[] = [];
  if (exp.responsibilities.length > 0) {
    lines.push('Responsibilities:');
    exp.responsibilities.forEach((r) => lines.push(`- ${r}`));
  }
  if (exp.achievements.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Achievements:');
    exp.achievements.forEach((a) => lines.push(`- ${a}`));
  }
  return lines.join('\n');
}

function parseWorkExpFromCompanion(
  text: string,
  fallback: WorkExperienceItem
): { responsibilities: string[]; achievements: string[] } {
  const respMatch = text.match(/Responsibilities:\s*([\s\S]*?)(?=\n\s*Achievements:|$)/i);
  const achMatch = text.match(/Achievements:\s*([\s\S]*)$/i);
  if (respMatch || achMatch) {
    return {
      responsibilities: respMatch ? parseLinesToBullets(respMatch[1]) : fallback.responsibilities,
      achievements: achMatch ? parseLinesToBullets(achMatch[1]) : fallback.achievements,
    };
  }
  const bullets = parseLinesToBullets(text);
  return {
    responsibilities: bullets.length > 0 ? bullets : fallback.responsibilities,
    achievements: fallback.achievements,
  };
}

export function ResumeSectionsEditor({
  activeSection,
  data,
  onChange,
  onAiAssist,
  aiLoading = false,
  companionContext,
}: ResumeSectionsEditorProps) {
  const resolvedCompanionCtx: CompanionEditorContext = companionContext || {
    documentType: 'career-profile',
    documentId: 'master-career-profile',
    documentTitle: 'Master Career Profile',
    careerProfile: {
      ...data,
      updatedAt: new Date().toISOString(),
    },
  };
  if (activeSection === 'personal') {
    const p = data.personal;
    const setField = (k: keyof PersonalInfo, v: string) =>
      onChange((prev) => ({ ...prev, personal: { ...prev.personal, [k]: v } }));
    const missingName = !p.fullName.trim();
    const invalidEmail =
      p.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim());

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Personal Information</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Contact details and verified profile links rendered at the top of your document.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={LABEL_CLS}>
              Full Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              aria-invalid={missingName}
              value={p.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              placeholder="Oliver Rowland"
              className={`${INPUT_CLS} ${missingName ? 'border-amber-400 focus:border-amber-600' : ''}`}
            />
            {missingName && (
              <p className="text-[11px] text-amber-700 mt-1">
                Full Name is required for documents and header exports.
              </p>
            )}
          </div>
          <div>
            <label className={LABEL_CLS}>Professional Title</label>
            <input
              type="text"
              value={p.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Full Stack Developer"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Email</label>
            <input
              type="email"
              aria-invalid={invalidEmail}
              value={p.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="name@example.com"
              className={`${INPUT_CLS} ${invalidEmail ? 'border-rose-400 focus:border-rose-600' : ''}`}
            />
            {invalidEmail && (
              <p className="text-[11px] text-rose-700 mt-1">
                Enter a valid email address (e.g. name@example.com).
              </p>
            )}
          </div>
          <div>
            <label className={LABEL_CLS}>Phone</label>
            <input
              type="text"
              value={p.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="(555) 123-4567"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Location</label>
            <input
              type="text"
              value={p.location}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="Houston, Texas"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>LinkedIn</label>
            <input
              type="text"
              value={p.linkedin}
              onChange={(e) => setField('linkedin', e.target.value)}
              placeholder="linkedin.com/in/username"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Portfolio</label>
            <input
              type="text"
              value={p.portfolio}
              onChange={(e) => setField('portfolio', e.target.value)}
              placeholder="portfolio.dev"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Website / GitHub</label>
            <input
              type="text"
              value={p.website}
              onChange={(e) => setField('website', e.target.value)}
              placeholder="github.com/username"
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'summary') {
    const s = data.summary;
    const setSummary = (k: keyof ProfessionalSummary, v: string) =>
      onChange((prev) => ({ ...prev, summary: { ...prev.summary, [k]: v } }));

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Professional Summary</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Concise executive positioning grounded in your real experience.
            </p>
          </div>
          {onAiAssist && (
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => onAiAssist('write_summary')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {aiLoading ? 'Drafting...' : 'AI Draft Summary'}
            </button>
          )}
        </div>

        <div className="space-y-3.5">
          <div>
            <label className={LABEL_CLS}>Professional Headline</label>
            <input
              type="text"
              value={s.headline}
              onChange={(e) => setSummary('headline', e.target.value)}
              placeholder="Building scalable web applications with clean architecture..."
              className={INPUT_CLS}
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-xs font-medium text-slate-600">Summary</label>
              <AIWritingCompanion
                fieldType="Professional Summary"
                fieldKey="summary.summary"
                fieldLabel="Professional Summary"
                currentValue={s.summary}
                documentType={resolvedCompanionCtx.documentType}
                documentId={resolvedCompanionCtx.documentId}
                documentTitle={resolvedCompanionCtx.documentTitle}
                documentVersion={resolvedCompanionCtx.documentVersion}
                documentContext={data}
                careerProfile={resolvedCompanionCtx.careerProfile}
                jobContext={resolvedCompanionCtx.jobContext}
                companyResearch={resolvedCompanionCtx.companyResearch}
                onApply={(val) => setSummary('summary', val)}
                onCancel={() => {}}
              />
            </div>
            <textarea
              rows={4}
              value={s.summary}
              onChange={(e) => setSummary('summary', e.target.value)}
              placeholder="Summarize your core experience, domain focus, and measurable strengths..."
              className={`${INPUT_CLS} leading-relaxed`}
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-xs font-medium text-slate-600">
                Career Objectives (Optional)
              </label>
              <AIWritingCompanion
                fieldType="Career Objectives"
                fieldKey="summary.careerObjectives"
                fieldLabel="Career Objectives"
                currentValue={s.careerObjectives}
                documentType={resolvedCompanionCtx.documentType}
                documentId={resolvedCompanionCtx.documentId}
                documentTitle={resolvedCompanionCtx.documentTitle}
                documentVersion={resolvedCompanionCtx.documentVersion}
                documentContext={data}
                careerProfile={resolvedCompanionCtx.careerProfile}
                jobContext={resolvedCompanionCtx.jobContext}
                companyResearch={resolvedCompanionCtx.companyResearch}
                onApply={(val) => setSummary('careerObjectives', val)}
                onCancel={() => {}}
              />
            </div>
            <textarea
              rows={2}
              value={s.careerObjectives}
              onChange={(e) => setSummary('careerObjectives', e.target.value)}
              placeholder="Optional target role or objective statement..."
              className={`${INPUT_CLS} leading-relaxed`}
            />
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'experience') {
    const addExperience = () => {
      const item: WorkExperienceItem = {
        id: `exp-${crypto.randomUUID().slice(0, 8)}`,
        company: '',
        position: '',
        location: '',
        employmentType: 'Full-time',
        startDate: '',
        endDate: '',
        isCurrent: false,
        responsibilities: [],
        achievements: [],
        technologies: [],
      };
      onChange((prev) => ({ ...prev, workExperience: [item, ...prev.workExperience] }));
    };

    const updateExp = (id: string, patch: Partial<WorkExperienceItem>) => {
      onChange((prev) => ({
        ...prev,
        workExperience: prev.workExperience.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }));
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Work Experience</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add unlimited roles with responsibilities, verified achievements, and technologies.
            </p>
          </div>
          <button
            type="button"
            onClick={addExperience}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Role
          </button>
        </div>

        {data.workExperience.length === 0 && (
          <div className="p-6 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500">
            No work experience added yet. Click &ldquo;Add Role&rdquo; to enter your first position.
          </div>
        )}

        <div className="space-y-5">
          {data.workExperience.map((exp, idx) => (
            <div key={exp.id} className="p-4 bg-white border border-slate-200 rounded-lg space-y-3.5">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {exp.position || 'New Position'} {exp.company ? `· ${exp.company}` : ''}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <AIWritingCompanion
                    fieldType="Work Experience"
                    fieldKey={`exp.${exp.id}.all`}
                    fieldLabel={`${exp.position || 'Role'}${exp.company ? ` · ${exp.company}` : ''}`}
                    currentValue={formatWorkExpForCompanion(exp)}
                    documentType={resolvedCompanionCtx.documentType}
                    documentId={resolvedCompanionCtx.documentId}
                    documentTitle={resolvedCompanionCtx.documentTitle}
                    documentVersion={resolvedCompanionCtx.documentVersion}
                    documentContext={data}
                    careerProfile={resolvedCompanionCtx.careerProfile}
                    jobContext={resolvedCompanionCtx.jobContext}
                    companyResearch={resolvedCompanionCtx.companyResearch}
                    onApply={(val) => updateExp(exp.id, parseWorkExpFromCompanion(val, exp))}
                    onCancel={() => {}}
                  />
                  {onAiAssist && (
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={() => onAiAssist('improve_experience', exp.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer disabled:opacity-50"
                    >
                      <Wand2 className="w-3 h-3" />
                      AI Polish Bullets
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        workExperience: moveItem(prev.workExperience, idx, -1),
                      }))
                    }
                    aria-label="Move role up"
                    className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === data.workExperience.length - 1}
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        workExperience: moveItem(prev.workExperience, idx, 1),
                      }))
                    }
                    aria-label="Move role down"
                    className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        workExperience: prev.workExperience.filter((e) => e.id !== exp.id),
                      }))
                    }
                    aria-label="Delete role"
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Position / Job Title</label>
                  <input
                    type="text"
                    value={exp.position}
                    onChange={(e) => updateExp(exp.id, { position: e.target.value })}
                    placeholder="Senior Full Stack Developer"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Company</label>
                  <input
                    type="text"
                    value={exp.company}
                    onChange={(e) => updateExp(exp.id, { company: e.target.value })}
                    placeholder="Northstack"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Location</label>
                  <input
                    type="text"
                    value={exp.location}
                    onChange={(e) => updateExp(exp.id, { location: e.target.value })}
                    placeholder="Houston, TX"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Employment Type</label>
                  <select
                    value={exp.employmentType}
                    onChange={(e) =>
                      updateExp(exp.id, { employmentType: e.target.value as EmploymentType })
                    }
                    className={INPUT_CLS}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Start Date</label>
                  <input
                    type="text"
                    value={exp.startDate}
                    onChange={(e) => updateExp(exp.id, { startDate: e.target.value })}
                    placeholder="Jan 2023"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-600">End Date</label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exp.isCurrent}
                        onChange={(e) =>
                          updateExp(exp.id, {
                            isCurrent: e.target.checked,
                            endDate: e.target.checked ? 'Present' : '',
                          })
                        }
                        className="rounded border-slate-300"
                      />
                      Current position
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={exp.isCurrent}
                    value={exp.isCurrent ? 'Present' : exp.endDate}
                    onChange={(e) => updateExp(exp.id, { endDate: e.target.value })}
                    placeholder="Dec 2024"
                    className={`${INPUT_CLS} disabled:bg-slate-50 disabled:text-slate-500`}
                  />
                </div>
              </div>

              <StringListEditor
                label="Responsibilities"
                items={exp.responsibilities}
                placeholder="Add a key responsibility and press Enter..."
                onChange={(next) => updateExp(exp.id, { responsibilities: next })}
                companionTrigger={
                  <AIWritingCompanion
                    fieldType="Job Responsibilities"
                    fieldKey={`exp.${exp.id}.responsibilities`}
                    fieldLabel={`${exp.position || 'Role'} — Responsibilities`}
                    currentValue={exp.responsibilities.join('\n')}
                    documentType={resolvedCompanionCtx.documentType}
                    documentId={resolvedCompanionCtx.documentId}
                    documentTitle={resolvedCompanionCtx.documentTitle}
                    documentVersion={resolvedCompanionCtx.documentVersion}
                    documentContext={data}
                    careerProfile={resolvedCompanionCtx.careerProfile}
                    jobContext={resolvedCompanionCtx.jobContext}
                    companyResearch={resolvedCompanionCtx.companyResearch}
                    onApply={(val) =>
                      updateExp(exp.id, { responsibilities: parseLinesToBullets(val) })
                    }
                    onCancel={() => {}}
                  />
                }
              />

              <StringListEditor
                label="Achievements"
                items={exp.achievements}
                placeholder="Add a concrete achievement and press Enter..."
                onChange={(next) => updateExp(exp.id, { achievements: next })}
                companionTrigger={
                  <AIWritingCompanion
                    fieldType="Achievements"
                    fieldKey={`exp.${exp.id}.achievements`}
                    fieldLabel={`${exp.position || 'Role'} — Achievements`}
                    currentValue={exp.achievements.join('\n')}
                    documentType={resolvedCompanionCtx.documentType}
                    documentId={resolvedCompanionCtx.documentId}
                    documentTitle={resolvedCompanionCtx.documentTitle}
                    documentVersion={resolvedCompanionCtx.documentVersion}
                    documentContext={data}
                    careerProfile={resolvedCompanionCtx.careerProfile}
                    jobContext={resolvedCompanionCtx.jobContext}
                    companyResearch={resolvedCompanionCtx.companyResearch}
                    onApply={(val) => updateExp(exp.id, { achievements: parseLinesToBullets(val) })}
                    onCancel={() => {}}
                  />
                }
              />

              <TagInputList
                label="Technologies Used"
                items={exp.technologies}
                placeholder="Comma-separated (e.g. React, TypeScript, Node.js)"
                onChange={(next) => updateExp(exp.id, { technologies: next })}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeSection === 'education') {
    const addEdu = () => {
      const item: EducationItem = {
        id: `edu-${crypto.randomUUID().slice(0, 8)}`,
        institution: '',
        degree: '',
        fieldOfStudy: '',
        startDate: '',
        graduationDate: '',
        details: '',
      };
      onChange((prev) => ({ ...prev, education: [item, ...prev.education] }));
    };

    const updateEdu = (id: string, patch: Partial<EducationItem>) => {
      onChange((prev) => ({
        ...prev,
        education: prev.education.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }));
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Education</h3>
            <p className="text-xs text-slate-500 mt-0.5">Academic degrees, programs, and coursework.</p>
          </div>
          <button
            type="button"
            onClick={addEdu}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Education
          </button>
        </div>

        {data.education.map((edu, idx) => (
          <div key={edu.id} className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold text-slate-900">
                {edu.institution || 'New Institution'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() =>
                    onChange((prev) => ({ ...prev, education: moveItem(prev.education, idx, -1) }))
                  }
                  className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === data.education.length - 1}
                  onClick={() =>
                    onChange((prev) => ({ ...prev, education: moveItem(prev.education, idx, 1) }))
                  }
                  className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      education: prev.education.filter((e) => e.id !== edu.id),
                    }))
                  }
                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={LABEL_CLS}>Institution</label>
                <input
                  type="text"
                  value={edu.institution}
                  onChange={(e) => updateEdu(edu.id, { institution: e.target.value })}
                  placeholder="University of Houston"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Degree</label>
                <input
                  type="text"
                  value={edu.degree}
                  onChange={(e) => updateEdu(edu.id, { degree: e.target.value })}
                  placeholder="B.S."
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Field of Study</label>
                <input
                  type="text"
                  value={edu.fieldOfStudy}
                  onChange={(e) => updateEdu(edu.id, { fieldOfStudy: e.target.value })}
                  placeholder="Computer Science"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Start Date</label>
                <input
                  type="text"
                  value={edu.startDate}
                  onChange={(e) => updateEdu(edu.id, { startDate: e.target.value })}
                  placeholder="Aug 2017"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Graduation Date</label>
                <input
                  type="text"
                  value={edu.graduationDate}
                  onChange={(e) => updateEdu(edu.id, { graduationDate: e.target.value })}
                  placeholder="May 2021"
                  className={INPUT_CLS}
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-medium text-slate-600">
                    Additional Details (Honors, Coursework, GPA)
                  </label>
                  <AIWritingCompanion
                    fieldType="Education"
                    fieldKey={`edu.${edu.id}.details`}
                    fieldLabel={`${edu.degree ? `${edu.degree} ` : ''}${edu.fieldOfStudy || ''} · ${edu.institution || 'Education'}`.trim()}
                    currentValue={edu.details}
                    documentType={resolvedCompanionCtx.documentType}
                    documentId={resolvedCompanionCtx.documentId}
                    documentTitle={resolvedCompanionCtx.documentTitle}
                    documentVersion={resolvedCompanionCtx.documentVersion}
                    documentContext={data}
                    careerProfile={resolvedCompanionCtx.careerProfile}
                    jobContext={resolvedCompanionCtx.jobContext}
                    companyResearch={resolvedCompanionCtx.companyResearch}
                    onApply={(val) => updateEdu(edu.id, { details: val })}
                    onCancel={() => {}}
                  />
                </div>
                <textarea
                  rows={2}
                  value={edu.details}
                  onChange={(e) => updateEdu(edu.id, { details: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeSection === 'skills') {
    const setSkills = (key: keyof SkillsGroup, next: string[]) =>
      onChange((prev) => ({ ...prev, skills: { ...prev.skills, [key]: next } }));

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Skills & Capabilities</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize skills into clear ATS-friendly categories. Enter comma-separated values or one at a time.
          </p>
        </div>
        <div className="space-y-4 p-4 bg-white border border-slate-200 rounded-lg">
          <TagInputList
            label="Technical Skills"
            items={data.skills.technical}
            placeholder="TypeScript, React, Node.js, PostgreSQL..."
            onChange={(next) => setSkills('technical', next)}
            companionTrigger={
              <AIWritingCompanion
                fieldType="Technical Skills"
                fieldKey="skills.technical"
                fieldLabel="Technical Skills"
                currentValue={data.skills.technical.join(', ')}
                documentType={resolvedCompanionCtx.documentType}
                documentId={resolvedCompanionCtx.documentId}
                documentTitle={resolvedCompanionCtx.documentTitle}
                documentVersion={resolvedCompanionCtx.documentVersion}
                documentContext={data}
                careerProfile={resolvedCompanionCtx.careerProfile}
                jobContext={resolvedCompanionCtx.jobContext}
                companyResearch={resolvedCompanionCtx.companyResearch}
                onApply={(val) => setSkills('technical', parseCommaOrLineSkills(val))}
                onCancel={() => {}}
              />
            }
          />
          <TagInputList
            label="Software & Platforms"
            items={data.skills.software}
            placeholder="Docker, AWS, Git, Figma..."
            onChange={(next) => setSkills('software', next)}
            companionTrigger={
              <AIWritingCompanion
                fieldType="Technical Skills"
                fieldKey="skills.software"
                fieldLabel="Software & Platforms"
                currentValue={data.skills.software.join(', ')}
                documentType={resolvedCompanionCtx.documentType}
                documentId={resolvedCompanionCtx.documentId}
                documentTitle={resolvedCompanionCtx.documentTitle}
                documentVersion={resolvedCompanionCtx.documentVersion}
                documentContext={data}
                careerProfile={resolvedCompanionCtx.careerProfile}
                jobContext={resolvedCompanionCtx.jobContext}
                companyResearch={resolvedCompanionCtx.companyResearch}
                onApply={(val) => setSkills('software', parseCommaOrLineSkills(val))}
                onCancel={() => {}}
              />
            }
          />
          <TagInputList
            label="Professional Skills"
            items={data.skills.professional}
            placeholder="System Architecture, Technical Mentorship..."
            onChange={(next) => setSkills('professional', next)}
          />
          <TagInputList
            label="Industry Knowledge"
            items={data.skills.industry}
            placeholder="SaaS Platforms, Web Accessibility..."
            onChange={(next) => setSkills('industry', next)}
          />
        </div>
      </div>
    );
  }

  if (activeSection === 'projects') {
    const addProject = () => {
      const item: ProjectItem = {
        id: `proj-${crypto.randomUUID().slice(0, 8)}`,
        name: '',
        role: '',
        url: '',
        startDate: '',
        endDate: '',
        description: '',
        technologies: [],
      };
      onChange((prev) => ({ ...prev, projects: [item, ...prev.projects] }));
    };

    const updateProj = (id: string, patch: Partial<ProjectItem>) =>
      onChange((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Projects</h3>
            <p className="text-xs text-slate-500 mt-0.5">Open-source work, shipped products, or notable initiatives.</p>
          </div>
          <button
            type="button"
            onClick={addProject}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Project
          </button>
        </div>

        {data.projects.map((proj) => (
          <div key={proj.id} className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold text-slate-900">{proj.name || 'New Project'}</span>
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    projects: prev.projects.filter((p) => p.id !== proj.id),
                  }))
                }
                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Project Name</label>
                <input
                  type="text"
                  value={proj.name}
                  onChange={(e) => updateProj(proj.id, { name: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Role</label>
                <input
                  type="text"
                  value={proj.role}
                  onChange={(e) => updateProj(proj.id, { role: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>URL</label>
                <input
                  type="text"
                  value={proj.url}
                  onChange={(e) => updateProj(proj.id, { url: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL_CLS}>Start</label>
                  <input
                    type="text"
                    value={proj.startDate}
                    onChange={(e) => updateProj(proj.id, { startDate: e.target.value })}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>End</label>
                  <input
                    type="text"
                    value={proj.endDate}
                    onChange={(e) => updateProj(proj.id, { endDate: e.target.value })}
                    className={INPUT_CLS}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-medium text-slate-600">Description</label>
                  <AIWritingCompanion
                    fieldType="Projects"
                    fieldKey={`proj.${proj.id}.description`}
                    fieldLabel={proj.name || 'Project'}
                    currentValue={proj.description}
                    documentType={resolvedCompanionCtx.documentType}
                    documentId={resolvedCompanionCtx.documentId}
                    documentTitle={resolvedCompanionCtx.documentTitle}
                    documentVersion={resolvedCompanionCtx.documentVersion}
                    documentContext={data}
                    careerProfile={resolvedCompanionCtx.careerProfile}
                    jobContext={resolvedCompanionCtx.jobContext}
                    companyResearch={resolvedCompanionCtx.companyResearch}
                    onApply={(val) => updateProj(proj.id, { description: val })}
                    onCancel={() => {}}
                  />
                </div>
                <textarea
                  rows={2}
                  value={proj.description}
                  onChange={(e) => updateProj(proj.id, { description: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div className="sm:col-span-2">
                <TagInputList
                  label="Technologies"
                  items={proj.technologies}
                  placeholder="TypeScript, React..."
                  onChange={(next) => updateProj(proj.id, { technologies: next })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeSection === 'certifications') {
    const addCert = () => {
      const item: CertificationItem = {
        id: `cert-${crypto.randomUUID().slice(0, 8)}`,
        name: '',
        issuer: '',
        date: '',
        credentialId: '',
        url: '',
      };
      onChange((prev) => ({ ...prev, certifications: [item, ...prev.certifications] }));
    };

    const updateCert = (id: string, patch: Partial<CertificationItem>) =>
      onChange((prev) => ({
        ...prev,
        certifications: prev.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Certifications</h3>
            <p className="text-xs text-slate-500 mt-0.5">Industry licenses and verified credentials.</p>
          </div>
          <button
            type="button"
            onClick={addCert}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Certification
          </button>
        </div>

        {data.certifications.map((cert) => (
          <div key={cert.id} className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold text-slate-900">{cert.name || 'New Certification'}</span>
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    certifications: prev.certifications.filter((c) => c.id !== cert.id),
                  }))
                }
                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-medium text-slate-600">
                    Certification Name
                  </label>
                  <AIWritingCompanion
                    fieldType="Certifications"
                    fieldKey={`cert.${cert.id}.name`}
                    fieldLabel={
                      cert.issuer
                        ? `${cert.issuer}${cert.date ? ` · ${cert.date}` : ''}`
                        : 'Certification'
                    }
                    currentValue={cert.name}
                    documentType={resolvedCompanionCtx.documentType}
                    documentId={resolvedCompanionCtx.documentId}
                    documentTitle={resolvedCompanionCtx.documentTitle}
                    documentVersion={resolvedCompanionCtx.documentVersion}
                    documentContext={data}
                    careerProfile={resolvedCompanionCtx.careerProfile}
                    jobContext={resolvedCompanionCtx.jobContext}
                    companyResearch={resolvedCompanionCtx.companyResearch}
                    onApply={(val) => updateCert(cert.id, { name: val })}
                    onCancel={() => {}}
                  />
                </div>
                <input
                  type="text"
                  value={cert.name}
                  onChange={(e) => updateCert(cert.id, { name: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Issuing Organization</label>
                <input
                  type="text"
                  value={cert.issuer}
                  onChange={(e) => updateCert(cert.id, { issuer: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Date</label>
                <input
                  type="text"
                  value={cert.date}
                  onChange={(e) => updateCert(cert.id, { date: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Credential ID</label>
                <input
                  type="text"
                  value={cert.credentialId}
                  onChange={(e) => updateCert(cert.id, { credentialId: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLS}>Verification URL</label>
                <input
                  type="text"
                  value={cert.url}
                  onChange={(e) => updateCert(cert.id, { url: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeSection === 'awards') {
    const addAward = () => {
      const item: AwardItem = {
        id: `aw-${crypto.randomUUID().slice(0, 8)}`,
        title: '',
        issuer: '',
        date: '',
        description: '',
      };
      onChange((prev) => ({ ...prev, awards: [item, ...prev.awards] }));
    };
    const updateAward = (id: string, patch: Partial<AwardItem>) =>
      onChange((prev) => ({
        ...prev,
        awards: prev.awards.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Awards &amp; Honors</h3>
            <p className="text-xs text-slate-500 mt-0.5">Recognition, fellowships, and honors.</p>
          </div>
          <button
            type="button"
            onClick={addAward}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Award
          </button>
        </div>
        {data.awards.map((aw) => (
          <div key={aw.id} className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold text-slate-900">{aw.title || 'New Award'}</span>
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({ ...prev, awards: prev.awards.filter((a) => a.id !== aw.id) }))
                }
                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={LABEL_CLS}>Award Title</label>
                <input
                  type="text"
                  value={aw.title}
                  onChange={(e) => updateAward(aw.id, { title: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Issuer</label>
                <input
                  type="text"
                  value={aw.issuer}
                  onChange={(e) => updateAward(aw.id, { issuer: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Date</label>
                <input
                  type="text"
                  value={aw.date}
                  onChange={(e) => updateAward(aw.id, { date: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div className="sm:col-span-3">
                <label className={LABEL_CLS}>Description</label>
                <textarea
                  rows={2}
                  value={aw.description}
                  onChange={(e) => updateAward(aw.id, { description: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeSection === 'volunteer') {
    const addVol = () => {
      const item: VolunteerItem = {
        id: `vol-${crypto.randomUUID().slice(0, 8)}`,
        organization: '',
        role: '',
        startDate: '',
        endDate: '',
        description: '',
      };
      onChange((prev) => ({ ...prev, volunteer: [item, ...prev.volunteer] }));
    };
    const updateVol = (id: string, patch: Partial<VolunteerItem>) =>
      onChange((prev) => ({
        ...prev,
        volunteer: prev.volunteer.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      }));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Volunteer Experience</h3>
            <p className="text-xs text-slate-500 mt-0.5">Community leadership, mentorship, and non-profit service.</p>
          </div>
          <button
            type="button"
            onClick={addVol}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Volunteer Role
          </button>
        </div>
        {data.volunteer.map((vol) => (
          <div key={vol.id} className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold text-slate-900">
                {vol.role || 'Volunteer Role'} {vol.organization ? `· ${vol.organization}` : ''}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    volunteer: prev.volunteer.filter((v) => v.id !== vol.id),
                  }))
                }
                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Role</label>
                <input
                  type="text"
                  value={vol.role}
                  onChange={(e) => updateVol(vol.id, { role: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Organization</label>
                <input
                  type="text"
                  value={vol.organization}
                  onChange={(e) => updateVol(vol.id, { organization: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Start Date</label>
                <input
                  type="text"
                  value={vol.startDate}
                  onChange={(e) => updateVol(vol.id, { startDate: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>End Date</label>
                <input
                  type="text"
                  value={vol.endDate}
                  onChange={(e) => updateVol(vol.id, { endDate: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLS}>Description</label>
                <textarea
                  rows={2}
                  value={vol.description}
                  onChange={(e) => updateVol(vol.id, { description: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeSection === 'languages') {
    const addLang = () => {
      const item: LanguageItem = {
        id: `lang-${crypto.randomUUID().slice(0, 8)}`,
        language: '',
        proficiency: 'Professional Working',
      };
      onChange((prev) => ({ ...prev, languages: [...prev.languages, item] }));
    };
    const updateLang = (id: string, patch: Partial<LanguageItem>) =>
      onChange((prev) => ({
        ...prev,
        languages: prev.languages.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Languages</h3>
            <p className="text-xs text-slate-500 mt-0.5">Spoken and written language proficiencies.</p>
          </div>
          <button
            type="button"
            onClick={addLang}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Language
          </button>
        </div>
        <div className="space-y-2.5">
          {data.languages.map((l) => (
            <div key={l.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
              <input
                type="text"
                value={l.language}
                onChange={(e) => updateLang(l.id, { language: e.target.value })}
                placeholder="Language (e.g. Spanish)"
                className={INPUT_CLS}
              />
              <select
                value={l.proficiency}
                onChange={(e) => updateLang(l.id, { proficiency: e.target.value })}
                className={INPUT_CLS}
              >
                <option value="Native">Native</option>
                <option value="Fluent">Fluent</option>
                <option value="Professional Working">Professional Working</option>
                <option value="Conversational">Conversational</option>
                <option value="Elementary">Elementary</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    languages: prev.languages.filter((item) => item.id !== l.id),
                  }))
                }
                className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Publications
  const addPub = () => {
    const item: PublicationItem = {
      id: `pub-${crypto.randomUUID().slice(0, 8)}`,
      title: '',
      publisher: '',
      date: '',
      url: '',
      summary: '',
    };
    onChange((prev) => ({ ...prev, publications: [item, ...prev.publications] }));
  };
  const updatePub = (id: string, patch: Partial<PublicationItem>) =>
    onChange((prev) => ({
      ...prev,
      publications: prev.publications.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Publications</h3>
          <p className="text-xs text-slate-500 mt-0.5">Articles, papers, patents, or technical posts.</p>
        </div>
        <button
          type="button"
          onClick={addPub}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Publication
        </button>
      </div>
      {data.publications.map((pub) => (
        <div key={pub.id} className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="text-xs font-semibold text-slate-900">{pub.title || 'New Publication'}</span>
            <button
              type="button"
              onClick={() =>
                onChange((prev) => ({
                  ...prev,
                  publications: prev.publications.filter((p) => p.id !== pub.id),
                }))
              }
              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Title</label>
              <input
                type="text"
                value={pub.title}
                onChange={(e) => updatePub(pub.id, { title: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Publisher / Journal</label>
              <input
                type="text"
                value={pub.publisher}
                onChange={(e) => updatePub(pub.id, { publisher: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Date</label>
              <input
                type="text"
                value={pub.date}
                onChange={(e) => updatePub(pub.id, { date: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>URL</label>
              <input
                type="text"
                value={pub.url}
                onChange={(e) => updatePub(pub.id, { url: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL_CLS}>Summary</label>
              <textarea
                rows={2}
                value={pub.summary}
                onChange={(e) => updatePub(pub.id, { summary: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

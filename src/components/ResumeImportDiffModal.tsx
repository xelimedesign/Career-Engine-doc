import React, { useState } from 'react';
import { Check, X, AlertCircle, Briefcase, GraduationCap, Wrench, FolderGit2, User } from 'lucide-react';
import { CareerProfile, EducationItem, PersonalInfo, ProjectItem, WorkExperienceItem } from '../types/career';

interface ResumeImportDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: CareerProfile;
  parsedData: {
    personal?: PersonalInfo;
    summary?: { headline?: string; summary?: string; careerObjectives?: string };
    workExperience?: WorkExperienceItem[];
    education?: EducationItem[];
    skills?: { technical?: string[]; software?: string[]; professional?: string[]; industry?: string[] };
    projects?: ProjectItem[];
    unclear?: string[];
  };
  onApplyChanges: (approvedDelta: {
    personal?: PersonalInfo;
    workExperience: WorkExperienceItem[];
    education: EducationItem[];
    skills: CareerProfile['skills'];
    projects: ProjectItem[];
  }) => void;
}

interface DiffItem<T> {
  id: string;
  type: 'new' | 'update' | 'unchanged';
  title: string;
  subtitle?: string;
  current?: T;
  proposed: T;
  checked: boolean;
}

interface PersonalFieldDiff {
  key: keyof PersonalInfo;
  label: string;
  current: string;
  proposed: string;
  type: 'new' | 'update' | 'unchanged';
  checked: boolean;
}

export function ResumeImportDiffModal({
  isOpen,
  onClose,
  currentProfile,
  parsedData,
  onApplyChanges,
}: ResumeImportDiffModalProps) {
  const [personalDiffs, setPersonalDiffs] = useState<PersonalFieldDiff[]>([]);
  const [workDiffs, setWorkDiffs] = useState<Array<DiffItem<WorkExperienceItem>>>([]);
  const [eduDiffs, setEduDiffs] = useState<Array<DiffItem<EducationItem>>>([]);
  const [projectDiffs, setProjectDiffs] = useState<Array<DiffItem<ProjectItem>>>([]);
  const [skillDiffs, setSkillDiffs] = useState<Array<{ category: string; name: string; type: 'new' | 'unchanged'; checked: boolean }>>([]);

  React.useEffect(() => {
    if (!isOpen || !parsedData) return;

    // 0. Personal Information Diffs
    const proposedPersonal = parsedData.personal || ({} as Partial<PersonalInfo>);
    const currentPersonal = currentProfile.personal || ({} as PersonalInfo);
    const personalFields: Array<{ key: keyof PersonalInfo; label: string }> = [
      { key: 'fullName', label: 'Full Name' },
      { key: 'title', label: 'Professional Title' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'location', label: 'Location' },
      { key: 'linkedin', label: 'LinkedIn' },
      { key: 'portfolio', label: 'Portfolio' },
      { key: 'website', label: 'Website' },
    ];

    const personDiffs: PersonalFieldDiff[] = [];
    personalFields.forEach(({ key, label }) => {
      const propVal = (proposedPersonal[key] || '').trim();
      const currVal = (currentPersonal[key] || '').trim();
      if (!propVal && !currVal) return;
      const type = !currVal ? 'new' : propVal === currVal ? 'unchanged' : 'update';
      if (propVal) {
        personDiffs.push({
          key,
          label,
          current: currVal,
          proposed: propVal,
          type,
          checked: type !== 'unchanged',
        });
      }
    });
    setPersonalDiffs(personDiffs);

    // 1. Work Experience Diffs
    const currentWork = currentProfile.workExperience || [];
    const proposedWork = parsedData.workExperience || [];
    const wDiffs: Array<DiffItem<WorkExperienceItem>> = proposedWork.map((prop, idx) => {
      const match = currentWork.find(
        (c) =>
          c.company.trim().toLowerCase() === prop.company.trim().toLowerCase() &&
          c.position.trim().toLowerCase() === prop.position.trim().toLowerCase()
      );
      const type = match ? 'update' : 'new';
      return {
        id: match?.id || `work-new-${idx}`,
        type,
        title: prop.position,
        subtitle: prop.company,
        current: match,
        proposed: prop,
        checked: type === 'new',
      };
    });
    setWorkDiffs(wDiffs);

    // 2. Education Diffs
    const currentEdu = currentProfile.education || [];
    const proposedEdu = parsedData.education || [];
    const eDiffs: Array<DiffItem<EducationItem>> = proposedEdu.map((prop, idx) => {
      const match = currentEdu.find(
        (c) =>
          c.institution.trim().toLowerCase() === prop.institution.trim().toLowerCase() &&
          c.degree.trim().toLowerCase() === prop.degree.trim().toLowerCase()
      );
      const type = match ? 'update' : 'new';
      return {
        id: match?.id || `edu-new-${idx}`,
        type,
        title: prop.degree,
        subtitle: prop.institution,
        current: match,
        proposed: prop,
        checked: type === 'new',
      };
    });
    setEduDiffs(eDiffs);

    // 3. Projects Diffs
    const currentProj = currentProfile.projects || [];
    const proposedProj = parsedData.projects || [];
    const pDiffs: Array<DiffItem<ProjectItem>> = proposedProj.map((prop, idx) => {
      const match = currentProj.find(
        (c) => c.name.trim().toLowerCase() === prop.name.trim().toLowerCase()
      );
      const type = match ? 'update' : 'new';
      return {
        id: match?.id || `proj-new-${idx}`,
        type,
        title: prop.name,
        current: match,
        proposed: prop,
        checked: type === 'new',
      };
    });
    setProjectDiffs(pDiffs);

    // 4. Skills Diffs
    const currentSkills = currentProfile.skills || { technical: [], software: [], professional: [], industry: [] };
    const proposedSkills = parsedData.skills || { technical: [], software: [], professional: [], industry: [] };
    const sDiffs: Array<{ category: string; name: string; type: 'new' | 'unchanged'; checked: boolean }> = [];

    (['technical', 'software', 'professional', 'industry'] as const).forEach((cat) => {
      const currList = (currentSkills[cat] || []).map((s) => s.toLowerCase());
      const propList = proposedSkills[cat] || [];
      propList.forEach((skillName) => {
        const clean = skillName.trim();
        if (!clean) return;
        const exists = currList.includes(clean.toLowerCase());
        const type = exists ? 'unchanged' : 'new';
        sDiffs.push({
          category: cat,
          name: clean,
          type,
          checked: type === 'new',
        });
      });
    });
    setSkillDiffs(sDiffs);
  }, [isOpen, parsedData, currentProfile]);

  if (!isOpen) return null;

  const handleApply = () => {
    const approvedPersonal: PersonalInfo = { ...currentProfile.personal };
    personalDiffs.forEach((d) => {
      if (d.checked && d.proposed) {
        approvedPersonal[d.key] = d.proposed;
      }
    });

    const approvedWorkMap = new Map<string, WorkExperienceItem>();
    (currentProfile.workExperience || []).forEach((w) => approvedWorkMap.set(w.id, w));
    workDiffs.forEach((d) => {
      if (d.checked) {
        approvedWorkMap.set(d.id, {
          ...d.proposed,
          id: d.id,
        });
      }
    });

    const approvedEduMap = new Map<string, EducationItem>();
    (currentProfile.education || []).forEach((e) => approvedEduMap.set(e.id, e));
    eduDiffs.forEach((d) => {
      if (d.checked) {
        approvedEduMap.set(d.id, {
          ...d.proposed,
          id: d.id,
        });
      }
    });

    const approvedProjMap = new Map<string, ProjectItem>();
    (currentProfile.projects || []).forEach((p) => approvedProjMap.set(p.id, p));
    projectDiffs.forEach((d) => {
      if (d.checked) {
        approvedProjMap.set(d.id, {
          ...d.proposed,
          id: d.id,
        });
      }
    });

    const nextSkills: CareerProfile['skills'] = {
      technical: [...(currentProfile.skills?.technical || [])],
      software: [...(currentProfile.skills?.software || [])],
      professional: [...(currentProfile.skills?.professional || [])],
      industry: [...(currentProfile.skills?.industry || [])],
    };

    skillDiffs.forEach((s) => {
      if (s.checked && s.type === 'new') {
        const catList = nextSkills[s.category as keyof typeof nextSkills];
        if (catList && !catList.map((x) => x.toLowerCase()).includes(s.name.toLowerCase())) {
          catList.push(s.name);
        }
      }
    });

    onApplyChanges({
      personal: approvedPersonal,
      workExperience: Array.from(approvedWorkMap.values()),
      education: Array.from(approvedEduMap.values()),
      skills: nextSkills,
      projects: Array.from(approvedProjMap.values()),
    });
    onClose();
  };

  const unclearWarnings = parsedData.unclear || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Review & Approve Resume Import</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review extracted career history. New items are checked by default; updates are unchecked for deliberate review.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm">
          {unclearWarnings.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Ambiguous or Incomplete Items Found in Resume</span>
              </div>
              <ul className="list-disc pl-5 text-xs text-amber-800 space-y-1">
                {unclearWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Personal Information Diffs */}
          {personalDiffs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-2">
                <User className="w-4 h-4 text-slate-700" />
                <span>Personal Information ({personalDiffs.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {personalDiffs.map((diff) => (
                  <label
                    key={diff.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                      diff.checked ? 'bg-slate-50/80 border-slate-300' : 'bg-white border-slate-200 opacity-75'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={diff.checked}
                      disabled={diff.type === 'unchanged'}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setPersonalDiffs((prev) =>
                          prev.map((p) => (p.key === diff.key ? { ...p, checked: val } : p))
                        );
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{diff.label}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            diff.type === 'new'
                              ? 'bg-emerald-100 text-emerald-800'
                              : diff.type === 'update'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {diff.type}
                        </span>
                      </div>
                      <div className="text-slate-800 font-medium truncate">{diff.proposed}</div>
                      {diff.current && diff.current !== diff.proposed && (
                        <div className="text-[11px] text-slate-400 truncate">Previous: {diff.current}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Work Experience Diffs */}
          {workDiffs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-2">
                <Briefcase className="w-4 h-4 text-slate-700" />
                <span>Work Experience ({workDiffs.length})</span>
              </div>
              <div className="space-y-3">
                {workDiffs.map((diff) => (
                  <label
                    key={diff.id}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border transition-colors cursor-pointer ${
                      diff.checked ? 'bg-slate-50/80 border-slate-300' : 'bg-white border-slate-200 opacity-75'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={diff.checked}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setWorkDiffs((prev) =>
                          prev.map((p) => (p.id === diff.id ? { ...p, checked: val } : p))
                        );
                      }}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-slate-900">{diff.proposed.position}</span>
                          <span className="text-slate-500 text-xs ml-2">@ {diff.proposed.company}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            diff.type === 'new' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {diff.type}
                        </span>
                      </div>

                      {/* Locked Identifying Fields Display */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-white p-2 rounded border border-slate-200 text-slate-600">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Company</span>
                          <span className="font-semibold text-slate-800">{diff.proposed.company}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Position</span>
                          <span className="font-semibold text-slate-800">{diff.proposed.position}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Start Date</span>
                          <span>{diff.proposed.startDate || 'Unspecified'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">End Date</span>
                          <span>{diff.current ? diff.proposed.endDate : diff.proposed.endDate || 'Present'}</span>
                        </div>
                      </div>

                      {diff.proposed.responsibilities?.length > 0 && (
                        <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                          <span className="font-semibold text-slate-700 block">Proposed Responsibilities:</span>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {diff.proposed.responsibilities.map((resp, i) => (
                              <li key={i}>{resp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Education Diffs */}
          {eduDiffs.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-2">
                <GraduationCap className="w-4 h-4 text-slate-700" />
                <span>Education ({eduDiffs.length})</span>
              </div>
              <div className="space-y-3">
                {eduDiffs.map((diff) => (
                  <label
                    key={diff.id}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border transition-colors cursor-pointer ${
                      diff.checked ? 'bg-slate-50/80 border-slate-300' : 'bg-white border-slate-200 opacity-75'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={diff.checked}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setEduDiffs((prev) =>
                          prev.map((p) => (p.id === diff.id ? { ...p, checked: val } : p))
                        );
                      }}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          {diff.proposed.degree} &mdash; {diff.proposed.institution}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            diff.type === 'new' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {diff.type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        Graduation: {diff.proposed.graduationDate || 'Unspecified'} {diff.proposed.fieldOfStudy ? `· Field: ${diff.proposed.fieldOfStudy}` : ''}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Skills Diffs */}
          {skillDiffs.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-2">
                <Wrench className="w-4 h-4 text-slate-700" />
                <span>Skills ({skillDiffs.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {skillDiffs.map((skill, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer ${
                      skill.checked ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200 opacity-75'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={skill.checked}
                      disabled={skill.type === 'unchanged'}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setSkillDiffs((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, checked: val } : s))
                        );
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <span className="font-medium text-slate-900 truncate">{skill.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide ml-2">
                        {skill.category} {skill.type === 'unchanged' ? '(Exists)' : ''}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Projects Diffs */}
          {projectDiffs.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-2">
                <FolderGit2 className="w-4 h-4 text-slate-700" />
                <span>Projects ({projectDiffs.length})</span>
              </div>
              <div className="space-y-3">
                {projectDiffs.map((diff) => (
                  <label
                    key={diff.id}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border transition-colors cursor-pointer ${
                      diff.checked ? 'bg-slate-50/80 border-slate-300' : 'bg-white border-slate-200 opacity-75'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={diff.checked}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setProjectDiffs((prev) =>
                          prev.map((p) => (p.id === diff.id ? { ...p, checked: val } : p))
                        );
                      }}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{diff.proposed.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                          {diff.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{diff.proposed.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4 shrink-0">
          <span className="text-xs text-slate-500">
            Select changes above and click Apply Selected Changes.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Selected Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

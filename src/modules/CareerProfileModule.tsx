import { useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  FolderGit2,
  Globe,
  GraduationCap,
  HeartHandshake,
  Loader2,
  ShieldCheck,
  Upload,
  User,
  Wrench,
} from 'lucide-react';
import { useCareer } from '../store/CareerContext';
import { ResumeSectionsEditor } from '../components/ResumeSectionsEditor';
import { ResumeImportDiffModal } from '../components/ResumeImportDiffModal';
import { CareerProfile, ResumeSectionKey } from '../types/career';
import { ensureStableProfileIds } from '../utils/profileIds';

type ProfileSectionId = 'personal' | ResumeSectionKey;

const PROFILE_SECTIONS: Array<{ id: ProfileSectionId; label: string; icon: typeof User }> = [
  { id: 'personal', label: 'Personal Information', icon: User },
  { id: 'summary', label: 'Professional Summary', icon: BookOpen },
  { id: 'experience', label: 'Work Experience', icon: Briefcase },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'certifications', label: 'Certifications', icon: ShieldCheck },
  { id: 'awards', label: 'Awards & Honors', icon: Award },
  { id: 'volunteer', label: 'Volunteer Experience', icon: HeartHandshake },
  { id: 'languages', label: 'Languages', icon: Globe },
  { id: 'publications', label: 'Publications', icon: BookOpen },
];

export function CareerProfileModule() {
  const { profile, updateProfile, createResume, setActiveModule, user, syncStatus } = useCareer();
  const [activeSection, setActiveSection] = useState<ProfileSectionId>('personal');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [importingResume, setImportingResume] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [aiImportEnabled, setAiImportEnabled] = useState(() => {
    return localStorage.getItem('career_engine_ai_import_enabled') === 'true';
  });
  const [parsedImportData, setParsedImportData] = useState<any | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.pdf') && !lowerName.endsWith('.docx')) {
      setImportError('Please choose a PDF (.pdf) or Word (.docx) resume file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setImportError('Resume file is too large (max 15 MB).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImportingResume(true);
    setImportError(null);
    setImportSuccess(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('aiEnabled', String(aiImportEnabled));

      const res = await fetch('/api/profile/import-resume', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Resume import failed (${res.status})`);
      }

      // Automatically overwrite/update all profile sections with imported data
      updateProfile((prev) => {
        const next: CareerProfile = {
          ...prev,
          personal: {
            ...prev.personal,
            fullName: data?.personal?.fullName?.trim() || prev.personal.fullName,
            title: data?.personal?.title?.trim() || data?.summary?.headline?.trim() || prev.personal.title,
            email: data?.personal?.email?.trim() || prev.personal.email,
            phone: data?.personal?.phone?.trim() || prev.personal.phone,
            location: data?.personal?.location?.trim() || prev.personal.location,
            linkedin: data?.personal?.linkedin?.trim() || prev.personal.linkedin,
            portfolio: data?.personal?.portfolio?.trim() || prev.personal.portfolio,
            website: data?.personal?.website?.trim() || prev.personal.website,
          },
          summary: {
            ...prev.summary,
            headline: data?.summary?.headline?.trim() || data?.personal?.title?.trim() || prev.summary.headline,
            summary: data?.summary?.summary?.trim() || prev.summary.summary,
          },
          workExperience: data?.workExperience?.length ? data.workExperience : prev.workExperience,
          education: data?.education?.length ? data.education : prev.education,
          skills: data?.skills || prev.skills,
          projects: data?.projects?.length ? data.projects : prev.projects,
          certifications: data?.certifications?.length ? data.certifications : prev.certifications,
          awards: data?.awards?.length ? data.awards : prev.awards,
          volunteer: data?.volunteer?.length ? data.volunteer : prev.volunteer,
          languages: data?.languages?.length ? data.languages : prev.languages,
          publications: data?.publications?.length ? data.publications : prev.publications,
          lastImportedAt: data?.lastImportedAt || new Date().toISOString(),
        };
        return ensureStableProfileIds(next);
      });

      setParsedImportData(data);
      setImportSuccess('Master profile successfully updated with personal information and all imported resume sections!');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setImportError('Resume import timed out after 45 seconds. Please try again or turn off AI-Powered Parse for a faster local parse.');
      } else {
        setImportError(err instanceof Error ? err.message : 'Failed to import resume.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setImportingResume(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyApprovedDelta = (approvedDelta: {
    personal?: Partial<CareerProfile['personal']>;
    workExperience: any[];
    education: any[];
    skills: CareerProfile['skills'];
    projects: any[];
  }) => {
    updateProfile((prev) => {
      const next: CareerProfile = {
        ...prev,
        personal: {
          ...prev.personal,
          ...(approvedDelta.personal || {}),
        },
        summary: {
          ...prev.summary,
          headline: parsedImportData?.summary?.headline || prev.summary.headline,
          summary: parsedImportData?.summary?.summary || prev.summary.summary,
        },
        workExperience: approvedDelta.workExperience,
        education: approvedDelta.education,
        skills: approvedDelta.skills,
        projects: approvedDelta.projects,
        lastImportedAt: new Date().toISOString(),
      };
      return ensureStableProfileIds(next);
    });
  };

  const sectionCount = (id: ProfileSectionId): string => {
    switch (id) {
      case 'experience':
        return `${profile.workExperience.length}`;
      case 'education':
        return `${profile.education.length}`;
      case 'projects':
        return `${profile.projects.length}`;
      case 'certifications':
        return `${profile.certifications.length}`;
      case 'awards':
        return `${profile.awards.length}`;
      case 'volunteer':
        return `${profile.volunteer.length}`;
      case 'languages':
        return `${profile.languages.length}`;
      case 'publications':
        return `${profile.publications.length}`;
      case 'skills': {
        const total =
          profile.skills.technical.length +
          profile.skills.software.length +
          profile.skills.professional.length +
          profile.skills.industry.length;
        return `${total}`;
      }
      default:
        return '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Left Navigation */}
      <aside className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-900">Master Career Profile</div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your verified professional record. Resume Builder and Cover Letter Maker import from here without altering your master data.
          </p>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-700">AI-Powered Parse</span>
              <button
                type="button"
                onClick={() => {
                  const next = !aiImportEnabled;
                  setAiImportEnabled(next);
                  localStorage.setItem('career_engine_ai_import_enabled', String(next));
                }}
                className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${aiImportEnabled ? 'bg-purple-600' : 'bg-slate-300'}`}
              >
                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${aiImportEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              {aiImportEnabled ? 'AI Schema Extraction (Gemini)' : 'Local Text-Only Parse'}
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileSelected}
            className="hidden"
          />

          <button
            type="button"
            disabled={importingResume}
            onClick={() => fileInputRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {importingResume ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Upload className="w-4 h-4 shrink-0" />
            )}
            <span>{importingResume ? 'Analyzing Resume (Parsing & AI)...' : 'Import Resume (PDF / DOCX)'}</span>
          </button>

          {importError && (
            <div role="alert" className="p-2.5 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 leading-relaxed">
              {importError}
            </div>
          )}

          {importSuccess && (
            <div role="status" className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-800 leading-relaxed">
              {importSuccess}
            </div>
          )}

          {parsedImportData && (
            <button
              type="button"
              onClick={() => setShowDiffModal(true)}
              className="w-full text-center text-xs text-purple-700 hover:text-purple-900 underline pt-1 cursor-pointer font-medium"
            >
              Review import diff & details
            </button>
          )}

          <div
            className={`pt-1 flex items-center gap-1.5 text-[11px] font-medium ${
              user && syncStatus === 'error'
                ? 'text-rose-700'
                : user && syncStatus === 'syncing'
                  ? 'text-slate-600'
                  : 'text-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            {user
              ? syncStatus === 'syncing'
                ? 'Syncing to Firestore...'
                : syncStatus === 'error'
                  ? 'Sync error (saved locally)'
                  : 'Synced to Firestore'
              : 'Autosaved locally'}
          </div>
        </div>

        <nav className="bg-white border border-slate-200 rounded-lg p-2 space-y-0.5">
          {PROFILE_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            const count = sectionCount(sec.id);
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{sec.label}</span>
                </span>
                {count && (
                  <span
                    className={`font-mono-tabular text-[11px] ${
                      isActive ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => {
            createResume({
              name: `${profile.personal.fullName || 'Career'} — Resume Copy`,
              fromProfile: true,
            });
            setActiveModule('resumes');
          }}
          className="w-full px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Create Resume from Profile
        </button>
      </aside>

      {/* Main Editor */}
      <main className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        {!profile.personal.fullName.trim() &&
          !profile.summary.summary.trim() &&
          profile.workExperience.length === 0 &&
          profile.education.length === 0 &&
          profile.skills.technical.length === 0 &&
          profile.skills.software.length === 0 &&
          profile.skills.professional.length === 0 &&
          profile.skills.industry.length === 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5 max-w-xl">
                <h2 className="text-xs font-semibold text-slate-900">
                  Start building your Master Career Profile
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Import an existing PDF or Word resume on the left to fill everything automatically, or enter your contact details, work history, and skills below from scratch.
                </p>
              </div>
              <button
                type="button"
                disabled={importingResume}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                Import PDF / DOCX
              </button>
            </div>
          )}

        <ResumeSectionsEditor
          activeSection={activeSection}
          data={profile}
          companionContext={{
            documentType: 'career-profile',
            documentId: 'master-career-profile',
            documentTitle: 'Master Career Profile',
            careerProfile: profile,
          }}
          onChange={(updater) =>
            updateProfile((prev) => {
              const updated = updater(prev);
              return {
                ...prev,
                ...updated,
              };
            })
          }
        />
      </main>

      {/* Resume Import Diff Modal */}
      {parsedImportData && (
        <ResumeImportDiffModal
          isOpen={showDiffModal}
          onClose={() => setShowDiffModal(false)}
          currentProfile={profile}
          parsedData={parsedImportData}
          onApplyChanges={handleApplyApprovedDelta}
        />
      )}
    </div>
  );
}

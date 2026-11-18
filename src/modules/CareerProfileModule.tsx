import { useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  FolderGit2,
  Globe,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  User,
  Wrench,
} from 'lucide-react';
import { useCareer } from '../store/CareerContext';
import { ResumeSectionsEditor } from '../components/ResumeSectionsEditor';
import { ResumeSectionKey } from '../types/career';

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
  const { profile, updateProfile, createResume, setActiveModule } = useCareer();
  const [activeSection, setActiveSection] = useState<ProfileSectionId>('personal');

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
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="text-sm font-semibold text-slate-900">Master Career Profile</div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your verified professional record. Resume Builder and Cover Letter Maker import from here without altering your master data.
          </p>
          <div className="pt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Autosaved locally
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
      <main className="bg-white border border-slate-200 rounded-lg p-6">
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
    </div>
  );
}

import {
  CareerProfile,
  CoverLetterDocument,
  CoverLetterFormatting,
  JobApplication,
  ResumeDocument,
  ResumeFormatting,
  ResumeSectionConfig,
} from '../types/career';

export const DEFAULT_RESUME_SECTIONS: ResumeSectionConfig[] = [
  { id: 'summary', label: 'Professional Summary', enabled: true },
  { id: 'experience', label: 'Work Experience', enabled: true },
  { id: 'skills', label: 'Skills', enabled: true },
  { id: 'education', label: 'Education', enabled: true },
  { id: 'projects', label: 'Projects', enabled: true },
  { id: 'certifications', label: 'Certifications', enabled: true },
  { id: 'awards', label: 'Awards & Honors', enabled: false },
  { id: 'volunteer', label: 'Volunteer Experience', enabled: false },
  { id: 'languages', label: 'Languages', enabled: false },
  { id: 'publications', label: 'Publications', enabled: false },
];

export const DEFAULT_RESUME_FORMATTING: ResumeFormatting = {
  fontFamily: 'editorial',
  fontSize: 10.5,
  headingSize: 14,
  accentColor: '#1C1917',
  sectionSpacing: 16,
  pageMargins: 0.65,
  lineSpacing: 1.35,
  headerAlignment: 'left',
};

export const DEFAULT_COVER_LETTER_FORMATTING: CoverLetterFormatting = {
  fontFamily: 'editorial',
  fontSize: 11,
  headingSize: 16,
  textAlignment: 'left',
  pageMargins: 0.85,
  lineSpacing: 1.45,
  paragraphSpacing: 14,
  accentColor: '#1C1917',
};

export const INITIAL_CAREER_PROFILE: CareerProfile = {
  personal: {
    fullName: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    portfolio: '',
    website: '',
  },
  summary: {
    headline: '',
    summary: '',
    careerObjectives: '',
  },
  workExperience: [],
  education: [],
  skills: {
    technical: [],
    software: [],
    professional: [],
    industry: [],
  },
  projects: [],
  certifications: [],
  awards: [],
  volunteer: [],
  languages: [],
  publications: [],
  updatedAt: new Date().toISOString(),
};

export const INITIAL_JOBS: JobApplication[] = [];

export function createResumeFromProfile(
  profile: CareerProfile,
  options?: { name?: string; isMaster?: boolean; linkedJobId?: string }
): ResumeDocument {
  const now = new Date().toISOString();
  return {
    id: `res-${crypto.randomUUID().slice(0, 8)}`,
    name: options?.name || `${profile.personal.fullName || 'Master'} — Resume`,
    version: 1,
    isMaster: options?.isMaster ?? false,
    linkedJobId: options?.linkedJobId,
    personal: structuredClone(profile.personal),
    summary: structuredClone(profile.summary),
    workExperience: structuredClone(profile.workExperience),
    education: structuredClone(profile.education),
    skills: structuredClone(profile.skills),
    projects: structuredClone(profile.projects),
    certifications: structuredClone(profile.certifications),
    awards: structuredClone(profile.awards),
    volunteer: structuredClone(profile.volunteer),
    languages: structuredClone(profile.languages),
    publications: structuredClone(profile.publications),
    sections: structuredClone(DEFAULT_RESUME_SECTIONS),
    documentProfile: 'modern-professional',
    template: 'modern',
    formatting: structuredClone(DEFAULT_RESUME_FORMATTING),
    createdAt: now,
    updatedAt: now,
  };
}

export const INITIAL_RESUMES: ResumeDocument[] = [];

export const INITIAL_COVER_LETTERS: CoverLetterDocument[] = [];

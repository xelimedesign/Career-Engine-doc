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
    fullName: 'Oliver Rowland',
    title: 'Full Stack Developer',
    email: 'oliver.rowland@example.com',
    phone: '(713) 555-0194',
    location: 'Houston, Texas',
    linkedin: 'linkedin.com/in/oliver-rowland',
    portfolio: 'oliverrowland.dev',
    website: 'github.com/oliverrowland',
  },
  summary: {
    headline: 'Building scalable web applications with clean architecture, modern tools, and thoughtful user experience.',
    summary:
      'Full stack developer with 5+ years of experience designing responsive frontend interfaces, developing reliable backend systems, and shipping end-to-end web products across agile engineering teams.',
    careerObjectives:
      'Seeking a Senior Full Stack Engineer role focused on high-performance TypeScript applications, resilient API architecture, and measurable product reliability.',
  },
  workExperience: [
    {
      id: 'exp-1',
      company: 'Northstack',
      position: 'Senior Full Stack Developer',
      location: 'Houston, TX (Remote)',
      employmentType: 'Full-time',
      startDate: 'Jan 2025',
      endDate: 'Present',
      isCurrent: true,
      responsibilities: [
        'Lead full-stack development for scalable web applications and reliable digital products across cross-functional teams.',
        'Architect frontend component systems and backend REST/GraphQL endpoints in TypeScript and Node.js.',
      ],
      achievements: [
        'Reduced core dashboard API latency by 38% through query indexing and selective response caching.',
        'Shipped modular checkout and billing workflows serving 45,000+ monthly active accounts with 99.96% uptime.',
      ],
      technologies: ['React', 'Next.js', 'TypeScript', 'Node.js', 'PostgreSQL'],
    },
    {
      id: 'exp-2',
      company: 'Northstack',
      position: 'Full Stack Developer',
      location: 'Houston, TX',
      employmentType: 'Full-time',
      startDate: 'Jan 2023',
      endDate: 'Dec 2024',
      isCurrent: false,
      responsibilities: [
        'Developed responsive web applications, third-party API integrations, and backend services using modern TypeScript frameworks.',
        'Collaborated closely with product designers and QA engineers to refine release pipelines.',
      ],
      achievements: [
        'Cut client-side bundle size by 27% by introducing route-level code splitting and audit tooling.',
        'Automated end-to-end integration suites across 4 core customer workflows.',
      ],
      technologies: ['React', 'TypeScript', 'Express', 'Redis', 'Docker'],
    },
    {
      id: 'exp-3',
      company: 'Pixelbase',
      position: 'Frontend Developer',
      location: 'Austin, TX',
      employmentType: 'Full-time',
      startDate: 'Apr 2021',
      endDate: 'Dec 2022',
      isCurrent: false,
      responsibilities: [
        'Built responsive user interfaces and interactive web experiences for client and internal digital products.',
        'Focused on WCAG AA accessibility, keyboard navigation, and consistent visual design tokens.',
      ],
      achievements: [
        'Delivered reusable UI component library adopted across 6 client web applications.',
      ],
      technologies: ['React', 'Tailwind CSS', 'TypeScript', 'Vite'],
    },
    {
      id: 'exp-4',
      company: 'CloudCore',
      position: 'Junior Web Developer',
      location: 'Houston, TX',
      employmentType: 'Part-time',
      startDate: 'Aug 2020',
      endDate: 'May 2021',
      isCurrent: false,
      responsibilities: [
        'Assisted in developing responsive website interfaces and internal workflow automation dashboards.',
        'Worked with REST APIs, database migrations, and backend integrations.',
      ],
      achievements: [
        'Improved internal ticket triage form completion speed by streamlining validation feedback.',
      ],
      technologies: ['JavaScript', 'HTML/CSS', 'Node.js', 'SQL'],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'University of Houston',
      degree: 'B.S.',
      fieldOfStudy: 'Computer Science',
      startDate: 'Aug 2017',
      graduationDate: 'May 2021',
      details: 'Coursework in Distributed Systems, Algorithms, Database Design, and Human-Computer Interaction.',
    },
  ],
  skills: {
    technical: ['TypeScript', 'JavaScript', 'React & Next.js', 'Node.js & APIs', 'PostgreSQL', 'REST & GraphQL'],
    software: ['Git & GitHub', 'Docker', 'AWS', 'Figma', 'Playwright'],
    professional: ['System Architecture', 'Technical Mentorship', 'Cross-functional Collaboration', 'Code Review'],
    industry: ['SaaS Platforms', 'B2B Web Applications', 'Performance Optimization', 'Web Accessibility (WCAG)'],
  },
  projects: [
    {
      id: 'proj-1',
      name: 'PulseLedger Analytics UI',
      role: 'Lead Creator',
      url: 'github.com/oliverrowland/pulseledger',
      startDate: '2024',
      endDate: '2024',
      description: 'Open-source tabular financial telemetry grid supporting virtualized 50k-row filtering and CSV export.',
      technologies: ['TypeScript', 'React', 'Web Workers'],
    },
  ],
  certifications: [
    {
      id: 'cert-1',
      name: 'AWS Certified Developer – Associate',
      issuer: 'Amazon Web Services',
      date: 'Mar 2024',
      credentialId: 'AWS-DEV-94812',
      url: '',
    },
  ],
  awards: [],
  volunteer: [],
  languages: [
    { id: 'lang-1', language: 'English', proficiency: 'Native' },
  ],
  publications: [],
  updatedAt: '2026-11-18T10:00:00.000Z',
};

export const INITIAL_JOBS: JobApplication[] = [
  {
    id: 'job-1',
    company: 'Linearity Systems',
    companyWebsite: 'https://linearitysystems.example.com',
    jobTitle: 'Senior Full Stack Engineer',
    jobLocation: 'San Francisco, CA (Hybrid)',
    department: 'Core Product Platform',
    companyAddress: '548 Market St, San Francisco, CA',
    hiringManager: 'Maya Chen',
    applicationDate: '2026-11-18',
    status: 'Saved',
    jobDescription:
      'Linearity Systems is seeking a Senior Full Stack Engineer to own end-to-end delivery of our collaborative workspace and enterprise analytics platform. You will partner closely with Product and Design to build crisp, responsive TypeScript interfaces in React/Next.js and resilient Node.js + PostgreSQL APIs. Candidates should bring deep experience in frontend performance optimization, API latency reduction, accessible component systems, and mentoring mid-level engineers.',
    requiredQualifications: [
      '4+ years of production experience with TypeScript, React, and Node.js',
      'Strong relational database modeling and SQL optimization skills (PostgreSQL)',
      'Track record improving web application performance and system reliability',
      'Experience partnering with Product and Design across the full product lifecycle',
    ],
    preferredQualifications: [
      'Experience building reusable UI component libraries and accessibility compliance',
      'Familiarity with Next.js, Docker, and cloud deployment pipelines',
    ],
    responsibilities: [
      'Design and ship scalable frontend features and backend API services',
      'Optimize query performance, bundle size, and end-to-end reliability',
      'Mentor teammates through architecture reviews and constructive code feedback',
    ],
    technicalRequirements: ['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Docker'],
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T09:00:00.000Z',
  },
  {
    id: 'job-2',
    company: 'Harborline Cloud',
    companyWebsite: 'https://harborlinecloud.example.com',
    jobTitle: 'Staff Frontend Architect',
    jobLocation: 'Austin, TX',
    department: 'Developer Experience',
    companyAddress: '210 Congress Ave, Austin, TX',
    hiringManager: 'David Park',
    applicationDate: '2026-11-15',
    status: 'Applied',
    jobDescription:
      'Harborline Cloud is hiring a Staff Frontend Architect to guide our design system, multi-tenant console performance, and client-side state architecture. Ideal candidates have 5+ years crafting accessible React & TypeScript interfaces, reducing bundle overhead, and working seamlessly with backend platform teams.',
    requiredQualifications: [
      '5+ years building complex React and TypeScript web applications',
      'Demonstrated ownership of reusable component libraries and WCAG accessibility',
      'Strong understanding of REST/GraphQL API design and caching',
    ],
    preferredQualifications: [
      'Experience with automated end-to-end testing and CI quality gates',
    ],
    responsibilities: [
      'Own frontend architecture standards and design system tokens',
      'Lead performance audits and bundle optimization initiatives',
    ],
    technicalRequirements: ['React', 'TypeScript', 'Tailwind CSS', 'GraphQL', 'Playwright'],
    createdAt: '2026-11-15T14:30:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
  },
];

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

export const INITIAL_RESUMES: ResumeDocument[] = [
  {
    ...createResumeFromProfile(INITIAL_CAREER_PROFILE, {
      name: 'Oliver Rowland — Master Resume',
      isMaster: true,
    }),
    id: 'res-master-1',
  },
];

export const INITIAL_COVER_LETTERS: CoverLetterDocument[] = [
  {
    id: 'cl-1',
    title: 'Linearity Systems — Senior Full Stack Engineer',
    version: 1,
    linkedResumeId: 'res-master-1',
    linkedJobId: 'job-1',
    documentProfile: 'modern-professional',
    applicant: {
      fullName: INITIAL_CAREER_PROFILE.personal.fullName,
      email: INITIAL_CAREER_PROFILE.personal.email,
      phone: INITIAL_CAREER_PROFILE.personal.phone,
      location: INITIAL_CAREER_PROFILE.personal.location,
      linkedin: INITIAL_CAREER_PROFILE.personal.linkedin,
      portfolio: INITIAL_CAREER_PROFILE.personal.portfolio,
      website: INITIAL_CAREER_PROFILE.personal.website,
    },
    employer: {
      companyName: 'Linearity Systems',
      hiringManager: 'Maya Chen',
      jobTitle: 'Senior Full Stack Engineer',
      department: 'Core Product Platform',
      companyAddress: '548 Market St, San Francisco, CA',
      applicationDate: 'November 18, 2026',
    },
    jobInfo: {
      jobDescription: INITIAL_JOBS[0].jobDescription,
      requiredQualifications: [...INITIAL_JOBS[0].requiredQualifications],
      preferredQualifications: [...INITIAL_JOBS[0].preferredQualifications],
      responsibilities: [...INITIAL_JOBS[0].responsibilities],
      technicalRequirements: [...INITIAL_JOBS[0].technicalRequirements],
    },
    content: {
      salutation: 'Dear Maya Chen,',
      paragraphs: [
        {
          id: 'p-1',
          label: 'Opening',
          text: 'I am writing to express my interest in the Senior Full Stack Engineer position on the Core Product Platform team at Linearity Systems. With over five years of production experience across TypeScript, React, Next.js, and Node.js, I focus on building responsive user interfaces backed by reliable, low-latency services.',
        },
        {
          id: 'p-2',
          label: 'Relevant Experience',
          text: 'In my current role as Senior Full Stack Developer at Northstack, I lead full-stack delivery for customer-facing web applications and core billing workflows serving more than 45,000 monthly active accounts. By introducing targeted database indexing and response caching in PostgreSQL and Node.js, I reduced core dashboard API latency by 38% while maintaining 99.96% uptime.',
        },
        {
          id: 'p-3',
          label: 'Technical & Design Alignment',
          text: 'Prior to that, at Pixelbase and earlier at Northstack, I partnered closely with product designers to ship an accessible React and Tailwind component library adopted across six web applications and cut client-side bundle size by 27% through route-level splitting. That blend of frontend craft and backend rigor aligns directly with Linearity Systems’ focus on collaborative workspace performance.',
        },
        {
          id: 'p-4',
          label: 'Closing',
          text: 'Thank you for considering my application. I would welcome the opportunity to discuss how my background in full-stack TypeScript architecture and performance optimization can contribute to your engineering team.',
        },
      ],
      closingSignOff: 'Sincerely,',
      signatureName: 'Oliver Rowland',
    },
    writingStyle: 'Professional',
    length: 'Standard',
    template: 'modern',
    formatting: structuredClone(DEFAULT_COVER_LETTER_FORMATTING),
    createdAt: '2026-11-18T09:15:00.000Z',
    updatedAt: '2026-11-18T09:15:00.000Z',
  },
];

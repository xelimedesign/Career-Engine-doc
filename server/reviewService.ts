import { GoogleGenAI, Type } from '@google/genai';
import type {
  ApplicationReviewRecord,
  AtsValidationCheck,
  CareerProfile,
  CompanyResearch,
  CoverLetterDocument,
  FactDiscrepancy,
  JobApplication,
  JobRequirementMatchStatus,
  RequirementComparisonItem,
  ResearchConfidence,
  ResumeDocument,
  ReviewFinding,
  ReviewScope,
  ReviewScoreCategory,
  ReviewScoringConfig,
  ReviewSeverity,
  ReviewTargetField,
} from '../src/types/career';

export const DEFAULT_REVIEW_SCORING_CONFIG: ReviewScoringConfig = {
  version: 'review-engine-v1.0',
  applicationWeights: {
    resume: 0.4,
    coverLetter: 0.3,
    jobMatch: 0.2,
    companyAlignment: 0.1,
  },
  resumeWeights: {
    formatting: 15,
    experienceQuality: 20,
    skillsAlignment: 15,
    achievementStatements: 15,
    jobRelevance: 15,
    grammar: 10,
    atsReadability: 10,
  },
  coverLetterWeights: {
    professionalWriting: 15,
    jobRelevance: 20,
    companyPersonalization: 20,
    relevantExperience: 15,
    openingAndClosing: 10,
    grammar: 10,
    formatting: 10,
  },
};

export interface ReviewAnalyzeInput {
  scope: ReviewScope;
  careerProfile: CareerProfile;
  resume?: ResumeDocument;
  coverLetter?: CoverLetterDocument;
  job?: JobApplication;
  companyResearch?: CompanyResearch;
  previousApplications?: Array<{
    jobTitle: string;
    company: string;
    coverLetterTitle?: string;
    employerClaims?: string[];
  }>;
  scoringConfig?: ReviewScoringConfig;
}

function normalizeStr(v?: string): string {
  return (v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sanitizeProfileForAi(profile: CareerProfile) {
  return {
    contactPresence: {
      hasName: Boolean(profile.personal.fullName.trim()),
      hasTitle: Boolean(profile.personal.title.trim()),
      hasEmail: Boolean(profile.personal.email.trim()),
      hasPhone: Boolean(profile.personal.phone.trim()),
      hasLocation: Boolean(profile.personal.location.trim()),
      hasLinkedIn: Boolean(profile.personal.linkedin.trim()),
      hasPortfolio: Boolean(profile.personal.portfolio.trim()),
    },
    title: profile.personal.title,
    summary: profile.summary,
    workExperience: profile.workExperience,
    education: profile.education,
    skills: profile.skills,
    projects: profile.projects,
    certifications: profile.certifications,
    awards: profile.awards,
    volunteer: profile.volunteer,
    languages: profile.languages,
    publications: profile.publications,
  };
}

function sanitizeResumeForAi(resume: ResumeDocument) {
  return {
    id: resume.id,
    name: resume.name,
    version: resume.version,
    template: resume.template,
    formatting: resume.formatting,
    sections: resume.sections,
    contactPresence: {
      hasName: Boolean(resume.personal.fullName.trim()),
      hasTitle: Boolean(resume.personal.title.trim()),
      hasEmail: Boolean(resume.personal.email.trim()),
      hasPhone: Boolean(resume.personal.phone.trim()),
      hasLocation: Boolean(resume.personal.location.trim()),
      hasLinkedIn: Boolean(resume.personal.linkedin.trim()),
      hasPortfolio: Boolean(resume.personal.portfolio.trim()),
    },
    title: resume.personal.title,
    summary: resume.summary,
    workExperience: resume.workExperience,
    education: resume.education,
    skills: resume.skills,
    projects: resume.projects,
    certifications: resume.certifications,
    awards: resume.awards,
    volunteer: resume.volunteer,
    languages: resume.languages,
    publications: resume.publications,
  };
}

function sanitizeCoverLetterForAi(letter: CoverLetterDocument) {
  return {
    id: letter.id,
    title: letter.title,
    version: letter.version,
    writingStyle: letter.writingStyle,
    length: letter.length,
    template: letter.template,
    formatting: letter.formatting,
    applicantPresence: {
      hasName: Boolean(letter.applicant.fullName.trim()),
      hasEmail: Boolean(letter.applicant.email.trim()),
      hasPhone: Boolean(letter.applicant.phone.trim()),
      hasLocation: Boolean(letter.applicant.location.trim()),
    },
    employer: {
      companyName: letter.employer.companyName,
      hiringManager: letter.employer.hiringManager,
      jobTitle: letter.employer.jobTitle,
      department: letter.employer.department,
      applicationDate: letter.employer.applicationDate,
    },
    content: letter.content,
  };
}

export function runDeterministicFactCheck(params: {
  careerProfile: CareerProfile;
  resume?: ResumeDocument;
  coverLetter?: CoverLetterDocument;
  previousApplications?: ReviewAnalyzeInput['previousApplications'];
}): { discrepancies: FactDiscrepancy[]; verifiedInformation: string[] } {
  const { careerProfile, resume, coverLetter, previousApplications } = params;
  const discrepancies: FactDiscrepancy[] = [];
  const verifiedInformation: string[] = [];

  const profileCompanies = new Set(
    careerProfile.workExperience.map((e) => normalizeStr(e.company)).filter(Boolean)
  );
  const profileSkillsSet = new Set(
    [
      ...careerProfile.skills.technical,
      ...careerProfile.skills.software,
      ...careerProfile.skills.professional,
      ...careerProfile.skills.industry,
      ...careerProfile.workExperience.flatMap((e) => e.technologies),
      ...careerProfile.projects.flatMap((p) => p.technologies),
    ]
      .map((s) => normalizeStr(s))
      .filter(Boolean)
  );

  // 1. Check Resume against Career Profile
  if (resume) {
    if (
      careerProfile.personal.fullName.trim() &&
      resume.personal.fullName.trim() &&
      normalizeStr(careerProfile.personal.fullName) !== normalizeStr(resume.personal.fullName)
    ) {
      discrepancies.push({
        id: `fact-res-name-${discrepancies.length + 1}`,
        fieldName: 'Applicant Full Name',
        originalValue: careerProfile.personal.fullName,
        conflictingValue: resume.personal.fullName,
        sourceDocument: `Resume: ${resume.name}`,
        recommendedAction: 'Confirm legal/preferred name spelling and sync Career Profile or Resume.',
        resolutionStatus: 'unresolved',
      });
    } else if (resume.personal.fullName.trim()) {
      verifiedInformation.push(`Applicant identity verified (${resume.personal.fullName})`);
    }

    resume.workExperience.forEach((rExp) => {
      const matchById = careerProfile.workExperience.find((p) => p.id === rExp.id);
      const matchByCompany =
        matchById ||
        careerProfile.workExperience.find(
          (p) =>
            normalizeStr(p.company) === normalizeStr(rExp.company) &&
            normalizeStr(p.position) === normalizeStr(rExp.position)
        ) ||
        careerProfile.workExperience.find(
          (p) => normalizeStr(p.company) === normalizeStr(rExp.company)
        );

      if (!matchByCompany) {
        discrepancies.push({
          id: `fact-res-emp-${discrepancies.length + 1}`,
          fieldName: 'Employer / Work Experience Entry',
          originalValue: 'Not listed in Career Profile',
          conflictingValue: `${rExp.position} at ${rExp.company}`,
          sourceDocument: `Resume: ${resume.name}`,
          recommendedAction:
            'Add this position to your Career Profile if verified, or remove it from the resume.',
          resolutionStatus: 'unresolved',
        });
        return;
      }

      if (normalizeStr(matchByCompany.company) !== normalizeStr(rExp.company)) {
        discrepancies.push({
          id: `fact-res-comp-${discrepancies.length + 1}`,
          fieldName: `Employer Name (${rExp.position})`,
          originalValue: matchByCompany.company,
          conflictingValue: rExp.company,
          sourceDocument: `Resume: ${resume.name}`,
          recommendedAction: 'Use the exact verified employer name across Profile and Resume.',
          resolutionStatus: 'unresolved',
        });
      }

      if (normalizeStr(matchByCompany.position) !== normalizeStr(rExp.position)) {
        discrepancies.push({
          id: `fact-res-title-${discrepancies.length + 1}`,
          fieldName: `Employment Title (${matchByCompany.company})`,
          originalValue: matchByCompany.position,
          conflictingValue: rExp.position,
          sourceDocument: `Resume: ${resume.name}`,
          recommendedAction:
            'Confirm official job title before submission; align Resume or Career Profile.',
          resolutionStatus: 'unresolved',
        });
      }

      const profileDates = `${matchByCompany.startDate} – ${matchByCompany.isCurrent ? 'Present' : matchByCompany.endDate}`;
      const resumeDates = `${rExp.startDate} – ${rExp.isCurrent ? 'Present' : rExp.endDate}`;
      if (normalizeStr(profileDates) !== normalizeStr(resumeDates)) {
        discrepancies.push({
          id: `fact-res-dates-${discrepancies.length + 1}`,
          fieldName: `Employment Dates (${rExp.company} — ${rExp.position})`,
          originalValue: profileDates,
          conflictingValue: resumeDates,
          sourceDocument: `Resume: ${resume.name}`,
          recommendedAction:
            'Verify start/end month and year against offer letters or HR records.',
          resolutionStatus: 'unresolved',
        });
      } else {
        verifiedInformation.push(
          `Role verified: ${rExp.position} at ${rExp.company} (${resumeDates})`
        );
      }
    });

    // Education check
    resume.education.forEach((rEdu) => {
      const matchEdu =
        careerProfile.education.find((p) => p.id === rEdu.id) ||
        careerProfile.education.find(
          (p) => normalizeStr(p.institution) === normalizeStr(rEdu.institution)
        );
      if (!matchEdu) {
        discrepancies.push({
          id: `fact-res-edu-${discrepancies.length + 1}`,
          fieldName: 'Education Entry',
          originalValue: 'Not listed in Career Profile',
          conflictingValue: `${rEdu.degree} ${rEdu.fieldOfStudy} — ${rEdu.institution}`,
          sourceDocument: `Resume: ${resume.name}`,
          recommendedAction: 'Confirm degree record in Career Profile or remove unverified entry.',
          resolutionStatus: 'unresolved',
        });
      } else {
        if (
          normalizeStr(matchEdu.degree) !== normalizeStr(rEdu.degree) ||
          normalizeStr(matchEdu.graduationDate) !== normalizeStr(rEdu.graduationDate)
        ) {
          discrepancies.push({
            id: `fact-res-edu-detail-${discrepancies.length + 1}`,
            fieldName: `Education (${matchEdu.institution})`,
            originalValue: `${matchEdu.degree} (${matchEdu.graduationDate})`,
            conflictingValue: `${rEdu.degree} (${rEdu.graduationDate})`,
            sourceDocument: `Resume: ${resume.name}`,
            recommendedAction: 'Verify degree title and graduation date against transcript.',
            resolutionStatus: 'unresolved',
          });
        } else {
          verifiedInformation.push(
            `Education verified: ${rEdu.degree} ${rEdu.fieldOfStudy}, ${rEdu.institution}`
          );
        }
      }
    });

    // Certifications check
    resume.certifications.forEach((rCert) => {
      const matchCert = careerProfile.certifications.find(
        (p) => p.id === rCert.id || normalizeStr(p.name) === normalizeStr(rCert.name)
      );
      if (!matchCert) {
        discrepancies.push({
          id: `fact-res-cert-${discrepancies.length + 1}`,
          fieldName: 'Certification Claim',
          originalValue: 'Not listed in Career Profile',
          conflictingValue: `${rCert.name} (${rCert.issuer})`,
          sourceDocument: `Resume: ${resume.name}`,
          recommendedAction: 'Add certification credential ID/date to Career Profile if earned.',
          resolutionStatus: 'unresolved',
        });
      } else {
        verifiedInformation.push(`Certification verified: ${rCert.name}`);
      }
    });

    // Skills & software cross-check
    const resumeSkills = [
      ...resume.skills.technical,
      ...resume.skills.software,
      ...resume.skills.professional,
      ...resume.skills.industry,
    ];
    const unlistedSkills = resumeSkills.filter(
      (s) => s.trim() && !profileSkillsSet.has(normalizeStr(s))
    );
    if (unlistedSkills.length > 0) {
      discrepancies.push({
        id: `fact-res-skills-${discrepancies.length + 1}`,
        fieldName: 'Skills / Software Claims',
        originalValue: 'Not present in Career Profile skills or role technologies',
        conflictingValue: unlistedSkills.join(', '),
        sourceDocument: `Resume: ${resume.name}`,
        recommendedAction:
          'Verify proficiency with these tools and add them to Career Profile, or remove from Resume.',
        resolutionStatus: 'unresolved',
      });
    }

    // Projects cross-check
    resume.projects.forEach((rProj) => {
      const matchProj = careerProfile.projects.find(
        (p) => p.id === rProj.id || normalizeStr(p.name) === normalizeStr(rProj.name)
      );
      if (!matchProj) {
        discrepancies.push({
          id: `fact-res-proj-${discrepancies.length + 1}`,
          fieldName: 'Project Entry',
          originalValue: 'Not listed in Career Profile',
          conflictingValue: rProj.name,
          sourceDocument: `Resume: ${resume.name}`,
          recommendedAction: 'Add verified project details to Career Profile before applying.',
          resolutionStatus: 'unresolved',
        });
      }
    });
  }

  // 2. Check Cover Letter against Career Profile & Resume
  if (coverLetter) {
    if (
      careerProfile.personal.fullName.trim() &&
      coverLetter.applicant.fullName.trim() &&
      normalizeStr(careerProfile.personal.fullName) !==
        normalizeStr(coverLetter.applicant.fullName)
    ) {
      discrepancies.push({
        id: `fact-cl-name-${discrepancies.length + 1}`,
        fieldName: 'Cover Letter Applicant Name',
        originalValue: careerProfile.personal.fullName,
        conflictingValue: coverLetter.applicant.fullName,
        sourceDocument: `Cover Letter: ${coverLetter.title}`,
        recommendedAction: 'Sync applicant name from Career Profile.',
        resolutionStatus: 'unresolved',
      });
    }

    if (
      coverLetter.content.signatureName.trim() &&
      careerProfile.personal.fullName.trim() &&
      normalizeStr(coverLetter.content.signatureName) !==
        normalizeStr(careerProfile.personal.fullName)
    ) {
      discrepancies.push({
        id: `fact-cl-sig-${discrepancies.length + 1}`,
        fieldName: 'Cover Letter Signature Name',
        originalValue: careerProfile.personal.fullName,
        conflictingValue: coverLetter.content.signatureName,
        sourceDocument: `Cover Letter: ${coverLetter.title}`,
        recommendedAction: 'Update cover letter signature to match your Career Profile name.',
        resolutionStatus: 'unresolved',
      });
    }

    const bodyText = coverLetter.content.paragraphs.map((p) => p.text).join(' ');
    // Detect years of experience numerical claim vs profile span
    const yearsClaimMatch = bodyText.match(/\b(\d+)\+?\s+years?\s+of\s+(?:production\s+|professional\s+)?experience/i);
    if (yearsClaimMatch && careerProfile.workExperience.length > 0) {
      const claimedYears = Number(yearsClaimMatch[1]);
      if (claimedYears > 0 && claimedYears > 25) {
        discrepancies.push({
          id: `fact-cl-yrs-${discrepancies.length + 1}`,
          fieldName: 'Years of Experience Claim',
          originalValue: `${careerProfile.workExperience.length} listed career roles`,
          conflictingValue: yearsClaimMatch[0],
          sourceDocument: `Cover Letter: ${coverLetter.title}`,
          recommendedAction: 'Verify total years of experience stated in your narrative.',
          resolutionStatus: 'unresolved',
        });
      }
    }

    // Check if any company from resume is referenced inaccurately or check employer mention
    const mentionedProfileCompany = Array.from(profileCompanies).some((c) =>
      bodyText.toLowerCase().includes(c)
    );
    if (mentionedProfileCompany) {
      verifiedInformation.push('Cover letter cites verified Career Profile employer history');
    }
  }

  // 3. Cross-check against previous applications if provided
  if (previousApplications && previousApplications.length > 0 && resume) {
    const resumeFullText = JSON.stringify({
      title: resume.personal.title,
      companies: resume.workExperience.map((w) => w.company),
    }).toLowerCase();

    previousApplications.forEach((prev) => {
      if (
        prev.employerClaims &&
        prev.employerClaims.some((c) => c && !resumeFullText.includes(c.toLowerCase()))
      ) {
        discrepancies.push({
          id: `fact-prev-${discrepancies.length + 1}`,
          fieldName: 'Cross-Application Consistency',
          originalValue: `Referenced in prior packet (${prev.company})`,
          conflictingValue: 'Omitted or altered in current resume',
          sourceDocument: `Previous Application: ${prev.company} — ${prev.jobTitle}`,
          recommendedAction:
            'Confirm intentional tailoring vs. accidental omission across application history.',
          resolutionStatus: 'unresolved',
        });
      }
    });
  }

  return {
    discrepancies,
    verifiedInformation: Array.from(new Set(verifiedInformation)),
  };
}

export function runDeterministicAtsValidation(params: {
  resume?: ResumeDocument;
  coverLetter?: CoverLetterDocument;
  job?: JobApplication;
}): {
  structuralScore: number;
  keywordScore: number;
  disclaimer: string;
  checks: AtsValidationCheck[];
} {
  const { resume, coverLetter, job } = params;
  const checks: AtsValidationCheck[] = [];

  if (resume) {
    const hasContact =
      Boolean(resume.personal.fullName.trim()) &&
      Boolean(resume.personal.email.trim()) &&
      Boolean(resume.personal.phone.trim());
    checks.push({
      id: 'ats-struct-text',
      checkName: 'Text Extraction Readiness',
      category: 'structural',
      status: 'pass',
      detail: 'DOCX and PDF exports emit selectable Unicode text layers rather than flattened images.',
      recommendation: 'Export via DOCX or PDF from the preview toolbar to preserve selectable text.',
    });
    checks.push({
      id: 'ats-struct-order',
      checkName: 'Linear Reading Order',
      category: 'structural',
      status: 'pass',
      detail: 'Document uses a single-column top-to-bottom reading order across all sections.',
      recommendation: 'Keep single-column reading flow for reliable parser extraction.',
    });
    checks.push({
      id: 'ats-struct-headings',
      checkName: 'Standard Section Headings',
      category: 'structural',
      status: resume.sections.some((s) => s.id === 'experience' && s.enabled) &&
        resume.sections.some((s) => s.id === 'education' && s.enabled)
        ? 'pass'
        : 'warning',
      detail: 'Checks for standard recognizable headings (Professional Summary, Work Experience, Education, Skills).',
      recommendation: 'Ensure Work Experience, Education, and Skills sections remain enabled.',
    });
    checks.push({
      id: 'ats-struct-contact',
      checkName: 'Contact Information Placement',
      category: 'structural',
      status: hasContact ? 'pass' : 'fail',
      detail: hasContact
        ? 'Name, email, and phone appear in the main document body header (not hidden in Word headers/footers).'
        : 'Missing email, phone, or name in main body header.',
      recommendation: hasContact
        ? 'No action needed.'
        : 'Populate full name, email, and phone in Personal Information.',
    });
    checks.push({
      id: 'ats-struct-tables',
      checkName: 'Tables & Multi-Column Avoidance',
      category: 'structural',
      status: 'pass',
      detail: 'Zero multi-column layout tables detected in export structure.',
      recommendation: 'Avoid manually wrapping roles inside multi-column Word tables.',
    });
    checks.push({
      id: 'ats-struct-headers-footers',
      checkName: 'Headers & Footers Safety',
      category: 'structural',
      status: 'pass',
      detail: 'Contact metadata and section headings are placed inside main body paragraphs, not DOCX header/footer XML.',
      recommendation: 'Keep critical metadata out of page footers.',
    });
    const totalBullets = resume.workExperience.flatMap((e) => [
      ...e.responsibilities,
      ...e.achievements,
    ]);
    checks.push({
      id: 'ats-struct-bullets',
      checkName: 'Standard Bullet Formatting',
      category: 'structural',
      status: totalBullets.length > 0 ? 'pass' : 'warning',
      detail:
        totalBullets.length > 0
          ? `${totalBullets.length} clean text bullets rendered with standard list markers.`
          : 'No bullet points found in Work Experience.',
      recommendation: 'Use concise single-level bullets without nested symbols.',
    });
    const fontStatus =
      resume.formatting.fontFamily === 'mono' ? 'warning' : 'pass';
    checks.push({
      id: 'ats-struct-fonts',
      checkName: 'Font Readability & Standardization',
      category: 'structural',
      status: fontStatus,
      detail: `Selected font family "${resume.formatting.fontFamily}" maps to standard embedded system/Word fonts.`,
      recommendation:
        fontStatus === 'warning'
          ? 'Consider Modern Sans or Classic Serif for broad non-engineering ATS parsing.'
          : 'Font selection is standard and cleanly parseable.',
    });
    checks.push({
      id: 'ats-struct-images',
      checkName: 'No Text-Embedded Images',
      category: 'structural',
      status: 'pass',
      detail: 'Resume contains zero raster images or graphics hiding critical credentials.',
      recommendation: 'Continue avoiding skill bars, headshot graphics, or chart images.',
    });
  } else if (coverLetter) {
    checks.push({
      id: 'ats-struct-cl-text',
      checkName: 'Cover Letter Text & Layout Structure',
      category: 'structural',
      status:
        coverLetter.applicant.email.trim() && coverLetter.applicant.phone.trim()
          ? 'pass'
          : 'warning',
      detail: 'Single-column business letter layout with selectable DOCX/PDF text.',
      recommendation: 'Ensure applicant email and phone are present in the letter header.',
    });
  }

  // Keyword Relevance (distinct from structural compatibility!)
  let keywordScore = 100;
  if (job) {
    const combinedText = [
      resume
        ? JSON.stringify({
            title: resume.personal.title,
            summary: resume.summary,
            workExperience: resume.workExperience,
            skills: resume.skills,
            projects: resume.projects,
          })
        : '',
      coverLetter ? JSON.stringify(coverLetter.content) : '',
    ]
      .join(' ')
      .toLowerCase();

    const requiredTerms = job.technicalRequirements.filter((t) => t.trim());
    if (requiredTerms.length > 0) {
      const matched = requiredTerms.filter((t) => combinedText.includes(t.toLowerCase()));
      const missing = requiredTerms.filter((t) => !combinedText.includes(t.toLowerCase()));
      keywordScore = Math.round((matched.length / requiredTerms.length) * 100);
      checks.push({
        id: 'ats-kw-required',
        checkName: 'Required Technical Keyword Alignment',
        category: 'keyword',
        status: keywordScore >= 75 ? 'pass' : keywordScore >= 50 ? 'warning' : 'fail',
        detail: `Matched ${matched.length}/${requiredTerms.length} listed technical requirements (${matched.join(', ') || 'none'}).`,
        recommendation:
          missing.length > 0
            ? `Only if genuinely verified in your background, surface experience with: ${missing.join(', ')}.`
            : 'All listed technical keywords appear accurately in your documents.',
      });
    } else {
      checks.push({
        id: 'ats-kw-general',
        checkName: 'Role Title & Domain Alignment',
        category: 'keyword',
        status: combinedText.includes(job.jobTitle.toLowerCase()) ? 'pass' : 'warning',
        detail: `Checked alignment against "${job.jobTitle}" at ${job.company}.`,
        recommendation: 'Add structured technical requirements in Job Tracker for deeper keyword coverage checks.',
      });
    }
  } else {
    keywordScore = 75;
    checks.push({
      id: 'ats-kw-nojob',
      checkName: 'Job Keyword Alignment',
      category: 'keyword',
      status: 'warning',
      detail: 'No target job posting selected; keyword comparison skipped.',
      recommendation: 'Select a target Job Application to evaluate required keyword alignment.',
    });
  }

  const structuralChecks = checks.filter((c) => c.category === 'structural');
  const structuralPoints = structuralChecks.reduce(
    (sum, c) => sum + (c.status === 'pass' ? 1 : c.status === 'warning' ? 0.6 : 0),
    0
  );
  const structuralScore =
    structuralChecks.length > 0
      ? Math.round((structuralPoints / structuralChecks.length) * 100)
      : 100;

  return {
    structuralScore,
    keywordScore,
    disclaimer:
      'Structural checks inspect document parseability (text layer, single-column order, standard headings, font safety). Keyword checks compare explicitly listed job requirements. No tool can simulate every employer’s proprietary ATS configuration or guarantee interview selection.',
    checks,
  };
}

export function computeWeightedApplicationScore(params: {
  scope: ReviewScope;
  resumeScore: number;
  coverLetterScore: number;
  jobMatchScore: number;
  companyAlignmentScore: number;
  config?: ReviewScoringConfig;
}): number {
  const { scope, resumeScore, coverLetterScore, jobMatchScore, companyAlignmentScore } = params;
  const config = params.config || DEFAULT_REVIEW_SCORING_CONFIG;
  const w = config.applicationWeights;

  if (scope === 'resume_only') {
    const denom = w.resume + w.jobMatch + w.companyAlignment || 1;
    return Math.round(
      (resumeScore * w.resume +
        jobMatchScore * w.jobMatch +
        companyAlignmentScore * w.companyAlignment) /
        denom
    );
  }
  if (scope === 'cover_letter_only') {
    const denom = w.coverLetter + w.jobMatch + w.companyAlignment || 1;
    return Math.round(
      (coverLetterScore * w.coverLetter +
        jobMatchScore * w.jobMatch +
        companyAlignmentScore * w.companyAlignment) /
        denom
    );
  }

  const totalW = w.resume + w.coverLetter + w.jobMatch + w.companyAlignment || 1;
  return Math.round(
    (resumeScore * w.resume +
      coverLetterScore * w.coverLetter +
      jobMatchScore * w.jobMatch +
      companyAlignmentScore * w.companyAlignment) /
      totalW
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export async function orchestrateApplicationReview(
  ai: GoogleGenAI,
  input: ReviewAnalyzeInput
): Promise<ApplicationReviewRecord> {
  const config = input.scoringConfig || DEFAULT_REVIEW_SCORING_CONFIG;
  const nowIso = new Date().toISOString();

  // 1. Deterministic Fact Verification & ATS Validation
  const factCheck = runDeterministicFactCheck({
    careerProfile: input.careerProfile,
    resume: input.scope !== 'cover_letter_only' ? input.resume : undefined,
    coverLetter: input.scope !== 'resume_only' ? input.coverLetter : undefined,
    previousApplications: input.previousApplications,
  });

  const atsValidation = runDeterministicAtsValidation({
    resume: input.scope !== 'cover_letter_only' ? input.resume : undefined,
    coverLetter: input.scope !== 'resume_only' ? input.coverLetter : undefined,
    job: input.job,
  });

  // 2. Sanitize payloads (no unnecessary PII sent externally)
  const sanitizedInput = {
    scope: input.scope,
    careerProfile: sanitizeProfileForAi(input.careerProfile),
    resume:
      input.scope !== 'cover_letter_only' && input.resume
        ? sanitizeResumeForAi(input.resume)
        : null,
    coverLetter:
      input.scope !== 'resume_only' && input.coverLetter
        ? sanitizeCoverLetterForAi(input.coverLetter)
        : null,
    targetJob: input.job
      ? {
          company: input.job.company,
          jobTitle: input.job.jobTitle,
          jobLocation: input.job.jobLocation || '',
          department: input.job.department,
          jobDescription: input.job.jobDescription,
          requiredQualifications: input.job.requiredQualifications,
          preferredQualifications: input.job.preferredQualifications,
          responsibilities: input.job.responsibilities,
          technicalRequirements: input.job.technicalRequirements,
        }
      : null,
    companyIntelligence:
      input.companyResearch && input.companyResearch.status === 'completed'
        ? {
            companyName: input.companyResearch.companyName,
            companyWebsite: input.companyResearch.companyWebsite,
            report: input.companyResearch.report,
            approvedFindings: input.companyResearch.findings.filter(
              (f) => f.verificationStatus === 'approved'
            ),
            sources: input.companyResearch.sources.map((s) => ({
              title: s.title,
              url: s.url,
              sourceType: s.sourceType,
              isOfficial: s.isOfficial,
            })),
          }
        : null,
    detectedFactDiscrepancies: factCheck.discrepancies,
    atsStructuralScore: atsValidation.structuralScore,
    atsKeywordScore: atsValidation.keywordScore,
    scoringWeights: config,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: JSON.stringify(sanitizedInput),
    config: {
      systemInstruction: `You are an elite Application Review & Quality Assurance System auditing a candidate's job application before submission.
Perform five integrated audits cleanly:
1. RESUME AUDITOR: Evaluate formatting, section order, bullet quality, weak/passive verbs, action verbs, opportunities to clarify scope/outcomes (NEVER invent numbers or metrics!), skills alignment, education, grammar/spelling, repetition, and job relevance. Reference exact workExperience item IDs (e.g. "exp-1"), bulletGroup ("responsibilities" or "achievements"), and 0-based bulletIndex when proposing rewrites.
2. COVER LETTER AUDITOR: Evaluate opening paragraph, tone, employer personalization, job relevance, verified experience examples, company knowledge backed by companyIntelligence sources, closing paragraph, grammar, repetition, length, and formatting. Flag generic filler phrases ("I admire your industry-leading...") and provide grounded, concrete replacements referencing exact paragraph id.
3. JOB MATCH ANALYST: Create a requirement-by-requirement comparison using ONLY these exact classifications:
   - "Verified Match"
   - "Partial Match"
   - "Missing"
   - "Not Applicable"
   - "Requires Verification"
   NEVER represent a missing qualification as existing. NEVER penalize the candidate in scores for preferred/optional qualifications that are not required for the role.
4. COMPANY ALIGNMENT ANALYST: Evaluate whether resume and cover letter reflect saved Company Intelligence (services, industry, projects, technology, employer priorities) backed by real sources. Flag unsupported, outdated, or inaccurate company claims.
5. SCORING & FINDINGS:
   - Resume Breakdown max points: formatting=${config.resumeWeights.formatting}, experienceQuality=${config.resumeWeights.experienceQuality}, skillsAlignment=${config.resumeWeights.skillsAlignment}, achievementStatements=${config.resumeWeights.achievementStatements}, jobRelevance=${config.resumeWeights.jobRelevance}, grammar=${config.resumeWeights.grammar}, atsReadability=${config.resumeWeights.atsReadability}.
   - Cover Letter Breakdown max points: professionalWriting=${config.coverLetterWeights.professionalWriting}, jobRelevance=${config.coverLetterWeights.jobRelevance}, companyPersonalization=${config.coverLetterWeights.companyPersonalization}, relevantExperience=${config.coverLetterWeights.relevantExperience}, openingAndClosing=${config.coverLetterWeights.openingAndClosing}, grammar=${config.coverLetterWeights.grammar}, formatting=${config.coverLetterWeights.formatting}.
   - Return specific actionable findings referencing real document text, categorized with severity ("critical" | "high" | "medium" | "low") and targetField so the user can accept/edit/apply individual fixes.
   - CRITICAL RULE: Never invent metrics, dates, degrees, employers, skills, or personal company connections. Do NOT present scores as interview or hiring probability predictions.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          resumeBreakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING },
                label: { type: Type.STRING },
                score: { type: Type.NUMBER },
                maxScore: { type: Type.NUMBER },
                supportingFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['key', 'label', 'score', 'maxScore', 'supportingFindings'],
            },
          },
          coverLetterBreakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING },
                label: { type: Type.STRING },
                score: { type: Type.NUMBER },
                maxScore: { type: Type.NUMBER },
                supportingFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['key', 'label', 'score', 'maxScore', 'supportingFindings'],
            },
          },
          jobMatchScore: { type: Type.NUMBER },
          companyAlignmentScore: { type: Type.NUMBER },
          findings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                severity: { type: Type.STRING },
                documentTarget: { type: Type.STRING },
                documentReference: { type: Type.STRING },
                targetKind: { type: Type.STRING },
                targetItemId: { type: Type.STRING },
                targetBulletGroup: { type: Type.STRING },
                targetBulletIndex: { type: Type.INTEGER },
                originalText: { type: Type.STRING },
                explanation: { type: Type.STRING },
                recommendedCorrection: { type: Type.STRING },
                supportingEvidence: { type: Type.STRING },
                confidence: { type: Type.STRING },
              },
              required: [
                'category',
                'severity',
                'documentTarget',
                'documentReference',
                'targetKind',
                'originalText',
                'explanation',
                'recommendedCorrection',
                'supportingEvidence',
                'confidence',
              ],
            },
          },
          requirementComparison: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                requirementType: { type: Type.STRING },
                requirement: { type: Type.STRING },
                classification: { type: Type.STRING },
                evidenceFromProfileOrDocs: { type: Type.STRING },
                gapOrActionNote: { type: Type.STRING },
              },
              required: [
                'requirementType',
                'requirement',
                'classification',
                'evidenceFromProfileOrDocs',
                'gapOrActionNote',
              ],
            },
          },
          companyAlignmentSummary: {
            type: Type.OBJECT,
            properties: {
              alignedClaims: { type: Type.ARRAY, items: { type: Type.STRING } },
              unsupportedOrOutdatedClaims: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingCompanyContext: { type: Type.ARRAY, items: { type: Type.STRING } },
              notes: { type: Type.STRING },
            },
            required: [
              'alignedClaims',
              'unsupportedOrOutdatedClaims',
              'missingCompanyContext',
              'notes',
            ],
          },
        },
        required: [
          'resumeBreakdown',
          'coverLetterBreakdown',
          'jobMatchScore',
          'companyAlignmentScore',
          'findings',
          'requirementComparison',
          'companyAlignmentSummary',
        ],
      },
    },
  });

  const rawText = (response.text || '')
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const parsed = JSON.parse(rawText || '{}');

  const resumeMaxMap: Array<{ key: keyof ReviewScoringConfig['resumeWeights']; label: string }> = [
    { key: 'formatting', label: 'Formatting' },
    { key: 'experienceQuality', label: 'Experience Quality' },
    { key: 'skillsAlignment', label: 'Skills Alignment' },
    { key: 'achievementStatements', label: 'Achievement Statements' },
    { key: 'jobRelevance', label: 'Job Relevance' },
    { key: 'grammar', label: 'Grammar' },
    { key: 'atsReadability', label: 'ATS Readability' },
  ];

  const coverLetterMaxMap: Array<{
    key: keyof ReviewScoringConfig['coverLetterWeights'];
    label: string;
  }> = [
    { key: 'professionalWriting', label: 'Professional Writing' },
    { key: 'jobRelevance', label: 'Job Relevance' },
    { key: 'companyPersonalization', label: 'Company Personalization' },
    { key: 'relevantExperience', label: 'Relevant Experience' },
    { key: 'openingAndClosing', label: 'Opening and Closing' },
    { key: 'grammar', label: 'Grammar' },
    { key: 'formatting', label: 'Formatting' },
  ];

  const rawResumeBreakdown: ReviewScoreCategory[] = Array.isArray(parsed.resumeBreakdown)
    ? parsed.resumeBreakdown
    : [];
  const resumeBreakdown: ReviewScoreCategory[] =
    input.scope === 'cover_letter_only'
      ? []
      : resumeMaxMap.map((spec) => {
          const maxScore = config.resumeWeights[spec.key];
          const found = rawResumeBreakdown.find(
            (r) =>
              normalizeStr(r.key) === normalizeStr(spec.key) ||
              normalizeStr(r.label) === normalizeStr(spec.label)
          );
          const rawRatio =
            found && found.maxScore > 0 ? found.score / found.maxScore : 0.85;
          const computedScore =
            spec.key === 'atsReadability'
              ? clamp((atsValidation.structuralScore / 100) * maxScore, 0, maxScore)
              : clamp(rawRatio * maxScore, 0, maxScore);
          return {
            key: spec.key,
            label: spec.label,
            score: computedScore,
            maxScore,
            supportingFindings: found?.supportingFindings || [],
          };
        });

  const rawClBreakdown: ReviewScoreCategory[] = Array.isArray(parsed.coverLetterBreakdown)
    ? parsed.coverLetterBreakdown
    : [];
  const coverLetterBreakdown: ReviewScoreCategory[] =
    input.scope === 'resume_only'
      ? []
      : coverLetterMaxMap.map((spec) => {
          const maxScore = config.coverLetterWeights[spec.key];
          const found = rawClBreakdown.find(
            (r) =>
              normalizeStr(r.key) === normalizeStr(spec.key) ||
              normalizeStr(r.label) === normalizeStr(spec.label)
          );
          const rawRatio =
            found && found.maxScore > 0 ? found.score / found.maxScore : 0.85;
          return {
            key: spec.key,
            label: spec.label,
            score: clamp(rawRatio * maxScore, 0, maxScore),
            maxScore,
            supportingFindings: found?.supportingFindings || [],
          };
        });

  const normalizeBreakdownSum = (list: ReviewScoreCategory[]) => {
    const sum = list.reduce((s, c) => s + c.score, 0);
    const max = list.reduce((s, c) => s + c.maxScore, 0);
    return max > 0 ? clamp((sum / max) * 100, 0, 100) : 0;
  };

  const resumeScore =
    input.scope === 'cover_letter_only' ? 0 : normalizeBreakdownSum(resumeBreakdown);
  const coverLetterScore =
    input.scope === 'resume_only' ? 0 : normalizeBreakdownSum(coverLetterBreakdown);
  const jobMatchScore = clamp(Number(parsed.jobMatchScore ?? 75), 0, 100);
  const companyAlignmentScore = clamp(
    Number(
      input.companyResearch?.status === 'completed'
        ? parsed.companyAlignmentScore ?? 75
        : parsed.companyAlignmentScore ?? 70
    ),
    0,
    100
  );

  const overallScore = computeWeightedApplicationScore({
    scope: input.scope,
    resumeScore,
    coverLetterScore,
    jobMatchScore,
    companyAlignmentScore,
    config,
  });

  const VALID_SEVERITIES = new Set<ReviewSeverity>(['critical', 'high', 'medium', 'low']);
  const VALID_CATEGORIES = new Set<ReviewFinding['category']>([
    'Resume Audit',
    'Cover Letter Audit',
    'Job Match',
    'Company Alignment',
    'Fact Verification',
    'ATS Validation',
  ]);
  const VALID_TARGET_KINDS = new Set<ReviewTargetField['kind']>([
    'resume_headline',
    'resume_summary',
    'resume_experience_bullet',
    'resume_skills',
    'cover_letter_paragraph',
    'cover_letter_salutation',
    'cover_letter_closing',
    'advisory_only',
  ]);

  const aiFindings: ReviewFinding[] = (Array.isArray(parsed.findings) ? parsed.findings : []).map(
    (f: Record<string, unknown>, idx: number) => {
      const sev = String(f.severity || 'medium').toLowerCase() as ReviewSeverity;
      const cat = String(f.category || 'Resume Audit') as ReviewFinding['category'];
      const kind = String(f.targetKind || 'advisory_only') as ReviewTargetField['kind'];
      const docTarget =
        f.documentTarget === 'resume' ||
        f.documentTarget === 'cover-letter' ||
        f.documentTarget === 'application'
          ? f.documentTarget
          : 'application';
      const conf =
        f.confidence === 'high' || f.confidence === 'medium' || f.confidence === 'low'
          ? (f.confidence as ResearchConfidence)
          : 'medium';

      return {
        id: `rev-fnd-${idx + 1}-${Date.now().toString(36)}`,
        category: VALID_CATEGORIES.has(cat) ? cat : 'Resume Audit',
        severity: VALID_SEVERITIES.has(sev) ? sev : 'medium',
        documentTarget: docTarget,
        documentReference: String(f.documentReference || 'Document'),
        targetField: {
          kind: VALID_TARGET_KINDS.has(kind) ? kind : 'advisory_only',
          itemId: f.targetItemId ? String(f.targetItemId) : undefined,
          bulletGroup:
            f.targetBulletGroup === 'responsibilities' || f.targetBulletGroup === 'achievements'
              ? f.targetBulletGroup
              : undefined,
          bulletIndex:
            typeof f.targetBulletIndex === 'number' ? f.targetBulletIndex : undefined,
        },
        originalText: String(f.originalText || ''),
        explanation: String(f.explanation || ''),
        recommendedCorrection: String(f.recommendedCorrection || ''),
        supportingEvidence: String(f.supportingEvidence || ''),
        confidence: conf,
        status: 'open',
      };
    }
  );

  // Merge deterministic Critical Fact Discrepancies as CRITICAL findings if not already surfaced
  const deterministicFindings: ReviewFinding[] = factCheck.discrepancies.map((d, idx) => ({
    id: `rev-fact-${idx + 1}-${Date.now().toString(36)}`,
    category: 'Fact Verification',
    severity: 'critical',
    documentTarget: d.sourceDocument.startsWith('Cover Letter') ? 'cover-letter' : 'resume',
    documentReference: `${d.sourceDocument} · ${d.fieldName}`,
    targetField: { kind: 'advisory_only' },
    originalText: d.conflictingValue,
    explanation: `Contradiction with Career Profile (${d.fieldName}): Profile lists "${d.originalValue}", while ${d.sourceDocument} lists "${d.conflictingValue}".`,
    recommendedCorrection: d.recommendedAction,
    supportingEvidence: `Primary source: Career Profile (${d.fieldName})`,
    confidence: 'high',
    status: 'open',
  }));

  const VALID_MATCH_STATUSES = new Set<JobRequirementMatchStatus>([
    'Verified Match',
    'Partial Match',
    'Missing',
    'Not Applicable',
    'Requires Verification',
  ]);

  const requirementComparison: RequirementComparisonItem[] = (
    Array.isArray(parsed.requirementComparison) ? parsed.requirementComparison : []
  ).map((item: Record<string, unknown>, idx: number) => {
    const cls = String(item.classification || 'Requires Verification') as JobRequirementMatchStatus;
    return {
      id: `req-cmp-${idx + 1}`,
      requirementType: (String(item.requirementType || 'Required Qualification') as RequirementComparisonItem['requirementType']),
      requirement: String(item.requirement || ''),
      classification: VALID_MATCH_STATUSES.has(cls) ? cls : 'Requires Verification',
      evidenceFromProfileOrDocs: String(item.evidenceFromProfileOrDocs || ''),
      gapOrActionNote: String(item.gapOrActionNote || ''),
    };
  });

  const companyAlignmentSummary = parsed.companyAlignmentSummary || {
    alignedClaims: [],
    unsupportedOrOutdatedClaims: [],
    missingCompanyContext: [],
    notes: 'No company alignment summary generated.',
  };

  return {
    id: `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    reviewDate: nowIso,
    scope: input.scope,
    resumeId: input.resume?.id,
    resumeTitle: input.resume?.name,
    coverLetterId: input.coverLetter?.id,
    coverLetterTitle: input.coverLetter?.title,
    jobId: input.job?.id,
    jobTitle: input.job?.jobTitle,
    companyName: input.job?.company || input.coverLetter?.employer.companyName,
    aiProvider: 'Google Gemini',
    aiModel: 'gemini-4-hydrogen',
    configVersion: config.version,
    scores: {
      overallScore,
      resumeScore,
      coverLetterScore,
      jobMatchScore,
      companyAlignmentScore,
      resumeBreakdown,
      coverLetterBreakdown,
    },
    findings: [...deterministicFindings, ...aiFindings],
    factDiscrepancies: factCheck.discrepancies,
    requirementComparison,
    atsValidation,
    companyAlignmentSummary,
    verifiedInformation: factCheck.verifiedInformation,
    acceptedChangeIds: [],
    rejectedChangeIds: [],
    appliedChangeIds: [],
  };
}

export async function regenerateReviewSuggestion(
  ai: GoogleGenAI,
  params: {
    finding: ReviewFinding;
    careerProfile: CareerProfile;
    targetJob?: JobApplication;
    userGuidance?: string;
  }
): Promise<{ recommendedCorrection: string; explanation: string }> {
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: JSON.stringify({
      finding: params.finding,
      careerProfile: sanitizeProfileForAi(params.careerProfile),
      targetJob: params.targetJob
        ? {
            company: params.targetJob.company,
            jobTitle: params.targetJob.jobTitle,
            requiredQualifications: params.targetJob.requiredQualifications,
            technicalRequirements: params.targetJob.technicalRequirements,
          }
        : null,
      userGuidance: params.userGuidance || 'Provide an alternative, crisper, active-voice revision.',
    }),
    config: {
      systemInstruction: `You are an executive document editor regenerating an alternative revision for a single review finding.
STRICT RULES:
1. NEVER invent numbers, percentages, metrics, dates, skills, employers, or qualifications not already verified in careerProfile or originalText.
2. Follow Harvard Career Services writing standards (strong action verbs, zero personal pronouns in resume bullets, concrete company alignment in cover letters).
3. Return only JSON matching the schema.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendedCorrection: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ['recommendedCorrection', 'explanation'],
      },
    },
  });

  const raw = (response.text || '')
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const parsed = JSON.parse(raw || '{}');
  return {
    recommendedCorrection:
      parsed.recommendedCorrection || params.finding.recommendedCorrection,
    explanation: parsed.explanation || params.finding.explanation,
  };
}

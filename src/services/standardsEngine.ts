import {
  CoverLetterDocument,
  CoverLetterFormatting,
  CoverLetterTemplateId,
  DocumentProfileId,
  DocumentQualityReport,
  JobApplication,
  ResumeDocument,
  ResumeFormatting,
  ResumeSectionKey,
  ResumeTemplateId,
  StandardsCategoryScore,
  StandardsDeduction,
} from '../types/career';

export interface DocumentProfilePreset {
  id: DocumentProfileId;
  label: string;
  description: string;
  resumeTemplate: ResumeTemplateId;
  resumeFormatting: ResumeFormatting;
  recommendedSectionOrder: ResumeSectionKey[];
  coverLetterTemplate: CoverLetterTemplateId;
  coverLetterFormatting: CoverLetterFormatting;
}

export const DOCUMENT_PROFILES: Record<DocumentProfileId, DocumentProfilePreset> = {
  'harvard-professional': {
    id: 'harvard-professional',
    label: 'Harvard Professional',
    description: 'Traditional, clean, conservative formatting following Harvard Career Services conventions.',
    resumeTemplate: 'professional',
    resumeFormatting: {
      fontFamily: 'serif',
      fontSize: 10.5,
      headingSize: 13,
      accentColor: '#1C1917',
      sectionSpacing: 14,
      pageMargins: 0.75,
      lineSpacing: 1.25,
      headerAlignment: 'center',
    },
    recommendedSectionOrder: [
      'summary',
      'education',
      'experience',
      'skills',
      'projects',
      'certifications',
      'awards',
      'volunteer',
      'languages',
      'publications',
    ],
    coverLetterTemplate: 'traditional',
    coverLetterFormatting: {
      fontFamily: 'serif',
      fontSize: 11,
      headingSize: 15,
      textAlignment: 'left',
      pageMargins: 0.85,
      lineSpacing: 1.35,
      paragraphSpacing: 14,
      accentColor: '#1C1917',
    },
  },
  'modern-professional': {
    id: 'modern-professional',
    label: 'Modern Professional',
    description: 'Contemporary formatting with restrained visual hierarchy and clean editorial spacing.',
    resumeTemplate: 'modern',
    resumeFormatting: {
      fontFamily: 'editorial',
      fontSize: 10.5,
      headingSize: 14,
      accentColor: '#1C1917',
      sectionSpacing: 16,
      pageMargins: 0.65,
      lineSpacing: 1.35,
      headerAlignment: 'left',
    },
    recommendedSectionOrder: [
      'summary',
      'experience',
      'skills',
      'education',
      'projects',
      'certifications',
      'awards',
      'volunteer',
      'languages',
      'publications',
    ],
    coverLetterTemplate: 'modern',
    coverLetterFormatting: {
      fontFamily: 'editorial',
      fontSize: 11,
      headingSize: 16,
      textAlignment: 'left',
      pageMargins: 0.85,
      lineSpacing: 1.45,
      paragraphSpacing: 14,
      accentColor: '#1C1917',
    },
  },
  'technical-professional': {
    id: 'technical-professional',
    label: 'Technical Professional',
    description: 'Highlights technical skills, software stack, engineering projects, and measurable outcomes.',
    resumeTemplate: 'technical',
    resumeFormatting: {
      fontFamily: 'sans',
      fontSize: 10,
      headingSize: 13,
      accentColor: '#0F172A',
      sectionSpacing: 14,
      pageMargins: 0.6,
      lineSpacing: 1.25,
      headerAlignment: 'left',
    },
    recommendedSectionOrder: [
      'summary',
      'skills',
      'experience',
      'projects',
      'education',
      'certifications',
      'awards',
      'volunteer',
      'languages',
      'publications',
    ],
    coverLetterTemplate: 'technical',
    coverLetterFormatting: {
      fontFamily: 'sans',
      fontSize: 10.5,
      headingSize: 15,
      textAlignment: 'left',
      pageMargins: 0.8,
      lineSpacing: 1.35,
      paragraphSpacing: 12,
      accentColor: '#0F172A',
    },
  },
};

const WEAK_BULLET_STARTERS = [
  'responsible for',
  'duties included',
  'duties include',
  'tasked with',
  'helped with',
  'assisted in',
  'assisted with',
  'worked on',
  'worked with',
  'participated in',
  'in charge of',
];

const STRONG_ACTION_VERBS = new Set([
  'accelerated', 'achieved', 'architected', 'automated', 'built', 'championed',
  'collaborated', 'consolidated', 'created', 'cut', 'decreased', 'delivered',
  'designed', 'developed', 'directed', 'drove', 'eliminated', 'engineered',
  'established', 'executed', 'expanded', 'facilitated', 'generated', 'guided',
  'implemented', 'improved', 'increased', 'initiated', 'integrated', 'launched',
  'lead', 'led', 'maintained', 'managed', 'mentored', 'migrated', 'modernized',
  'negotiated', 'optimized', 'orchestrated', 'organized', 'owned', 'partnered',
  'pioneered', 'planned', 'produced', 'published', 'rebuilt', 'reduced',
  'refactored', 'redesigned', 'resolved', 'restructured', 'scaled', 'secured',
  'shipped', 'simplified', 'spearheaded', 'standardized', 'streamlined',
  'strengthened', 'structured', 'supervised', 'supported', 'trained', 'transformed',
]);

const PERSONAL_PRONOUN_REGEX = /\b(I|me|my|mine|myself|we|us|our|ours)\b/i;
const METRIC_REGEX = /(\d+%|\$\d+|\d+\+|\b\d{2,}\b|\b\d+(\.\d+)?x\b)/i;
const PROHIBITED_PERSONAL_INFO_REGEX = /\b(date of birth|dob|age:|marital status|gender:|references available upon request)\b/i;
const SLANG_REGEX = /\b(gonna|wanna|kinda|sorta|stuff|things|awesome|rockstar|ninja|guru|synergy)\b/i;

function makeCategory(
  key: StandardsCategoryScore['key'],
  label: string,
  component: string,
  maxScore: number,
  checksPassed: string[],
  deductions: StandardsDeduction[]
): StandardsCategoryScore {
  const totalDeducted = deductions.reduce((sum, d) => sum + d.pointsDeducted, 0);
  return {
    key,
    label,
    component,
    score: Math.max(0, maxScore - totalDeducted),
    maxScore,
    checksPassed,
    deductions,
  };
}

function parseYearMonth(dateStr: string): number {
  const clean = dateStr.trim().toLowerCase();
  if (!clean || clean === 'present' || clean === 'current') return 999912;
  const yearMatch = clean.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : 0;
  const months: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  let month = 6;
  for (const [mName, mNum] of Object.entries(months)) {
    if (clean.includes(mName)) {
      month = mNum;
      break;
    }
  }
  return year * 100 + month;
}

export function evaluateResumeStandards(
  resume: ResumeDocument,
  linkedJob?: JobApplication,
  estimatedPages = 1
): DocumentQualityReport {
  const profileId = resume.documentProfile || 'modern-professional';

  // 1. Formatting Validator (20 pts)
  const fmtPassed: string[] = [];
  const fmtDeductions: StandardsDeduction[] = [];
  if (resume.formatting.fontSize >= 10 && resume.formatting.fontSize <= 12) {
    fmtPassed.push(`Readable body font size (${resume.formatting.fontSize}pt within 10–12pt standard)`);
  } else {
    fmtDeductions.push({
      reason: `Font size is ${resume.formatting.fontSize}pt, outside the 10–12pt Harvard standard.`,
      recommendation: 'Set body font size between 10pt and 11.5pt for optimal legibility.',
      pointsDeducted: 5,
    });
  }
  if (resume.formatting.pageMargins >= 0.5 && resume.formatting.pageMargins <= 1.0) {
    fmtPassed.push(`Consistent margins (${resume.formatting.pageMargins.toFixed(2)} in)`);
  } else {
    fmtDeductions.push({
      reason: `Page margins (${resume.formatting.pageMargins.toFixed(2)} in) are too tight or too wide.`,
      recommendation: 'Keep margins between 0.55 in and 0.85 in for clean whitespace balance.',
      pointsDeducted: 4,
    });
  }
  if (resume.formatting.lineSpacing >= 1.15 && resume.formatting.lineSpacing <= 1.5) {
    fmtPassed.push(`Balanced line spacing (${resume.formatting.lineSpacing}x)`);
  } else {
    fmtDeductions.push({
      reason: `Line spacing (${resume.formatting.lineSpacing}x) reduces page density or readability.`,
      recommendation: 'Set line spacing between 1.2x and 1.4x.',
      pointsDeducted: 3,
    });
  }
  if (estimatedPages <= 2) {
    fmtPassed.push(`Concise page count (${estimatedPages} page${estimatedPages > 1 ? 's' : ''})`);
  } else {
    fmtDeductions.push({
      reason: `Resume spans ${estimatedPages} pages; Harvard recommends 1 page (early career) or 1–2 pages max.`,
      recommendation: 'Tighten older roles or adjust spacing/margins to stay within 1–2 pages.',
      pointsDeducted: 6,
    });
  }
  const formattingCat = makeCategory('formatting', 'Professional Formatting', 'Formatting Validator', 20, fmtPassed, fmtDeductions);

  // 2. Content Validator (20 pts)
  const cntPassed: string[] = [];
  const cntDeductions: StandardsDeduction[] = [];
  const allBullets = resume.workExperience.flatMap((e) => [...e.responsibilities, ...e.achievements]).filter((b) => b.trim());
  const weakBullets = allBullets.filter((b) => {
    const lower = b.trim().toLowerCase();
    return WEAK_BULLET_STARTERS.some((starter) => lower.startsWith(starter));
  });
  const actionVerbBullets = allBullets.filter((b) => {
    const firstWord = b.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '').toLowerCase() || '';
    return STRONG_ACTION_VERBS.has(firstWord);
  });

  if (allBullets.length === 0) {
    cntDeductions.push({
      reason: 'Work experience entries have no bullet points describing accomplishments.',
      recommendation: 'Add 2–4 action-oriented bullet points per role.',
      pointsDeducted: 12,
    });
  } else {
    if (weakBullets.length > 0) {
      cntDeductions.push({
        reason: `${weakBullets.length} bullet(s) start with passive phrasing (e.g., "${weakBullets[0].slice(0, 42)}...").`,
        recommendation: 'Replace passive openings like "Responsible for" or "Assisted in" with strong action verbs.',
        pointsDeducted: Math.min(8, weakBullets.length * 4),
      });
    } else {
      cntPassed.push('No passive "Responsible for / Assisted in" bullet starters detected');
    }

    const actionRatio = actionVerbBullets.length / allBullets.length;
    if (actionRatio >= 0.7) {
      cntPassed.push(`${actionVerbBullets.length}/${allBullets.length} bullets open with strong action verbs`);
    } else {
      cntDeductions.push({
        reason: `Only ${actionVerbBullets.length} of ${allBullets.length} bullets start with recognized action verbs.`,
        recommendation: 'Lead every bullet with a direct past- or present-tense action verb (e.g., Developed, Reduced, Built).',
        pointsDeducted: 5,
      });
    }
  }

  const metricBullets = allBullets.filter((b) => METRIC_REGEX.test(b));
  if (metricBullets.length >= 2) {
    cntPassed.push(`${metricBullets.length} bullet points include concrete metrics or scope`);
  } else if (allBullets.length > 0) {
    cntDeductions.push({
      reason: 'Few bullets quantify scope, scale, or measurable outcomes.',
      recommendation: 'Where accurate and verifiable, include numbers, percentages, user counts, or timeframes.',
      pointsDeducted: 4,
    });
  }
  const contentCat = makeCategory('content', 'Content Quality', 'Content Validator', 20, cntPassed, cntDeductions);

  // 3. Job Relevance Analyzer (20 pts)
  const relPassed: string[] = [];
  const relDeductions: StandardsDeduction[] = [];
  const resumeText = JSON.stringify({
    title: resume.personal.title,
    summary: resume.summary,
    workExperience: resume.workExperience,
    skills: resume.skills,
    projects: resume.projects,
  }).toLowerCase();

  if (linkedJob) {
    const targetTerms = Array.from(
      new Set([
        ...linkedJob.technicalRequirements,
        ...linkedJob.requiredQualifications
          .flatMap((q) => q.split(/[\s,./()]+/))
          .filter((w) => w.length >= 4),
      ])
    ).slice(0, 20);

    const techReqs = linkedJob.technicalRequirements.filter((t) => t.trim());
    if (techReqs.length > 0) {
      const matched = techReqs.filter((t) => resumeText.includes(t.toLowerCase()));
      const ratio = matched.length / techReqs.length;
      if (ratio >= 0.75) {
        relPassed.push(`Strong technical alignment: ${matched.length}/${techReqs.length} required skills present`);
      } else {
        const missing = techReqs.filter((t) => !resumeText.includes(t.toLowerCase()));
        relDeductions.push({
          reason: `Matched ${matched.length}/${techReqs.length} listed technical requirements for ${linkedJob.jobTitle}.`,
          recommendation: `If you possess verified experience with ${missing.slice(0, 4).join(', ')}, highlight it explicitly.`,
          pointsDeducted: Math.min(12, Math.round((1 - ratio) * 14)),
        });
      }
    } else if (targetTerms.length > 0) {
      relPassed.push(`Tailored context linked to ${linkedJob.company} — ${linkedJob.jobTitle}`);
    }

    if (resume.personal.title.trim()) {
      relPassed.push('Target professional title specified');
    } else {
      relDeductions.push({
        reason: 'Missing professional title under your name.',
        recommendation: `Align your headline/title with "${linkedJob.jobTitle}" if accurate.`,
        pointsDeducted: 4,
      });
    }
  } else {
    if (resume.personal.title.trim() && resume.summary.summary.trim()) {
      relPassed.push('Clear target role positioning in header and summary');
    } else {
      relDeductions.push({
        reason: 'No target job linked and professional title/summary is incomplete.',
        recommendation: 'Link a Job Application in the Job & AI tab to evaluate exact qualification alignment.',
        pointsDeducted: 6,
      });
    }
  }
  const relevanceCat = makeCategory('relevance', 'Job Relevance', 'Relevance Analyzer', 20, relPassed, relDeductions);

  // 4. Experience & Achievements (15 pts)
  const expPassed: string[] = [];
  const expDeductions: StandardsDeduction[] = [];
  if (resume.workExperience.length === 0) {
    expDeductions.push({
      reason: 'No work experience entries listed.',
      recommendation: 'Add work experience, internships, or relevant project roles.',
      pointsDeducted: 12,
    });
  } else {
    let chronoOk = true;
    for (let i = 0; i < resume.workExperience.length - 1; i++) {
      const currEnd = resume.workExperience[i].isCurrent
        ? 999912
        : parseYearMonth(resume.workExperience[i].endDate || resume.workExperience[i].startDate);
      const nextEnd = resume.workExperience[i + 1].isCurrent
        ? 999912
        : parseYearMonth(resume.workExperience[i + 1].endDate || resume.workExperience[i + 1].startDate);
      if (currEnd > 0 && nextEnd > 0 && currEnd < nextEnd) {
        chronoOk = false;
        break;
      }
    }
    if (chronoOk) {
      expPassed.push('Experience entries are ordered reverse-chronologically');
    } else {
      expDeductions.push({
        reason: 'Work experience entries are not strictly reverse-chronological.',
        recommendation: 'Reorder positions so your most recent role appears first.',
        pointsDeducted: 4,
      });
    }

    const totalAchievements = resume.workExperience.reduce((s, e) => s + e.achievements.filter((a) => a.trim()).length, 0);
    if (totalAchievements >= 2) {
      expPassed.push(`${totalAchievements} dedicated achievement statements documented`);
    } else {
      expDeductions.push({
        reason: 'Few explicit achievement bullets distinct from routine responsibilities.',
        recommendation: 'Add measurable accomplishments showing impact, delivery speed, or quality gains.',
        pointsDeducted: 4,
      });
    }

    const missingDates = resume.workExperience.filter((e) => !e.startDate.trim() || (!e.isCurrent && !e.endDate.trim()));
    if (missingDates.length > 0) {
      expDeductions.push({
        reason: `${missingDates.length} role(s) are missing start or end dates.`,
        recommendation: 'Include month and year ranges (e.g., Jan 2023 – Dec 2024) for every position.',
        pointsDeducted: 3,
      });
    } else {
      expPassed.push('Complete employment date ranges across all roles');
    }
  }
  const experienceCat = makeCategory('experience', 'Experience & Achievements', 'Quality Scoring Engine', 15, expPassed, expDeductions);

  // 5. Grammar & Writing (10 pts)
  const grmPassed: string[] = [];
  const grmDeductions: StandardsDeduction[] = [];
  const resumeProse = [
    resume.summary.headline,
    resume.summary.summary,
    ...allBullets,
  ].join(' ');

  if (PERSONAL_PRONOUN_REGEX.test(resumeProse)) {
    grmDeductions.push({
      reason: 'Personal pronouns (I, me, my, we, our) detected in resume prose.',
      recommendation: 'Harvard standards advise omitting personal pronouns in resumes; use concise implied first-person.',
      pointsDeducted: 4,
    });
  } else {
    grmPassed.push('Zero personal pronouns in resume prose');
  }

  if (SLANG_REGEX.test(resumeProse)) {
    grmDeductions.push({
      reason: 'Informal buzzwords or slang detected.',
      recommendation: 'Replace subjective labels with concrete engineering or domain terminology.',
      pointsDeducted: 3,
    });
  } else {
    grmPassed.push('Objective, formal professional vocabulary');
  }

  // Check duplicate lead verbs
  const leadVerbs = allBullets
    .map((b) => b.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, ''))
    .filter(Boolean);
  const verbCounts: Record<string, number> = {};
  leadVerbs.forEach((v) => {
    verbCounts[v] = (verbCounts[v] || 0) + 1;
  });
  const repeatedVerb = Object.entries(verbCounts).find(([, c]) => c >= 3);
  if (repeatedVerb) {
    grmDeductions.push({
      reason: `Opening verb "${repeatedVerb[0]}" is repeated ${repeatedVerb[1]} times across bullets.`,
      recommendation: 'Vary action verbs to keep descriptions crisp and non-repetitive.',
      pointsDeducted: 2,
    });
  } else {
    grmPassed.push('Varied action verbs without excessive repetition');
  }
  const grammarCat = makeCategory('grammar', 'Grammar & Writing', 'Content Validator', 10, grmPassed, grmDeductions);

  // 6. Document Organization (10 pts)
  const orgPassed: string[] = [];
  const orgDeductions: StandardsDeduction[] = [];
  const enabledIds = new Set(resume.sections.filter((s) => s.enabled).map((s) => s.id));
  if (enabledIds.has('experience') && enabledIds.has('education') && enabledIds.has('skills')) {
    orgPassed.push('Core Harvard sections enabled (Experience, Education, Skills)');
  } else {
    orgDeductions.push({
      reason: 'One or more core sections (Experience, Education, or Skills) are hidden.',
      recommendation: 'Enable Experience, Education, and Skills sections in the left panel.',
      pointsDeducted: 5,
    });
  }
  if (resume.education.length > 0) {
    orgPassed.push('Education credentials populated');
  } else {
    orgDeductions.push({
      reason: 'Education section has no entries.',
      recommendation: 'Add your degree or academic training.',
      pointsDeducted: 3,
    });
  }
  const organizationCat = makeCategory('organization', 'Document Organization', 'Formatting Validator', 10, orgPassed, orgDeductions);

  // 7. ATS Compatibility (5 pts)
  const atsPassed: string[] = [];
  const atsDeductions: StandardsDeduction[] = [];
  if (resume.personal.email.trim() && resume.personal.phone.trim() && resume.personal.location.trim()) {
    atsPassed.push('Complete parseable contact header (Email, Phone, Location)');
  } else {
    atsDeductions.push({
      reason: 'Incomplete contact header (missing email, phone, or location).',
      recommendation: 'Provide email, phone, and city/state for ATS contact parsing.',
      pointsDeducted: 3,
    });
  }
  if (PROHIBITED_PERSONAL_INFO_REGEX.test(resumeProse)) {
    atsDeductions.push({
      reason: 'Contains discouraged personal details or "References available upon request".',
      recommendation: 'Remove age, marital status, or reference statements per Harvard standards.',
      pointsDeducted: 2,
    });
  } else {
    atsPassed.push('Clean ATS text structure without age/gender/reference clutter');
  }
  const atsCat = makeCategory('ats', 'ATS Compatibility', 'ATS Compatibility Checker', 5, atsPassed, atsDeductions);

  const categories = [formattingCat, contentCat, relevanceCat, experienceCat, grammarCat, organizationCat, atsCat];
  const totalScore = categories.reduce((s, c) => s + c.score, 0);
  const summaryRecommendations = categories
    .flatMap((c) => c.deductions.map((d) => d.recommendation))
    .slice(0, 5);

  return {
    documentKind: 'resume',
    documentProfile: profileId,
    totalScore,
    maxScore: 100,
    categories,
    summaryRecommendations,
  };
}

export function evaluateCoverLetterStandards(
  letter: CoverLetterDocument,
  linkedResume?: ResumeDocument,
  estimatedPages = 1
): DocumentQualityReport {
  const profileId = letter.documentProfile || 'modern-professional';
  const paragraphs = letter.content.paragraphs.filter((p) => p.text.trim());
  const fullBodyText = paragraphs.map((p) => p.text).join(' ');
  const wordCount = fullBodyText.trim() ? fullBodyText.trim().split(/\s+/).length : 0;

  // 1. Formatting Validator (20 pts)
  const fmtPassed: string[] = [];
  const fmtDeductions: StandardsDeduction[] = [];
  if (estimatedPages <= 1) {
    fmtPassed.push('Fits cleanly on 1 page (Harvard cover letter maximum)');
  } else {
    fmtDeductions.push({
      reason: `Cover letter currently spans ${estimatedPages} pages; Harvard recommends strictly 1 page.`,
      recommendation: 'Tighten body paragraphs or select "Short" length so the letter fits on a single page.',
      pointsDeducted: 8,
    });
  }
  if (letter.formatting.fontSize >= 10 && letter.formatting.fontSize <= 12) {
    fmtPassed.push(`Consistent typography (${letter.formatting.fontSize}pt)`);
  } else {
    fmtDeductions.push({
      reason: `Font size (${letter.formatting.fontSize}pt) falls outside the 10–12pt standard.`,
      recommendation: 'Keep cover letter font size between 10.5pt and 11.5pt.',
      pointsDeducted: 4,
    });
  }
  if (linkedResume && linkedResume.formatting.fontFamily !== letter.formatting.fontFamily) {
    fmtDeductions.push({
      reason: 'Cover letter font family does not match the linked resume font.',
      recommendation: `Match font family to your linked resume (${linkedResume.formatting.fontFamily}) for a unified application packet.`,
      pointsDeducted: 4,
    });
  } else if (linkedResume) {
    fmtPassed.push('Typography matches linked resume');
  }
  const formattingCat = makeCategory('formatting', 'Professional Formatting', 'Formatting Validator', 20, fmtPassed, fmtDeductions);

  // 2. Content Validator (20 pts)
  const cntPassed: string[] = [];
  const cntDeductions: StandardsDeduction[] = [];
  if (paragraphs.length >= 3 && paragraphs.length <= 5) {
    cntPassed.push(`Structured ${paragraphs.length}-paragraph narrative (Introduction, Experience, Alignment, Closing)`);
  } else {
    cntDeductions.push({
      reason: `Letter has ${paragraphs.length} paragraph(s); Harvard recommends 3–4 focused paragraphs.`,
      recommendation: 'Organize into Opening, Relevant Experience, Employer Connection, and Closing.',
      pointsDeducted: 6,
    });
  }
  if (letter.employer.hiringManager.trim() && !/hiring team|whom it may concern/i.test(letter.content.salutation)) {
    cntPassed.push(`Addressed directly to hiring manager (${letter.employer.hiringManager})`);
  } else if (!letter.employer.hiringManager.trim()) {
    cntDeductions.push({
      reason: 'Hiring manager name is blank; using generic salutation.',
      recommendation: 'When possible, address a specific hiring manager by name.',
      pointsDeducted: 3,
    });
  }
  if (wordCount >= 160 && wordCount <= 400) {
    cntPassed.push(`Concise word count (${wordCount} words)`);
  } else {
    cntDeductions.push({
      reason: wordCount < 160 ? `Letter is brief (${wordCount} words).` : `Letter is lengthy (${wordCount} words).`,
      recommendation: 'Aim for 220–360 words so every paragraph delivers concrete value on 1 page.',
      pointsDeducted: 5,
    });
  }
  const contentCat = makeCategory('content', 'Content Quality', 'Content Validator', 20, cntPassed, cntDeductions);

  // 3. Job Relevance Analyzer (20 pts)
  const relPassed: string[] = [];
  const relDeductions: StandardsDeduction[] = [];
  const lowerBody = fullBodyText.toLowerCase();
  if (letter.employer.companyName.trim() && lowerBody.includes(letter.employer.companyName.toLowerCase())) {
    relPassed.push(`Personalized directly to ${letter.employer.companyName}`);
  } else {
    relDeductions.push({
      reason: 'Target company name is missing from the letter body or employer fields.',
      recommendation: 'Explicitly mention the employer name and connect your work to their mission.',
      pointsDeducted: 7,
    });
  }
  if (letter.employer.jobTitle.trim() && lowerBody.includes(letter.employer.jobTitle.toLowerCase())) {
    relPassed.push(`Identifies target position (${letter.employer.jobTitle})`);
  } else {
    relDeductions.push({
      reason: 'Target job title is not clearly referenced in the opening paragraph.',
      recommendation: 'State the exact position title in Paragraph 1.',
      pointsDeducted: 6,
    });
  }
  const techReqs = letter.jobInfo.technicalRequirements.filter((t) => t.trim());
  if (techReqs.length > 0) {
    const mentioned = techReqs.filter((t) => lowerBody.includes(t.toLowerCase()));
    if (mentioned.length >= 2) {
      relPassed.push(`References ${mentioned.length} key technical requirements from the posting`);
    } else {
      relDeductions.push({
        reason: 'Few job-specific technical requirements are echoed in the body.',
        recommendation: 'Connect 2–3 verified skills from your resume to the posting’s requirements.',
        pointsDeducted: 4,
      });
    }
  }
  const relevanceCat = makeCategory('relevance', 'Job Relevance', 'Relevance Analyzer', 20, relPassed, relDeductions);

  // 4. Experience & Achievements (15 pts)
  const expPassed: string[] = [];
  const expDeductions: StandardsDeduction[] = [];
  if (METRIC_REGEX.test(fullBodyText)) {
    expPassed.push('Includes concrete measurable outcomes or project scale');
  } else {
    expDeductions.push({
      reason: 'No specific metrics or quantifiable examples found in body paragraphs.',
      recommendation: 'Include at least 1–2 concrete results from your verified work experience.',
      pointsDeducted: 6,
    });
  }
  if (linkedResume) {
    const companies = linkedResume.workExperience.map((e) => e.company.trim()).filter(Boolean);
    const mentionsCompany = companies.some((c) => lowerBody.includes(c.toLowerCase()));
    if (mentionsCompany) {
      expPassed.push('Cites verified past employment directly');
    } else {
      expDeductions.push({
        reason: 'Does not reference any specific prior employer from your linked resume.',
        recommendation: 'Ground Paragraph 2 by naming a verified role/company and concrete contribution.',
        pointsDeducted: 4,
      });
    }
  }
  const experienceCat = makeCategory('experience', 'Experience & Achievements', 'Quality Scoring Engine', 15, expPassed, expDeductions);

  // 5. Grammar & Writing (10 pts)
  const grmPassed: string[] = [];
  const grmDeductions: StandardsDeduction[] = [];
  if (SLANG_REGEX.test(fullBodyText)) {
    grmDeductions.push({
      reason: 'Informal slang or filler buzzwords detected.',
      recommendation: 'Use direct, factual, professional phrasing.',
      pointsDeducted: 4,
    });
  } else {
    grmPassed.push('Clear, professional tone without filler buzzwords');
  }
  const iStarts = paragraphs.filter((p) => /^i\b/i.test(p.text.trim())).length;
  if (iStarts >= 3) {
    grmDeductions.push({
      reason: `${iStarts} paragraphs open with "I".`,
      recommendation: 'Vary sentence openings so paragraphs flow naturally.',
      pointsDeducted: 3,
    });
  } else {
    grmPassed.push('Varied paragraph openings');
  }
  const grammarCat = makeCategory('grammar', 'Grammar & Writing', 'Content Validator', 10, grmPassed, grmDeductions);

  // 6. Document Organization (10 pts)
  const orgPassed: string[] = [];
  const orgDeductions: StandardsDeduction[] = [];
  if (letter.content.salutation.trim() && letter.content.closingSignOff.trim() && letter.content.signatureName.trim()) {
    orgPassed.push('Complete business letter framing (Header, Salutation, Body, Sign-off)');
  } else {
    orgDeductions.push({
      reason: 'Missing salutation, closing sign-off, or signature name.',
      recommendation: 'Ensure salutation, sign-off, and full signature are populated.',
      pointsDeducted: 5,
    });
  }
  const organizationCat = makeCategory('organization', 'Document Organization', 'Formatting Validator', 10, orgPassed, orgDeductions);

  // 7. ATS Compatibility (5 pts)
  const atsPassed: string[] = [];
  const atsDeductions: StandardsDeduction[] = [];
  if (letter.applicant.email.trim() && letter.applicant.phone.trim()) {
    atsPassed.push('Applicant contact info present in header for callback & parsing');
  } else {
    atsDeductions.push({
      reason: 'Missing applicant email or phone in cover letter header.',
      recommendation: 'Import your Career Profile contact details into the header.',
      pointsDeducted: 3,
    });
  }
  const atsCat = makeCategory('ats', 'ATS Compatibility', 'ATS Compatibility Checker', 5, atsPassed, atsDeductions);

  const categories = [formattingCat, contentCat, relevanceCat, experienceCat, grammarCat, organizationCat, atsCat];
  const totalScore = categories.reduce((s, c) => s + c.score, 0);
  const summaryRecommendations = categories
    .flatMap((c) => c.deductions.map((d) => d.recommendation))
    .slice(0, 5);

  return {
    documentKind: 'cover-letter',
    documentProfile: profileId,
    totalScore,
    maxScore: 100,
    categories,
    summaryRecommendations,
  };
}

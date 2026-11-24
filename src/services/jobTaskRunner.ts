import {
  CareerProfile,
  CoverLetterDocument,
  JobApplication,
  ResumeAssistResponse,
  ResumeDocument,
} from '../types/career';
import { DEFAULT_NOTE_PLACEHOLDER } from '../data/stickyNotesData';

export type QueuedJobEvaluation =
  | { action: 'run' }
  | { action: 'wait' }
  | { action: 'fail'; reason: string };

export function formatTaskReason(reason: unknown): string {
  const raw =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'Task execution failed.';
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Task execution failed.';
  return clean.length > 300 ? `${clean.slice(0, 297)}...` : clean;
}

export function evaluateQueuedJobEligibility(job: JobApplication): QueuedJobEvaluation {
  if (job.selectedTask !== 'resume' && job.selectedTask !== 'cover_letter' && job.selectedTask !== 'both') {
    return { action: 'fail', reason: 'No valid AI task selected for this job.' };
  }

  const trimmedDesc = (job.jobDescription || '').trim();
  const hasDescription =
    trimmedDesc.length > 0 && trimmedDesc !== DEFAULT_NOTE_PLACEHOLDER;

  if (job.jobStatus === 'needs_extraction') {
    return { action: 'wait' };
  }

  if (
    (job.jobStatus === 'ready_for_tailoring' || job.jobStatus === 'tailored') &&
    hasDescription
  ) {
    return { action: 'run' };
  }

  if (!hasDescription) {
    return {
      action: 'fail',
      reason: 'Missing job description. Add a description before running AI tailoring.',
    };
  }

  return {
    action: 'fail',
    reason: `Job status "${job.jobStatus || 'unknown'}" is not ready for tailoring.`,
  };
}

export function buildTailoredJobLabel(job: JobApplication): string {
  const parts = [job.company?.trim(), job.jobTitle?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(' — ').slice(0, 140);
  if (job.sourceUrl?.trim()) return job.sourceUrl.trim().slice(0, 80);
  return 'Tailored Job Request';
}

export function applyAssistResponseToResume(
  baseResume: ResumeDocument,
  proposal: ResumeAssistResponse
): ResumeDocument {
  const nextSummary =
    proposal.proposedHeadline || proposal.proposedSummary
      ? {
          ...baseResume.summary,
          headline: proposal.proposedHeadline?.trim() || baseResume.summary.headline,
          summary: proposal.proposedSummary?.trim() || baseResume.summary.summary,
        }
      : baseResume.summary;

  const nextExp = baseResume.workExperience.map((exp) => {
    const update = proposal.experienceUpdates.find((u) => u.id === exp.id);
    if (!update) return exp;
    return {
      ...exp,
      responsibilities:
        update.responsibilities.length > 0 ? update.responsibilities : exp.responsibilities,
      achievements: update.achievements.length > 0 ? update.achievements : exp.achievements,
    };
  });

  let nextSkills = baseResume.skills;
  if (proposal.suggestedSkillsToHighlight.length > 0) {
    const existingSet = new Set(
      [
        ...baseResume.skills.technical,
        ...baseResume.skills.software,
        ...baseResume.skills.professional,
        ...baseResume.skills.industry,
      ].map((s) => s.trim().toLowerCase())
    );
    const additions: string[] = [];
    for (const rawSkill of proposal.suggestedSkillsToHighlight) {
      const clean = rawSkill.trim();
      if (clean && !existingSet.has(clean.toLowerCase())) {
        existingSet.add(clean.toLowerCase());
        additions.push(clean);
      }
    }
    if (additions.length > 0) {
      nextSkills = {
        ...baseResume.skills,
        technical: [...baseResume.skills.technical, ...additions],
      };
    }
  }

  return {
    ...baseResume,
    version: baseResume.version + 1,
    summary: nextSummary,
    workExperience: nextExp,
    skills: nextSkills,
  };
}

export function buildCoverLetterPayloadFromJob(
  job: JobApplication,
  profile: CareerProfile,
  draftLetter: CoverLetterDocument
) {
  return {
    applicant: {
      fullName: profile.personal.fullName || draftLetter.applicant.fullName,
      email: profile.personal.email || draftLetter.applicant.email,
      phone: profile.personal.phone || draftLetter.applicant.phone,
      location: profile.personal.location || draftLetter.applicant.location,
      linkedin: profile.personal.linkedin || draftLetter.applicant.linkedin,
      portfolio: profile.personal.portfolio || draftLetter.applicant.portfolio,
      website: profile.personal.website || draftLetter.applicant.website,
    },
    employer: {
      companyName: job.company || draftLetter.employer.companyName,
      hiringManager: job.hiringManager || draftLetter.employer.hiringManager,
      jobTitle: job.jobTitle || draftLetter.employer.jobTitle,
      department: job.department || draftLetter.employer.department,
      companyAddress: job.companyAddress || draftLetter.employer.companyAddress,
      applicationDate:
        draftLetter.employer.applicationDate ||
        new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
    },
    jobInfo: {
      jobDescription: job.jobDescription,
      requiredQualifications: [...job.requiredQualifications],
      preferredQualifications: [...job.preferredQualifications],
      responsibilities: [...job.responsibilities],
      technicalRequirements: [...job.technicalRequirements],
    },
  };
}

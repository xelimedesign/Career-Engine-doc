import { ReviewScope, ReviewScoringConfig } from '../types/career';

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

export function calculateWeightedApplicationScore(params: {
  scope: ReviewScope;
  resumeScore: number;
  coverLetterScore: number;
  jobMatchScore: number;
  companyAlignmentScore: number;
  config?: ReviewScoringConfig;
}): number {
  const config = params.config || DEFAULT_REVIEW_SCORING_CONFIG;
  const w = config.applicationWeights;

  if (params.scope === 'resume_only') {
    const denom = w.resume + w.jobMatch + w.companyAlignment || 1;
    return Math.round(
      (params.resumeScore * w.resume +
        params.jobMatchScore * w.jobMatch +
        params.companyAlignmentScore * w.companyAlignment) /
        denom
    );
  }

  if (params.scope === 'cover_letter_only') {
    const denom = w.coverLetter + w.jobMatch + w.companyAlignment || 1;
    return Math.round(
      (params.coverLetterScore * w.coverLetter +
        params.jobMatchScore * w.jobMatch +
        params.companyAlignmentScore * w.companyAlignment) /
        denom
    );
  }

  const totalW = w.resume + w.coverLetter + w.jobMatch + w.companyAlignment || 1;
  return Math.round(
    (params.resumeScore * w.resume +
      params.coverLetterScore * w.coverLetter +
      params.jobMatchScore * w.jobMatch +
      params.companyAlignmentScore * w.companyAlignment) /
      totalW
  );
}

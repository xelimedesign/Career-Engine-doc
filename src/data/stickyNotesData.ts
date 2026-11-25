import { JobIntakeStatus, StickyNoteItem, StickyNoteThemeId } from '../types/career';

export interface StickyNoteThemeConfig {
  id: StickyNoteThemeId;
  name: string;
  accent: string;
  bg: string;
  hoverBg: string;
}

export const STICKY_NOTE_THEMES: Record<StickyNoteThemeId, StickyNoteThemeConfig> = {
  purple: {
    id: 'purple',
    name: 'Lavender',
    accent: '#c58af9',
    bg: '#533f68',
    hoverBg: '#5c4673',
  },
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    accent: '#fde293',
    bg: '#544a2e',
    hoverBg: '#5e5334',
  },
  green: {
    id: 'green',
    name: 'Mint Green',
    accent: '#81c995',
    bg: '#324d3b',
    hoverBg: '#395743',
  },
  blue: {
    id: 'blue',
    name: 'Sky Blue',
    accent: '#8ab4f8',
    bg: '#334766',
    hoverBg: '#3a5173',
  },
  pink: {
    id: 'pink',
    name: 'Rose Pink',
    accent: '#f28b82',
    bg: '#5c383b',
    hoverBg: '#663f42',
  },
  graphite: {
    id: 'graphite',
    name: 'Graphite',
    accent: '#b0b5bd',
    bg: '#34363b',
    hoverBg: '#3d4046',
  },
};

export const DEFAULT_STICKY_CATEGORIES = ['Tips', 'Jobs', 'Ideas', 'Research'];

export const DEFAULT_NOTE_PLACEHOLDER = 'Tap to edit this sticky note...';

export function getFormattedStickyDate(date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export const DEFAULT_STICKY_NOTES: StickyNoteItem[] = [];

export function isValidHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (!/^https?:\/\/.+/i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface JobRequestValidationResult {
  ok: boolean;
  error?: string;
  sourceUrl?: string;
  jobDescription: string;
  jobStatus?: JobIntakeStatus;
}

export function validateJobRequestInput(input: {
  sourceUrl: string;
  jobDescription: string;
}): JobRequestValidationResult {
  const trimmedUrl = input.sourceUrl.trim();
  const rawDesc = input.jobDescription.trim();
  const effectiveDescription = rawDesc === DEFAULT_NOTE_PLACEHOLDER ? '' : rawDesc;

  if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
    return {
      ok: false,
      error: 'Enter a valid job link starting with http:// or https:// (max 2048 characters).',
      jobDescription: effectiveDescription,
    };
  }

  if (effectiveDescription.length > 50000) {
    return {
      ok: false,
      error: 'Job description must be at most 50,000 characters.',
      jobDescription: effectiveDescription,
    };
  }

  const hasValidLink = Boolean(trimmedUrl && isValidHttpUrl(trimmedUrl));
  const hasDescription = effectiveDescription.length > 0;

  if (!hasValidLink && !hasDescription) {
    return {
      ok: false,
      error: 'Add a valid http(s) job link, a job description, or both.',
      jobDescription: '',
    };
  }

  const jobStatus: JobIntakeStatus = hasDescription ? 'ready_for_tailoring' : 'needs_extraction';

  return {
    ok: true,
    sourceUrl: hasValidLink ? trimmedUrl : undefined,
    jobDescription: effectiveDescription,
    jobStatus,
  };
}

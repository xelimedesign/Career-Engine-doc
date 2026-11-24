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

export const DEFAULT_STICKY_CATEGORIES = ['Tips', 'Jobs', 'Sports', 'Ideas', 'Research'];

export const DEFAULT_NOTE_PLACEHOLDER = 'Tap to edit this sticky note...';

export function getFormattedStickyDate(date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export const DEFAULT_STICKY_NOTES: StickyNoteItem[] = [
  {
    id: 'note-1',
    theme: 'purple',
    category: 'Tips',
    date: '10/29/2026',
    bannerType: 'banner-screenshot',
    customImage: null,
    title: 'Capture screenshots in 1-click',
    body: 'Easily remember anything on your screen with just one click while using other apps! Perfect for saving receipts, inspiration, or quick visual reminders.',
    createdAt: '2026-10-29T10:00:00.000Z',
    updatedAt: '2026-10-29T10:00:00.000Z',
  },
  {
    id: 'note-2',
    theme: 'purple',
    category: 'Tips',
    date: '10/29/2026',
    bannerType: 'banner-source',
    customImage: null,
    title: 'Automatic source capture',
    body: 'Easily remember the original source of your notes. When you revisit the same document or webpage, your linked notes surface automatically.',
    createdAt: '2026-10-29T09:50:00.000Z',
    updatedAt: '2026-10-29T09:50:00.000Z',
  },
  {
    id: 'note-3',
    theme: 'purple',
    category: 'Tips',
    date: '10/29/2026',
    bannerType: 'banner-shortcut',
    customImage: null,
    title: 'Quickly open with a shortcut',
    body: 'Press Alt + S anytime inside Career Engine to bring up Sticky Notes immediately without interrupting your workflow.',
    createdAt: '2026-10-29T09:40:00.000Z',
    updatedAt: '2026-10-29T09:40:00.000Z',
  },
  {
    id: 'note-4',
    theme: 'blue',
    category: 'Jobs',
    date: '11/19/2026',
    bannerType: 'none',
    customImage: null,
    title: 'Senior Product Designer — Final Loop',
    body: 'Prepare portfolio walkthrough focusing on Windows design systems, accessibility tokens, and cross-platform prototyping. Confirm panel schedule with recruiter by Thursday.',
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T10:00:00.000Z',
  },
  {
    id: 'note-5',
    theme: 'green',
    category: 'Sports',
    date: '11/19/2026',
    bannerType: 'none',
    customImage: null,
    title: 'Half-Marathon Training & Game Schedule',
    body: 'Tempo run 6 miles @ 7:45/mi pace on Tuesday. Catch Saturday afternoon kickoff and track weekly recovery mobility + hydration targets.',
    createdAt: '2026-11-19T09:50:00.000Z',
    updatedAt: '2026-11-19T09:50:00.000Z',
  },
  {
    id: 'note-6',
    theme: 'yellow',
    category: 'Ideas',
    date: '11/19/2026',
    bannerType: 'none',
    customImage: null,
    title: 'Ambient Workspace Companion Widget',
    body: 'Build a lightweight desktop dock that pairs quick voice-to-sticky capture with automatic webpage citation tags and keyboard-first filtering.',
    createdAt: '2026-11-19T09:40:00.000Z',
    updatedAt: '2026-11-19T09:40:00.000Z',
  },
  {
    id: 'note-7',
    theme: 'graphite',
    category: 'Research',
    date: '11/19/2026',
    bannerType: 'banner-source',
    customImage: null,
    title: 'Local-First Sync & CRDT Benchmarks',
    body: 'Compare IndexedDB vs. SQLite WASM read latency for 10k+ rich-text notes. Evaluate conflict-free merging strategies for offline multi-device edits.',
    createdAt: '2026-11-19T09:30:00.000Z',
    updatedAt: '2026-11-19T09:30:00.000Z',
  },
];

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

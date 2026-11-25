/**
 * Standalone Sticky Notes Popup Window (Vanilla JS ES Module)
 * Extracted from Career Engine for Slate with pluggable storage & AI task callbacks.
 * Zero React or build-step dependencies.
 */

export const STICKY_NOTE_THEMES = {
  purple: { id: 'purple', name: 'Lavender', accent: '#c58af9', bg: '#533f68', hoverBg: '#5c4673' },
  yellow: { id: 'yellow', name: 'Yellow', accent: '#fde293', bg: '#544a2e', hoverBg: '#5e5334' },
  green: { id: 'green', name: 'Mint Green', accent: '#81c995', bg: '#324d3b', hoverBg: '#395743' },
  blue: { id: 'blue', name: 'Sky Blue', accent: '#8ab4f8', bg: '#334766', hoverBg: '#3a5173' },
  pink: { id: 'pink', name: 'Rose Pink', accent: '#f28b82', bg: '#5c383b', hoverBg: '#663f42' },
  graphite: { id: 'graphite', name: 'Graphite', accent: '#b0b5bd', bg: '#34363b', hoverBg: '#3d4046' },
};

export const DEFAULT_STICKY_CATEGORIES = ['Tips', 'Jobs', 'Sports', 'Ideas', 'Research'];
export const DEFAULT_NOTE_PLACEHOLDER = 'Tap to edit this sticky note...';

const DEFAULT_STORAGE_KEY = 'slate_sticky_notes_v1';
const DEFAULT_CATEGORIES_KEY = 'slate_sticky_categories_v1';
const DEFAULT_SESSION_KEY = 'slate_sticky_session_v1';

const JOB_STATUS_VALUES = new Set([
  'needs_extraction',
  'ready_for_tailoring',
  'needs_manual_input',
  'tailoring',
  'tailored',
  'failed',
]);

const TASK_TYPE_VALUES = new Set(['resume', 'cover_letter', 'both']);
const TASK_STATUS_VALUES = new Set(['idle', 'queued', 'running', 'done', 'failed']);

const TASK_SHORT_LABELS = {
  resume: 'Resume',
  cover_letter: 'Cover',
  both: 'Both',
};

const TASK_FULL_LABELS = {
  resume: 'Resume',
  cover_letter: 'Cover letter',
  both: 'Both',
};

/**
 * Format a date as MM/DD/YYYY.
 * @param {Date} [date]
 * @returns {string}
 */
export function getFormattedStickyDate(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Validate an http/https URL.
 * @param {string} raw
 * @returns {boolean}
 */
export function isValidHttpUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (!/^https?:\/\/.+/i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate job intake fields cleanly without external dependencies.
 * @param {{ sourceUrl?: string, jobDescription?: string }} input
 */
export function validateJobRequestInput(input) {
  const trimmedUrl = String(input?.sourceUrl || '').trim();
  const rawDesc = String(input?.jobDescription || '').trim();
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

  return {
    ok: true,
    sourceUrl: hasValidLink ? trimmedUrl : undefined,
    jobDescription: effectiveDescription,
    jobStatus: hasDescription ? 'ready_for_tailoring' : 'needs_extraction',
  };
}

export const DEFAULT_STICKY_NOTES = [
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
    body: 'Press Alt + S anytime to bring up Sticky Notes immediately without interrupting your workflow.',
    createdAt: '2026-10-29T09:40:00.000Z',
    updatedAt: '2026-10-29T09:40:00.000Z',
  },
  {
    id: 'job-1',
    theme: 'blue',
    category: 'Jobs',
    date: '11/19/2026',
    bannerType: 'none',
    customImage: null,
    title: 'Senior Product Designer — Slate Systems',
    body: 'Lead design tokens, accessibility tooling, and fast desktop-grade web workflows across Slate.',
    sourceUrl: 'https://jobs.example.com/slate-senior-designer',
    jobDescription:
      'Lead design tokens, accessibility tooling, and fast desktop-grade web workflows across Slate. Partner directly with frontend engineering.',
    jobStatus: 'tailored',
    selectedTask: 'both',
    taskStatus: 'done',
    createdAt: '2026-11-19T10:30:00.000Z',
    updatedAt: '2026-11-19T10:30:00.000Z',
  },
  {
    id: 'job-2',
    theme: 'blue',
    category: 'Jobs',
    date: '11/19/2026',
    bannerType: 'none',
    customImage: null,
    title: 'Staff Frontend Engineer — Developer Tools',
    body: 'Build zero-dependency vanilla JS primitives and keyboard-first productivity panels.',
    sourceUrl: 'https://careers.example.com/staff-frontend',
    jobDescription:
      'Build zero-dependency vanilla JS primitives and keyboard-first productivity panels with rock-solid accessibility and offline persistence.',
    jobStatus: 'ready_for_tailoring',
    selectedTask: null,
    taskStatus: 'idle',
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

function stripHtml(html) {
  if (!html) return '';
  if (typeof document === 'undefined') {
    return String(html).replace(/<[^>]+>/g, ' ').trim();
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  return (tmp.textContent || tmp.innerText || '').trim();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateFromIso(iso) {
  if (!iso) return getFormattedStickyDate();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return getFormattedStickyDate();
  return getFormattedStickyDate(parsed);
}

function generateNoteId(prefix = 'note') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function cloneNote(note) {
  return { ...note };
}

/**
 * Normalize either a unified note object or a Career Engine JobApplication into the shared StickyNote shape.
 * @param {Record<string, any>} raw
 */
function normalizeNote(raw) {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const category = String(obj.category || obj.noteCategory || (obj.jobStatus ? 'Jobs' : 'Tips')).trim() || 'Tips';
  const isJobs = category.toLowerCase() === 'jobs';
  const rawTheme = obj.theme || obj.noteTheme || (isJobs ? 'blue' : 'purple');
  const theme = STICKY_NOTE_THEMES[rawTheme] ? rawTheme : isJobs ? 'blue' : 'purple';
  const createdAt = typeof obj.createdAt === 'string' && obj.createdAt ? obj.createdAt : new Date().toISOString();
  const updatedAt = typeof obj.updatedAt === 'string' && obj.updatedAt ? obj.updatedAt : createdAt;
  const date = typeof obj.date === 'string' && obj.date
    ? obj.date
    : typeof obj.noteDate === 'string' && obj.noteDate
      ? obj.noteDate
      : formatDateFromIso(createdAt);

  const title = typeof obj.title === 'string'
    ? obj.title
    : typeof obj.jobTitle === 'string' && obj.jobTitle
      ? obj.jobTitle
      : typeof obj.company === 'string'
        ? obj.company
        : '';

  const jobDescription = typeof obj.jobDescription === 'string' ? obj.jobDescription : '';
  const body = typeof obj.body === 'string'
    ? obj.body
    : jobDescription
      ? escapeHtml(jobDescription).replace(/\n/g, '<br>')
      : '';

  const normalized = {
    id: String(obj.id || generateNoteId(isJobs ? 'job' : 'note')),
    category,
    title,
    body,
    theme,
    date,
    bannerType: obj.bannerType || obj.noteBannerType || 'none',
    customImage: obj.customImage !== undefined ? obj.customImage : (obj.noteCustomImage ?? null),
    sourceUrl: typeof obj.sourceUrl === 'string' && obj.sourceUrl.trim() ? obj.sourceUrl.trim() : undefined,
    jobDescription,
    jobStatus: JOB_STATUS_VALUES.has(obj.jobStatus) ? obj.jobStatus : undefined,
    selectedTask: TASK_TYPE_VALUES.has(obj.selectedTask) ? obj.selectedTask : null,
    taskStatus: TASK_STATUS_VALUES.has(obj.taskStatus) ? obj.taskStatus : 'idle',
    taskReason: typeof obj.taskReason === 'string' && obj.taskReason ? obj.taskReason : undefined,
    createdAt,
    updatedAt,
  };

  if (isJobs && !normalized.jobStatus) {
    normalized.jobStatus = (normalized.jobDescription || stripHtml(normalized.body)).trim()
      ? 'ready_for_tailoring'
      : 'needs_extraction';
  }

  return normalized;
}

function getDisplayJobStatus(note) {
  if (note.jobStatus) return note.jobStatus;
  const text = (note.jobDescription || stripHtml(note.body)).trim();
  return text ? 'ready_for_tailoring' : 'needs_manual_input';
}

function formatTaskBadgeText(note) {
  if (!note.taskStatus || note.taskStatus === 'idle') return '';
  if (note.selectedTask && TASK_SHORT_LABELS[note.selectedTask]) {
    return `${TASK_SHORT_LABELS[note.selectedTask]} - ${note.taskStatus}`;
  }
  return note.taskStatus;
}

function createBannerSvgMarkup(type) {
  if (type === 'banner-screenshot') {
    return `
      <div class="sn-card-media">
        <svg viewBox="0 0 340 132" class="sn-banner-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sn-bg-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#dbc9eb" />
              <stop offset="50%" stop-color="#c9c4e8" />
              <stop offset="100%" stop-color="#b9bce3" />
            </linearGradient>
            <linearGradient id="sn-frame-top" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#f7c948" />
              <stop offset="100%" stop-color="#ffd966" />
            </linearGradient>
            <linearGradient id="sn-frame-bot" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#9b6ef3" />
              <stop offset="100%" stop-color="#c084fc" />
            </linearGradient>
            <linearGradient id="sn-play-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#34d399" />
              <stop offset="100%" stop-color="#059669" />
            </linearGradient>
          </defs>
          <rect width="340" height="132" fill="url(#sn-bg-grad-1)" />
          <g opacity="0.52" fill="#ffffff">
            <rect x="18" y="8" width="44" height="68" rx="8" transform="rotate(14 40 42)" />
            <circle cx="44" cy="18" r="2.8" fill="#8b7aa8" />
            <circle cx="46" cy="34" r="6.5" fill="none" stroke="#8b7aa8" stroke-width="2" />
            <path d="M46 58 Q54 53 60 60 T74 62" fill="none" stroke="#d896c8" stroke-width="2.5" stroke-linecap="round" />
            <polygon points="16,92 60,86 72,126 10,126" />
            <circle cx="52" cy="98" r="2.4" fill="#8b7aa8" />
            <rect x="262" y="26" width="36" height="24" rx="4" transform="rotate(-12 280 38)" />
            <rect x="258" y="51" width="46" height="5" rx="2.5" transform="rotate(-12 280 53)" fill="#b8a8d8" />
            <rect x="242" y="68" width="16" height="16" rx="3" transform="rotate(22 250 76)" fill="none" stroke="#b8a8d8" stroke-width="3" />
            <rect x="275" y="76" width="52" height="38" rx="6" transform="rotate(12 301 95)" />
            <polygon points="292,115 304,117 306,125 288,122" fill="#b8a8d8" />
            <circle cx="304" cy="85" r="2.2" fill="#8b7aa8" />
          </g>
          <g>
            <rect x="145" y="54" width="48" height="48" rx="8" transform="rotate(45 169 78)" fill="#f4f1f8" />
            <path d="M126 42 V28 Q126 22 132 22 H148" fill="none" stroke="url(#sn-frame-top)" stroke-width="4.5" stroke-linecap="round" />
            <path d="M190 22 H206 Q212 22 212 28 V42" fill="none" stroke="url(#sn-frame-top)" stroke-width="4.5" stroke-linecap="round" />
            <path d="M126 84 V98 Q126 104 132 104 H148" fill="none" stroke="url(#sn-frame-bot)" stroke-width="4.5" stroke-linecap="round" />
            <path d="M190 104 H206 Q212 104 212 98 V84" fill="none" stroke="url(#sn-frame-bot)" stroke-width="4.5" stroke-linecap="round" />
            <polygon points="169,28 202,55 169,82 136,55" fill="none" stroke="#9d8ec7" stroke-width="1.4" />
            <circle cx="169" cy="28" r="2.5" fill="#10b981" />
            <circle cx="202" cy="55" r="2.5" fill="#10b981" />
            <circle cx="169" cy="82" r="2.5" fill="#10b981" />
            <circle cx="136" cy="55" r="2.5" fill="#10b981" />
            <circle cx="169" cy="40" r="3.5" fill="#f59e0b" />
            <polygon points="163,46 180,55 163,64" fill="url(#sn-play-grad)" />
            <polygon points="168,51 182,58 168,65" fill="#3b82f6" opacity="0.85" />
          </g>
        </svg>
      </div>
    `;
  }

  if (type === 'banner-source') {
    return `
      <div class="sn-card-media">
        <svg viewBox="0 0 340 132" class="sn-banner-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sn-bg-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#d7c2ea" />
              <stop offset="50%" stop-color="#c5bee6" />
              <stop offset="100%" stop-color="#b7bce2" />
            </linearGradient>
            <linearGradient id="sn-link-top" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fbbf24" />
              <stop offset="100%" stop-color="#f97316" />
            </linearGradient>
            <linearGradient id="sn-link-mid" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#34d399" />
              <stop offset="100%" stop-color="#60a5fa" />
            </linearGradient>
            <linearGradient id="sn-link-bot" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#e879f9" />
              <stop offset="100%" stop-color="#8b5cf6" />
            </linearGradient>
          </defs>
          <rect width="340" height="132" fill="url(#sn-bg-grad-2)" />
          <g opacity="0.52" fill="#ffffff">
            <rect x="18" y="8" width="44" height="68" rx="8" transform="rotate(14 40 42)" />
            <circle cx="44" cy="18" r="2.8" fill="#8b7aa8" />
            <circle cx="46" cy="34" r="6.5" fill="none" stroke="#8b7aa8" stroke-width="2" />
            <path d="M46 58 Q54 53 60 60 T74 62" fill="none" stroke="#d896c8" stroke-width="2.5" stroke-linecap="round" />
            <polygon points="16,92 60,86 72,126 10,126" />
            <circle cx="52" cy="98" r="2.4" fill="#8b7aa8" />
            <rect x="262" y="26" width="36" height="24" rx="4" transform="rotate(-12 280 38)" />
            <rect x="258" y="51" width="46" height="5" rx="2.5" transform="rotate(-12 280 53)" fill="#b8a8d8" />
            <rect x="242" y="68" width="16" height="16" rx="3" transform="rotate(22 250 76)" fill="none" stroke="#b8a8d8" stroke-width="3" />
            <rect x="275" y="76" width="52" height="38" rx="6" transform="rotate(12 301 95)" />
            <polygon points="292,115 304,117 306,125 288,122" fill="#b8a8d8" />
            <circle cx="304" cy="85" r="2.2" fill="#8b7aa8" />
          </g>
          <g transform="translate(170, 66) rotate(-42)">
            <rect x="4" y="-17" width="52" height="34" rx="17" fill="none" stroke="url(#sn-link-top)" stroke-width="11" />
            <rect x="-56" y="-17" width="52" height="34" rx="17" fill="none" stroke="url(#sn-link-bot)" stroke-width="11" />
            <rect x="-24" y="-7" width="48" height="14" rx="7" fill="url(#sn-link-mid)" />
            <circle cx="14" cy="-14" r="6.5" fill="#ffffff" />
            <circle cx="-14" cy="14" r="6.5" fill="#ffffff" />
          </g>
        </svg>
      </div>
    `;
  }

  if (type === 'banner-shortcut') {
    return `
      <div class="sn-card-media">
        <div class="sn-banner-wrap">
          <svg viewBox="0 0 340 132" class="sn-banner-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="sn-bg-grad-3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#d8c3eb" />
                <stop offset="50%" stop-color="#c6bfe6" />
                <stop offset="100%" stop-color="#b8bde3" />
              </linearGradient>
              <linearGradient id="sn-center-note" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffe259" />
                <stop offset="100%" stop-color="#ffa751" />
              </linearGradient>
            </defs>
            <rect width="340" height="132" fill="url(#sn-bg-grad-3)" />
            <g opacity="0.52" fill="#ffffff">
              <rect x="18" y="8" width="44" height="68" rx="8" transform="rotate(14 40 42)" />
              <circle cx="44" cy="18" r="2.8" fill="#8b7aa8" />
              <circle cx="46" cy="34" r="6.5" fill="none" stroke="#8b7aa8" stroke-width="2" />
              <polygon points="16,92 60,86 72,126 10,126" />
              <rect x="262" y="26" width="36" height="24" rx="4" transform="rotate(-12 280 38)" />
              <rect x="258" y="51" width="46" height="5" rx="2.5" transform="rotate(-12 280 53)" fill="#b8a8d8" />
              <rect x="275" y="76" width="52" height="38" rx="6" transform="rotate(12 301 95)" />
            </g>
            <circle cx="170" cy="66" r="42" fill="#ffffff" fill-opacity="0.32" />
            <g transform="translate(148, 44)">
              <path d="M0 7C0 3.13401 3.13401 0 7 0H37C40.866 0 44 3.13401 44 7V28L28 44H7C3.13401 44 0 40.866 0 37V7Z" fill="url(#sn-center-note)" />
              <path d="M28 44L44 28H33C30.2386 28 28 30.2386 28 33V44Z" fill="#7e22ce" />
              <rect x="19" y="31" width="27" height="14" rx="3" fill="#22d3ee" />
              <text x="32.5" y="41" font-family="Segoe UI, Inter, sans-serif" font-size="9.5" font-weight="800" fill="#0f172a" text-anchor="middle">PRE</text>
            </g>
          </svg>
          <div class="sn-banner-keys">
            <span class="sn-keycap">Alt</span>
            <span class="sn-keycap">S</span>
          </div>
        </div>
      </div>
    `;
  }

  if (type === 'banner-snapshot') {
    return `
      <div class="sn-card-media">
        <svg viewBox="0 0 340 120" class="sn-banner-svg-snap" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sn-snap-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#1e293b" />
              <stop offset="100%" stop-color="#0f172a" />
            </linearGradient>
          </defs>
          <rect width="340" height="120" fill="url(#sn-snap-bg)" />
          <rect x="24" y="16" width="292" height="88" rx="8" fill="#273449" stroke="#3b4d6b" stroke-width="1.5" />
          <circle cx="38" cy="28" r="3.5" fill="#f87171" />
          <circle cx="50" cy="28" r="3.5" fill="#fbbf24" />
          <circle cx="62" cy="28" r="3.5" fill="#34d399" />
          <rect x="38" y="42" width="110" height="10" rx="3" fill="#60a5fa" opacity="0.7" />
          <rect x="38" y="58" width="180" height="7" rx="3" fill="#94a3b8" opacity="0.4" />
          <rect x="38" y="71" width="145" height="7" rx="3" fill="#94a3b8" opacity="0.4" />
          <rect x="234" y="42" width="66" height="46" rx="6" fill="#c58af9" opacity="0.25" stroke="#c58af9" stroke-dasharray="3 2" />
          <text x="267" y="68" font-family="Segoe UI, sans-serif" font-size="10" fill="#e9d5ff" text-anchor="middle">Snip Saved</text>
        </svg>
      </div>
    `;
  }

  return '';
}

function getStickyIconSvg(size = 18) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="sn-win-yellow" x1="2" y1="2" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFE054" />
          <stop offset="100%" stop-color="#F5B800" />
        </linearGradient>
        <linearGradient id="sn-win-purple" x1="13" y1="13" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#A855F7" />
          <stop offset="100%" stop-color="#6B21A8" />
        </linearGradient>
      </defs>
      <path d="M3 5.5C3 4.11929 4.11929 3 5.5 3H18.5C19.8807 3 21 4.11929 21 5.5V14L14 21H5.5C4.11929 21 3 19.8807 3 18.5V5.5Z" fill="url(#sn-win-yellow)" />
      <path d="M14 21L21 14H16C14.8954 14 14 14.8954 14 16V21Z" fill="url(#sn-win-purple)" />
    </svg>
  `;
}

/**
 * Create a standalone Windows 11 style Sticky Notes popup window.
 *
 * @param {Object} [options]
 * @param {() => Array<Record<string, any>> | Promise<Array<Record<string, any>>>} [options.loadNotes]
 * @param {(note: Record<string, any>) => any | Promise<any>} [options.saveNote]
 * @param {(id: string) => any | Promise<any>} [options.deleteNote]
 * @param {(noteId: string, task: 'resume' | 'cover_letter' | 'both') => any | Promise<any>} [options.onTaskSelected]
 * @param {(noteId: string) => any | Promise<any>} [options.getTaskStatus]
 * @param {HTMLElement} [options.mountTarget]
 * @param {string} [options.storageKey]
 * @param {string} [options.sessionKey]
 * @param {string[]} [options.categories]
 * @param {boolean} [options.defaultOpen]
 * @param {Array<Record<string, any>>} [options.initialNotes]
 */
export function createStickyNotesWindow(options = {}) {
  const mountTarget = options.mountTarget || document.body;
  const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
  const categoriesStorageKey = `${storageKey}_categories`;
  const sessionKey = options.sessionKey || DEFAULT_SESSION_KEY;

  const hasCustomLoad = typeof options.loadNotes === 'function';
  const hasCustomSave = typeof options.saveNote === 'function';
  const hasCustomDelete = typeof options.deleteNote === 'function';
  const hasTaskCallback = typeof options.onTaskSelected === 'function';
  const hasTaskStatusCallback = typeof options.getTaskStatus === 'function';

  const initialCategoryList = Array.isArray(options.categories) && options.categories.length > 0
    ? options.categories.map((c) => String(c))
    : [...DEFAULT_STICKY_CATEGORIES];

  function readLocalCategories() {
    if (hasCustomLoad) return [...initialCategoryList];
    try {
      const raw = window.localStorage.getItem(categoriesStorageKey);
      if (!raw) return [...initialCategoryList];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return Array.from(new Set([...initialCategoryList, ...parsed.map(String)]));
      }
    } catch {
      // Ignore storage read failure
    }
    return [...initialCategoryList];
  }

  function writeLocalCategories(cats) {
    if (hasCustomLoad) return;
    try {
      window.localStorage.setItem(categoriesStorageKey, JSON.stringify(cats));
    } catch {
      // Ignore quota errors
    }
  }

  function readLocalNotes() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeNote);
        }
      }
    } catch {
      // Ignore parse errors
    }
    const seed = Array.isArray(options.initialNotes) && options.initialNotes.length > 0
      ? options.initialNotes.map(normalizeNote)
      : DEFAULT_STICKY_NOTES.map(normalizeNote);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(seed));
    } catch {
      // Ignore quota errors
    }
    return seed;
  }

  function writeLocalNotes(list) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(list));
    } catch {
      // Ignore quota errors
    }
  }

  function readSessionState() {
    try {
      const raw = window.sessionStorage.getItem(sessionKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          isOpen: Boolean(parsed.isOpen),
          isMinimized: Boolean(parsed.isMinimized),
        };
      }
    } catch {
      // Ignore sessionStorage errors
    }
    return null;
  }

  function writeSessionState(isOpenVal, isMinimizedVal) {
    try {
      window.sessionStorage.setItem(
        sessionKey,
        JSON.stringify({ isOpen: Boolean(isOpenVal), isMinimized: Boolean(isMinimizedVal) })
      );
    } catch {
      // Ignore sessionStorage errors
    }
  }

  const savedSession = readSessionState();
  const state = {
    destroyed: false,
    isOpen: savedSession ? savedSession.isOpen : Boolean(options.defaultOpen),
    isMinimized: savedSession ? savedSession.isMinimized : false,
    notes: [],
    categories: readLocalCategories(),
    activeCategory: 'All',
    searchOpen: false,
    searchQuery: '',
    detailNoteId: null,
    menuOpen: false,
    addingCategory: false,
    newCategoryName: '',
    composerOpen: false,
    composerTheme: 'purple',
    composerCategory: 'Ideas',
    composerBanner: 'none',
    composerTitle: '',
    composerBody: '',
    composerJobUrl: '',
    composerJobDesc: '',
    composerCustomImage: null,
    composerUploadName: 'Attach custom image...',
    composerError: null,
    detailUrlDraft: '',
    detailUrlError: null,
    taskMenuOpen: false,
    taskMenuPlacement: 'inside',
    taskMenuCoords: { top: 80, left: 0 },
    flashActive: false,
    toastMessage: null,
    saveLabel: 'Saved',
  };

  let backdropEl = null;
  let windowEl = null;
  let restorePillEl = null;
  let fixedTaskMenuEl = null;
  let toastTimer = null;
  let flashTimer = null;
  let saveLabelTimer = null;
  const pendingNoteSaves = new Map();
  const abortController = new AbortController();

  function clearTimers() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (flashTimer) {
      clearTimeout(flashTimer);
      flashTimer = null;
    }
    if (saveLabelTimer) {
      clearTimeout(saveLabelTimer);
      saveLabelTimer = null;
    }
  }

  function flushPendingSaves() {
    pendingNoteSaves.forEach((entry) => {
      clearTimeout(entry.timer);
      if (hasCustomSave) {
        try {
          Promise.resolve(options.saveNote(cloneNote(entry.note))).catch(() => {});
        } catch {
          // Ignore callback error
        }
      }
    });
    pendingNoteSaves.clear();
    if (!hasCustomLoad && !hasCustomSave) {
      writeLocalNotes(state.notes);
    }
  }

  function persistNote(note, immediate = false) {
    if (state.destroyed) return;
    const copy = cloneNote(note);
    if (!hasCustomLoad && !hasCustomSave) {
      writeLocalNotes(state.notes);
    }
    if (!hasCustomSave) return;

    const existing = pendingNoteSaves.get(copy.id);
    if (existing) clearTimeout(existing.timer);

    if (immediate) {
      pendingNoteSaves.delete(copy.id);
      try {
        Promise.resolve(options.saveNote(copy)).catch(() => {});
      } catch {
        // Ignore callback errors
      }
      return;
    }

    const timer = setTimeout(() => {
      pendingNoteSaves.delete(copy.id);
      if (state.destroyed) return;
      try {
        Promise.resolve(options.saveNote(copy)).catch(() => {});
      } catch {
        // Ignore callback errors
      }
    }, 250);
    pendingNoteSaves.set(copy.id, { timer, note: copy });
  }

  function persistDelete(id) {
    const existing = pendingNoteSaves.get(id);
    if (existing) {
      clearTimeout(existing.timer);
      pendingNoteSaves.delete(id);
    }
    if (!hasCustomLoad && !hasCustomDelete) {
      writeLocalNotes(state.notes);
    }
    if (hasCustomDelete) {
      try {
        Promise.resolve(options.deleteNote(id)).catch(() => {});
      } catch {
        // Ignore callback errors
      }
    }
  }

  function syncCategoriesFromNotes() {
    const known = new Set(state.categories);
    let changed = false;
    state.notes.forEach((note) => {
      if (note.category && !known.has(note.category)) {
        known.add(note.category);
        state.categories.push(note.category);
        changed = true;
      }
    });
    if (changed) writeLocalCategories(state.categories);
  }

  async function syncTaskStatuses(targetId = null) {
    if (!hasTaskStatusCallback || state.destroyed) return;
    const candidates = targetId
      ? state.notes.filter((n) => n.id === targetId && n.category.toLowerCase() === 'jobs')
      : state.notes.filter((n) => n.category.toLowerCase() === 'jobs');

    if (candidates.length === 0) return;

    let anyUpdated = false;
    await Promise.all(
      candidates.map(async (note) => {
        try {
          const result = await options.getTaskStatus(note.id);
          if (state.destroyed || !result) return;

          if (typeof result === 'string' && TASK_STATUS_VALUES.has(result)) {
            if (note.taskStatus !== result) {
              note.taskStatus = result;
              if (result === 'done' && note.jobStatus !== 'tailored') {
                note.jobStatus = 'tailored';
              }
              anyUpdated = true;
            }
          } else if (typeof result === 'object') {
            let changed = false;
            if (result.taskStatus && TASK_STATUS_VALUES.has(result.taskStatus) && note.taskStatus !== result.taskStatus) {
              note.taskStatus = result.taskStatus;
              changed = true;
            }
            if (result.selectedTask !== undefined && (result.selectedTask === null || TASK_TYPE_VALUES.has(result.selectedTask)) && note.selectedTask !== result.selectedTask) {
              note.selectedTask = result.selectedTask;
              changed = true;
            }
            if (result.jobStatus && JOB_STATUS_VALUES.has(result.jobStatus) && note.jobStatus !== result.jobStatus) {
              note.jobStatus = result.jobStatus;
              changed = true;
            }
            if (typeof result.taskReason === 'string' && note.taskReason !== result.taskReason) {
              note.taskReason = result.taskReason;
              changed = true;
            }
            if (changed) anyUpdated = true;
          }
        } catch {
          // Ignore callback error
        }
      })
    );

    if (anyUpdated && !state.destroyed) {
      if (!hasCustomLoad && !hasCustomSave) {
        writeLocalNotes(state.notes);
      }
      render();
    }
  }

  async function refresh() {
    if (state.destroyed) return;
    try {
      const loaded = hasCustomLoad ? await options.loadNotes() : readLocalNotes();
      if (state.destroyed) return;
      state.notes = Array.isArray(loaded) ? loaded.map(normalizeNote) : [];
      syncCategoriesFromNotes();
      if (state.detailNoteId && !state.notes.some((n) => n.id === state.detailNoteId)) {
        state.detailNoteId = null;
      }
      render();
      await syncTaskStatuses();
    } catch {
      if (!state.destroyed) render();
    }
  }

  function showToast(msg) {
    state.toastMessage = msg;
    if (toastTimer) clearTimeout(toastTimer);
    renderToastOnly();
    toastTimer = setTimeout(() => {
      state.toastMessage = null;
      toastTimer = null;
      renderToastOnly();
    }, 2600);
  }

  function renderToastOnly() {
    if (!windowEl) return;
    const oldToast = windowEl.querySelector('.sn-toast');
    if (oldToast) oldToast.remove();
    if (state.toastMessage) {
      const el = document.createElement('div');
      el.className = 'sn-toast';
      el.innerHTML = `<span class="sn-toast-dot"></span><span class="sn-toast-text"></span>`;
      el.querySelector('.sn-toast-text').textContent = state.toastMessage;
      windowEl.appendChild(el);
    }
  }

  function pulseSavedStatus() {
    state.saveLabel = 'Saving...';
    const labelEl = windowEl?.querySelector('.sn-save-label');
    if (labelEl) labelEl.textContent = 'Saving...';
    if (saveLabelTimer) clearTimeout(saveLabelTimer);
    saveLabelTimer = setTimeout(() => {
      state.saveLabel = 'Saved';
      saveLabelTimer = null;
      const el = windowEl?.querySelector('.sn-save-label');
      if (el) el.textContent = 'Saved';
    }, 450);
  }

  function sortedNotes() {
    return [...state.notes].sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
  }

  function getCategoryCount(cat) {
    if (cat === 'All') return state.notes.length;
    const lower = cat.toLowerCase();
    return state.notes.filter((n) => (n.category || '').toLowerCase() === lower).length;
  }

  function getFilteredNotes() {
    const query = state.searchQuery.trim().toLowerCase();
    return sortedNotes().filter((note) => {
      const matchesCat =
        state.activeCategory === 'All' ||
        (note.category || '').toLowerCase() === state.activeCategory.toLowerCase();
      if (!matchesCat) return false;
      if (!query) return true;

      const statusText = note.category.toLowerCase() === 'jobs' ? getDisplayJobStatus(note) : '';
      return (
        (note.title || '').toLowerCase().includes(query) ||
        (note.category || '').toLowerCase().includes(query) ||
        (note.sourceUrl || '').toLowerCase().includes(query) ||
        (note.jobDescription || '').toLowerCase().includes(query) ||
        statusText.toLowerCase().includes(query) ||
        stripHtml(note.body).toLowerCase().includes(query)
      );
    });
  }

  function getActiveDetailNote() {
    if (!state.detailNoteId) return null;
    return state.notes.find((n) => n.id === state.detailNoteId) || null;
  }

  function updateNote(id, updater, immediate = false) {
    const idx = state.notes.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    const prev = state.notes[idx];
    const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
    next.updatedAt = new Date().toISOString();
    state.notes[idx] = next;
    persistNote(next, immediate);
    return next;
  }

  function removeNote(id) {
    const idx = state.notes.findIndex((n) => n.id === id);
    if (idx === -1) return;
    state.notes.splice(idx, 1);
    if (state.detailNoteId === id) {
      state.detailNoteId = null;
      state.taskMenuOpen = false;
    }
    persistDelete(id);
  }

  function addNoteRecord(noteData) {
    const now = new Date().toISOString();
    const isJobs = String(noteData.category || '').toLowerCase() === 'jobs';
    const created = normalizeNote({
      ...noteData,
      id: generateNoteId(isJobs ? 'job' : 'note'),
      createdAt: now,
      updatedAt: now,
    });
    state.notes.unshift(created);
    syncCategoriesFromNotes();
    persistNote(created, true);
    return created;
  }

  function openComposerModal() {
    state.menuOpen = false;
    const defaultCat = state.activeCategory === 'All' ? 'Ideas' : state.activeCategory;
    state.composerCategory = defaultCat;
    state.composerTheme = defaultCat.toLowerCase() === 'jobs' ? 'blue' : 'purple';
    state.composerBanner = 'none';
    state.composerTitle = '';
    state.composerBody = '';
    state.composerJobUrl = '';
    state.composerJobDesc = '';
    state.composerCustomImage = null;
    state.composerUploadName = 'Attach custom image...';
    state.composerError = null;
    state.composerOpen = true;
    render();
    setTimeout(() => {
      if (state.destroyed) return;
      const target = defaultCat.toLowerCase() === 'jobs'
        ? windowEl?.querySelector('#sn-job-link')
        : windowEl?.querySelector('#sn-composer-title');
      target?.focus();
    }, 30);
  }

  function closeComposerModal() {
    state.composerOpen = false;
    state.composerError = null;
    render();
  }

  function handleComposerSave() {
    if (state.composerCategory.toLowerCase() === 'jobs') {
      const validation = validateJobRequestInput({
        sourceUrl: state.composerJobUrl,
        jobDescription: state.composerJobDesc,
      });
      if (!validation.ok || !validation.jobStatus) {
        state.composerError =
          validation.error || 'Add a valid http(s) job link, a job description, or both.';
        render();
        return;
      }

      addNoteRecord({
        category: 'Jobs',
        theme: state.composerTheme,
        date: getFormattedStickyDate(),
        bannerType: state.composerCustomImage ? 'none' : state.composerBanner,
        customImage: state.composerCustomImage,
        title: state.composerTitle.trim(),
        body: validation.jobDescription
          ? escapeHtml(validation.jobDescription).replace(/\n/g, '<br>')
          : '',
        sourceUrl: validation.sourceUrl,
        jobDescription: validation.jobDescription,
        jobStatus: validation.jobStatus,
        selectedTask: null,
        taskStatus: 'idle',
      });

      state.composerOpen = false;
      state.composerError = null;
      state.detailNoteId = null;
      render();
      showToast(`Added job request (${validation.jobStatus})`);
      return;
    }

    const title = state.composerTitle.trim() || 'Quick Note';
    const category = state.composerCategory.trim() || 'Tips';
    const rawBody = state.composerBody.trim() || DEFAULT_NOTE_PLACEHOLDER;

    addNoteRecord({
      category,
      theme: state.composerTheme,
      date: getFormattedStickyDate(),
      bannerType: state.composerCustomImage ? 'none' : state.composerBanner,
      customImage: state.composerCustomImage,
      title,
      body: escapeHtml(rawBody).replace(/\n/g, '<br>'),
    });

    state.composerOpen = false;
    state.composerError = null;
    render();
    showToast(`Added to ${category}`);
  }

  function triggerScreenshotCapture() {
    state.menuOpen = false;
    state.flashActive = true;
    if (flashTimer) clearTimeout(flashTimer);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const targetCategory = state.activeCategory === 'All' ? 'Tips' : state.activeCategory;
    const isJobs = targetCategory.toLowerCase() === 'jobs';
    const captureText =
      'Captured via Sticky Notes 1-click snip. Click to annotate or add details about this screen snapshot.';

    addNoteRecord({
      theme: 'blue',
      category: targetCategory,
      date: getFormattedStickyDate(),
      bannerType: 'banner-snapshot',
      customImage: null,
      title: `Screen capture (${timeStr})`,
      body: captureText,
      ...(isJobs
        ? {
            jobDescription: captureText,
            jobStatus: 'ready_for_tailoring',
            selectedTask: null,
            taskStatus: 'idle',
          }
        : {}),
    });

    state.detailNoteId = null;
    render();
    showToast(`1-click screenshot saved to ${targetCategory}!`);

    flashTimer = setTimeout(() => {
      state.flashActive = false;
      flashTimer = null;
      const flashEl = windowEl?.querySelector('.sn-flash');
      if (flashEl) flashEl.remove();
    }, 260);
  }

  function handleResetDemoNotes() {
    state.menuOpen = false;
    const existingIds = state.notes.map((n) => n.id);
    if (hasCustomDelete) {
      existingIds.forEach((id) => {
        try {
          Promise.resolve(options.deleteNote(id)).catch(() => {});
        } catch {
          // Ignore callback error
        }
      });
    }
    const nowBase = Date.now();
    state.notes = DEFAULT_STICKY_NOTES.map((item, idx) =>
      normalizeNote({
        ...item,
        createdAt: item.createdAt || new Date(nowBase - idx * 60000).toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
    state.categories = [...initialCategoryList];
    writeLocalCategories(state.categories);
    if (!hasCustomLoad && !hasCustomSave) {
      writeLocalNotes(state.notes);
    } else if (hasCustomSave) {
      state.notes.forEach((n) => persistNote(n, true));
    }
    state.activeCategory = 'All';
    state.detailNoteId = null;
    render();
    showToast('Restored default demo notes & tabs');
  }

  function handleToggleTaskMenu() {
    if (state.taskMenuOpen) {
      state.taskMenuOpen = false;
      render();
      return;
    }

    const winRect = windowEl?.getBoundingClientRect();
    const btnEl = windowEl?.querySelector('.sn-task-btn');
    const btnRect = btnEl?.getBoundingClientRect();
    const menuWidth = 188;
    const gap = 10;

    if (winRect && btnRect && window.innerWidth - winRect.right >= menuWidth + gap + 8) {
      state.taskMenuPlacement = 'right';
      state.taskMenuCoords = {
        left: winRect.right + gap,
        top: Math.max(16, Math.min(btnRect.top - 4, window.innerHeight - 190)),
      };
    } else {
      state.taskMenuPlacement = 'inside';
    }
    state.taskMenuOpen = true;
    render();
  }

  function handleSelectJobTask(task) {
    const note = getActiveDetailNote();
    if (!note) return;

    updateNote(
      note.id,
      (prev) => ({
        ...prev,
        selectedTask: task,
        taskStatus: prev.taskStatus === 'running' ? 'running' : 'queued',
        taskReason: undefined,
      }),
      true
    );

    state.taskMenuOpen = false;
    pulseSavedStatus();
    render();
    showToast(`Queued "${TASK_FULL_LABELS[task]}" AI task`);

    if (hasTaskCallback) {
      try {
        Promise.resolve(options.onTaskSelected(note.id, task))
          .then(() => syncTaskStatuses(note.id))
          .catch(() => {});
      } catch {
        // Ignore host callback error
      }
    }
  }

  function removeAllDomNodes() {
    if (fixedTaskMenuEl) {
      fixedTaskMenuEl.remove();
      fixedTaskMenuEl = null;
    }
    if (backdropEl) {
      backdropEl.remove();
      backdropEl = null;
      windowEl = null;
    }
    if (restorePillEl) {
      restorePillEl.remove();
      restorePillEl = null;
    }
  }

  function renderTaskMenuHtml(note) {
    const items = [
      { id: 'resume', label: 'Resume' },
      { id: 'cover_letter', label: 'Cover letter' },
      { id: 'both', label: 'Both' },
    ];
    return `
      <div class="sn-task-menu-list">
        <div class="sn-task-menu-title">AI Builder Task</div>
        ${items
          .map((opt) => {
            const selected = note.selectedTask === opt.id;
            return `
              <button
                type="button"
                data-sn-task-opt="${opt.id}"
                class="sn-task-menu-item ${selected ? 'sn-task-menu-item-selected' : ''}"
              >
                <span>${escapeHtml(opt.label)}</span>
                ${selected ? '<span class="sn-task-menu-selected-tag">Selected</span>' : ''}
              </button>
            `;
          })
          .join('')}
      </div>
    `;
  }

  function bindTaskMenuListeners(containerEl) {
    containerEl.querySelectorAll('[data-sn-task-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const task = btn.getAttribute('data-sn-task-opt');
        if (task && TASK_TYPE_VALUES.has(task)) {
          handleSelectJobTask(task);
        }
      });
    });
  }

  function renderCardHtml(note) {
    const isJobs = (note.category || '').toLowerCase() === 'jobs';
    const theme = STICKY_NOTE_THEMES[note.theme] || (isJobs ? STICKY_NOTE_THEMES.blue : STICKY_NOTE_THEMES.purple);
    const displayStatus = isJobs ? getDisplayJobStatus(note) : '';
    const displayTitle = note.title || (isJobs ? (note.sourceUrl ? 'Job Request' : 'Untitled Job') : 'Untitled note');
    const previewText = isJobs
      ? (note.jobDescription && note.jobDescription.trim()) || stripHtml(note.body) || 'Link saved — no description added yet.'
      : stripHtml(note.body);
    const taskBadge = isJobs ? formatTaskBadgeText(note) : '';

    let mediaHtml = '';
    if (note.customImage) {
      mediaHtml = `
        <div class="sn-card-media">
          <img src="${escapeHtml(note.customImage)}" alt="${escapeHtml(displayTitle)}" class="sn-card-img" />
        </div>
      `;
    } else if (note.bannerType && note.bannerType !== 'none') {
      mediaHtml = createBannerSvgMarkup(note.bannerType);
    }

    const swatchesHtml = Object.values(STICKY_NOTE_THEMES)
      .map(
        (t) => `
          <button
            type="button"
            data-sn-card-theme="${t.id}"
            title="${escapeHtml(t.name)}"
            style="background-color: ${t.accent};"
            class="sn-card-swatch ${theme.id === t.id ? 'sn-card-swatch-active' : ''}"
          ></button>
        `
      )
      .join('');

    return `
      <article
        class="sn-card"
        data-sn-note-id="${escapeHtml(note.id)}"
        style="background-color: ${theme.bg};"
      >
        <div class="sn-card-accent" style="background-color: ${theme.accent};"></div>
        <div class="sn-card-inner">
          <div class="sn-card-header">
            <div class="sn-card-cat-wrap">
              <span class="sn-card-cat">${escapeHtml(note.category || 'Note')}</span>
              ${
                isJobs
                  ? `<span class="sn-badge sn-job-${escapeHtml(displayStatus)}">${escapeHtml(displayStatus)}</span>`
                  : ''
              }
            </div>
            <div class="sn-card-right">
              <div class="sn-card-hover-actions">
                ${swatchesHtml}
                <span class="sn-hover-sep"></span>
                <button type="button" data-sn-card-delete="true" title="Delete note" class="sn-hover-del">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
              <span class="sn-card-date">${escapeHtml(note.date || formatDateFromIso(note.createdAt))}</span>
            </div>
          </div>
          ${mediaHtml}
          <h2 class="sn-card-title">${escapeHtml(displayTitle)}</h2>
          ${
            isJobs && note.sourceUrl
              ? `<p class="sn-card-url">${escapeHtml(note.sourceUrl)}</p>`
              : ''
          }
          <p class="sn-card-body">${escapeHtml(previewText)}</p>
          ${
            taskBadge
              ? `
                <div class="sn-task-row">
                  <span class="sn-badge sn-task-${escapeHtml(note.taskStatus)}">${escapeHtml(taskBadge)}</span>
                  ${
                    note.taskStatus === 'failed' && note.taskReason
                      ? `<span class="sn-task-fail-reason">${escapeHtml(note.taskReason)}</span>`
                      : ''
                  }
                </div>
              `
              : ''
          }
        </div>
      </article>
    `;
  }

  function renderListViewHtml() {
    const filtered = getFilteredNotes();
    const tabs = ['All', ...state.categories];

    const tabsHtml = tabs
      .map((cat) => {
        const active = state.activeCategory === cat;
        const count = getCategoryCount(cat);
        return `
          <button
            type="button"
            data-sn-tab="${escapeHtml(cat)}"
            class="sn-tab ${active ? 'sn-tab-active' : ''}"
          >
            <span>${escapeHtml(cat)}</span>
            <span class="sn-tab-count">${count}</span>
          </button>
        `;
      })
      .join('');

    return `
      <div class="sn-view">
        <div class="sn-toolbar">
          <button type="button" data-sn-open-composer="true" class="sn-tool-btn">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <line x1="8" y1="2.5" x2="8" y2="13.5" />
              <line x1="2.5" y1="8" x2="13.5" y2="8" />
            </svg>
            <span>Note</span>
          </button>
          <button type="button" data-sn-screenshot="true" class="sn-tool-btn">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4">
              <path d="M2.5 6V4C2.5 3.17157 3.17157 2.5 4 2.5H6" />
              <path d="M12 2.5H14C14.8284 2.5 15.5 3.17157 15.5 4V6" />
              <path d="M15.5 12V14C15.5 14.8284 14.8284 15.5 14 15.5H12" />
              <path d="M6 15.5H4C3.17157 15.5 2.5 14.8284 2.5 14V12" />
              <rect x="5.5" y="5.5" width="7" height="7" rx="1.5" stroke-width="1.3" />
            </svg>
            <span>Screenshot</span>
          </button>
        </div>

        <div class="sn-tabs-section">
          <div class="sn-tabs-row">
            ${tabsHtml}
            <button
              type="button"
              data-sn-show-add-cat="true"
              title="Add custom category"
              aria-label="Add custom category"
              class="sn-tab-add"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
                <line x1="8" y1="3" x2="8" y2="13" />
                <line x1="3" y1="8" x2="13" y2="8" />
              </svg>
            </button>
          </div>
          ${
            state.addingCategory
              ? `
                <div class="sn-add-cat-row">
                  <input
                    type="text"
                    maxlength="20"
                    value="${escapeHtml(state.newCategoryName)}"
                    placeholder="New category name..."
                    class="sn-add-cat-input"
                  />
                  <button type="button" data-sn-confirm-add-cat="true" class="sn-btn-primary-sm">Add</button>
                  <button type="button" data-sn-cancel-add-cat="true" class="sn-btn-ghost-sm">Cancel</button>
                </div>
              `
              : ''
          }
        </div>

        <div class="sn-section-bar">
          <div class="sn-section-head">
            <span class="sn-section-title">
              ${state.activeCategory === 'All' ? 'Recent notes' : `${escapeHtml(state.activeCategory)} notes`}
            </span>
            <button
              type="button"
              data-sn-toggle-search="true"
              title="Search notes"
              aria-label="Search notes"
              class="sn-icon-btn"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
                <circle cx="7" cy="7" r="4.8" />
                <line x1="10.6" y1="10.6" x2="14" y2="14" />
              </svg>
            </button>
          </div>
          ${
            state.searchOpen
              ? `
                <div class="sn-search-row">
                  <input
                    type="text"
                    value="${escapeHtml(state.searchQuery)}"
                    placeholder="Search by title, tag, link, or content..."
                    class="sn-search-input"
                  />
                  <button type="button" data-sn-clear-search="true" title="Clear search" class="sn-search-clear">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                      <line x1="3" y1="3" x2="11" y2="11" />
                      <line x1="11" y1="3" x2="3" y2="11" />
                    </svg>
                  </button>
                </div>
              `
              : ''
          }
        </div>

        <div class="sn-feed sn-scroll">
          ${
            filtered.length === 0
              ? `
                <div class="sn-empty">
                  <p class="sn-empty-title">No notes in ${escapeHtml(state.activeCategory)}</p>
                  <p class="sn-empty-sub">Click &quot;+ Note&quot; above to create one in this category.</p>
                </div>
              `
              : filtered.map(renderCardHtml).join('')
          }
        </div>
      </div>
    `;
  }

  function renderDetailViewHtml(note) {
    const isJobs = (note.category || '').toLowerCase() === 'jobs';
    const theme = STICKY_NOTE_THEMES[note.theme] || (isJobs ? STICKY_NOTE_THEMES.blue : STICKY_NOTE_THEMES.purple);
    const displayStatus = isJobs ? getDisplayJobStatus(note) : '';
    const categoryOptions = Array.from(new Set([...state.categories, note.category || 'Tips']));

    const topSwatchesHtml = Object.values(STICKY_NOTE_THEMES)
      .map(
        (t) => `
          <button
            type="button"
            data-sn-detail-theme="${t.id}"
            title="${escapeHtml(t.name)}"
            style="background-color: ${t.accent};"
            class="sn-swatch-btn ${theme.id === t.id ? 'sn-swatch-btn-active' : ''}"
          ></button>
        `
      )
      .join('');

    let mediaHtml = '';
    if (note.customImage) {
      mediaHtml = `
        <div class="sn-detail-media">
          <img src="${escapeHtml(note.customImage)}" alt="${escapeHtml(note.title || 'Attached snapshot')}" class="sn-detail-img" />
        </div>
      `;
    } else if (note.bannerType && note.bannerType !== 'none') {
      mediaHtml = createBannerSvgMarkup(note.bannerType);
    }

    const taskBtnGroupHtml = isJobs
      ? `
        <div class="sn-task-btn-group">
          <button
            type="button"
            class="sn-task-btn ${state.taskMenuOpen || note.selectedTask ? 'sn-task-btn-active' : ''}"
            title="${
              note.selectedTask
                ? `AI Builder: ${TASK_FULL_LABELS[note.selectedTask]}${
                    note.taskStatus && note.taskStatus !== 'idle' ? ` (${note.taskStatus})` : ''
                  }`
                : 'Open resume and cover letter builder menu'
            }"
            aria-label="${
              note.selectedTask
                ? `AI Builder (${TASK_FULL_LABELS[note.selectedTask]})`
                : 'AI Builder'
            }"
            aria-expanded="${state.taskMenuOpen ? 'true' : 'false'}"
          >
            <span aria-hidden="true" class="sn-task-btn-icon">&#x1F4C4;</span>
            ${
              note.selectedTask
                ? `<span class="sn-task-btn-label">${escapeHtml(TASK_SHORT_LABELS[note.selectedTask])}</span>`
                : ''
            }
          </button>
          <button type="button" disabled aria-label="Future AI task placeholder 1" class="sn-task-placeholder"></button>
          <button type="button" disabled aria-label="Future AI task placeholder 2" class="sn-task-placeholder"></button>
          ${
            state.taskMenuOpen && state.taskMenuPlacement === 'inside'
              ? `<div role="menu" aria-label="AI Builder tasks" class="sn-task-menu-inside">${renderTaskMenuHtml(note)}</div>`
              : ''
          }
        </div>
      `
      : '';

    const taskBannerHtml = isJobs && note.taskStatus && note.taskStatus !== 'idle'
      ? `
        <div class="sn-detail-task-banner sn-task-${escapeHtml(note.taskStatus)}">
          <span class="sn-detail-task-heading">
            ${escapeHtml(formatTaskBadgeText(note))}
          </span>
          ${
            note.selectedTask
              ? `<span class="sn-detail-task-sub"> (${escapeHtml(TASK_FULL_LABELS[note.selectedTask])})</span>`
              : ''
          }
          ${
            note.taskStatus === 'failed' && note.taskReason
              ? `<p class="sn-detail-task-reason">${escapeHtml(note.taskReason)}</p>`
              : ''
          }
        </div>
      `
      : '';

    const jobFieldsHtml = isJobs
      ? `
        <div class="sn-detail-field">
          <div class="sn-detail-label-row">
            <label for="sn-detail-job-link" class="sn-detail-label">Job link</label>
            ${note.sourceUrl ? '<span class="sn-detail-saved-tag">Saved</span>' : ''}
          </div>
          <input
            id="sn-detail-job-link"
            type="url"
            value="${escapeHtml(state.detailUrlDraft)}"
            placeholder="https://company.com/careers/role"
            class="sn-detail-url-input"
          />
          ${
            state.detailUrlError
              ? `<p class="sn-field-error">${escapeHtml(state.detailUrlError)}</p>`
              : ''
          }
        </div>
        <label for="sn-detail-job-desc" class="sn-detail-label">Job description</label>
        <textarea
          id="sn-detail-job-desc"
          placeholder="Paste or edit the full job description..."
          class="sn-detail-desc-textarea sn-scroll"
        >${escapeHtml(note.jobDescription || '')}</textarea>
      `
      : `
        <div
          contenteditable="true"
          data-placeholder="Take a note..."
          class="sn-detail-editor"
        ></div>
      `;

    return `
      <div class="sn-view">
        <div class="sn-detail-topbar">
          <button type="button" data-sn-back="true" class="sn-back-btn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M10 3L5 8l5 5" />
            </svg>
            <span>Recent notes</span>
          </button>

          <div class="sn-swatch-row">${topSwatchesHtml}</div>

          <div class="sn-detail-actions">
            <button type="button" data-sn-copy-detail="true" title="Copy note text" class="sn-icon-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button type="button" data-sn-delete-detail="true" title="Delete note" class="sn-icon-btn sn-icon-btn-danger">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>

        <div class="sn-detail-scroll sn-scroll">
          <div class="sn-detail-card" style="background-color: ${theme.bg};">
            <div class="sn-card-accent" style="background-color: ${theme.accent};"></div>
            <div class="sn-detail-inner">
              <div class="sn-detail-head">
                <div class="sn-detail-cat-group">
                  <div class="sn-select-wrap">
                    <select class="sn-cat-select" aria-label="Note category">
                      ${categoryOptions
                        .map(
                          (c) =>
                            `<option value="${escapeHtml(c)}" ${c === note.category ? 'selected' : ''}>${escapeHtml(c)}</option>`
                        )
                        .join('')}
                    </select>
                    <svg class="sn-select-caret" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </div>
                  ${
                    isJobs
                      ? `<span class="sn-badge sn-badge-lg sn-job-${escapeHtml(displayStatus)}">${escapeHtml(displayStatus)}</span>`
                      : ''
                  }
                </div>
                ${taskBtnGroupHtml}
                <span class="sn-detail-date">${escapeHtml(note.date || formatDateFromIso(note.createdAt))}</span>
              </div>
              ${taskBannerHtml}
              ${mediaHtml}
              <input
                type="text"
                value="${escapeHtml(note.title)}"
                placeholder="${isJobs ? 'Job title (optional)...' : 'Note title...'}"
                class="sn-detail-title-input"
              />
              ${jobFieldsHtml}
            </div>

            <div class="sn-detail-footer">
              <div class="sn-format-bar">
                <button type="button" data-sn-fmt="bold" title="Bold" class="sn-format-btn sn-format-btn-bold" ${isJobs ? 'disabled' : ''}>B</button>
                <button type="button" data-sn-fmt="italic" title="Italic" class="sn-format-btn sn-format-btn-italic" ${isJobs ? 'disabled' : ''}>I</button>
                <button type="button" data-sn-fmt="underline" title="Underline" class="sn-format-btn sn-format-btn-underline" ${isJobs ? 'disabled' : ''}>U</button>
                <button type="button" data-sn-fmt="insertUnorderedList" title="Bulleted list" class="sn-format-btn" ${isJobs ? 'disabled' : ''}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <circle cx="4" cy="6" r="1" />
                    <circle cx="4" cy="12" r="1" />
                    <circle cx="4" cy="18" r="1" />
                  </svg>
                </button>
              </div>
              <span class="sn-save-label">${escapeHtml(state.saveLabel)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderComposerModalHtml() {
    const isJobs = state.composerCategory.toLowerCase() === 'jobs';
    const theme = STICKY_NOTE_THEMES[state.composerTheme] || STICKY_NOTE_THEMES.purple;

    const swatchesHtml = Object.values(STICKY_NOTE_THEMES)
      .map(
        (t) => `
          <button
            type="button"
            data-sn-comp-theme="${t.id}"
            title="${escapeHtml(t.name)}"
            style="background-color: ${t.accent};"
            class="sn-composer-swatch ${state.composerTheme === t.id ? 'sn-composer-swatch-active' : ''}"
          ></button>
        `
      )
      .join('');

    const categoryOptsHtml = state.categories
      .map(
        (c) =>
          `<option value="${escapeHtml(c)}" ${c === state.composerCategory ? 'selected' : ''}>${escapeHtml(c)}</option>`
      )
      .join('');

    const banners = [
      { id: 'none', label: 'None (Text only)' },
      { id: 'banner-screenshot', label: '1-Click Capture Graphic' },
      { id: 'banner-source', label: 'Source Link Graphic' },
      { id: 'banner-shortcut', label: 'Shortcut Graphic' },
      { id: 'banner-snapshot', label: 'Desktop Snapshot' },
    ];

    return `
      <div class="sn-composer-overlay">
        <div class="sn-composer-card sn-scroll">
          <div class="sn-card-accent" style="background-color: ${theme.accent};"></div>
          <div class="sn-composer-body">
            <div class="sn-composer-head">
              <h3 class="sn-composer-title">${isJobs ? 'New Job Request' : 'New Sticky Note'}</h3>
              <button type="button" data-sn-comp-close="true" aria-label="Close composer" class="sn-composer-close">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                  <line x1="3" y1="3" x2="11" y2="11" />
                  <line x1="11" y1="3" x2="3" y2="11" />
                </svg>
              </button>
            </div>

            <div class="sn-composer-group">
              <span class="sn-composer-label">Note color</span>
              <div class="sn-composer-swatches">${swatchesHtml}</div>
            </div>

            <div class="sn-composer-grid">
              <div>
                <label for="sn-composer-cat" class="sn-composer-label">Category</label>
                <select id="sn-composer-cat" class="sn-select">${categoryOptsHtml}</select>
              </div>
              <div>
                <label for="sn-composer-banner" class="sn-composer-label">Header graphic</label>
                <select id="sn-composer-banner" class="sn-select">
                  ${banners
                    .map(
                      (b) =>
                        `<option value="${b.id}" ${b.id === state.composerBanner ? 'selected' : ''}>${escapeHtml(b.label)}</option>`
                    )
                    .join('')}
                </select>
              </div>
            </div>

            ${
              isJobs
                ? `
                  <div class="sn-composer-group">
                    <label for="sn-job-link" class="sn-composer-label">Job link</label>
                    <input
                      id="sn-job-link"
                      type="url"
                      value="${escapeHtml(state.composerJobUrl)}"
                      placeholder="https://company.com/careers/role"
                      class="sn-input"
                    />
                  </div>
                  <div class="sn-composer-group">
                    <label for="sn-job-desc" class="sn-composer-label">Job description</label>
                    <textarea
                      id="sn-job-desc"
                      rows="4"
                      placeholder="Paste the job posting description..."
                      class="sn-textarea"
                    >${escapeHtml(state.composerJobDesc)}</textarea>
                  </div>
                  <p class="sn-composer-hint">Add a link, a description, or both.</p>
                  <div class="sn-composer-group">
                    <input
                      id="sn-composer-title"
                      type="text"
                      value="${escapeHtml(state.composerTitle)}"
                      placeholder="Title (optional, e.g., Senior Engineer)"
                      class="sn-input sn-input-sm"
                    />
                  </div>
                  ${
                    state.composerError
                      ? `<div role="alert" class="sn-composer-error">${escapeHtml(state.composerError)}</div>`
                      : ''
                  }
                `
                : `
                  <div class="sn-composer-group">
                    <input
                      id="sn-composer-title"
                      type="text"
                      value="${escapeHtml(state.composerTitle)}"
                      placeholder="Title (e.g., Project ideas)"
                      class="sn-input sn-input-bold"
                    />
                  </div>
                  <div class="sn-composer-group">
                    <textarea
                      id="sn-composer-body"
                      rows="3"
                      placeholder="Write your note here..."
                      class="sn-textarea"
                    >${escapeHtml(state.composerBody)}</textarea>
                  </div>
                `
            }

            <div class="sn-upload-row">
              <label class="sn-upload-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>${escapeHtml(state.composerUploadName)}</span>
                <input type="file" accept="image/*" class="sn-upload-input" />
              </label>
              ${
                state.composerCustomImage
                  ? '<button type="button" data-sn-comp-clear-img="true" class="sn-upload-remove">Remove</button>'
                  : ''
              }
            </div>

            <div class="sn-composer-footer">
              <button type="button" data-sn-comp-cancel="true" class="sn-btn-cancel">Cancel</button>
              <button type="button" data-sn-comp-save="true" class="sn-btn-save">
                ${isJobs ? 'Save Job Request' : 'Add Note'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function wireWindowEvents() {
    if (!windowEl) return;

    // Header actions
    windowEl.querySelector('[data-sn-more-toggle]')?.addEventListener('click', () => {
      state.menuOpen = !state.menuOpen;
      render();
    });

    windowEl.querySelector('[data-sn-menu-new]')?.addEventListener('click', openComposerModal);
    windowEl.querySelector('[data-sn-menu-shot]')?.addEventListener('click', triggerScreenshotCapture);
    windowEl.querySelector('[data-sn-menu-reset]')?.addEventListener('click', handleResetDemoNotes);
    windowEl.querySelector('[data-sn-minimize]')?.addEventListener('click', minimize);
    windowEl.querySelector('[data-sn-close]')?.addEventListener('click', close);

    // List view controls
    windowEl.querySelector('[data-sn-open-composer]')?.addEventListener('click', openComposerModal);
    windowEl.querySelector('[data-sn-screenshot]')?.addEventListener('click', triggerScreenshotCapture);

    windowEl.querySelectorAll('[data-sn-tab]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        state.activeCategory = tabBtn.getAttribute('data-sn-tab') || 'All';
        render();
      });
    });

    windowEl.querySelector('[data-sn-show-add-cat]')?.addEventListener('click', () => {
      state.addingCategory = true;
      render();
      setTimeout(() => {
        windowEl?.querySelector('.sn-add-cat-input')?.focus();
      }, 20);
    });

    const addCatInput = windowEl.querySelector('.sn-add-cat-input');
    if (addCatInput) {
      addCatInput.addEventListener('input', (e) => {
        state.newCategoryName = e.target.value;
      });
      addCatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmAddCategory();
        if (e.key === 'Escape') {
          e.stopPropagation();
          state.addingCategory = false;
          state.newCategoryName = '';
          render();
        }
      });
    }

    windowEl.querySelector('[data-sn-confirm-add-cat]')?.addEventListener('click', confirmAddCategory);
    windowEl.querySelector('[data-sn-cancel-add-cat]')?.addEventListener('click', () => {
      state.addingCategory = false;
      state.newCategoryName = '';
      render();
    });

    windowEl.querySelector('[data-sn-toggle-search]')?.addEventListener('click', () => {
      if (state.searchOpen) {
        state.searchQuery = '';
        state.searchOpen = false;
        render();
      } else {
        state.searchOpen = true;
        render();
        setTimeout(() => {
          windowEl?.querySelector('.sn-search-input')?.focus();
        }, 20);
      }
    });

    const searchInput = windowEl.querySelector('.sn-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        const caret = e.target.selectionStart;
        render();
        const freshInput = windowEl?.querySelector('.sn-search-input');
        if (freshInput) {
          freshInput.focus();
          if (typeof caret === 'number') freshInput.setSelectionRange(caret, caret);
        }
      });
    }

    windowEl.querySelector('[data-sn-clear-search]')?.addEventListener('click', () => {
      state.searchQuery = '';
      render();
      windowEl?.querySelector('.sn-search-input')?.focus();
    });

    // Feed card interactions
    windowEl.querySelectorAll('.sn-card').forEach((cardEl) => {
      const noteId = cardEl.getAttribute('data-sn-note-id');
      if (!noteId) return;

      cardEl.addEventListener('click', () => {
        const note = state.notes.find((n) => n.id === noteId);
        if (!note) return;
        state.detailNoteId = noteId;
        state.detailUrlDraft = note.sourceUrl || '';
        state.detailUrlError = null;
        state.taskMenuOpen = false;
        render();
        if (note.category.toLowerCase() === 'jobs') {
          void syncTaskStatuses(noteId);
        }
      });

      cardEl.querySelectorAll('[data-sn-card-theme]').forEach((swBtn) => {
        swBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const themeId = swBtn.getAttribute('data-sn-card-theme');
          if (themeId && STICKY_NOTE_THEMES[themeId]) {
            updateNote(noteId, (prev) => ({ ...prev, theme: themeId }), true);
            render();
          }
        });
      });

      cardEl.querySelector('[data-sn-card-delete]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        removeNote(noteId);
        render();
        showToast('Note removed');
      });
    });

    // Detail view interactions
    const activeDetail = getActiveDetailNote();
    if (activeDetail) {
      windowEl.querySelector('[data-sn-back]')?.addEventListener('click', () => {
        flushPendingSaves();
        state.detailNoteId = null;
        state.taskMenuOpen = false;
        render();
      });

      windowEl.querySelectorAll('[data-sn-detail-theme]').forEach((swBtn) => {
        swBtn.addEventListener('click', () => {
          const themeId = swBtn.getAttribute('data-sn-detail-theme');
          if (themeId && STICKY_NOTE_THEMES[themeId]) {
            updateNote(activeDetail.id, (prev) => ({ ...prev, theme: themeId }), true);
            render();
          }
        });
      });

      windowEl.querySelector('[data-sn-copy-detail]')?.addEventListener('click', () => {
        const isJobs = activeDetail.category.toLowerCase() === 'jobs';
        const text = isJobs
          ? [
              activeDetail.title || 'Job Request',
              activeDetail.sourceUrl || '',
              activeDetail.jobDescription || stripHtml(activeDetail.body),
            ]
              .filter(Boolean)
              .join('\n')
          : `${activeDetail.title}\n${stripHtml(activeDetail.body)}`;
        if (navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(text).catch(() => {});
        }
        showToast(isJobs ? 'Copied job note to clipboard' : 'Copied note to clipboard');
      });

      windowEl.querySelector('[data-sn-delete-detail]')?.addEventListener('click', () => {
        const isJobs = activeDetail.category.toLowerCase() === 'jobs';
        removeNote(activeDetail.id);
        render();
        showToast(isJobs ? 'Job request deleted' : 'Sticky note deleted');
      });

      const catSelect = windowEl.querySelector('.sn-cat-select');
      if (catSelect) {
        catSelect.addEventListener('change', (e) => {
          const nextCat = e.target.value || 'Tips';
          const becomingJobs = nextCat.toLowerCase() === 'jobs';
          updateNote(
            activeDetail.id,
            (prev) => {
              const fallbackDesc = prev.jobDescription || stripHtml(prev.body);
              return {
                ...prev,
                category: nextCat,
                ...(becomingJobs
                  ? {
                      jobDescription: fallbackDesc,
                      jobStatus: prev.jobStatus || (fallbackDesc ? 'ready_for_tailoring' : 'needs_manual_input'),
                    }
                  : {}),
              };
            },
            true
          );
          state.taskMenuOpen = false;
          render();
          pulseSavedStatus();
        });
      }

      windowEl.querySelector('.sn-task-btn')?.addEventListener('click', handleToggleTaskMenu);

      const insideTaskMenu = windowEl.querySelector('.sn-task-menu-inside');
      if (insideTaskMenu) {
        bindTaskMenuListeners(insideTaskMenu);
      }

      const titleInput = windowEl.querySelector('.sn-detail-title-input');
      if (titleInput) {
        titleInput.addEventListener('input', (e) => {
          const nextTitle = e.target.value;
          updateNote(activeDetail.id, (prev) => ({ ...prev, title: nextTitle }));
          pulseSavedStatus();
        });
      }

      const jobLinkInput = windowEl.querySelector('#sn-detail-job-link');
      if (jobLinkInput) {
        jobLinkInput.addEventListener('input', (e) => {
          const raw = e.target.value;
          state.detailUrlDraft = raw;
          const trimmed = raw.trim();
          const current = getActiveDetailNote();
          if (!current) return;

          if (!trimmed) {
            if (!(current.jobDescription || '').trim()) {
              state.detailUrlError = 'Keep a link or description so this job note is not empty.';
              renderDetailFieldError();
              return;
            }
            state.detailUrlError = null;
            updateNote(current.id, (prev) => ({ ...prev, sourceUrl: undefined }));
            renderDetailFieldError();
            pulseSavedStatus();
            return;
          }

          if (!isValidHttpUrl(trimmed)) {
            state.detailUrlError = 'Enter a valid URL starting with http:// or https://';
            renderDetailFieldError();
            return;
          }

          state.detailUrlError = null;
          updateNote(current.id, (prev) => ({
            ...prev,
            sourceUrl: trimmed,
            jobStatus:
              prev.jobStatus ||
              ((prev.jobDescription || '').trim() ? 'ready_for_tailoring' : 'needs_extraction'),
          }));
          renderDetailFieldError();
          pulseSavedStatus();
        });
      }

      const jobDescTextarea = windowEl.querySelector('#sn-detail-job-desc');
      if (jobDescTextarea) {
        jobDescTextarea.addEventListener('input', (e) => {
          const nextDesc = e.target.value;
          const trimmed = nextDesc.trim();
          const hasDesc = trimmed.length > 0 && trimmed !== DEFAULT_NOTE_PLACEHOLDER;
          updateNote(activeDetail.id, (prev) => {
            let nextStatus = prev.jobStatus;
            if (
              hasDesc &&
              (!prev.jobStatus ||
                prev.jobStatus === 'needs_extraction' ||
                prev.jobStatus === 'needs_manual_input')
            ) {
              nextStatus = 'ready_for_tailoring';
            } else if (!hasDesc && prev.sourceUrl && prev.jobStatus === 'ready_for_tailoring') {
              nextStatus = 'needs_extraction';
            }
            return {
              ...prev,
              jobDescription: nextDesc,
              body: escapeHtml(nextDesc).replace(/\n/g, '<br>'),
              jobStatus: nextStatus,
            };
          });
          pulseSavedStatus();
        });
      }

      const richEditor = windowEl.querySelector('.sn-detail-editor');
      if (richEditor) {
        richEditor.innerHTML = activeDetail.body || '';
        richEditor.addEventListener('input', () => {
          const nextHtml = richEditor.innerHTML;
          updateNote(activeDetail.id, (prev) => ({ ...prev, body: nextHtml }));
          pulseSavedStatus();
        });
      }

      windowEl.querySelectorAll('[data-sn-fmt]').forEach((fmtBtn) => {
        fmtBtn.addEventListener('click', () => {
          const editor = windowEl?.querySelector('.sn-detail-editor');
          const cmd = fmtBtn.getAttribute('data-sn-fmt');
          if (!editor || !cmd) return;
          editor.focus();
          try {
            document.execCommand(cmd, false, undefined);
          } catch {
            // Ignore unsupported command in non-standard environments
          }
          const updatedHtml = editor.innerHTML;
          updateNote(activeDetail.id, (prev) => ({ ...prev, body: updatedHtml }));
          pulseSavedStatus();
        });
      });
    }

    // Composer events
    if (state.composerOpen) {
      windowEl.querySelector('[data-sn-comp-close]')?.addEventListener('click', closeComposerModal);
      windowEl.querySelector('[data-sn-comp-cancel]')?.addEventListener('click', closeComposerModal);
      windowEl.querySelector('[data-sn-comp-save]')?.addEventListener('click', handleComposerSave);

      windowEl.querySelectorAll('[data-sn-comp-theme]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tId = btn.getAttribute('data-sn-comp-theme');
          if (tId && STICKY_NOTE_THEMES[tId]) {
            state.composerTheme = tId;
            render();
          }
        });
      });

      windowEl.querySelector('#sn-composer-cat')?.addEventListener('change', (e) => {
        const nextCat = e.target.value;
        state.composerCategory = nextCat;
        state.composerError = null;
        if (nextCat.toLowerCase() === 'jobs') {
          state.composerTheme = 'blue';
        }
        render();
      });

      windowEl.querySelector('#sn-composer-banner')?.addEventListener('change', (e) => {
        state.composerBanner = e.target.value;
      });

      windowEl.querySelector('#sn-composer-title')?.addEventListener('input', (e) => {
        state.composerTitle = e.target.value;
      });

      windowEl.querySelector('#sn-composer-body')?.addEventListener('input', (e) => {
        state.composerBody = e.target.value;
      });

      windowEl.querySelector('#sn-job-link')?.addEventListener('input', (e) => {
        state.composerJobUrl = e.target.value;
        if (state.composerError) {
          state.composerError = null;
          windowEl?.querySelector('.sn-composer-error')?.remove();
        }
      });

      windowEl.querySelector('#sn-job-desc')?.addEventListener('input', (e) => {
        state.composerJobDesc = e.target.value;
        if (state.composerError) {
          state.composerError = null;
          windowEl?.querySelector('.sn-composer-error')?.remove();
        }
      });

      windowEl.querySelector('.sn-upload-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = typeof ev.target?.result === 'string' ? ev.target.result : null;
          if (!result || state.destroyed) return;
          if (result.length > 780000) {
            state.composerError = 'Attached image is too large (max ~550KB). Choose a smaller image.';
            render();
            showToast('Image too large — max ~550KB');
            return;
          }
          state.composerCustomImage = result;
          state.composerUploadName = file.name.slice(0, 22);
          render();
        };
        reader.readAsDataURL(file);
      });

      windowEl.querySelector('[data-sn-comp-clear-img]')?.addEventListener('click', () => {
        state.composerCustomImage = null;
        state.composerUploadName = 'Attach custom image...';
        render();
      });
    }
  }

  function renderDetailFieldError() {
    if (!windowEl) return;
    const field = windowEl.querySelector('#sn-detail-job-link')?.closest('.sn-detail-field');
    if (!field) return;
    const oldErr = field.querySelector('.sn-field-error');
    if (oldErr) oldErr.remove();
    if (state.detailUrlError) {
      const p = document.createElement('p');
      p.className = 'sn-field-error';
      p.textContent = state.detailUrlError;
      field.appendChild(p);
    }
  }

  function confirmAddCategory() {
    const raw = state.newCategoryName.trim();
    if (!raw) {
      state.addingCategory = false;
      state.newCategoryName = '';
      render();
      return;
    }
    const existing = state.categories.find((c) => c.toLowerCase() === raw.toLowerCase());
    const added = existing || raw;
    if (!existing) {
      state.categories.push(raw);
      writeLocalCategories(state.categories);
    }
    state.activeCategory = added;
    state.addingCategory = false;
    state.newCategoryName = '';
    render();
    showToast(`Added "${added}" tab`);
  }

  function render() {
    if (state.destroyed) return;

    if (!state.isOpen) {
      removeAllDomNodes();
      return;
    }

    if (state.isMinimized) {
      if (fixedTaskMenuEl) {
        fixedTaskMenuEl.remove();
        fixedTaskMenuEl = null;
      }
      if (backdropEl) {
        backdropEl.remove();
        backdropEl = null;
        windowEl = null;
      }
      if (!restorePillEl) {
        restorePillEl = document.createElement('button');
        restorePillEl.type = 'button';
        restorePillEl.className = 'sn-restore-pill';
        restorePillEl.setAttribute('aria-label', 'Restore Sticky Notes');
        restorePillEl.innerHTML = `${getStickyIconSvg(20)}<span>Sticky Notes</span>`;
        restorePillEl.addEventListener('click', restore);
        mountTarget.appendChild(restorePillEl);
      }
      return;
    }

    if (restorePillEl) {
      restorePillEl.remove();
      restorePillEl = null;
    }

    if (!backdropEl) {
      backdropEl = document.createElement('div');
      backdropEl.className = 'sn-backdrop';
      backdropEl.setAttribute('role', 'presentation');

      windowEl = document.createElement('main');
      windowEl.className = 'sn-window';
      windowEl.setAttribute('role', 'dialog');
      windowEl.setAttribute('aria-modal', 'true');
      windowEl.setAttribute('aria-label', 'Sticky Notes');
      backdropEl.appendChild(windowEl);
      mountTarget.appendChild(backdropEl);
    }

    const activeDetail = getActiveDetailNote();
    if (state.detailNoteId && !activeDetail) {
      state.detailNoteId = null;
      state.taskMenuOpen = false;
    }

    const headerHtml = `
      <header class="sn-titlebar">
        <div class="sn-titlebar-left">
          <div class="sn-app-icon">${getStickyIconSvg(18)}</div>
          <span class="sn-app-title">Sticky Notes</span>
        </div>
        <div class="sn-titlebar-actions">
          <div class="sn-menu-anchor">
            <button
              type="button"
              data-sn-more-toggle="true"
              title="More options"
              aria-label="More options"
              class="sn-win-btn"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="3.2" cy="8" r="1.15" />
                <circle cx="8" cy="8" r="1.15" />
                <circle cx="12.8" cy="8" r="1.15" />
              </svg>
            </button>
            ${
              state.menuOpen
                ? `
                  <div class="sn-more-menu">
                    <button type="button" data-sn-menu-new="true" class="sn-more-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span>New sticky note</span>
                    </button>
                    <button type="button" data-sn-menu-shot="true" class="sn-more-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>Quick screenshot note</span>
                    </button>
                    <div class="sn-more-divider"></div>
                    <button type="button" data-sn-menu-reset="true" class="sn-more-item sn-more-item-accent">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      <span>Reset Demo Notes</span>
                    </button>
                  </div>
                `
                : ''
            }
          </div>
          <div class="sn-win-sep"></div>
          <button type="button" data-sn-minimize="true" title="Minimize" aria-label="Minimize Sticky Notes" class="sn-win-btn">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2">
              <line x1="1.5" y1="6" x2="10.5" y2="6" />
            </svg>
          </button>
          <button type="button" data-sn-close="true" title="Close" aria-label="Close Sticky Notes" class="sn-win-btn sn-win-btn-close">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2">
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </button>
        </div>
      </header>
    `;

    const viewHtml = activeDetail ? renderDetailViewHtml(activeDetail) : renderListViewHtml();
    const composerHtml = state.composerOpen ? renderComposerModalHtml() : '';
    const flashHtml = state.flashActive ? '<div class="sn-flash"></div>' : '';

    windowEl.innerHTML = `${headerHtml}${viewHtml}${composerHtml}${flashHtml}`;
    renderToastOnly();
    wireWindowEvents();

    // Fixed task menu outside right edge when viewport allows
    if (fixedTaskMenuEl) {
      fixedTaskMenuEl.remove();
      fixedTaskMenuEl = null;
    }
    if (
      activeDetail &&
      activeDetail.category.toLowerCase() === 'jobs' &&
      state.taskMenuOpen &&
      state.taskMenuPlacement === 'right'
    ) {
      fixedTaskMenuEl = document.createElement('div');
      fixedTaskMenuEl.className = 'sn-task-menu-fixed';
      fixedTaskMenuEl.setAttribute('role', 'menu');
      fixedTaskMenuEl.setAttribute('aria-label', 'AI Builder tasks');
      fixedTaskMenuEl.style.top = `${state.taskMenuCoords.top}px`;
      fixedTaskMenuEl.style.left = `${state.taskMenuCoords.left}px`;
      fixedTaskMenuEl.innerHTML = renderTaskMenuHtml(activeDetail);
      bindTaskMenuListeners(fixedTaskMenuEl);
      backdropEl.appendChild(fixedTaskMenuEl);
    }
  }

  // Global keyboard & click-outside listeners (cleaned up atomically on destroy)
  window.addEventListener(
    'keydown',
    (e) => {
      if (state.destroyed) return;
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        open();
        return;
      }

      if (e.key === 'Escape' && state.isOpen && !state.isMinimized) {
        if (state.composerOpen) {
          e.preventDefault();
          closeComposerModal();
          return;
        }
        if (state.taskMenuOpen) {
          e.preventDefault();
          state.taskMenuOpen = false;
          render();
          return;
        }
        if (state.menuOpen) {
          e.preventDefault();
          state.menuOpen = false;
          render();
          return;
        }
        if (state.addingCategory) {
          e.preventDefault();
          state.addingCategory = false;
          state.newCategoryName = '';
          render();
          return;
        }
        e.preventDefault();
        close();
      }
    },
    { signal: abortController.signal }
  );

  document.addEventListener(
    'mousedown',
    (e) => {
      if (state.destroyed) return;
      let changed = false;

      if (state.menuOpen) {
        const anchor = windowEl?.querySelector('.sn-menu-anchor');
        if (anchor && !anchor.contains(e.target)) {
          state.menuOpen = false;
          changed = true;
        }
      }

      if (state.taskMenuOpen) {
        const taskBtn = windowEl?.querySelector('.sn-task-btn');
        const insideMenu = windowEl?.querySelector('.sn-task-menu-inside');
        const clickedMenu =
          (fixedTaskMenuEl && fixedTaskMenuEl.contains(e.target)) ||
          (insideMenu && insideMenu.contains(e.target)) ||
          (taskBtn && taskBtn.contains(e.target));
        if (!clickedMenu) {
          state.taskMenuOpen = false;
          changed = true;
        }
      }

      if (changed) render();
    },
    { signal: abortController.signal }
  );

  window.addEventListener(
    'resize',
    () => {
      if (state.destroyed || !state.taskMenuOpen) return;
      state.taskMenuOpen = false;
      render();
    },
    { signal: abortController.signal }
  );

  function open() {
    if (state.destroyed) return;
    state.isOpen = true;
    state.isMinimized = false;
    writeSessionState(true, false);
    render();
    void syncTaskStatuses();
  }

  function close() {
    if (state.destroyed) return;
    flushPendingSaves();
    state.isOpen = false;
    state.isMinimized = false;
    state.menuOpen = false;
    state.taskMenuOpen = false;
    writeSessionState(false, false);
    render();
  }

  function minimize() {
    if (state.destroyed || !state.isOpen) return;
    flushPendingSaves();
    state.isMinimized = true;
    state.menuOpen = false;
    state.taskMenuOpen = false;
    writeSessionState(true, true);
    render();
  }

  function restore() {
    if (state.destroyed) return;
    state.isOpen = true;
    state.isMinimized = false;
    writeSessionState(true, false);
    render();
    void syncTaskStatuses();
  }

  function destroy() {
    if (state.destroyed) return;
    flushPendingSaves();
    state.destroyed = true;
    clearTimers();
    abortController.abort();
    removeAllDomNodes();
  }

  // Initial load & mount if session or defaultOpen is active
  void refresh();

  return {
    open,
    close,
    minimize,
    restore,
    destroy,
    refresh,
  };
}

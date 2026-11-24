import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCareer } from '../store/CareerContext';
import {
  DEFAULT_NOTE_PLACEHOLDER,
  getFormattedStickyDate,
  isValidHttpUrl,
  STICKY_NOTE_THEMES,
  validateJobRequestInput,
} from '../data/stickyNotesData';
import {
  JobApplication,
  JobIntakeStatus,
  JobTaskStatus,
  JobTaskType,
  StickyNoteItem,
  StickyNoteThemeId,
} from '../types/career';
import { StickyNoteBannerSvg } from './StickyNoteBanners';

type DetailTarget =
  | { kind: 'note'; id: string }
  | { kind: 'job'; id: string };

type FeedEntry =
  | { kind: 'note'; id: string; sortKey: string; note: StickyNoteItem }
  | { kind: 'job'; id: string; sortKey: string; job: JobApplication };

const JOB_STATUS_BADGE_STYLES: Record<JobIntakeStatus, string> = {
  needs_extraction: 'bg-amber-400/20 text-amber-200 border-amber-300/35',
  ready_for_tailoring: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/35',
  needs_manual_input: 'bg-orange-400/20 text-orange-200 border-orange-300/35',
  tailoring: 'bg-sky-400/20 text-sky-200 border-sky-300/35',
  tailored: 'bg-purple-300/25 text-purple-100 border-purple-200/40',
  failed: 'bg-rose-400/20 text-rose-200 border-rose-300/35',
};

const TASK_STATUS_BADGE_STYLES: Record<JobTaskStatus, string> = {
  idle: 'bg-white/10 text-white/75 border-white/20',
  queued: 'bg-amber-400/20 text-amber-100 border-amber-300/40',
  running: 'bg-sky-400/25 text-sky-100 border-sky-300/45',
  done: 'bg-emerald-400/20 text-emerald-100 border-emerald-300/40',
  failed: 'bg-rose-400/25 text-rose-100 border-rose-300/45',
};

const TASK_SHORT_LABELS: Record<JobTaskType, string> = {
  resume: 'Resume',
  cover_letter: 'Cover',
  both: 'Both',
};

const TASK_FULL_LABELS: Record<JobTaskType, string> = {
  resume: 'Resume',
  cover_letter: 'Cover letter',
  both: 'Both',
};

function stripHtml(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').trim();
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateFromIso(iso?: string): string {
  if (!iso) return getFormattedStickyDate();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return getFormattedStickyDate();
  return getFormattedStickyDate(parsed);
}

function getDisplayJobStatus(job: JobApplication): JobIntakeStatus {
  if (job.jobStatus) return job.jobStatus;
  return job.jobDescription?.trim() ? 'ready_for_tailoring' : 'needs_manual_input';
}

export function StickyNotesPopup() {
  const {
    jobs,
    addJob,
    updateJob,
    queueJobTask,
    deleteJob,
    stickyNotes,
    stickyCategories,
    addStickyNote,
    updateStickyNote,
    deleteStickyNote,
    addStickyCategory,
    resetDemoStickyNotes,
    isStickyNotesOpen,
    isStickyNotesMinimized,
    openStickyNotes,
    closeStickyNotes,
    minimizeStickyNotes,
    restoreStickyNotes,
  } = useCareer();

  // Window UI state preserved across minimize/restore
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTheme, setComposerTheme] = useState<StickyNoteThemeId>('purple');
  const [composerCategory, setComposerCategory] = useState<string>('Ideas');
  const [composerBanner, setComposerBanner] = useState<string>('none');
  const [composerTitle, setComposerTitle] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerJobUrl, setComposerJobUrl] = useState('');
  const [composerJobDesc, setComposerJobDesc] = useState('');
  const [composerCustomImage, setComposerCustomImage] = useState<string | null>(null);
  const [composerUploadName, setComposerUploadName] = useState<string>('Attach custom image...');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [detailUrlDraft, setDetailUrlDraft] = useState('');
  const [detailUrlError, setDetailUrlError] = useState<string | null>(null);

  // Task menu state (Jobs note header Button 1)
  const [taskMenuOpen, setTaskMenuOpen] = useState(false);
  const [taskMenuPlacement, setTaskMenuPlacement] = useState<'right' | 'inside'>('inside');
  const [taskMenuCoords, setTaskMenuCoords] = useState<{ top: number; left: number }>({
    top: 80,
    left: 0,
  });

  // Flash & Toast
  const [flashActive, setFlashActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState<'Saved' | 'Saving...'>('Saved');

  const windowRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const taskBtnRef = useRef<HTMLButtonElement | null>(null);
  const taskMenuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const newCategoryInputRef = useRef<HTMLInputElement | null>(null);
  const composerTitleInputRef = useRef<HTMLInputElement | null>(null);
  const composerJobLinkInputRef = useRef<HTMLInputElement | null>(null);
  const detailRichEditorRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  };

  const pulseSavedStatus = () => {
    setSaveLabel('Saving...');
    if (saveLabelTimerRef.current) clearTimeout(saveLabelTimerRef.current);
    saveLabelTimerRef.current = setTimeout(() => {
      setSaveLabel('Saved');
    }, 450);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (saveLabelTimerRef.current) clearTimeout(saveLabelTimerRef.current);
    };
  }, []);

  // Global Alt+S and Escape handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        openStickyNotes();
        return;
      }

      if (e.key === 'Escape' && isStickyNotesOpen && !isStickyNotesMinimized) {
        if (composerOpen) {
          e.preventDefault();
          setComposerOpen(false);
          setComposerError(null);
          return;
        }
        if (taskMenuOpen) {
          e.preventDefault();
          setTaskMenuOpen(false);
          return;
        }
        if (menuOpen) {
          e.preventDefault();
          setMenuOpen(false);
          return;
        }
        if (addingCategory) {
          e.preventDefault();
          setAddingCategory(false);
          setNewCategoryName('');
          return;
        }
        e.preventDefault();
        closeStickyNotes();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    addingCategory,
    closeStickyNotes,
    composerOpen,
    isStickyNotesMinimized,
    isStickyNotesOpen,
    menuOpen,
    openStickyNotes,
    taskMenuOpen,
  ]);

  // Close three-dots menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Close task menu when clicking outside or resizing window
  useEffect(() => {
    if (!taskMenuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        taskMenuRef.current?.contains(target) ||
        taskBtnRef.current?.contains(target)
      ) {
        return;
      }
      setTaskMenuOpen(false);
    };
    const handleResize = () => {
      setTaskMenuOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [taskMenuOpen]);

  // Reset task menu when leaving or changing detail target
  useEffect(() => {
    setTaskMenuOpen(false);
  }, [detailTarget?.id, detailTarget?.kind, isStickyNotesOpen, isStickyNotesMinimized]);

  // Live detail record lookup
  const activeDetailNote = useMemo(() => {
    if (!detailTarget || detailTarget.kind !== 'note') return undefined;
    return stickyNotes.find((n) => n.id === detailTarget.id);
  }, [detailTarget, stickyNotes]);

  const activeDetailJob = useMemo(() => {
    if (!detailTarget || detailTarget.kind !== 'job') return undefined;
    return jobs.find((j) => j.id === detailTarget.id);
  }, [detailTarget, jobs]);

  useEffect(() => {
    if (detailTarget?.kind === 'job' && activeDetailJob) {
      setDetailUrlDraft(activeDetailJob.sourceUrl || '');
      setDetailUrlError(null);
    } else {
      setDetailUrlDraft('');
      setDetailUrlError(null);
    }
  }, [activeDetailJob?.id, activeDetailJob?.sourceUrl, detailTarget?.id, detailTarget?.kind]);

  // Close detail view if the underlying Firestore document was deleted externally
  useEffect(() => {
    if (detailTarget?.kind === 'note' && !activeDetailNote) {
      setDetailTarget(null);
    } else if (detailTarget?.kind === 'job' && !activeDetailJob) {
      setDetailTarget(null);
    }
  }, [activeDetailJob, activeDetailNote, detailTarget]);

  // Keep contentEditable synchronized when opening or restoring a plain note in detail view
  useEffect(() => {
    if (
      isStickyNotesOpen &&
      !isStickyNotesMinimized &&
      detailTarget?.kind === 'note' &&
      activeDetailNote &&
      detailRichEditorRef.current
    ) {
      if (detailRichEditorRef.current.innerHTML !== activeDetailNote.body) {
        detailRichEditorRef.current.innerHTML = activeDetailNote.body || '';
      }
    }
  }, [
    activeDetailNote?.id,
    detailTarget?.id,
    detailTarget?.kind,
    isStickyNotesMinimized,
    isStickyNotesOpen,
  ]);

  // Combined unified feed (Jobs backed by users/{uid}/jobs + plain stickyNotes)
  const allEntries: FeedEntry[] = useMemo(() => {
    const noteEntries: FeedEntry[] = stickyNotes.map((note) => ({
      kind: 'note',
      id: note.id,
      sortKey: note.createdAt || '',
      note,
    }));
    const jobEntries: FeedEntry[] = jobs.map((job) => ({
      kind: 'job',
      id: job.id,
      sortKey: job.createdAt || '',
      job,
    }));
    return [...jobEntries, ...noteEntries].sort((a, b) =>
      b.sortKey.localeCompare(a.sortKey)
    );
  }, [jobs, stickyNotes]);

  const getCategoryCount = (cat: string): number => {
    if (cat === 'All') return allEntries.length;
    const lower = cat.toLowerCase();
    return allEntries.filter((entry) => {
      if (entry.kind === 'job') return lower === 'jobs';
      return (entry.note.category || '').toLowerCase() === lower;
    }).length;
  };

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allEntries.filter((entry) => {
      const entryCat = entry.kind === 'job' ? 'Jobs' : entry.note.category || '';
      const matchesCat =
        activeCategory === 'All' || entryCat.toLowerCase() === activeCategory.toLowerCase();
      if (!matchesCat) return false;
      if (!query) return true;

      if (entry.kind === 'job') {
        const j = entry.job;
        const statusText = getDisplayJobStatus(j);
        return (
          (j.jobTitle || '').toLowerCase().includes(query) ||
          (j.company || '').toLowerCase().includes(query) ||
          (j.sourceUrl || '').toLowerCase().includes(query) ||
          (j.jobDescription || '').toLowerCase().includes(query) ||
          statusText.toLowerCase().includes(query) ||
          'jobs'.includes(query)
        );
      }

      const n = entry.note;
      return (
        n.title.toLowerCase().includes(query) ||
        n.category.toLowerCase().includes(query) ||
        stripHtml(n.body).toLowerCase().includes(query)
      );
    });
  }, [activeCategory, allEntries, searchQuery]);

  const openComposerModal = () => {
    setMenuOpen(false);
    const defaultCat = activeCategory === 'All' ? 'Ideas' : activeCategory;
    setComposerTheme(defaultCat.toLowerCase() === 'jobs' ? 'blue' : 'purple');
    setComposerCategory(defaultCat);
    setComposerBanner('none');
    setComposerTitle('');
    setComposerBody('');
    setComposerJobUrl('');
    setComposerJobDesc('');
    setComposerCustomImage(null);
    setComposerUploadName('Attach custom image...');
    setComposerError(null);
    setComposerOpen(true);
    setTimeout(() => {
      if (defaultCat.toLowerCase() === 'jobs') {
        composerJobLinkInputRef.current?.focus();
      } else {
        composerTitleInputRef.current?.focus();
      }
    }, 50);
  };

  const closeComposerModal = () => {
    setComposerOpen(false);
    setComposerError(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = typeof ev.target?.result === 'string' ? ev.target.result : null;
      if (result) {
        if (result.length > 780000) {
          setComposerError('Attached image is too large (max ~550KB). Choose a smaller image.');
          showToast('Image too large — max ~550KB for cloud sync');
          return;
        }
        setComposerCustomImage(result);
        setComposerUploadName(file.name.slice(0, 22));
      }
    };
    reader.readAsDataURL(file);
  };

  const clearUploadedImage = () => {
    setComposerCustomImage(null);
    setComposerUploadName('Attach custom image...');
  };

  // Dedicated job request submission & validation function (Step 4)
  const submitJobRequest = () => {
    const validation = validateJobRequestInput({
      sourceUrl: composerJobUrl,
      jobDescription: composerJobDesc,
    });

    if (!validation.ok || !validation.jobStatus) {
      setComposerError(
        validation.error || 'Add a valid http(s) job link, a job description, or both.'
      );
      return;
    }

    const trimmedTitle = composerTitle.trim();
    addJob({
      company: '',
      jobTitle: trimmedTitle,
      sourceUrl: validation.sourceUrl,
      jobDescription: validation.jobDescription,
      jobStatus: validation.jobStatus,
      status: 'Saved',
      applicationDate: new Date().toISOString().slice(0, 10),
      department: '',
      companyAddress: '',
      hiringManager: '',
      requiredQualifications: [],
      preferredQualifications: [],
      responsibilities: [],
      technicalRequirements: [],
      noteCategory: 'Jobs',
      noteTheme: composerTheme,
      noteDate: getFormattedStickyDate(),
      noteBannerType: composerCustomImage ? 'none' : composerBanner,
      noteCustomImage: composerCustomImage,
      isNoteOnly: true,
    });

    setComposerError(null);
    setComposerOpen(false);
    setDetailTarget(null);
    showToast(`Added job request (${validation.jobStatus})`);
  };

  const handleComposerSave = () => {
    if (composerCategory.toLowerCase() === 'jobs') {
      submitJobRequest();
      return;
    }

    const title = composerTitle.trim() || 'Quick Note';
    const category = composerCategory.trim() || 'Note';
    const body = composerBody.trim() || DEFAULT_NOTE_PLACEHOLDER;

    addStickyNote({
      theme: composerTheme,
      category,
      date: getFormattedStickyDate(),
      bannerType: composerCustomImage ? 'none' : composerBanner,
      customImage: composerCustomImage,
      title,
      body: escapeHtml(body).replace(/\n/g, '<br>'),
    });

    setComposerError(null);
    setComposerOpen(false);
    showToast(`Added to ${category}`);
  };

  const triggerScreenshotCapture = () => {
    setMenuOpen(false);

    // Follow the same validation rule when active category is Jobs: block with message
    if (activeCategory.toLowerCase() === 'jobs') {
      showToast('Jobs notes require a link or description. Use "+ Note" to add a job request.');
      return;
    }

    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 260);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const targetCategory = activeCategory === 'All' ? 'Tips' : activeCategory;

    addStickyNote({
      theme: 'blue',
      category: targetCategory,
      date: getFormattedStickyDate(),
      bannerType: 'banner-snapshot',
      customImage: null,
      title: `Screen capture (${timeStr})`,
      body: 'Captured via Sticky Notes 1-click snip. Click to annotate or add details about this screen snapshot.',
    });

    if (detailTarget) {
      setDetailTarget(null);
    }
    showToast(`1-click screenshot saved to ${targetCategory}!`);
  };

  const handleConfirmAddCategory = () => {
    const raw = newCategoryName.trim();
    if (!raw) {
      setAddingCategory(false);
      setNewCategoryName('');
      return;
    }
    const added = addStickyCategory(raw);
    setActiveCategory(added);
    setAddingCategory(false);
    setNewCategoryName('');
    showToast(`Added "${added}" tab`);
  };

  const handleResetDemoNotes = () => {
    setMenuOpen(false);
    resetDemoStickyNotes();
    setActiveCategory('All');
    setDetailTarget(null);
    showToast('Restored default demo notes & tabs');
  };

  const handleFormatDoc = (cmd: string) => {
    if (!detailRichEditorRef.current || !activeDetailNote) return;
    detailRichEditorRef.current.focus();
    document.execCommand(cmd, false, undefined);
    const updatedHtml = detailRichEditorRef.current.innerHTML;
    updateStickyNote(activeDetailNote.id, (prev) => ({
      ...prev,
      body: updatedHtml,
    }));
    pulseSavedStatus();
  };

  const handleCopyDetail = () => {
    if (activeDetailJob) {
      const parts = [
        activeDetailJob.jobTitle || activeDetailJob.company || 'Job Request',
        activeDetailJob.sourceUrl || '',
        activeDetailJob.jobDescription || '',
      ].filter(Boolean);
      void navigator.clipboard?.writeText(parts.join('\n')).catch(() => {});
      showToast('Copied job note to clipboard');
      return;
    }
    if (activeDetailNote) {
      const text = `${activeDetailNote.title}\n${stripHtml(activeDetailNote.body)}`;
      void navigator.clipboard?.writeText(text).catch(() => {});
      showToast('Copied note to clipboard');
    }
  };

  const handleDeleteDetail = () => {
    if (activeDetailJob) {
      deleteJob(activeDetailJob.id);
      setDetailTarget(null);
      showToast('Job request deleted');
      return;
    }
    if (activeDetailNote) {
      deleteStickyNote(activeDetailNote.id);
      setDetailTarget(null);
      showToast('Sticky note deleted');
    }
  };

  if (!isStickyNotesOpen) {
    return null;
  }

  // Minimized state: render only non-blocking restore pill
  if (isStickyNotesMinimized) {
    return (
      <button
        type="button"
        onClick={restoreStickyNotes}
        aria-label="Restore Sticky Notes"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#242424] border border-[#3d3d3d] shadow-2xl hover:bg-[#2f2f2f] transition-all duration-200 cursor-pointer"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#FCD116" />
          <path d="M14 21L21 14H15.5C14.6716 14 14 14.6716 14 15.5V21Z" fill="#9B4F96" />
        </svg>
        <span className="text-sm font-medium text-gray-100">Sticky Notes</span>
      </button>
    );
  }

  const isJobsComposer = composerCategory.toLowerCase() === 'jobs';

  const activeDetailTheme = activeDetailJob
    ? STICKY_NOTE_THEMES[activeDetailJob.noteTheme || 'blue'] || STICKY_NOTE_THEMES.blue
    : activeDetailNote
      ? STICKY_NOTE_THEMES[activeDetailNote.theme] || STICKY_NOTE_THEMES.purple
      : STICKY_NOTE_THEMES.purple;

  const handleToggleTaskMenu = () => {
    if (taskMenuOpen) {
      setTaskMenuOpen(false);
      return;
    }

    const winRect = windowRef.current?.getBoundingClientRect();
    const btnRect = taskBtnRef.current?.getBoundingClientRect();
    const menuWidth = 188;
    const gap = 10;

    if (winRect && btnRect && window.innerWidth - winRect.right >= menuWidth + gap + 8) {
      setTaskMenuPlacement('right');
      setTaskMenuCoords({
        left: winRect.right + gap,
        top: Math.max(16, Math.min(btnRect.top - 4, window.innerHeight - 190)),
      });
    } else {
      setTaskMenuPlacement('inside');
    }
    setTaskMenuOpen(true);
  };

  const handleSelectJobTask = (task: JobTaskType) => {
    if (!activeDetailJob) return;
    queueJobTask(activeDetailJob.id, task);
    setTaskMenuOpen(false);
    pulseSavedStatus();
    showToast(`Queued "${TASK_FULL_LABELS[task]}" AI task`);
  };

  const renderTaskMenuItems = (job: JobApplication) => (
    <div className="py-1.5">
      <div className="px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-white/50">
        AI Builder Task
      </div>
      {(
        [
          { id: 'resume', label: 'Resume' },
          { id: 'cover_letter', label: 'Cover letter' },
          { id: 'both', label: 'Both' },
        ] as Array<{ id: JobTaskType; label: string }>
      ).map((option) => {
        const isSelected = job.selectedTask === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => handleSelectJobTask(option.id)}
            className={`w-full px-3 py-1.5 text-left text-[12.5px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
              isSelected
                ? 'bg-[#c58af9]/20 text-[#ead6ff] font-medium'
                : 'text-[#efefef] hover:bg-white/[0.08]'
            }`}
          >
            <span>{option.label}</span>
            {isSelected && (
              <span className="text-[10px] text-[#c58af9]">Selected</span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px] flex items-center justify-center p-0 min-[480px]:p-6"
      role="presentation"
    >
      <main
        ref={windowRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sticky Notes"
        className="relative w-full max-w-full min-[480px]:max-w-[404px] h-full min-[480px]:h-[88vh] min-[480px]:max-h-[840px] min-[480px]:min-h-[580px] bg-[#202020] border border-[#353535] rounded-none min-[480px]:rounded-[12px] shadow-[0_24px_64px_rgba(0,0,0,0.68),0_0_0_1px_rgba(255,255,255,0.04)] flex flex-col overflow-hidden text-white font-sans"
      >
        {/* 1. Windows 11 Title Bar */}
        <header className="h-11 px-3.5 flex items-center justify-between select-none shrink-0 bg-[#202020]">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="snWinYellow" x1="2" y1="2" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFE054" />
                    <stop offset="100%" stopColor="#F5B800" />
                  </linearGradient>
                  <linearGradient id="snWinPurple" x1="13" y1="13" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#A855F7" />
                    <stop offset="100%" stopColor="#6B21A8" />
                  </linearGradient>
                </defs>
                <path
                  d="M3 5.5C3 4.11929 4.11929 3 5.5 3H18.5C19.8807 3 21 4.11929 21 5.5V14L14 21H5.5C4.11929 21 3 19.8807 3 18.5V5.5Z"
                  fill="url(#snWinYellow)"
                />
                <path d="M14 21L21 14H16C14.8954 14 14 14.8954 14 16V21Z" fill="url(#snWinPurple)" />
              </svg>
            </div>
            <span className="text-[13px] font-normal text-[#e6e6e6] tracking-[-0.01em]">
              Sticky Notes
            </span>
          </div>

          <div className="flex items-center">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                title="More options"
                aria-label="More options"
                className="w-9 h-8 rounded-[6px] flex items-center justify-center text-[#d4d4d4] hover:bg-white/[0.07] active:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="3.2" cy="8" r="1.15" />
                  <circle cx="8" cy="8" r="1.15" />
                  <circle cx="12.8" cy="8" r="1.15" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-9 w-52 bg-[#2c2c2c] border border-[#424242] rounded-[8px] shadow-2xl py-1.5 z-50 text-[13px] text-[#efefef]">
                  <button
                    type="button"
                    onClick={openComposerModal}
                    className="w-full px-3.5 py-2 text-left hover:bg-white/[0.08] flex items-center gap-2.5 cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span>New sticky note</span>
                  </button>
                  <button
                    type="button"
                    onClick={triggerScreenshotCapture}
                    className="w-full px-3.5 py-2 text-left hover:bg-white/[0.08] flex items-center gap-2.5 cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>Quick screenshot note</span>
                  </button>
                  <div className="my-1 border-t border-white/10" />
                  <button
                    type="button"
                    onClick={handleResetDemoNotes}
                    className="w-full px-3.5 py-2 text-left hover:bg-white/[0.08] text-purple-300 flex items-center gap-2.5 cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    <span>Reset Demo Notes</span>
                  </button>
                </div>
              )}
            </div>

            <div className="w-[1px] h-4 bg-[#383838] mx-1.5" />

            <button
              type="button"
              onClick={minimizeStickyNotes}
              title="Minimize"
              aria-label="Minimize Sticky Notes"
              className="w-10 h-8 rounded-[6px] flex items-center justify-center text-[#d4d4d4] hover:bg-white/[0.07] transition-colors cursor-pointer"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                <line x1="1.5" y1="6" x2="10.5" y2="6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={closeStickyNotes}
              title="Close"
              aria-label="Close Sticky Notes"
              className="w-10 h-8 rounded-[6px] flex items-center justify-center text-[#d4d4d4] hover:bg-[#c42b1c] hover:text-white transition-colors cursor-pointer"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            </button>
          </div>
        </header>

        {/* VIEW 1: NOTES LIST */}
        {!detailTarget && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar: + Note & Screenshot */}
            <div className="px-4 pt-1.5 pb-2.5 grid grid-cols-2 gap-2.5 shrink-0">
              <button
                type="button"
                onClick={openComposerModal}
                className="h-[42px] px-3 rounded-[8px] bg-[#2b2b2b] hover:bg-[#343434] active:bg-[#262626] border border-[#3d3d3d] flex items-center justify-center gap-2 text-[13.5px] font-medium text-white transition-all duration-150 shadow-sm cursor-pointer"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="8" y1="2.5" x2="8" y2="13.5" />
                  <line x1="2.5" y1="8" x2="13.5" y2="8" />
                </svg>
                <span>Note</span>
              </button>

              <button
                type="button"
                onClick={triggerScreenshotCapture}
                className="h-[42px] px-3 rounded-[8px] bg-[#2b2b2b] hover:bg-[#343434] active:bg-[#262626] border border-[#3d3d3d] flex items-center justify-center gap-2 text-[13.5px] font-medium text-white transition-all duration-150 shadow-sm cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M2.5 6V4C2.5 3.17157 3.17157 2.5 4 2.5H6" />
                  <path d="M12 2.5H14C14.8284 2.5 15.5 3.17157 15.5 4V6" />
                  <path d="M15.5 12V14C15.5 14.8284 14.8284 15.5 14 15.5H12" />
                  <path d="M6 15.5H4C3.17157 15.5 2.5 14.8284 2.5 14V12" />
                  <rect x="5.5" y="5.5" width="7" height="7" rx="1.5" strokeWidth="1.3" />
                </svg>
                <span>Screenshot</span>
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="px-4 pb-2 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {['All', ...stickyCategories].map((cat) => {
                  const isActive = activeCategory === cat;
                  const count = getCategoryCount(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`shrink-0 h-[28px] px-3 rounded-full text-[12px] font-medium flex items-center gap-1.5 border transition-all duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-[#c58af9]/20 border-[#c58af9] text-[#ead6ff] shadow-sm'
                          : 'bg-[#2b2b2b] border-[#3a3a3a] text-[#c7c7c7] hover:bg-[#343434] hover:text-white'
                      }`}
                    >
                      <span>{cat}</span>
                      <span
                        className={`text-[10.5px] px-1.5 py-[1px] rounded-full ${
                          isActive ? 'bg-[#c58af9]/25 text-[#f3e8ff]' : 'bg-white/[0.07] text-[#9e9e9e]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setAddingCategory(true);
                    setTimeout(() => newCategoryInputRef.current?.focus(), 20);
                  }}
                  title="Add custom category"
                  aria-label="Add custom category"
                  className="shrink-0 w-[28px] h-[28px] rounded-full bg-[#2b2b2b] hover:bg-[#363636] border border-[#3a3a3a] text-[#d4d4d4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <line x1="8" y1="3" x2="8" y2="13" />
                    <line x1="3" y1="8" x2="13" y2="8" />
                  </svg>
                </button>
              </div>

              {addingCategory && (
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    ref={newCategoryInputRef}
                    type="text"
                    maxLength={20}
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmAddCategory();
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setAddingCategory(false);
                        setNewCategoryName('');
                      }
                    }}
                    placeholder="New category name..."
                    className="flex-1 h-8 px-2.5 rounded-[7px] bg-[#2b2b2b] border border-[#454545] focus:border-[#c58af9] focus:outline-none text-[12px] text-white placeholder-[#8e8e8e]"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmAddCategory}
                    className="h-8 px-2.5 rounded-[7px] bg-[#c58af9] hover:bg-[#d2a1fb] text-[#1c1326] font-semibold text-[11.5px] transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCategory(false);
                      setNewCategoryName('');
                    }}
                    className="h-8 px-2 rounded-[7px] bg-[#2b2b2b] hover:bg-[#353535] text-gray-300 text-[11.5px] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Section Header & Expandable Search */}
            <div className="px-4 pb-2.5 shrink-0">
              <div className="flex items-center justify-between h-8">
                <span className="text-[13px] font-normal text-[#d4d4d4]">
                  {activeCategory === 'All' ? 'Recent notes' : `${activeCategory} notes`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (searchOpen) {
                      setSearchQuery('');
                      setSearchOpen(false);
                    } else {
                      setSearchOpen(true);
                      setTimeout(() => searchInputRef.current?.focus(), 20);
                    }
                  }}
                  title="Search notes"
                  aria-label="Search notes"
                  className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#cccccc] hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <circle cx="7" cy="7" r="4.8" />
                    <line x1="10.6" y1="10.6" x2="14" y2="14" />
                  </svg>
                </button>
              </div>

              {searchOpen && (
                <div className="mt-1.5 relative flex items-center">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, tag, link, or content..."
                    className="w-full h-9 pl-3 pr-8 rounded-[7px] bg-[#2b2b2b] border border-[#454545] focus:border-[#c58af9] focus:outline-none text-[13px] text-white placeholder-[#8e8e8e]"
                  />
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                    className="absolute right-2 text-[#9e9e9e] hover:text-white p-1 cursor-pointer"
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="3" y1="3" x2="11" y2="11" />
                      <line x1="11" y1="3" x2="3" y2="11" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable Notes Feed */}
            <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-3.5">
              {filteredEntries.length === 0 ? (
                <div className="py-16 px-4 text-center text-[#9e9e9e]">
                  <p className="text-[13.5px] mb-1">No notes in {activeCategory}</p>
                  <p className="text-[12px] text-[#757575]">
                    Click &quot;+ Note&quot; above to create one in this category.
                  </p>
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  if (entry.kind === 'job') {
                    const job = entry.job;
                    const theme = STICKY_NOTE_THEMES[job.noteTheme || 'blue'] || STICKY_NOTE_THEMES.blue;
                    const displayStatus = getDisplayJobStatus(job);
                    const badgeClass =
                      JOB_STATUS_BADGE_STYLES[displayStatus] ||
                      'bg-white/15 text-white border-white/25';
                    const displayTitle =
                      job.jobTitle ||
                      job.company ||
                      (job.sourceUrl ? 'Job Request' : 'Untitled Job');
                    const hasBanner =
                      Boolean(job.noteCustomImage) ||
                      (Boolean(job.noteBannerType) && job.noteBannerType !== 'none');

                    return (
                      <article
                        key={`job-${job.id}`}
                        onClick={() => setDetailTarget({ kind: 'job', id: job.id })}
                        style={{ backgroundColor: theme.bg }}
                        className="group relative rounded-[10px] overflow-hidden cursor-pointer shadow-[0_4px_14px_rgba(0,0,0,0.28)] hover:brightness-105 transition-all duration-150"
                      >
                        <div style={{ backgroundColor: theme.accent }} className="h-[4px] w-full" />
                        <div className="px-3.5 pt-2.5 pb-3.5">
                          <div className="flex items-center justify-between gap-2 text-[12px] text-white/85 mb-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-normal tracking-[0.01em] shrink-0">Jobs</span>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border truncate ${badgeClass}`}
                              >
                                {displayStatus}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="hidden group-hover:flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                                {Object.values(STICKY_NOTE_THEMES).map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateJob(job.id, (prev) => ({
                                        ...prev,
                                        noteTheme: t.id,
                                      }));
                                    }}
                                    title={t.name}
                                    style={{ backgroundColor: t.accent }}
                                    className={`w-3.5 h-3.5 rounded-full border border-black/30 hover:scale-125 transition-transform cursor-pointer ${
                                      (job.noteTheme || 'blue') === t.id ? 'ring-2 ring-white' : ''
                                    }`}
                                  />
                                ))}
                                <span className="w-[1px] h-3 bg-white/20 mx-0.5" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteJob(job.id);
                                    showToast('Job request removed');
                                  }}
                                  title="Delete job request"
                                  className="text-white/80 hover:text-red-300 transition-colors cursor-pointer"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                              <span className="text-white/80 group-hover:hidden text-[12px]">
                                {job.noteDate || formatDateFromIso(job.createdAt)}
                              </span>
                            </div>
                          </div>

                          {job.noteCustomImage ? (
                            <div className="mb-3 rounded-[7px] overflow-hidden bg-black/20">
                              <img
                                src={job.noteCustomImage}
                                alt={displayTitle}
                                className="w-full h-[126px] object-cover block"
                              />
                            </div>
                          ) : hasBanner ? (
                            <div className="mb-3 rounded-[7px] overflow-hidden shadow-sm">
                              <StickyNoteBannerSvg type={job.noteBannerType} />
                            </div>
                          ) : null}

                          <h2 className="text-[14.5px] font-bold text-white leading-[1.3] mb-1 tracking-[-0.01em]">
                            {displayTitle}
                          </h2>

                          {job.sourceUrl && (
                            <p className="text-[11.5px] font-mono text-white/75 truncate mb-1 select-text">
                              {job.sourceUrl}
                            </p>
                          )}

                          <p className="text-[13px] text-white/85 leading-[1.42] line-clamp-2">
                            {job.jobDescription?.trim()
                              ? job.jobDescription
                              : 'Link saved — no description added yet.'}
                          </p>

                          {job.taskStatus && job.taskStatus !== 'idle' && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  TASK_STATUS_BADGE_STYLES[job.taskStatus] ||
                                  'bg-white/15 text-white border-white/25'
                                }`}
                              >
                                {job.selectedTask
                                  ? `${TASK_SHORT_LABELS[job.selectedTask]} · ${job.taskStatus}`
                                  : job.taskStatus}
                              </span>
                              {job.taskStatus === 'failed' && job.taskReason && (
                                <span className="text-[11px] text-rose-200 truncate">
                                  {job.taskReason}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  }

                  const note = entry.note;
                  const theme = STICKY_NOTE_THEMES[note.theme] || STICKY_NOTE_THEMES.purple;
                  const hasBanner =
                    Boolean(note.customImage) ||
                    (Boolean(note.bannerType) && note.bannerType !== 'none');

                  return (
                    <article
                      key={`note-${note.id}`}
                      onClick={() => setDetailTarget({ kind: 'note', id: note.id })}
                      style={{ backgroundColor: theme.bg }}
                      className="group relative rounded-[10px] overflow-hidden cursor-pointer shadow-[0_4px_14px_rgba(0,0,0,0.28)] hover:brightness-105 transition-all duration-150"
                    >
                      <div style={{ backgroundColor: theme.accent }} className="h-[4px] w-full" />
                      <div className="px-3.5 pt-2.5 pb-3.5">
                        <div className="flex items-center justify-between text-[12px] text-white/85 mb-2.5">
                          <span className="font-normal tracking-[0.01em]">
                            {note.category || 'Note'}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="hidden group-hover:flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                              {Object.values(STICKY_NOTE_THEMES).map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStickyNote(note.id, (prev) => ({
                                      ...prev,
                                      theme: t.id,
                                    }));
                                  }}
                                  title={t.name}
                                  style={{ backgroundColor: t.accent }}
                                  className={`w-3.5 h-3.5 rounded-full border border-black/30 hover:scale-125 transition-transform cursor-pointer ${
                                    note.theme === t.id ? 'ring-2 ring-white' : ''
                                  }`}
                                />
                              ))}
                              <span className="w-[1px] h-3 bg-white/20 mx-0.5" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteStickyNote(note.id);
                                  showToast('Note removed');
                                }}
                                title="Delete note"
                                className="text-white/80 hover:text-red-300 transition-colors cursor-pointer"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                            <span className="text-white/80 group-hover:hidden text-[12px]">
                              {note.date}
                            </span>
                          </div>
                        </div>

                        {note.customImage ? (
                          <div className="mb-3 rounded-[7px] overflow-hidden bg-black/20">
                            <img
                              src={note.customImage}
                              alt={note.title}
                              className="w-full h-[126px] object-cover block"
                            />
                          </div>
                        ) : hasBanner ? (
                          <div className="mb-3 rounded-[7px] overflow-hidden shadow-sm">
                            <StickyNoteBannerSvg type={note.bannerType} />
                          </div>
                        ) : null}

                        <h2 className="text-[14.5px] font-bold text-white leading-[1.3] mb-1 tracking-[-0.01em]">
                          {note.title || 'Untitled note'}
                        </h2>

                        <p className="text-[13px] text-white/85 leading-[1.42] line-clamp-2">
                          {stripHtml(note.body)}
                        </p>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: EXPANDED NOTE / JOB REQUEST DETAIL VIEW */}
        {detailTarget && (activeDetailJob || activeDetailNote) && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#202020]">
            {/* Detail Top Bar */}
            <div className="px-3.5 py-2 flex items-center justify-between border-b border-white/[0.07] shrink-0">
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[13px] text-[#e0e0e0] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M10 3L5 8l5 5" />
                </svg>
                <span>Recent notes</span>
              </button>

              <div className="flex items-center gap-1.5">
                {Object.values(STICKY_NOTE_THEMES).map((t) => {
                  const currentTheme = activeDetailJob
                    ? activeDetailJob.noteTheme || 'blue'
                    : activeDetailNote?.theme || 'purple';
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (activeDetailJob) {
                          updateJob(activeDetailJob.id, (prev) => ({ ...prev, noteTheme: t.id }));
                        } else if (activeDetailNote) {
                          updateStickyNote(activeDetailNote.id, (prev) => ({ ...prev, theme: t.id }));
                        }
                      }}
                      title={t.name}
                      style={{ backgroundColor: t.accent }}
                      className={`w-4 h-4 rounded-full border border-black/40 hover:scale-110 transition-transform cursor-pointer ${
                        currentTheme === t.id ? 'ring-2 ring-white' : ''
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyDetail}
                  title="Copy note text"
                  className="p-1.5 rounded-[6px] text-[#cccccc] hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDetail}
                  title="Delete note"
                  className="p-1.5 rounded-[6px] text-[#cccccc] hover:bg-red-500/20 hover:text-red-300 transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Detail Surface */}
            <div className="flex-1 overflow-y-auto p-4">
              <div
                style={{ backgroundColor: activeDetailTheme.bg }}
                className="rounded-[10px] overflow-hidden shadow-lg transition-colors duration-200 flex flex-col min-h-full"
              >
                <div
                  style={{ backgroundColor: activeDetailTheme.accent }}
                  className="h-[4px] w-full"
                />

                {activeDetailJob ? (
                  <>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2 text-[12px] text-white/80 mb-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="bg-black/25 border border-white/15 rounded-[6px] px-2 py-1 text-[12px] font-medium text-white shrink-0">
                            Jobs
                          </span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium border truncate ${
                              JOB_STATUS_BADGE_STYLES[getDisplayJobStatus(activeDetailJob)] ||
                              'bg-white/15 text-white border-white/25'
                            }`}
                          >
                            {getDisplayJobStatus(activeDetailJob)}
                          </span>
                        </div>

                        {/* Three small AI task buttons in the empty strip between category/status and date (Jobs notes only) */}
                        <div className="relative flex items-center gap-1 shrink-0">
                          <button
                            ref={taskBtnRef}
                            type="button"
                            onClick={handleToggleTaskMenu}
                            title={
                              activeDetailJob.selectedTask
                                ? `AI Builder: ${TASK_FULL_LABELS[activeDetailJob.selectedTask]}${
                                    activeDetailJob.taskStatus && activeDetailJob.taskStatus !== 'idle'
                                      ? ` (${activeDetailJob.taskStatus})`
                                      : ''
                                  }`
                                : 'Open resume and cover letter builder menu'
                            }
                            aria-label={
                              activeDetailJob.selectedTask
                                ? `AI Builder (${TASK_FULL_LABELS[activeDetailJob.selectedTask]})`
                                : 'AI Builder'
                            }
                            aria-expanded={taskMenuOpen}
                            className={`h-6 px-1.5 rounded-[5px] border flex items-center gap-1 text-[11px] transition-colors cursor-pointer ${
                              taskMenuOpen || activeDetailJob.selectedTask
                                ? 'bg-black/40 border-white/40 text-white'
                                : 'bg-black/25 hover:bg-black/40 border-white/20 text-white/90'
                            }`}
                          >
                            <span aria-hidden="true" className="text-[12px] leading-none">
                              📄
                            </span>
                            {activeDetailJob.selectedTask && (
                              <span className="text-[10px] font-medium leading-none">
                                {TASK_SHORT_LABELS[activeDetailJob.selectedTask]}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled
                            aria-label="Future AI task placeholder 1"
                            className="w-6 h-6 rounded-[5px] bg-black/15 border border-white/15 opacity-45 cursor-not-allowed"
                          />

                          <button
                            type="button"
                            disabled
                            aria-label="Future AI task placeholder 2"
                            className="w-6 h-6 rounded-[5px] bg-black/15 border border-white/15 opacity-45 cursor-not-allowed"
                          />

                          {taskMenuOpen && taskMenuPlacement === 'inside' && (
                            <div
                              ref={taskMenuRef}
                              role="menu"
                              aria-label="AI Builder tasks"
                              className="absolute right-0 top-7 w-44 bg-[#2c2c2c] border border-[#444444] rounded-[8px] shadow-2xl z-50"
                            >
                              {renderTaskMenuItems(activeDetailJob)}
                            </div>
                          )}
                        </div>

                        <span className="text-white/80 shrink-0">
                          {activeDetailJob.noteDate || formatDateFromIso(activeDetailJob.createdAt)}
                        </span>
                      </div>

                      {activeDetailJob.taskStatus && activeDetailJob.taskStatus !== 'idle' && (
                        <div
                          className={`mb-3 px-2.5 py-1.5 rounded-[6px] border text-[11.5px] flex items-start justify-between gap-2 ${
                            TASK_STATUS_BADGE_STYLES[activeDetailJob.taskStatus] ||
                            'bg-black/25 border-white/15 text-white/85'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-semibold capitalize">
                              Task {activeDetailJob.taskStatus}
                            </span>
                            {activeDetailJob.selectedTask && (
                              <span className="opacity-85">
                                {' '}
                                · {TASK_FULL_LABELS[activeDetailJob.selectedTask]}
                              </span>
                            )}
                            {activeDetailJob.taskStatus === 'failed' && activeDetailJob.taskReason && (
                              <p className="mt-0.5 text-[11px] text-rose-100 break-words">
                                {activeDetailJob.taskReason}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {activeDetailJob.noteCustomImage ? (
                        <div className="mb-3.5 rounded-[8px] overflow-hidden">
                          <img
                            src={activeDetailJob.noteCustomImage}
                            alt={activeDetailJob.jobTitle || 'Attached snapshot'}
                            className="w-full max-h-44 object-cover rounded-[7px]"
                          />
                        </div>
                      ) : activeDetailJob.noteBannerType &&
                        activeDetailJob.noteBannerType !== 'none' ? (
                        <div className="mb-3.5 rounded-[8px] overflow-hidden">
                          <StickyNoteBannerSvg type={activeDetailJob.noteBannerType} />
                        </div>
                      ) : null}

                      <input
                        type="text"
                        value={activeDetailJob.jobTitle}
                        onChange={(e) => {
                          const nextTitle = e.target.value;
                          updateJob(activeDetailJob.id, (prev) => ({
                            ...prev,
                            jobTitle: nextTitle,
                          }));
                          pulseSavedStatus();
                        }}
                        placeholder="Job title (optional)..."
                        className="w-full bg-transparent text-[17px] font-bold text-white focus:outline-none mb-2 placeholder-white/40"
                      />

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="sn-detail-job-link" className="text-[11px] text-white/65">
                            Job link
                          </label>
                          {activeDetailJob.sourceUrl && (
                            <span className="text-[10.5px] text-white/60 font-mono truncate max-w-[200px]">
                              Saved
                            </span>
                          )}
                        </div>
                        <input
                          id="sn-detail-job-link"
                          type="url"
                          value={detailUrlDraft}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setDetailUrlDraft(raw);
                            const trimmed = raw.trim();
                            if (!trimmed) {
                              if (!activeDetailJob.jobDescription.trim()) {
                                setDetailUrlError('Keep a link or description so this job note is not empty.');
                                return;
                              }
                              setDetailUrlError(null);
                              updateJob(activeDetailJob.id, (prev) => ({
                                ...prev,
                                sourceUrl: undefined,
                              }));
                              pulseSavedStatus();
                              return;
                            }
                            if (!isValidHttpUrl(trimmed)) {
                              setDetailUrlError('Enter a valid URL starting with http:// or https://');
                              return;
                            }
                            setDetailUrlError(null);
                            updateJob(activeDetailJob.id, (prev) => ({
                              ...prev,
                              sourceUrl: trimmed,
                              jobStatus:
                                prev.jobStatus ||
                                (prev.jobDescription.trim() ? 'ready_for_tailoring' : 'needs_extraction'),
                            }));
                            pulseSavedStatus();
                          }}
                          placeholder="https://company.com/careers/role"
                          className="w-full px-2.5 py-1.5 rounded-[6px] bg-black/25 border border-white/15 focus:border-white/40 focus:outline-none text-[12px] font-mono text-white/95 placeholder-white/40"
                        />
                        {detailUrlError && (
                          <p className="mt-1 text-[11px] text-rose-200">{detailUrlError}</p>
                        )}
                      </div>

                      <label className="text-[11px] text-white/65 mb-1">
                        Job description
                      </label>
                      <textarea
                        value={activeDetailJob.jobDescription}
                        onChange={(e) => {
                          const nextDesc = e.target.value;
                          const trimmed = nextDesc.trim();
                          const hasDesc =
                            trimmed.length > 0 && trimmed !== DEFAULT_NOTE_PLACEHOLDER;
                          updateJob(activeDetailJob.id, (prev) => {
                            let nextStatus = prev.jobStatus;
                            if (
                              hasDesc &&
                              (!prev.jobStatus ||
                                prev.jobStatus === 'needs_extraction' ||
                                prev.jobStatus === 'needs_manual_input')
                            ) {
                              nextStatus = 'ready_for_tailoring';
                            } else if (
                              !hasDesc &&
                              prev.sourceUrl &&
                              prev.jobStatus === 'ready_for_tailoring'
                            ) {
                              nextStatus = 'needs_extraction';
                            }
                            return {
                              ...prev,
                              jobDescription: nextDesc,
                              jobStatus: nextStatus,
                            };
                          });
                          pulseSavedStatus();
                        }}
                        placeholder="Paste or edit the full job description..."
                        className="flex-1 min-h-[200px] w-full bg-black/15 border border-white/10 rounded-[7px] p-2.5 text-[13.5px] leading-[1.55] text-white/95 placeholder-white/40 focus:outline-none focus:border-white/35 resize-none"
                      />
                    </div>

                    <div className="px-3 py-2 bg-black/20 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[11px] text-white/60">
                        Synced with Job Tracker
                      </span>
                      <span className="text-[11px] text-white/55">{saveLabel}</span>
                    </div>
                  </>
                ) : activeDetailNote ? (
                  <>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center justify-between text-[12px] text-white/80 mb-3">
                        <div className="relative inline-flex items-center">
                          <select
                            value={activeDetailNote.category}
                            onChange={(e) => {
                              const nextCat = e.target.value || 'Tips';
                              updateStickyNote(activeDetailNote.id, (prev) => ({
                                ...prev,
                                category: nextCat,
                              }));
                              pulseSavedStatus();
                            }}
                            className="appearance-none bg-black/25 hover:bg-black/35 border border-white/15 rounded-[6px] pl-2.5 pr-6 py-1 text-[12px] font-medium text-white focus:outline-none focus:border-white/40 cursor-pointer transition-colors"
                          >
                            {Array.from(
                              new Set([...stickyCategories, activeDetailNote.category || 'Tips'])
                            ).map((c) => (
                              <option key={c} value={c} className="bg-[#262626] text-white">
                                {c}
                              </option>
                            ))}
                          </select>
                          <svg
                            className="pointer-events-none absolute right-2 text-white/75"
                            width="11"
                            height="11"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M4 6l4 4 4-4" />
                          </svg>
                        </div>
                        <span className="text-white/80">{activeDetailNote.date}</span>
                      </div>

                      {activeDetailNote.customImage ? (
                        <div className="mb-3.5 rounded-[8px] overflow-hidden">
                          <img
                            src={activeDetailNote.customImage}
                            alt={activeDetailNote.title}
                            className="w-full max-h-44 object-cover rounded-[7px]"
                          />
                        </div>
                      ) : activeDetailNote.bannerType &&
                        activeDetailNote.bannerType !== 'none' ? (
                        <div className="mb-3.5 rounded-[8px] overflow-hidden">
                          <StickyNoteBannerSvg type={activeDetailNote.bannerType} />
                        </div>
                      ) : null}

                      <input
                        type="text"
                        value={activeDetailNote.title}
                        onChange={(e) => {
                          const nextTitle = e.target.value;
                          updateStickyNote(activeDetailNote.id, (prev) => ({
                            ...prev,
                            title: nextTitle,
                          }));
                          pulseSavedStatus();
                        }}
                        placeholder="Note title..."
                        className="w-full bg-transparent text-[17px] font-bold text-white focus:outline-none mb-2 placeholder-white/40"
                      />

                      <div
                        ref={detailRichEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => {
                          const nextHtml = e.currentTarget.innerHTML;
                          updateStickyNote(activeDetailNote.id, (prev) => ({
                            ...prev,
                            body: nextHtml,
                          }));
                          pulseSavedStatus();
                        }}
                        data-placeholder="Take a note..."
                        className="flex-1 min-h-[160px] text-[13.5px] leading-[1.55] text-white/90 focus:outline-none whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-white/40"
                      />
                    </div>

                    <div className="px-3 py-2 bg-black/20 border-t border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleFormatDoc('bold')}
                          title="Bold"
                          className="w-7 h-7 rounded hover:bg-white/15 flex items-center justify-center font-bold text-xs text-white cursor-pointer"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFormatDoc('italic')}
                          title="Italic"
                          className="w-7 h-7 rounded hover:bg-white/15 flex items-center justify-center italic font-serif text-sm text-white cursor-pointer"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFormatDoc('underline')}
                          title="Underline"
                          className="w-7 h-7 rounded hover:bg-white/15 flex items-center justify-center underline text-xs text-white cursor-pointer"
                        >
                          U
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFormatDoc('insertUnorderedList')}
                          title="Bulleted list"
                          className="w-7 h-7 rounded hover:bg-white/15 flex items-center justify-center text-white cursor-pointer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <circle cx="4" cy="6" r="1" />
                            <circle cx="4" cy="12" r="1" />
                            <circle cx="4" cy="18" r="1" />
                          </svg>
                        </button>
                      </div>
                      <span className="text-[11px] text-white/55">{saveLabel}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* INLINE COMPOSER MODAL (+ Note) */}
        {composerOpen && (
          <div className="absolute inset-0 z-40 bg-black/65 backdrop-blur-[2px] flex items-end min-[480px]:items-center justify-center p-3">
            <div className="w-full max-h-full overflow-y-auto bg-[#262626] border border-[#3e3e3e] rounded-[12px] shadow-2xl">
              <div
                style={{ backgroundColor: STICKY_NOTE_THEMES[composerTheme].accent }}
                className="h-[4px] w-full transition-colors"
              />

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[14px] font-semibold text-white">
                    {isJobsComposer ? 'New Job Request' : 'New Sticky Note'}
                  </h3>
                  <button
                    type="button"
                    onClick={closeComposerModal}
                    aria-label="Close composer"
                    className="text-gray-400 hover:text-white p-1 rounded cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="3" y1="3" x2="11" y2="11" />
                      <line x1="11" y1="3" x2="3" y2="11" />
                    </svg>
                  </button>
                </div>

                {/* Theme Picker */}
                <div className="mb-3">
                  <label className="block text-[11.5px] text-gray-400 mb-1.5">Note color</label>
                  <div className="flex items-center gap-2">
                    {Object.values(STICKY_NOTE_THEMES).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setComposerTheme(t.id)}
                        title={t.name}
                        style={{ backgroundColor: t.accent }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                          composerTheme === t.id
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-[#262626]'
                            : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Category & Banner */}
                <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                  <div>
                    <label htmlFor="sn-composer-cat" className="block text-[11.5px] text-gray-400 mb-1">
                      Category
                    </label>
                    <select
                      id="sn-composer-cat"
                      value={composerCategory}
                      onChange={(e) => {
                        const nextCat = e.target.value;
                        setComposerCategory(nextCat);
                        setComposerError(null);
                        if (nextCat.toLowerCase() === 'jobs') {
                          setComposerTheme('blue');
                        }
                      }}
                      className="w-full h-8 px-2 rounded-[6px] bg-[#1e1e1e] border border-[#3b3b3b] focus:border-[#c58af9] focus:outline-none text-[12.5px] text-white"
                    >
                      {stickyCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sn-composer-banner" className="block text-[11.5px] text-gray-400 mb-1">
                      Header graphic
                    </label>
                    <select
                      id="sn-composer-banner"
                      value={composerBanner}
                      onChange={(e) => setComposerBanner(e.target.value)}
                      className="w-full h-8 px-2 rounded-[6px] bg-[#1e1e1e] border border-[#3b3b3b] focus:border-[#c58af9] focus:outline-none text-[12.5px] text-white"
                    >
                      <option value="none">None (Text only)</option>
                      <option value="banner-screenshot">1-Click Capture Graphic</option>
                      <option value="banner-source">Source Link Graphic</option>
                      <option value="banner-shortcut">Shortcut Graphic</option>
                      <option value="banner-snapshot">Desktop Snapshot</option>
                    </select>
                  </div>
                </div>

                {isJobsComposer ? (
                  <>
                    <div className="mb-2.5">
                      <label htmlFor="sn-job-link" className="block text-[11.5px] text-gray-400 mb-1">
                        Job link
                      </label>
                      <input
                        id="sn-job-link"
                        ref={composerJobLinkInputRef}
                        type="url"
                        value={composerJobUrl}
                        onChange={(e) => {
                          setComposerJobUrl(e.target.value);
                          if (composerError) setComposerError(null);
                        }}
                        placeholder="https://company.com/careers/role"
                        className="w-full h-9 px-3 rounded-[6px] bg-[#1e1e1e] border border-[#3b3b3b] focus:border-[#8ab4f8] focus:outline-none text-[13px] text-white placeholder-gray-500"
                      />
                    </div>

                    <div className="mb-2">
                      <label htmlFor="sn-job-desc" className="block text-[11.5px] text-gray-400 mb-1">
                        Job description
                      </label>
                      <textarea
                        id="sn-job-desc"
                        rows={4}
                        value={composerJobDesc}
                        onChange={(e) => {
                          setComposerJobDesc(e.target.value);
                          if (composerError) setComposerError(null);
                        }}
                        placeholder="Paste the job posting description..."
                        className="w-full p-3 rounded-[6px] bg-[#1e1e1e] border border-[#3b3b3b] focus:border-[#8ab4f8] focus:outline-none text-[13px] text-white placeholder-gray-500 resize-none"
                      />
                    </div>

                    <p className="text-[11.5px] text-gray-400 mb-2.5">
                      Add a link, a description, or both.
                    </p>

                    <div className="mb-3">
                      <input
                        type="text"
                        value={composerTitle}
                        onChange={(e) => setComposerTitle(e.target.value)}
                        placeholder="Title (optional, e.g., Senior Engineer)"
                        className="w-full h-8 px-3 rounded-[6px] bg-[#1e1e1e] border border-[#3b3b3b] focus:border-[#8ab4f8] focus:outline-none text-[12.5px] text-white placeholder-gray-500"
                      />
                    </div>

                    {composerError && (
                      <div
                        role="alert"
                        className="mb-3 px-3 py-2 rounded-[6px] bg-rose-500/15 border border-rose-400/40 text-[12px] text-rose-200"
                      >
                        {composerError}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mb-2.5">
                      <input
                        ref={composerTitleInputRef}
                        type="text"
                        value={composerTitle}
                        onChange={(e) => setComposerTitle(e.target.value)}
                        placeholder="Title (e.g., Project ideas)"
                        className="w-full h-9 px-3 rounded-[6px] bg-[#1e1e1e] border border-[#3b3b3b] focus:border-[#c58af9] focus:outline-none text-[13.5px] font-semibold text-white placeholder-gray-500"
                      />
                    </div>

                    <div className="mb-3">
                      <textarea
                        rows={3}
                        value={composerBody}
                        onChange={(e) => setComposerBody(e.target.value)}
                        placeholder="Write your note here..."
                        className="w-full p-3 rounded-[6px] bg-[#1e1e1e] border border-[#3b3b3b] focus:border-[#c58af9] focus:outline-none text-[13px] text-white placeholder-gray-500 resize-none"
                      />
                    </div>
                  </>
                )}

                {/* Optional Custom Image Upload */}
                <div className="mb-4 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-[12px] text-purple-300 hover:text-purple-200 cursor-pointer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>{composerUploadName}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                  {composerCustomImage && (
                    <button
                      type="button"
                      onClick={clearUploadedImage}
                      className="text-[11px] text-gray-400 hover:text-white cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeComposerModal}
                    className="px-3.5 py-1.5 rounded-[6px] bg-[#323232] hover:bg-[#3c3c3c] text-[12.5px] text-gray-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleComposerSave}
                    className="px-4 py-1.5 rounded-[6px] bg-[#c58af9] hover:bg-[#d2a1fb] text-[#1c1326] font-semibold text-[12.5px] transition-colors cursor-pointer"
                  >
                    {isJobsComposer ? 'Save Job Request' : 'Add Note'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Screenshot Capture Flash */}
        {flashActive && (
          <div className="pointer-events-none absolute inset-0 z-50 bg-white/80 transition-opacity duration-300" />
        )}

        {/* Toast Banner */}
        {toastMessage && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[90%] px-3.5 py-2 rounded-full bg-[#323232] border border-[#4a4a4a] shadow-xl text-[12px] text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#c58af9] shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        )}
      </main>

      {taskMenuOpen && taskMenuPlacement === 'right' && activeDetailJob && (
        <div
          ref={taskMenuRef}
          role="menu"
          aria-label="AI Builder tasks"
          style={{ top: taskMenuCoords.top, left: taskMenuCoords.left }}
          className="fixed w-44 bg-[#2c2c2c] border border-[#444444] rounded-[8px] shadow-2xl z-[60] text-white font-sans"
        >
          {renderTaskMenuItems(activeDetailJob)}
        </div>
      )}
    </div>
  );
}

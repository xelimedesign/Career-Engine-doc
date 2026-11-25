# Sticky Notes Popup for Slate

A standalone, zero-dependency Windows 11–style Sticky Notes popup extracted from Career Engine for **Slate** (vanilla ES modules + CSS, no React or build step required).

## Files

- `sticky-notes.js` — ES module exporting `createStickyNotesWindow(options)` plus theme, seed, and validation helpers.
- `sticky-notes.css` — Self-contained dark Windows 11 styles (every class is prefixed with `sn-`).
- `example.html` — Standalone test page that opens the Sticky Notes window immediately.

## Quick Start

1. Copy the `sticky-notes/` folder into your Slate web directory.
2. Include `sticky-notes.css` in your HTML `<head>`:

```html
<link rel="stylesheet" href="./sticky-notes/sticky-notes.css" />
```

3. Import and initialize `createStickyNotesWindow` in an ES module script (serve over HTTP/localhost so browser module imports work):

```html
<script type="module">
  import { createStickyNotesWindow } from './sticky-notes/sticky-notes.js';

  // Zero-config mode: persists automatically to localStorage
  const stickyNotes = createStickyNotesWindow({
    defaultOpen: true,
  });

  // Press Alt+S or call:
  document.getElementById('open-notes-btn')?.addEventListener('click', () => {
    stickyNotes.open();
  });
</script>
```

## Pluggable Usage with Slate Storage & AI Runner

Pass storage and task callbacks in `options` so Sticky Notes delegates persistence and AI execution cleanly to Slate:

```js
import { createStickyNotesWindow } from './sticky-notes/sticky-notes.js';

const stickyNotes = createStickyNotesWindow({
  async loadNotes() {
    return await slateStore.getAllNotes();
  },

  async saveNote(note) {
    await slateStore.upsertNote(note);
  },

  async deleteNote(id) {
    await slateStore.removeNote(id);
  },

  async onTaskSelected(noteId, task) {
    // task is 'resume' | 'cover_letter' | 'both'
    await slateAiQueue.enqueue(noteId, task);
  },

  async getTaskStatus(noteId) {
    // Return 'idle' | 'queued' | 'running' | 'done' | 'failed'
    // or { taskStatus, selectedTask, jobStatus, taskReason }
    return await slateAiQueue.getStatus(noteId);
  },
});

stickyNotes.open();
```

## Options Reference

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `loadNotes` | `() => StickyNote[] \| Promise<StickyNote[]>` | `localStorage` | Loads the initial notes array. Falls back to built-in `localStorage` + seed notes if omitted. |
| `saveNote` | `(note: StickyNote) => void \| Promise<void>` | `localStorage` | Called whenever a note is created or edited. |
| `deleteNote` | `(id: string) => void \| Promise<void>` | `localStorage` | Called when a note is deleted. |
| `onTaskSelected` | `(noteId: string, task: 'resume' \| 'cover_letter' \| 'both') => void \| Promise<void>` | `undefined` | Called when the user selects a task from the Jobs detail `📄` menu. |
| `getTaskStatus` | `(noteId: string) => TaskStatusResult \| Promise<TaskStatusResult>` | `undefined` | Queried on open/refresh/detail view to sync current AI task status into the card and detail header. |
| `defaultOpen` | `boolean` | `false` | Opens the window on creation when no `sessionStorage` state exists yet. |
| `mountTarget` | `HTMLElement` | `document.body` | DOM container where the popup overlay and restore pill are appended. |
| `storageKey` | `string` | `'slate_sticky_notes_v1'` | Key used when falling back to `localStorage`. |
| `sessionKey` | `string` | `'slate_sticky_session_v1'` | `sessionStorage` key for remembering open/minimized state across the session. |
| `categories` | `string[]` | `['Tips', 'Jobs', 'Ideas', 'Research']` | Initial category tabs. |
| `initialNotes` | `StickyNote[]` | Built-in demo notes | Seed notes used only on first run when `localStorage` is empty. |

## Returned API

- `open()` — Opens and focuses the Sticky Notes popup window.
- `close()` — Closes the popup window and clears the restore pill.
- `minimize()` — Collapses the popup into a bottom-right `Sticky Notes` restore pill.
- `restore()` — Restores the popup window from its minimized pill.
- `refresh()` — Reloads notes via `loadNotes()` and re-checks `getTaskStatus()`.
- `destroy()` — Flushes pending saves, removes all window/document event listeners, and removes every DOM node added by the component.

## Keyboard Shortcuts & Responsive Behavior

- `Alt+S` — Opens/restores Sticky Notes from anywhere in the host page.
- `Escape` — Closes an open internal modal/menu first, or closes the window when no internal dialog is open.
- Below `480px` viewport width, the window expands to fill the screen width and height cleanly.

# Career Engine — Prioritized Bug Report & Defect Tracker

**Audit Date:** 2026-11-18  
**Total Defects Logged:** 18 (3 P0 Critical, 8 P1 High, 5 P2 Medium, 2 P3 Low)

---

## P0 — Critical Defects

### BUG-01: Dismissed & Unverified Company Intelligence Findings Leak Into AI Prompts
- **Severity:** P0 (Data Integrity / AI Accuracy)
- **Location:** `/src/services/aiService.ts:69-82` (`buildApprovedCompanyIntelligencePayload`), `/src/services/aiService.ts:184` (`runApplicationReviewWithAi`)
- **Reproduction:**
  1. Run Company Research (`POST /api/research/company`).
  2. Mark a questionable finding as `Dismissed` in `CompanyIntelligencePanel`, leaving another `Pending`.
  3. Generate a Cover Letter or tailor a Resume.
- **Observed Result:** Test harness verified `otherActiveFindings` still includes `pending` / `needs_verification` items, AND `payload.report` still contains the full text of the dismissed finding (`reportStillContainsDismissedText: true`). Furthermore, `runApplicationReviewWithAi` passes raw `companyResearch` without filtering.
- **Expected Result:** Only `approved` (and optionally user-permitted non-dismissed) findings should drive generation, and dismissed finding facts should be stripped/excluded from the AI context with an explicit `dismissedClaimsDoNotUse` blocklist.

### BUG-02: Missing Retries, Timeouts & Clean Error Formatting Across 8 Backend AI Routes
- **Severity:** P0 (Reliability / Error Handling)
- **Location:** `/server.ts:76-553`, `/src/services/aiService.ts:36-47` (`postJson`), `/server/companionService.ts:74-121`
- **Reproduction:**
  1. Call `/api/ai/job-analyze`, `/api/ai/resume-assist`, `/api/ai/cover-letter-generate`, `/api/ai/cover-letter-edit`, `/api/research/company`, `/api/research/job-match`, `/api/review/analyze`, or `/api/review/regenerate-suggestion` during upstream `429` or `503`.
- **Observed Result:**
  - All 8 routes immediately return `HTTP 500` with raw nested escaped Google API JSON strings (`{"error":"{\"error\":{\"code\":429,...\"}}"}`) directly in the UI error banner.
  - `companionService.ts` retries daily RPD `429` quota errors 3 times needlessly and does not translate `429`/`RESOURCE_EXHAUSTED` in `formatFriendlyAiError`.
  - `aiService.ts` `postJson` has no `AbortController` timeout.
- **Expected Result:** Shared retry helper (retrying transient `503`/`ECONNRESET`/per-minute `429`, NOT daily RPD exhaustion), proper HTTP status forwarding (`429`/`503`/`500`), clean human-readable error formatting on all 11 routes, and a client fetch timeout (`60–90s`).

### BUG-03: Deterministic Metric Check Corpus Includes `jobContext` (False Negative Hallucination Risk)
- **Severity:** P0 (AI Factual Accuracy)
- **Location:** `/server/companionService.ts:527-535`
- **Reproduction:** Target job description mentions `"Scale to 500,000 concurrent users"`. AI Companion suggests `"Led 500,000 concurrent users migration"` even though the candidate's profile and answers never mention it.
- **Observed Result:** Because `jobSummary` is included inside `verifiedCorpus` (`companionService.ts:532`), `runDeterministicMetricCheck` returns `0` flags instead of `1` high-severity flag.
- **Expected Result:** `verifiedCorpus` must strictly contain ONLY `originalContent`, `userAnswers`, `careerProfile`, and `documentContext` — never `jobContext`.

---

## P1 — High-Priority Defects

### BUG-04: Resume & Cover Letter Templates Do Not Render Distinctly in DOCX/PDF Exports
- **Severity:** P1 (Functional / Export Fidelity)
- **Location:** `/src/services/resumeExport.ts:32-1065`, `/src/services/coverLetterExport.ts:23-440`
- **Observed Result:** Exporting a resume or cover letter under all 5 templates produces virtually identical files (`CLTest_*.pdf` all `7,470 bytes`; `TemplateTest_*.pdf` all `15,759 bytes`). `coverLetterExport.ts:34` evaluates `template === 'minimal' ? AlignmentType.LEFT : AlignmentType.LEFT` (identical branches).
- **Expected Result:** Exported DOCX and PDF documents should reflect core template distinctions (`creative` accent bar & bottom header rule, `minimal` borderless headings, `modern` serif/heading styling & `"About"` summary heading, `technical` monospace/uppercase RE & section headings).

### BUG-05: Missing Undo Snapshots & Version Bumps When Applying AI Proposals in Builders
- **Severity:** P1 (Data Integrity / Undo)
- **Location:** `/src/modules/ResumeBuilderModule.tsx:184-232`, `/src/modules/CoverLetterModule.tsx:320-353`, `/src/store/CareerContext.tsx`
- **Observed Result:** Clicking `"Apply Selected Suggestions"` or `"Apply to Cover Letter"` overwrites resume/cover letter text without recording a `DocumentRevisionSnapshot` or bumping `version`. Additionally, `AIWritingCompanion` records snapshots that are unreachable from Resume Builder / Cover Letter Builder UIs.
- **Expected Result:** Record a snapshot before every AI apply, bump `version`, and expose a lightweight `"Undo Last AI Change"` button directly in Resume Builder & Cover Letter Maker toolbars.

### BUG-06: `JobTrackerModule` Missing `useEffect` Dependency Array
- **Severity:** P1 (Performance / Bug)
- **Location:** `/src/modules/JobTrackerModule.tsx:96-100`
- **Observed Result:** `useEffect(() => { ... });` without a dependency array detaches and re-attaches the `career-engine:new-job` window listener on every keystroke/render.
- **Expected Result:** Memoize or use ref/dependency array (`[addJob, setSelectedJobId]`) properly.

### BUG-07: `JobTrackerModule` Stale `selectedResumeForLetter` Reference
- **Severity:** P1 (State Sync)
- **Location:** `/src/modules/JobTrackerModule.tsx:71-73, 421-444`
- **Observed Result:** If the user deletes `resumes[0]` or creates a tailored resume for the active job, `selectedResumeForLetter` retains the deleted ID or old master ID.
- **Expected Result:** Synchronize default selection to the active job's latest tailored resume or first existing resume whenever `activeJob.id` or `resumes` changes.

### BUG-08: Cover Letter AI Editor Omits Company Intelligence & Job Match Context
- **Severity:** P1 (Integration)
- **Location:** `/src/modules/CoverLetterModule.tsx:288-318`, `/src/services/aiService.ts:155-167`, `/server.ts:356-389`
- **Observed Result:** `handleEditLetterOrParagraph` does not send `companyResearch` or `jobMatch` to `/api/ai/cover-letter-edit`, so running `"Improve Writing"` or `"Improve Opening"` strips company-specific grounding awareness.

### BUG-09: Missing Core Job Tracking Fields (`deadline`, `jobUrl`, `salaryRange`, `employmentType`)
- **Severity:** P1 (Product Completeness — Scenarios 11 & 12)
- **Location:** `/src/types/career.ts:188-209`, `/src/modules/JobTrackerModule.tsx`
- **Observed Result:** Users cannot store application deadlines, external posting links, salary ranges, or employment types (`Full-time`, `Contract`, etc.) in `JobApplication`.

### BUG-10: Missing Side-by-Side Employer Comparison Feature (Scenario 15)
- **Severity:** P1 (Missing Feature)
- **Location:** `/src/modules/JobTrackerModule.tsx`, `/src/components/CompanyIntelligencePanel.tsx`
- **Observed Result:** Users cannot compare two researched employers or job opportunities side by side.

### BUG-11: Missing Job Discovery / External Job Search & Filters (Scenario 11)
- **Severity:** P1 (Missing Feature)
- **Location:** `/src/modules/JobTrackerModule.tsx`, `/server.ts`
- **Observed Result:** Only local filtering over already-saved jobs is available; there is no job search/discovery workflow, salary/employment-type filters, or duplicate listing check on save.

---

## P2 — Medium-Priority Defects

### BUG-12: Lack of Form Validation & Duplicate Prevention in Career Profile / Sections Editor
- **Severity:** P2 (Data Integrity)
- **Location:** `/src/components/ResumeSectionsEditor.tsx:67-225, 322-403`
- **Observed Result:** Invalid emails (`"not-an-email"`), blank names/companies/titles, duplicate bullets (`StringListEditor`), and case-variant duplicate skills (`"TypeScript"` + `"typescript"` in `TagInputList`) are silently persisted.

### BUG-13: Broken Single-Line Justification in `exportCoverLetterToPdf`
- **Severity:** P2 (Export Formatting)
- **Location:** `/src/services/coverLetterExport.ts:412-420`
- **Observed Result:** Calls `doc.splitTextToSize()` then loops line-by-line passing `{ align: 'justify', maxWidth }`, which treats each line as an isolated final line in `jsPDF`.

### BUG-14: `computeWeightedApplicationScore` in `server/reviewService.ts` Crashes If `config` Is Omitted
- **Severity:** P2 (API Contract)
- **Location:** `/server/reviewService.ts:664-674`
- **Observed Result:** Unlike `src/services/reviewScoring.ts:31`, `server/reviewService.ts:674` reads `params.config.applicationWeights` without falling back to `DEFAULT_REVIEW_SCORING_CONFIG`.

### BUG-15: `verifyAndRankSources` Misclassifies `"example-blog.net"` as `news_press`
- **Severity:** P2 (Classification Accuracy)
- **Location:** `/server/researchService.ts:78`
- **Observed Result:** Regex `/(news|press|blog|...)/i` matches arbitrary domain names containing `"blog"` as `news_press` instead of checking known press outlets or `/blog` paths.

### BUG-16: Resume AI Skill Addition Uses Case-Sensitive Deduplication
- **Severity:** P2 (Data Cleanliness)
- **Location:** `/src/modules/ResumeBuilderModule.tsx:209-215`
- **Observed Result:** `existingSet` compares raw strings rather than lowercased strings, allowing duplicate capitalization variants.

---

## P3 — Low-Priority Defects

### BUG-17: No JSON Workspace Backup / Export & Import
- **Severity:** P3 (Durability)
- **Location:** `/src/store/CareerContext.tsx`
- **Observed Result:** All data lives in `localStorage` with no export/restore safeguard for users switching browsers.

### BUG-18: Redundant AI Entry Points (`AIWritingAssistant` vs `AIWritingCompanion`)
- **Severity:** P3 (UX Clarity)
- **Location:** `/src/components/ResumeSectionsEditor.tsx:421, 582` vs `AIWritingCompanion`
- **Observed Result:** Work Experience and Summary headers display both `"✦ Improve with AI"` (conversational companion) and `"AI Draft Summary"` / `"AI Polish Bullets"` (`AiDiffModal`) side by side with unclear distinction.

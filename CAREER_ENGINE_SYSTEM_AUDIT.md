# Career Engine — System Architecture & Audit Report

**Audit Date:** 2026-11-18  
**Average 20-Scenario Score:** **73.3 / 100**  

---

## 1. Executive Verdict

Career Engine has an unusually strong **domain foundation**: clean React 19 modular architecture, a strict master-versus-derived document model (`CareerProfile` -> tailored `ResumeDocument` & `CoverLetterDocument`), deterministic Harvard-inspired document standards (`standardsEngine.ts`), a multi-layer deterministic Fact Verification & ATS Validation engine (`server/reviewService.ts`), a conversational `AIWritingCompanion` with two-pass accuracy auditing, and real client-side OpenXML `.docx` (with hyperlinks & native bullets) + `.pdf` export pipelines.

However, the audit uncovered **two completely missing high-level product workflows** (Job Discovery/Search and Multi-Employer Comparison), **important data integrity & state-synchronization gaps** (missing undo snapshots & version bumps outside Review Center, stale job-tracker hooks, unvalidated profile inputs, dismissed company intelligence leaking via `report`), **superficial template rendering in DOCX/PDF exports**, and **inconsistent AI reliability/error handling** (8 of 11 AI endpoints lack retries, timeouts, and friendly error formatting).

---

## 2. Classification Matrix: What Works, What's Partial, What's Broken, What's Missing

### Works Correctly
- **Master Profile Protection & Deep Cloning:** Creating/tailoring resumes (`createResumeFromProfile`, `duplicateResume`) uses `structuredClone`, guaranteeing the Master Career Profile is never mutated by job-specific edits.
- **Deterministic Standards Evaluation (`standardsEngine.ts`):** Accurately scores resumes (`92` strong vs `64` empty vs `70` weak) and cover letters (`100` strong vs `54` weak) across 7 categories with concrete point deductions.
- **Deterministic Fact Verification & ATS Checks (`server/reviewService.ts`):** Verified catching injected employer name mismatches, date discrepancies, degree mismatches, cross-application employer inconsistencies, missing contact fields, and passive verb/pronoun violations.
- **3-Way Job Match Engine (`POST /api/research/job-match`):** Verified live (`HTTP 200`, `17.6s`) producing grounded strength matches, skill gaps, and section emphasis recommendations strictly from profile + job + company intelligence.
- **Document Export Text Extraction & Hyperlinks:** Exported `.docx` and `.pdf` files produce valid OpenXML/PDF binaries with full extractable text, clean typography mapping, and clickable `ExternalHyperlink` relationships in Word.
- **Review Center Apply & Undo Snapshots:** Applying findings in Review Center records `DocumentRevisionSnapshot`s, increments `version`, updates target paragraphs/bullets/summaries, and restores prior states accurately on Undo.

### Partially Works
- **Template System (Live Preview vs. DOCX/PDF Export):** Live preview renders distinct template visuals (`modern` cream paper/`About` header, `minimal` borderless headings, `technical` monospace/uppercase, `creative` accent bar), whereas `resumeExport.ts` and `coverLetterExport.ts` ignore almost all template variations (all 5 cover letter PDFs were identically `7,470 bytes`).
- **AI Error Handling & Resilience:** `companionService.ts` has `withRetry` + `formatFriendlyAiError` (though it doesn't translate `429` nicely and retries non-retryable daily quota errors); the other **8 backend AI routes** in `server.ts` have **no retries**, **no timeouts**, and leak raw nested JSON error blobs.
- **Company Intelligence Verification Filtering:** Users can `Dismiss` individual findings, but `buildApprovedCompanyIntelligencePayload` still sends `otherActiveFindings` (`pending`/`needs_verification`) AND the full `research.report` containing text from dismissed findings.
- **Profile & Form Validation:** Full CRUD works, but lacks required-field validation, email format validation, and case-insensitive duplicate prevention for skills/bullets/roles.
- **Cover Letter AI Editing (`handleEditLetterOrParagraph`):** Works for rewrites, but omits `companyResearch` and `jobMatch` context that `handleGenerateLetter` includes.

### Broken / Bugs Found
1. **`JobTrackerModule.tsx:96-100` Missing `useEffect` Dependency Array:** Re-registers `window.addEventListener('career-engine:new-job')` on every single render.
2. **`JobTrackerModule.tsx:71` Stale `selectedResumeForLetter` State:** Initialized once from `resumes[0]?.id`; never updates if resumes are added/deleted or a tailored resume is linked to the selected job.
3. **`coverLetterExport.ts:34` Dead Ternary & `415-418` Broken PDF Justification:** `template === 'minimal' ? AlignmentType.LEFT : AlignmentType.LEFT` is a no-op; `jsPDF` `align: 'justify'` on pre-split individual lines fails full justification.
4. **`companionService.ts:532` Metric Audit Corpus Leak:** `runDeterministicMetricCheck` includes `jobContext` inside `verifiedCorpus`, allowing numbers copied from the job posting (e.g., `"500,000 users"`) to pass deterministic metric validation without flagging.
5. **Missing Undo Snapshots & Version Bumps on AI Diff Applies:** `ResumeBuilderModule.tsx:184` (`handleApplyProposal`) and `CoverLetterModule.tsx:320` (`applyPendingReview`) mutate documents without calling `recordDocumentSnapshot` or incrementing `version`. Furthermore, `AIWritingCompanion` snapshots are orphaned from Builder Undo UIs (`ReviewCenterModule.tsx:243` filters snapshots by `reviewId`).

### Missing Features (Verified Against Prompt Scenarios)
1. **Scenario 11 — Job Search & Discovery:** No external job search/aggregation, no salary range filter, no employment type filter, no duplicate job listing detector, and no `jobUrl` external apply link field.
2. **Scenario 12 Fields — Job Deadline / Salary / Employment Type / Link:** `JobApplication` lacks `deadline`, `jobUrl`, `salaryRange`, and `employmentType`.
3. **Scenario 15 — Compare Two Employers:** No multi-company side-by-side comparison workspace (culture, stack, compensation, arrangement, match score).
4. **Automated Test Suite:** Zero unit/integration/E2E test runner (no Vitest/Jest/Playwright) or CI verification scripts exist in `/package.json`.

---

## 3. Data Loss, Duplication & Disconnected Feature Analysis

| Risk Area | Root Cause | Impact |
|---|---|---|
| **Browser-Only Storage (`localStorage`)** | All 10 state collections live solely in browser `localStorage` (`ce_*_v1`) with no backend database or JSON backup export/import | Clearing browser cache or switching devices erases all profiles, tailored resumes, jobs, and review history. |
| **Disconnected AI Writing UX** | Users encounter 3 separate AI flows (`ResumeSectionsEditor` `Wand2` -> `AiDiffModal`, `ResumeBuilderModule` AI tab -> `AiDiffModal`, and `AIWritingCompanion` `✦ Improve with AI`) with inconsistent undo/version behavior | Confusing UX; edits made via `AiDiffModal` cannot be undone, while `AIWritingCompanion` snapshots cannot be undone inside the Resume/Cover Letter Builder UI. |
| **Stale Derived Resumes** | Updating `CareerProfile` does not notify users that existing resumes (`linkedResumeId`) have diverged | Users may export resumes containing outdated titles/projects/skills unless they remember to open Fact Verification or click `Pull Profile`. |
| **Duplicate Entry Allowance** | `TagInputList` is case-sensitive (`React` + `react`); `StringListEditor` allows exact duplicate bullets | Produces messy ATS skill lists and bloated resumes. |

---

## 4. Security, Privacy & Reliability Observations

- **API Key Safety:** `GEMINI_API_KEY` is strictly server-side in `server.ts`; zero secrets leak to client bundles (`vite.config.ts` / `src/`).
- **Prompt Grounding Integrity:** System instructions across `server.ts`, `companionService.ts`, `researchService.ts`, and `reviewService.ts` enforce strict no-fabrication rules backed by deterministic verification (`runDeterministicFactCheck`, `runDeterministicMetricCheck`, `verifyAndRankSources`).
- **Timeout Vulnerability (`src/services/aiService.ts:36`):** `postJson` calls `fetch()` with no `AbortController` timeout, meaning stalled network requests can lock loading spinners indefinitely.
- **No Request Rate/Debounce Guard:** Rapid clicks across parallel AI tabs can exhaust Free Tier `20 RPD` quotas quickly.

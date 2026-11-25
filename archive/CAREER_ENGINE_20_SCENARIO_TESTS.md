# Career Engine — 20-Scenario Feature Testing & Workflow Validation Report

**Test Date:** 2026-11-18  
**Environment:** Express + Vite dev server (`http://localhost:3000`, Node `v22.23.2`), TypeScript module test harnesses (`tsx`), Python `zipfile`/XML/`pdf` structural inspectors.  
**Live AI Condition:** During live API testing on `gemini-4-hydrogen`, `POST /api/research/job-match` succeeded (`HTTP 200`, `17,608 ms`), while subsequent live Gemini calls hit the Free Tier daily project quota (`HTTP 429 RESOURCE_EXHAUSTED`: `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limit `20` requests/day). Where live Gemini inference was blocked by quota, deterministic logic, request/response validation, schema/prompt grounding, client state, and error-handling behavior were still executed and verified directly; live AI inference cells are transparently marked `BLOCKED (429 Quota)`.

## Scoring Rubric (0–100 Weighted)
Each scenario is scored across 6 dimensions:
- **Functional Completeness (`F`, 25%)**
- **Data Integrity & Persistence (`D`, 20%)**
- **AI Quality & Factual Accuracy (`A`, 20%)** *(for non-AI features, measures data/rule fidelity & validation soundness)*
- **UX & Workflow Flow (`U`, 15%)**
- **Cross-Module Integration (`I`, 10%)**
- **Error Handling & Reliability (`E`, 10%)**

`Weighted Score = round(0.25*F + 0.20*D + 0.20*A + 0.15*U + 0.10*I + 0.10*E)`

---

## Executive Scorecard Summary

| ID | Scenario | Category | Status | F (25%) | D (20%) | A (20%) | U (15%) | I (10%) | E (10%) | Weighted Score |
|---|---|---|---|---|---|---|---|---|---|---|
| **01** | Create a New Career Profile | A | **PARTIAL** | 85 | 72 | 75 | 85 | 90 | 55 | **77** |
| **02** | Update Existing Career Information | A | **PARTIAL** | 85 | 70 | 80 | 82 | 78 | 65 | **78** |
| **03** | AI-Assisted Experience Writing (`AIWritingCompanion`) | A | **PARTIAL / BLOCKED (AI)** | 88 | 85 | 60 | 90 | 90 | 65 | **79** |
| **04** | Create a Resume From Scratch | B | **PASS** | 95 | 92 | 92 | 90 | 90 | 80 | **91** |
| **05** | Generate a Job-Specific Resume | B | **PARTIAL / BLOCKED (AI)** | 85 | 75 | 65 | 85 | 88 | 45 | **75** |
| **06** | Resume Template Testing (5 Templates) | B | **PARTIAL** | 55 | 90 | 85 | 80 | 65 | 80 | **75** |
| **07** | Resume Export (DOCX & PDF) | B | **PARTIAL** | 82 | 95 | 90 | 88 | 75 | 75 | **86** |
| **08** | Create a Tailored Cover Letter | C | **PARTIAL / BLOCKED (AI)** | 85 | 75 | 65 | 86 | 80 | 45 | **75** |
| **09** | Company-Specific Cover Letter | C | **PARTIAL / BLOCKED (AI)** | 78 | 62 | 60 | 82 | 68 | 45 | **68** |
| **10** | Cover Letter Export (DOCX & PDF) | C | **PARTIAL** | 75 | 95 | 85 | 88 | 75 | 75 | **83** |
| **11** | Find a Job (Job Search & Discovery) | D | **FAIL (Missing)** | 15 | 60 | 20 | 35 | 25 | 50 | **33** |
| **12** | Save and Track a Job | D | **PARTIAL** | 72 | 82 | 80 | 82 | 85 | 65 | **78** |
| **13** | Complete Job Application Workspace | D | **PARTIAL** | 88 | 78 | 85 | 84 | 78 | 70 | **82** |
| **14** | Research an Employer (Google Search Grounding) | E | **PARTIAL / BLOCKED (AI)** | 88 | 88 | 70 | 90 | 85 | 45 | **79** |
| **15** | Compare Two Employers | E | **FAIL (Missing)** | 0 | 40 | 0 | 20 | 20 | 50 | **18** |
| **16** | Resume-Only Application Review | F | **PARTIAL (Det. PASS / AI BLOCKED)** | 90 | 92 | 78 | 90 | 90 | 45 | **84** |
| **17** | Cover-Letter-Only Application Review | F | **PARTIAL (Det. PASS / AI BLOCKED)** | 85 | 90 | 75 | 88 | 85 | 45 | **80** |
| **18** | Full Application Review, Apply & Undo | F | **PARTIAL (Apply PASS / AI BLOCKED)** | 92 | 95 | 80 | 92 | 92 | 45 | **86** |
| **19** | AI Provider Failure & Recovery | G | **PARTIAL** | 50 | 95 | 70 | 60 | 65 | 42 | **65** |
| **20** | End-to-End 15-Step Career Engine Workflow | G | **PARTIAL / BLOCKED (AI)** | 80 | 84 | 70 | 86 | 82 | 55 | **77** |
| **AVG** | **Portfolio Average (20 Scenarios)** | **All** | **PARTIAL** | **73.4** | **79.4** | **69.3** | **78.0** | **74.4** | **57.3** | **73.3** |

---

## Category A — Career Profile

### Scenario 01: Create a New Career Profile — **PARTIAL (Score: 77/100)**
- **Test Steps Executed:**
  1. Constructed an empty `CareerProfile` with blank `fullName`, invalid email (`"not-an-email"`), and empty sections (`workExperience: []`, `education: []`, `skills: empty`).
  2. Evaluated `createResumeFromProfile(emptyProfile, { name: 'Empty Profile Resume', isMaster: true })` and `evaluateResumeStandards(emptyResume, undefined, 1)`.
  3. Inspected `CareerProfileModule.tsx` & `ResumeSectionsEditor.tsx` for required-field indicators, email validation, date checks, and persistence (`ce_career_profile_v1`).
- **Observed Results:**
  - `createResumeFromProfile` succeeded cleanly (`emptyResume.name === "Empty Profile Resume"`), and `evaluateResumeStandards` flagged 5 completeness deductions (`totalScore = 64/100`: missing summary, missing experience, missing education, missing skills, missing contact info).
  - **Defect Found:** `ResumeSectionsEditor.tsx` renders raw controlled `<input>` elements without `<form>` validation, required indicators, or format validation. Invalid email (`"not-an-email"`) and empty `fullName` / empty `company` / empty `position` are accepted and autosaved directly to `localStorage`.
- **Verdict:** **PARTIAL** — Persistence & downstream cloning work cleanly; client-side field validation is missing.

### Scenario 02: Update Existing Career Information — **PARTIAL (Score: 78/100)**
- **Test Steps Executed:**
  1. Modified a cloned `INITIAL_CAREER_PROFILE` (`fullName: "Elena Vance"`, added new project `GridSync`, added duplicate skill `"typescript"` alongside `"TypeScript"`).
  2. Verified `createResumeFromProfile(updatedProfile)` picks up `GridSync` and preserves immutability of existing resumes unless `importProfileIntoResume` is explicitly triggered.
  3. Inspected `TagInputList` (`ResumeSectionsEditor.tsx:164-173`) and `StringListEditor` (`ResumeSectionsEditor.tsx:82-88`).
- **Observed Results:**
  - New project propagated immediately into newly generated resumes (`derivedResumeHasUpdatedProject: true`, `derivedResumeStandardsScore: 92`).
  - **Defect Found (Duplicate Prevention):** `TagInputList` uses exact-match `!items.includes(s)`, allowing `"TypeScript"` and `"typescript"` simultaneously. `StringListEditor` performs zero duplicate checking on responsibility/achievement bullets. Work Experience / Education forms allow duplicate entries with identical company/title/dates.
  - **UX Observation:** Updating Career Profile does not notify the user whether derived/tailored resumes are out of sync (requires manual `"Pull Profile"` click inside `ResumeBuilderModule`).
- **Verdict:** **PARTIAL**

### Scenario 03: AI-Assisted Experience Writing (`AIWritingCompanion`) — **PARTIAL / BLOCKED (Live AI) (Score: 79/100)**
- **Test Steps Executed:**
  1. Triggered `POST /api/ai/companion/analyze` and `POST /api/ai/companion/generate` with basic bullet `"Worked on React frontend and backend API endpoints for customer dashboard."` (`fieldType: "Work Experience"`, `documentType: "career-profile"`).
  2. Tested `runDeterministicMetricCheck` in `server/companionService.ts:225` directly against invented metrics (`"Led 500,000 concurrent users migration."`).
  3. Inspected `AIWritingCompanion.tsx` and `ResumeSectionsEditor.tsx:257-288`.
- **Observed Results:**
  - **Live API Call:** `POST /api/ai/companion/analyze` returned `HTTP 500` after `3,120 ms` (after 3 internal retries in `withRetry`), and `POST /api/ai/companion/generate` returned `HTTP 500` after `2,624 ms` due to upstream `429 RESOURCE_EXHAUSTED` (`limit: 20` Free Tier RPD).
  - **Error Message Observation:** `formatFriendlyAiError` stripped the nested JSON wrapper cleanly compared to other routes, but surfaced the raw Google rate-limit developer message rather than a concise user-facing retry message for `429`.
  - **Unit Verification:** `runDeterministicMetricCheck` flagged `"500,000 concurrent users"` (`1` high-severity flag) when tested against `careerProfile` alone, **but returned `0` flags (false negative)** when `jobContext` containing `"500,000 concurrent users"` was included in `verifiedCorpus` (`companionService.ts:532`).
  - **Snapshot Gap:** `AIWritingCompanion` calls `recordDocumentSnapshot` for resume/cover-letter edits, **but `ResumeBuilderModule` and `CoverLetterModule` expose no UI to undo an AI Companion snapshot** (snapshots are only visible in Review Center tied to `reviewId`).
- **Verdict:** **PARTIAL / BLOCKED (Live AI)**

---

## Category B — Resume Builder

### Scenario 04: Create a Resume From Scratch — **PASS (Score: 91/100)**
- **Test Steps Executed:**
  1. Verified `createResumeFromProfile`, section reordering/toggling (`DEFAULT_RESUME_SECTIONS` 10 sections), `buildResumePreviewBlocks` formatting, and `evaluateResumeStandards` on both complete (`INITIAL_RESUMES[0]`) and incomplete (`Empty Profile Resume`, `3`-page bloated resume) inputs.
- **Observed Results:**
  - `INITIAL_RESUMES[0]` scored **`92/100`** on `evaluateResumeStandards`; incomplete empty resume scored **`64/100`**; weak 3-page resume with passive verbs (`"Responsible for APIs"`), pronouns (`"I helped..."`), and missing contact fields dropped accurately to **`70/100`** with 6 actionable deductions.
  - Multi-resume CRUD, live page count tracking, and `localStorage` persistence (`ce_resumes_v1`) are complete.
- **Verdict:** **PASS**

### Scenario 05: Generate a Job-Specific Resume — **PARTIAL / BLOCKED (Live AI) (Score: 75/100)**
- **Test Steps Executed:**
  1. Tested `POST /api/ai/job-analyze` (`INITIAL_JOBS[0]`) and `POST /api/ai/resume-assist` (`action: "tailor_to_job"`) with both a matching Full Stack job and a mismatched `Rust / eBPF / Kubernetes` Systems Engineer job.
  2. Audited `ResumeBuilderModule.tsx:184-232` (`handleApplyProposal`).
- **Observed Results:**
  - **Live API Calls:** Returned `HTTP 500` (`437 ms`, `343 ms`, `423 ms`) with raw unformatted nested JSON error from `429 RESOURCE_EXHAUSTED` because `server.ts` routes 1–2 lack `withRetry` and `formatFriendlyAiError`.
  - **State/Logic Audit:** When proposals are applied in `ResumeBuilderModule.tsx:184-232`, `handleApplyProposal` **does not call `recordDocumentSnapshot`** (no undo), **does not increment `version`**, and checks `existingSet` case-sensitively when merging `suggestedSkillsToHighlight`.
- **Verdict:** **PARTIAL / BLOCKED (Live AI)**

### Scenario 06: Resume Template Testing (5 Templates) — **PARTIAL (Score: 75/100)**
- **Test Steps Executed:**
  1. Exported `INITIAL_RESUMES[0]` under all 5 templates (`professional`, `modern`, `minimal`, `technical`, `creative`) via `exportResumeToDocx` and `exportResumeToPdf`.
  2. Audited `ResumeBlocksBuilder.tsx` (live preview) vs `resumeExport.ts` (DOCX/PDF exporters) and inspected XML/PDF output hashes & extracted text.
- **Observed Results:**
  - **Live Preview (`ResumeBlocksBuilder.tsx`):** Differentiates `modern` (`#FCFBF9` paper tint, `"About"` section title, serif headings), `minimal` (borderless section headers), `technical` (`JetBrains Mono` uppercase headers), and `creative` (top `4px` accent bar + `2px` header border).
  - **DOCX & PDF Exports (`resumeExport.ts`):** All 5 PDFs were identically **15,759 bytes / 2 pages / 3,235 extracted chars**, and all 5 DOCX files were **~12,400 bytes / 455 words / Garamond font**. Only `technical` differed by uppercasing section titles (`"PROFESSIONAL SUMMARY"`). `creative` accent bar, `minimal` borderless headers, and `modern` `"About"` / serif styling **do not render in DOCX or PDF exports**.
- **Verdict:** **PARTIAL** — Template content stays 100% intact, but visual template parity fails on export.

### Scenario 07: Resume Export (DOCX & PDF) — **PARTIAL (Score: 86/100)**
- **Test Steps Executed:**
  1. Executed `exportResumeToDocx` and `exportResumeToPdf` on `INITIAL_RESUMES[0]`.
  2. Inspected generated `.docx` zip archive (`word/document.xml`, `word/_rels/document.xml.rels`) and binary `.pdf` streams via Python.
- **Observed Results:**
  - **DOCX:** Valid OpenXML (`12,397 bytes`), `455 words`, `3,438 chars`, preserves `Garamond` font mapping, right-aligned tab stops for dates, native Word bullet lists, and **`5` working `ExternalHyperlink` relationships** (`mailto:`, LinkedIn, portfolio, GitHub, project URL).
  - **PDF:** Valid 2-page US Letter PDF (`15,759 bytes`), `3,235` extractable characters, clean pagination (`ensureSpace`), clean wrapping (`splitTextToSize`), file naming sanitized (`sanitizeFilename`).
  - **Gap:** Template-specific visual accents (see Scenario 06) and PDF clickable hyperlink annotations (`doc.textWithLink`) are omitted.
- **Verdict:** **PARTIAL**

---

## Category C — Cover Letter Maker

### Scenario 08: Create a Tailored Cover Letter — **PARTIAL / BLOCKED (Live AI) (Score: 75/100)**
- **Test Steps Executed:**
  1. Tested `POST /api/ai/cover-letter-generate` (`writingStyle: 'Professional'`, `length: 'Standard'`) and inspected `CoverLetterModule.tsx` & `evaluateCoverLetterStandards`.
  2. Evaluated `evaluateCoverLetterStandards` on `INITIAL_COVER_LETTERS[0]` (`100/100`) and a weak 1-paragraph draft (`54/100`, 8 deductions).
- **Observed Results:**
  - **Live API Call:** `POST /api/ai/cover-letter-generate` returned `HTTP 500` (`318 ms`) due to upstream `429` quota exhaustion (raw nested JSON error surfaced).
  - **Code Audit:** `CoverLetterModule.tsx:320` (`applyPendingReview`) **does not record an undo snapshot** and **does not bump `version`**.
- **Verdict:** **PARTIAL / BLOCKED (Live AI)**

### Scenario 09: Company-Specific Cover Letter — **PARTIAL / BLOCKED (Live AI) (Score: 68/100)**
- **Test Steps Executed:**
  1. Executed unit test on `buildApprovedCompanyIntelligencePayload` (`src/services/aiService.ts:69`) with 1 `approved`, 1 `dismissed`, and 1 `pending` finding inside `CompanyResearch`.
  2. Audited `CoverLetterModule.tsx:288-318` (`handleEditLetterOrParagraph`) and `server.ts:356` (`/api/ai/cover-letter-edit`).
- **Observed Results:**
  - **Confirmed Data Leak Bug 1:** `buildApprovedCompanyIntelligencePayload` returns `approvedFindings: 1`, `otherActiveFindings: 1` (includes `pending` / `needs_verification` unverified items!), AND passes the **full `research.report` containing `"Dismissed Hallucinated Tech Y"`** (`reportStillContainsDismissedText: true`). Thus dismissing a company finding in the UI does NOT prevent AI generation from using it!
  - **Confirmed Integration Bug 2:** `handleEditLetterOrParagraph` in `CoverLetterModule.tsx:295` fails to pass `companyResearch` or `jobMatch` to `/api/ai/cover-letter-edit`, losing company personalization during edits/refinements.
- **Verdict:** **PARTIAL / BLOCKED (Live AI)**

### Scenario 10: Cover Letter Export (DOCX & PDF) — **PARTIAL (Score: 83/100)**
- **Test Steps Executed:**
  1. Exported `INITIAL_COVER_LETTERS[0]` across all 5 templates (`traditional`, `modern`, `minimal`, `technical`, `creative`) plus `textAlignment: 'justify'` to DOCX and PDF.
  2. Parsed XML and PDF streams with Python.
- **Observed Results:**
  - **DOCX:** `11,046 bytes`, `232 words`, `1,639 chars`, `Garamond` font, `4` working hyperlinks (`mailto:` + social/portfolio links).
  - **PDF:** `7,470 bytes`, `1 page`, `1,527` extractable chars.
  - **Defects:** (1) All 5 cover letter PDFs are identically **7,470 bytes** — zero template rendering differences; `coverLetterExport.ts:34` has a dead ternary `template === 'minimal' ? AlignmentType.LEFT : AlignmentType.LEFT`. (2) `exportCoverLetterToPdf` passes pre-split single lines to `doc.text(line, margin, y, { align: 'justify', maxWidth })`, which fails to produce true full-paragraph justification in `jsPDF`.
- **Verdict:** **PARTIAL**

---

## Category D — Job Search & Tracking

### Scenario 11: Find a Job (Job Search & Discovery) — **FAIL (Missing Feature) (Score: 33/100)**
- **Test Steps Executed:** Audited `JobTrackerModule.tsx` (`lines 276–303`) and `/server.ts` for job search/discovery endpoints, salary filters, employment type filters, duplicate listing detection, and external job URLs.
- **Observed Results:**
  - Only a local substring filter (`searchQuery` over company/title/description) and status filter (`All | Saved | Applied | Interviewing | Offer | Archived`) over already-saved local `jobs` exists.
  - **Missing:** External job search / curated job discovery, salary range filter, employment type filter, duplicate job warning when saving, and external application link field (`jobUrl`).
- **Verdict:** **FAIL (Missing Feature)**

### Scenario 12: Save and Track a Job — **PARTIAL (Score: 78/100)**
- **Test Steps Executed:** Inspected `JobApplication` schema (`src/types/career.ts:188`), `JobTrackerModule.tsx` CRUD controls, `AIWritingCompanion` for `Application Notes`, and persistence (`ce_jobs_v1`).
- **Observed Results:**
  - Saving, editing company/title/location/department/hiring manager/applicationDate, changing status (`Saved -> Applied -> Interviewing -> Offer -> Archived`), and persisting notes work cleanly.
  - **Missing Fields:** `JobApplication` has `applicationDate` but **no `deadline`**, **no `jobUrl` (external link)**, **no `salaryRange`**, and **no `employmentType`**.
  - **Code Bugs:** `JobTrackerModule.tsx:96-100` `useEffect` omits its dependency array (re-attaching `window` event listener every render).
- **Verdict:** **PARTIAL**

### Scenario 13: Complete Job Application Workspace — **PARTIAL (Score: 82/100)**
- **Test Steps Executed:** Traced cross-module creation and linking (`openTailoredResumeForJob`, `openCoverLetterForJob`, `openReviewCenter`, `Linked Documents` tab).
- **Observed Results:**
  - `Linked Documents` tab aggregates tailored resumes and cover letters cleanly; clicking opens the target editor with job/research context loaded.
  - **Bug Found:** `JobTrackerModule.tsx:71` initializes `selectedResumeForLetter` once from `resumes[0]?.id` and never updates it if that resume is deleted or a tailored resume is created for the active job.
- **Verdict:** **PARTIAL**

---

## Category E — Company Research & Comparison

### Scenario 14: Research an Employer — **PARTIAL / BLOCKED (Live AI) (Score: 79/100)**
- **Test Steps Executed:**
  1. Sent live requests to `POST /api/research/company` (`Vercel` + `Zorblax Quantum Widgets LLC`) and `POST /api/research/job-match`.
  2. Unit-tested `verifyAndRankSources` (`server/researchService.ts:88`) with official docs, official careers, tech news, and third-party blog URLs.
- **Observed Results:**
  - **`POST /api/research/job-match` PASSED (`HTTP 200`, `17,608 ms`)**, returning structured `strongMatches` grounded specifically in `Oliver Rowland`'s 5+ years of TypeScript/React/Next.js/Node.js/PostgreSQL/Docker experience.
  - `POST /api/research/company` returned `HTTP 500` (`422 ms` / `366 ms`) due to Free Tier 20 RPD `429 RESOURCE_EXHAUSTED` quota limit.
  - `verifyAndRankSources` correctly sorted official company pages (`official_website`, `careers_page`, `isOfficial: true`) ahead of external sources (`techcrunch.com`), though `example-blog.net` classified as `news_press` due to `"blog"` substring match.
- **Verdict:** **PARTIAL / BLOCKED (Live AI)**

### Scenario 15: Compare Two Employers — **FAIL (Missing Feature) (Score: 18/100)**
- **Test Steps Executed:** Audited `CompanyIntelligencePanel.tsx`, `JobTrackerModule.tsx`, and `CareerContext.tsx`.
- **Observed Results:**
  - `CompanyIntelligencePanel` only displays a single job/company at a time. There is **no multi-company side-by-side comparison view**, no comparison scoring matrix, and no salary/work-arrangement fields on `JobApplication` to compare. (Only Review History in `ReviewCenterModule` supports comparing two historical review scores.)
- **Verdict:** **FAIL (Missing Feature)**

---

## Category F — AI Review & Recommendation Center

### Scenario 16: Resume-Only Application Review — **PARTIAL (Deterministic PASS / AI BLOCKED) (Score: 84/100)**
- **Test Steps Executed:**
  1. Executed `runDeterministicFactCheck` and `runDeterministicAtsValidation` on an intentionally altered resume (`wrong.email@example.com`, `Southstack Corp`, `Feb 2019`, `M.S.`, passive bullets, missing contact fields).
  2. Sent `POST /api/review/analyze` (`scope: 'resume_only'`).
- **Observed Results:**
  - Deterministic Fact Verification caught **3/3 injected contradictions** (`Employer Name: Northstack vs Southstack Corp`, `Employment Dates: Jan 2025 vs Feb 2019`, `Education: B.S. vs M.S.`) and verified 5 matching profile facts.
  - Deterministic ATS scored the clean resume **`100/100 structural, 100/100 keyword`** and correctly failed the broken resume (`structural: 89/100`, flagging missing email/phone).
  - Live `POST /api/review/analyze` returned `HTTP 500` (`238 ms`) from `429` quota exhaustion (unformatted raw JSON error).
- **Verdict:** **PARTIAL**

### Scenario 17: Cover-Letter-Only Application Review — **PARTIAL (Deterministic PASS / AI BLOCKED) (Score: 80/100)**
- **Test Steps Executed:**
  1. Verified `calculateWeightedApplicationScore({ scope: 'cover_letter_only', resumeScore: 0, coverLetterScore: 80, jobMatchScore: 70, companyAlignmentScore: 60 })` -> **`73/100`**.
  2. Tested `evaluateCoverLetterStandards` on valid vs weak cover letters (`100` vs `54`).
  3. Audited `ReviewCenterModule.tsx:161-238` and `aiService.ts:169`.
- **Observed Results:**
  - Scope weighting excludes `resumeScore` properly (`0.3 + 0.2 + 0.1` normalized).
  - **Bug Found:** `runApplicationReviewWithAi` (`src/services/aiService.ts:169`) passes raw `companyResearch` directly to `/api/review/analyze` without stripping dismissed findings (though `reviewService.ts` filters `approved` findings server-side, raw dismissed report fields are still transmitted).
- **Verdict:** **PARTIAL**

### Scenario 18: Full Application Review, Apply & Undo — **PARTIAL (Apply/Undo PASS / AI BLOCKED) (Score: 86/100)**
- **Test Steps Executed:**
  1. Executed `runDeterministicFactCheck` with prior application history (`Harborline Cloud` conflicting claim), `computeWeightedApplicationScore` (`87/100`), and simulated `applyFindingChanges` + `undoReviewSnapshot` across `resume_summary`, `resume_exp_bullet`, and `cover_letter_paragraph`.
  2. Tested live `POST /api/review/analyze` (`full_application`) and `POST /api/review/regenerate-suggestion`.
- **Observed Results:**
  - Deterministic cross-application fact check caught **4/4 contradictions** (3 resume mismatches + 1 `Cross-Application Consistency` discrepancy for `Harborline Cloud`).
  - Simulated apply bumped document `version` (`1 -> 2`), replaced target summary, experience bullet, and cover letter paragraph, and `undoReviewSnapshot` restored original state bit-for-bit (`snapshotPreservesOriginalSummary: true`).
  - Live AI endpoints hit `429 RESOURCE_EXHAUSTED` (`209 ms` and `208 ms`).
- **Verdict:** **PARTIAL**

---

## Category G — Reliability & End-to-End Flow

### Scenario 19: AI Provider Failure & Recovery — **PARTIAL (Score: 65/100)**
- **Test Steps Executed:**
  1. Sent malformed/empty JSON bodies to all 11 POST endpoints -> verified `400` input validation.
  2. Observed live upstream `429 RESOURCE_EXHAUSTED` behavior across all endpoints.
  3. Audited `src/services/aiService.ts` (`postJson`), `server.ts`, and `server/companionService.ts`.
- **Observed Results:**
  - **Passes:** All 11 routes return clean `HTTP 400` JSON errors for missing payloads; client `localStorage` data is never modified or corrupted when AI requests fail.
  - **Failures Found:**
    1. Routes 1–8 in `server.ts` have **zero retry logic** (`withRetry`) and leak **raw escaped upstream JSON errors** to the UI (`{"error":"{\"error\":{\"code\":429...}}"}`).
    2. `server.ts` returns HTTP `500` even for `429` (rate limit) and `503` (upstream unavailable).
    3. `companionService.ts` retries daily RPD `429` (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`) 3 times unnecessarily (~2.7s wasted) and `formatFriendlyAiError` does not translate `429`/`RESOURCE_EXHAUSTED` into plain user-friendly text.
    4. `aiService.ts` `postJson` has **no `AbortController` timeout** — hung upstream requests stall UI loading states indefinitely.
    5. No fallback/alternative AI provider exists (`gemini-4-hydrogen` hardcoded everywhere, even though `ReviewCenterModule` displays an `AI Provider / Model` box).
- **Verdict:** **PARTIAL**

### Scenario 20: End-to-End 15-Step Career Engine Workflow — **PARTIAL / BLOCKED (Live AI) (Score: 77/100)**
- **Test Steps Executed:** Traced & ran all 15 steps combining local `CareerProfile` -> `JobApplication` -> `AI Job Analyze` *(429)* -> `Company Research` *(429)* -> `3-Way Job Match` ***(200 OK!)*** -> `Tailored Resume` -> `AI Companion` *(429)* -> `Cover Letter Generate` *(429)* -> `Standards Reports` ***(92 & 100 PASS)*** -> `Deterministic Fact & ATS Audit` ***(PASS)*** -> `Apply & Snapshot Undo` ***(PASS)*** -> `DOCX + PDF Exports` ***(4 valid files generated & parsed)*** -> `Persistence Verification` ***(PASS)***.
- **Observed Results:** The end-to-end architecture, state graph, cross-module links, deterministic evaluation engines, snapshot preservation, and binary document generation work cohesively; overall completion is held back by live Gemini quota exhaustion + missing retries/timeouts on core routes, missing Job Search & Employer Comparison modules, and export template parity gaps.
- **Verdict:** **PARTIAL / BLOCKED (Live AI)**

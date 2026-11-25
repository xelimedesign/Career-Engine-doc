# Career Engine — Complete Feature Inventory & Architecture Map

**Audit Date:** 2026-11-18  
**Application Version:** Career Engine (React 19 + TypeScript + Vite + Express + `@google/genai`)  
**Scope:** Complete codebase audit across frontend modules, shared components, client services, persistence layer, and Express API backend.

---

## 1. System Architecture Overview

| Layer | Implementation | Key Files |
|---|---|---|
| **Runtime & Server** | Express 4 + Vite middleware (dev) / static `dist/` (prod) on port `3000` | `/server.ts`, `/package.json` |
| **Backend AI Services** | Google Gemini SDK (`@google/genai`) targeting model `gemini-4-hydrogen` | `/server.ts`, `/server/companionService.ts`, `/server/researchService.ts`, `/server/reviewService.ts` |
| **Frontend Shell & Navigation** | Single-page React 19 app with top tab navigation (`profile`, `jobs`, `resumes`, `cover-letters`, `review-center`, `documents`) | `/src/App.tsx`, `/src/components/TopNav.tsx` |
| **Client State & Persistence** | React Context (`CareerProvider`) backed by browser `localStorage` (`ce_*_v1` keys) — zero server-side DB | `/src/store/CareerContext.tsx`, `/src/data/defaultData.ts` |
| **Document Preview & Export** | Paginated 8.5×11" DOM preview + client-side `.docx` (`docx`) and `.pdf` (`jspdf`) exporters | `/src/components/PaginatedPaperPreview.tsx`, `/src/services/resumeExport.ts`, `/src/services/coverLetterExport.ts` |
| **Standards & Review Engines** | Deterministic standards evaluator + ATS/fact verifier + AI review orchestrator | `/src/services/standardsEngine.ts`, `/src/services/reviewScoring.ts`, `/server/reviewService.ts` |

---

## 2. Navigation & Modules Inventory

| Module Key | UI Label | Component | Primary Purpose |
|---|---|---|---|
| `profile` | Career Profile | `CareerProfileModule` (`/src/modules/CareerProfileModule.tsx`) | Master verified career record (personal info, summary, experience, education, skills, projects, certifications, awards, volunteer, languages, publications). |
| `jobs` | Job Tracker | `JobTrackerModule` (`/src/modules/JobTrackerModule.tsx`) | Track saved/applied jobs, inspect AI Job Analysis, run Google Search-grounded Company Intelligence, run 3-Way Job Match, manage linked tailored docs. |
| `resumes` | Resume Builder | `ResumeBuilderModule` (`/src/modules/ResumeBuilderModule.tsx`) | Create/version/tailor resumes, edit 11 structured sections, configure templates/typography, run Standards & AI Writing Assistant, export DOCX/PDF. |
| `cover-letters` | Cover Letters | `CoverLetterModule` (`/src/modules/CoverLetterModule.tsx`) | Create/version/generate/edit tailored cover letters, link resume & job/company intelligence, customize formatting, export DOCX/PDF. |
| `review-center` | Review Center | `ReviewCenterModule` (`/src/modules/ReviewCenterModule.tsx`) | Multi-document pre-submission audit (Resume-only, Cover-Letter-only, Full Application) with weighted scoring, fact verification, ATS checks, apply/undo, and review history comparison. |
| `documents` | Document Manager | `DocumentManagerModule` (`/src/modules/DocumentManagerModule.tsx`) | Unified table of resumes, cover letters, and completed company intelligence reports with search, filter, duplicate, review trigger, and export actions. |

---

## 3. Detailed Feature Inventory

### A. Career Profile (`/src/modules/CareerProfileModule.tsx`, `/src/components/ResumeSectionsEditor.tsx`)

| Feature | Location | Intended Purpose | Frontend Impl. | Backend Impl. | Data Dependencies | AI Dependencies | Status |
|---|---|---|---|---|---|---|---|
| **Master Profile Sections Editor (11 sections)** | `CareerProfileModule` + `ResumeSectionsEditor` | Edit personal info, summary/objectives, work experience, education, 4 skill groups, projects, certifications, awards, volunteer, languages, publications | Controlled React inputs, `StringListEditor`, `TagInputList`, reorder/delete controls | None (client-only) | `profile` in `CareerContext`, `ce_career_profile_v1` | None | **PARTIAL** — Works for full CRUD & reorder; lacks required-field/email format validation and duplicate prevention (`"React"` vs `"react"`, duplicate bullet lines). |
| **Create Resume from Profile** | `CareerProfileModule.tsx:119` | Clone verified profile into a new standalone resume without mutating master profile | `createResume({ fromProfile: true })` + `setActiveModule('resumes')` | None | `profile`, `resumes` | None | **PASS** — Deep-clones via `structuredClone`. |
| **Contextual AI Writing Companion** | `ResumeSectionsEditor.tsx` (Summary, Career Objectives, Work Exp, Responsibilities, Achievements, Skills, Education, Projects, Certifications) | Interview user (2–6 adaptive Qs), generate grounded improvements, run accuracy audit | `AIWritingCompanion` modal (`src/components/AIWritingCompanion.tsx`) | `POST /api/ai/companion/analyze`, `/adapt`, `/generate` | `careerProfile`, `documentContext`, `aiWritingHistory` | `gemini-4-hydrogen` (`companionService.ts`) | **PARTIAL** — Complete architecture; live execution blocked when Gemini Free Tier 20 RPD quota returns HTTP 429; `429` error formatting not friendly. |

### B. Resume Builder (`/src/modules/ResumeBuilderModule.tsx`, `ResumeBlocksBuilder.tsx`, `resumeExport.ts`)

| Feature | Location | Intended Purpose | Frontend Impl. | Backend Impl. | Data Dependencies | AI Dependencies | Status |
|---|---|---|---|---|---|---|---|
| **Multi-Resume Version Management** | `ResumeBuilderModule.tsx:275-345` | Create, duplicate, rename, delete, switch master & tailored resumes | Sidebar selector, inline rename, `duplicateResume`, `deleteResume` | None | `resumes`, `activeResumeId` | None | **PASS** — Enforces keeping at least 1 resume; preserves `isMaster` flag. |
| **Section Visibility & Ordering** | `ResumeBuilderModule.tsx:128-155` | Enable/disable and reorder all 10 resume sections | Eye toggle + Up/Down arrows + `applyRecommendedSectionOrder` | None | `activeResume.sections` | Optional `jobMatch.recommendedResumeEmphasis` | **PASS** |
| **Template Switching (5 Templates)** | `ResumeBuilderModule.tsx:41-47`, `ResumeBlocksBuilder.tsx`, `resumeExport.ts` | Switch between `modern`, `professional`, `minimal`, `technical`, `creative` visually & in exports | Template cards update `activeResume.template` | None | `activeResume.template` | None | **PARTIAL** — Live preview differentiates headings/borders/paper tint; **DOCX & PDF exports ignore `creative`, `minimal`, `modern`, and `professional` differences** (only `technical` uppercases titles). |
| **Typography & Layout Formatting** | `ResumeBuilderModule.tsx` Formatting tab | Adjust font family, font size, heading size, accent color, margins, line/section spacing, header alignment | Range sliders, color presets + picker, alignment buttons | None | `activeResume.formatting` | None | **PASS** |
| **Job Linking & Profile Sync** | `ResumeBuilderModule.tsx` top bar | Link resume to tracked job; pull updates from Career Profile | Job dropdown (`linkedJobId`), `importProfileIntoResume` | None | `jobs`, `profile`, `companyResearches`, `jobMatches` | None | **PASS** |
| **Standards Quality Report** | `QualityReportPanel.tsx`, `standardsEngine.ts:135` | Deterministic 100-pt Harvard-inspired rubric across 7 categories | Real-time score calculation & deductions panel | None | `activeResume`, `linkedJob`, `pageCount` | None | **PASS** |
| **AI Writing Assistant (`AiDiffModal`)** | `ResumeBuilderModule.tsx:157-232` | Run `write_summary`, `improve_experience`, `fix_grammar`, `audit_gaps`, `tailor_to_job` | Action buttons + `AiDiffModal` checkbox diff review | `POST /api/ai/resume-assist` | `activeResume`, `targetJob`, `companyResearch`, `jobMatch` | `gemini-4-hydrogen` (`server.ts:165`) | **PARTIAL** — Applying proposal **does NOT record an undo snapshot** (`recordDocumentSnapshot`), **does NOT bump `version`**, and adds skills case-sensitively. Raw JSON errors on API failure. |
| **Live Paginated Preview & Export (DOCX/PDF)** | `PaginatedPaperPreview.tsx`, `resumeExport.ts` | Multi-page US Letter preview with zoom/page controls + DOCX (editable Word) & PDF export | Hidden DOM measurement block packer + `docx` + `jsPDF` | None | `activeResume`, `blocks` | None | **PARTIAL** — Clean text extraction, hyperlinks, and multi-page pagination verified; template styles missing in exported DOCX/PDF. |

### C. Cover Letter Maker (`/src/modules/CoverLetterModule.tsx`, `CoverLetterBlocksBuilder.tsx`, `coverLetterExport.ts`)

| Feature | Location | Intended Purpose | Frontend Impl. | Backend Impl. | Data Dependencies | AI Dependencies | Status |
|---|---|---|---|---|---|---|---|
| **Cover Letter CRUD & Job/Resume Linking** | `CoverLetterModule.tsx` | Create, duplicate, rename, delete, link to Resume & Job Tracker item | Left panel list, dropdown selectors `importFromJob`, `importProfileApplicant` | None | `coverLetters`, `resumes`, `jobs` | None | **PASS** |
| **Structured Letter Editor + Inline Companion** | `CoverLetterModule.tsx` (`letter`, `parties`, `job` tabs) | Edit salutation, ordered paragraphs, sign-off, signature, applicant/employer/job fields | Inputs + `AIWritingCompanion` on Opening, Body, Closing paragraphs | `/api/ai/companion/*` | `activeCoverLetter`, `linkedResume`, `linkedJob`, `linkedResearch` | `gemini-4-hydrogen` | **PASS** (UI & context passing; subject to live API quota) |
| **AI Cover Letter Generator & Refiner** | `CoverLetterModule.tsx:252-350` | Generate full letter tailored to job/company/resume/style/length; run 9 quick edit actions | `handleGenerateLetter`, `handleEditLetterOrParagraph`, `AiDiffModal` | `POST /api/ai/cover-letter-generate`, `POST /api/ai/cover-letter-edit` | `applicant`, `employer`, `jobInfo`, `profile`, `selectedResume`, `companyResearch`, `jobMatch` | `gemini-4-hydrogen` (`server.ts:262, 356`) | **PARTIAL** — `cover-letter-edit` **omits `companyResearch` and `jobMatch`**; applying review **does NOT record snapshot or bump version**; `buildApprovedCompanyIntelligencePayload` leaks `pending` findings and full `report` even when findings are dismissed. |
| **Template Switching (5 Templates) & Formatting** | `CoverLetterModule.tsx:39-45`, `CoverLetterBlocksBuilder.tsx`, `coverLetterExport.ts` | Switch `traditional`, `modern`, `minimal`, `technical`, `creative` + font/margin/justify controls | Template cards + formatting controls | None | `activeCoverLetter.template`, `formatting` | None | **PARTIAL** — All 5 templates export to **identical 7,470-byte PDFs and nearly identical DOCX** (`headerAlign` ternary has identical branches in `coverLetterExport.ts:34`); `jsPDF` `justify` option passes single pre-split lines. |
| **Cover Letter Quality Report** | `standardsEngine.ts:446` | 100-pt deterministic rubric across 7 categories (structure, personalization, alignment, etc.) | `QualityReportPanel` | None | `activeCoverLetter`, `linkedResume`, `pageCount` | None | **PASS** |

### D. Job Search & Job Tracker (`/src/modules/JobTrackerModule.tsx`, `/src/components/CompanyIntelligencePanel.tsx`)

| Feature | Location | Intended Purpose | Frontend Impl. | Backend Impl. | Data Dependencies | AI Dependencies | Status |
|---|---|---|---|---|---|---|---|
| **Job Search & Discovery (External/Filtered Search)** | Requested Scenario 11 | Search external job postings, filter by salary range & employment type, detect duplicates, open original links | **NOT IMPLEMENTED** — Left sidebar only filters locally saved jobs by text query & status | None | `jobs` only | None | **MISSING** |
| **Job Application Tracker CRUD & Notes** | `JobTrackerModule.tsx` | Save target jobs, track pipeline status (`Saved`, `Applied`, `Interviewing`, `Offer`, `Archived`), write AI-assisted notes | List + detail form + `AIWritingCompanion` on `applicationNotes` | `/api/ai/companion/*` for notes | `jobs`, `ce_jobs_v1` | Companion AI only | **PARTIAL** — Missing `deadline`, `jobUrl`, `salaryRange`, `employmentType` fields; `useEffect` at line 96 lacks dependency array; `selectedResumeForLetter` at line 71 goes stale on resume changes. |
| **AI Job Description Analyzer** | `JobTrackerModule.tsx:126` | Extract required/preferred quals, responsibilities, tech stack; compare to Career Profile | `Analyze Job` button -> populates structured lists & `analysis` panel | `POST /api/ai/job-analyze` | `activeJob`, `profile` | `gemini-4-hydrogen` (`server.ts:76`) | **PARTIAL** — No retries/friendly errors on 503/429. |
| **Cross-Module Tailored Workflow Buttons** | `JobTrackerModule.tsx:412-466` | Launch `Tailor Resume`, `Create Cover Letter` (with ref resume), `Review Application` directly from a job | Context helpers `openTailoredResumeForJob`, `openCoverLetterForJob`, `openReviewCenter` | None | `jobs`, `resumes`, `coverLetters` | None | **PASS** (except `selectedResumeForLetter` default can become stale). |

### E. Company Intelligence & Employer Comparison (`/src/components/CompanyIntelligencePanel.tsx`, `/server/researchService.ts`)

| Feature | Location | Intended Purpose | Frontend Impl. | Backend Impl. | Data Dependencies | AI Dependencies | Status |
|---|---|---|---|---|---|---|---|
| **Company Research Engine (Google Search Grounding)** | `CompanyIntelligencePanel.tsx`, `server/researchService.ts` | Search live web sources via Gemini `googleSearch` tool, verify & rank sources, synthesize 10-section report & granular findings | `Company Research` button, 2h server-side cache, structured report + source attribution | `POST /api/research/company` (`GeminiGoogleSearchAdapter`, `analyzeCompanyIntelligence`) | `companies`, `companyResearches` | `gemini-4-hydrogen` + Google Search tool | **PARTIAL** — Strong grounding & caching architecture; fails on quota without friendly error/retry. |
| **Finding Approval / Dismissal Controls** | `CompanyIntelligencePanel.tsx`, `CareerContext.tsx:830` | Let user `Approve`, `Needs Verification`, or `Dismiss` individual extracted company facts | Tab `Extracted Findings` with 3-state buttons | None (client state) | `companyResearches` | Passed into `buildApprovedCompanyIntelligencePayload` | **PARTIAL** — Dismissing a finding does **not** remove it from `research.report`, which is still sent in `buildApprovedCompanyIntelligencePayload` alongside `otherActiveFindings` (`pending`). |
| **Three-Way Job Match Engine** | `CompanyIntelligencePanel.tsx`, `server/researchService.ts:442` | Combine Career Profile + Job Posting + Company Research for match score, aligned strengths, skill gaps, emphasis plan | `3-Way Job Match` button & Match tab | `POST /api/research/job-match` | `job`, `companyResearch`, `careerProfile` | `gemini-4-hydrogen` | **PARTIAL** — Complete implementation; subject to raw 500 error propagation. |
| **Compare Two Employers Side-by-Side** | Requested Scenario 15 | Side-by-side comparison of culture, tech stack, salary, work arrangement, alignment scores | **NOT IMPLEMENTED** — Only one job/company can be viewed at a time | None | N/A | N/A | **MISSING** |

### F. Application Review & Recommendation Center (`/src/modules/ReviewCenterModule.tsx`, `/server/reviewService.ts`)

| Feature | Location | Intended Purpose | Frontend Impl. | Backend Impl. | Data Dependencies | AI Dependencies | Status |
|---|---|---|---|---|---|---|---|
| **Multi-Scope Application Audit** | `ReviewCenterModule.tsx:161` | Review `full_application`, `resume_only`, or `cover_letter_only` across 7+ dimensions | Selector bar + `Run Application Review` button + 9 sub-tabs | `POST /api/review/analyze` | `profile`, `resume`, `coverLetter`, `job`, `companyResearch`, `previousApplications` | `gemini-4-hydrogen` + deterministic checks | **PARTIAL** — Deterministic Fact Check & ATS Checks run cleanly; AI audit fails with raw error under 429/503. Also `runApplicationReviewWithAi` passes raw `companyResearch` instead of `buildApprovedCompanyIntelligencePayload`, and `ReviewCenter` hardcodes `gemini-4-hydrogen` selector without real multi-provider support. |
| **Deterministic Fact Verification Engine** | `server/reviewService.ts:152-460`, `ReviewCenterModule.tsx:1143` | Cross-check dates, emails, employers, degrees, skills, and prior employer claims against Master Profile | `Fact Verification` tab + `Confirm Profile` / `Confirm Document` / `Dismiss` buttons | `runDeterministicFactCheck` inside `/api/review/analyze` | `careerProfile`, `resume`, `coverLetter`, `previousApplications` | None (100% deterministic) | **PASS** — Verified directly in test harness (caught altered email, employer name, start date, degree, and cross-application employer claim). |
| **Deterministic ATS Structural & Keyword Validation** | `server/reviewService.ts:466-662`, `ReviewCenterModule.tsx:1077` | Check contact completeness, section layout, action verbs, pronouns, metrics, and job keyword overlap | `ATS Validation` tab | `runDeterministicAtsValidation` | `resume`, `job` | None (100% deterministic) | **PASS** — Verified directly in test harness. |
| **Finding Review, Edit, Regenerate, Batch Apply & Undo** | `ReviewFindingCard.tsx`, `CareerContext.tsx:928-1129` | Accept, Reject, Edit, Regenerate individual findings; Apply Selected; Undo via snapshot | Interactive finding cards, checkboxes, batch apply, `Undo Last Applied Changes` button | `POST /api/review/regenerate-suggestion` | `applicationReviews`, `documentSnapshots`, `resumes`, `coverLetters` | Gemini on `regenerate` only | **PASS** (client apply/undo works for all `TargetFieldRef` kinds; `resume_exp_bullet` uses index/text matching). |
| **Review History & Side-by-Side Score Comparison** | `ReviewCenterModule.tsx:1460` | Persist past reviews and compare deltas between two review runs | `Review History` table + baseline/target delta matrix | None (client state) | `applicationReviews` (`ce_reviews_v1`) | None | **PASS** |

### G. Document Manager (`/src/modules/DocumentManagerModule.tsx`)

| Feature | Location | Intended Purpose | Frontend Impl. | Backend Impl. | Data Dependencies | AI Dependencies | Status |
|---|---|---|---|---|---|---|---|
| **Unified Document & Report Hub** | `DocumentManagerModule.tsx` | Filter (`all`, `resume`, `cover-letter`, `research`), search, open, duplicate, delete, trigger Review, export DOCX/PDF/TXT | Table view with inline actions | None | `resumes`, `coverLetters`, `companyResearches`, `applicationReviews` | None | **PASS** |

---

## 4. Backend API Endpoints & Persistence Storage Map

### Backend Express Routes (`/server.ts`)
1. `GET /api/health` — Returns `{ ok: true, aiConfigured: boolean }`
2. `POST /api/ai/job-analyze` — Extracts qualifications/responsibilities/skills (`gemini-4-hydrogen`, no retry)
3. `POST /api/ai/resume-assist` — Summary/experience/grammar/gap/tailoring JSON proposal (no retry)
4. `POST /api/ai/cover-letter-generate` — Full 1-page cover letter generator (no retry)
5. `POST /api/ai/cover-letter-edit` — Full-letter or single-paragraph editorial rewrite (no retry, no `companyIntelligence`)
6. `POST /api/research/company` — Google Search grounding + 2h in-memory cache + 10-section report (no retry)
7. `POST /api/research/job-match` — 3-way profile × job × company match scoring (no retry)
8. `POST /api/review/analyze` — Deterministic fact/ATS audit + Gemini comprehensive scoring & findings (no retry)
9. `POST /api/review/regenerate-suggestion` — Alternative rewrite for one finding (no retry)
10. `POST /api/ai/companion/analyze` — Contextual field analysis + 2–6 interview questions (`withRetry` + `formatFriendlyAiError`)
11. `POST /api/ai/companion/adapt` — Adaptive remaining questions refinement (`withRetry` + `formatFriendlyAiError`)
12. `POST /api/ai/companion/generate` — Content generation + Pass 2 AI grounding audit + deterministic metric check (`withRetry` + `formatFriendlyAiError`)

### Client `localStorage` Keys (`/src/store/CareerContext.tsx`)
| Key | Entity |
|---|---|
| `ce_career_profile_v1` | Master `CareerProfile` |
| `ce_resumes_v1` | `ResumeDocument[]` |
| `ce_cover_letters_v1` | `CoverLetterDocument[]` |
| `ce_jobs_v1` | `JobApplication[]` |
| `ce_companies_v1` | `CompanyProfile[]` |
| `ce_company_research_v1` | `CompanyResearch[]` |
| `ce_job_matches_v1` | `JobMatch[]` |
| `ce_reviews_v1` | `ApplicationReviewRecord[]` |
| `ce_review_snapshots_v1` | `DocumentRevisionSnapshot[]` |
| `ce_ai_writing_history_v1` | `AIWritingSessionRecord[]` |

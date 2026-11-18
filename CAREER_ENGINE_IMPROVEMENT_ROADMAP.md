# Career Engine — Phased Improvement Roadmap

**Audit Date:** 2026-11-18  
**Goal:** Close P0/P1 reliability, data-integrity, and workflow gaps while building toward a complete, trustworthy career-management platform.

---

## Phase A — Immediate Stabilization & P0/P1 Bug Fixes (Target: Current Audit Cycle)

1. **Unified AI Reliability, Retry & Friendly Error Layer (`BUG-02`):**
   - Extract a shared `withAiRetry` + `formatFriendlyAiError` + HTTP status mapper (`429`, `503`, `500`) across all 11 Express endpoints in `server.ts`.
   - Stop retrying non-transient daily RPD quota errors (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`).
   - Add an `AbortController` timeout (`90s`) and clean user-facing error handling in `src/services/aiService.ts`.
2. **Fix AI Accuracy & Grounding Leaks (`BUG-01`, `BUG-03`, `BUG-08`):**
   - Remove `jobSummary` from `verifiedCorpus` inside `server/companionService.ts` `runDeterministicMetricCheck`.
   - Harden `buildApprovedCompanyIntelligencePayload` to exclude `pending` items by default (or clearly isolate approved vs unverified) and attach an explicit exclusion list for `dismissedFindings` so `report` text referencing dismissed claims cannot slip into AI drafts.
   - Pass `companyResearch` and `jobMatch` into `/api/ai/cover-letter-edit` from `CoverLetterModule.tsx`.
3. **Fix Undo Snapshots, Versioning & State Bugs (`BUG-05`, `BUG-06`, `BUG-07`, `BUG-14`, `BUG-16`):**
   - Fix `JobTrackerModule.tsx` `useEffect` dependency array and sync `selectedResumeForLetter` to valid/tailored resumes.
   - Record `DocumentRevisionSnapshot` and increment `version` on `ResumeBuilderModule` `handleApplyProposal` & `CoverLetterModule` `applyPendingReview`, and surface `"Undo Last AI Edit"` right in both Builders.
   - Make skill deduplication case-insensitive in `TagInputList` & `ResumeBuilderModule`, and add duplicate warning in `StringListEditor`.
   - Default `config` in `server/reviewService.ts:computeWeightedApplicationScore`.
4. **Template Export Parity & Cover Letter Justification Fix (`BUG-04`, `BUG-13`):**
   - Implement real visual template distinctions (`modern`, `professional`, `minimal`, `technical`, `creative`, `traditional`) across `resumeExport.ts` and `coverLetterExport.ts` (DOCX & PDF), remove the dead ternary in `coverLetterExport.ts:34`, and fix `jsPDF` paragraph justification.
5. **Expand Job Tracking Model & Add Employer Comparison (`BUG-09`, `BUG-10`, `BUG-11`):**
   - Add `jobUrl`, `deadline`, `salaryRange`, and `employmentType` to `JobApplication` and `JobTrackerModule` form + filters (employment type & duplicate listing detection).
   - Add a **Compare Employers** side-by-side view in `JobTrackerModule` allowing users to compare any two saved jobs / researched companies (culture, stack, compensation, arrangement, match score, strengths/gaps).

---

## Phase B — Core Product Expansion (Short-Term Sprint)

1. **Real Job Search & Discovery Integration (Scenario 11):**
   - Add a `Find Jobs` tab in `JobTrackerModule` backed by server-side search API / Google Search grounding job discovery (with location, salary range, employment type, remote/hybrid filters, duplicate detection against saved jobs, and one-click `"Save to Tracker"`).
2. **Form Validation & Profile Completeness Meter (Scenario 01/02):**
   - Add inline validation for email/URL/date formats and required fields (`Full Name`, `Company`, `Position`), plus a profile completeness checklist and stale-sync badge on derived resumes (`"Profile updated since last sync"`).
3. **Workspace JSON Backup & Restore (`BUG-17`):**
   - Add `"Export Workspace JSON"` and `"Import Backup"` in Document Manager / TopNav so `localStorage` data is portable and recoverable.

---

## Phase C — Quality Engineering & Long-Term Architecture

1. **Automated Test Suite (`Vitest` + `Supertest` + `Playwright`):**
   - Add `"test"` script in `package.json` running deterministic unit tests (`standardsEngine`, `reviewScoring`, `runDeterministicFactCheck`, `runDeterministicAtsValidation`, `runDeterministicMetricCheck`, `verifyAndRankSources`, export XML/PDF assertions) and mocked AI integration tests for every server route.
2. **Optional Cloud Persistence:**
   - Support optional server/Firebase/SQL persistence with multi-device sync while preserving fast local-first editing.
3. **AI Provider Abstraction (`BUG-18` & Multi-Provider Support):**
   - Consolidate redundant quick-assist buttons vs `AIWritingCompanion` and support configurable model/provider fallback tiers (`flash` fallback vs `pro` deep audit) when rate-limited.

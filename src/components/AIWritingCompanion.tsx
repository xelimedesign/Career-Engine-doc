import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  History,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import {
  AIWritingAnalyzeResponse,
  AIWritingGenerateResponse,
  AIWritingQuestion,
  AIWritingQuestionAnswer,
  AIWritingSessionRecord,
  AIWritingSuggestionEntry,
  CareerProfile,
  CompanionDocumentType,
  CompanionFieldType,
  CompanyResearch,
  JobApplication,
} from '../types/career';
import {
  adaptCompanionQuestionsWithAi,
  analyzeCompanionFieldWithAi,
  generateCompanionSuggestionWithAi,
} from '../services/aiService';
import { useOptionalCareer } from '../store/CareerContext';

export interface AIWritingCompanionProps {
  fieldType: CompanionFieldType;
  currentValue: string;
  documentType: CompanionDocumentType;
  careerProfile: CareerProfile;
  jobContext?: JobApplication;
  companyResearch?: CompanyResearch;
  onApply: (newValue: string) => void;
  onCancel: () => void;
  // Optional controlled & metadata props
  isOpen?: boolean;
  fieldKey?: string;
  fieldLabel?: string;
  documentId?: string;
  documentTitle?: string;
  documentVersion?: number;
  documentContext?: unknown;
  buttonLabel?: string;
  buttonClassName?: string;
}

type CompanionPhase = 'analyzing' | 'interview' | 'generating' | 'preview';

const FLAG_CATEGORY_LABELS: Record<string, string> = {
  invented_metric: 'Unverified Metric',
  unsupported_achievement: 'Unsupported Achievement',
  unverified_software: 'Unverified Tool / Skill',
  incorrect_date: 'Date Discrepancy',
  incorrect_employer: 'Employer / Experience Mismatch',
  unsupported_qualification: 'Unsupported Qualification',
};

export function AIWritingCompanion({
  fieldType,
  currentValue,
  documentType,
  careerProfile,
  jobContext,
  companyResearch,
  onApply,
  onCancel,
  isOpen: controlledIsOpen,
  fieldKey,
  fieldLabel,
  documentId,
  documentTitle,
  documentVersion,
  documentContext,
  buttonLabel = '✦ Improve with AI',
  buttonClassName,
}: AIWritingCompanionProps) {
  const careerCtx = useOptionalCareer();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledIsOpen === 'boolean';
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  const resolvedDocId = documentId || `${documentType}-default`;
  const resolvedFieldKey = fieldKey || fieldType;

  // Session & workflow state
  const [phase, setPhase] = useState<CompanionPhase>('analyzing');
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AIWritingAnalyzeResponse | null>(null);
  const [questions, setQuestions] = useState<AIWritingQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answersMap, setAnswersMap] = useState<Record<string, AIWritingQuestionAnswer>>({});
  const [adapting, setAdapting] = useState(false);
  const [adaptationNote, setAdaptationNote] = useState<string | null>(null);

  const [generated, setGenerated] = useState<AIWritingGenerateResponse | null>(null);
  const [draftSuggestion, setDraftSuggestion] = useState('');
  const [isEditingSuggestion, setIsEditingSuggestion] = useState(false);
  const [regenGuidance, setRegenGuidance] = useState('');
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const sessionRef = useRef<AIWritingSessionRecord | null>(null);
  const currentSuggestionIdRef = useRef<string | null>(null);
  const originalSnapshotRef = useRef<string>(currentValue);

  const fieldHistory = useMemo(() => {
    if (!careerCtx) return [];
    return careerCtx.aiWritingHistory.filter(
      (s) => s.documentId === resolvedDocId && s.fieldKey === resolvedFieldKey
    );
  }, [careerCtx, resolvedDocId, resolvedFieldKey]);

  const persistSession = useCallback(
    (updater: (prev: AIWritingSessionRecord) => AIWritingSessionRecord) => {
      if (!sessionRef.current) return;
      const updated = {
        ...updater(sessionRef.current),
        updatedAt: new Date().toISOString(),
      };
      sessionRef.current = updated;
      careerCtx?.upsertAiWritingSession(updated);
    },
    [careerCtx]
  );

  const startAnalysis = useCallback(async () => {
    originalSnapshotRef.current = currentValue;
    const now = new Date().toISOString();
    const newSession: AIWritingSessionRecord = {
      id: `aiw-${crypto.randomUUID().slice(0, 8)}`,
      documentType,
      documentId: resolvedDocId,
      documentTitle,
      documentVersion,
      fieldType,
      fieldKey: resolvedFieldKey,
      fieldLabel,
      originalContent: currentValue,
      answers: [],
      suggestions: [],
      status: 'in_progress',
      createdAt: now,
      updatedAt: now,
    };
    sessionRef.current = newSession;
    careerCtx?.upsertAiWritingSession(newSession);

    setPhase('analyzing');
    setError(null);
    setAnalysis(null);
    setQuestions([]);
    setCurrentIdx(0);
    setAnswersMap({});
    setAdaptationNote(null);
    setGenerated(null);
    setDraftSuggestion('');
    setIsEditingSuggestion(false);
    setRegenGuidance('');
    setShowHistory(false);

    try {
      const res = await analyzeCompanionFieldWithAi({
        fieldType,
        currentValue,
        fieldLabel,
        documentType,
        careerProfile,
        documentContext,
        jobContext,
        companyResearch,
      });
      setAnalysis(res);
      setQuestions(res.questions);

      // Initialize answer slots
      const initialAnswers: Record<string, AIWritingQuestionAnswer> = {};
      res.questions.forEach((q) => {
        initialAnswers[q.id] = {
          questionId: q.id,
          question: q.question,
          selectedChoices: [],
          customAnswer: '',
          combinedAnswer: '',
          skipped: false,
        };
      });
      setAnswersMap(initialAnswers);
      setPhase('interview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze field.');
      setPhase('interview');
    }
  }, [
    careerCtx,
    careerProfile,
    companyResearch,
    currentValue,
    documentContext,
    documentTitle,
    documentType,
    documentVersion,
    fieldLabel,
    fieldType,
    jobContext,
    resolvedDocId,
    resolvedFieldKey,
  ]);

  const handleOpen = () => {
    if (!isControlled) {
      setInternalOpen(true);
    }
    void startAnalysis();
  };

  // Trigger analysis automatically when opened via controlled prop
  const prevControlledOpenRef = useRef<boolean>(false);
  useEffect(() => {
    if (isControlled && controlledIsOpen && !prevControlledOpenRef.current) {
      void startAnalysis();
    }
    prevControlledOpenRef.current = Boolean(controlledIsOpen);
  }, [controlledIsOpen, isControlled, startAnalysis]);

  const closeAndCancel = useCallback(() => {
    if (sessionRef.current && sessionRef.current.status === 'in_progress') {
      persistSession((prev) => ({ ...prev, status: 'cancelled' }));
    }
    if (!isControlled) {
      setInternalOpen(false);
    }
    onCancel();
  }, [isControlled, onCancel, persistSession]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAndCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeAndCancel, isOpen]);

  const currentQuestion = questions[currentIdx];
  const currentAnswer: AIWritingQuestionAnswer | undefined = currentQuestion
    ? answersMap[currentQuestion.id]
    : undefined;

  const buildCombinedAnswer = (selected: string[], custom: string): string => {
    const parts = [...selected];
    if (custom.trim()) parts.push(custom.trim());
    return parts.join('; ');
  };

  const updateCurrentAnswer = (patch: Partial<AIWritingQuestionAnswer>) => {
    if (!currentQuestion) return;
    setAnswersMap((prev) => {
      const existing = prev[currentQuestion.id] || {
        questionId: currentQuestion.id,
        question: currentQuestion.question,
        selectedChoices: [],
        customAnswer: '',
        combinedAnswer: '',
        skipped: false,
      };
      const nextSelected = patch.selectedChoices ?? existing.selectedChoices;
      const nextCustom = patch.customAnswer ?? existing.customAnswer;
      const nextSkipped = patch.skipped ?? false;
      const updated: AIWritingQuestionAnswer = {
        ...existing,
        ...patch,
        selectedChoices: nextSelected,
        customAnswer: nextCustom,
        combinedAnswer: nextSkipped ? '' : buildCombinedAnswer(nextSelected, nextCustom),
        skipped: nextSkipped,
      };
      const nextMap = { ...prev, [currentQuestion.id]: updated };
      persistSession((s) => ({
        ...s,
        answers: Object.values(nextMap),
      }));
      return nextMap;
    });
  };

  const toggleChoice = (choice: string) => {
    if (!currentQuestion || !currentAnswer) return;
    const exists = currentAnswer.selectedChoices.includes(choice);
    let nextSelected: string[];
    if (currentQuestion.allowMultipleChoices) {
      nextSelected = exists
        ? currentAnswer.selectedChoices.filter((c) => c !== choice)
        : [...currentAnswer.selectedChoices, choice];
    } else {
      nextSelected = exists ? [] : [choice];
    }
    updateCurrentAnswer({ selectedChoices: nextSelected, skipped: false });
  };

  const runGeneration = async (
    overrideAnswers?: AIWritingQuestionAnswer[],
    instruction?: string
  ) => {
    setPhase('generating');
    setError(null);
    setIsEditingSuggestion(false);

    const qaPairs =
      overrideAnswers ||
      questions.map(
        (q) =>
          answersMap[q.id] || {
            questionId: q.id,
            question: q.question,
            selectedChoices: [],
            customAnswer: '',
            combinedAnswer: '',
            skipped: true,
          }
      );

    try {
      const res = await generateCompanionSuggestionWithAi({
        fieldType,
        currentValue: originalSnapshotRef.current,
        fieldLabel,
        documentType,
        careerProfile,
        documentContext,
        jobContext,
        companyResearch,
        qaPairs,
        regenerationInstruction: instruction?.trim() || undefined,
      });

      const entryId = `sug-${crypto.randomUUID().slice(0, 8)}`;
      currentSuggestionIdRef.current = entryId;
      const entry: AIWritingSuggestionEntry = {
        id: entryId,
        generatedAt: new Date().toISOString(),
        suggestedText: res.suggestedContent,
        changes: res.changes,
        validationStatus: res.validation.status,
        validationFlags: res.validation.flags,
        status: 'pending',
      };

      persistSession((prev) => ({
        ...prev,
        answers: qaPairs,
        suggestions: [entry, ...prev.suggestions],
      }));

      setGenerated(res);
      setDraftSuggestion(res.suggestedContent);
      setPhase('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate writing suggestion.');
      setPhase(generated ? 'preview' : 'interview');
    }
  };

  const handleNextOrAdapt = async (skipCurrent = false) => {
    if (!currentQuestion) {
      await runGeneration();
      return;
    }

    const updatedAnswers = { ...answersMap };
    const existing = updatedAnswers[currentQuestion.id] || {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      selectedChoices: [],
      customAnswer: '',
      combinedAnswer: '',
      skipped: false,
    };

    const nextEntry: AIWritingQuestionAnswer = skipCurrent
      ? { ...existing, skipped: true, combinedAnswer: '' }
      : {
          ...existing,
          skipped:
            !existing.customAnswer.trim() && existing.selectedChoices.length === 0
              ? true
              : false,
          combinedAnswer: buildCombinedAnswer(existing.selectedChoices, existing.customAnswer),
        };
    updatedAnswers[currentQuestion.id] = nextEntry;
    setAnswersMap(updatedAnswers);

    const allAnswersList = questions.map((q) => updatedAnswers[q.id]).filter(Boolean);
    persistSession((prev) => ({ ...prev, answers: allAnswersList }));

    const nextIdx = currentIdx + 1;
    if (nextIdx >= questions.length) {
      await runGeneration(allAnswersList);
      return;
    }

    // Adapt remaining questions based on previous answers
    const answeredSoFar = questions
      .slice(0, nextIdx)
      .map((q) => updatedAnswers[q.id])
      .filter(Boolean);
    const remaining = questions.slice(nextIdx);

    if (!skipCurrent && nextEntry.combinedAnswer.trim() && remaining.length > 0) {
      setAdapting(true);
      try {
        const adapted = await adaptCompanionQuestionsWithAi({
          fieldType,
          currentValue: originalSnapshotRef.current,
          fieldLabel,
          documentType,
          careerProfile,
          documentContext,
          jobContext,
          companyResearch,
          answeredQuestions: answeredSoFar,
          remainingQuestions: remaining,
        });

        const nextQuestions = [...questions.slice(0, nextIdx), ...adapted.questions];
        setQuestions(nextQuestions);
        if (adapted.adaptationNote) {
          setAdaptationNote(adapted.adaptationNote);
        }
        // Ensure answer map has slots for any adapted questions
        setAnswersMap((prev) => {
          const copy = { ...prev };
          adapted.questions.forEach((aq) => {
            if (!copy[aq.id]) {
              copy[aq.id] = {
                questionId: aq.id,
                question: aq.question,
                selectedChoices: [],
                customAnswer: '',
                combinedAnswer: '',
                skipped: false,
              };
            }
          });
          return copy;
        });
      } catch {
        // Non-fatal: continue smoothly with existing remaining questions
      } finally {
        setAdapting(false);
      }
    }

    setCurrentIdx(nextIdx);
  };

  const handlePrevious = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const handleApply = () => {
    const finalText = draftSuggestion.trim() || generated?.suggestedContent || '';
    if (!finalText) return;

    // Record compatible DocumentRevisionSnapshot before applying to Resume or Cover Letter
    if (
      careerCtx &&
      sessionRef.current &&
      (documentType === 'resume' || documentType === 'cover-letter') &&
      documentId
    ) {
      careerCtx.recordDocumentSnapshot(
        documentType,
        documentId,
        sessionRef.current.id,
        `Before AI Companion: ${fieldLabel || fieldType}${documentVersion ? ` (v${documentVersion})` : ''}`
      );
    }

    persistSession((prev) => ({
      ...prev,
      status: 'accepted',
      acceptedContent: finalText,
      suggestions: prev.suggestions.map((s) =>
        s.id === currentSuggestionIdRef.current
          ? {
              ...s,
              editedText: finalText !== s.suggestedText ? finalText : undefined,
              status: 'accepted',
              resolvedAt: new Date().toISOString(),
            }
          : s
      ),
    }));

    if (!isControlled) {
      setInternalOpen(false);
    }
    onApply(finalText);
  };

  const handleReject = () => {
    persistSession((prev) => ({
      ...prev,
      status: 'rejected',
      suggestions: prev.suggestions.map((s) =>
        s.id === currentSuggestionIdRef.current
          ? { ...s, status: 'rejected', resolvedAt: new Date().toISOString() }
          : s
      ),
    }));
    if (!isControlled) {
      setInternalOpen(false);
    }
    onCancel();
  };

  const handleRestoreOriginal = () => {
    setDraftSuggestion(originalSnapshotRef.current);
    setIsEditingSuggestion(false);
    persistSession((prev) => ({
      ...prev,
      status: 'restored',
      suggestions: prev.suggestions.map((s) =>
        s.id === currentSuggestionIdRef.current
          ? { ...s, status: 'restored', resolvedAt: new Date().toISOString() }
          : s
      ),
    }));
    onApply(originalSnapshotRef.current);
    if (!isControlled) {
      setInternalOpen(false);
    }
  };

  const handleCopy = async () => {
    const text = draftSuggestion || generated?.suggestedContent || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  const progressPct =
    questions.length > 0 ? Math.round(((currentIdx + 1) / questions.length) * 100) : 100;

  return (
    <>
      {!isControlled && (
        <button
          type="button"
          onClick={handleOpen}
          data-ai-companion-trigger={fieldType}
          className={
            buttonClassName ||
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-900 hover:text-slate-900 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0'
          }
        >
          {buttonLabel}
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`AI Writing Companion for ${fieldType}`}
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-slate-700 shrink-0" />
                  <h3 className="text-base font-semibold text-slate-900 truncate">
                    AI Writing Companion · {fieldType}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
                  {fieldLabel && <span>{fieldLabel}</span>}
                  {fieldLabel && <span aria-hidden="true">·</span>}
                  <span className="capitalize">{documentType.replace('-', ' ')}</span>
                  {jobContext?.company && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        Target: {jobContext.jobTitle} at {jobContext.company}
                      </span>
                    </>
                  )}
                  {companyResearch?.status === 'completed' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-800">Company Intel Loaded</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {fieldHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowHistory((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border cursor-pointer whitespace-nowrap ${
                      showHistory
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    History ({fieldHistory.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeAndCancel}
                  aria-label="Close AI Writing Companion"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start justify-between gap-3">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => void startAnalysis()}
                    className="text-xs font-semibold underline shrink-0 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* History Panel */}
              {showHistory ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-900">
                      Saved Writing Sessions for This Field
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowHistory(false)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 underline cursor-pointer"
                    >
                      Back to Assistant
                    </button>
                  </div>
                  {fieldHistory.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/70 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
                        <span className="font-mono-tabular">
                          {new Date(sess.createdAt).toLocaleString()}
                        </span>
                        <span className="capitalize font-medium text-slate-700">
                          Status: {sess.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Original: </span>
                        <span className="text-slate-600">
                          {sess.originalContent || '(Empty)'}
                        </span>
                      </div>
                      {sess.acceptedContent && (
                        <div>
                          <span className="font-semibold text-emerald-800">Applied: </span>
                          <span className="text-slate-900">{sess.acceptedContent}</span>
                        </div>
                      )}
                      {sess.suggestions.length > 0 && (
                        <div className="text-slate-500">
                          {sess.suggestions.length} suggestion
                          {sess.suggestions.length > 1 ? 's' : ''} generated ·{' '}
                          {sess.answers.filter((a) => !a.skipped && a.combinedAnswer).length}{' '}
                          question{sess.answers.filter((a) => !a.skipped && a.combinedAnswer).length === 1 ? '' : 's'} answered
                        </div>
                      )}
                      {sess.originalContent && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              onApply(sess.originalContent);
                              if (!isControlled) setInternalOpen(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore This Original
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : phase === 'analyzing' ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-slate-700 animate-spin mx-auto" />
                  <div className="text-sm font-medium text-slate-900">
                    Reviewing your {fieldType} and Career Profile...
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Checking verified experience, skills, and target job context so we only ask helpful, non-repetitive questions.
                  </p>
                </div>
              ) : phase === 'generating' ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-slate-700 animate-spin mx-auto" />
                  <div className="text-sm font-medium text-slate-900">
                    Drafting improved {fieldType} &amp; validating facts...
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Checking every metric, tool, date, and qualification against your Career Profile and answers.
                  </p>
                </div>
              ) : phase === 'interview' && analysis ? (
                <div className="space-y-5">
                  {/* AI Assistant Introduction */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-900">
                      Writing Coach Introduction
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {analysis.assistantIntro}
                    </p>

                    {analysis.knownFacts.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800">
                          Already verified from your profile &amp; entry:{' '}
                        </span>
                        {analysis.knownFacts.slice(0, 4).join(' · ')}
                      </div>
                    )}

                    {analysis.hasEnoughInformation && (
                      <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-emerald-800 font-medium">
                          Enough verified details already exist to improve this directly, or answer below to fine-tune.
                        </span>
                        <button
                          type="button"
                          onClick={() => void runGeneration()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer whitespace-nowrap"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Generate Suggestion Now
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress Indicator */}
                  {questions.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 font-mono-tabular">
                          Question {currentIdx + 1} of {questions.length}
                        </span>
                        <span className="text-slate-500 font-mono-tabular">{progressPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-900 transition-all duration-200"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {adaptationNote && (
                    <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                      {adaptationNote}
                    </div>
                  )}

                  {/* Active Question */}
                  {currentQuestion && currentAnswer ? (
                    <div className="p-4 border border-slate-200 rounded-lg bg-white space-y-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                          {currentQuestion.question}
                        </h4>
                        {currentQuestion.purpose && (
                          <p className="text-xs text-slate-500">{currentQuestion.purpose}</p>
                        )}
                      </div>

                      {currentQuestion.choices.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[11px] font-medium text-slate-500">
                            Suggested choices{' '}
                            {currentQuestion.allowMultipleChoices
                              ? '(select any that apply)'
                              : '(select one)'}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {currentQuestion.choices.map((choice) => {
                              const selected = currentAnswer.selectedChoices.includes(choice);
                              return (
                                <button
                                  key={choice}
                                  type="button"
                                  onClick={() => toggleChoice(choice)}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-md border text-left transition-colors cursor-pointer ${
                                    selected
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                                  }`}
                                >
                                  {choice}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-600">
                          Your answer (optional custom details)
                        </label>
                        <textarea
                          rows={3}
                          value={currentAnswer.customAnswer}
                          onChange={(e) =>
                            updateCurrentAnswer({ customAnswer: e.target.value, skipped: false })
                          }
                          placeholder={currentQuestion.placeholder}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 leading-relaxed"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-slate-200 rounded-lg text-xs text-slate-600">
                      Ready to generate your improved {fieldType}. Click{' '}
                      <strong>Generate Suggestion</strong> below to preview.
                    </div>
                  )}
                </div>
              ) : phase === 'preview' && generated ? (
                <div className="space-y-4">
                  {/* Accuracy Validation Status */}
                  {generated.validation.status === 'warnings_found' &&
                  generated.validation.flags.length > 0 ? (
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        Accuracy Check Flagged {generated.validation.flags.length} Item
                        {generated.validation.flags.length > 1 ? 's' : ''} for Verification
                      </div>
                      <p className="text-xs text-amber-800">{generated.validation.summary}</p>
                      <div className="space-y-2 pt-1">
                        {generated.validation.flags.map((flag) => (
                          <div
                            key={flag.id}
                            className="p-2.5 bg-white border border-amber-200 rounded text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-900">
                                {FLAG_CATEGORY_LABELS[flag.category] || 'Verification Needed'}: &ldquo;
                                {flag.claim}&rdquo;
                              </span>
                              <span className="text-[11px] font-medium text-amber-800 uppercase">
                                {flag.severity}
                              </span>
                            </div>
                            <p className="text-slate-600">{flag.reason}</p>
                            <p className="text-amber-900 font-medium">{flag.clarificationPrompt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{generated.validation.summary}</span>
                    </div>
                  )}

                  {/* Side-by-Side Comparison: ORIGINAL vs AI SUGGESTION */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 space-y-1.5">
                      <div className="font-semibold text-slate-600 tracking-wide">ORIGINAL</div>
                      <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {originalSnapshotRef.current.trim() || '(Empty field)'}
                      </div>
                    </div>

                    <div className="border border-emerald-200 rounded-lg p-3.5 bg-emerald-50/40 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-emerald-900 tracking-wide">
                          AI SUGGESTION
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsEditingSuggestion((v) => !v)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 underline cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          {isEditingSuggestion ? 'Done Editing' : 'Edit Suggestion'}
                        </button>
                      </div>

                      {isEditingSuggestion ? (
                        <textarea
                          rows={6}
                          value={draftSuggestion}
                          onChange={(e) => setDraftSuggestion(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-slate-900 leading-relaxed"
                        />
                      ) : (
                        <div className="text-slate-900 whitespace-pre-wrap leading-relaxed">
                          {draftSuggestion}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CHANGES Explanation */}
                  {generated.changes.length > 0 && (
                    <div className="border border-slate-200 rounded-lg p-3.5 bg-white space-y-1.5 text-xs">
                      <div className="font-semibold text-slate-900 tracking-wide">CHANGES</div>
                      <ul className="list-disc pl-5 text-slate-700 space-y-1">
                        {generated.changes.map((c, idx) => (
                          <li key={idx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Optional guidance for Regenerate */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={regenGuidance}
                      onChange={(e) => setRegenGuidance(e.target.value)}
                      placeholder="Optional note to adjust tone, length, or remove a flagged item..."
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => void runGeneration(undefined, regenGuidance)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Regenerate
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer Controls */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              {phase === 'interview' && !showHistory ? (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeAndCancel}
                      className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={currentIdx === 0 || adapting}
                      onClick={handlePrevious}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Previous
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {questions.length > 0 && (
                      <button
                        type="button"
                        disabled={adapting}
                        onClick={() => void handleNextOrAdapt(true)}
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-md cursor-pointer whitespace-nowrap"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        Skip Question
                      </button>
                    )}

                    {questions.length > 0 && currentIdx < questions.length - 1 ? (
                      <button
                        type="button"
                        disabled={adapting}
                        onClick={() => void handleNextOrAdapt(false)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md cursor-pointer whitespace-nowrap"
                      >
                        {adapting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                        {adapting ? 'Adapting...' : 'Next Question'}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      disabled={adapting}
                      onClick={() => void runGeneration()}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap ${
                        questions.length === 0 || currentIdx >= questions.length - 1
                          ? 'text-white bg-slate-900 hover:bg-slate-800'
                          : 'text-slate-800 bg-slate-200 hover:bg-slate-300'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Suggestion
                    </button>
                  </div>
                </>
              ) : phase === 'preview' && !showHistory ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={closeAndCancel}
                      className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={handleRestoreOriginal}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore Original
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void runGeneration(undefined, regenGuidance)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={handleApply}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Apply Changes
                    </button>
                  </div>
                </>
              ) : (
                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={closeAndCancel}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

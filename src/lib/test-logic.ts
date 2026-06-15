
import type {
  FamatTest,
  FamatSolution,
  AnyFamatTest,
  UserAnswers,
  ScoreReport,
  FamatTestBase,
  TestSubmission,
  FamatTestWithHistory,
} from './types';
import famatTests from '@/data/famat_tests.json';

const allTests: AnyFamatTest[] = famatTests as AnyFamatTest[];

/**
 * Generates a unique, URL-friendly ID for a test.
 */
export function getTestId(test: FamatTestBase): string {
  const monthPart = test.month ? `-${test.month}` : '';
  return `${test.year}${monthPart}-${test.division}-${test.test_type}-${test.format}`
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[()]/g, '');
}

/**
 * Generates a human-readable name for a test.
 * e.g., "2022 Statistics January Regional Individual"
 */
export function getTestName(test: FamatTestBase): string {
  const monthPart = test.month ? ` ${test.month}` : '';
  return `${test.year}${monthPart} ${getDivisionLabel(test.division)} ${test.test_type} ${test.format}`;
}

export const DIVISIONS = ['Stats', 'Alpha', 'Mu', 'Theta', 'Alg2', 'Geo', 'Alg1'] as const;

export function getDivisionLabel(division: string): string {
  if (division === 'Alg1') return 'Algebra I';
  if (division === 'Alg2') return 'Algebra II';
  if (division === 'Geo') return 'Geometry';
  return division;
}

/** Compact division label for narrow grid columns. */
export function getDivisionShortLabel(division: string): string {
  if (division === 'Alg1') return 'Alg1';
  if (division === 'Alg2') return 'Alg2';
  if (division === 'Geo') return 'Geo';
  return division;
}

/**
 * Finds the corresponding solution object for a given test object.
 */
export function findSolutionForTest(
  test: FamatTest
): FamatSolution | undefined {
  return allTests.find(
    (item) =>
      item.document_type === 'Solution' &&
      item.year === test.year &&
      item.month === test.month &&
      item.division === test.division &&
      item.test_type === test.test_type &&
      item.format === test.format
  ) as FamatSolution | undefined;
}

const solutionByTestId = new Map<string, FamatSolution>();
for (const item of allTests) {
  if (item.document_type !== 'Test') continue;
  const solution = findSolutionForTest(item as FamatTest);
  if (solution) {
    solutionByTestId.set(getTestId(item), solution);
  }
}

/** O(1) solution lookup by practice test id. */
export function findSolutionByTestId(
  testId: string
): FamatSolution | undefined {
  return solutionByTestId.get(testId);
}

export function answerKeyValuesEqual(
  a: string | string[] | null | undefined,
  b: string | string[] | null | undefined
): boolean {
  if (a == null || b == null) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function trimAnswerKey(
  answerKey: (string | string[] | null | undefined)[]
): (string | string[])[] {
  const trimmed = [...answerKey];
  while (trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1];
    if (last === null || last === undefined) {
      trimmed.pop();
    } else {
      break;
    }
  }
  return trimmed as (string | string[])[];
}

function isGradableAnswer(answer: string | string[] | null | undefined): answer is string | string[] {
  return answer !== null && answer !== undefined;
}

/**
 * Grades the user's answers against the correct answer key.
 * Supports multiple correct answers if the answer key contains an array of strings.
 * FAMAT scoring: 5 for correct, 1 for omitted, 0 for incorrect
 * Skips answer-key slots without a defined correct answer (e.g. "throw" rows).
 */
export function gradeTest(
  userAnswers: UserAnswers,
  answerKey: (string | string[] | null | undefined)[]
): ScoreReport {
  let correctCount = 0;
  let incorrectCount = 0;
  let omitCount = 0;
  
  for (let i = 0; i < answerKey.length; i++) {
    const correctAnswer = answerKey[i];
    if (!isGradableAnswer(correctAnswer)) {
      continue;
    }

    const questionNumber = i + 1;
    const userAnswer = userAnswers[questionNumber];

    if (userAnswer === undefined || userAnswer === null) {
      omitCount++;
    } else {
      if (Array.isArray(correctAnswer)) {
        if (correctAnswer.includes(userAnswer)) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      } else {
        if (userAnswer === correctAnswer) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    }
  }

  // FAMAT scoring: 5 for correct, 1 for omitted, 0 for incorrect
  const totalScore = (correctCount * 5) + (omitCount * 1);

  return { totalScore, correctCount, incorrectCount, omitCount };
}

/**
 * Build the answer sheet for retake submit. Only explicitly answered questions
 * count; null/undefined/missing entries are omitted (not carried from source).
 */
export function buildRetakeSubmitAnswers(
  currentAnswers: UserAnswers,
  explicitlyOmitted?: Iterable<number>
): UserAnswers {
  const result: UserAnswers = {};
  for (const [key, value] of Object.entries(currentAnswers)) {
    const q = Number(key);
    if (value !== null && value !== undefined) {
      result[q] = value;
    }
  }
  if (explicitlyOmitted) {
    for (const q of explicitlyOmitted) {
      delete result[q];
    }
  }
  return result;
}

/** Legacy: merge source attempt with a stored delta (pre-full-save retakes). */
export function mergeLegacyRetakeDelta(
  originalAnswers: UserAnswers,
  deltaAnswers: UserAnswers
): UserAnswers {
  const result = { ...originalAnswers };
  for (const [key, value] of Object.entries(deltaAnswers)) {
    const q = Number(key);
    if (value === null || value === undefined) {
      delete result[q];
    } else {
      result[q] = value;
    }
  }
  return result;
}

/** @deprecated Use buildRetakeSubmitAnswers for new retake submits. */
export function mergeRetakeAnswers(
  originalAnswers: UserAnswers,
  currentAnswers: UserAnswers
): UserAnswers {
  return mergeLegacyRetakeDelta(originalAnswers, currentAnswers);
}

function scoresMatch(a: ScoreReport, b: ScoreReport): boolean {
  return (
    a.totalScore === b.totalScore &&
    a.correctCount === b.correctCount &&
    a.incorrectCount === b.incorrectCount &&
    a.omitCount === b.omitCount
  );
}

/** Per-question overrides keyed by 1-based question number (future admin corrections). */
export type AnswerKeyOverrides = Record<number, string | string[]>;

/** Current answer key for grading/display (JSON base + optional overrides). */
export function getEffectiveAnswerKey(
  baseKey: (string | string[] | null | undefined)[],
  overrides?: AnswerKeyOverrides
): (string | string[])[] {
  const effective = trimAnswerKey(baseKey);
  if (!overrides || Object.keys(overrides).length === 0) return effective;
  const result = [...effective];
  for (const [qStr, answer] of Object.entries(overrides)) {
    const idx = Number(qStr) - 1;
    if (idx >= 0 && idx < result.length) {
      result[idx] = answer;
    }
  }
  return result;
}

export function getCatalogAnswerForQuestion(
  testId: string,
  questionNumber: number
): string | string[] | null {
  const solution = findSolutionByTestId(testId);
  if (!solution || questionNumber < 1) return null;
  const answer = solution.answers[questionNumber - 1];
  if (answer === null || answer === undefined) return null;
  return answer;
}

export function getEffectiveAnswerForQuestion(
  testId: string,
  questionNumber: number,
  overrides?: AnswerKeyOverrides
): string | string[] | null {
  const solution = findSolutionByTestId(testId);
  if (!solution || questionNumber < 1) return null;
  const key = getEffectiveAnswerKey(solution.answers, overrides);
  const answer = key[questionNumber - 1];
  if (answer === null || answer === undefined) return null;
  return answer;
}

function countExplicitAnswers(answers: UserAnswers): number {
  return Object.values(answers).filter(
    (v) => v !== null && v !== undefined
  ).length;
}

function findRetakeBaseAnswers(
  retake: TestSubmission,
  allSubmissions: TestSubmission[]
): UserAnswers | undefined {
  if (retake.retakeSourceSubmissionId) {
    return allSubmissions.find(
      (s) => s.id === retake.retakeSourceSubmissionId
    )?.answers;
  }
  const idx = allSubmissions.findIndex((s) => s.id === retake.id);
  if (idx >= 0 && idx + 1 < allSubmissions.length) {
    return allSubmissions[idx + 1].answers;
  }
  return undefined;
}

/**
 * Full merged answers for display/review. New retakes store the complete attempt;
 * legacy retakes stored only a delta and must be merged with the source attempt.
 */
export function resolveRetakeDisplayAnswers(
  retake: TestSubmission,
  allSubmissions: TestSubmission[],
  answerKey: (string | string[])[]
): UserAnswers {
  if (!retake.isRetake) return retake.answers;

  const keyLen = trimAnswerKey(answerKey).length;
  const explicitCount = countExplicitAnswers(retake.answers);
  const directGrade = gradeTest(retake.answers, answerKey);

  // New-format retakes: full answer sheet matched stored score at submit time.
  if (scoresMatch(directGrade, retake.score)) {
    return retake.answers;
  }

  const base = findRetakeBaseAnswers(retake, allSubmissions);
  if (!base) return retake.answers;

  const merged = mergeLegacyRetakeDelta(base, retake.answers);
  const mergedGrade = gradeTest(merged, answerKey);

  // Legacy delta: few explicit answers, or grading delta alone omits far more.
  const looksLikeLegacyDelta =
    explicitCount < keyLen * 0.4 ||
    directGrade.omitCount > mergedGrade.omitCount + 3;

  if (looksLikeLegacyDelta) {
    return merged;
  }

  return retake.answers;
}

/**
 * Lazy regrade: always grade from stored answers against the current answer key.
 * Falls back to stored score only when no key is available.
 */
export function resolveSubmissionDisplayScore(
  submission: TestSubmission,
  allSubmissions: TestSubmission[],
  answerKey: (string | string[] | null | undefined)[] | undefined,
  overrides?: AnswerKeyOverrides
): ScoreReport {
  if (!answerKey) return submission.score;

  const effectiveKey = getEffectiveAnswerKey(answerKey, overrides);
  const answers = submission.isRetake
    ? resolveRetakeDisplayAnswers(submission, allSubmissions, effectiveKey)
    : submission.answers;
  return gradeTest(answers, effectiveKey);
}

/** @deprecated Use resolveSubmissionDisplayScore */
export function resolveRetakeDisplayScore(
  submission: TestSubmission,
  allSubmissions: TestSubmission[],
  answerKey: (string | string[])[] | undefined
): ScoreReport {
  return resolveSubmissionDisplayScore(submission, allSubmissions, answerKey);
}

export type LatestDisplayAttempt = {
  answers: UserAnswers;
  score: ScoreReport;
  /** Unsubmitted session (practice or retake in progress). */
  isLiveSession: boolean;
  isRetake?: boolean;
};

/**
 * Most recent attempt for progress grid / summaries: latest submitted attempt
 * (including retakes), else practice in progress if no history exists.
 */
export function getLatestDisplayAttempt(
  test: Pick<FamatTestWithHistory, 'history' | 'inProgress'>,
  solution: FamatSolution,
  overrides?: AnswerKeyOverrides
): LatestDisplayAttempt | null {
  const history = [...test.history].sort(
    (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
  );
  if (history.length > 0) {
    const latest = history[0];
    const effectiveKey = getEffectiveAnswerKey(solution.answers, overrides);
    const answers = latest.isRetake
      ? resolveRetakeDisplayAnswers(latest, history, effectiveKey)
      : latest.answers;
    const score = resolveSubmissionDisplayScore(
      latest,
      history,
      solution.answers,
      overrides
    );
    return {
      answers,
      score,
      isLiveSession: false,
      isRetake: latest.isRetake,
    };
  }

  if (test.inProgress !== undefined) {
    const answers = test.inProgress;
    const effectiveKey = getEffectiveAnswerKey(solution.answers, overrides);
    return {
      answers,
      score: gradeTest(answers, effectiveKey),
      isLiveSession: true,
      isRetake: false,
    };
  }

  return null;
}

export function buildRetakePracticeUrl(
  testId: string,
  submission: Pick<TestSubmission, 'id' | 'answers'>,
  options?: { continueSession?: boolean }
): string {
  if (options?.continueSession) {
    return `/practice/${testId}?retake=true&continue=true`;
  }
  const submissionData = encodeURIComponent(JSON.stringify(submission.answers));
  return `/practice/${testId}?retake=true&submissionId=${submission.id}&submission=${submissionData}`;
}

/** Read-only test + solutions viewer (no scantron). */
export function buildBrowseTestUrl(
  testId: string,
  returnTo = '/admin/answer-keys'
): string {
  const safeReturn =
    returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/admin/answer-keys';
  return `/practice/${testId}?browse=true&returnTo=${encodeURIComponent(safeReturn)}`;
}

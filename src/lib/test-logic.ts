
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
  return `${test.year}${monthPart} ${test.division} ${test.test_type} ${test.format}`;
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


/**
 * Grades the user's answers against the correct answer key.
 * Supports multiple correct answers if the answer key contains an array of strings.
 * FAMAT scoring: 5 for correct, 1 for omitted, 0 for incorrect
 */
export function gradeTest(
  userAnswers: UserAnswers,
  answerKey: (string | string[])[]
): ScoreReport {
  let correctCount = 0;
  let incorrectCount = 0;
  let omitCount = 0;
  
  for (let i = 0; i < answerKey.length; i++) {
    const questionNumber = i + 1;
    const userAnswer = userAnswers[questionNumber];
    const correctAnswer = answerKey[i];

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

  const directGrade = gradeTest(retake.answers, answerKey);
  if (scoresMatch(directGrade, retake.score)) {
    return retake.answers;
  }

  let base: UserAnswers | undefined;
  if (retake.retakeSourceSubmissionId) {
    base = allSubmissions.find(
      (s) => s.id === retake.retakeSourceSubmissionId
    )?.answers;
  }
  if (!base) {
    const idx = allSubmissions.findIndex((s) => s.id === retake.id);
    if (idx >= 0 && idx + 1 < allSubmissions.length) {
      base = allSubmissions[idx + 1].answers;
    }
  }
  if (!base) return retake.answers;
  return mergeLegacyRetakeDelta(base, retake.answers);
}

/** Score for a submission row; retakes use stored score when answers are complete. */
export function resolveRetakeDisplayScore(
  submission: TestSubmission,
  allSubmissions: TestSubmission[],
  answerKey: (string | string[])[] | undefined
): ScoreReport {
  if (!submission.isRetake || !answerKey) return submission.score;

  const answers = resolveRetakeDisplayAnswers(
    submission,
    allSubmissions,
    answerKey
  );
  const resolved = gradeTest(answers, answerKey);
  if (scoresMatch(resolved, submission.score)) {
    return submission.score;
  }
  return resolved;
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
  solution: FamatSolution
): LatestDisplayAttempt | null {
  const history = [...test.history].sort(
    (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
  );
  if (history.length > 0) {
    const latest = history[0];
    const answers = latest.isRetake
      ? resolveRetakeDisplayAnswers(latest, history, solution.answers)
      : latest.answers;
    const score = latest.isRetake
      ? resolveRetakeDisplayScore(latest, history, solution.answers)
      : latest.score;
    return {
      answers,
      score,
      isLiveSession: false,
      isRetake: latest.isRetake,
    };
  }

  if (test.inProgress !== undefined) {
    const answers = test.inProgress;
    return {
      answers,
      score: gradeTest(answers, solution.answers),
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

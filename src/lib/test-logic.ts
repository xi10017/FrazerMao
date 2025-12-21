import type {
  FamatTest,
  FamatSolution,
  AnyFamatTest,
  UserAnswers,
  ScoreReport,
  FamatTestBase,
} from './types';
import famatTests from '@/data/famat_tests.json';

const allTests: AnyFamatTest[] = famatTests as AnyFamatTest[];

/**
 * Generates a unique, URL-friendly ID for a test.
 */
export function getTestId(test: FamatTestBase): string {
  return `${test.year}-${test.month}-${test.division}-${test.test_type}-${test.format}`
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Generates a human-readable name for a test.
 * e.g., "2022 Statistics January Regional Individual"
 */
export function getTestName(test: FamatTestBase): string {
  return `${test.year} ${test.division} ${test.month} ${test.test_type} ${test.format}`;
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
      item.test_type === test.test_type
  ) as FamatSolution | undefined;
}


/**
 * Grades the user's answers against the correct answer key.
 * Correct: +5 points
 * Blank: +1 point
 * Incorrect: 0 points
 */
export function gradeTest(
  userAnswers: UserAnswers,
  answerKey: string[]
): ScoreReport {
  let correctCount = 0;
  let incorrectCount = 0;
  let omitCount = 0;
  let totalScore = 0;

  for (let i = 0; i < answerKey.length; i++) {
    const questionNumber = i + 1;
    const userAnswer = userAnswers[questionNumber];
    const correctAnswer = answerKey[i];

    if (userAnswer === undefined || userAnswer === null) {
      omitCount++;
      totalScore += 1;
    } else if (userAnswer === correctAnswer) {
      correctCount++;
      totalScore += 5;
    } else {
      incorrectCount++;
    }
  }

  return { totalScore, correctCount, incorrectCount, omitCount };
}

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
    .replace(/\s+/g, '-')
    .replace(/[()]/g, '');
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
      item.test_type === test.test_type &&
      item.format === test.format
  ) as FamatSolution | undefined;
}


/**
 * Grades the user's answers against the correct answer key.
 * Correct: +4 points
 * Blank: 0 points
 * Incorrect: -1 point
 * This is a common scoring system in some formats, adjust if needed.
 * For FAMAT: Correct: 5, Blank: 1, Incorrect: 0
 */
export function gradeTest(
  userAnswers: UserAnswers,
  answerKey: string[]
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
    } else if (userAnswer === correctAnswer) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }

  // FAMAT scoring: 5 for correct, 1 for omitted, 0 for incorrect
  const totalScore = (correctCount * 5) + (omitCount * 1);

  return { totalScore, correctCount, incorrectCount, omitCount };
}

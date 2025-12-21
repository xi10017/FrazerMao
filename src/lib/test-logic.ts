import type { FamatTest, FamatSolution, AnyFamatTest, UserAnswers } from './types';
import famatTests from '@/data/famat_tests.json';

const allTests: AnyFamatTest[] = famatTests.tests;

/**
 * Generates a human-readable name for a test.
 * e.g., "2022 Statistics January Regional Individual"
 */
export function getTestName(test: FamatTest): string {
  return `${test.year} ${test.division} ${test.month} ${test.competition} Individual`;
}

/**
 * Finds the corresponding solution object for a given test object.
 */
export function findSolutionForTest(test: FamatTest): FamatSolution | undefined {
  return allTests.find(
    (item) =>
      item.test_type === 'Solution' &&
      item.year === test.year &&
      item.month === test.month &&
      item.division === test.division &&
      item.competition === test.competition
  ) as FamatSolution | undefined;
}

/**
 * Extracts the answer array from a given solution object.
 */
export function getAnswerKey(solution: FamatSolution): string[] {
  return solution.answers;
}

/**
 * Grades the user's answers against the correct answer key.
 * Correct: +5 points
 * Blank: +1 point
 * Incorrect: 0 points
 */
export function gradeTest(userAnswers: UserAnswers, answerKey: string[]) {
  let correctCount = 0;
  let incorrectCount = 0;
  let omitCount = 0;
  let totalScore = 0;

  for (let i = 0; i < answerKey.length; i++) {
    const questionNumber = i + 1;
    const userAnswer = userAnswers[questionNumber];
    const correctAnswer = answerKey[i];

    if (!userAnswer) {
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

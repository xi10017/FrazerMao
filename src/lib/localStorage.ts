'use client';

import type { TestSubmission, UserAnswers, ScoreReport, FamatTest } from './types';
import famatTests from '@/data/famat_tests.json';
import { getTestId } from './test-logic';

// NOTE: This will only work on the client-side.
// Ensure these functions are only called from 'use client' components.

// --- Final Submissions ---

/**
 * Retrieves all test submissions for a specific user from localStorage.
 * @param userId The UID of the user.
 * @returns An array of TestSubmission objects.
 */
export function getSubmissionsForUser(userId: string): TestSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const submissionsJSON = window.localStorage.getItem(`submissions_${userId}`);
    if (!submissionsJSON) {
      return [];
    }
    const submissions = JSON.parse(submissionsJSON) as TestSubmission[];
    // Re-hydrate Date objects from strings
    return submissions.map(sub => ({
        ...sub,
        submittedAt: new Date(sub.submittedAt),
    }));
  } catch (error) {
    console.error("Failed to get submissions from localStorage:", error);
    return [];
  }
}

/**
 * Adds a new test submission for a user to localStorage.
 * @param userId The UID of the user.
 * @param test The test object.
 * @param userAnswers The user's answers.
 * @param scoreReport The calculated score report.
 */
export function saveSubmission(
    userId: string, 
    test: FamatTest, 
    userAnswers: UserAnswers, 
    scoreReport: ScoreReport
): TestSubmission | null {
    if (typeof window === 'undefined') return null;
    try {
        const allSubmissions = getSubmissionsForUser(userId);
        const newSubmission: TestSubmission = {
            id: `${test.id}-${new Date().toISOString()}`, // Create a unique-enough ID
            testId: test.id,
            userId,
            answers: userAnswers,
            score: scoreReport,
            submittedAt: new Date(),
        };

        allSubmissions.unshift(newSubmission); // Add to the beginning

        window.localStorage.setItem(`submissions_${userId}`, JSON.stringify(allSubmissions));
        return newSubmission;
    } catch (error) {
        console.error("Failed to save submission to localStorage:", error);
        return null;
    }
}


// --- In-Progress Answers ---

const getInProgressKey = (userId: string, testId: string) => `in_progress_${userId}_${testId}`;

/**
 * Retrieves in-progress answers for a specific test and user.
 * @param userId The UID of the user.
 * @param testId The ID of the test.
 * @returns The user's answers or null if none are found.
 */
export function getInProgressAnswers(userId: string, testId: string): UserAnswers | null {
    if (typeof window === 'undefined') return null;
    try {
        const key = getInProgressKey(userId, testId);
        const answersJSON = window.localStorage.getItem(key);
        return answersJSON ? JSON.parse(answersJSON) : null;
    } catch (error) {
        console.error("Failed to get in-progress answers from localStorage:", error);
        return null;
    }
}

/**
 * Saves in-progress answers for a specific test and user.
 * @param userId The UID of the user.
 * @param testId The ID of the test.
 * @param answers The user's current answers.
 */
export function saveInProgressAnswers(userId: string, testId: string, answers: UserAnswers) {
    if (typeof window === 'undefined') return;
    try {
        const key = getInProgressKey(userId, testId);
        // Don't save if there are no answers to prevent empty records
        if (Object.keys(answers).length === 0) {
            window.localStorage.removeItem(key);
        } else {
            const answersJSON = JSON.stringify(answers);
            window.localStorage.setItem(key, answersJSON);
        }
    } catch (error) {
        console.error("Failed to save in-progress answers to localStorage:", error);
    }
}

/**
 * Clears any saved in-progress answers for a specific test and user.
 * @param userId The UID of the user.
 * @param testId The ID of the test.
 */
export function clearInProgressAnswers(userId: string, testId: string) {
    if (typeof window === 'undefined') return;
    try {
        const key = getInProgressKey(userId, testId);
        window.localStorage.removeItem(key);
    } catch (error) {
        console.error("Failed to clear in-progress answers from localStorage:", error);
    }
}

/**
 * Clears all submissions and in-progress work for a specific user.
 * @param userId The UID of the user.
 */
export function clearAllUserData(userId: string) {
    if (typeof window === 'undefined') return;
    try {
        // Clear all submissions
        window.localStorage.removeItem(`submissions_${userId}`);

        // Clear all in-progress tests for the user
        const tests = (famatTests as FamatTest[]).filter(t => t.document_type === 'Test');
        tests.forEach(test => {
            const testId = getTestId(test);
            const key = getInProgressKey(userId, testId);
            window.localStorage.removeItem(key);
        });

    } catch (error) {
        console.error("Failed to clear all user data from localStorage:", error);
    }
}
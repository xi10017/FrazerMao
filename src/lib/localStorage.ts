'use client';

import type { TestSubmission, UserAnswers, ScoreReport, FamatTest } from './types';

// NOTE: This will only work on the client-side.
// Ensure these functions are only called from 'use client' components.

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

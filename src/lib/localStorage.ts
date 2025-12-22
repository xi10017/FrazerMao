
'use client';

import type { TestSubmission, UserAnswers, ScoreReport, FamatTest } from './types';
import famatTests from '@/data/famat_tests.json';
import { getTestId } from './test-logic';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  Firestore,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// NOTE: This will only work on the client-side.
// Ensure these functions are only called from 'use client' components.

// --- Final Submissions ---

/**
 * Retrieves all test submissions for a specific user from Firestore.
 * @param db The Firestore instance.
 * @param userId The UID of the user.
 * @returns An array of TestSubmission objects.
 */
export async function getSubmissionsForUser(db: Firestore, userId: string): Promise<TestSubmission[]> {
  if (typeof window === 'undefined') return [];
  try {
    const submissionsRef = collection(db, 'testCompletions');
    const q = query(submissionsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const submissions: TestSubmission[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        submissions.push({
            ...data,
            id: doc.id,
            submittedAt: (data.submittedAt as Timestamp).toDate(),
        } as TestSubmission);
    });

    return submissions;

  } catch (error) {
    console.error("Failed to get submissions from Firestore:", error);
    // In a real app, you might want to handle this more gracefully
    return [];
  }
}


/**
 * Adds a new test submission for a user to Firestore.
 * @param db The Firestore instance.
 * @param userId The UID of the user.
 * @param test The test object.
 * @param userAnswers The user's answers.
 * @param scoreReport The calculated score report.
 */
export function saveSubmission(
    db: Firestore,
    userId: string, 
    test: FamatTest, 
    userAnswers: UserAnswers, 
    scoreReport: ScoreReport
) {
    if (typeof window === 'undefined') return;
    try {
        const submissionsRef = collection(db, 'testCompletions');
        const newSubmission = {
            testId: test.id,
            userId,
            answers: userAnswers,
            score: scoreReport,
            submittedAt: Timestamp.now(),
            division: test.division,
            testName: getTestName(test),
            completionDate: new Date().toISOString(),
        };

        addDoc(submissionsRef, newSubmission)
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: submissionsRef.path,
                    operation: 'create',
                    requestResourceData: newSubmission,
                });
                errorEmitter.emit('permission-error', permissionError);
            });

    } catch (error) {
        console.error("Failed to save submission to Firestore:", error);
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
        // This function will need to be updated to delete Firestore data,
        // which is a more complex operation and should be handled with care,
        // likely via a server-side function for security and completeness.
        // For now, we will clear the local in-progress data.
        console.log("Clearing local data. Firestore data must be cleared server-side.");

        // Clear all in-progress tests for the user from local storage
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

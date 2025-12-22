'use client';

import type { TestSubmission, UserAnswers, ScoreReport, FamatTest, UserProfile } from './types';
import { getTestName } from './test-logic';
import {
  collection,
  addDoc,
  query,
  getDocs,
  Timestamp,
  Firestore,
  doc,
  setDoc,
  where,
  getDoc,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { getAuth } from 'firebase/auth';

// --- Final Submissions ---

/**
 * Retrieves all test submissions for a specific user from Firestore.
 * @param db The Firestore instance.
 * @param userId The UID of the user.
 * @returns An array of TestSubmission objects.
 */
export async function getSubmissionsForUser(db: Firestore, userId: string): Promise<TestSubmission[]> {
  if (typeof window === 'undefined' || !userId) return [];

  const submissionsRef = collection(db, 'users', userId, 'testCompletions');
  const q = query(submissionsRef);

  try {
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
    const permissionError = new FirestorePermissionError({
        path: submissionsRef.path,
        operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    console.error("Error getting submissions, permission error emitted:", error);
    return []; // Return empty array on error
  }
}

/**
 * Updates the leaderboard collections in Firestore for a given user.
 * This should be called after a test submission is saved.
 * @param db The Firestore instance.
 * @param userId The UID of the user.
 * @param submittedDivision The division of the test that was just completed.
 */
async function updateLeaderboards(db: Firestore, userId: string, submittedDivision: string) {
    const user = getAuth().currentUser;
    if (!user) return; // Not signed in

    const userProfileRef = doc(db, 'users', userId);
    const testCompletionsRef = collection(db, 'users', userId, 'testCompletions');

    try {
        const userProfileSnap = await getDoc(userProfileRef);
        const userProfile = userProfileSnap.data() as UserProfile | undefined;
        // Default to true if the setting is not present
        const showOnLeaderboard = userProfile?.showOnLeaderboard ?? true;

        const displayName = showOnLeaderboard ? (user.displayName || 'Anonymous User') : 'Anonymous User';
        const photoURL = showOnLeaderboard ? (user.photoURL || undefined) : undefined;


        const querySnapshot = await getDocs(testCompletionsRef);
        const allCompletions = querySnapshot.docs.map(doc => doc.data());

        // 1. Update Overall Leaderboard
        const overallTotal = allCompletions.length;
        const overallLeaderboardRef = doc(db, 'leaderboard_overall', userId);
        const overallData = {
            userId: userId,
            testsCompleted: overallTotal,
            division: 'Overall',
            displayName,
            photoURL,
        };
        // Use setDoc with merge to create or update
        setDoc(overallLeaderboardRef, overallData, { merge: true })
            .catch(error => {
                const permissionError = new FirestorePermissionError({
                    path: overallLeaderboardRef.path,
                    operation: 'write',
                    requestResourceData: overallData,
                });
                errorEmitter.emit('permission-error', permissionError);
            });

        // 2. Update Division-Specific Leaderboard
        const divisionTotal = allCompletions.filter(c => c.division === submittedDivision).length;
        // Create a stable ID for the division entry
        const divisionLeaderboardId = `${userId}_${submittedDivision.replace(/\s+/g, '_').toLowerCase()}`;
        const divisionLeaderboardRef = doc(db, 'leaderboard_by_division', divisionLeaderboardId);
        const divisionData = {
            userId: userId,
            testsCompleted: divisionTotal,
            division: submittedDivision,
            displayName,
            photoURL,
        };
         // Use setDoc with merge to create or update
        setDoc(divisionLeaderboardRef, divisionData, { merge: true })
             .catch(error => {
                const permissionError = new FirestorePermissionError({
                    path: divisionLeaderboardRef.path,
                    operation: 'write',
                    requestResourceData: divisionData,
                });
                errorEmitter.emit('permission-error', permissionError);
            });

    } catch (error) {
        console.error("Could not update leaderboards:", error);
         const permissionError = new FirestorePermissionError({
            path: testCompletionsRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
}


/**
 * Adds a new test submission and updates the leaderboards.
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
    if (typeof window === 'undefined' || !userId) return;
    
    const submissionsRef = collection(db, 'users', userId, 'testCompletions');
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
        .then(() => {
            // After successful submission, update the leaderboards
            updateLeaderboards(db, userId, test.division);
        })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: submissionsRef.path,
                operation: 'create',
                requestResourceData: newSubmission,
            });
            errorEmitter.emit('permission-error', permissionError);
            console.error("Error saving submission:", serverError);
        });
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
 * Clears all local in-progress work for a specific user.
 * Note: This does not clear Firestore data.
 * @param userId The UID of the user.
 */
export function clearAllUserData(userId: string) {
    if (typeof window === 'undefined' || !userId) return;
    try {
        console.log("Clearing local data. Firestore data must be cleared server-side.");

        // Clear all in-progress tests for the user from local storage
        Object.keys(window.localStorage).forEach(key => {
            if(key.startsWith(`in_progress_${userId}_`)) {
                window.localStorage.removeItem(key);
            }
        });

    } catch (error) {
        console.error("Failed to clear all user data from localStorage:", error);
    }
}

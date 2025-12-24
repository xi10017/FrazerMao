
'use client';

import type {
  TestSubmission,
  UserAnswers,
  ScoreReport,
  FamatTest,
  MarkedQuestions,
} from './types';
import { getTestName } from './test-logic';
import {
  collection,
  addDoc,
  query,
  getDocs,
  Timestamp,
  type Firestore,
  doc,
  getDoc,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { getAuth } from 'firebase/auth';
import { updateUserLeaderboardEntries } from './leaderboard';

// --- Final Submissions ---

/**
 * Retrieves all test submissions for a specific user from Firestore.
 * @param db The Firestore instance.
 * @param userId The UID of the user.
 * @returns An array of TestSubmission objects.
 */
export async function getSubmissionsForUser(
  db: Firestore,
  userId: string
): Promise<TestSubmission[]> {
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
    console.error('Error getting submissions, permission error emitted:', error);
    return []; // Return empty array on error
  }
}

/**
 * Adds a new test submission and updates the leaderboards.
 * @param db The Firestore instance.
 * @param userId The UID of the user.
 * @param test The test object.
 * @param userAnswers The user's answers.
 * @param scoreReport The calculated score report.
 * @param inProgressFlags Any flags set during the practice session.
 * @returns The ID of the newly created submission document, or null on failure.
 */
export async function saveSubmission(
  db: Firestore,
  userId: string,
  test: FamatTest,
  userAnswers: UserAnswers,
  scoreReport: ScoreReport,
  inProgressFlags: MarkedQuestions
): Promise<string | null> {
  if (typeof window === 'undefined' || !userId) return null;

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

  try {
    const docRef = await addDoc(submissionsRef, newSubmission);
    
    // Save the flags from the session as review marks for this new submission
    saveReviewMarks(userId, docRef.id, inProgressFlags);

    // After successful submission, update the leaderboards
    const user = getAuth().currentUser;
    if (user) {
      const userProfileRef = doc(db, 'users', user.uid);
      const userProfileSnap = await getDoc(userProfileRef);
      const showOnLeaderboard = userProfileSnap.exists()
        ? userProfileSnap.data()?.showOnLeaderboard ?? true
        : true;
      
      await updateUserLeaderboardEntries(db, user, showOnLeaderboard);
    }
    
    return docRef.id; // Return the new document ID

  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: submissionsRef.path,
      operation: 'create',
      requestResourceData: newSubmission,
    });
    errorEmitter.emit('permission-error', permissionError);
    console.error('Error saving submission:', serverError);
    return null;
  }
}


// --- In-Progress Answers ---

const getInProgressKey = (userId: string, testId: string) =>
  `in_progress_${userId}_${testId}`;

/**
 * Retrieves in-progress answers for a specific test and user.
 * @param userId The UID of the user.
 * @param testId The ID of the test.
 * @returns The user's answers or null if none are found.
 */
export function getInProgressAnswers(
  userId: string,
  testId: string
): UserAnswers | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getInProgressKey(userId, testId);
    const answersJSON = window.localStorage.getItem(key);
    return answersJSON ? JSON.parse(answersJSON) : null;
  } catch (error) {
    console.error(
      'Failed to get in-progress answers from localStorage:',
      error
    );
    return null;
  }
}

/**
 * Saves in-progress answers for a specific test and user.
 * @param userId The UID of the user.
 * @param testId The ID of the test.
 * @param answers The user's current answers.
 */
export function saveInProgressAnswers(
  userId: string,
  testId: string,
  answers: UserAnswers
) {
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
    console.error('Failed to save in-progress answers to localStorage:', error);
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
    console.error(
      'Failed to clear in-progress answers from localStorage:',
      error
    );
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
    console.log(
      'Clearing local data. Firestore data must be cleared server-side.'
    );

    // Clear all in-progress tests for the user from local storage
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith(`in_progress_${userId}_`) || key.startsWith(`review_marks_${userId}_`) || key.startsWith(`in_progress_flags_${userId}_`)) {
        window.localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Failed to clear all user data from localStorage:', error);
  }
}


// --- Review Markings ---

const getReviewMarksKey = (userId: string, submissionId: string) => `review_marks_${userId}_${submissionId}`;

/**
 * Retrieves marked questions for a specific test submission from localStorage.
 */
export function getReviewMarks(userId: string, submissionId: string): MarkedQuestions {
  if (typeof window === 'undefined' || !userId || !submissionId) return {};
  try {
    const key = getReviewMarksKey(userId, submissionId);
    const marksJSON = window.localStorage.getItem(key);
    return marksJSON ? JSON.parse(marksJSON) : {};
  } catch (error) {
    console.error('Failed to get review marks from localStorage:', error);
    return {};
  }
}

/**
 * Saves marked questions for a specific test submission to localStorage.
 */
export function saveReviewMarks(userId: string, submissionId: string, marks: MarkedQuestions) {
  if (typeof window === 'undefined' || !userId || !submissionId) return;
  try {
    const key = getReviewMarksKey(userId, submissionId);
    if (Object.keys(marks).length === 0) {
      window.localStorage.removeItem(key);
    } else {
      const marksJSON = JSON.stringify(marks);
      window.localStorage.setItem(key, marksJSON);
    }
  } catch (error) {
    console.error('Failed to save review marks to localStorage:', error);
  }
}


// --- In-Progress Flags ---

const getInProgressFlagsKey = (userId: string, testId: string) => `in_progress_flags_${userId}_${testId}`;

export function getInProgressFlags(userId: string, testId: string): MarkedQuestions {
    if (typeof window === 'undefined' || !userId || !testId) return {};
    try {
        const key = getInProgressFlagsKey(userId, testId);
        const flagsJSON = window.localStorage.getItem(key);
        return flagsJSON ? JSON.parse(flagsJSON) : {};
    } catch (error) {
        console.error('Failed to get in-progress flags from localStorage:', error);
        return {};
    }
}

export function saveInProgressFlags(userId: string, testId: string, flags: MarkedQuestions) {
    if (typeof window === 'undefined' || !userId || !testId) return;
    try {
        const key = getInProgressFlagsKey(userId, testId);
        if (Object.keys(flags).length === 0) {
            window.localStorage.removeItem(key);
        } else {
            const flagsJSON = JSON.stringify(flags);
            window.localStorage.setItem(key, flagsJSON);
        }
    } catch (error) {
        console.error('Failed to save in-progress flags to localStorage:', error);
    }
}

export function clearInProgressFlags(userId: string, testId: string) {
    if (typeof window === 'undefined' || !userId || !testId) return;
    try {
        const key = getInProgressFlagsKey(userId, testId);
        window.localStorage.removeItem(key);
    } catch (error) {
        console.error('Failed to clear in-progress flags from localStorage:', error);
    }
}

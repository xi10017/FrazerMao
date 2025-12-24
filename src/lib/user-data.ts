'use client';

import type {
  TestSubmission,
  UserAnswers,
  ScoreReport,
  FamatTest,
  MarkedQuestions,
  TimerState,
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

// =================================================================
// FIRESTORE INTERACTIONS (Submissions & Leaderboards)
// =================================================================

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

// =================================================================
// LOCAL STORAGE INTERACTIONS (In-progress work, flags, etc.)
// =================================================================

/**
 * A generic helper to retrieve a JSON object from local storage.
 * @param key The local storage key.
 * @returns The parsed object or a default value.
 */
function getFromLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Failed to get item '${key}' from localStorage:`, error);
    return defaultValue;
  }
}

/**
 * A generic helper to save a JSON object to local storage.
 * @param key The local storage key.
 * @param value The object to save.
 */
function saveToLocalStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    // Don't save if the value is an empty object
    if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
      window.localStorage.removeItem(key);
    } else {
      const item = JSON.stringify(value);
      window.localStorage.setItem(key, item);
    }
  } catch (error) {
    console.error(`Failed to save item '${key}' to localStorage:`, error);
  }
}

/**
 * A generic helper to remove an item from local storage.
 * @param key The local storage key to remove.
 */
function clearFromLocalStorage(key: string) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(key);
    } catch (error) {
        console.error(`Failed to clear item '${key}' from localStorage:`, error);
    }
}


// --- Key Prefixes ---
const IN_PROGRESS_PREFIX = 'in_progress_';
const IN_PROGRESS_FLAGS_PREFIX = 'in_progress_flags_';
const REVIEW_MARKS_PREFIX = 'review_marks_';
const TIMER_STATE_PREFIX = 'timer_state_';

// --- In-Progress Answers ---
const getInProgressKey = (userId: string, testId: string) => `${IN_PROGRESS_PREFIX}${userId}_${testId}`;
export const getInProgressAnswers = (userId: string, testId: string) => getFromLocalStorage<UserAnswers | null>(getInProgressKey(userId, testId), null);
export const saveInProgressAnswers = (userId: string, testId: string, answers: UserAnswers) => saveToLocalStorage(getInProgressKey(userId, testId), answers);
export const clearInProgressAnswers = (userId: string, testId: string) => clearFromLocalStorage(getInProgressKey(userId, testId));

// --- In-Progress Flags ---
const getInProgressFlagsKey = (userId: string, testId: string) => `${IN_PROGRESS_FLAGS_PREFIX}${userId}_${testId}`;
export const getInProgressFlags = (userId: string, testId: string) => getFromLocalStorage<MarkedQuestions>(getInProgressFlagsKey(userId, testId), {});
export const saveInProgressFlags = (userId: string, testId: string, flags: MarkedQuestions) => saveToLocalStorage(getInProgressFlagsKey(userId, testId), flags);
export const clearInProgressFlags = (userId: string, testId: string) => clearFromLocalStorage(getInProgressFlagsKey(userId, testId));

// --- Review Markings ---
const getReviewMarksKey = (userId: string, submissionId: string) => `${REVIEW_MARKS_PREFIX}${userId}_${submissionId}`;
export const getReviewMarks = (userId: string, submissionId: string) => getFromLocalStorage<MarkedQuestions>(getReviewMarksKey(userId, submissionId), {});
export const saveReviewMarks = (userId: string, submissionId: string, marks: MarkedQuestions) => saveToLocalStorage(getReviewMarksKey(userId, submissionId), marks);

// --- Timer State ---
const getTimerStateKey = (userId: string, testId: string) => `${TIMER_STATE_PREFIX}${userId}_${testId}`;
export const getTimerState = (userId: string, testId: string) => getFromLocalStorage<TimerState | null>(getTimerStateKey(userId, testId), null);
export const saveTimerState = (userId: string, testId: string, state: TimerState) => saveToLocalStorage(getTimerStateKey(userId, testId), state);
export const clearTimerState = (userId: string, testId: string) => clearFromLocalStorage(getTimerStateKey(userId, testId));


/**
 * Clears all local in-progress work for a specific user.
 * Note: This does not clear Firestore data.
 * @param userId The UID of the user.
 */
export function clearAllLocalData(userId: string) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const prefixes = [
        `${IN_PROGRESS_PREFIX}${userId}_`,
        `${IN_PROGRESS_FLAGS_PREFIX}${userId}_`,
        `${REVIEW_MARKS_PREFIX}${userId}_`,
        `${TIMER_STATE_PREFIX}${userId}_`,
    ];

    Object.keys(window.localStorage).forEach((key) => {
      if (prefixes.some(prefix => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Failed to clear all user data from localStorage:', error);
  }
}

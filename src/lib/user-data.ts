'use client';

import type {
  TestSubmission,
  UserAnswers,
  ScoreReport,
  FamatTest,
  MarkedQuestions,
  TimerState,
  UserProfile,
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
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { getAuth, type User } from 'firebase/auth';
import { updateUserLeaderboardEntries } from './leaderboard';
import { removeUserFromAllGroups } from './study-groups';
import { incrementAggregateStats } from './aggregate-stats';

// =================================================================
// FIRESTORE INTERACTIONS (Submissions & Leaderboards)
// =================================================================

/**
 * Creates or updates a user's public profile in Firestore.
 * This function is non-blocking and uses the global error emitter for permissions issues.
 * @param firestore The Firestore instance.
 * @param user The authenticated Firebase User object from the auth result.
 */
export const createUserProfile = (firestore: Firestore, user: User) => {
  if (!firestore || !user) return;

  const userRef = doc(firestore, 'users', user.uid);
  const userData: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || 'Anonymous User',
    email: user.email!,
    photoURL: user.photoURL,
    showOnLeaderboard: true, // Default to true on creation
  };

  // Use non-blocking write with centralized error handling
  setDoc(userRef, userData, { merge: true }).catch(() => {
    const permissionError = new FirestorePermissionError({
      path: userRef.path,
      operation: 'write', // Covers both create and update with merge
      requestResourceData: userData,
    });
    errorEmitter.emit('permission-error', permissionError);
  });
};


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
  inProgressFlags: MarkedQuestions,
  isRetake?: boolean
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
    isRetake: !!isRetake,
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
      await incrementAggregateStats(db, test.division, scoreReport.totalScore);
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
const IN_PROGRESS_CHECKED_PREFIX = 'in_progress_checked_';

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

// --- In-Progress Checked Questions ---
const getInProgressCheckedKey = (userId: string, testId: string) => `${IN_PROGRESS_CHECKED_PREFIX}${userId}_${testId}`;
export const getInProgressChecked = (userId: string, testId: string) => getFromLocalStorage<{[key: number]: true}>(getInProgressCheckedKey(userId, testId), {});
export const saveInProgressChecked = (userId: string, testId: string, checked: {[key: number]: true}) => saveToLocalStorage(getInProgressCheckedKey(userId, testId), checked);
export const clearInProgressChecked = (userId: string, testId: string) => clearFromLocalStorage(getInProgressCheckedKey(userId, testId));

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
        `${IN_PROGRESS_CHECKED_PREFIX}${userId}_`,
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

/**
 * Toggles a test in the user's bookmark list (stored on their profile).
 */
export async function toggleBookmark(
  db: Firestore,
  userId: string,
  testId: string,
  currentlyBookmarked: boolean
): Promise<string[]> {
  const auth = getAuth();
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    throw new Error('Cannot modify bookmarks for another user');
  }

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  const existing: string[] = snap.exists()
    ? snap.data()?.bookmarkedTestIds ?? []
    : [];

  const updated = currentlyBookmarked
    ? existing.filter((id) => id !== testId)
    : [...existing, testId];

  await setDoc(userRef, { bookmarkedTestIds: updated }, { merge: true });
  return updated;
}

const BATCH_LIMIT = 450;

/**
 * Permanently deletes ALL cloud data belonging to the signed-in user only.
 * Does not touch any other user's documents.
 */
export async function deleteAllUserCloudData(
  db: Firestore,
  user: User
): Promise<{ deletedSubmissions: number; deletedLeaderboardEntries: number }> {
  const auth = getAuth();
  if (!auth.currentUser || auth.currentUser.uid !== user.uid) {
    throw new Error('You must be signed in to delete your own data.');
  }

  const userId = user.uid;
  let deletedSubmissions = 0;
  let deletedLeaderboardEntries = 0;

  const completionsRef = collection(db, 'users', userId, 'testCompletions');
  const completionsSnap = await getDocs(completionsRef);

  let batch = writeBatch(db);
  let batchCount = 0;

  for (const completionDoc of completionsSnap.docs) {
    batch.delete(completionDoc.ref);
    batchCount++;
    deletedSubmissions++;

    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    batch = writeBatch(db);
    batchCount = 0;
  }

  const overallRef = doc(db, 'leaderboard_overall', userId);
  const overallSnap = await getDoc(overallRef);
  if (overallSnap.exists()) {
    batch.delete(overallRef);
    deletedLeaderboardEntries++;
    batchCount++;
  }

  const divisionSnap = await getDocs(collection(db, 'leaderboard_by_division'));
  for (const divisionDoc of divisionSnap.docs) {
    const data = divisionDoc.data();
    if (data.userId === userId) {
      batch.delete(divisionDoc.ref);
      deletedLeaderboardEntries++;
      batchCount++;

      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  await removeUserFromAllGroups(db, userId);

  const userRef = doc(db, 'users', userId);
  await setDoc(
    userRef,
    { bookmarkedTestIds: [] },
    { merge: true }
  );

  return { deletedSubmissions, deletedLeaderboardEntries };
}

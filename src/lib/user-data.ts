'use client';

import type {
  TestSubmission,
  UserAnswers,
  ScoreReport,
  FamatTest,
  MarkedQuestions,
  TimerState,
  UserProfile,
  InProgressTestState,
  InProgressChecked,
} from './types';
import { getTestName } from './test-logic';
import {
  collection,
  addDoc,
  query,
  getDocs,
  where,
  Timestamp,
  type Firestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
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
 * Retrieves test submissions for a single test (scoped query).
 */
export async function getSubmissionsForTest(
  db: Firestore,
  userId: string,
  testId: string
): Promise<TestSubmission[]> {
  if (typeof window === 'undefined' || !userId || !testId) return [];

  const submissionsRef = collection(db, 'users', userId, 'testCompletions');
  const q = query(submissionsRef, where('testId', '==', testId));

  try {
    const querySnapshot = await getDocs(q);
    const submissions: TestSubmission[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      submissions.push({
        ...data,
        id: docSnap.id,
        submittedAt: (data.submittedAt as Timestamp).toDate(),
      } as TestSubmission);
    });
    return submissions.sort(
      (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
    );
  } catch (error) {
    console.error('Error getting test submissions:', error);
    return [];
  }
}

/** Test IDs with any in-progress data saved locally for this user. */
export function getLocalInProgressTestIds(userId: string): string[] {
  if (typeof window === 'undefined' || !userId) return [];

  const prefixes = [
    `${IN_PROGRESS_PREFIX}${userId}_`,
    `${IN_PROGRESS_FLAGS_PREFIX}${userId}_`,
    `${TIMER_STATE_PREFIX}${userId}_`,
    `${IN_PROGRESS_CHECKED_PREFIX}${userId}_`,
  ];
  const ids = new Set<string>();

  for (const key of Object.keys(window.localStorage)) {
    for (const prefix of prefixes) {
      if (key.startsWith(prefix)) {
        ids.add(key.slice(prefix.length));
      }
    }
  }

  return [...ids];
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
  isRetake?: boolean,
  retakeSourceSubmissionId?: string
): Promise<string | null> {
  if (typeof window === 'undefined' || !userId) return null;

  const submissionsRef = collection(db, 'users', userId, 'testCompletions');
  const newSubmission: Record<string, unknown> = {
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
  if (isRetake && retakeSourceSubmissionId) {
    newSubmission.retakeSourceSubmissionId = retakeSourceSubmissionId;
  }

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
      await incrementAggregateStats(db, test.id, scoreReport.totalScore);
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
const IN_PROGRESS_UPDATED_PREFIX = 'in_progress_updated_';

const RETAKE_IN_PROGRESS_PREFIX = 'retake_in_progress_';
const RETAKE_IN_PROGRESS_FLAGS_PREFIX = 'retake_in_progress_flags_';
const RETAKE_IN_PROGRESS_CHECKED_PREFIX = 'retake_in_progress_checked_';
const RETAKE_TIMER_STATE_PREFIX = 'retake_timer_state_';
const RETAKE_IN_PROGRESS_UPDATED_PREFIX = 'retake_in_progress_updated_';
const RETAKE_SOURCE_META_PREFIX = 'retake_source_meta_';

type RetakeSourceMeta = {
  sourceSubmissionId?: string;
  sourceAnswers: UserAnswers;
  retakeOmittedQuestions?: number[];
};

function getRetakeSourceMetaKey(userId: string, testId: string) {
  return `${RETAKE_SOURCE_META_PREFIX}${userId}_${testId}`;
}

function getRetakeSourceMeta(
  userId: string,
  testId: string
): RetakeSourceMeta | null {
  return getFromLocalStorage<RetakeSourceMeta | null>(
    getRetakeSourceMetaKey(userId, testId),
    null
  );
}

function saveRetakeSourceMeta(
  userId: string,
  testId: string,
  meta: RetakeSourceMeta
) {
  saveToLocalStorage(getRetakeSourceMetaKey(userId, testId), meta);
}

function clearRetakeSourceMeta(userId: string, testId: string) {
  clearFromLocalStorage(getRetakeSourceMetaKey(userId, testId));
}

function touchLocalInProgressUpdated(userId: string, testId: string) {
  saveToLocalStorage(
    `${IN_PROGRESS_UPDATED_PREFIX}${userId}_${testId}`,
    Date.now()
  );
}

function getLocalInProgressUpdatedAt(userId: string, testId: string): number {
  return getFromLocalStorage(
    `${IN_PROGRESS_UPDATED_PREFIX}${userId}_${testId}`,
    0
  );
}

function clearLocalInProgressUpdated(userId: string, testId: string) {
  clearFromLocalStorage(`${IN_PROGRESS_UPDATED_PREFIX}${userId}_${testId}`);
}

// --- In-Progress Answers ---
const getInProgressKey = (userId: string, testId: string) => `${IN_PROGRESS_PREFIX}${userId}_${testId}`;
export const getInProgressAnswers = (userId: string, testId: string) => getFromLocalStorage<UserAnswers | null>(getInProgressKey(userId, testId), null);
export const saveInProgressAnswers = (userId: string, testId: string, answers: UserAnswers) => {
  saveToLocalStorage(getInProgressKey(userId, testId), answers);
  touchLocalInProgressUpdated(userId, testId);
};
export const clearInProgressAnswers = (userId: string, testId: string) => clearFromLocalStorage(getInProgressKey(userId, testId));

// --- In-Progress Flags ---
const getInProgressFlagsKey = (userId: string, testId: string) => `${IN_PROGRESS_FLAGS_PREFIX}${userId}_${testId}`;
export const getInProgressFlags = (userId: string, testId: string) => getFromLocalStorage<MarkedQuestions>(getInProgressFlagsKey(userId, testId), {});
export const saveInProgressFlags = (userId: string, testId: string, flags: MarkedQuestions) => {
  saveToLocalStorage(getInProgressFlagsKey(userId, testId), flags);
  touchLocalInProgressUpdated(userId, testId);
};
export const clearInProgressFlags = (userId: string, testId: string) => clearFromLocalStorage(getInProgressFlagsKey(userId, testId));

// --- In-Progress Checked Questions ---
const getInProgressCheckedKey = (userId: string, testId: string) => `${IN_PROGRESS_CHECKED_PREFIX}${userId}_${testId}`;
export const getInProgressChecked = (userId: string, testId: string) => getFromLocalStorage<InProgressChecked>(getInProgressCheckedKey(userId, testId), {});
export const saveInProgressChecked = (userId: string, testId: string, checked: InProgressChecked) => {
  saveToLocalStorage(getInProgressCheckedKey(userId, testId), checked);
  touchLocalInProgressUpdated(userId, testId);
};
export const clearInProgressChecked = (userId: string, testId: string) => clearFromLocalStorage(getInProgressCheckedKey(userId, testId));

// --- Review Markings ---
const getReviewMarksKey = (userId: string, submissionId: string) => `${REVIEW_MARKS_PREFIX}${userId}_${submissionId}`;
export const getReviewMarks = (userId: string, submissionId: string) => getFromLocalStorage<MarkedQuestions>(getReviewMarksKey(userId, submissionId), {});
export const saveReviewMarks = (userId: string, submissionId: string, marks: MarkedQuestions) => saveToLocalStorage(getReviewMarksKey(userId, submissionId), marks);

// --- Timer State ---
const getTimerStateKey = (userId: string, testId: string) => `${TIMER_STATE_PREFIX}${userId}_${testId}`;
export const getTimerState = (userId: string, testId: string) => getFromLocalStorage<TimerState | null>(getTimerStateKey(userId, testId), null);
export const saveTimerState = (userId: string, testId: string, state: TimerState) => {
  saveToLocalStorage(getTimerStateKey(userId, testId), state);
  touchLocalInProgressUpdated(userId, testId);
};
export const clearTimerState = (userId: string, testId: string) => clearFromLocalStorage(getTimerStateKey(userId, testId));

export function getLocalInProgressBundle(
  userId: string,
  testId: string
): InProgressTestState | null {
  const answers = getInProgressAnswers(userId, testId);
  const flags = getInProgressFlags(userId, testId);
  const checked = getInProgressChecked(userId, testId);
  const timerState = getTimerState(userId, testId);

  const hasContent =
    (answers != null && Object.keys(answers).length > 0) ||
    Object.keys(flags).length > 0 ||
    Object.keys(checked).length > 0 ||
    timerState != null;

  if (!hasContent) return null;

  let updatedMs = getLocalInProgressUpdatedAt(userId, testId);
  if (!updatedMs) updatedMs = Date.now();

  return {
    answers: answers ?? {},
    flags,
    checked,
    timerState,
    updatedAt: new Date(updatedMs),
    sessionMode: 'practice',
  };
}

export function persistInProgressLocally(
  userId: string,
  testId: string,
  state: InProgressTestState
) {
  saveInProgressAnswers(userId, testId, state.answers);
  saveInProgressFlags(userId, testId, state.flags);
  saveInProgressChecked(userId, testId, state.checked);
  if (state.timerState) {
    saveTimerState(userId, testId, state.timerState);
  } else {
    clearTimerState(userId, testId);
  }
  saveToLocalStorage(
    `${IN_PROGRESS_UPDATED_PREFIX}${userId}_${testId}`,
    state.updatedAt.getTime()
  );
}

export function pickNewerInProgress(
  local: InProgressTestState | null,
  cloud: InProgressTestState | null
): InProgressTestState | null {
  if (!local && !cloud) return null;
  if (!local) return cloud;
  if (!cloud) return local;
  return cloud.updatedAt.getTime() >= local.updatedAt.getTime() ? cloud : local;
}

function cloudDocToInProgressState(
  testId: string,
  data: Record<string, unknown>
): InProgressTestState {
  const updatedAt = data.updatedAt as Timestamp | undefined;
  const sessionMode = data.sessionMode as 'practice' | 'retake' | undefined;
  return {
    answers: (data.answers as UserAnswers) ?? {},
    flags: (data.flags as MarkedQuestions) ?? {},
    checked: (data.checked as InProgressChecked) ?? {},
    timerState: (data.timerState as TimerState | null) ?? null,
    updatedAt: updatedAt?.toDate() ?? new Date(0),
    sessionMode,
    sourceSubmissionId: data.sourceSubmissionId as string | undefined,
    sourceAnswers: data.sourceAnswers as UserAnswers | undefined,
    retakeOmittedQuestions: data.retakeOmittedQuestions as number[] | undefined,
  };
}

export async function getCloudInProgress(
  db: Firestore,
  userId: string,
  testId: string
): Promise<InProgressTestState | null> {
  if (typeof window === 'undefined' || !userId) return null;

  const ref = doc(db, 'users', userId, 'inProgress', testId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const state = cloudDocToInProgressState(testId, snap.data());
    if (state.sessionMode === 'retake') return null;
    return state;
  } catch (error) {
    console.error('Error loading cloud in-progress state:', error);
    return null;
  }
}

export async function getCloudRetakeInProgress(
  db: Firestore,
  userId: string,
  testId: string
): Promise<InProgressTestState | null> {
  if (typeof window === 'undefined' || !userId) return null;

  const ref = doc(db, 'users', userId, 'retakeInProgress', testId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const state = cloudDocToInProgressState(testId, snap.data());
      return { ...state, sessionMode: 'retake' };
    }

    const legacyRef = doc(db, 'users', userId, 'inProgress', testId);
    const legacySnap = await getDoc(legacyRef);
    if (!legacySnap.exists()) return null;
    const legacy = cloudDocToInProgressState(testId, legacySnap.data());
    if (legacy.sessionMode !== 'retake' || !legacy.sourceAnswers) return null;
    return legacy;
  } catch (error) {
    console.error('Error loading cloud retake in-progress state:', error);
    return null;
  }
}

export async function getAllCloudInProgress(
  db: Firestore,
  userId: string
): Promise<Record<string, InProgressTestState>> {
  if (typeof window === 'undefined' || !userId) return {};

  const ref = collection(db, 'users', userId, 'inProgress');
  try {
    const snap = await getDocs(ref);
    const result: Record<string, InProgressTestState> = {};
    snap.forEach((docSnap) => {
      const state = cloudDocToInProgressState(docSnap.id, docSnap.data());
      if (state.sessionMode !== 'retake') {
        result[docSnap.id] = state;
      }
    });
    return result;
  } catch (error) {
    console.error('Error loading cloud in-progress states:', error);
    return {};
  }
}

export async function getAllCloudRetakeInProgress(
  db: Firestore,
  userId: string
): Promise<Record<string, InProgressTestState>> {
  if (typeof window === 'undefined' || !userId) return {};

  const ref = collection(db, 'users', userId, 'retakeInProgress');
  try {
    const snap = await getDocs(ref);
    const result: Record<string, InProgressTestState> = {};
    snap.forEach((docSnap) => {
      result[docSnap.id] = cloudDocToInProgressState(
        docSnap.id,
        docSnap.data()
      );
    });
    return result;
  } catch (error) {
    console.error('Error loading cloud retake in-progress states:', error);
    return {};
  }
}

export function getLocalRetakeInProgressTestIds(userId: string): string[] {
  if (typeof window === 'undefined' || !userId) return [];

  const prefix = `${RETAKE_IN_PROGRESS_PREFIX}${userId}_`;
  const ids = new Set<string>();

  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith(prefix)) {
      const testId = key.slice(prefix.length);
      if (getLocalRetakeInProgressBundle(userId, testId)) {
        ids.add(testId);
      }
    }
  }

  return [...ids];
}

export async function saveCloudInProgress(
  db: Firestore,
  userId: string,
  testId: string,
  state: Omit<InProgressTestState, 'updatedAt'> & { updatedAt?: Date }
): Promise<void> {
  if (typeof window === 'undefined' || !userId) return;

  const updatedAt = state.updatedAt ?? new Date();
  const ref = doc(db, 'users', userId, 'inProgress', testId);

  try {
    await setDoc(ref, {
      answers: state.answers,
      flags: state.flags,
      checked: state.checked,
      timerState: state.timerState,
      updatedAt: Timestamp.fromDate(updatedAt),
      sessionMode: 'practice',
    });
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: ref.path,
      operation: 'write',
    });
    errorEmitter.emit('permission-error', permissionError);
    console.error('Error saving cloud in-progress state:', error);
  }
}

export async function saveCloudRetakeInProgress(
  db: Firestore,
  userId: string,
  testId: string,
  state: Omit<InProgressTestState, 'updatedAt'> & { updatedAt?: Date }
): Promise<void> {
  if (typeof window === 'undefined' || !userId) return;

  const updatedAt = state.updatedAt ?? new Date();
  const ref = doc(db, 'users', userId, 'retakeInProgress', testId);

  try {
    await setDoc(ref, {
      answers: state.answers,
      flags: state.flags,
      checked: state.checked,
      timerState: state.timerState,
      updatedAt: Timestamp.fromDate(updatedAt),
      sessionMode: 'retake',
      sourceSubmissionId: state.sourceSubmissionId ?? null,
      sourceAnswers: state.sourceAnswers ?? null,
      retakeOmittedQuestions: state.retakeOmittedQuestions ?? [],
    });
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: ref.path,
      operation: 'write',
    });
    errorEmitter.emit('permission-error', permissionError);
    console.error('Error saving cloud retake in-progress state:', error);
  }
}

export async function clearCloudInProgress(
  db: Firestore,
  userId: string,
  testId: string
): Promise<void> {
  if (typeof window === 'undefined' || !userId) return;

  const ref = doc(db, 'users', userId, 'inProgress', testId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    console.error('Error clearing cloud in-progress state:', error);
  }
}

export async function clearCloudRetakeInProgress(
  db: Firestore,
  userId: string,
  testId: string
): Promise<void> {
  if (typeof window === 'undefined' || !userId) return;

  const ref = doc(db, 'users', userId, 'retakeInProgress', testId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    console.error('Error clearing cloud retake in-progress state:', error);
  }
}

/** Merge local + cloud practice in-progress state. */
export async function syncInProgressIfNeeded(
  db: Firestore,
  userId: string,
  testId: string
): Promise<InProgressTestState | null> {
  const local = getLocalInProgressBundle(userId, testId);
  const cloud = await getCloudInProgress(db, userId, testId);
  const winner = pickNewerInProgress(local, cloud);
  if (!winner) return null;

  persistInProgressLocally(userId, testId, winner);

  const cloudMs = cloud?.updatedAt.getTime() ?? -1;
  const winnerMs = winner.updatedAt.getTime();
  if (!cloud || cloudMs < winnerMs) {
    await saveCloudInProgress(db, userId, testId, winner);
  }

  return winner;
}

function touchLocalRetakeUpdated(userId: string, testId: string) {
  saveToLocalStorage(
    `${RETAKE_IN_PROGRESS_UPDATED_PREFIX}${userId}_${testId}`,
    Date.now()
  );
}

function getLocalRetakeUpdatedAt(userId: string, testId: string): number {
  return getFromLocalStorage(
    `${RETAKE_IN_PROGRESS_UPDATED_PREFIX}${userId}_${testId}`,
    0
  );
}

function clearLocalRetakeUpdated(userId: string, testId: string) {
  clearFromLocalStorage(`${RETAKE_IN_PROGRESS_UPDATED_PREFIX}${userId}_${testId}`);
}

const getRetakeInProgressKey = (userId: string, testId: string) =>
  `${RETAKE_IN_PROGRESS_PREFIX}${userId}_${testId}`;
const getRetakeInProgressFlagsKey = (userId: string, testId: string) =>
  `${RETAKE_IN_PROGRESS_FLAGS_PREFIX}${userId}_${testId}`;
const getRetakeInProgressCheckedKey = (userId: string, testId: string) =>
  `${RETAKE_IN_PROGRESS_CHECKED_PREFIX}${userId}_${testId}`;
const getRetakeTimerStateKey = (userId: string, testId: string) =>
  `${RETAKE_TIMER_STATE_PREFIX}${userId}_${testId}`;

export function getLocalRetakeInProgressBundle(
  userId: string,
  testId: string
): InProgressTestState | null {
  const answers = getFromLocalStorage<UserAnswers | null>(
    getRetakeInProgressKey(userId, testId),
    null
  );
  const flags = getFromLocalStorage<MarkedQuestions>(
    getRetakeInProgressFlagsKey(userId, testId),
    {}
  );
  const checked = getFromLocalStorage<InProgressChecked>(
    getRetakeInProgressCheckedKey(userId, testId),
    {}
  );
  const timerState = getFromLocalStorage<TimerState | null>(
    getRetakeTimerStateKey(userId, testId),
    null
  );
  const sourceMeta = getRetakeSourceMeta(userId, testId);

  const hasContent =
    (answers != null && Object.keys(answers).length > 0) ||
    Object.keys(flags).length > 0 ||
    Object.keys(checked).length > 0 ||
    timerState != null;

  if (!hasContent || !sourceMeta?.sourceAnswers) return null;

  let updatedMs = getLocalRetakeUpdatedAt(userId, testId);
  if (!updatedMs) updatedMs = Date.now();

  return {
    answers: answers ?? {},
    flags,
    checked,
    timerState,
    updatedAt: new Date(updatedMs),
    sessionMode: 'retake',
    sourceSubmissionId: sourceMeta.sourceSubmissionId,
    sourceAnswers: sourceMeta.sourceAnswers,
    retakeOmittedQuestions: sourceMeta.retakeOmittedQuestions,
  };
}

export function persistRetakeInProgressLocally(
  userId: string,
  testId: string,
  state: InProgressTestState
) {
  saveToLocalStorage(getRetakeInProgressKey(userId, testId), state.answers);
  saveToLocalStorage(getRetakeInProgressFlagsKey(userId, testId), state.flags);
  saveToLocalStorage(
    getRetakeInProgressCheckedKey(userId, testId),
    state.checked
  );
  if (state.timerState) {
    saveToLocalStorage(getRetakeTimerStateKey(userId, testId), state.timerState);
  } else {
    clearFromLocalStorage(getRetakeTimerStateKey(userId, testId));
  }
  saveToLocalStorage(
    `${RETAKE_IN_PROGRESS_UPDATED_PREFIX}${userId}_${testId}`,
    state.updatedAt.getTime()
  );
  if (state.sourceAnswers) {
    saveRetakeSourceMeta(userId, testId, {
      sourceSubmissionId: state.sourceSubmissionId,
      sourceAnswers: state.sourceAnswers,
      retakeOmittedQuestions: state.retakeOmittedQuestions,
    });
  }
}

/** Merge local + cloud retake in-progress state. */
export async function syncRetakeInProgressIfNeeded(
  db: Firestore,
  userId: string,
  testId: string
): Promise<InProgressTestState | null> {
  const local = getLocalRetakeInProgressBundle(userId, testId);
  const cloud = await getCloudRetakeInProgress(db, userId, testId);
  const winner = pickNewerInProgress(local, cloud);
  if (!winner) return null;

  persistRetakeInProgressLocally(userId, testId, winner);

  const cloudMs = cloud?.updatedAt.getTime() ?? -1;
  const winnerMs = winner.updatedAt.getTime();
  if (!cloud || cloudMs < winnerMs) {
    await saveCloudRetakeInProgress(db, userId, testId, winner);
  }

  return winner;
}

export async function readRetakeInProgressForTest(
  db: Firestore,
  userId: string,
  testId: string
): Promise<InProgressTestState | null> {
  const local = getLocalRetakeInProgressBundle(userId, testId);
  const cloud = await getCloudRetakeInProgress(db, userId, testId);
  return pickNewerInProgress(local, cloud);
}

export async function getRetakeInProgressForTest(
  db: Firestore,
  userId: string,
  testId: string
): Promise<InProgressTestState | null> {
  return syncRetakeInProgressIfNeeded(db, userId, testId);
}

/** @deprecated Use getRetakeInProgressForTest for retakes. */
export async function getInProgressSessionForTest(
  db: Firestore,
  userId: string,
  testId: string
): Promise<InProgressTestState | null> {
  return getRetakeInProgressForTest(db, userId, testId);
}

export async function clearPracticeInProgressForTest(
  db: Firestore | null,
  userId: string,
  testId: string
): Promise<void> {
  clearInProgressAnswers(userId, testId);
  clearInProgressFlags(userId, testId);
  clearInProgressChecked(userId, testId);
  clearTimerState(userId, testId);
  clearLocalInProgressUpdated(userId, testId);
  if (db) {
    await clearCloudInProgress(db, userId, testId);
  }
}

export async function clearRetakeInProgressForTest(
  db: Firestore | null,
  userId: string,
  testId: string
): Promise<void> {
  clearFromLocalStorage(getRetakeInProgressKey(userId, testId));
  clearFromLocalStorage(getRetakeInProgressFlagsKey(userId, testId));
  clearFromLocalStorage(getRetakeInProgressCheckedKey(userId, testId));
  clearFromLocalStorage(getRetakeTimerStateKey(userId, testId));
  clearLocalRetakeUpdated(userId, testId);
  clearRetakeSourceMeta(userId, testId);
  if (db) {
    await clearCloudRetakeInProgress(db, userId, testId);
  }
}

export async function clearInProgressForTest(
  db: Firestore | null,
  userId: string,
  testId: string
): Promise<void> {
  await clearPracticeInProgressForTest(db, userId, testId);
}


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
        `${IN_PROGRESS_UPDATED_PREFIX}${userId}_`,
        `${RETAKE_IN_PROGRESS_PREFIX}${userId}_`,
        `${RETAKE_IN_PROGRESS_FLAGS_PREFIX}${userId}_`,
        `${RETAKE_IN_PROGRESS_CHECKED_PREFIX}${userId}_`,
        `${RETAKE_TIMER_STATE_PREFIX}${userId}_`,
        `${RETAKE_IN_PROGRESS_UPDATED_PREFIX}${userId}_`,
        `${RETAKE_SOURCE_META_PREFIX}${userId}_`,
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
 * Shared client-side cooldown for profile-related cloud writes.
 */
export const PROFILE_WRITE_COOLDOWN_MS = 500;
const profileWriteCooldownAt = new Map<string, number>();

function isProfileWriteCooldown(cooldownKey: string): boolean {
  const now = Date.now();
  const last = profileWriteCooldownAt.get(cooldownKey) ?? 0;
  return now - last < PROFILE_WRITE_COOLDOWN_MS;
}

function recordProfileWrite(cooldownKey: string) {
  profileWriteCooldownAt.set(cooldownKey, Date.now());
}

/**
 * Toggles a test in the user's bookmark list (stored on their profile).
 * Rate-limited to one cloud write every 0.5 seconds per user.
 */
export type ToggleBookmarkResult = { ids: string[]; saved: boolean };

export async function toggleBookmark(
  db: Firestore,
  userId: string,
  testId: string,
  currentlyBookmarked: boolean,
  currentIds: string[]
): Promise<ToggleBookmarkResult> {
  const auth = getAuth();
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    throw new Error('Cannot modify bookmarks for another user');
  }

  const isAlreadyBookmarked = currentIds.includes(testId);
  if (currentlyBookmarked && !isAlreadyBookmarked) {
    return { ids: currentIds, saved: false };
  }
  if (!currentlyBookmarked && isAlreadyBookmarked) {
    return { ids: currentIds, saved: false };
  }

  const cooldownKey = `${userId}:bookmark`;
  if (isProfileWriteCooldown(cooldownKey)) {
    return { ids: currentIds, saved: false };
  }

  const updated = currentlyBookmarked
    ? currentIds.filter((id) => id !== testId)
    : [...currentIds, testId];

  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, { bookmarkedTestIds: updated }, { merge: true });
  recordProfileWrite(cooldownKey);
  return { ids: updated, saved: true };
}

/**
 * Updates leaderboard visibility on the user profile and syncs leaderboard docs.
 * Rate-limited to one cloud write every 0.5 seconds per user.
 */
export async function updateLeaderboardVisibility(
  db: Firestore,
  user: User,
  showOnLeaderboard: boolean,
  currentVisibility: boolean
): Promise<{ saved: boolean }> {
  if (showOnLeaderboard === currentVisibility) {
    return { saved: false };
  }

  const cooldownKey = `${user.uid}:leaderboardVisibility`;
  if (isProfileWriteCooldown(cooldownKey)) {
    return { saved: false };
  }

  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, { showOnLeaderboard }, { merge: true });
  await updateUserLeaderboardEntries(db, user, showOnLeaderboard);
  recordProfileWrite(cooldownKey);
  return { saved: true };
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

  const inProgressRef = collection(db, 'users', userId, 'inProgress');
  const inProgressSnap = await getDocs(inProgressRef);
  for (const inProgressDoc of inProgressSnap.docs) {
    batch.delete(inProgressDoc.ref);
    batchCount++;

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

  const retakeInProgressRef = collection(db, 'users', userId, 'retakeInProgress');
  const retakeInProgressSnap = await getDocs(retakeInProgressRef);
  for (const retakeDoc of retakeInProgressSnap.docs) {
    batch.delete(retakeDoc.ref);
    batchCount++;

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

  const divisionQuery = query(
    collection(db, 'leaderboard_by_division'),
    where('userId', '==', userId)
  );
  const divisionSnap = await getDocs(divisionQuery);
  for (const divisionDoc of divisionSnap.docs) {
    batch.delete(divisionDoc.ref);
    deletedLeaderboardEntries++;
    batchCount++;

    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
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

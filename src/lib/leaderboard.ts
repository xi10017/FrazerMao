'use client';

import {
  collection,
  doc,
  getDocs,
  setDoc,
  getDoc,
  Firestore,
} from 'firebase/firestore';
import type { LeaderboardEntry } from './types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { User } from 'firebase/auth';

/**
 * Updates a user's entries in all relevant leaderboard collections.
 * This function is called after a test submission to ensure scores are fresh.
 * It always writes the user's data; filtering is done on the client.
 *
 * @param db The Firestore instance.
 * @param user The authenticated Firebase User object.
 */
export async function updateUserLeaderboardEntries(
  db: Firestore,
  user: User | null
) {
  if (!user) return;

  const userId = user.uid;
  let showOnLeaderboard = true;

  // 1. Get the user's current visibility preference from their profile.
  const userProfileRef = doc(db, 'users', userId);
  try {
    const userProfileSnap = await getDoc(userProfileRef);
    if (userProfileSnap.exists()) {
        showOnLeaderboard = userProfileSnap.data()?.showOnLeaderboard ?? true;
    }
  } catch (error) {
    console.error('Could not fetch user profile to check visibility', error);
    // Don't emit an error here, as we can proceed with a default.
  }

  // 2. Get all of the user's test completions.
  try {
    const testCompletionsRef = collection(
      db,
      'users',
      userId,
      'testCompletions'
    );
    const completionsSnapshot = await getDocs(testCompletionsRef);
    const allCompletions = completionsSnapshot.docs.map(
      (doc) => doc.data() as any
    );

    const displayName = user.displayName || 'Anonymous User';
    const photoURL = user.photoURL;

    // 3. Update the 'Overall' leaderboard.
    const overallTotal = allCompletions.length;
    const overallLeaderboardRef = doc(db, 'leaderboard_overall', userId);
    const overallData: LeaderboardEntry = {
      userId,
      testsCompleted: overallTotal,
      division: 'Overall',
      displayName,
      photoURL,
      showOnLeaderboard,
    };
    // This is a non-blocking write.
    setDoc(overallLeaderboardRef, overallData, { merge: true }).catch(
      (error) => {
        const permissionError = new FirestorePermissionError({
          path: overallLeaderboardRef.path,
          operation: 'write',
          requestResourceData: overallData,
        });
        errorEmitter.emit('permission-error', permissionError);
      }
    );

    // 4. Group completions by division to update 'By Division' leaderboards.
    const completionsByDivision = allCompletions.reduce((acc, c) => {
      acc[c.division] = (acc[c.division] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // 5. Update each relevant 'By Division' leaderboard.
    for (const division in completionsByDivision) {
      const divisionTotal = completionsByDivision[division];
      const divisionLeaderboardId = `${userId}_${division
        .replace(/\s+/g, '_')
        .toLowerCase()}`;
      const divisionLeaderboardRef = doc(
        db,
        'leaderboard_by_division',
        divisionLeaderboardId
      );

      const divisionData: LeaderboardEntry = {
        userId,
        testsCompleted: divisionTotal,
        division: division,
        displayName,
        photoURL,
        showOnLeaderboard,
      };
      // This is a non-blocking write.
      setDoc(divisionLeaderboardRef, divisionData, { merge: true }).catch(
        (error) => {
          const permissionError = new FirestorePermissionError({
            path: divisionLeaderboardRef.path,
            operation: 'write',
            requestResourceData: divisionData,
          });
          errorEmitter.emit('permission-error', permissionError);
        }
      );
    }
  } catch (error) {
    console.error('Could not read test completions to update leaderboard:', error);
    const permissionError = new FirestorePermissionError({
      path: `users/${userId}/testCompletions`,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
  }
}

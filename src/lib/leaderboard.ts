'use client';

import {
  collection,
  doc,
  getDocs,
  writeBatch,
  query,
  where,
  Firestore,
} from 'firebase/firestore';
import type { LeaderboardEntry } from './types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { User } from 'firebase/auth';

/**
 * Updates a user's entries in all relevant leaderboard collections.
 * This function is called after a test submission or privacy change.
 * It always writes the user's data, including their 'showOnLeaderboard' preference.
 * Filtering is then handled on the client-side during display.
 *
 * @param db The Firestore instance.
 * @param user The authenticated Firebase User object.
 * @param showOnLeaderboard The user's current visibility preference.
 */
export async function updateUserLeaderboardEntries(
  db: Firestore,
  user: User | null,
  showOnLeaderboard: boolean
) {
  if (!user) return;
  const userId = user.uid;

  try {
    const batch = writeBatch(db);
    const testCompletionsRef = collection(db, 'users', userId, 'testCompletions');
    const completionsSnapshot = await getDocs(testCompletionsRef);
    const allCompletions = completionsSnapshot.docs.map(doc => doc.data() as any);

    const displayName = user.displayName || 'Anonymous User';
    const photoURL = user.photoURL;

    // 1. Update the 'Overall' leaderboard.
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
    batch.set(overallLeaderboardRef, overallData, { merge: true });

    // 2. Group completions by division.
    const completionsByDivision = allCompletions.reduce((acc, c) => {
      acc[c.division] = (acc[c.division] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // 3. Update each relevant 'By Division' leaderboard.
    for (const division in completionsByDivision) {
      const divisionTotal = completionsByDivision[division];
      const divisionLeaderboardId = `${userId}_${division.replace(/\s+/g, '_').toLowerCase()}`;
      const divisionLeaderboardRef = doc(db, 'leaderboard_by_division', divisionLeaderboardId);

      const divisionData: LeaderboardEntry = {
        userId,
        testsCompleted: divisionTotal,
        division: division,
        displayName,
        photoURL,
        showOnLeaderboard,
      };
      batch.set(divisionLeaderboardRef, divisionData, { merge: true });
    }

    // 4. Commit all changes at once.
    await batch.commit();

  } catch (error) {
    console.error('Error updating leaderboard entries:', error);
    // Determine if it was a read or write error for better context
    const permissionError = new FirestorePermissionError({
        path: `users/${userId}/leaderboard_updates`,
        operation: 'write', // This is a batch write operation
        requestResourceData: { userId, showOnLeaderboard }
    });
    errorEmitter.emit('permission-error', permissionError);
  }
}

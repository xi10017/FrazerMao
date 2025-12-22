'use client';

import {
  collection,
  doc,
  getDocs,
  setDoc,
  getDoc,
  Firestore,
  deleteDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { LeaderboardEntry } from './types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { User } from 'firebase/auth';

/**
 * Updates or creates/deletes a user's entries in all relevant leaderboard collections.
 * This function handles both test submissions and privacy setting changes.
 *
 * @param db The Firestore instance.
 * @param user The authenticated Firebase User object.
 * @param showOnLeaderboard The user's current visibility preference. If not provided, it's fetched from their profile.
 */
export async function updateUserLeaderboardEntries(
  db: Firestore,
  user: User,
  showOnLeaderboard?: boolean
) {
  if (!user) return;

  const userId = user.uid;
  let shouldBeVisible = showOnLeaderboard;

  // 1. Determine visibility preference
  if (shouldBeVisible === undefined) {
    const userProfileRef = doc(db, 'users', userId);
    try {
      const userProfileSnap = await getDoc(userProfileRef);
      shouldBeVisible = userProfileSnap.data()?.showOnLeaderboard ?? true;
    } catch (error) {
      console.error('Could not fetch user profile to check visibility', error);
      const permissionError = new FirestorePermissionError({
        path: userProfileRef.path,
        operation: 'get',
      });
      errorEmitter.emit('permission-error', permissionError);
      return; // Can't proceed without knowing visibility
    }
  }

  // 2. If the user wants to be hidden, find and delete all their leaderboard entries.
  if (!shouldBeVisible) {
    try {
      const batch = writeBatch(db);

      // Delete overall entry
      const overallRef = doc(db, 'leaderboard_overall', userId);
      batch.delete(overallRef);

      // Query for all division-specific entries for the user
      const divisionQuery = query(
        collection(db, 'leaderboard_by_division'),
        where('userId', '==', userId)
      );
      const divisionSnapshot = await getDocs(divisionQuery);
      divisionSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Commit the batch deletion
      await batch.commit();
    } catch (error) {
      console.error('Failed to delete leaderboard entries:', error);
      // We might not have permissions to query/delete, but we shouldn't crash
    }
    return; // Stop here.
  }

  // 3. If the user wants to be shown, proceed with updating/creating entries.
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

    // 4. Update the 'Overall' leaderboard.
    const overallTotal = allCompletions.length;
    const overallLeaderboardRef = doc(db, 'leaderboard_overall', userId);
    const overallData: LeaderboardEntry = {
      userId,
      testsCompleted: overallTotal,
      division: 'Overall',
      displayName,
      photoURL: photoURL ?? null,
    };
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

    // 5. Group completions by division to update 'By Division' leaderboards.
    const completionsByDivision = allCompletions.reduce((acc, c) => {
      acc[c.division] = (acc[c.division] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // 6. Update each relevant 'By Division' leaderboard.
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
        photoURL: photoURL ?? null,
      };

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

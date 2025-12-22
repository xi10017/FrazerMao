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
} from 'firebase/firestore';
import type { UserProfile, LeaderboardEntry, TestSubmission } from './types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { User } from 'firebase/auth';

/**
 * Updates or creates a user's entries in all relevant leaderboard collections.
 * This function is designed to be called both after a test submission and when a user changes their privacy settings.
 *
 * @param db The Firestore instance.
 * @param user The authenticated Firebase User object.
 */
export async function updateUserLeaderboardEntries(db: Firestore, user: User) {
  if (!user) return; // Can't proceed without a user

  const userId = user.uid;
  const userProfileRef = doc(db, 'users', userId);
  const testCompletionsRef = collection(db, 'users', userId, 'testCompletions');

  try {
    // 1. Fetch all necessary data upfront.
    const [userProfileSnap, completionsSnapshot] = await Promise.all([
      getDoc(userProfileRef),
      getDocs(testCompletionsRef),
    ]);

    const userProfile = userProfileSnap.data() as UserProfile | undefined;
    const showOnLeaderboard = userProfile?.showOnLeaderboard ?? true;

    // Get all completions to know which divisions to delete from if user is hidden
    const allCompletions = completionsSnapshot.docs.map(
      (doc) => doc.data() as TestSubmission
    );

    // 2. If the user wants to be hidden, delete all their leaderboard entries.
    if (!showOnLeaderboard) {
      // Delete overall entry
      const overallRef = doc(db, 'leaderboard_overall', userId);
      deleteDoc(overallRef).catch((e) =>
        console.error('Could not delete overall leaderboard doc', e)
      );

      // Find and delete all division-specific entries for the user
      // We derive the divisions from their past completions to know which documents to target
      const divisions = [...new Set(allCompletions.map((c) => c.division))];
      for (const division of divisions) {
        const divisionLeaderboardId = `${userId}_${division.replace(/\s+/g, '_').toLowerCase()}`;
        const divisionRef = doc(db, 'leaderboard_by_division', divisionLeaderboardId);
        deleteDoc(divisionRef).catch((e) =>
          console.error(`Could not delete division entry ${divisionRef.id}`, e)
        );
      }

      // Stop here, no need to create new entries.
      return;
    }

    // 3. If the user wants to be shown, proceed with updating/creating entries.
    const displayName = user.displayName || 'Anonymous User';
    const photoURL = user.photoURL || null;
    
    // 4. Update the 'Overall' leaderboard.
    const overallTotal = allCompletions.length;
    const overallLeaderboardRef = doc(db, 'leaderboard_overall', userId);

    const overallData: LeaderboardEntry = {
      userId: userId,
      testsCompleted: overallTotal,
      division: 'Overall',
      displayName,
      photoURL,
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
      const divisionLeaderboardId = `${userId}_${division.replace(/\s+/g, '_').toLowerCase()}`;
      const divisionLeaderboardRef = doc(
        db,
        'leaderboard_by_division',
        divisionLeaderboardId
      );

      const divisionData: LeaderboardEntry = {
        userId: userId,
        testsCompleted: divisionTotal,
        division: division,
        displayName,
        photoURL,
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
    console.error('Could not update leaderboard entries:', error);
    // This could be a permissions error on reading testCompletions or userProfile
    const permissionError = new FirestorePermissionError({
      path: `users/${userId}`,
      operation: 'get',
    });
    errorEmitter.emit('permission-error', permissionError);
  }
}

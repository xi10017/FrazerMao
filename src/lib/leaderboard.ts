'use client';

import {
  collection,
  doc,
  getDocs,
  setDoc,
  getDoc,
  Firestore,
} from 'firebase/firestore';
import type { UserProfile, LeaderboardEntry } from './types';
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
    // 1. Fetch the user's profile to get their current privacy setting.
    const userProfileSnap = await getDoc(userProfileRef);
    const userProfile = userProfileSnap.data() as UserProfile | undefined;
    const showOnLeaderboard = userProfile?.showOnLeaderboard ?? true; // Default to visible

    // Determine the name and photo to display based on the privacy setting.
    const displayName = showOnLeaderboard
      ? user.displayName || 'Anonymous User'
      : 'Anonymous User';
    const photoURL = showOnLeaderboard ? user.photoURL || undefined : undefined;

    // 2. Fetch all test completions to calculate scores.
    const querySnapshot = await getDocs(testCompletionsRef);
    const allCompletions = querySnapshot.docs.map((doc) => doc.data());

    // 3. Update the 'Overall' leaderboard.
    const overallTotal = allCompletions.length;
    const overallLeaderboardRef = doc(db, 'leaderboard_overall', userId);
    const overallData: LeaderboardEntry = {
      userId: userId,
      testsCompleted: overallTotal,
      division: 'Overall',
      displayName,
      photoURL,
    };
    // Use setDoc with merge to create or update.
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
    const completionsByDivision: { [key: string]: any[] } =
      allCompletions.reduce((acc, c) => {
        if (!acc[c.division]) {
          acc[c.division] = [];
        }
        acc[c.division].push(c);
        return acc;
      }, {} as { [key: string]: any[] });

    // 5. Update each relevant 'By Division' leaderboard.
    for (const division in completionsByDivision) {
      const divisionTotal = completionsByDivision[division].length;
      const divisionLeaderboardId = `${userId}_${division
        .replace(/\s+/g, '_')
        .toLowerCase()}`;
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
      // Use setDoc with merge to create or update.
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

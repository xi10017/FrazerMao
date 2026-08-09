import type { SupabaseClient } from '@supabase/supabase-js';
import type { LeaderboardEntry } from './types';
import { updateGroupMemberStats } from './study-groups';
import type { AppUser } from '@/supabase';

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
  db: SupabaseClient,
  user: AppUser | null,
  showOnLeaderboard: boolean
) {
  if (!user) return;
  const userId = user.uid;

  try {
    const { data: allCompletions, error: completionsError } = await db
      .from('test_submissions')
      .select('division')
      .eq('user_id', userId);
    if (completionsError) throw completionsError;

    const displayName = user.displayName || 'Anonymous User';
    const photoURL = user.photoURL;

    // 1. Update the 'Overall' leaderboard.
    const overallTotal = allCompletions.length;
    const overallData: LeaderboardEntry = {
      userId,
      testsCompleted: overallTotal,
      division: 'Overall',
      displayName,
      photoURL,
      showOnLeaderboard,
    };
    const { error: overallError } = await db
      .from('leaderboard_overall')
      .upsert({
        user_id: userId,
        division: overallData.division,
        tests_completed: overallData.testsCompleted,
        display_name: overallData.displayName,
        photo_url: overallData.photoURL,
        show_on_leaderboard: overallData.showOnLeaderboard,
      });
    if (overallError) throw overallError;

    // 2. Group completions by division.
    const completionsByDivision = allCompletions.reduce((acc, c) => {
      acc[c.division] = (acc[c.division] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // 3. Update each relevant 'By Division' leaderboard.
    for (const division in completionsByDivision) {
      const divisionTotal = completionsByDivision[division];
      const divisionData: LeaderboardEntry = {
        userId,
        testsCompleted: divisionTotal,
        division: division,
        displayName,
        photoURL,
        showOnLeaderboard,
      };
      const { error: divisionError } = await db
        .from('leaderboard_by_division')
        .upsert({
          user_id: userId,
          division: divisionData.division,
          tests_completed: divisionData.testsCompleted,
          display_name: divisionData.displayName,
          photo_url: divisionData.photoURL,
          show_on_leaderboard: divisionData.showOnLeaderboard,
        });
      if (divisionError) throw divisionError;
    }

    await updateGroupMemberStats(db, user, overallTotal, showOnLeaderboard);

  } catch (error) {
    console.error('Error updating leaderboard entries:', error);
  }
}

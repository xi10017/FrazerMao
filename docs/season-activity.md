# Season activity leaderboard

Apply `supabase/migrations/20261025010000_season_activity.sql` before using the
new Leaderboard tab. Also apply `20261025020000_season_participation.sql`
for the Join/Leave controls, then `20261025030000_season_rollover_settings.sql`
for admin rollover configuration. Neither migration is applied automatically.

## Rules

- By default a season starts April 1 at midnight in `America/New_York`. Admins
  can change the annual rollover month/day in `/admin/seasons`. Daily buckets
  use Eastern time, including DST.
- Each completed submission earns one point, capped at six per student per day.
  Full attempts and retakes count equally. Scores and elapsed time do not affect points.
- Existing submissions are backfilled into their matching seasons. Their original
  recorded submission timestamps determine their season/day.
- Equal totals share a rank. The UI shows the first 100 rank positions, including ties.
- Joining is explicit and applies to the current season only. Earlier attempts in
  that season count. New seasons default to not participating.
- Joining publishes the display name and points and enters the student into award
  consideration. Leaving removes current-season public ranking and consideration.
- Past-season participation is preserved. Leaving a later season or switching its
  visibility off does not revoke earlier eligibility. Account deletion removes activity.
- Completed seasons predating the participation migration retain students whose
  profile visibility was enabled. The current season requires explicit joining.

## Rollover and persistence

A database insert trigger stores a private completion receipt alongside each new
submission, using database time. Clients cannot write, edit, or read those receipts
directly. No additional browser write request is required. Editing submission dates
later cannot move points, and deleting an individual submission does not remove its
receipt. This keeps completed-season activity totals from changing with history edits.
Display names follow the current profile. Participation/visibility is stored by season.

The authenticated-only RPC exposes ranking fields, without answers, scores,
email addresses, timing details, or raw receipt records. The UI loads it on opening
and refreshes every minute while visible, and when returning to the tab. The
server's current date determines the current season; no scheduled reset job is needed.
Past seasons remain available in collapsible sections.

Rollover settings are restricted to accounts in `admins` on the server. Rules
have an effective rollover year, so completed boundaries never change. An April 2
edit from April 1 to April 18 changes the next year's rollover, then recurs on
April 18. Edits before a rollover may change that upcoming rollover, provided the
new date is still in the future. The admin page previews the exact year/date;
stale edits crossing a rollover are rejected. Invalid recurring dates (including
February 29) are rejected. Leaderboard scoring and participation share these rules.
The leaderboard displays the actual next rollover instead of a fixed date.

The separate award-cutoff control remains deferred; this setting controls season
rollovers and does not introduce an independent award-finalization date. This is not a verification of genuine practice: completing
an attempt, even a short one, counts under the chosen rules.

## Private award details

Apply `20261025060000_season_award_identity.sql` after the rollover migration.
Joining now requires confirming full name and school through the leaderboard form.
Prior season details are prefilled, but joining/confirmation is never automatic.
The identity snapshot is stored on that season's private participation record.
Updating a later season does not rewrite previous snapshots. Leaving preserves
the record but removes current participation.

Public rankings still expose display names and points only. Students can read
their own saved details; admins can review season-specific details in Admin → Participant details. Existing participants without details see a confirmation form and
admins see “Needs confirmation.” These are self-reported details, not verified
identity. Settings can leave the season but directs new joins to the form.

## First official season

2026–2027 is the first official award season. Apply
`20261025070000_first_official_season.sql` to filter earlier receipts from public
rankings and earlier participants from award admin results. Historical practice,
receipts, and private snapshots are not deleted. The UI also hides unofficial
pre-2026 seasons while the database migration is being applied.

## Private daily totals

Apply `20261025080000_personal_season_activity.sql` to include the signed-in
user's own daily count, capped points, season points, and last seven Eastern dates
in the existing leaderboard response. These totals are available without joining
and cannot be requested for another user. They add no separate polling requests.
Public rankings continue to require season-specific participation.

## Pinned personal row

Apply `20261025090000_personal_rank_preview.sql` after the personal-totals
migration. The current user's row is pinned above public rankings even when
not joined, with season points and either the actual rank or a clearly labeled
private preview. Preview rank is one plus the number of joined students with
strictly more points; ties share a place. Students without season points are
unranked. Private preview rows are never inserted into other students' rankings.
Today's capped points remain above the table; the enrollment form follows it.

Deleting cloud practice history preserves season activity receipts, participation,
and private award details. The confirmation dialog states this explicitly. Account
deletion still removes season data through the existing user foreign keys.

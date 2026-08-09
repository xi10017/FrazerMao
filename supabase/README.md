# Supabase migration

This directory contains the target Postgres schema for moving MuPractice away
from Firebase. The Firebase-backed app remains the safety baseline on `main`.

## Current migration status

- The static catalog remains in `src/data/famat_tests.json` and does not need to
  move to Supabase.
- The schema below replaces Firebase Auth/Firestore data services.
- Existing Firebase users and documents still need to be exported and imported
  after a Supabase project is created.
- Do not disable Firebase billing or delete the Firebase project until the
  migrated app has been tested with real accounts and the imported data.

## Target mapping

| Firebase | Supabase |
| --- | --- |
| `users/{uid}` | `profiles` |
| `users/{uid}/testCompletions/{id}` | `test_submissions` |
| `users/{uid}/inProgress/{testId}` | `in_progress` |
| `users/{uid}/retakeInProgress/{testId}` | `retake_in_progress` |
| `users/{uid}/groupMemberships/{groupId}` | `group_memberships` |
| `study_groups/{groupId}` | `study_groups` |
| `study_groups/{groupId}/members/{uid}` | `study_group_members` |
| `leaderboard_overall` | `leaderboard_overall` |
| `leaderboard_by_division` | `leaderboard_by_division` |
| `aggregate_stats` | `aggregate_stats` |
| `answer_key_reports` | `answer_key_reports` |
| `answer_key_overrides/global` | `answer_key_overrides` |
| `admins` | `admins` |

Firebase UIDs are retained in `profiles.firebase_uid` during migration. New
application relationships use Supabase Auth UUIDs.

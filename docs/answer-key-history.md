# Restore original answer keys

Apply these migrations in order:

1. `supabase/migrations/20261025040000_answer_key_history.sql` (durable audit).
2. `supabase/migrations/20261025050000_restore_original_answer_key.sql` (restore action).

Under **Answer key reports → Archive**, approved report cards show a
**Restore original key** button while that question has an active override.
There is no separate corrections section.
**Restore original key** asks for confirmation, removes that question's override,
and refreshes the effective key. The report's original approval record stays intact.

The server checks admin access, serializes the operation against concurrent override
writes, and rejects the restore if the live answer differs from the displayed one.
The durable audit trigger records the removed value, actor, and timestamp. Existing
results follow the existing lazy-regrading behavior against the effective key;
restoring does not rewrite every stored score in bulk.

There is no separate history/revert/redo interface. Older audit RPCs remain
admin-only for compatibility with the earlier migration.

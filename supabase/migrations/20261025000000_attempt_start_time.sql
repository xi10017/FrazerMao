-- Optional for historical attempts: their actual start time is unknown.
alter table public.test_submissions
  add column if not exists started_at timestamptz;

comment on column public.test_submissions.started_at is
  'Client-recorded wall-clock attempt start, preserved across resume. Null when unknown; review signal, not proof of active work.';

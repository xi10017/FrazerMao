-- MuPractice target schema for Supabase/Postgres.
-- This is intentionally additive: it does not alter or delete Firebase data.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  firebase_uid text unique,
  display_name text not null default 'Anonymous User',
  email text,
  photo_url text,
  show_on_leaderboard boolean not null default true,
  bookmarked_test_ids jsonb not null default '[]'::jsonb,
  weekly_test_goal integer,
  streak_goal integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.test_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  firebase_id text,
  test_id text not null,
  answers jsonb not null default '{}'::jsonb,
  score jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default timezone('utc', now()),
  division text not null,
  test_name text not null,
  completion_date timestamptz not null default timezone('utc', now()),
  is_retake boolean not null default false,
  retake_source_submission_id uuid references public.test_submissions(id)
    on delete set null,
  marked_questions jsonb not null default '{}'::jsonb
);

create index if not exists test_submissions_user_id_idx
  on public.test_submissions(user_id);
create index if not exists test_submissions_user_test_idx
  on public.test_submissions(user_id, test_id);
create index if not exists test_submissions_division_idx
  on public.test_submissions(division);

create table if not exists public.in_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  test_id text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, test_id)
);

create table if not exists public.retake_in_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  test_id text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, test_id)
);

create table if not exists public.study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  member_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.study_group_members (
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Anonymous User',
  photo_url text,
  tests_completed integer not null default 0,
  show_on_leaderboard boolean not null default true,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (group_id, user_id)
);

create table if not exists public.group_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.study_groups(id) on delete cascade,
  group_name text not null,
  invite_code text not null,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, group_id)
);

create table if not exists public.leaderboard_overall (
  user_id uuid primary key references auth.users(id) on delete cascade,
  division text not null default 'Overall',
  tests_completed integer not null default 0,
  display_name text not null default 'Anonymous User',
  photo_url text,
  show_on_leaderboard boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.leaderboard_by_division (
  user_id uuid not null references auth.users(id) on delete cascade,
  division text not null,
  tests_completed integer not null default 0,
  display_name text not null default 'Anonymous User',
  photo_url text,
  show_on_leaderboard boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, division)
);

create index if not exists leaderboard_by_division_rank_idx
  on public.leaderboard_by_division(division, tests_completed desc);

create table if not exists public.aggregate_stats (
  test_id text primary key,
  submission_count integer not null default 0,
  total_score_sum integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.answer_key_reports (
  id text primary key,
  test_id text not null,
  test_name text not null,
  question_number integer not null check (question_number > 0),
  current_answer jsonb not null,
  proposed_answer jsonb not null,
  user_answer text,
  message text not null default '',
  user_id uuid not null references auth.users(id) on delete cascade,
  user_display_name text not null default 'Anonymous User',
  status text not null check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  admin_note text
);

create unique index if not exists answer_key_pending_user_question_idx
  on public.answer_key_reports(user_id, test_id, question_number)
  where status = 'pending';
create index if not exists answer_key_reports_status_created_idx
  on public.answer_key_reports(status, created_at desc);

create table if not exists public.answer_key_overrides (
  test_id text not null,
  question_number integer not null check (question_number > 0),
  answer jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id) on delete set null,
  last_source_report_id text references public.answer_key_reports(id)
    on delete set null,
  primary key (test_id, question_number)
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists groups_set_updated_at on public.study_groups;
create trigger groups_set_updated_at
before update on public.study_groups
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.test_submissions enable row level security;
alter table public.in_progress enable row level security;
alter table public.retake_in_progress enable row level security;
alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.group_memberships enable row level security;
alter table public.leaderboard_overall enable row level security;
alter table public.leaderboard_by_division enable row level security;
alter table public.aggregate_stats enable row level security;
alter table public.answer_key_reports enable row level security;
alter table public.answer_key_overrides enable row level security;
alter table public.admins enable row level security;

-- Public profile and leaderboard reads match the current Firebase behavior.
create policy profiles_public_read on public.profiles
for select to anon, authenticated using (true);
create policy profiles_owner_insert on public.profiles
for insert to authenticated with check (id = auth.uid());
create policy profiles_owner_update on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy submissions_owner_all on public.test_submissions
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy progress_owner_all on public.in_progress
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy retake_progress_owner_all on public.retake_in_progress
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy groups_authenticated_read on public.study_groups
for select to authenticated using (true);
create policy groups_owner_insert on public.study_groups
for insert to authenticated with check (created_by = auth.uid());
create policy groups_owner_update on public.study_groups
for update to authenticated using (created_by = auth.uid())
with check (created_by = auth.uid());
create policy groups_owner_delete on public.study_groups
for delete to authenticated using (created_by = auth.uid());

create policy group_members_authenticated_read on public.study_group_members
for select to authenticated using (true);
create policy group_members_self_insert on public.study_group_members
for insert to authenticated with check (user_id = auth.uid());
create policy group_members_self_update on public.study_group_members
for update to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy group_members_self_delete on public.study_group_members
for delete to authenticated using (user_id = auth.uid());

create policy memberships_owner_all on public.group_memberships
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy overall_leaderboard_public_read on public.leaderboard_overall
for select to anon, authenticated using (true);
create policy overall_leaderboard_owner_write on public.leaderboard_overall
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy division_leaderboard_public_read on public.leaderboard_by_division
for select to anon, authenticated using (true);
create policy division_leaderboard_owner_write on public.leaderboard_by_division
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy aggregate_stats_public_read on public.aggregate_stats
for select to anon, authenticated using (true);
create policy aggregate_stats_authenticated_write on public.aggregate_stats
for all to authenticated using (true) with check (true);

create policy reports_owner_or_admin_read on public.answer_key_reports
for select to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.admins a where a.user_id = auth.uid())
);
create policy reports_owner_insert on public.answer_key_reports
for insert to authenticated
with check (user_id = auth.uid() and status = 'pending');
create policy reports_owner_pending_update on public.answer_key_reports
for update to authenticated
using (user_id = auth.uid() and status = 'pending')
with check (user_id = auth.uid() and status = 'pending');
create policy reports_owner_pending_delete on public.answer_key_reports
for delete to authenticated
using (user_id = auth.uid() and status = 'pending');
create policy reports_admin_update on public.answer_key_reports
for update to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy overrides_public_read on public.answer_key_overrides
for select to anon, authenticated using (true);
create policy overrides_admin_write on public.answer_key_overrides
for all to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy admins_self_read on public.admins
for select to authenticated using (user_id = auth.uid());

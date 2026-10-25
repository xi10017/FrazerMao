-- A private, append-only receipt of completed attempts. No answers or scores.
-- Receipts survive individual history deletion and cannot be edited by clients.
create table if not exists public.season_activity (
  submission_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null
);
alter table public.season_activity enable row level security;
revoke all on public.season_activity from anon, authenticated;
create index if not exists season_activity_user_completed_idx
  on public.season_activity (user_id, completed_at);

create or replace function public.record_season_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.season_activity (submission_id, user_id, completed_at)
  values (new.id, new.user_id, statement_timestamp())
  on conflict (submission_id) do nothing;
  return new;
end;
$$;
revoke all on function public.record_season_activity() from public, anon, authenticated;
drop trigger if exists record_season_activity on public.test_submissions;
create trigger record_season_activity after insert on public.test_submissions
for each row execute function public.record_season_activity();

-- Existing attempts count retroactively, using their recorded submission dates.
insert into public.season_activity (submission_id, user_id, completed_at)
select id, user_id, submitted_at from public.test_submissions
on conflict (submission_id) do nothing;

-- Only opt-in public ranking fields leave the database; raw receipts stay private.
-- Eastern days/seasons handle DST automatically. April 1 starts a new season.
create or replace function public.get_season_activity_leaderboard()
returns jsonb language sql stable security definer set search_path = '' as $$
  with current_season as (
    select extract(year from ((now() at time zone 'America/New_York') - interval '3 months'))::int as year
  ), daily as (
    select user_id, (completed_at at time zone 'America/New_York')::date as day,
      least(count(*), 6)::int as points
    from public.season_activity
    where completed_at <= now()
    group by user_id, (completed_at at time zone 'America/New_York')::date
  ), totals as (
    select user_id, extract(year from (day - interval '3 months'))::int as year,
      sum(points)::int as points
    from daily group by user_id, extract(year from (day - interval '3 months'))::int
  ), ranked as (
    select t.year, t.user_id, coalesce(p.display_name, 'Anonymous User') as display_name,
      p.photo_url, t.points, rank() over (partition by t.year order by t.points desc) as rank
    from totals t join public.profiles p on p.id = t.user_id
    where p.show_on_leaderboard = true
  ), seasons as (
    select year from current_season union select year from totals
  )
  select jsonb_build_object(
    'currentSeason', (select year from current_season),
    'seasons', coalesce((select jsonb_agg(jsonb_build_object(
      'startYear', s.year,
      'entries', coalesce((select jsonb_agg(jsonb_build_object(
        'userId', r.user_id, 'displayName', r.display_name, 'photoURL', r.photo_url,
        'points', r.points, 'rank', r.rank
      ) order by r.points desc, r.display_name, r.user_id)
      from ranked r where r.year = s.year and r.rank <= 100), '[]'::jsonb)
    ) order by s.year desc) from seasons s), '[]'::jsonb)
  );
$$;
revoke all on function public.get_season_activity_leaderboard() from public, anon;
grant execute on function public.get_season_activity_leaderboard() to authenticated;

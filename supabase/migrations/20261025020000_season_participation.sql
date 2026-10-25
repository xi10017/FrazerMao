-- Explicit participation is recorded separately for each season.
create table if not exists public.season_participation (
  user_id uuid not null references auth.users(id) on delete cascade,
  season_year integer not null,
  participating boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, season_year)
);
alter table public.season_participation enable row level security;
revoke all on public.season_participation from anon, authenticated;

-- Preserve already completed seasons for users who had public visibility enabled.
-- Current/future seasons require an explicit Join action.
insert into public.season_participation(user_id, season_year, participating)
select distinct a.user_id,
  extract(year from ((a.completed_at at time zone 'America/New_York') - interval '3 months'))::int,
  true
from public.season_activity a join public.profiles p on p.id = a.user_id
where p.show_on_leaderboard = true
  and extract(year from ((a.completed_at at time zone 'America/New_York') - interval '3 months'))::int
    < extract(year from ((now() at time zone 'America/New_York') - interval '3 months'))::int
on conflict do nothing;

-- No season argument: clients can change only their own CURRENT participation.
create or replace function public.set_season_participation(join_season boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_year integer := extract(year from ((now() at time zone 'America/New_York') - interval '3 months'))::int;
begin
  if auth.uid() is null then raise exception 'Sign in to join the season leaderboard'; end if;
  if join_season is null then raise exception 'Participation must be true or false'; end if;
  insert into public.season_participation(user_id, season_year, participating)
  values (auth.uid(), current_year, join_season)
  on conflict (user_id, season_year) do update
    set participating = excluded.participating, updated_at = now();
  update public.profiles set show_on_leaderboard = join_season where id = auth.uid();
end;
$$;
revoke all on function public.set_season_participation(boolean) from public, anon;
grant execute on function public.set_season_participation(boolean) to authenticated;

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
    join public.season_participation sp on sp.user_id = t.user_id
      and sp.season_year = t.year and sp.participating = true
  ), seasons as (
    select year from current_season union select year from totals
  )
  select jsonb_build_object(
    'currentSeason', (select year from current_season),
    'participating', coalesce((select sp.participating from public.season_participation sp
      where sp.user_id = auth.uid() and sp.season_year = (select year from current_season)), false),
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

-- Effective-year rules preserve all boundaries that have already happened.
create table if not exists public.season_rollover_rules (
  effective_year integer primary key,
  month integer not null check (month between 1 and 12),
  day integer not null check (day between 1 and 31),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
alter table public.season_rollover_rules enable row level security;
revoke all on public.season_rollover_rules from anon, authenticated;
insert into public.season_rollover_rules(effective_year, month, day)
values (1, 4, 1) on conflict do nothing;

create or replace function public.season_rollover_date(rollover_year integer)
returns date language sql stable security definer set search_path = '' as $$
  select make_date(rollover_year, r.month, r.day)
  from public.season_rollover_rules r
  where r.effective_year <= rollover_year order by r.effective_year desc limit 1;
$$;

create or replace function public.season_year_for_date(local_day date)
returns integer language sql stable security definer set search_path = '' as $$
  select case when local_day >= public.season_rollover_date(extract(year from local_day)::int)
    then extract(year from local_day)::int else extract(year from local_day)::int - 1 end;
$$;
revoke all on function public.season_rollover_date(integer) from public, anon, authenticated;
revoke all on function public.season_year_for_date(date) from public, anon, authenticated;

create or replace function public.get_season_rollover_settings()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  season integer := public.season_year_for_date((now() at time zone 'America/New_York')::date);
  next_date date := public.season_rollover_date(season + 1);
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;
  return jsonb_build_object('currentSeason', season, 'nextYear', season + 1,
    'nextRollover', next_date, 'month', extract(month from next_date)::int,
    'day', extract(day from next_date)::int);
end;
$$;

create or replace function public.set_season_rollover_settings(
  rollover_month integer, rollover_day integer, expected_next_year integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  next_year integer;
  candidate date;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;
  -- Serialize edits and reject a stale screen across a rollover.
  perform pg_advisory_xact_lock(26410525);
  next_year := public.season_year_for_date((clock_timestamp() at time zone 'America/New_York')::date) + 1;
  if expected_next_year is distinct from next_year then
    raise exception 'The season has changed. Reload the settings before saving.';
  end if;
  if rollover_month is null or rollover_day is null then raise exception 'Choose a month and day'; end if;
  -- Validate a recurring date: February 29 is not valid every year.
  perform make_date(2001, rollover_month, rollover_day);
  candidate := make_date(next_year, rollover_month, rollover_day);
  if candidate <= (clock_timestamp() at time zone 'America/New_York')::date then
    raise exception 'The next rollover must be a future date. Completed seasons cannot change.';
  end if;
  insert into public.season_rollover_rules(effective_year, month, day, changed_by)
  values (next_year, rollover_month, rollover_day, auth.uid())
  on conflict (effective_year) do update set month = excluded.month, day = excluded.day,
    changed_by = excluded.changed_by, changed_at = now();
  return public.get_season_rollover_settings();
end;
$$;
revoke all on function public.get_season_rollover_settings() from public, anon;
revoke all on function public.set_season_rollover_settings(integer, integer, integer) from public, anon;
grant execute on function public.get_season_rollover_settings() to authenticated;
grant execute on function public.set_season_rollover_settings(integer, integer, integer) to authenticated;

create or replace function public.set_season_participation(join_season boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_year integer := public.season_year_for_date((now() at time zone 'America/New_York')::date);
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
    select public.season_year_for_date((now() at time zone 'America/New_York')::date) as year
  ), daily as (
    select user_id, (completed_at at time zone 'America/New_York')::date as day,
      least(count(*), 6)::int as points
    from public.season_activity
    where completed_at <= now()
    group by user_id, (completed_at at time zone 'America/New_York')::date
  ), totals as (
    select user_id, public.season_year_for_date(day) as year,
      sum(points)::int as points
    from daily group by user_id, public.season_year_for_date(day)
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
    'nextRollover', public.season_rollover_date((select year + 1 from current_season)),
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

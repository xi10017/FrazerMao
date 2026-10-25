-- The award began in 2026–2027. Older practice and receipts remain intact.
create or replace function public.get_season_activity_leaderboard()
returns jsonb language sql stable security definer set search_path = '' as $$
  with current_season as (
    select public.season_year_for_date((now() at time zone 'America/New_York')::date) as year
  ), daily as (
    select user_id, (completed_at at time zone 'America/New_York')::date as day,
      count(*)::int as completed, least(count(*), 6)::int as points
    from public.season_activity
    where completed_at <= now()
      and completed_at >= (public.season_rollover_date(2026)::timestamp at time zone 'America/New_York')
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
    'myActivity', jsonb_build_object(
      'rank', case when coalesce((select points from totals where user_id=auth.uid() and year=(select year from current_season)),0)>0 then
        1 + (select count(*) from ranked where year=(select year from current_season)
          and points>coalesce((select points from totals where user_id=auth.uid() and year=(select year from current_season)),0))
        else null end,
      'todayCompleted', coalesce((select completed from daily where user_id=auth.uid() and day=(now() at time zone 'America/New_York')::date),0),
      'todayPoints', coalesce((select points from daily where user_id=auth.uid() and day=(now() at time zone 'America/New_York')::date),0),
      'seasonPoints', coalesce((select points from totals where user_id=auth.uid() and year=(select year from current_season)),0),
      'dailyCap', 6,
      'days', coalesce((select jsonb_agg(jsonb_build_object('date',d.day::date,
          'completed',coalesce(activity.completed,0),'points',coalesce(activity.points,0)) order by d.day desc)
        from generate_series(
          greatest((now() at time zone 'America/New_York')::date-6,public.season_rollover_date((select year from current_season)))::timestamp,
          (now() at time zone 'America/New_York')::date::timestamp,interval '1 day') as d(day)
        left join daily activity on activity.user_id=auth.uid() and activity.day=d.day::date), '[]'::jsonb)
    ),
    'firstSeason', 2026,
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


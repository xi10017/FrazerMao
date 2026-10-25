-- The award began in 2026–2027. Older practice and receipts remain intact.
create or replace function public.get_season_activity_leaderboard()
returns jsonb language sql stable security definer set search_path = '' as $$
  with current_season as (
    select public.season_year_for_date((now() at time zone 'America/New_York')::date) as year
  ), daily as (
    select user_id, (completed_at at time zone 'America/New_York')::date as day,
      least(count(*), 6)::int as points
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

create or replace function public.get_season_award_participants(target_season integer default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare season integer := coalesce(target_season,public.season_year_for_date((now() at time zone 'America/New_York')::date));
begin
  if not exists(select 1 from public.admins where user_id=auth.uid()) then raise exception 'Admin access required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('userId',sp.user_id,'displayName',p.display_name,
    'fullName',sp.full_name,'school',sp.school_name,'participating',sp.participating,
    'confirmedAt',sp.details_confirmed_at,'seasonYear',sp.season_year) order by sp.full_name nulls last,sp.user_id)
    from public.season_participation sp left join public.profiles p on p.id=sp.user_id
    where sp.season_year=season and sp.season_year>=2026), '[]'::jsonb);
end;
$$;
revoke all on function public.get_season_award_participants(integer) from public, anon;
grant execute on function public.get_season_award_participants(integer) to authenticated;

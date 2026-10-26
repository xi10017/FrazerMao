-- Public preview exposes only opted-in display names and points, never award identities.
create or replace function public.get_public_season_preview()
returns jsonb language sql stable security definer set search_path = '' as $$
  with season as (
    select public.season_year_for_date((now() at time zone 'America/New_York')::date) as year
  ), daily as (
    select a.user_id, (a.completed_at at time zone 'America/New_York')::date as day,
      least(count(*),6)::int as points
    from public.season_activity a
    where a.completed_at <= now()
      and a.completed_at >= (public.season_rollover_date((select year from season))::timestamp at time zone 'America/New_York')
    group by a.user_id, (a.completed_at at time zone 'America/New_York')::date
  ), totals as (
    select d.user_id, sum(d.points)::int as points from daily d
    join public.season_participation sp on sp.user_id=d.user_id
      and sp.season_year=(select year from season) and sp.participating=true
    where public.season_year_for_date(d.day)=(select year from season)
    group by d.user_id having sum(d.points)>0
  ), ranked as (
    select p.display_name, t.points, rank() over(order by t.points desc) as rank
    from totals t join public.profiles p on p.id=t.user_id
  )
  select jsonb_build_object('currentSeason',(select year from season),
    'entries',coalesce((select jsonb_agg(jsonb_build_object(
      'displayName',r.display_name,'points',r.points,'rank',r.rank
    ) order by r.points desc,r.display_name) from ranked r where r.rank<=5),'[]'::jsonb));
$$;
revoke all on function public.get_public_season_preview() from public;
grant execute on function public.get_public_season_preview() to anon, authenticated;

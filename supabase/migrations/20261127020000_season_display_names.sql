-- Keep award identity private while allowing an opted-in public leaderboard name.
begin;

alter table public.season_participation
  add column if not exists display_name text;

create or replace function public.get_my_season_award_details()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  season integer := public.season_year_for_date((now() at time zone 'America/New_York')::date);
  current_details public.season_participation%rowtype;
  prior_details public.season_participation%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into current_details from public.season_participation
    where user_id=auth.uid() and season_year=season;
  select * into prior_details from public.season_participation
    where user_id=auth.uid() and season_year<=season
      and full_name is not null and school_name is not null
    order by season_year desc limit 1;
  return jsonb_build_object(
    'seasonYear', season,
    'displayName', coalesce(current_details.display_name, prior_details.display_name, ''),
    'fullName', coalesce(current_details.full_name, prior_details.full_name, ''),
    'school', coalesce(current_details.school_name, prior_details.school_name, ''),
    'confirmed', current_details.details_confirmed_at is not null,
    'displayNameConfirmed', nullif(btrim(current_details.display_name), '') is not null
  );
end;
$$;

create or replace function public.join_season_award(
  display_name_input text, full_name_input text, school_input text, expected_season integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  season integer := public.season_year_for_date((now() at time zone 'America/New_York')::date);
  public_name text := btrim(display_name_input);
  student_name text := btrim(full_name_input);
  student_school text := btrim(school_input);
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if expected_season is distinct from season then raise exception 'The season has changed. Reload and confirm your details again.'; end if;
  if public_name is null or length(public_name) not between 1 and 60 then raise exception 'Enter a display name (up to 60 characters).'; end if;
  if student_name is null or length(student_name) not between 1 and 120 then raise exception 'Enter your full name (up to 120 characters).'; end if;
  if student_school is null or length(student_school) not between 1 and 160 then raise exception 'Enter your school (up to 160 characters).'; end if;
  insert into public.season_participation(user_id,season_year,participating,display_name,full_name,school_name,details_confirmed_at)
  values(auth.uid(),season,true,public_name,student_name,student_school,now())
  on conflict(user_id,season_year) do update set participating=true,display_name=excluded.display_name,
    full_name=excluded.full_name,school_name=excluded.school_name,details_confirmed_at=now(),updated_at=now();
  update public.profiles set show_on_leaderboard=true where id=auth.uid();
end;
$$;
revoke all on function public.join_season_award(text,text,integer) from public, anon, authenticated;
revoke all on function public.join_season_award(text,text,text,integer) from public, anon;
grant execute on function public.join_season_award(text,text,text,integer) to authenticated;

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
    select user_id, public.season_year_for_date(day) as year, sum(points)::int as points
    from daily group by user_id, public.season_year_for_date(day)
  ), ranked as (
    select t.year, t.user_id,
      coalesce(nullif(btrim(sp.display_name), ''), 'Anonymous User') as display_name,
      coalesce(nullif(btrim(p.photo_url), ''), nullif(btrim(u.raw_user_meta_data->>'avatar_url'), ''),
        nullif(btrim(u.raw_user_meta_data->>'picture'), '')) as photo_url,
      t.points, rank() over (partition by t.year order by t.points desc) as rank
    from totals t
    left join public.profiles p on p.id = t.user_id
    left join auth.users u on u.id = t.user_id
    join public.season_participation sp on sp.user_id = t.user_id
      and sp.season_year = t.year and sp.participating = true
  ), seasons as (
    select year from current_season union select year from totals
  )
  select jsonb_build_object(
    'myActivity', jsonb_build_object(
      'displayName', coalesce((select nullif(btrim(sp.display_name), '') from public.season_participation sp
        where sp.user_id = auth.uid() and sp.season_year = (select year from current_season)), ''),
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
    select coalesce(nullif(btrim(sp.display_name), ''), 'Anonymous User') as display_name,
      t.points, rank() over(order by t.points desc) as rank
    from totals t
    join public.season_participation sp on sp.user_id=t.user_id
      and sp.season_year=(select year from season) and sp.participating=true
  )
  select jsonb_build_object('currentSeason',(select year from season),
    'entries',coalesce((select jsonb_agg(jsonb_build_object(
      'displayName',r.display_name,'points',r.points,'rank',r.rank
    ) order by r.points desc,r.display_name) from ranked r where r.rank<=5),'[]'::jsonb));
$$;
revoke all on function public.get_public_season_preview() from public;
grant execute on function public.get_public_season_preview() to anon, authenticated;

commit;

-- Private identity snapshots belong to a season, not to public profile fields.
alter table public.season_participation
  add column if not exists full_name text,
  add column if not exists school_name text,
  add column if not exists details_confirmed_at timestamptz;

create or replace function public.get_my_season_award_details()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  season integer := public.season_year_for_date((now() at time zone 'America/New_York')::date);
  current_details public.season_participation%rowtype;
  prior_details public.season_participation%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into current_details from public.season_participation where user_id=auth.uid() and season_year=season;
  select * into prior_details from public.season_participation where user_id=auth.uid()
    and season_year<=season and full_name is not null and school_name is not null
    order by season_year desc limit 1;
  return jsonb_build_object('seasonYear', season,
    'fullName', coalesce(current_details.full_name,prior_details.full_name,''),
    'school', coalesce(current_details.school_name,prior_details.school_name,''),
    'confirmed', current_details.details_confirmed_at is not null);
end;
$$;

create or replace function public.join_season_award(
  full_name_input text, school_input text, expected_season integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  season integer := public.season_year_for_date((now() at time zone 'America/New_York')::date);
  student_name text := btrim(full_name_input);
  student_school text := btrim(school_input);
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if expected_season is distinct from season then raise exception 'The season has changed. Reload and confirm your details again.'; end if;
  if student_name is null or length(student_name) not between 1 and 120 then raise exception 'Enter your full name (up to 120 characters).'; end if;
  if student_school is null or length(student_school) not between 1 and 160 then raise exception 'Enter your school (up to 160 characters).'; end if;
  insert into public.season_participation(user_id,season_year,participating,full_name,school_name,details_confirmed_at)
  values(auth.uid(),season,true,student_name,student_school,now())
  on conflict(user_id,season_year) do update set participating=true,full_name=excluded.full_name,
    school_name=excluded.school_name,details_confirmed_at=now(),updated_at=now();
  update public.profiles set show_on_leaderboard=true where id=auth.uid();
end;
$$;

-- Joining must go through the explicit private-details confirmation form.
-- Leaving keeps that season's identity snapshot for the award record.
create or replace function public.set_season_participation(join_season boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare season integer := public.season_year_for_date((now() at time zone 'America/New_York')::date);
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if join_season is distinct from false then raise exception 'Join from the leaderboard and confirm your full name and school.'; end if;
  insert into public.season_participation(user_id,season_year,participating)
  values(auth.uid(),season,false) on conflict(user_id,season_year)
    do update set participating=false,updated_at=now();
  update public.profiles set show_on_leaderboard=false where id=auth.uid();
end;
$$;

create or replace function public.get_season_award_participants(target_season integer default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare season integer := coalesce(target_season,public.season_year_for_date((now() at time zone 'America/New_York')::date));
begin
  if not exists(select 1 from public.admins where user_id=auth.uid()) then raise exception 'Admin access required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('userId',sp.user_id,'displayName',p.display_name,
    'fullName',sp.full_name,'school',sp.school_name,'participating',sp.participating,
    'confirmedAt',sp.details_confirmed_at,'seasonYear',sp.season_year) order by sp.full_name nulls last,sp.user_id)
    from public.season_participation sp left join public.profiles p on p.id=sp.user_id
    where sp.season_year=season), '[]'::jsonb);
end;
$$;
revoke all on function public.get_my_season_award_details() from public,anon;
revoke all on function public.join_season_award(text,text,integer) from public,anon;
revoke all on function public.get_season_award_participants(integer) from public,anon;
grant execute on function public.get_my_season_award_details() to authenticated;
grant execute on function public.join_season_award(text,text,integer) to authenticated;
grant execute on function public.get_season_award_participants(integer) to authenticated;

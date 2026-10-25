-- Durable history is independent of the 30-day report archive.
create table if not exists public.answer_key_change_history (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  test_id text not null,
  question_number integer not null,
  previous_answer jsonb,
  new_answer jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  source_report_id text,
  action text not null check (action in ('change', 'revert', 'baseline')),
  reverts_change_id uuid references public.answer_key_change_history(id)
);
alter table public.answer_key_change_history enable row level security;
revoke all on public.answer_key_change_history from anon, authenticated;
create index if not exists answer_key_change_question_idx
  on public.answer_key_change_history(test_id, question_number, sequence desc);

-- Earlier versions did not record previous answers. Label these snapshots clearly:
-- they can be restored to the original catalog key, not to an unknown prior override.
insert into public.answer_key_change_history(test_id, question_number, new_answer, changed_by, changed_at, source_report_id, action)
select o.test_id, o.question_number, o.answer, o.updated_by, o.updated_at, o.last_source_report_id, 'baseline'
from public.answer_key_overrides o
where not exists (select 1 from public.answer_key_change_history h where h.test_id=o.test_id and h.question_number=o.question_number);

create or replace function public.audit_answer_key_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  prior jsonb;
  following jsonb;
  reverting uuid := nullif(current_setting('app.answer_key_revert_of', true), '')::uuid;
begin
  if tg_op = 'UPDATE' and old.answer = new.answer then return new; end if;
  if tg_op <> 'INSERT' then prior := old.answer; end if;
  if tg_op <> 'DELETE' then following := new.answer; end if;
  insert into public.answer_key_change_history(test_id, question_number, previous_answer, new_answer,
    changed_by, source_report_id, action, reverts_change_id)
  values (case when tg_op='DELETE' then old.test_id else new.test_id end,
    case when tg_op='DELETE' then old.question_number else new.question_number end,
    prior, following, auth.uid(),
    case when tg_op='DELETE' then old.last_source_report_id else new.last_source_report_id end,
    case when reverting is null then 'change' else 'revert' end, reverting);
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.audit_answer_key_change() from public, anon, authenticated;
drop trigger if exists audit_answer_key_change on public.answer_key_overrides;
create trigger audit_answer_key_change after insert or update or delete on public.answer_key_overrides
for each row execute function public.audit_answer_key_change();

create or replace function public.get_answer_key_change_history()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins where user_id=auth.uid()) then raise exception 'Admin access required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(changes) order by changes.sequence desc) from (
    select h.*, not exists (select 1 from public.answer_key_change_history newer
      where newer.test_id=h.test_id and newer.question_number=h.question_number and newer.sequence>h.sequence) as can_revert
    from public.answer_key_change_history h order by h.sequence desc limit 200
  ) changes), '[]'::jsonb);
end;
$$;

create or replace function public.revert_answer_key_change(change_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  change public.answer_key_change_history%rowtype;
  live_answer jsonb;
begin
  if not exists (select 1 from public.admins where user_id=auth.uid()) then raise exception 'Admin access required'; end if;
  -- Serialize this rare admin operation against all concurrent override writes.
  lock table public.answer_key_overrides in share row exclusive mode;
  select * into change from public.answer_key_change_history where id=change_id;
  if not found then raise exception 'Change not found'; end if;
  if exists (select 1 from public.answer_key_change_history h where h.test_id=change.test_id
    and h.question_number=change.question_number and h.sequence>change.sequence) then
    raise exception 'A newer change exists for this question. Refresh history before reverting.';
  end if;
  select answer into live_answer from public.answer_key_overrides
    where test_id=change.test_id and question_number=change.question_number;
  if live_answer is distinct from change.new_answer then raise exception 'The live answer has changed. Refresh history.'; end if;
  perform set_config('app.answer_key_revert_of', change.id::text, true);
  if change.previous_answer is null then
    delete from public.answer_key_overrides where test_id=change.test_id and question_number=change.question_number;
  else
    insert into public.answer_key_overrides(test_id,question_number,answer,updated_by,updated_at,last_source_report_id)
    values(change.test_id,change.question_number,change.previous_answer,auth.uid(),now(),null)
    on conflict(test_id,question_number) do update set answer=excluded.answer,updated_by=excluded.updated_by,
      updated_at=excluded.updated_at,last_source_report_id=null;
  end if;
  perform set_config('app.answer_key_revert_of', '', true);
end;
$$;
revoke all on function public.get_answer_key_change_history() from public, anon;
revoke all on function public.revert_answer_key_change(uuid) from public, anon;
grant execute on function public.get_answer_key_change_history() to authenticated;
grant execute on function public.revert_answer_key_change(uuid) to authenticated;

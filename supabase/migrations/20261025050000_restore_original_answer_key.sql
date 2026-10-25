-- Simple reset to the catalog answer, retaining the durable audit trigger.
create or replace function public.restore_original_answer_key(
  target_test_id text, target_question integer, expected_answer jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare live_answer jsonb;
begin
  if not exists (select 1 from public.admins where user_id=auth.uid()) then raise exception 'Admin access required'; end if;
  lock table public.answer_key_overrides in share row exclusive mode;
  select answer into live_answer from public.answer_key_overrides
    where test_id=target_test_id and question_number=target_question;
  if not found then raise exception 'This question already uses the original key. Refresh the archive.'; end if;
  if live_answer is distinct from expected_answer then
    raise exception 'A newer correction exists. Refresh the archive before restoring the original key.';
  end if;
  delete from public.answer_key_overrides
    where test_id=target_test_id and question_number=target_question;
end;
$$;
revoke all on function public.restore_original_answer_key(text,integer,jsonb) from public, anon;
grant execute on function public.restore_original_answer_key(text,integer,jsonb) to authenticated;

-- A exclusão só é aceita se a pessoa entrou (login com Google) nos últimos 15 minutos.
-- O banco confere isso pelo token, então nem uma chamada direta à API escapa da regra.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  last_login bigint;
begin
  if uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;

  select max((e ->> 'timestamp')::bigint)
    into last_login
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as e;

  if last_login is null or extract(epoch from now()) - last_login > 900 then
    raise exception 'Entre de novo para confirmar a exclusão' using errcode = '28000';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

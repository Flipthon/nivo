-- Exclusão definitiva da própria conta (exigência da Google Play e direito previsto na LGPD).
-- Apaga o usuário em auth.users; o "on delete cascade" remove perfil, categorias e
-- todos os dados futuros ligados a ele.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

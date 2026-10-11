-- A exclusão apaga só os dados de quem pediu (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@teste.local',   '{"full_name":"Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bruno@teste.local', '{"full_name":"Bruno"}');

set local role anon;
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'visitante sem login não exclui ninguém');

reset role;
set local role authenticated;
-- Login feito há 2 horas: exclusão recusada, pede novo login.
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000001', 'role', 'authenticated',
  'amr', json_build_array(json_build_object('method', 'oauth', 'timestamp', extract(epoch from now())::bigint - 7200)))::text, true);
select throws_ok($$ select public.delete_my_account() $$, '28000', null, 'login antigo não exclui a conta');

-- Login há 1 minuto: exclusão aceita.
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000001', 'role', 'authenticated',
  'amr', json_build_array(json_build_object('method', 'oauth', 'timestamp', extract(epoch from now())::bigint - 60)))::text, true);
select lives_ok($$ select public.delete_my_account() $$, 'Ana exclui a própria conta com login recente');

reset role;
select is((select count(*)::int from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'usuário da Ana apagado');
select is((select count(*)::int from public.categories where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'dados da Ana apagados em cascata');
select is((select count(*)::int from public.categories where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 14, 'dados do Bruno intactos');

select * from finish();
rollback;

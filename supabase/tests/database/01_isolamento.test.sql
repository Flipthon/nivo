-- Testes de isolamento entre usuários (pgTAP). Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Dois usuários fictícios, criados só dentro desta transação de teste.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@teste.local',   '{"full_name":"Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bruno@teste.local', '{"full_name":"Bruno"}');

-- Cadastro cria perfil e categorias padrão.
select is((select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
          'Ana', 'perfil criado com o nome do provedor');
select is((select timezone from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
          'America/Sao_Paulo', 'fuso inicial é America/Sao_Paulo');
select is((select count(*)::int from public.categories where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
          14, 'categorias padrão criadas');

-- A partir daqui, agimos como a Ana logada.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'Ana vê só o próprio perfil');
select is((select count(*)::int from public.categories where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
          0, 'Ana não vê categorias do Bruno');

select is_empty(
  $$ update public.profiles set display_name = 'Invadido' where id = 'bbbbbbbb-0000-0000-0000-000000000002' returning id $$,
  'Ana não consegue editar o perfil do Bruno');

select is_empty(
  $$ update public.categories set name = 'Invadida' where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' returning id $$,
  'Ana não consegue editar categorias do Bruno');

select throws_ok(
  $$ insert into public.categories (user_id, name, kind) values ('bbbbbbbb-0000-0000-0000-000000000002', 'Plantada', 'expense') $$,
  '42501', null, 'Ana não consegue criar categoria em nome do Bruno');

select lives_ok(
  $$ insert into public.categories (name, kind) values ('Farmácia', 'expense') $$,
  'Ana cria categoria própria sem informar dono');

select is((select user_id from public.categories where name = 'Farmácia'),
          'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'dono da categoria vem da sessão');

select throws_ok(
  $$ update public.profiles set timezone = 'Marte/Base_Alfa' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '22023', null, 'fuso inexistente é rejeitado');

select throws_ok(
  $$ delete from public.categories where name = 'Farmácia' $$,
  '42501', null, 'categorias não podem ser apagadas, só arquivadas');

-- Visitante sem login.
reset role;
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'visitante sem login não lê perfis');

select * from finish();
rollback;

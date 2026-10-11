-- Etapa 2: cartões e lançamentos isolados por usuário (pgTAP). Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@teste.local',   '{"full_name":"Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bruno@teste.local', '{"full_name":"Bruno"}');

insert into public.cards (id, user_id, name) values
  ('cccccccc-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', 'Cartão do Bruno');
insert into public.transactions (user_id, kind, amount_cents, description, occurred_on)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'expense', 1000, 'Lanche do Bruno', '2026-10-01');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok($$
  insert into public.transactions (kind, amount_cents, description, occurred_on, category_id)
  select 'expense', 3500, 'Almoço', '2026-10-10', id from public.categories where name = 'Alimentação'
$$, 'Ana lança um gasto');
select is((select count(*)::int from public.transactions), 1, 'Ana vê só os próprios lançamentos');
select is((select count(*)::int from public.cards), 0, 'Ana não vê cartões do Bruno');

select throws_ok($$
  insert into public.transactions (kind, amount_cents, description, occurred_on, card_id)
  values ('expense', 100, 'x', '2026-10-10', 'cccccccc-0000-0000-0000-00000000000b')
$$, '23503', null, 'Ana não usa cartão do Bruno');

select throws_ok($$
  insert into public.transactions (kind, amount_cents, description, occurred_on, category_id)
  select 'expense', 100, 'x', '2026-10-10', id from public.categories where name = 'Salário'
$$, '23514', null, 'categoria de receita não serve para gasto');

select throws_ok($$
  insert into public.transactions (user_id, kind, amount_cents, description, occurred_on)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'expense', 100, 'x', '2026-10-10')
$$, '42501', null, 'Ana não lança em nome do Bruno');

select throws_ok($$
  insert into public.transactions (kind, amount_cents, description, occurred_on)
  values ('expense', 0, 'x', '2026-10-10')
$$, '23514', null, 'valor zero é rejeitado');

select throws_ok($$
  insert into public.transactions (kind, amount_cents, description, occurred_on)
  values ('expense', 100000000000, 'x', '2026-10-10')
$$, '23514', null, 'valor fora do limite é rejeitado');

select lives_ok($$
  insert into public.cards (name) values ('Nubank');
  insert into public.transactions (kind, amount_cents, description, occurred_on, card_id,
    installment_number, installment_total, installment_group, request_id)
  select 'expense', 24000, 'TV', ('2026-10-10'::date + (n - 1) * interval '1 month')::date, c.id,
    n, 10, 'dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001'
  from generate_series(1, 10) n, public.cards c where c.name = 'Nubank'
$$, 'compra parcelada em 10x');

select throws_ok($$
  insert into public.transactions (kind, amount_cents, description, occurred_on, installment_number, installment_total,
    installment_group, request_id)
  values ('expense', 24000, 'TV', '2026-10-10', 1, 10, 'dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001')
$$, '23505', null, 'mesma mensagem não duplica');

select is((select expense_cents from public.period_summary('2026-10-01', '2026-10-31')), 27500::bigint,
  'resumo do mês soma só os lançamentos da Ana');

select is_empty($$ delete from public.transactions where description = 'Lanche do Bruno' returning id $$,
  'Ana não apaga lançamento do Bruno');
select is_empty($$ update public.transactions set amount_cents = 1 where description = 'Lanche do Bruno' returning id $$,
  'Ana não edita lançamento do Bruno');

reset role;
set local role anon;
select throws_ok($$ select * from public.transactions $$, '42501', null, 'visitante sem login não lê lançamentos');

select * from finish();
rollback;

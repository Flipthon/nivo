-- Nivo · Etapa 2: cartões e lançamentos (gastos, receitas, parcelas e pagamento de fatura).
-- Valores sempre em centavos inteiros (bigint). Dono de cada linha = auth.uid().

-- Permite chave estrangeira composta (id, user_id): um lançamento só aponta para
-- categoria ou cartão do MESMO usuário, garantido pelo banco.
alter table public.categories add constraint categories_id_user_uq unique (id, user_id);

-- ---------------------------------------------------------------------------
-- Cartões
-- ---------------------------------------------------------------------------
create table public.cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 30),
  kind         text not null default 'credit' check (kind in ('credit', 'meal', 'transport')),
  closing_day  smallint check (closing_day between 1 and 31),
  due_day      smallint check (due_day between 1 and 31),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint cards_id_user_uq unique (id, user_id)
);

create unique index cards_user_name_active_uq
  on public.cards (user_id, lower(btrim(name)))
  where archived_at is null;

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Lançamentos
-- ---------------------------------------------------------------------------
create table public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind                text not null check (kind in ('expense', 'income', 'card_payment')),
  amount_cents        bigint not null check (amount_cents > 0 and amount_cents <= 99999999999),
  description         text not null check (char_length(btrim(description)) between 1 and 80),
  category_id         uuid,
  card_id             uuid,
  occurred_on         date not null check (occurred_on between date '2000-01-01' and date '2100-12-31'),
  installment_number  smallint not null default 1,
  installment_total   smallint not null default 1,
  installment_group   uuid,
  source              text not null default 'chat' check (source in ('chat', 'manual', 'audio', 'photo')),
  -- Idempotência: a mesma mensagem enviada duas vezes não duplica lançamentos.
  request_id          uuid not null default gen_random_uuid(),
  item_index          smallint not null default 0 check (item_index between 0 and 19),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint transactions_category_fk foreign key (category_id, user_id)
    references public.categories (id, user_id),
  constraint transactions_card_fk foreign key (card_id, user_id)
    references public.cards (id, user_id),
  constraint transactions_installments_ck check (
    installment_total between 1 and 48
    and installment_number between 1 and installment_total
    and ((installment_total = 1) = (installment_group is null))
  ),
  constraint transactions_card_payment_ck check (
    kind <> 'card_payment' or (category_id is null and installment_total = 1)
  ),
  constraint transactions_income_ck check (kind <> 'income' or (card_id is null and installment_total = 1)),
  constraint transactions_request_uq unique (user_id, request_id, item_index, installment_number)
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc, created_at desc);
create index transactions_user_created_idx on public.transactions (user_id, created_at desc);
create index transactions_group_idx on public.transactions (installment_group) where installment_group is not null;
create index transactions_category_idx on public.transactions (category_id) where category_id is not null;
create index transactions_card_idx on public.transactions (card_id) where card_id is not null;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- A categoria precisa ser do mesmo tipo do lançamento (gasto ↔ categoria de gasto).
create or replace function public.validate_transaction_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cat_kind text;
begin
  if new.category_id is not null then
    select c.kind into cat_kind from public.categories c where c.id = new.category_id and c.user_id = new.user_id;
    if cat_kind is distinct from new.kind then
      raise exception 'Categoria incompatível com o lançamento' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger transactions_validate_category
  before insert or update of category_id, kind on public.transactions
  for each row execute function public.validate_transaction_category();

-- ---------------------------------------------------------------------------
-- Resumo do período (roda com as permissões de quem chama: RLS vale aqui também)
-- ---------------------------------------------------------------------------
create or replace function public.period_summary(p_from date, p_to date, p_category uuid default null)
returns table (income_cents bigint, expense_cents bigint, entries bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(t.amount_cents) filter (where t.kind = 'income'), 0)::bigint,
    coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0)::bigint,
    count(*) filter (where t.kind <> 'card_payment')::bigint
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.occurred_on between p_from and p_to
    and (p_category is null or t.category_id = p_category);
$$;

-- Gastos por categoria no período (para o painel do mês)
create or replace function public.period_by_category(p_from date, p_to date)
returns table (category_id uuid, category_name text, expense_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.category_id, coalesce(c.name, 'Sem categoria'), sum(t.amount_cents)::bigint
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.user_id = (select auth.uid())
    and t.kind = 'expense'
    and t.occurred_on between p_from and p_to
  group by t.category_id, c.name
  order by 3 desc;
$$;

-- ---------------------------------------------------------------------------
-- Permissões e Row Level Security
-- ---------------------------------------------------------------------------
alter table public.cards        enable row level security;
alter table public.transactions enable row level security;

revoke all on public.cards        from anon, authenticated;
revoke all on public.transactions from anon, authenticated;

grant select on public.cards to authenticated;
grant insert (name, kind, closing_day, due_day) on public.cards to authenticated;
grant update (name, kind, closing_day, due_day, archived_at) on public.cards to authenticated;

grant select, delete on public.transactions to authenticated;
grant insert (kind, amount_cents, description, category_id, card_id, occurred_on,
              installment_number, installment_total, installment_group, source, request_id, item_index)
  on public.transactions to authenticated;
grant update (amount_cents, description, category_id, card_id, occurred_on) on public.transactions to authenticated;

create policy "cartões: ler os próprios" on public.cards for select to authenticated
  using (user_id = (select auth.uid()));
create policy "cartões: criar para si" on public.cards for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "cartões: editar os próprios" on public.cards for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "lançamentos: ler os próprios" on public.transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "lançamentos: criar para si" on public.transactions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "lançamentos: editar os próprios" on public.transactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "lançamentos: apagar os próprios" on public.transactions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke execute on function public.validate_transaction_category() from public, anon, authenticated;
revoke execute on function public.period_summary(date, date, uuid) from public, anon;
revoke execute on function public.period_by_category(date, date) from public, anon;
grant execute on function public.period_summary(date, date, uuid) to authenticated;
grant execute on function public.period_by_category(date, date) to authenticated;

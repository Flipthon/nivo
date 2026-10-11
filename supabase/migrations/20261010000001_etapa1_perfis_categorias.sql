-- Nivo · Etapa 1: perfis, categorias e isolamento por usuário.
-- Regra central: o dono de cada linha é sempre auth.uid(), nunca um valor do cliente.

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Rejeita fusos inexistentes, para o servidor nunca calcular "hoje" com fuso inválido.
create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Fuso horário inválido: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  display_name             text check (display_name is null or char_length(display_name) between 1 and 60),
  email                    text,
  timezone                 text not null default 'America/Sao_Paulo',
  currency                 char(3) not null default 'BRL' check (currency = 'BRL'),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

-- ---------------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  kind         text not null check (kind in ('expense', 'income')),
  is_default   boolean not null default false,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Um usuário não pode ter duas categorias ativas com o mesmo nome e tipo.
create unique index categories_user_name_kind_active_uq
  on public.categories (user_id, kind, lower(btrim(name)))
  where archived_at is null;

create index categories_user_idx on public.categories (user_id);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Novo usuário: cria perfil e categorias padrão na mesma transação do cadastro.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 60), ''),
    new.email
  );

  insert into public.categories (user_id, name, kind, is_default)
  select new.id, c.name, c.kind, true
  from (values
    ('Alimentação', 'expense'),
    ('Energia elétrica', 'expense'),
    ('Água', 'expense'),
    ('Internet', 'expense'),
    ('Telefone', 'expense'),
    ('Material de Limpeza', 'expense'),
    ('Veículo', 'expense'),
    ('Educação', 'expense'),
    ('Assinaturas Digitais', 'expense'),
    ('Animais de Estimação', 'expense'),
    ('Viagens', 'expense'),
    ('Despesas Diversas', 'expense'),
    ('Salário', 'income'),
    ('Outras receitas', 'income')
  ) as c(name, kind);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Permissões e Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.categories enable row level security;

-- Visitantes sem login não acessam nada.
revoke all on public.profiles   from anon;
revoke all on public.categories from anon;

-- Perfil: o usuário lê e edita só o próprio. Criação e exclusão só pelo sistema.
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, timezone) on public.profiles to authenticated;

create policy "perfil: ler o próprio"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "perfil: editar o próprio"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Categorias: ler, criar e editar as próprias. Sem DELETE: categorias são arquivadas,
-- para não deixar lançamentos órfãos nas próximas etapas.
revoke all on public.categories from authenticated;
grant select on public.categories to authenticated;
grant insert (name, kind) on public.categories to authenticated;
grant update (name, archived_at) on public.categories to authenticated;

create policy "categorias: ler as próprias"
  on public.categories for select to authenticated
  using (user_id = (select auth.uid()));

create policy "categorias: criar para si"
  on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "categorias: editar as próprias"
  on public.categories for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Funções internas não devem ser chamadas pela API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.validate_profile_timezone() from public, anon, authenticated;

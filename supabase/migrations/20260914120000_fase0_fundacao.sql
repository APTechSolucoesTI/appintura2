-- ============================================================================
-- APPintura — Fase 0: fundação multi-tenant
--
-- Cria tenants, user_roles e as funções SECURITY DEFINER usadas por TODAS as
-- policies de RLS das fases seguintes.
--
-- NÃO APLICADA AINDA: o projeto Supabase será conectado depois. Revise antes de
-- rodar `supabase db push`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

create type public.app_role as enum (
  'admin',
  'gestor_producao',
  'operador_pintura',
  'qualidade',
  'financeiro',
  'portaria'
);

create type public.vinculo_status as enum ('ativo', 'pendente', 'inativo');

create type public.plano as enum ('trial', 'essencial', 'profissional', 'enterprise');

-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text not null,
  cnpj text not null,
  plano public.plano not null default 'trial',
  created_at timestamptz not null default now(),
  constraint tenants_cnpj_unico unique (cnpj),
  constraint tenants_cnpj_formato check (cnpj ~ '^[0-9]{14}$')
);

comment on table public.tenants is
  'Empresa contratante. Um CNPJ = um tenant; matriz e filial são tenants distintos.';

-- Fonte da verdade do vínculo usuário <-> empresa. Deliberadamente NÃO usamos
-- custom claims no JWT: claim exige hook de Auth configurado e fica defasada
-- quando o acesso é revogado.
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role public.app_role not null,
  status public.vinculo_status not null default 'pendente',
  created_at timestamptz not null default now(),
  -- Um usuário tem UM papel por empresa, mas pode ter várias empresas (multi-CNPJ).
  constraint user_roles_unico_por_tenant unique (user_id, tenant_id)
);

comment on table public.user_roles is
  'Vínculo usuário/empresa/papel. status=pendente representa convite não aceito.';

create index user_roles_user_id_idx on public.user_roles (user_id);
create index user_roles_tenant_id_idx on public.user_roles (tenant_id);

-- ----------------------------------------------------------------------------
-- Funções de autorização (SECURITY DEFINER)
--
-- `set search_path = ''` é obrigatório: sem isso, uma tabela criada por um
-- usuário em outro schema pode sequestrar a resolução de nomes dentro de uma
-- função SECURITY DEFINER (escalação de privilégio).
--
-- Por serem SECURITY DEFINER, estas funções ignoram RLS — é justamente o que
-- evita a recursão infinita ao usá-las dentro das policies de `user_roles`.
-- ----------------------------------------------------------------------------

-- Use esta em TODAS as policies dos módulos (Fases 1+): cobre usuário com acesso
-- a múltiplos CNPJs.
--   using (tenant_id in (select public.get_user_tenant_ids()))
create or replace function public.get_user_tenant_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select tenant_id
  from public.user_roles
  where user_id = (select auth.uid())
    and status = 'ativo'
$$;

-- Mantida pela compatibilidade com a especificação original.
-- ATENÇÃO: retorna APENAS UM tenant. Para usuário vinculado a mais de uma
-- empresa o resultado é arbitrário — não use em policy, use get_user_tenant_ids().
create or replace function public.get_user_tenant_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select tenant_id
  from public.user_roles
  where user_id = (select auth.uid())
    and status = 'ativo'
  order by created_at
  limit 1
$$;

-- Checagem por tela/ação. A variante com tenant_id é a recomendada; a de um
-- argumento existe para checagens genéricas ("é admin em alguma empresa?").
create or replace function public.has_role(role_name text, tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.tenant_id = has_role.tenant_id
      and ur.role::text = has_role.role_name
      and ur.status = 'ativo'
  )
$$;

create or replace function public.has_role(role_name text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text = has_role.role_name
      and ur.status = 'ativo'
  )
$$;

-- ----------------------------------------------------------------------------
-- RLS
--
-- Policies são separadas por comando (nunca `for all`) e INSERT/UPDATE sempre
-- levam `with check` — sem ele o usuário passa na leitura e grava linha para
-- outro tenant.
-- ----------------------------------------------------------------------------

alter table public.tenants enable row level security;
alter table public.user_roles enable row level security;

-- --- tenants ---

create policy "tenants_select_proprios"
  on public.tenants
  for select
  to authenticated
  using (id in (select public.get_user_tenant_ids()));

create policy "tenants_update_admin"
  on public.tenants
  for update
  to authenticated
  using (public.has_role('admin', id))
  with check (public.has_role('admin', id));

-- Sem policy de INSERT/DELETE: criação de empresa e encerramento de conta passam
-- por Edge Function com service_role (fluxo de signup/billing), nunca pelo client.

-- --- user_roles ---

create policy "user_roles_select_mesmo_tenant"
  on public.user_roles
  for select
  to authenticated
  using (tenant_id in (select public.get_user_tenant_ids()));

create policy "user_roles_insert_admin"
  on public.user_roles
  for insert
  to authenticated
  with check (public.has_role('admin', tenant_id));

create policy "user_roles_update_admin"
  on public.user_roles
  for update
  to authenticated
  using (public.has_role('admin', tenant_id))
  with check (public.has_role('admin', tenant_id));

-- Admin não pode remover o próprio vínculo: evita empresa sem nenhum admin.
create policy "user_roles_delete_admin"
  on public.user_roles
  for delete
  to authenticated
  using (
    public.has_role('admin', tenant_id)
    and user_id <> (select auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------

grant execute on function public.get_user_tenant_ids() to authenticated;
grant execute on function public.get_user_tenant_id() to authenticated;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.has_role(text, uuid) to authenticated;

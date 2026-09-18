-- ============================================================================
-- APPintura — Fase 0: fundação multi-tenant
--
-- Cria usuarios, tenants, user_roles e as funções SECURITY DEFINER usadas por
-- TODAS as policies de RLS das fases seguintes.
--
-- Este banco Supabase é COMPARTILHADO com outros sistemas (aperp, apfiscal,
-- apticket). Por isso o APPintura vive inteiro no schema `appintura2` e nada é
-- criado em `public`.
--
-- IDENTIDADE PRÓPRIA — o APPintura NÃO usa `auth.users` / Supabase Auth.
-- Aquele `auth.users` é um pool único para todos os produtos deste servidor:
-- quem se cadastra no aperp vira identidade válida aqui. A tabela
-- `appintura2.usuarios` abaixo fecha esse pool dentro do nosso schema.
--
-- O que isso muda na prática: `auth.uid()` deixa de existir para nós e é
-- substituída por `appintura2.usuario_atual()`, que lê o `sub` do JWT. O token
-- continua sendo um JWT HS256 assinado com o mesmo segredo do Supabase (é o que
-- o PostgREST valida), só que emitido pela Edge Function `sessao-login` em vez
-- do GoTrue. Nada além do emissor muda: RLS, PostgREST e supabase-js seguem
-- funcionando igual.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Schema dedicado
--
-- `anon`/`authenticated` recebem só USAGE: sem CREATE o client nunca cria
-- objeto aqui. Os privilégios de tabela vêm das default privileges abaixo, que
-- valem para tudo que as Fases 1..7 criarem depois — em `public` o Supabase já
-- as configura, num schema novo não existe nenhuma.
--
-- As default privileges são por role criador: todas as migrations precisam
-- rodar como `postgres`, dono do schema.
-- ----------------------------------------------------------------------------

create schema if not exists appintura2;

grant usage on schema appintura2 to anon, authenticated, service_role;

-- Registro das migrations do APPintura.
--
-- Fica ANTES das default privileges de propósito: é tabela de controle e não
-- deve aparecer na API. `supabase_migrations.schema_migrations`, que o CLI usa,
-- neste servidor já é de outro produto — gravar lá faria o `db push` dele
-- tropeçar em versões que não são dele.
create table if not exists appintura2.schema_migrations (
  version    text primary key,
  name       text,
  applied_at timestamptz not null default now()
);

revoke all on appintura2.schema_migrations from anon, authenticated;
grant all on appintura2.schema_migrations to service_role;

alter default privileges in schema appintura2
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema appintura2
  grant all on tables to service_role;
alter default privileges in schema appintura2
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema appintura2
  grant execute on functions to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

do $tipo$ begin
  create type appintura2.app_role as enum (
  'admin',
  'gestor_producao',
  'operador_pintura',
  'qualidade',
  'financeiro',
  'portaria'
  );
exception when duplicate_object then null;
end $tipo$;

do $tipo$ begin
  create type appintura2.vinculo_status as enum ('ativo', 'pendente', 'inativo');

create type appintura2.plano as enum ('trial', 'essencial', 'profissional', 'enterprise');

-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------

-- Identidade do APPintura. Substitui `auth.users`.
--
-- `senha_hash` é bcrypt (pgcrypto). A coluna NUNCA sai pela API: os grants no
-- fim deste arquivo são por COLUNA justamente para deixá-la de fora — RLS
-- filtra linhas, não colunas, então só o GRANT resolve isso.
create table if not exists appintura2.usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  senha_hash text not null,
  nome text not null,
  telefone text,
  ativo boolean not null default true,
  ultimo_login_em timestamptz,
  senha_alterada_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint usuarios_email_formato check (email ~ '^[^[:space:]@]+@[^[:space:]@]+.[^[:space:]@]+$'),
  constraint usuarios_nome_preenchido check (length(btrim(nome)) > 0)
  );
exception when duplicate_object then null;
end $tipo$;

-- Unicidade sobre lower(email): 'Marina@x' e 'marina@x' são a mesma pessoa, e é
-- assim que `autenticar()` procura.
create unique index if not exists usuarios_email_unico on appintura2.usuarios (lower(email));

comment on table appintura2.usuarios is
  'Identidade do APPintura. Separada de auth.users, que neste servidor é compartilhado com os outros produtos.';
comment on column appintura2.usuarios.senha_hash is
  'bcrypt via extensions.crypt. Sem grant de SELECT para anon/authenticated.';

create table if not exists appintura2.tenants (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text not null,
  cnpj text not null,
  plano appintura2.plano not null default 'trial',
  created_at timestamptz not null default now(),
  constraint tenants_cnpj_unico unique (cnpj),
  constraint tenants_cnpj_formato check (cnpj ~ '^[0-9]{14}$')
);

comment on table appintura2.tenants is
  'Empresa contratante. Um CNPJ = um tenant; matriz e filial são tenants distintos.';

-- Fonte da verdade do vínculo usuário <-> empresa. Deliberadamente NÃO usamos
-- custom claims no JWT: claim exige hook de Auth configurado e fica defasada
-- quando o acesso é revogado.
create table if not exists appintura2.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references appintura2.usuarios (id) on delete cascade,
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  role appintura2.app_role not null,
  status appintura2.vinculo_status not null default 'pendente',
  created_at timestamptz not null default now(),
  -- Um usuário tem UM papel por empresa, mas pode ter várias empresas (multi-CNPJ).
  constraint user_roles_unico_por_tenant unique (user_id, tenant_id)
);

comment on table appintura2.user_roles is
  'Vínculo usuário/empresa/papel. status=pendente representa convite não aceito.';

create index if not exists user_roles_user_id_idx on appintura2.user_roles (user_id);
create index if not exists user_roles_tenant_id_idx on appintura2.user_roles (tenant_id);

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

-- Quem está chamando. É a peça que substitui `auth.uid()`.
--
-- `request.jwt.claims` é preenchido pelo PostgREST a partir do JWT JÁ validado
-- (assinatura e `exp`) — quando a assinatura não bate, a requisição nem chega
-- aqui. Não é SECURITY DEFINER: não lê tabela nenhuma.
--
-- Com `true` no segundo argumento, contexto sem JWT devolve NULL em vez de
-- erro; e NULL nas policies não casa com nada, que é o comportamento correto.
create or replace function appintura2.usuario_atual()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  )::uuid
$$;

comment on function appintura2.usuario_atual() is
  'ID do usuário logado, lido do claim sub do JWT. Substitui auth.uid().';

-- Use esta em TODAS as policies dos módulos (Fases 1+): cobre usuário com acesso
-- a múltiplos CNPJs.
--   using (tenant_id in (select appintura2.get_user_tenant_ids()))
create or replace function appintura2.get_user_tenant_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select tenant_id
  from appintura2.user_roles
  where user_id = (select appintura2.usuario_atual())
    and status = 'ativo'
$$;

-- Mantida pela compatibilidade com a especificação original.
-- ATENÇÃO: retorna APENAS UM tenant. Para usuário vinculado a mais de uma
-- empresa o resultado é arbitrário — não use em policy, use get_user_tenant_ids().
create or replace function appintura2.get_user_tenant_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select tenant_id
  from appintura2.user_roles
  where user_id = (select appintura2.usuario_atual())
    and status = 'ativo'
  order by created_at
  limit 1
$$;

-- Checagem por tela/ação. A variante com tenant_id é a recomendada; a de um
-- argumento existe para checagens genéricas ("é admin em alguma empresa?").
create or replace function appintura2.has_role(role_name text, tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from appintura2.user_roles ur
    where ur.user_id = (select appintura2.usuario_atual())
      and ur.tenant_id = has_role.tenant_id
      and ur.role::text = has_role.role_name
      and ur.status = 'ativo'
  )
$$;

create or replace function appintura2.has_role(role_name text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from appintura2.user_roles ur
    where ur.user_id = (select appintura2.usuario_atual())
      and ur.role::text = has_role.role_name
      and ur.status = 'ativo'
  )
$$;

-- ----------------------------------------------------------------------------
-- Credenciais
--
-- Estas três funções são o que sobrou do GoTrue. Todas SECURITY DEFINER, e as
-- duas primeiras REVOGADAS de anon/authenticated logo abaixo: só a Edge
-- Function `sessao-login` (service_role) as chama. Se `autenticar` ficasse
-- aberta na API, a rota viraria um oráculo de força bruta de senha com o
-- PostgREST fazendo o trabalho.
--
-- bcrypt custo 10: ~50 ms por tentativa — caro o bastante para ataque offline,
-- barato o bastante para o login.
-- ----------------------------------------------------------------------------

create or replace function appintura2.criar_usuario(
  p_email    text,
  p_senha    text,
  p_nome     text,
  p_telefone text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if length(p_senha) < 8 then
    raise exception 'A senha precisa ter ao menos 8 caracteres.'
      using errcode = '22023';
  end if;

  insert into appintura2.usuarios (email, senha_hash, nome, telefone)
  values (
    lower(btrim(p_email)),
    extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
    btrim(p_nome),
    nullif(btrim(p_telefone), '')
  )
  returning id into v_id;

  return v_id;
end
$$;

-- Devolve ZERO linhas para qualquer falha — e-mail inexistente, senha errada ou
-- usuário inativo. Distinguir os casos na resposta entregaria de graça a lista
-- de e-mails válidos.
create or replace function appintura2.autenticar(p_email text, p_senha text)
returns table (usuario_id uuid, nome text, email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_usuario appintura2.usuarios%rowtype;
  -- Hash descartável. Sem ele, "e-mail não existe" responde na hora e "senha
  -- errada" demora os ~50 ms do bcrypt — essa diferença de tempo denuncia
  -- quais e-mails estão cadastrados.
  c_hash_falso constant text := '$2a$10$C6UzMDM.H6dfI/f/IKcEe.gOVsVfLJHxBhxLNZWGRgxjdSHPU6y7W';
begin
  select * into v_usuario
  from appintura2.usuarios u
  where lower(u.email) = lower(btrim(p_email));

  if not found then
    perform extensions.crypt(p_senha, c_hash_falso);
    return;
  end if;

  if not v_usuario.ativo then
    return;
  end if;

  if extensions.crypt(p_senha, v_usuario.senha_hash) <> v_usuario.senha_hash then
    return;
  end if;

  update appintura2.usuarios
     set ultimo_login_em = now()
   where id = v_usuario.id;

  usuario_id := v_usuario.id;
  nome       := v_usuario.nome;
  email      := v_usuario.email;
  return next;
end
$$;

-- Esta SIM é chamada pelo usuário logado, direto do app. Exige a senha atual:
-- sessão sequestrada não deve conseguir trocar a senha e expulsar o dono.
create or replace function appintura2.alterar_senha(
  p_senha_atual text,
  p_senha_nova  text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_usuario appintura2.usuarios%rowtype;
begin
  select * into v_usuario
  from appintura2.usuarios u
  where u.id = appintura2.usuario_atual();

  if not found then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if extensions.crypt(p_senha_atual, v_usuario.senha_hash) <> v_usuario.senha_hash then
    return false;
  end if;

  if length(p_senha_nova) < 8 then
    raise exception 'A senha precisa ter ao menos 8 caracteres.'
      using errcode = '22023';
  end if;

  update appintura2.usuarios
     set senha_hash = extensions.crypt(p_senha_nova, extensions.gen_salt('bf', 10)),
         senha_alterada_em = now()
   where id = v_usuario.id;

  return true;
end
$$;

revoke all on function appintura2.criar_usuario(text, text, text, text)
  from public, anon, authenticated;
revoke all on function appintura2.autenticar(text, text)
  from public, anon, authenticated;
grant execute on function appintura2.criar_usuario(text, text, text, text) to service_role;
grant execute on function appintura2.autenticar(text, text) to service_role;

revoke all on function appintura2.alterar_senha(text, text) from public, anon;
grant execute on function appintura2.alterar_senha(text, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- RLS
--
-- Policies são separadas por comando (nunca `for all`) e INSERT/UPDATE sempre
-- levam `with check` — sem ele o usuário passa na leitura e grava linha para
-- outro tenant.
-- ----------------------------------------------------------------------------

alter table appintura2.usuarios enable row level security;
alter table appintura2.tenants enable row level security;
alter table appintura2.user_roles enable row level security;

-- --- usuarios ---

-- Enxergo a mim mesmo e a quem divide alguma empresa comigo (para montar
-- "responsável", "conferente", lista da equipe). Ninguém enxerga o diretório
-- inteiro de usuários do produto.
--
-- `usuarios.id` qualificado de propósito: `ur` também tem uma coluna `id`, e
-- um `id` solto aqui dentro resolveria para a do subselect.
drop policy if exists "usuarios_select_mesma_empresa" on appintura2.usuarios;
create policy "usuarios_select_mesma_empresa"
  on appintura2.usuarios
  for select
  to authenticated
  using (
    usuarios.id = (select appintura2.usuario_atual())
    or exists (
      select 1
      from appintura2.user_roles ur
      where ur.user_id = usuarios.id
        and ur.tenant_id in (select appintura2.get_user_tenant_ids())
    )
  );

-- Só o próprio perfil. Quais COLUNAS podem mudar é decidido pelo GRANT no fim
-- do arquivo (nome e telefone), não por aqui.
drop policy if exists "usuarios_update_proprio" on appintura2.usuarios;
create policy "usuarios_update_proprio"
  on appintura2.usuarios
  for update
  to authenticated
  using (usuarios.id = (select appintura2.usuario_atual()))
  with check (usuarios.id = (select appintura2.usuario_atual()));

-- Sem policy de INSERT/DELETE: criar e desativar usuário passa por
-- `criar_usuario()` / service_role, nunca pelo client.

-- --- tenants ---

drop policy if exists "tenants_select_proprios" on appintura2.tenants;
create policy "tenants_select_proprios"
  on appintura2.tenants
  for select
  to authenticated
  using (id in (select appintura2.get_user_tenant_ids()));

drop policy if exists "tenants_update_admin" on appintura2.tenants;
create policy "tenants_update_admin"
  on appintura2.tenants
  for update
  to authenticated
  using (appintura2.has_role('admin', id))
  with check (appintura2.has_role('admin', id));

-- Sem policy de INSERT/DELETE: criação de empresa e encerramento de conta passam
-- por Edge Function com service_role (fluxo de signup/billing), nunca pelo client.

-- --- user_roles ---

drop policy if exists "user_roles_select_mesmo_tenant" on appintura2.user_roles;
create policy "user_roles_select_mesmo_tenant"
  on appintura2.user_roles
  for select
  to authenticated
  using (tenant_id in (select appintura2.get_user_tenant_ids()));

drop policy if exists "user_roles_insert_admin" on appintura2.user_roles;
create policy "user_roles_insert_admin"
  on appintura2.user_roles
  for insert
  to authenticated
  with check (appintura2.has_role('admin', tenant_id));

drop policy if exists "user_roles_update_admin" on appintura2.user_roles;
create policy "user_roles_update_admin"
  on appintura2.user_roles
  for update
  to authenticated
  using (appintura2.has_role('admin', tenant_id))
  with check (appintura2.has_role('admin', tenant_id));

-- Admin não pode remover o próprio vínculo: evita empresa sem nenhum admin.
drop policy if exists "user_roles_delete_admin" on appintura2.user_roles;
create policy "user_roles_delete_admin"
  on appintura2.user_roles
  for delete
  to authenticated
  using (
    appintura2.has_role('admin', tenant_id)
    and user_id <> (select appintura2.usuario_atual())
  );

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------

grant execute on function appintura2.usuario_atual() to authenticated;
grant execute on function appintura2.get_user_tenant_ids() to authenticated;
grant execute on function appintura2.get_user_tenant_id() to authenticated;
grant execute on function appintura2.has_role(text) to authenticated;
grant execute on function appintura2.has_role(text, uuid) to authenticated;

-- Grants POR COLUNA em usuarios.
--
-- As default privileges lá de cima deram select em TUDO, `senha_hash`
-- inclusive. RLS não resolve isto: ela decide quais LINHAS aparecem, não quais
-- colunas. Então revogamos e devolvemos coluna a coluna — `senha_hash` e
-- `senha_alterada_em` ficam de fora e nunca saem pela API.
revoke all on appintura2.usuarios from anon, authenticated;

grant select (id, email, nome, telefone, ativo, ultimo_login_em, created_at)
  on appintura2.usuarios to authenticated;
grant update (nome, telefone) on appintura2.usuarios to authenticated;
grant all on appintura2.usuarios to service_role;

insert into appintura2.schema_migrations (version, name)
values ('20260914120000', 'fase0_fundacao')
on conflict (version) do nothing;

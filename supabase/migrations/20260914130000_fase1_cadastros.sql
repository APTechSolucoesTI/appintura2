-- ============================================================================
-- APPintura — Fase 1: Cadastros
--
-- clientes, tabelas_preco, tabela_preco_itens, cores, insumos_quimicos e
-- transportadoras, todas isoladas por tenant via RLS.
--
-- Objetos no schema `appintura2`. Depende da migration da Fase 0.
-- Depende de 20260914120000_fase0_fundacao.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

do $tipo$ begin
  create type appintura2.unidade_cobranca as enum ('m2', 'peca');

create type appintura2.tipo_tinta as enum ('poliester', 'epoxi', 'hibrida');

create type appintura2.textura_tinta as enum ('lisa', 'texturizada', 'martelada');

create type appintura2.brilho_tinta as enum ('fosco', 'semibrilho', 'brilhante');

create type appintura2.tipo_insumo as enum (
  'desengraxante',
  'decapante',
  'fosfatizante',
  'passivador'
  );
exception when duplicate_object then null;
end $tipo$;

do $tipo$ begin
  create type appintura2.unidade_medida as enum ('kg', 'L');

-- ----------------------------------------------------------------------------
-- Autorização de escrita
--
-- Cadastro é gestão: portaria, operador de pintura, qualidade e financeiro leem,
-- mas não alteram. Espelha `ACESSO_POR_MODULO.cadastros` do frontend — com a
-- diferença de que ESTA é a checagem que vale.
-- ----------------------------------------------------------------------------

create or replace function appintura2.pode_gerenciar_cadastros(tenant_id uuid)
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
      and ur.tenant_id = pode_gerenciar_cadastros.tenant_id
      and ur.role in ('admin', 'gestor_producao')
      and ur.status = 'ativo'
  )
$$;

grant execute on function appintura2.pode_gerenciar_cadastros(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Tabelas de preço
-- ----------------------------------------------------------------------------

create table if not exists appintura2.tabelas_preco (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  nome text not null,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  constraint tabelas_preco_nome_unico_por_tenant unique (tenant_id, nome)
  );
exception when duplicate_object then null;
end $tipo$;

create index if not exists tabelas_preco_tenant_idx on appintura2.tabelas_preco (tenant_id);

create table if not exists appintura2.tabela_preco_itens (
  id uuid primary key default gen_random_uuid(),
  tabela_preco_id uuid not null
    references appintura2.tabelas_preco (id) on delete cascade,
  tipo_acabamento text not null,
  unidade appintura2.unidade_cobranca not null,
  valor numeric(12, 2) not null,
  constraint tabela_preco_itens_valor_positivo check (valor > 0),
  constraint tabela_preco_itens_unico unique (tabela_preco_id, tipo_acabamento, unidade)
);

create index if not exists tabela_preco_itens_tabela_idx
  on appintura2.tabela_preco_itens (tabela_preco_id);

comment on table appintura2.tabela_preco_itens is
  'Filho de tabelas_preco. Não tem tenant_id: o isolamento vem da tabela pai.';

-- ----------------------------------------------------------------------------
-- Clientes
-- ----------------------------------------------------------------------------

create table if not exists appintura2.clientes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  razao_social text not null,
  cnpj_cpf text not null,
  contato_nome text not null default '',
  contato_telefone text not null default '',
  contato_email text not null default '',
  cep text not null default '',
  logradouro text not null default '',
  numero text not null default '',
  complemento text not null default '',
  bairro text not null default '',
  cidade text not null default '',
  uf char(2) not null,
  -- restrict: apagar tabela de preço em uso quebraria o faturamento do cliente.
  tabela_preco_id uuid references appintura2.tabelas_preco (id) on delete restrict,
  limite_credito numeric(12, 2) not null default 0,
  -- TODO(Fase 5): derivar de contas_receber vencidas em vez de guardar o número.
  -- Mantido como coluna para a Fase 1 ter o que exibir; vira view quando o
  -- financeiro entrar.
  dias_inadimplencia_atual integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint clientes_documento_formato check (cnpj_cpf ~ '^([0-9]{11}|[0-9]{14})$'),
  constraint clientes_documento_unico_por_tenant unique (tenant_id, cnpj_cpf),
  constraint clientes_limite_nao_negativo check (limite_credito >= 0),
  constraint clientes_inadimplencia_nao_negativa check (dias_inadimplencia_atual >= 0)
);

create index if not exists clientes_tenant_idx on appintura2.clientes (tenant_id);
create index if not exists clientes_tabela_preco_idx on appintura2.clientes (tabela_preco_id);
-- Busca por razão social na listagem.
create index if not exists clientes_razao_social_idx on appintura2.clientes (tenant_id, razao_social);

-- ----------------------------------------------------------------------------
-- Cores e tintas
-- ----------------------------------------------------------------------------

create table if not exists appintura2.cores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  codigo_ral text not null,
  nome_comercial text not null,
  fabricante text not null,
  tipo appintura2.tipo_tinta not null,
  textura appintura2.textura_tinta not null,
  brilho appintura2.brilho_tinta not null,
  rendimento_teorico_g_m2 numeric(8, 2) not null,
  custo_kg numeric(12, 2) not null,
  estoque_atual numeric(12, 3) not null default 0,
  estoque_minimo numeric(12, 3) not null default 0,
  lote text not null,
  validade date not null,
  created_at timestamptz not null default now(),
  -- O mesmo RAL pode existir em vários lotes; o par RAL+lote é que é único.
  constraint cores_ral_lote_unico unique (tenant_id, codigo_ral, lote),
  constraint cores_rendimento_positivo check (rendimento_teorico_g_m2 > 0),
  constraint cores_custo_nao_negativo check (custo_kg >= 0),
  constraint cores_estoque_nao_negativo
    check (estoque_atual >= 0 and estoque_minimo >= 0)
);

create index if not exists cores_tenant_idx on appintura2.cores (tenant_id);
-- Alimenta o painel de alertas: cores abaixo do mínimo ou vencendo.
create index if not exists cores_alerta_idx on appintura2.cores (tenant_id, validade);

comment on column appintura2.cores.rendimento_teorico_g_m2 is
  'Gramas de pó por m² segundo a ficha técnica. Base do consumo estimado da OS.';

-- ----------------------------------------------------------------------------
-- Insumos químicos
-- ----------------------------------------------------------------------------

create table if not exists appintura2.insumos_quimicos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  nome text not null,
  tipo appintura2.tipo_insumo not null,
  estoque_atual numeric(12, 3) not null default 0,
  estoque_minimo numeric(12, 3) not null default 0,
  unidade_medida appintura2.unidade_medida not null default 'L',
  validade date not null,
  fornecedor text not null default '',
  created_at timestamptz not null default now(),
  constraint insumos_nome_unico_por_tenant unique (tenant_id, nome),
  constraint insumos_estoque_nao_negativo
    check (estoque_atual >= 0 and estoque_minimo >= 0)
);

create index if not exists insumos_tenant_idx on appintura2.insumos_quimicos (tenant_id);
create index if not exists insumos_alerta_idx on appintura2.insumos_quimicos (tenant_id, validade);

-- ----------------------------------------------------------------------------
-- Transportadoras
-- ----------------------------------------------------------------------------

create table if not exists appintura2.transportadoras (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  nome text not null,
  cnpj text not null,
  contato_nome text not null default '',
  contato_telefone text not null default '',
  contato_email text not null default '',
  created_at timestamptz not null default now(),
  constraint transportadoras_cnpj_formato check (cnpj ~ '^[0-9]{14}$'),
  constraint transportadoras_cnpj_unico_por_tenant unique (tenant_id, cnpj)
);

create index if not exists transportadoras_tenant_idx on appintura2.transportadoras (tenant_id);

-- ----------------------------------------------------------------------------
-- RLS
--
-- Uma policy por comando, com `with check` em INSERT/UPDATE. Leitura liberada a
-- qualquer papel do tenant; escrita restrita a admin e gestor de produção.
-- ----------------------------------------------------------------------------

alter table appintura2.tabelas_preco enable row level security;
alter table appintura2.tabela_preco_itens enable row level security;
alter table appintura2.clientes enable row level security;
alter table appintura2.cores enable row level security;
alter table appintura2.insumos_quimicos enable row level security;
alter table appintura2.transportadoras enable row level security;

do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'tabelas_preco',
    'clientes',
    'cores',
    'insumos_quimicos',
    'transportadoras'
  ]
  loop
    execute format($f$
      drop policy if exists %1$I on appintura2.%2$I;
      create policy %1$I on appintura2.%2$I
        for select to authenticated
        using (tenant_id in (select appintura2.get_user_tenant_ids()));
    $f$, tabela || '_select', tabela);

    execute format($f$
      drop policy if exists %1$I on appintura2.%2$I;
      create policy %1$I on appintura2.%2$I
        for insert to authenticated
        with check (appintura2.pode_gerenciar_cadastros(tenant_id));
    $f$, tabela || '_insert', tabela);

    execute format($f$
      drop policy if exists %1$I on appintura2.%2$I;
      create policy %1$I on appintura2.%2$I
        for update to authenticated
        using (appintura2.pode_gerenciar_cadastros(tenant_id))
        with check (appintura2.pode_gerenciar_cadastros(tenant_id));
    $f$, tabela || '_update', tabela);

    execute format($f$
      drop policy if exists %1$I on appintura2.%2$I;
      create policy %1$I on appintura2.%2$I
        for delete to authenticated
        using (appintura2.pode_gerenciar_cadastros(tenant_id));
    $f$, tabela || '_delete', tabela);
  end loop;
end
$$;

-- tabela_preco_itens não tem tenant_id: a autorização passa pela tabela pai.

drop policy if exists "tabela_preco_itens_select" on appintura2.tabela_preco_itens;
create policy "tabela_preco_itens_select"
  on appintura2.tabela_preco_itens
  for select
  to authenticated
  using (
    exists (
      select 1
      from appintura2.tabelas_preco tp
      where tp.id = tabela_preco_itens.tabela_preco_id
        and tp.tenant_id in (select appintura2.get_user_tenant_ids())
    )
  );

drop policy if exists "tabela_preco_itens_insert" on appintura2.tabela_preco_itens;
create policy "tabela_preco_itens_insert"
  on appintura2.tabela_preco_itens
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from appintura2.tabelas_preco tp
      where tp.id = tabela_preco_itens.tabela_preco_id
        and appintura2.pode_gerenciar_cadastros(tp.tenant_id)
    )
  );

drop policy if exists "tabela_preco_itens_update" on appintura2.tabela_preco_itens;
create policy "tabela_preco_itens_update"
  on appintura2.tabela_preco_itens
  for update
  to authenticated
  using (
    exists (
      select 1
      from appintura2.tabelas_preco tp
      where tp.id = tabela_preco_itens.tabela_preco_id
        and appintura2.pode_gerenciar_cadastros(tp.tenant_id)
    )
  )
  with check (
    exists (
      select 1
      from appintura2.tabelas_preco tp
      where tp.id = tabela_preco_itens.tabela_preco_id
        and appintura2.pode_gerenciar_cadastros(tp.tenant_id)
    )
  );

drop policy if exists "tabela_preco_itens_delete" on appintura2.tabela_preco_itens;
create policy "tabela_preco_itens_delete"
  on appintura2.tabela_preco_itens
  for delete
  to authenticated
  using (
    exists (
      select 1
      from appintura2.tabelas_preco tp
      where tp.id = tabela_preco_itens.tabela_preco_id
        and appintura2.pode_gerenciar_cadastros(tp.tenant_id)
    )
  );

insert into appintura2.schema_migrations (version, name)
values ('20260914130000', 'fase1_cadastros')
on conflict (version) do nothing;

-- ============================================================================
-- APPintura — Fase 5: Financeiro
--
-- Objetos no schema `appintura2`. Depende das migrations das Fases 0 a 4.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Parâmetros financeiros por empresa
-- ----------------------------------------------------------------------------

alter table appintura2.configuracoes_tenant
  add column if not exists multa_percentual numeric(6, 3) not null default 2,
  add column if not exists juros_mes_percentual numeric(6, 3) not null default 1,
  add column if not exists custo_energia_gas_m2 numeric(12, 4) not null default 0,
  add column if not exists custo_mao_obra_m2 numeric(12, 4) not null default 0,
  add column if not exists custo_insumos_quimicos_m2 numeric(12, 4) not null default 0,
  add column if not exists custo_depreciacao_m2 numeric(12, 4) not null default 0,
  add column if not exists despesa_fixa_mensal numeric(14, 2) not null default 0;

-- A constraint sai do `alter table` combinado acima e ganha bloco próprio:
-- `add constraint` não aceita `if not exists`, e reexecutar a migration
-- quebrava aqui mesmo com todas as colunas já guardadas por `if not exists`.
do $cs$ begin
  alter table appintura2.configuracoes_tenant
    add constraint configuracoes_encargos_nao_negativos
      check (multa_percentual >= 0 and juros_mes_percentual >= 0);
exception when duplicate_object then null;
end $cs$;

comment on column appintura2.configuracoes_tenant.custo_energia_gas_m2 is
  'Rateio estimado. Não sai de nota fiscal por OS — é o dono da fábrica que informa.';

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

/*
 * `pago`, `parcialmente_pago` e `vencido` NÃO entram no enum armazenado: são
 * derivados dos pagamentos e da data corrente. Persistir um status que depende
 * do relógio é o que faz o título aparecer "em aberto" três meses depois de
 * vencer.
 */
do $tipo$ begin
  create type appintura2.status_conta_base as enum ('em_aberto', 'negociado', 'cancelado');

create type appintura2.forma_pagamento as enum (
  'pix', 'boleto', 'transferencia', 'dinheiro', 'cartao'
  );
exception when duplicate_object then null;
end $tipo$;

do $tipo$ begin
  create type appintura2.forma_faturamento as enum (
  'os_avulsa', 'quinzenal', 'mensal', 'contrato'
  );
exception when duplicate_object then null;
end $tipo$;

do $tipo$ begin
  create type appintura2.categoria_pagar as enum ('fixa', 'variavel', 'insumo_direto');

create type appintura2.tipo_centro_custo as enum ('producao', 'comercial', 'administrativo');

create type appintura2.canal_cobranca as enum ('telefone', 'whatsapp', 'email', 'presencial');

create type appintura2.resultado_cobranca as enum (
  'promessa_pagamento', 'sem_retorno', 'contestado', 'negociado', 'pago'
  );
exception when duplicate_object then null;
end $tipo$;

-- Forma de faturamento é acordo comercial do cliente, então mora no cadastro.
alter table appintura2.clientes
  add column if not exists forma_faturamento appintura2.forma_faturamento not null default 'os_avulsa';

-- ----------------------------------------------------------------------------
-- Centros de custo
-- ----------------------------------------------------------------------------

create table if not exists appintura2.centros_custo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  nome text not null,
  tipo appintura2.tipo_centro_custo not null,
  created_at timestamptz not null default now(),
  constraint centros_custo_nome_unico unique (tenant_id, nome)
);

create index if not exists centros_custo_tenant_idx on appintura2.centros_custo (tenant_id);

-- ----------------------------------------------------------------------------
-- Contas a receber
-- ----------------------------------------------------------------------------

create table if not exists appintura2.contas_receber (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  cliente_id uuid not null references appintura2.clientes (id) on delete restrict,
  os_id uuid references appintura2.ordens_servico (id) on delete set null,
  descricao text not null default '',
  valor numeric(14, 2) not null,
  vencimento date not null,
  status appintura2.status_conta_base not null default 'em_aberto',
  forma_pagamento appintura2.forma_pagamento not null default 'boleto',
  centro_custo_id uuid references appintura2.centros_custo (id) on delete set null,
  parcela integer,
  total_parcelas integer,
  created_at timestamptz not null default now(),
  constraint contas_receber_valor_positivo check (valor > 0),
  constraint contas_receber_parcela_coerente check (
    (parcela is null and total_parcelas is null)
    or (parcela between 1 and total_parcelas)
  )
);

create index if not exists contas_receber_tenant_idx
  on appintura2.contas_receber (tenant_id, vencimento);
create index if not exists contas_receber_cliente_idx on appintura2.contas_receber (cliente_id);
create index if not exists contas_receber_os_idx on appintura2.contas_receber (os_id) where os_id is not null;

create table if not exists appintura2.contas_receber_pagamentos (
  id uuid primary key default gen_random_uuid(),
  conta_receber_id uuid not null
    references appintura2.contas_receber (id) on delete cascade,
  data_pagamento date not null default current_date,
  valor_pago numeric(14, 2) not null,
  -- Juros e multa ficam à parte do principal: somar tudo num campo só faria o
  -- título parecer "pago a mais" e sujaria o DRE.
  juros_multa numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  constraint pagamento_valor_positivo check (valor_pago > 0),
  constraint pagamento_encargos_nao_negativos check (juros_multa >= 0)
);

create index if not exists contas_receber_pagamentos_conta_idx
  on appintura2.contas_receber_pagamentos (conta_receber_id);

/*
 * Impede que a soma dos pagamentos passe do valor do título. Sem isso, um
 * duplo clique no botão de baixa gera saldo negativo silencioso.
 */
create or replace function appintura2.validar_pagamento_receber()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valor numeric(14, 2);
  v_pago numeric(14, 2);
begin
  select valor into v_valor
  from appintura2.contas_receber where id = new.conta_receber_id;

  select coalesce(sum(valor_pago), 0) into v_pago
  from appintura2.contas_receber_pagamentos
  where conta_receber_id = new.conta_receber_id
    and id <> new.id;

  if v_pago + new.valor_pago > v_valor then
    raise exception 'Pagamento excede o saldo: título de %, já pago %.', v_valor, v_pago
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;

drop trigger if exists contas_receber_pagamentos_validar on appintura2.contas_receber_pagamentos;
create trigger contas_receber_pagamentos_validar
  before insert or update on appintura2.contas_receber_pagamentos
  for each row
  execute function appintura2.validar_pagamento_receber();

create table if not exists appintura2.contas_receber_cobranca_historico (
  id uuid primary key default gen_random_uuid(),
  conta_receber_id uuid not null
    references appintura2.contas_receber (id) on delete cascade,
  data date not null default current_date,
  canal appintura2.canal_cobranca not null,
  responsavel_id uuid references appintura2.usuarios (id),
  resultado appintura2.resultado_cobranca not null,
  observacao text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists contas_receber_cobranca_conta_idx
  on appintura2.contas_receber_cobranca_historico (conta_receber_id, data desc);

-- ----------------------------------------------------------------------------
-- Contas a pagar
-- ----------------------------------------------------------------------------

create table if not exists appintura2.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  fornecedor text not null,
  descricao text not null default '',
  categoria appintura2.categoria_pagar not null,
  valor numeric(14, 2) not null,
  vencimento date not null,
  status appintura2.status_conta_base not null default 'em_aberto',
  recorrente boolean not null default false,
  centro_custo_id uuid references appintura2.centros_custo (id) on delete set null,
  data_pagamento date,
  created_at timestamptz not null default now(),
  constraint contas_pagar_valor_positivo check (valor > 0)
);

create index if not exists contas_pagar_tenant_idx on appintura2.contas_pagar (tenant_id, vencimento);
create index if not exists contas_pagar_abertas_idx
  on appintura2.contas_pagar (tenant_id, vencimento)
  where data_pagamento is null;

-- ----------------------------------------------------------------------------
-- Views
--
-- `security_invoker` obrigatório em todas — sem ele a view roda com privilégios
-- do dono e ignora RLS.
-- ----------------------------------------------------------------------------

create or replace view appintura2.vw_contas_receber_saldo
with (security_invoker = true)
as
select
  cr.*,
  coalesce(p.pago, 0) as total_pago,
  cr.valor - coalesce(p.pago, 0) as saldo,
  greatest(0, current_date - cr.vencimento) as dias_atraso,
  case
    when cr.status = 'cancelado' then 'cancelado'
    when cr.valor - coalesce(p.pago, 0) <= 0 then 'pago'
    when cr.status = 'negociado' then 'negociado'
    when cr.vencimento < current_date then 'vencido'
    when coalesce(p.pago, 0) > 0 then 'parcialmente_pago'
    else 'em_aberto'
  end as status_efetivo
from appintura2.contas_receber cr
left join lateral (
  select sum(valor_pago) as pago
  from appintura2.contas_receber_pagamentos
  where conta_receber_id = cr.id
) p on true;

comment on view appintura2.vw_contas_receber_saldo is
  'Saldo e status efetivo do título. O status nunca é persistido: depende da data de hoje.';

/*
 * Substitui `clientes.dias_inadimplencia_atual`, que a Fase 1 deixou como
 * coluna provisória. Depois de aplicar esta migration, a coluna deve ser
 * removida — número calculado guardado em tabela vira mentira no dia seguinte.
 */
create or replace view appintura2.vw_clientes_inadimplencia
with (security_invoker = true)
as
select
  cr.tenant_id,
  cr.cliente_id,
  max(v.dias_atraso) as dias_inadimplencia,
  sum(v.saldo) as valor_vencido,
  count(*) as titulos_vencidos
from appintura2.contas_receber cr
join appintura2.vw_contas_receber_saldo v on v.id = cr.id
where v.status_efetivo = 'vencido'
group by cr.tenant_id, cr.cliente_id;

-- ----------------------------------------------------------------------------
-- RLS
--
-- Financeiro é o módulo mais sensível: só admin e a role `financeiro` enxergam.
-- Gestor de produção fica de fora de propósito — preço e margem não são dado de
-- chão de fábrica.
-- ----------------------------------------------------------------------------

create or replace function appintura2.pode_ver_financeiro(tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from appintura2.user_roles ur
    where ur.user_id = (select appintura2.usuario_atual())
      and ur.tenant_id = pode_ver_financeiro.tenant_id
      and ur.role in ('admin', 'financeiro')
      and ur.status = 'ativo'
  )
$$;

grant execute on function appintura2.pode_ver_financeiro(uuid) to authenticated;

alter table appintura2.centros_custo enable row level security;
alter table appintura2.contas_receber enable row level security;
alter table appintura2.contas_receber_pagamentos enable row level security;
alter table appintura2.contas_receber_cobranca_historico enable row level security;
alter table appintura2.contas_pagar enable row level security;

do $$
declare
  tabela text;
begin
  foreach tabela in array array['centros_custo', 'contas_receber', 'contas_pagar']
  loop
    execute format($f$
      drop policy if exists %1$I on appintura2.%2$I;
      create policy %1$I on appintura2.%2$I
        for select to authenticated
        using (
          tenant_id in (select appintura2.get_user_tenant_ids())
          and appintura2.pode_ver_financeiro(tenant_id)
        );
    $f$, tabela || '_select', tabela);

    execute format($f$
      drop policy if exists %1$I on appintura2.%2$I;
      create policy %1$I on appintura2.%2$I
        for insert to authenticated
        with check (appintura2.pode_ver_financeiro(tenant_id));
    $f$, tabela || '_insert', tabela);

    execute format($f$
      drop policy if exists %1$I on appintura2.%2$I;
      create policy %1$I on appintura2.%2$I
        for update to authenticated
        using (appintura2.pode_ver_financeiro(tenant_id))
        with check (appintura2.pode_ver_financeiro(tenant_id));
    $f$, tabela || '_update', tabela);
  end loop;
end
$$;

-- Filhas de contas_receber: autorização pela raiz.
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'contas_receber_pagamentos',
    'contas_receber_cobranca_historico'
  ]
  loop
    execute format($f$
      drop policy if exists %1$I on appintura2.%2$I;
      create policy %1$I on appintura2.%2$I
        for select to authenticated
        using (
          exists (
            select 1 from appintura2.contas_receber cr
            where cr.id = %2$I.conta_receber_id
              and cr.tenant_id in (select appintura2.get_user_tenant_ids())
              and appintura2.pode_ver_financeiro(cr.tenant_id)
          )
        );
    $f$, tabela || '_select', tabela);

    execute format($f$
      drop policy if exists %1$I on appintura2.%2$I;
      create policy %1$I on appintura2.%2$I
        for insert to authenticated
        with check (
          exists (
            select 1 from appintura2.contas_receber cr
            where cr.id = %2$I.conta_receber_id
              and appintura2.pode_ver_financeiro(cr.tenant_id)
          )
        );
    $f$, tabela || '_insert', tabela);
  end loop;
end
$$;

-- Sem DELETE em pagamentos: estorno se faz com lançamento de ajuste, não
-- apagando a linha que prova o que entrou no caixa.

insert into appintura2.schema_migrations (version, name)
values ('20260915130000', 'fase5_financeiro')
on conflict (version) do nothing;

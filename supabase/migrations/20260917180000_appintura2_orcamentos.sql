-- ============================================================================
-- APPintura — Módulo de Orçamento (Fases 1 a 3)
--
-- Depende das migrations das Fases 0 a 7.
--
-- A etapa comercial que faltava: o orçamento é formalizado, o cliente aprova
-- por um link público SEM ter conta no sistema, e a aprovação gera a Ordem de
-- Serviço automaticamente.
--
-- Convenções da spec original traduzidas para as deste projeto, porque ela foi
-- escrita contra outro código:
--   `empresa_id`              -> `tenant_id`
--   `profiles` / `auth.users` -> `appintura2.usuarios`
--   policy via subselect      -> `get_user_tenant_ids()` / `usuario_atual()`
--
-- E uma decisão de modelagem: NÃO existe `pedidos_venda`. O orçamento é módulo
-- próprio e a aprovação converte direto em `ordens_servico`, que já carrega
-- Kanban, histórico de status, qualidade e vínculo de custódia. Uma camada
-- comercial intermediária cabe depois, sem refazer isto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

do $tipo$ begin
  create type appintura2.status_orcamento as enum (
  'rascunho',
  'enviado',
  'visualizado',
  'aprovado',
  'rejeitado',
  'alteracao_solicitada',
  'expirado',
  'revisado',
  'convertido'
  );
exception when duplicate_object then null;
end $tipo$;

do $tipo$ begin
  create type appintura2.evento_orcamento as enum (
  'criado',
  'enviado',
  'visualizado',
  'aprovado',
  'rejeitado',
  'alteracao_solicitada',
  'expirado',
  'revisado',
  'convertido'
  );
exception when duplicate_object then null;
end $tipo$;

do $tipo$ begin
  create type appintura2.tipo_anexo_orcamento as enum (
  'foto_referencia',
  'desenho_tecnico',
  'outro'
  );
exception when duplicate_object then null;
end $tipo$;

-- ----------------------------------------------------------------------------
-- Orçamento
--
-- `deleted_at` é a única tabela do schema com soft delete, e é deliberado: um
-- orçamento é documento comercial que o cliente viu e pode ter decidido. Apagar
-- de verdade destruiria a contraparte da trilha em `orcamento_eventos`.
--
-- A especificação TÉCNICA (cor, espessura, pré-tratamento) fica no cabeçalho e
-- não no item: é o que `ordens_servico` espera, e é a realidade da cabine — não
-- se pinta dois RAL na mesma passada. Orçamento com duas cores são dois
-- orçamentos, ou uma revisão.
-- ----------------------------------------------------------------------------

create table if not exists appintura2.orcamentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  numero integer not null,
  cliente_id uuid not null references appintura2.clientes (id),
  vendedor_id uuid not null references appintura2.usuarios (id),
  status appintura2.status_orcamento not null default 'rascunho',

  data_validade date not null,
  condicoes_pagamento text not null default '',
  prazo_entrega_dias integer not null default 0,

  -- Especificação técnica, copiada para a OS na conversão.
  cor_id uuid not null references appintura2.cores (id),
  espessura_min_micron numeric(6, 1) not null,
  espessura_max_micron numeric(6, 1) not null,
  tipo_pretratamento appintura2.tipo_pretratamento not null default 'desengraxe',

  -- Derivado dos itens, mas PERSISTIDO: o preço acordado não pode mudar quando
  -- a tabela de preço for reajustada no mês seguinte.
  valor_total numeric(12, 2) not null default 0,

  observacoes_internas text not null default '',
  observacoes_cliente text not null default '',

  orcamento_versao_anterior_id uuid references appintura2.orcamentos (id),
  os_id uuid references appintura2.ordens_servico (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint orcamentos_numero_por_tenant unique (tenant_id, numero),
  constraint orcamentos_espessura_coerente
    check (espessura_max_micron >= espessura_min_micron),
  constraint orcamentos_prazo_nao_negativo check (prazo_entrega_dias >= 0)
);

comment on table appintura2.orcamentos is
  'Etapa comercial anterior a OS. Aprovado pelo cliente via link publico, converte em ordens_servico.';
comment on column appintura2.orcamentos.observacoes_internas is
  'NUNCA exposto no link publico. A funcao de consulta publica nao seleciona esta coluna.';

create index if not exists orcamentos_tenant_status_idx
  on appintura2.orcamentos (tenant_id, status) where deleted_at is null;
create index if not exists orcamentos_cliente_idx on appintura2.orcamentos (cliente_id);
create index if not exists orcamentos_validade_idx
  on appintura2.orcamentos (data_validade)
  where status in ('enviado', 'visualizado') and deleted_at is null;

create or replace function appintura2.atribuir_numero_orcamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.numero := appintura2.proximo_numero(new.tenant_id, 'orcamento');
  return new;
end
$$;

drop trigger if exists orcamentos_numero on appintura2.orcamentos;
create trigger orcamentos_numero
  before insert on appintura2.orcamentos
  for each row execute function appintura2.atribuir_numero_orcamento();

create or replace function appintura2.tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists orcamentos_updated_at on appintura2.orcamentos;
create trigger orcamentos_updated_at
  before update on appintura2.orcamentos
  for each row execute function appintura2.tocar_updated_at();

-- ----------------------------------------------------------------------------
-- Itens
--
-- `descricao` e `tipo_acabamento` são SNAPSHOT do que foi orçado, não
-- referência viva: se o cadastro mudar de nome depois, o documento que o
-- cliente aprovou tem de continuar dizendo o que dizia.
-- ----------------------------------------------------------------------------

create table if not exists appintura2.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references appintura2.orcamentos (id) on delete cascade,
  descricao text not null,
  tipo_acabamento text not null default '',
  quantidade numeric(12, 3) not null,
  area_m2 numeric(12, 3) not null default 0,
  valor_unitario numeric(12, 2) not null,
  valor_total numeric(12, 2) not null,
  ordem integer not null default 0,

  constraint orcamento_itens_quantidade_positiva check (quantidade > 0),
  constraint orcamento_itens_valores_nao_negativos
    check (valor_unitario >= 0 and valor_total >= 0)
);

create index if not exists orcamento_itens_orcamento_idx on appintura2.orcamento_itens (orcamento_id);

-- ----------------------------------------------------------------------------
-- Anexos
-- ----------------------------------------------------------------------------

create table if not exists appintura2.orcamento_anexos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  orcamento_id uuid not null references appintura2.orcamentos (id) on delete cascade,
  storage_path text not null,
  nome text not null,
  tipo appintura2.tipo_anexo_orcamento not null default 'foto_referencia',
  created_at timestamptz not null default now()
);

create index if not exists orcamento_anexos_orcamento_idx on appintura2.orcamento_anexos (orcamento_id);

-- ----------------------------------------------------------------------------
-- Link público
--
-- Guarda o HASH do token, nunca o token. Se o banco vazar, os links não viram
-- chave de acesso — mesmo raciocínio de senha.
--
-- `tenant_id` está aqui mesmo a tabela sendo escrita por service_role, porque o
-- painel interno precisa listar os links da própria empresa sob RLS.
-- ----------------------------------------------------------------------------

create table if not exists appintura2.orcamento_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  orcamento_id uuid not null references appintura2.orcamentos (id) on delete cascade,
  token_hash text not null unique,
  expira_em timestamptz not null,
  usado_em timestamptz,
  revogado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists orcamento_links_orcamento_idx on appintura2.orcamento_links (orcamento_id);

comment on column appintura2.orcamento_links.token_hash is
  'sha-256 do token em claro. O token so existe uma vez, na resposta da geracao.';

-- ----------------------------------------------------------------------------
-- Eventos (auditoria imutável)
--
-- Sem policy de UPDATE nem DELETE, para ninguém: é a trilha que sustenta a
-- aprovação numa eventual disputa comercial. Poder reescrever aqui esvaziaria o
-- sentido de registrar.
-- ----------------------------------------------------------------------------

create table if not exists appintura2.orcamento_eventos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  orcamento_id uuid not null references appintura2.orcamentos (id) on delete cascade,
  tipo appintura2.evento_orcamento not null,
  -- Quem agiu: usuário interno OU cliente identificado no ato da decisão.
  usuario_id uuid references appintura2.usuarios (id),
  autor_nome text not null default '',
  autor_documento text not null default '',
  ip text not null default '',
  user_agent text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orcamento_eventos_orcamento_idx
  on appintura2.orcamento_eventos (orcamento_id, created_at);

comment on table appintura2.orcamento_eventos is
  'Somente-insert. Contem dado pessoal de nao-usuario (nome/CPF/IP do aprovador) - ver retencao na politica de privacidade.';

-- ----------------------------------------------------------------------------
-- A OS passa a poder nascer do comercial
--
-- `romaneio_recebimento_id` era NOT NULL porque, no fluxo original, a OS só
-- existia depois das peças chegarem. Com orçamento ela nasce ANTES: o cliente
-- aprova, a OS é criada, e as peças chegam depois. O vínculo é preenchido na
-- conferência do recebimento.
--
-- A regra de negócio "não produz sem peça" não se perde: ela passa a ser a
-- checagem de status abaixo, que é onde ela sempre deveria ter estado.
-- ----------------------------------------------------------------------------

alter table appintura2.ordens_servico
  alter column romaneio_recebimento_id drop not null;

alter table appintura2.ordens_servico
  add column if not exists orcamento_id uuid references appintura2.orcamentos (id),
  add column if not exists origem text not null default 'direta';

comment on column appintura2.ordens_servico.origem is
  'direta = aberta no balcao/producao; orcamento = veio de aprovacao comercial. Alimenta o funil.';

create index if not exists ordens_servico_orcamento_idx on appintura2.ordens_servico (orcamento_id);

create or replace function appintura2.exigir_romaneio_para_produzir()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Sair de 'recebido' significa colocar a mão na peça. Sem romaneio vinculado,
  -- não há peça conferida — e a OS estaria produzindo algo que ninguém registrou
  -- ter recebido.
  if new.status <> 'recebido' and new.romaneio_recebimento_id is null then
    raise exception
      'Vincule o romaneio de recebimento antes de avançar esta OS: as peças ainda não foram conferidas.'
      using errcode = '23514';
  end if;

  return new;
end
$$;

drop trigger if exists ordens_servico_exigir_romaneio on appintura2.ordens_servico;
create trigger ordens_servico_exigir_romaneio
  before insert or update on appintura2.ordens_servico
  for each row execute function appintura2.exigir_romaneio_para_produzir();

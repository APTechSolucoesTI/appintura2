-- ============================================================================
-- APPintura — Fase 3: Ordem de Serviço e Kanban
--
-- Núcleo de produção. A OS nasce obrigatoriamente de um romaneio de recebimento
-- (Fase 2): não se pinta peça que não entrou pela portaria.
--
-- Objetos no schema `appintura2`. Depende das migrations das Fases 0, 1 e 2.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

create type appintura2.status_os as enum (
  'recebido',
  'pre_tratamento',
  'aplicacao_po',
  'cura',
  'controle_qualidade',
  'embalagem',
  'aguardando_retirada',
  'finalizado',
  'retrabalho'
);

create type appintura2.urgencia_os as enum ('normal', 'alta', 'urgente');

create type appintura2.tipo_pretratamento as enum (
  'desengraxe',
  'decapagem',
  'fosfatizacao',
  'jateamento',
  'nenhum'
);

-- ----------------------------------------------------------------------------
-- Ordens de serviço
-- ----------------------------------------------------------------------------

create table appintura2.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  numero integer not null,
  cliente_id uuid not null references appintura2.clientes (id) on delete restrict,
  romaneio_recebimento_id uuid not null
    references appintura2.romaneios_recebimento (id) on delete restrict,
  data_entrada date not null,
  previsao_entrega date not null,
  urgencia appintura2.urgencia_os not null default 'normal',
  status appintura2.status_os not null default 'recebido',
  cor_id uuid not null references appintura2.cores (id) on delete restrict,
  espessura_min_micron numeric(6, 1) not null,
  espessura_max_micron numeric(6, 1) not null,
  tipo_pretratamento appintura2.tipo_pretratamento not null default 'desengraxe',
  laudo_path text,
  laudo_nome text not null default '',
  observacao text not null default '',
  created_at timestamptz not null default now(),
  constraint ordens_servico_numero_unico unique (tenant_id, numero),
  constraint ordens_servico_faixa_espessura
    check (espessura_max_micron >= espessura_min_micron),
  constraint ordens_servico_espessura_positiva check (espessura_min_micron > 0)
);

create index ordens_servico_tenant_status_idx
  on appintura2.ordens_servico (tenant_id, status);
create index ordens_servico_cliente_idx on appintura2.ordens_servico (cliente_id);
create index ordens_servico_romaneio_idx
  on appintura2.ordens_servico (romaneio_recebimento_id);
-- Painel de OS em atraso (Fase 6).
create index ordens_servico_prazo_idx
  on appintura2.ordens_servico (tenant_id, previsao_entrega)
  where status <> 'finalizado';

create table appintura2.os_itens (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references appintura2.ordens_servico (id) on delete cascade,
  descricao text not null,
  quantidade numeric(12, 3) not null,
  -- Área TOTAL da linha, já multiplicada pela quantidade.
  area_m2 numeric(12, 3) not null,
  foto_path text,
  constraint os_itens_quantidade_positiva check (quantidade > 0),
  constraint os_itens_area_positiva check (area_m2 > 0)
);

create index os_itens_os_idx on appintura2.os_itens (os_id);

create table appintura2.os_status_historico (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references appintura2.ordens_servico (id) on delete cascade,
  de appintura2.status_os,
  para appintura2.status_os not null,
  responsavel_id uuid references appintura2.usuarios (id),
  observacao text not null default '',
  created_at timestamptz not null default now()
);

create index os_status_historico_os_idx
  on appintura2.os_status_historico (os_id, created_at desc);

comment on table appintura2.os_status_historico is
  'Trilha de transições. Escrita só por trigger — ninguém insere aqui pelo client.';

-- Fase 2 deixou `os_id` sem FK porque esta tabela ainda não existia.
alter table appintura2.romaneios_recebimento
  add constraint romaneios_recebimento_os_fk
  foreign key (os_id) references appintura2.ordens_servico (id) on delete set null;

-- ----------------------------------------------------------------------------
-- Numeração e histórico automáticos
-- ----------------------------------------------------------------------------

create or replace function appintura2.atribuir_numero_os()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.numero := appintura2.proximo_numero(new.tenant_id, 'os');
  return new;
end
$$;

create trigger ordens_servico_numero
  before insert on appintura2.ordens_servico
  for each row
  when (new.numero is null)
  execute function appintura2.atribuir_numero_os();

/*
 * O histórico é gravado pelo banco, não pela aplicação.
 *
 * Se a trilha dependesse do cliente chamar dois comandos, bastaria uma falha de
 * rede entre eles para a OS mudar de etapa sem registro — e a rastreabilidade
 * da peça é justamente o que o cliente compra.
 */
create or replace function appintura2.registrar_transicao_os()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into appintura2.os_status_historico (os_id, de, para, responsavel_id)
    values (new.id, null, new.status, (select appintura2.usuario_atual()));
  elsif new.status is distinct from old.status then
    insert into appintura2.os_status_historico (os_id, de, para, responsavel_id)
    values (new.id, old.status, new.status, (select appintura2.usuario_atual()));
  end if;

  return new;
end
$$;

create trigger ordens_servico_historico_insert
  after insert on appintura2.ordens_servico
  for each row
  execute function appintura2.registrar_transicao_os();

create trigger ordens_servico_historico_update
  after update of status on appintura2.ordens_servico
  for each row
  execute function appintura2.registrar_transicao_os();

-- ----------------------------------------------------------------------------
-- Autorização
-- ----------------------------------------------------------------------------

/** Quem enxerga produção: chão de fábrica inteiro, menos financeiro e portaria. */
create or replace function appintura2.pode_ver_producao(tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from appintura2.user_roles ur
    where ur.user_id = (select appintura2.usuario_atual())
      and ur.tenant_id = pode_ver_producao.tenant_id
      and ur.role in ('admin', 'gestor_producao', 'operador_pintura', 'qualidade')
      and ur.status = 'ativo'
  )
$$;

/** Quem abre e altera a especificação da OS (cor, espessura, prazo, preço). */
create or replace function appintura2.pode_gerenciar_os(tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from appintura2.user_roles ur
    where ur.user_id = (select appintura2.usuario_atual())
      and ur.tenant_id = pode_gerenciar_os.tenant_id
      and ur.role in ('admin', 'gestor_producao')
      and ur.status = 'ativo'
  )
$$;

grant execute on function appintura2.pode_ver_producao(uuid) to authenticated;
grant execute on function appintura2.pode_gerenciar_os(uuid) to authenticated;

/*
 * Operador e qualidade movem o card no Kanban, mas não podem reescrever a
 * especificação. RLS decide a LINHA, não a COLUNA — então a restrição por campo
 * fica aqui, num trigger que rejeita qualquer alteração fora de `status`.
 */
create or replace function appintura2.restringir_update_os()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if appintura2.pode_gerenciar_os(new.tenant_id) then
    return new;
  end if;

  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception
      'Seu papel permite apenas mudar a etapa desta ordem de serviço.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end
$$;

create trigger ordens_servico_restringir_update
  before update on appintura2.ordens_servico
  for each row
  execute function appintura2.restringir_update_os();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table appintura2.ordens_servico enable row level security;
alter table appintura2.os_itens enable row level security;
alter table appintura2.os_status_historico enable row level security;

create policy "ordens_servico_select"
  on appintura2.ordens_servico for select to authenticated
  using (
    tenant_id in (select appintura2.get_user_tenant_ids())
    and appintura2.pode_ver_producao(tenant_id)
  );

create policy "ordens_servico_insert"
  on appintura2.ordens_servico for insert to authenticated
  with check (appintura2.pode_gerenciar_os(tenant_id));

-- Movimentar o card é permitido a todo o chão de fábrica; o trigger acima é que
-- limita o que cada papel pode de fato alterar.
create policy "ordens_servico_update"
  on appintura2.ordens_servico for update to authenticated
  using (appintura2.pode_ver_producao(tenant_id))
  with check (appintura2.pode_ver_producao(tenant_id));

create policy "ordens_servico_delete"
  on appintura2.ordens_servico for delete to authenticated
  using (appintura2.pode_gerenciar_os(tenant_id));

create policy "os_itens_select"
  on appintura2.os_itens for select to authenticated
  using (
    exists (
      select 1 from appintura2.ordens_servico os
      where os.id = os_itens.os_id
        and os.tenant_id in (select appintura2.get_user_tenant_ids())
        and appintura2.pode_ver_producao(os.tenant_id)
    )
  );

create policy "os_itens_escrita"
  on appintura2.os_itens for all to authenticated
  using (
    exists (
      select 1 from appintura2.ordens_servico os
      where os.id = os_itens.os_id and appintura2.pode_gerenciar_os(os.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from appintura2.ordens_servico os
      where os.id = os_itens.os_id and appintura2.pode_gerenciar_os(os.tenant_id)
    )
  );

create policy "os_status_historico_select"
  on appintura2.os_status_historico for select to authenticated
  using (
    exists (
      select 1 from appintura2.ordens_servico os
      where os.id = os_status_historico.os_id
        and os.tenant_id in (select appintura2.get_user_tenant_ids())
        and appintura2.pode_ver_producao(os.tenant_id)
    )
  );

-- Sem policy de INSERT/UPDATE/DELETE em os_status_historico: só o trigger
-- (SECURITY DEFINER) escreve. Trilha que o usuário consegue editar não é trilha.

-- ----------------------------------------------------------------------------
-- Consulta pública do QR code
--
-- O QR vai colado na peça e pode ser lido por qualquer um — inclusive por um
-- concorrente que fotografe a etiqueta no caminhão. Por isso a consulta é uma
-- função que devolve SÓ andamento: nada de cliente, quantidade, cor ou preço.
-- ----------------------------------------------------------------------------

create or replace function appintura2.consultar_os_publica(p_os_id uuid)
returns table (
  numero integer,
  status appintura2.status_os,
  previsao_entrega date
)
language sql
security definer
stable
set search_path = ''
as $$
  select os.numero, os.status, os.previsao_entrega
  from appintura2.ordens_servico os
  where os.id = p_os_id
$$;

grant execute on function appintura2.consultar_os_publica(uuid) to anon, authenticated;

insert into appintura2.schema_migrations (version, name)
values ('20260914150000', 'fase3_ordem_servico')
on conflict (version) do nothing;

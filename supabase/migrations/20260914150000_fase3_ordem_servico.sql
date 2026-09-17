-- ============================================================================
-- APPintura — Fase 3: Ordem de Serviço e Kanban
--
-- Núcleo de produção. A OS nasce obrigatoriamente de um romaneio de recebimento
-- (Fase 2): não se pinta peça que não entrou pela portaria.
--
-- NÃO APLICADA AINDA. Depende das migrations das Fases 0, 1 e 2.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

create type public.status_os as enum (
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

create type public.urgencia_os as enum ('normal', 'alta', 'urgente');

create type public.tipo_pretratamento as enum (
  'desengraxe',
  'decapagem',
  'fosfatizacao',
  'jateamento',
  'nenhum'
);

-- ----------------------------------------------------------------------------
-- Ordens de serviço
-- ----------------------------------------------------------------------------

create table public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  numero integer not null,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  romaneio_recebimento_id uuid not null
    references public.romaneios_recebimento (id) on delete restrict,
  data_entrada date not null,
  previsao_entrega date not null,
  urgencia public.urgencia_os not null default 'normal',
  status public.status_os not null default 'recebido',
  cor_id uuid not null references public.cores (id) on delete restrict,
  espessura_min_micron numeric(6, 1) not null,
  espessura_max_micron numeric(6, 1) not null,
  tipo_pretratamento public.tipo_pretratamento not null default 'desengraxe',
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
  on public.ordens_servico (tenant_id, status);
create index ordens_servico_cliente_idx on public.ordens_servico (cliente_id);
create index ordens_servico_romaneio_idx
  on public.ordens_servico (romaneio_recebimento_id);
-- Painel de OS em atraso (Fase 6).
create index ordens_servico_prazo_idx
  on public.ordens_servico (tenant_id, previsao_entrega)
  where status <> 'finalizado';

create table public.os_itens (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references public.ordens_servico (id) on delete cascade,
  descricao text not null,
  quantidade numeric(12, 3) not null,
  -- Área TOTAL da linha, já multiplicada pela quantidade.
  area_m2 numeric(12, 3) not null,
  foto_path text,
  constraint os_itens_quantidade_positiva check (quantidade > 0),
  constraint os_itens_area_positiva check (area_m2 > 0)
);

create index os_itens_os_idx on public.os_itens (os_id);

create table public.os_status_historico (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references public.ordens_servico (id) on delete cascade,
  de public.status_os,
  para public.status_os not null,
  responsavel_id uuid references auth.users (id),
  observacao text not null default '',
  created_at timestamptz not null default now()
);

create index os_status_historico_os_idx
  on public.os_status_historico (os_id, created_at desc);

comment on table public.os_status_historico is
  'Trilha de transições. Escrita só por trigger — ninguém insere aqui pelo client.';

-- Fase 2 deixou `os_id` sem FK porque esta tabela ainda não existia.
alter table public.romaneios_recebimento
  add constraint romaneios_recebimento_os_fk
  foreign key (os_id) references public.ordens_servico (id) on delete set null;

-- ----------------------------------------------------------------------------
-- Numeração e histórico automáticos
-- ----------------------------------------------------------------------------

create or replace function public.atribuir_numero_os()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.numero := public.proximo_numero(new.tenant_id, 'os');
  return new;
end
$$;

create trigger ordens_servico_numero
  before insert on public.ordens_servico
  for each row
  when (new.numero is null)
  execute function public.atribuir_numero_os();

/*
 * O histórico é gravado pelo banco, não pela aplicação.
 *
 * Se a trilha dependesse do cliente chamar dois comandos, bastaria uma falha de
 * rede entre eles para a OS mudar de etapa sem registro — e a rastreabilidade
 * da peça é justamente o que o cliente compra.
 */
create or replace function public.registrar_transicao_os()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.os_status_historico (os_id, de, para, responsavel_id)
    values (new.id, null, new.status, (select auth.uid()));
  elsif new.status is distinct from old.status then
    insert into public.os_status_historico (os_id, de, para, responsavel_id)
    values (new.id, old.status, new.status, (select auth.uid()));
  end if;

  return new;
end
$$;

create trigger ordens_servico_historico_insert
  after insert on public.ordens_servico
  for each row
  execute function public.registrar_transicao_os();

create trigger ordens_servico_historico_update
  after update of status on public.ordens_servico
  for each row
  execute function public.registrar_transicao_os();

-- ----------------------------------------------------------------------------
-- Autorização
-- ----------------------------------------------------------------------------

/** Quem enxerga produção: chão de fábrica inteiro, menos financeiro e portaria. */
create or replace function public.pode_ver_producao(tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.tenant_id = pode_ver_producao.tenant_id
      and ur.role in ('admin', 'gestor_producao', 'operador_pintura', 'qualidade')
      and ur.status = 'ativo'
  )
$$;

/** Quem abre e altera a especificação da OS (cor, espessura, prazo, preço). */
create or replace function public.pode_gerenciar_os(tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.tenant_id = pode_gerenciar_os.tenant_id
      and ur.role in ('admin', 'gestor_producao')
      and ur.status = 'ativo'
  )
$$;

grant execute on function public.pode_ver_producao(uuid) to authenticated;
grant execute on function public.pode_gerenciar_os(uuid) to authenticated;

/*
 * Operador e qualidade movem o card no Kanban, mas não podem reescrever a
 * especificação. RLS decide a LINHA, não a COLUNA — então a restrição por campo
 * fica aqui, num trigger que rejeita qualquer alteração fora de `status`.
 */
create or replace function public.restringir_update_os()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.pode_gerenciar_os(new.tenant_id) then
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
  before update on public.ordens_servico
  for each row
  execute function public.restringir_update_os();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.ordens_servico enable row level security;
alter table public.os_itens enable row level security;
alter table public.os_status_historico enable row level security;

create policy "ordens_servico_select"
  on public.ordens_servico for select to authenticated
  using (
    tenant_id in (select public.get_user_tenant_ids())
    and public.pode_ver_producao(tenant_id)
  );

create policy "ordens_servico_insert"
  on public.ordens_servico for insert to authenticated
  with check (public.pode_gerenciar_os(tenant_id));

-- Movimentar o card é permitido a todo o chão de fábrica; o trigger acima é que
-- limita o que cada papel pode de fato alterar.
create policy "ordens_servico_update"
  on public.ordens_servico for update to authenticated
  using (public.pode_ver_producao(tenant_id))
  with check (public.pode_ver_producao(tenant_id));

create policy "ordens_servico_delete"
  on public.ordens_servico for delete to authenticated
  using (public.pode_gerenciar_os(tenant_id));

create policy "os_itens_select"
  on public.os_itens for select to authenticated
  using (
    exists (
      select 1 from public.ordens_servico os
      where os.id = os_itens.os_id
        and os.tenant_id in (select public.get_user_tenant_ids())
        and public.pode_ver_producao(os.tenant_id)
    )
  );

create policy "os_itens_escrita"
  on public.os_itens for all to authenticated
  using (
    exists (
      select 1 from public.ordens_servico os
      where os.id = os_itens.os_id and public.pode_gerenciar_os(os.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.ordens_servico os
      where os.id = os_itens.os_id and public.pode_gerenciar_os(os.tenant_id)
    )
  );

create policy "os_status_historico_select"
  on public.os_status_historico for select to authenticated
  using (
    exists (
      select 1 from public.ordens_servico os
      where os.id = os_status_historico.os_id
        and os.tenant_id in (select public.get_user_tenant_ids())
        and public.pode_ver_producao(os.tenant_id)
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

create or replace function public.consultar_os_publica(p_os_id uuid)
returns table (
  numero integer,
  status public.status_os,
  previsao_entrega date
)
language sql
security definer
stable
set search_path = ''
as $$
  select os.numero, os.status, os.previsao_entrega
  from public.ordens_servico os
  where os.id = p_os_id
$$;

grant execute on function public.consultar_os_publica(uuid) to anon, authenticated;

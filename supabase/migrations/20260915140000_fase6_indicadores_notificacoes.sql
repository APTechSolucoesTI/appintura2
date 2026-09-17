-- ============================================================================
-- APPintura — Fase 6: Indicadores e Notificações
--
-- NÃO APLICADA AINDA. Depende das migrations das Fases 0 a 5.
-- ============================================================================

create type public.tipo_notificacao as enum (
  'os_aguardando_retirada',
  'os_finalizada',
  'devolucao_disponivel',
  'estoque_minimo',
  'peca_parada',
  'titulo_vencendo'
);

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tipo public.tipo_notificacao not null,
  titulo text not null,
  descricao text not null default '',
  /*
   * Id da OS, romaneio, item de estoque ou título que originou o aviso. Não é
   * FK: o tipo define a tabela, e transformar isso em seis colunas opcionais
   * deixaria a tabela impossível de consultar.
   */
  referencia_id uuid not null,
  link text not null default '',
  lida boolean not null default false,
  created_at timestamptz not null default now(),
  /*
   * Chave de idempotência. Sem ela, o job diário encheria o sino com a mesma
   * peça parada todo dia até alguém movê-la.
   */
  constraint notificacoes_unica unique (tenant_id, tipo, referencia_id)
);

create index notificacoes_tenant_idx
  on public.notificacoes (tenant_id, created_at desc);
create index notificacoes_nao_lidas_idx
  on public.notificacoes (tenant_id)
  where lida = false;

-- ----------------------------------------------------------------------------
-- Gatilhos de evento
--
-- Só os que reagem a uma mudança de dado ficam em trigger. Os que dependem do
-- tempo passar — peça parada, estoque vencendo, título a vencer — são um job de
-- `pg_cron` (ver no fim do arquivo), porque ninguém altera linha nenhuma no dia
-- em que o prazo estoura.
-- ----------------------------------------------------------------------------

create or replace function public.notificar_mudanca_os()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo public.tipo_notificacao;
  v_titulo text;
  v_descricao text;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'aguardando_retirada' then
    v_tipo := 'os_aguardando_retirada';
    v_titulo := 'OS #' || lpad(new.numero::text, 4, '0') || ' pronta';
    v_descricao := 'Peças embaladas, aguardando o cliente retirar.';
  elsif new.status = 'finalizado' then
    v_tipo := 'os_finalizada';
    v_titulo := 'OS #' || lpad(new.numero::text, 4, '0') || ' finalizada';
    v_descricao := 'Ordem concluída e entregue.';
  else
    return new;
  end if;

  insert into public.notificacoes (
    tenant_id, tipo, titulo, descricao, referencia_id, link
  )
  values (
    new.tenant_id, v_tipo, v_titulo, v_descricao, new.id,
    '/app/ordens-servico/' || new.id
  )
  on conflict (tenant_id, tipo, referencia_id) do nothing;

  return new;
end
$$;

create trigger ordens_servico_notificar
  after update of status on public.ordens_servico
  for each row
  execute function public.notificar_mudanca_os();

create or replace function public.notificar_devolucao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'aguardando_retirada' then
    return new;
  end if;

  insert into public.notificacoes (
    tenant_id, tipo, titulo, descricao, referencia_id, link
  )
  values (
    new.tenant_id,
    'devolucao_disponivel',
    'Devolução #' || lpad(new.numero::text, 4, '0') || ' separada',
    'Aguardando ' || coalesce(nullif(new.retirado_por_nome, ''), 'o cliente') || ' retirar.',
    new.id,
    '/app/recebimento/devolucoes/' || new.id
  )
  on conflict (tenant_id, tipo, referencia_id) do nothing;

  return new;
end
$$;

create trigger romaneios_devolucao_notificar
  after insert or update of status on public.romaneios_devolucao
  for each row
  execute function public.notificar_devolucao()
;

-- ----------------------------------------------------------------------------
-- Gatilhos que dependem do tempo
--
-- Idempotentes pelo `on conflict`: rodar duas vezes no mesmo dia não duplica.
-- ----------------------------------------------------------------------------

create or replace function public.avaliar_notificacoes_periodicas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_criadas integer := 0;
  v_linhas integer;
begin
  -- Estoque abaixo do mínimo ou com lote vencido.
  insert into public.notificacoes (tenant_id, tipo, titulo, descricao, referencia_id, link)
  select
    c.tenant_id,
    'estoque_minimo',
    c.codigo_ral || ' — ' || c.nome_comercial,
    case
      when c.validade < current_date then 'Lote vencido — não aplicar.'
      else 'Saldo de ' || c.estoque_atual || ' kg, abaixo do mínimo de ' || c.estoque_minimo || '.'
    end,
    c.id,
    '/app/estoque/posicao'
  from public.cores c
  where c.estoque_atual < c.estoque_minimo or c.validade < current_date
  on conflict (tenant_id, tipo, referencia_id) do nothing;

  get diagnostics v_linhas = row_count;
  v_criadas := v_criadas + v_linhas;

  -- Peças paradas além do limite configurado pela empresa.
  insert into public.notificacoes (tenant_id, tipo, titulo, descricao, referencia_id, link)
  select
    s.tenant_id,
    'peca_parada',
    s.descricao || ' parada há ' || s.dias_em_custodia || ' dias',
    cl.razao_social || ' — ' || s.saldo || ' unidade(s) no pátio.',
    s.recebimento_item_id,
    '/app/recebimento/custodia'
  from public.saldo_custodia s
  join public.clientes cl on cl.id = s.cliente_id
  join public.configuracoes_tenant cfg on cfg.tenant_id = s.tenant_id
  where s.saldo > 0 and s.dias_em_custodia >= cfg.dias_alerta_custodia
  on conflict (tenant_id, tipo, referencia_id) do nothing;

  get diagnostics v_linhas = row_count;
  v_criadas := v_criadas + v_linhas;

  -- Títulos vencidos ou a vencer em até 5 dias.
  insert into public.notificacoes (tenant_id, tipo, titulo, descricao, referencia_id, link)
  select
    v.tenant_id,
    'titulo_vencendo',
    case
      when v.status_efetivo = 'vencido' then 'Título vencido'
      else 'Título vence em breve'
    end,
    v.descricao,
    v.id,
    '/app/financeiro/receber'
  from public.vw_contas_receber_saldo v
  where v.status_efetivo in ('em_aberto', 'parcialmente_pago', 'vencido')
    and v.vencimento <= current_date + 5
  on conflict (tenant_id, tipo, referencia_id) do nothing;

  get diagnostics v_linhas = row_count;

  return v_criadas + v_linhas;
end
$$;

comment on function public.avaliar_notificacoes_periodicas is
  'Agendar com pg_cron: select cron.schedule(''notificacoes-appintura'', ''0 7 * * *'', $$select public.avaliar_notificacoes_periodicas()$$);';

-- ----------------------------------------------------------------------------
-- Base do SLA
-- ----------------------------------------------------------------------------

create view public.vw_sla_os
with (security_invoker = true)
as
select
  os.tenant_id,
  os.id as os_id,
  os.numero,
  os.cliente_id,
  os.data_entrada,
  os.previsao_entrega,
  fim.created_at::date as entregue_em,
  (fim.created_at::date <= os.previsao_entrega) as no_prazo,
  (fim.created_at::date - os.data_entrada) as dias_realizados,
  (os.previsao_entrega - os.data_entrada) as dias_prometidos
from public.ordens_servico os
join lateral (
  select h.created_at
  from public.os_status_historico h
  where h.os_id = os.id and h.para = 'finalizado'
  order by h.created_at desc
  limit 1
) fim on true;

comment on view public.vw_sla_os is
  'Prazo prometido x realizado das OS finalizadas. Base do indicador de SLA.';

-- ----------------------------------------------------------------------------
-- RLS
--
-- Notificação é aviso operacional: qualquer papel do tenant lê. O conteúdo
-- sensível fica na tela de destino, que tem a RLS do seu próprio módulo.
-- ----------------------------------------------------------------------------

alter table public.notificacoes enable row level security;

create policy "notificacoes_select"
  on public.notificacoes for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids()));

-- Só "marcar como lida" é permitido pelo client; criar é trabalho das triggers
-- e do job, ambos SECURITY DEFINER.
create policy "notificacoes_marcar_lida"
  on public.notificacoes for update to authenticated
  using (tenant_id in (select public.get_user_tenant_ids()))
  with check (tenant_id in (select public.get_user_tenant_ids()));

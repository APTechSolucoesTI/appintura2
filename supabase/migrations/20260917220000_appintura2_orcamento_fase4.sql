-- ============================================================================
-- APPintura — Orçamento Fase 4: integração com recebimento, produção e devolução
--
-- Depende de 20260917210000_appintura2_orcamento_enums.sql.
--
-- A ideia central da fase: o orçamento passa a ser a FONTE ÚNICA dos itens
-- contratados. Recebimento, produção e devolução referenciam essa mesma lista
-- em vez de recriá-la — é isso que elimina a divergência entre o que foi
-- vendido, o que foi produzido e o que foi devolvido.
--
-- Sobre o Kanban: a spec fala em "um card por item ou por lote, conforme a
-- granularidade já usada". Aqui o card É a OS, e a OS já nasce da conversão com
-- cor, espessura e pré-tratamento copiados. Não há card a criar — o que faltava
-- era o romaneio esperado, abaixo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Romaneio esperado
--
-- Na conversão, a lista do que o cliente DEVE entregar já fica registrada com
-- status `pendente_conferencia`. Quando as peças chegam, a portaria confere
-- contra esta lista em vez de digitar do zero — menos erro, e divergência
-- (peça a mais, a menos, fora do especificado) aparece na entrada.
--
-- `conferente_id` recebe o vendedor: é quem responde pelo documento até alguém
-- de fato conferir a carga. A coluna é NOT NULL e mentir aqui seria pior.
-- ----------------------------------------------------------------------------

-- Colunas da aprovacao parcial (o recurso se completa na Fase 5). Entram aqui
-- porque `criar_romaneio_esperado`, logo abaixo, ja precisa filtrar por elas:
-- pedir ao cliente uma peca que ele recusou seria erro na portaria.
alter table appintura2.orcamento_itens
  add column if not exists aprovado boolean not null default true;

alter table appintura2.orcamentos
  add column if not exists valor_aprovado numeric(12, 2);

comment on column appintura2.orcamentos.valor_aprovado is
  'Valor fechado. NULL enquanto nao ha decisao; menor que valor_total na aprovacao parcial.';
comment on column appintura2.orcamento_itens.aprovado is
  'Comeca true. O cliente pode desmarcar itens no portal antes de aprovar.';

create or replace function appintura2.criar_romaneio_esperado(p_orcamento_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_orc      appintura2.orcamentos%rowtype;
  v_romaneio uuid;
begin
  select * into v_orc
  from appintura2.orcamentos
  where id = p_orcamento_id and deleted_at is null;

  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;

  insert into appintura2.romaneios_recebimento (
    tenant_id, cliente_id, data_hora, conferente_id, status, observacao
  )
  values (
    v_orc.tenant_id, v_orc.cliente_id, now(), v_orc.vendedor_id,
    'pendente_conferencia',
    'Lista esperada, gerada do orçamento nº ' || v_orc.numero ||
      '. Confira contra a carga física na chegada.'
  )
  returning id into v_romaneio;

  -- Só os itens APROVADOS entram (aprovação parcial da Fase 5). Pedir ao
  -- cliente uma peça que ele recusou seria erro na portaria.
  insert into appintura2.romaneio_recebimento_itens
    (romaneio_id, descricao, quantidade, unidade, condicao_chegada, observacao)
  select
    v_romaneio, i.descricao, i.quantidade, 'peca', 'integra',
    case when i.tipo_acabamento <> '' then 'Acabamento: ' || i.tipo_acabamento else '' end
  from appintura2.orcamento_itens i
  where i.orcamento_id = v_orc.id and i.aprovado;

  return v_romaneio;
end
$$;

revoke all on function appintura2.criar_romaneio_esperado(uuid)
  from public, anon, authenticated;
grant execute on function appintura2.criar_romaneio_esperado(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- "Não produz sem peça conferida"
--
-- Agora que a OS já nasce COM romaneio (o esperado), a checagem de existência
-- virou fraca demais: um romaneio `pendente_conferencia` significa exatamente
-- que ninguém viu a peça ainda. A regra passa a olhar o STATUS do romaneio.
-- ----------------------------------------------------------------------------

create or replace function appintura2.exigir_romaneio_para_produzir()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status appintura2.status_recebimento;
begin
  if new.status = 'recebido' then
    return new;
  end if;

  if new.romaneio_recebimento_id is null then
    raise exception
      'Vincule o romaneio de recebimento antes de avançar esta OS: as peças ainda não foram conferidas.'
      using errcode = '23514';
  end if;

  select status into v_status
  from appintura2.romaneios_recebimento
  where id = new.romaneio_recebimento_id;

  if v_status = 'pendente_conferencia' then
    raise exception
      'O romaneio desta OS ainda está pendente de conferência. Confira a carga na portaria antes de iniciar a produção.'
      using errcode = '23514';
  end if;

  return new;
end
$$;

-- ----------------------------------------------------------------------------
-- Conferência contra o esperado
--
-- Devolve, por item esperado, o que foi de fato conferido e a diferença. É o
-- que a tela da portaria usa para destacar divergência antes de fechar o
-- romaneio.
-- ----------------------------------------------------------------------------

create or replace function appintura2.conferencia_esperada(p_romaneio_id uuid)
returns table (
  item_id        uuid,
  descricao      text,
  esperado       numeric,
  conferido      numeric,
  diferenca      numeric,
  condicao       appintura2.condicao_item
)
language sql
stable
set search_path = ''
as $$
  select
    i.id,
    i.descricao,
    i.quantidade as esperado,
    -- Antes da conferência, `quantidade` É a expectativa; depois que a portaria
    -- ajusta, ela vira o real. A diferença só faz sentido contra o orçamento.
    coalesce(o.quantidade, i.quantidade) as conferido,
    coalesce(o.quantidade, i.quantidade) - i.quantidade as diferenca,
    i.condicao_chegada
  from appintura2.romaneio_recebimento_itens i
  left join appintura2.orcamento_itens o
    on o.descricao = i.descricao
   and o.orcamento_id = (
     select os.orcamento_id
     from appintura2.ordens_servico os
     where os.romaneio_recebimento_id = p_romaneio_id
     limit 1
   )
  where i.romaneio_id = p_romaneio_id
$$;

grant execute on function appintura2.conferencia_esperada(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Checklist de devolução contra o orçamento de origem
--
-- Tudo que foi recebido tem de ser devolvido. Esta view liga a cadeia inteira —
-- orçamento → romaneio → OS → devolução — para que a divergência aponte de
-- volta ao documento que o cliente aprovou, e não só ao romaneio.
-- ----------------------------------------------------------------------------

create or replace view appintura2.vw_checklist_devolucao
with (security_invoker = true)
as
select
  r.tenant_id,
  r.cliente_id,
  os.orcamento_id,
  orc.numero                       as orcamento_numero,
  r.id                             as romaneio_id,
  r.numero                         as romaneio_numero,
  i.id                             as recebimento_item_id,
  i.descricao,
  i.quantidade                     as quantidade_recebida,
  coalesce(sum(di.quantidade), 0)  as quantidade_devolvida,
  i.quantidade - coalesce(sum(di.quantidade), 0) as saldo,
  bool_or(di.condicao_saida <> 'integra') as houve_avaria
from appintura2.romaneios_recebimento r
join appintura2.romaneio_recebimento_itens i on i.romaneio_id = r.id
left join appintura2.romaneio_devolucao_itens di on di.recebimento_item_id = i.id
left join appintura2.ordens_servico os on os.romaneio_recebimento_id = r.id
left join appintura2.orcamentos orc on orc.id = os.orcamento_id
where r.status <> 'pendente_conferencia'
group by r.tenant_id, r.cliente_id, os.orcamento_id, orc.numero,
         r.id, r.numero, i.id, i.descricao, i.quantidade;

comment on view appintura2.vw_checklist_devolucao is
  'Recebido x devolvido por item, com o orcamento de origem. Saldo > 0 = ainda em custodia.';

-- ----------------------------------------------------------------------------
-- Notificações internas
--
-- O vendedor não pode depender de ficar abrindo o painel para descobrir que o
-- cliente decidiu. Grava em `notificacoes`, a mesma central do sino no topbar.
--
-- `on conflict do nothing` sobre (tenant, tipo, referencia): reabrir o link não
-- gera notificação nova — a informação útil é "o cliente viu", não quantas
-- vezes ele abriu.
-- ----------------------------------------------------------------------------

create or replace function appintura2.notificar_orcamento(
  p_orcamento_id uuid,
  p_tipo         appintura2.tipo_notificacao,
  p_titulo       text,
  p_descricao    text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into appintura2.notificacoes (tenant_id, tipo, titulo, descricao, referencia_id, link)
  select
    o.tenant_id, p_tipo, p_titulo, p_descricao, o.id,
    '/app/orcamentos/' || o.id
  from appintura2.orcamentos o
  where o.id = p_orcamento_id
  on conflict (tenant_id, tipo, referencia_id) do nothing;
end
$$;

revoke all on function appintura2.notificar_orcamento(uuid, appintura2.tipo_notificacao, text, text)
  from public, anon, authenticated;

/*
 * Dispara a notificação a partir do evento recém-gravado.
 *
 * Trigger e não chamada explícita: assim TODO evento notifica, inclusive os que
 * vierem de caminhos futuros (job de expiração, correção manual, import). Uma
 * chamada espalhada pelas funções seria esquecida na primeira que eu escrevesse
 * depois.
 */
create or replace function appintura2.notificar_evento_orcamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero integer;
  v_quem   text;
begin
  select numero into v_numero from appintura2.orcamentos where id = new.orcamento_id;

  v_quem := case when new.autor_nome <> '' then ' por ' || new.autor_nome else '' end;

  if new.tipo = 'visualizado' then
    perform appintura2.notificar_orcamento(new.orcamento_id, 'orcamento_visualizado',
      'Orçamento nº ' || v_numero || ' foi aberto pelo cliente',
      'O cliente acessou o link. Ainda não decidiu.');

  elsif new.tipo = 'aprovado' then
    perform appintura2.notificar_orcamento(new.orcamento_id, 'orcamento_aprovado',
      'Orçamento nº ' || v_numero || ' aprovado' || v_quem,
      'A ordem de serviço foi criada e o romaneio esperado já está na portaria.');

  elsif new.tipo = 'aprovado_parcial' then
    perform appintura2.notificar_orcamento(new.orcamento_id, 'orcamento_aprovado',
      'Orçamento nº ' || v_numero || ' aprovado em parte' || v_quem,
      'O cliente aceitou parte dos itens. Confira o que entrou na ordem de serviço.');

  elsif new.tipo = 'rejeitado' then
    perform appintura2.notificar_orcamento(new.orcamento_id, 'orcamento_rejeitado',
      'Orçamento nº ' || v_numero || ' recusado' || v_quem,
      coalesce(new.metadata ->> 'mensagem', ''));

  elsif new.tipo = 'alteracao_solicitada' then
    perform appintura2.notificar_orcamento(new.orcamento_id, 'orcamento_alteracao',
      'Cliente pediu alteração no orçamento nº ' || v_numero,
      coalesce(new.metadata ->> 'mensagem', ''));

  elsif new.tipo = 'expirado' then
    perform appintura2.notificar_orcamento(new.orcamento_id, 'orcamento_expirado',
      'Orçamento nº ' || v_numero || ' venceu sem decisão',
      'A validade passou. Se o cliente ainda tiver interesse, crie uma revisão.');
  end if;

  return new;
end
$$;

drop trigger if exists orcamento_eventos_notificar on appintura2.orcamento_eventos;
create trigger orcamento_eventos_notificar
  after insert on appintura2.orcamento_eventos
  for each row execute function appintura2.notificar_evento_orcamento();

-- ----------------------------------------------------------------------------
-- Lembrete de validade
--
-- Roda junto com o job de expiração. Avisa 2 dias antes, para o vendedor ter
-- tempo de ligar para o cliente — depois de vencido, o aviso é autópsia.
-- ----------------------------------------------------------------------------

create or replace function appintura2.avisar_orcamentos_vencendo(p_dias integer default 2)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_registro record;
  v_conta    integer := 0;
begin
  for v_registro in
    select id, numero, data_validade
    from appintura2.orcamentos
    where status in ('enviado', 'visualizado', 'alteracao_solicitada')
      and deleted_at is null
      and data_validade between current_date and current_date + p_dias
  loop
    perform appintura2.notificar_orcamento(v_registro.id, 'orcamento_vencendo',
      'Orçamento nº ' || v_registro.numero || ' vence em breve',
      'Validade em ' || to_char(v_registro.data_validade, 'DD/MM/YYYY') ||
      ' e o cliente ainda não decidiu.');
    v_conta := v_conta + 1;
  end loop;

  return v_conta;
end
$$;

revoke all on function appintura2.avisar_orcamentos_vencendo(integer) from public, anon;
grant execute on function appintura2.avisar_orcamentos_vencendo(integer)
  to authenticated, service_role;

insert into appintura2.schema_migrations (version, name)
values ('20260917220000', 'appintura2_orcamento_fase4')
on conflict (version) do nothing;

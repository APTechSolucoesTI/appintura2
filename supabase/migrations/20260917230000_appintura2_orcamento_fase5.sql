-- ============================================================================
-- APPintura — Orçamento Fase 5: aprovação parcial, diff de versões e funil
--
-- Depende de 20260917220000_appintura2_orcamento_fase4.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Aprovação parcial
--
-- `aprovado` começa true para todo item: antes da decisão, o proposto É o
-- conjunto todo. O cliente pode desmarcar itens no portal; a conversão leva só
-- os marcados, e o romaneio esperado também.
--
-- `valor_aprovado` é separado de `valor_total` de propósito. O funil precisa
-- dos dois: `valor_total` é o que foi PROPOSTO, `valor_aprovado` é o que foi
-- FECHADO. Colapsar num campo só apagaria a informação de quanto se perde por
-- recusa parcial, que é justamente o que o relatório quer medir.
-- ----------------------------------------------------------------------------

-- As colunas de aprovacao parcial foram criadas na migration da Fase 4:
-- `criar_romaneio_esperado` ja precisa filtrar por `aprovado`, e uma migration
-- nao pode depender de coluna que so aparece na seguinte.

-- ----------------------------------------------------------------------------
-- Decisão com seleção de itens
--
-- Substitui a versão da Fase 3. `p_itens_aprovados` NULO significa "todos" —
-- é o caminho do cliente que simplesmente clica em Aprovar, e mantém o
-- comportamento anterior intacto.
-- ----------------------------------------------------------------------------

create or replace function appintura2.decidir_orcamento_publico(
  p_token_hash      text,
  p_decisao         text,
  p_autor_nome      text default '',
  p_autor_documento text default '',
  p_mensagem        text default '',
  p_ip              text default '',
  p_user_agent      text default '',
  p_itens_aprovados uuid[] default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_link      appintura2.orcamento_links%rowtype;
  v_orc       appintura2.orcamentos%rowtype;
  v_os        uuid;
  v_aprovados integer;
  v_total     integer;
  v_valor     numeric(12, 2);
  v_status    appintura2.status_orcamento;
  v_evento    appintura2.evento_orcamento;
begin
  if p_decisao not in ('aprovado', 'rejeitado', 'alteracao_solicitada') then
    return jsonb_build_object('ok', false, 'motivo', 'decisao_invalida');
  end if;

  select * into v_link
  from appintura2.orcamento_links
  where token_hash = p_token_hash
  for update;

  if not found or v_link.revogado or v_link.expira_em <= now() then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end if;

  select * into v_orc
  from appintura2.orcamentos
  where id = v_link.orcamento_id and deleted_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end if;

  if v_link.usado_em is not null then
    return jsonb_build_object('ok', true, 'repetido', true,
                              'decisao', v_orc.status, 'numero', v_orc.numero);
  end if;

  if v_orc.data_validade < current_date then
    update appintura2.orcamentos set status = 'expirado' where id = v_orc.id;
    update appintura2.orcamento_links set revogado = true where id = v_link.id;
    perform appintura2.registrar_evento_orcamento(
      v_orc.id, 'expirado', p_ip => p_ip, p_user_agent => p_user_agent,
      p_metadata => jsonb_build_object('tentativa', p_decisao));

    return jsonb_build_object('ok', false, 'motivo', 'vencido');
  end if;

  if p_decisao = 'alteracao_solicitada' then
    update appintura2.orcamentos set status = 'alteracao_solicitada' where id = v_orc.id;
    perform appintura2.registrar_evento_orcamento(
      v_orc.id, 'alteracao_solicitada', p_autor_nome, p_autor_documento,
      p_ip, p_user_agent, jsonb_build_object('mensagem', coalesce(p_mensagem, '')));

    return jsonb_build_object('ok', true, 'decisao', 'alteracao_solicitada',
                              'numero', v_orc.numero);
  end if;

  if p_decisao = 'aprovado' and coalesce(btrim(p_autor_nome), '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'nome_obrigatorio');
  end if;

  update appintura2.orcamento_links set usado_em = now() where id = v_link.id;

  if p_decisao = 'rejeitado' then
    update appintura2.orcamentos
       set status = 'rejeitado', valor_aprovado = 0
     where id = v_orc.id;

    perform appintura2.registrar_evento_orcamento(
      v_orc.id, 'rejeitado', p_autor_nome, p_autor_documento, p_ip, p_user_agent,
      jsonb_build_object('mensagem', coalesce(p_mensagem, '')));

    return jsonb_build_object('ok', true, 'decisao', 'rejeitado', 'numero', v_orc.numero);
  end if;

  -- Seleção de itens. Lista nula = aprovou tudo.
  --
  -- A marcação passa por função própria porque ela RECUSA id que não seja deste
  -- orçamento. Um `set aprovado = (id = any (lista))` cru, recebendo o id de um
  -- item de OUTRO orçamento, marcaria todos os daqui como false — e a aprovação
  -- viraria recusa silenciosa.
  perform appintura2.marcar_itens_aprovados(v_orc.id, p_itens_aprovados);

  select count(*) filter (where aprovado), count(*),
         coalesce(sum(valor_total) filter (where aprovado), 0)
    into v_aprovados, v_total, v_valor
  from appintura2.orcamento_itens
  where orcamento_id = v_orc.id;

  -- Desmarcar tudo é recusar. Tratar como aprovação geraria uma OS vazia e um
  -- romaneio pedindo nada ao cliente.
  if v_aprovados = 0 then
    update appintura2.orcamentos
       set status = 'rejeitado', valor_aprovado = 0
     where id = v_orc.id;

    perform appintura2.registrar_evento_orcamento(
      v_orc.id, 'rejeitado', p_autor_nome, p_autor_documento, p_ip, p_user_agent,
      jsonb_build_object('mensagem', coalesce(p_mensagem, ''), 'motivo', 'nenhum_item_aceito'));

    return jsonb_build_object('ok', true, 'decisao', 'rejeitado', 'numero', v_orc.numero);
  end if;

  if v_aprovados < v_total then
    v_status := 'aprovado_parcial';
    v_evento := 'aprovado_parcial';
  else
    v_status := 'aprovado';
    v_evento := 'aprovado';
  end if;

  update appintura2.orcamentos
     set status = v_status, valor_aprovado = v_valor
   where id = v_orc.id;

  perform appintura2.registrar_evento_orcamento(
    v_orc.id, v_evento, p_autor_nome, p_autor_documento, p_ip, p_user_agent,
    jsonb_build_object(
      'mensagem', coalesce(p_mensagem, ''),
      'itens_aprovados', v_aprovados,
      'itens_propostos', v_total,
      'valor_aprovado', v_valor));

  -- Mesma transação: se a conversão falhar, a aprovação inteira volta atrás.
  v_os := appintura2.converter_orcamento_em_os(v_orc.id);

  return jsonb_build_object(
    'ok', true, 'decisao', v_status::text, 'numero', v_orc.numero,
    'os_id', v_os, 'itens_aprovados', v_aprovados, 'itens_propostos', v_total);
end
$$;

revoke all on function appintura2.decidir_orcamento_publico(text, text, text, text, text, text, text, uuid[])
  from public, anon, authenticated;
grant execute on function appintura2.decidir_orcamento_publico(text, text, text, text, text, text, text, uuid[])
  to service_role;

-- A assinatura de 7 argumentos da Fase 3 fica para trás: com as duas no ar, o
-- PostgREST não consegue resolver a chamada e devolve "could not choose".
drop function if exists appintura2.decidir_orcamento_publico(text, text, text, text, text, text, text);

-- ----------------------------------------------------------------------------
-- Conversão: só os itens aceitos, e já com o romaneio esperado
-- ----------------------------------------------------------------------------

create or replace function appintura2.converter_orcamento_em_os(p_orcamento_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_orc      appintura2.orcamentos%rowtype;
  v_os       uuid;
  v_romaneio uuid;
begin
  select * into v_orc
  from appintura2.orcamentos
  where id = p_orcamento_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;

  if v_orc.os_id is not null then
    return v_orc.os_id;
  end if;

  -- Fase 4: a lista do que o cliente deve entregar nasce junto com a OS.
  v_romaneio := appintura2.criar_romaneio_esperado(v_orc.id);

  insert into appintura2.ordens_servico (
    tenant_id, cliente_id, romaneio_recebimento_id, data_entrada, previsao_entrega,
    urgencia, status, cor_id, espessura_min_micron, espessura_max_micron,
    tipo_pretratamento, observacao, orcamento_id, origem
  )
  values (
    v_orc.tenant_id, v_orc.cliente_id, v_romaneio, now(),
    now() + make_interval(days => greatest(v_orc.prazo_entrega_dias, 1)),
    'normal', 'recebido', v_orc.cor_id,
    v_orc.espessura_min_micron, v_orc.espessura_max_micron,
    v_orc.tipo_pretratamento, v_orc.observacoes_cliente,
    v_orc.id, 'orcamento'
  )
  returning id into v_os;

  -- Fecha o vínculo dos dois lados: a portaria abre pelo romaneio e chega na OS.
  update appintura2.romaneios_recebimento set os_id = v_os where id = v_romaneio;

  -- SNAPSHOT dos itens ACEITOS. Não é referência viva: o que a produção vai
  -- fabricar é o que foi acordado, mesmo que o orçamento seja revisado depois.
  insert into appintura2.os_itens (os_id, descricao, quantidade, area_m2)
  select v_os, i.descricao, i.quantidade, i.area_m2
  from appintura2.orcamento_itens i
  where i.orcamento_id = v_orc.id and i.aprovado;

  update appintura2.orcamentos
     set os_id = v_os, status = 'convertido'
   where id = v_orc.id;

  perform appintura2.registrar_evento_orcamento(
    v_orc.id, 'convertido',
    p_metadata => jsonb_build_object('os_id', v_os, 'romaneio_esperado_id', v_romaneio));

  return v_os;
end
$$;

-- ----------------------------------------------------------------------------
-- Diff entre versões
--
-- Compara um orçamento com a versão que ele substituiu. Casa por descrição
-- porque a revisão COPIA os itens: ids novos, conteúdo herdado. Casar por id
-- marcaria tudo como trocado.
-- ----------------------------------------------------------------------------

create or replace function appintura2.diff_orcamento(p_orcamento_id uuid)
returns table (
  situacao          text,
  descricao         text,
  quantidade_antes  numeric,
  quantidade_depois numeric,
  valor_antes       numeric,
  valor_depois      numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with anterior as (
    select i.descricao, i.quantidade, i.valor_total
    from appintura2.orcamento_itens i
    join appintura2.orcamentos o on o.id = i.orcamento_id
    where o.id = (select orcamento_versao_anterior_id
                    from appintura2.orcamentos where id = p_orcamento_id)
  ),
  atual as (
    select i.descricao, i.quantidade, i.valor_total
    from appintura2.orcamento_itens i
    where i.orcamento_id = p_orcamento_id
  )
  select
    case
      when a.descricao is null then 'incluido'
      when b.descricao is null then 'removido'
      when a.quantidade is distinct from b.quantidade
        or a.valor_total is distinct from b.valor_total then 'alterado'
      else 'igual'
    end as situacao,
    coalesce(b.descricao, a.descricao),
    a.quantidade, b.quantidade,
    a.valor_total, b.valor_total
  from anterior a
  full outer join atual b on b.descricao = a.descricao
  order by 1, 2
$$;

grant execute on function appintura2.diff_orcamento(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Funil comercial
--
-- `security_invoker`: o RLS de `orcamentos` decide o que cada usuário soma. Sem
-- isso a view rodaria como dona e mostraria o funil de todas as empresas.
--
-- Tempo de decisão vem dos EVENTOS, não de `updated_at`: qualquer edição
-- posterior mexeria no updated_at e falsearia a métrica.
-- ----------------------------------------------------------------------------

create or replace view appintura2.vw_funil_orcamentos
with (security_invoker = true)
as
select
  o.tenant_id,
  date_trunc('month', o.created_at)::date as mes,
  o.vendedor_id,
  count(*)                                                     as propostos,
  count(*) filter (where o.status in ('aprovado', 'aprovado_parcial', 'convertido')) as ganhos,
  count(*) filter (where o.status = 'rejeitado')               as perdidos,
  count(*) filter (where o.status = 'expirado')                as expirados,
  count(*) filter (where o.status in ('enviado', 'visualizado', 'alteracao_solicitada')) as em_aberto,
  sum(o.valor_total)                                           as valor_proposto,
  coalesce(sum(o.valor_aprovado), 0)                           as valor_fechado,
  -- Percentual sobre o que FOI DECIDIDO. Incluir os em aberto no denominador
  -- afundaria a taxa do mês corrente sem motivo.
  round(
    100.0 * count(*) filter (where o.status in ('aprovado', 'aprovado_parcial', 'convertido'))
    / nullif(count(*) filter (where o.status in
        ('aprovado', 'aprovado_parcial', 'convertido', 'rejeitado', 'expirado')), 0),
    1
  ) as taxa_aprovacao,
  avg(
    extract(epoch from (
      (select min(e.created_at) from appintura2.orcamento_eventos e
        where e.orcamento_id = o.id
          and e.tipo in ('aprovado', 'aprovado_parcial', 'rejeitado'))
      -
      (select min(e.created_at) from appintura2.orcamento_eventos e
        where e.orcamento_id = o.id and e.tipo = 'enviado')
    )) / 86400.0
  ) as dias_ate_decisao
from appintura2.orcamentos o
where o.deleted_at is null
group by o.tenant_id, date_trunc('month', o.created_at), o.vendedor_id;

comment on view appintura2.vw_funil_orcamentos is
  'Funil comercial por mes e vendedor. Taxa calculada so sobre orcamentos ja decididos.';

-- Motivos de recusa: o texto que o cliente escreveu ao recusar ou pedir
-- alteração. É dado qualitativo e vive nos eventos, não numa coluna de status.
create or replace view appintura2.vw_motivos_recusa
with (security_invoker = true)
as
select
  e.tenant_id,
  e.orcamento_id,
  o.numero        as orcamento_numero,
  o.cliente_id,
  e.tipo,
  e.autor_nome,
  e.metadata ->> 'mensagem' as motivo,
  e.created_at
from appintura2.orcamento_eventos e
join appintura2.orcamentos o on o.id = e.orcamento_id
where e.tipo in ('rejeitado', 'alteracao_solicitada')
  and coalesce(e.metadata ->> 'mensagem', '') <> '';

insert into appintura2.schema_migrations (version, name)
values ('20260917230000', 'appintura2_orcamento_fase5')
on conflict (version) do nothing;

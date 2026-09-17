-- ============================================================================
-- APPintura — Orçamento: portal público, decisão do cliente e conversão em OS
--
-- Depende de 20260917190000_appintura2_orcamentos_regras.sql.
--
-- Tudo aqui é SECURITY DEFINER e REVOGADO de `anon` e `authenticated`: só
-- `service_role` executa, e quem chama é a Edge Function depois de validar o
-- token. Nenhuma policy permissiva é aberta em tabela de negócio para atender o
-- cliente sem login — a superfície pública fica inteira do lado da função.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Consulta pública
--
-- Recebe o HASH do token (a Edge Function calcula), não o token. Devolve
-- exatamente o que o cliente precisa ver e nada além: `observacoes_internas`
-- não está no select, e é por isso que ela não vaza mesmo se a tela pedir.
-- ----------------------------------------------------------------------------

create or replace function appintura2.consultar_orcamento_publico(
  p_token_hash text,
  p_ip         text default '',
  p_user_agent text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_link appintura2.orcamento_links%rowtype;
  v_orc  appintura2.orcamentos%rowtype;
  v_resp jsonb;
begin
  select * into v_link
  from appintura2.orcamento_links
  where token_hash = p_token_hash;

  -- Motivo nunca é detalhado para fora: "não existe", "revogado" e "expirado"
  -- respondem igual, senão o portal vira um oráculo para sondar tokens.
  if not found or v_link.revogado or v_link.expira_em <= now() then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end if;

  select * into v_orc
  from appintura2.orcamentos
  where id = v_link.orcamento_id and deleted_at is null;

  if not found or v_orc.status in ('revisado', 'expirado') then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end if;

  -- Primeiro acesso vira evento e move o status. Reabrir o link depois não
  -- gera evento novo: a informação útil é "o cliente viu", não quantas vezes.
  if v_orc.status = 'enviado' then
    update appintura2.orcamentos set status = 'visualizado' where id = v_orc.id;
    perform appintura2.registrar_evento_orcamento(
      v_orc.id, 'visualizado', p_ip => p_ip, p_user_agent => p_user_agent);
    v_orc.status := 'visualizado';
  end if;

  select jsonb_build_object(
    'ok', true,
    'decidido', v_link.usado_em is not null,
    'orcamento', jsonb_build_object(
      'numero', v_orc.numero,
      'status', v_orc.status,
      'data_validade', v_orc.data_validade,
      'vencido', v_orc.data_validade < current_date,
      'condicoes_pagamento', v_orc.condicoes_pagamento,
      'prazo_entrega_dias', v_orc.prazo_entrega_dias,
      'valor_total', v_orc.valor_total,
      'observacoes_cliente', v_orc.observacoes_cliente,
      'cor', (select c.codigo_ral || ' — ' || c.nome_comercial
                from appintura2.cores c where c.id = v_orc.cor_id),
      'espessura', v_orc.espessura_min_micron || ' a ' || v_orc.espessura_max_micron || ' µm'
    ),
    'empresa', (select jsonb_build_object('nome', t.nome_fantasia, 'cnpj', t.cnpj)
                  from appintura2.tenants t where t.id = v_orc.tenant_id),
    'cliente', (select jsonb_build_object('nome', cl.razao_social)
                  from appintura2.clientes cl where cl.id = v_orc.cliente_id),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descricao', i.descricao,
        'tipo_acabamento', i.tipo_acabamento,
        'quantidade', i.quantidade,
        'area_m2', i.area_m2,
        'valor_unitario', i.valor_unitario,
        'valor_total', i.valor_total
      ) order by i.ordem, i.descricao)
      from appintura2.orcamento_itens i where i.orcamento_id = v_orc.id), '[]'::jsonb),
    'anexos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', a.nome, 'path', a.storage_path, 'tipo', a.tipo))
      from appintura2.orcamento_anexos a where a.orcamento_id = v_orc.id), '[]'::jsonb)
  ) into v_resp;

  return v_resp;
end
$$;

revoke all on function appintura2.consultar_orcamento_publico(text, text, text)
  from public, anon, authenticated;
grant execute on function appintura2.consultar_orcamento_publico(text, text, text)
  to service_role;

-- ----------------------------------------------------------------------------
-- Conversão em Ordem de Serviço
--
-- Roda DENTRO da transação da aprovação: ou o orçamento vira OS, ou a aprovação
-- inteira é desfeita. Um orçamento aprovado sem OS seria um pedido que ninguém
-- vê na produção.
--
-- A OS nasce sem romaneio — as peças ainda não chegaram. O trigger
-- `ordens_servico_exigir_romaneio` impede que ela avance de 'recebido' até a
-- conferência vincular o romaneio.
-- ----------------------------------------------------------------------------

create or replace function appintura2.converter_orcamento_em_os(p_orcamento_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_orc appintura2.orcamentos%rowtype;
  v_os  uuid;
begin
  select * into v_orc
  from appintura2.orcamentos
  where id = p_orcamento_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;

  -- Idempotência: reprocessar uma conversão já feita devolve a mesma OS em vez
  -- de criar uma segunda. Protege contra retry de rede e duplo clique.
  if v_orc.os_id is not null then
    return v_orc.os_id;
  end if;

  insert into appintura2.ordens_servico (
    tenant_id, cliente_id, romaneio_recebimento_id, data_entrada, previsao_entrega,
    urgencia, status, cor_id, espessura_min_micron, espessura_max_micron,
    tipo_pretratamento, observacao, orcamento_id, origem
  )
  values (
    v_orc.tenant_id, v_orc.cliente_id, null, now(),
    now() + make_interval(days => greatest(v_orc.prazo_entrega_dias, 1)),
    'normal', 'recebido', v_orc.cor_id,
    v_orc.espessura_min_micron, v_orc.espessura_max_micron,
    v_orc.tipo_pretratamento, v_orc.observacoes_cliente,
    v_orc.id, 'orcamento'
  )
  returning id into v_os;

  -- SNAPSHOT, não referência: o que a produção vai fabricar é o que foi
  -- acordado, mesmo que o orçamento seja revisado depois.
  insert into appintura2.os_itens (os_id, descricao, quantidade, area_m2)
  select v_os, i.descricao, i.quantidade, i.area_m2
  from appintura2.orcamento_itens i
  where i.orcamento_id = v_orc.id;

  update appintura2.orcamentos
     set os_id = v_os, status = 'convertido'
   where id = v_orc.id;

  perform appintura2.registrar_evento_orcamento(
    v_orc.id, 'convertido', p_metadata => jsonb_build_object('os_id', v_os));

  return v_os;
end
$$;

revoke all on function appintura2.converter_orcamento_em_os(uuid)
  from public, anon, authenticated;
grant execute on function appintura2.converter_orcamento_em_os(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- Decisão do cliente
--
-- Idempotente por desenho: um link decide UMA vez. Segunda chamada devolve o
-- que já foi registrado, sem criar segunda OS — duplo clique e retry de rede
-- são o caso comum, não a exceção.
-- ----------------------------------------------------------------------------

create or replace function appintura2.decidir_orcamento_publico(
  p_token_hash     text,
  p_decisao        text,
  p_autor_nome     text default '',
  p_autor_documento text default '',
  p_mensagem       text default '',
  p_ip             text default '',
  p_user_agent     text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_link appintura2.orcamento_links%rowtype;
  v_orc  appintura2.orcamentos%rowtype;
  v_os   uuid;
begin
  if p_decisao not in ('aprovado', 'rejeitado', 'alteracao_solicitada') then
    return jsonb_build_object('ok', false, 'motivo', 'decisao_invalida');
  end if;

  -- `for update` serializa duas requisições simultâneas do mesmo link: a
  -- segunda espera e encontra `usado_em` já preenchido.
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
    return jsonb_build_object(
      'ok', true, 'repetido', true,
      'decisao', v_orc.status, 'numero', v_orc.numero);
  end if;

  -- Proposta vencida não vira negócio: o preço de hoje não é o de 30 dias
  -- atrás. O evento gravado é `expirado`, não `aprovado`.
  if v_orc.data_validade < current_date then
    update appintura2.orcamentos set status = 'expirado' where id = v_orc.id;
    update appintura2.orcamento_links set revogado = true where id = v_link.id;
    perform appintura2.registrar_evento_orcamento(
      v_orc.id, 'expirado', p_ip => p_ip, p_user_agent => p_user_agent,
      p_metadata => jsonb_build_object('tentativa', p_decisao));

    return jsonb_build_object('ok', false, 'motivo', 'vencido');
  end if;

  -- "Solicitar alteração" não é decisão final: o link segue valendo para o
  -- cliente decidir depois, e o vendedor é notificado.
  if p_decisao = 'alteracao_solicitada' then
    update appintura2.orcamentos
       set status = 'alteracao_solicitada' where id = v_orc.id;
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

  update appintura2.orcamentos
     set status = p_decisao::appintura2.status_orcamento
   where id = v_orc.id;

  perform appintura2.registrar_evento_orcamento(
    v_orc.id, p_decisao::appintura2.evento_orcamento,
    p_autor_nome, p_autor_documento, p_ip, p_user_agent,
    jsonb_build_object('mensagem', coalesce(p_mensagem, '')));

  if p_decisao = 'rejeitado' then
    return jsonb_build_object('ok', true, 'decisao', 'rejeitado', 'numero', v_orc.numero);
  end if;

  -- Mesma transação: se a conversão falhar, a aprovação inteira volta atrás e
  -- o cliente vê erro em vez de um "aprovado" que não produziu nada.
  v_os := appintura2.converter_orcamento_em_os(v_orc.id);

  return jsonb_build_object('ok', true, 'decisao', 'aprovado',
                            'numero', v_orc.numero, 'os_id', v_os);
end
$$;

revoke all on function appintura2.decidir_orcamento_publico(text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function appintura2.decidir_orcamento_publico(text, text, text, text, text, text, text)
  to service_role;

-- ----------------------------------------------------------------------------
-- Expiração (job diário)
--
-- Roda como varredura, e não só na hora do acesso, porque o painel interno
-- precisa mostrar o status certo mesmo para o orçamento que o cliente nunca
-- abriu — que é justamente o caso mais comum de expiração.
-- ----------------------------------------------------------------------------

create or replace function appintura2.expirar_orcamentos()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_conta integer := 0;
begin
  for v_id in
    select id from appintura2.orcamentos
    where status in ('enviado', 'visualizado', 'alteracao_solicitada')
      and data_validade < current_date
      and deleted_at is null
  loop
    update appintura2.orcamentos set status = 'expirado' where id = v_id;
    update appintura2.orcamento_links
       set revogado = true where orcamento_id = v_id and usado_em is null;
    perform appintura2.registrar_evento_orcamento(v_id, 'expirado');
    v_conta := v_conta + 1;
  end loop;

  return v_conta;
end
$$;

revoke all on function appintura2.expirar_orcamentos() from public, anon, authenticated;
grant execute on function appintura2.expirar_orcamentos() to service_role;

-- ----------------------------------------------------------------------------
-- Storage dos anexos
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'appintura2-orcamento-anexos',
  'appintura2-orcamento-anexos',
  false,
  10485760, -- 10 MB: desenho técnico costuma ser maior que foto de peça
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "appintura2_orcamento_anexos_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'appintura2-orcamento-anexos'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from appintura2.get_user_tenant_ids() as tenant_id
    )
  );

create policy "appintura2_orcamento_anexos_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'appintura2-orcamento-anexos'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from appintura2.get_user_tenant_ids() as tenant_id
    )
  );

-- Anexo de orçamento em rascunho ainda é rascunho: pode ser trocado.
create policy "appintura2_orcamento_anexos_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'appintura2-orcamento-anexos'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from appintura2.get_user_tenant_ids() as tenant_id
    )
  );

notify pgrst, 'reload schema';

insert into appintura2.schema_migrations (version, name)
values
  ('20260917180000', 'appintura2_orcamentos'),
  ('20260917190000', 'appintura2_orcamentos_regras'),
  ('20260917200000', 'appintura2_orcamentos_publico')
on conflict (version) do nothing;

-- ============================================================================
-- APPintura — consulta pública devolve o id de cada item
--
-- Depende de 20260917230000_appintura2_orcamento_fase5.sql.
--
-- A aprovação parcial exige que o portal diga QUAIS itens o cliente aceitou, e
-- para isso ele precisa dos ids. Expor o uuid do item aqui não abre nada: ele
-- só é aceito acompanhado do token, e a RPC confere que o item pertence ao
-- orçamento daquele token antes de marcar qualquer coisa.
-- ============================================================================

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

  if not found or v_link.revogado or v_link.expira_em <= now() then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end if;

  select * into v_orc
  from appintura2.orcamentos
  where id = v_link.orcamento_id and deleted_at is null;

  if not found or v_orc.status in ('revisado', 'expirado') then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end if;

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
      'valor_aprovado', v_orc.valor_aprovado,
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
        'id', i.id,
        'descricao', i.descricao,
        'tipo_acabamento', i.tipo_acabamento,
        'quantidade', i.quantidade,
        'area_m2', i.area_m2,
        'valor_unitario', i.valor_unitario,
        'valor_total', i.valor_total,
        'aprovado', i.aprovado
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
-- Guarda: item de outro orçamento não pode ser marcado
--
-- O portal manda uma lista de ids. Sem esta checagem, um cliente mal
-- intencionado poderia mandar o id de um item de OUTRO orçamento e desmarcar
-- todos os do dele — o `set aprovado = (id = any(...))` marcaria tudo como
-- false e a decisão viraria recusa silenciosa.
-- ----------------------------------------------------------------------------

create or replace function appintura2.itens_pertencem_ao_orcamento(
  p_orcamento_id uuid,
  p_itens        uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_itens is null or not exists (
    select 1 from unnest(p_itens) as informado(id)
    where informado.id not in (
      select i.id from appintura2.orcamento_itens i where i.orcamento_id = p_orcamento_id
    )
  )
$$;

revoke all on function appintura2.itens_pertencem_ao_orcamento(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function appintura2.itens_pertencem_ao_orcamento(uuid, uuid[]) to service_role;

-- ----------------------------------------------------------------------------
-- A decisao passa a recusar lista de itens que nao seja do proprio orcamento
-- ----------------------------------------------------------------------------

create or replace function appintura2.marcar_itens_aprovados(
  p_orcamento_id uuid,
  p_itens        uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_itens is null then
    return;
  end if;

  if not appintura2.itens_pertencem_ao_orcamento(p_orcamento_id, p_itens) then
    raise exception 'Lista de itens invalida para este orcamento.' using errcode = '22023';
  end if;

  update appintura2.orcamento_itens
     set aprovado = (id = any (p_itens))
   where orcamento_id = p_orcamento_id;
end
$$;

revoke all on function appintura2.marcar_itens_aprovados(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function appintura2.marcar_itens_aprovados(uuid, uuid[]) to service_role;

insert into appintura2.schema_migrations (version, name)
values ('20260917240000', 'appintura2_orcamento_publico_itens')
on conflict (version) do nothing;


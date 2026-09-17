-- ============================================================================
-- APPintura — Orçamento: RLS, gravação, link público e conversão em OS
--
-- Depende de 20260917180000_appintura2_orcamentos.sql.
--
-- Separação das funções em dois regimes, e a distinção é o ponto de segurança
-- do módulo inteiro:
--
--   INTERNAS  — SECURITY DEFINER, mas validam tenant e papel na primeira
--               linha. São definer porque `orcamentos` não tem policy de
--               escrita: as regras de imutabilidade por status vivem nelas, e
--               um UPDATE direto do client passaria por cima de todas.
--   PÚBLICAS  — SECURITY DEFINER, revogadas de `anon` e `authenticated`, só
--               `service_role` executa. Quem as chama é a Edge Function, que
--               valida o token ANTES. Nenhuma policy permissiva é aberta em
--               tabela de negócio para atender o portal do cliente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Permissão de módulo
--
-- Orçamento é comercial: admin e gestor de produção mexem. Operador de cabine,
-- qualidade e portaria não têm por que ver preço de venda.
-- ----------------------------------------------------------------------------

create or replace function appintura2.pode_gerenciar_orcamento(p_tenant_id uuid)
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
      and ur.tenant_id = p_tenant_id
      and ur.status = 'ativo'
      and ur.role in ('admin', 'gestor_producao', 'financeiro')
  )
$$;

grant execute on function appintura2.pode_gerenciar_orcamento(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table appintura2.orcamentos enable row level security;
alter table appintura2.orcamento_itens enable row level security;
alter table appintura2.orcamento_anexos enable row level security;
alter table appintura2.orcamento_links enable row level security;
alter table appintura2.orcamento_eventos enable row level security;

create policy "orcamentos_select"
  on appintura2.orcamentos for select to authenticated
  using (
    tenant_id in (select appintura2.get_user_tenant_ids())
    and appintura2.pode_gerenciar_orcamento(tenant_id)
  );

-- INSERT/UPDATE/DELETE não têm policy: toda escrita passa pelas RPCs abaixo,
-- que são o lugar onde as regras de imutabilidade por status vivem. Sem isso o
-- client poderia dar UPDATE direto num orçamento já aprovado.

create policy "orcamento_itens_select"
  on appintura2.orcamento_itens for select to authenticated
  using (
    exists (
      select 1 from appintura2.orcamentos o
      where o.id = orcamento_itens.orcamento_id
        and o.tenant_id in (select appintura2.get_user_tenant_ids())
        and appintura2.pode_gerenciar_orcamento(o.tenant_id)
    )
  );

create policy "orcamento_anexos_select"
  on appintura2.orcamento_anexos for select to authenticated
  using (
    tenant_id in (select appintura2.get_user_tenant_ids())
    and appintura2.pode_gerenciar_orcamento(tenant_id)
  );

create policy "orcamento_anexos_insert"
  on appintura2.orcamento_anexos for insert to authenticated
  with check (appintura2.pode_gerenciar_orcamento(tenant_id));

create policy "orcamento_anexos_delete"
  on appintura2.orcamento_anexos for delete to authenticated
  using (
    appintura2.pode_gerenciar_orcamento(tenant_id)
    and exists (
      select 1 from appintura2.orcamentos o
      where o.id = orcamento_anexos.orcamento_id and o.status = 'rascunho'
    )
  );

create policy "orcamento_links_select"
  on appintura2.orcamento_links for select to authenticated
  using (
    tenant_id in (select appintura2.get_user_tenant_ids())
    and appintura2.pode_gerenciar_orcamento(tenant_id)
  );

-- Eventos: leitura pela timeline, e MAIS NADA. Sem insert/update/delete para
-- `authenticated` — quem grava é sempre uma função SECURITY DEFINER. Uma trilha
-- que o próprio interessado pode editar não serve como prova.
create policy "orcamento_eventos_select"
  on appintura2.orcamento_eventos for select to authenticated
  using (
    tenant_id in (select appintura2.get_user_tenant_ids())
    and appintura2.pode_gerenciar_orcamento(tenant_id)
  );

-- ----------------------------------------------------------------------------
-- Registro de evento (uso interno das funções abaixo)
-- ----------------------------------------------------------------------------

create or replace function appintura2.registrar_evento_orcamento(
  p_orcamento_id uuid,
  p_tipo         appintura2.evento_orcamento,
  p_autor_nome   text default '',
  p_autor_doc    text default '',
  p_ip           text default '',
  p_user_agent   text default '',
  p_metadata     jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into appintura2.orcamento_eventos (
    tenant_id, orcamento_id, tipo, usuario_id,
    autor_nome, autor_documento, ip, user_agent, metadata
  )
  select
    o.tenant_id, o.id, p_tipo, appintura2.usuario_atual(),
    coalesce(p_autor_nome, ''), coalesce(p_autor_doc, ''),
    coalesce(p_ip, ''), coalesce(p_user_agent, ''), coalesce(p_metadata, '{}'::jsonb)
  from appintura2.orcamentos o
  where o.id = p_orcamento_id
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function appintura2.registrar_evento_orcamento(uuid, appintura2.evento_orcamento, text, text, text, text, jsonb)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Gravação do orçamento (Fase 1)
--
-- Só mexe em `rascunho`. Depois de enviado o documento saiu da empresa, e
-- editá-lo em silêncio faria o painel interno divergir do papel que o cliente
-- tem na mão — por isso alteração vira revisão, nunca update.
-- ----------------------------------------------------------------------------

create or replace function appintura2.salvar_orcamento(
  p_tenant_id uuid,
  p_dados     jsonb,
  p_itens     jsonb,
  p_id        uuid default null
)
returns uuid
language plpgsql
volatile
-- SECURITY DEFINER porque `orcamentos` nao tem policy de INSERT/UPDATE: toda
-- escrita passa por aqui, que e onde a imutabilidade por status e checada. A
-- funcao valida tenant e papel logo na primeira linha, antes de tocar em nada.
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_status appintura2.status_orcamento;
begin
  perform appintura2.exigir_tenant(p_tenant_id);

  if not appintura2.pode_gerenciar_orcamento(p_tenant_id) then
    raise exception 'Seu papel não permite gerenciar orçamentos.'
      using errcode = '42501';
  end if;

  if p_id is null then
    insert into appintura2.orcamentos (
      tenant_id, cliente_id, vendedor_id, data_validade,
      condicoes_pagamento, prazo_entrega_dias,
      cor_id, espessura_min_micron, espessura_max_micron, tipo_pretratamento,
      observacoes_internas, observacoes_cliente, orcamento_versao_anterior_id
    )
    values (
      p_tenant_id,
      (p_dados ->> 'cliente_id')::uuid,
      -- O vendedor é sempre quem está logado. Vindo do corpo, bastaria trocar o
      -- id para assinar um orçamento no nome de outra pessoa.
      appintura2.usuario_atual(),
      (p_dados ->> 'data_validade')::date,
      coalesce(p_dados ->> 'condicoes_pagamento', ''),
      coalesce((p_dados ->> 'prazo_entrega_dias')::integer, 0),
      (p_dados ->> 'cor_id')::uuid,
      (p_dados ->> 'espessura_min_micron')::numeric,
      (p_dados ->> 'espessura_max_micron')::numeric,
      coalesce((p_dados ->> 'tipo_pretratamento')::appintura2.tipo_pretratamento, 'desengraxe'),
      coalesce(p_dados ->> 'observacoes_internas', ''),
      coalesce(p_dados ->> 'observacoes_cliente', ''),
      nullif(p_dados ->> 'orcamento_versao_anterior_id', '')::uuid
    )
    returning id into v_id;

    perform appintura2.registrar_evento_orcamento(v_id, 'criado');
  else
    select status into v_status
    from appintura2.orcamentos
    where id = p_id and tenant_id = p_tenant_id and deleted_at is null;

    if not found then
      raise exception 'Orçamento não encontrado nesta empresa.' using errcode = 'P0002';
    end if;

    if v_status <> 'rascunho' then
      raise exception
        'Este orçamento já foi enviado ao cliente e não pode ser editado. Crie uma revisão.'
        using errcode = '42501';
    end if;

    update appintura2.orcamentos
       set cliente_id = case when p_dados ? 'cliente_id'
             then (p_dados ->> 'cliente_id')::uuid else cliente_id end,
           data_validade = case when p_dados ? 'data_validade'
             then (p_dados ->> 'data_validade')::date else data_validade end,
           condicoes_pagamento = case when p_dados ? 'condicoes_pagamento'
             then coalesce(p_dados ->> 'condicoes_pagamento', '') else condicoes_pagamento end,
           prazo_entrega_dias = case when p_dados ? 'prazo_entrega_dias'
             then coalesce((p_dados ->> 'prazo_entrega_dias')::integer, 0) else prazo_entrega_dias end,
           cor_id = case when p_dados ? 'cor_id'
             then (p_dados ->> 'cor_id')::uuid else cor_id end,
           espessura_min_micron = case when p_dados ? 'espessura_min_micron'
             then (p_dados ->> 'espessura_min_micron')::numeric else espessura_min_micron end,
           espessura_max_micron = case when p_dados ? 'espessura_max_micron'
             then (p_dados ->> 'espessura_max_micron')::numeric else espessura_max_micron end,
           tipo_pretratamento = case when p_dados ? 'tipo_pretratamento'
             then (p_dados ->> 'tipo_pretratamento')::appintura2.tipo_pretratamento
             else tipo_pretratamento end,
           observacoes_internas = case when p_dados ? 'observacoes_internas'
             then coalesce(p_dados ->> 'observacoes_internas', '') else observacoes_internas end,
           observacoes_cliente = case when p_dados ? 'observacoes_cliente'
             then coalesce(p_dados ->> 'observacoes_cliente', '') else observacoes_cliente end
     where id = p_id
    returning id into v_id;
  end if;

  -- `p_itens` nulo = não mexe nos itens; `[]` = esvazia. Mesma convenção das
  -- outras RPCs do schema.
  if p_itens is not null then
    delete from appintura2.orcamento_itens where orcamento_id = v_id;

    insert into appintura2.orcamento_itens
      (orcamento_id, descricao, tipo_acabamento, quantidade, area_m2,
       valor_unitario, valor_total, ordem)
    select
      v_id,
      item ->> 'descricao',
      coalesce(item ->> 'tipo_acabamento', ''),
      (item ->> 'quantidade')::numeric,
      coalesce((item ->> 'area_m2')::numeric, 0),
      (item ->> 'valor_unitario')::numeric,
      -- Total recalculado no banco, não aceito do cliente: o valor que vai ao
      -- cliente não pode depender de aritmética feita no navegador.
      round((item ->> 'quantidade')::numeric * (item ->> 'valor_unitario')::numeric, 2),
      coalesce((item ->> 'ordem')::integer, ordinalidade::integer)
    from jsonb_array_elements(p_itens) with ordinality as t(item, ordinalidade);

    update appintura2.orcamentos
       set valor_total = coalesce(
             (select sum(i.valor_total) from appintura2.orcamento_itens i
               where i.orcamento_id = v_id), 0)
     where id = v_id;
  end if;

  return v_id;
end
$$;

revoke all on function appintura2.salvar_orcamento(uuid, jsonb, jsonb, uuid) from public, anon;
grant execute on function appintura2.salvar_orcamento(uuid, jsonb, jsonb, uuid)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Envio: registra o link (Fase 2)
--
-- O token em claro é gerado na Edge Function e NUNCA chega aqui — só o hash.
-- Assim nem o banco nem os logs do Postgres têm como reconstruir o link.
-- ----------------------------------------------------------------------------

create or replace function appintura2.registrar_link_orcamento(
  p_orcamento_id uuid,
  p_token_hash   text,
  p_dias_validade integer default 15
)
returns uuid
language plpgsql
volatile
-- SECURITY DEFINER porque `orcamentos` nao tem policy de INSERT/UPDATE: toda
-- escrita passa por aqui, que e onde a imutabilidade por status e checada. A
-- funcao valida tenant e papel logo na primeira linha, antes de tocar em nada.
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_status appintura2.status_orcamento;
  v_link   uuid;
begin
  select tenant_id, status into v_tenant, v_status
  from appintura2.orcamentos
  where id = p_orcamento_id and deleted_at is null;

  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;

  if not appintura2.pode_gerenciar_orcamento(v_tenant) then
    raise exception 'Seu papel não permite enviar orçamentos.' using errcode = '42501';
  end if;

  if v_status not in ('rascunho', 'enviado', 'visualizado') then
    raise exception 'Este orçamento não está em condição de ser enviado.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from appintura2.orcamento_itens where orcamento_id = p_orcamento_id) then
    raise exception 'Adicione ao menos um item antes de enviar ao cliente.'
      using errcode = '23514';
  end if;

  -- Reenvio gera link novo e derruba o anterior: se o e-mail antigo vazar, o
  -- link que ele carrega já não decide nada.
  update appintura2.orcamento_links
     set revogado = true
   where orcamento_id = p_orcamento_id and usado_em is null and not revogado;

  insert into appintura2.orcamento_links (tenant_id, orcamento_id, token_hash, expira_em)
  values (v_tenant, p_orcamento_id, p_token_hash,
          now() + make_interval(days => greatest(p_dias_validade, 1)))
  returning id into v_link;

  update appintura2.orcamentos set status = 'enviado' where id = p_orcamento_id;

  perform appintura2.registrar_evento_orcamento(p_orcamento_id, 'enviado');

  return v_link;
end
$$;

revoke all on function appintura2.registrar_link_orcamento(uuid, text, integer) from public, anon;
grant execute on function appintura2.registrar_link_orcamento(uuid, text, integer)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Revisão: nova versão a partir de um orçamento existente
-- ----------------------------------------------------------------------------

create or replace function appintura2.revisar_orcamento(p_orcamento_id uuid)
returns uuid
language plpgsql
volatile
-- SECURITY DEFINER porque `orcamentos` nao tem policy de INSERT/UPDATE: toda
-- escrita passa por aqui, que e onde a imutabilidade por status e checada. A
-- funcao valida tenant e papel logo na primeira linha, antes de tocar em nada.
security definer
set search_path = ''
as $$
declare
  v_antigo appintura2.orcamentos%rowtype;
  v_novo   uuid;
begin
  select * into v_antigo
  from appintura2.orcamentos
  where id = p_orcamento_id and deleted_at is null;

  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;

  if not appintura2.pode_gerenciar_orcamento(v_antigo.tenant_id) then
    raise exception 'Seu papel não permite gerenciar orçamentos.' using errcode = '42501';
  end if;

  if v_antigo.status = 'convertido' then
    raise exception 'Este orçamento já virou ordem de serviço e não pode ser revisado.'
      using errcode = '42501';
  end if;

  insert into appintura2.orcamentos (
    tenant_id, cliente_id, vendedor_id, data_validade, condicoes_pagamento,
    prazo_entrega_dias, cor_id, espessura_min_micron, espessura_max_micron,
    tipo_pretratamento, observacoes_internas, observacoes_cliente,
    orcamento_versao_anterior_id
  )
  values (
    v_antigo.tenant_id, v_antigo.cliente_id, appintura2.usuario_atual(),
    v_antigo.data_validade, v_antigo.condicoes_pagamento, v_antigo.prazo_entrega_dias,
    v_antigo.cor_id, v_antigo.espessura_min_micron, v_antigo.espessura_max_micron,
    v_antigo.tipo_pretratamento, v_antigo.observacoes_internas,
    v_antigo.observacoes_cliente, v_antigo.id
  )
  returning id into v_novo;

  insert into appintura2.orcamento_itens
    (orcamento_id, descricao, tipo_acabamento, quantidade, area_m2,
     valor_unitario, valor_total, ordem)
  select v_novo, i.descricao, i.tipo_acabamento, i.quantidade, i.area_m2,
         i.valor_unitario, i.valor_total, i.ordem
  from appintura2.orcamento_itens i
  where i.orcamento_id = v_antigo.id;

  update appintura2.orcamentos set valor_total = v_antigo.valor_total where id = v_novo;

  -- O link da versão anterior morre aqui: o cliente não pode aprovar um preço
  -- que já foi substituído.
  update appintura2.orcamento_links
     set revogado = true
   where orcamento_id = v_antigo.id and usado_em is null;

  update appintura2.orcamentos set status = 'revisado' where id = v_antigo.id;

  perform appintura2.registrar_evento_orcamento(v_antigo.id, 'revisado',
    p_metadata => jsonb_build_object('nova_versao_id', v_novo));
  perform appintura2.registrar_evento_orcamento(v_novo, 'criado',
    p_metadata => jsonb_build_object('revisao_de', v_antigo.id));

  return v_novo;
end
$$;

revoke all on function appintura2.revisar_orcamento(uuid) from public, anon;
grant execute on function appintura2.revisar_orcamento(uuid) to authenticated, service_role;

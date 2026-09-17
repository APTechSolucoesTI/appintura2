-- ============================================================================
-- APPintura — gravação transacional dos agregados
--
-- Depende das migrations das Fases 0 a 7.
--
-- PostgREST LÊ aninhado (`select=*,itens:romaneio_recebimento_itens(*)`) mas
-- não GRAVA aninhado. Sem estas funções, salvar um romaneio seriam duas
-- requisições: uma para o pai, outra para os itens. Se a segunda falhasse —
-- rede caindo na portaria, aba fechada — sobraria um romaneio sem carga, com
-- número sequencial já consumido, e ninguém saberia. Aqui pai e filhos entram
-- na mesma transação ou não entram.
--
-- Nem todo agregado aceita troca de filhos. `tabela_preco_itens` e `os_itens`
-- têm policy de DELETE e são substituídos por inteiro; os itens de romaneio NÃO
-- têm, porque carga conferida é prova — lá os filhos só entram na criação.
--
-- Todas recebem os filhos como `jsonb` e são SECURITY INVOKER (o padrão): rodam
-- com o papel de quem chamou, então as policies das Fases 1..5 continuam
-- valendo integralmente. Nada aqui contorna RLS.
--
-- O `tenant_id` NUNCA vem do client: é resolvido por `get_user_tenant_ids()`, e
-- a função recusa tenant fora do vínculo do usuário. Um `tenant_id` vindo do
-- corpo da requisição seria confiar no navegador para dizer de que empresa ele é.
--
-- Convenção do schema: campo de texto ausente é `''`, não NULL — as colunas são
-- NOT NULL com DEFAULT ''. Por isso aqui é `coalesce(x, '')` e não
-- `nullif(x, '')`: passar NULL explícito ANULA o default e viola a constraint.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Guarda comum
-- ----------------------------------------------------------------------------

create or replace function appintura2.exigir_tenant(p_tenant_id uuid)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_tenant_id is null
     or p_tenant_id not in (select appintura2.get_user_tenant_ids()) then
    raise exception 'Empresa inválida para este usuário.' using errcode = '42501';
  end if;

  return p_tenant_id;
end
$$;

-- ----------------------------------------------------------------------------
-- Tabela de preço + itens
-- ----------------------------------------------------------------------------

create or replace function appintura2.salvar_tabela_preco(
  p_tenant_id uuid,
  p_dados     jsonb,
  p_itens     jsonb,
  p_id        uuid default null
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform appintura2.exigir_tenant(p_tenant_id);

  if p_id is null then
    insert into appintura2.tabelas_preco (tenant_id, nome, ativa)
    values (p_tenant_id, p_dados ->> 'nome', coalesce((p_dados ->> 'ativa')::boolean, true))
    returning id into v_id;
  else
    update appintura2.tabelas_preco
       set nome  = case when p_dados ? 'nome' then p_dados ->> 'nome' else nome end,
           ativa = case when p_dados ? 'ativa'
             then (p_dados ->> 'ativa')::boolean else ativa end
     where id = p_id and tenant_id = p_tenant_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Registro não encontrado nesta empresa.' using errcode = 'P0002';
    end if;

    -- Substituição completa: a tela envia a lista inteira, e item removido lá
    -- tem de sumir aqui. Um merge por id deixaria órfão o que o usuário apagou.
  end if;

  -- `p_itens` NULO quer dizer "não mexa nos filhos"; `[]` quer dizer "a lista
  -- ficou vazia, apague tudo". Sem essa distinção qualquer update parcial —
  -- mover o card no Kanban, corrigir uma observação — apagaria os itens.
  if p_itens is not null then
    if p_id is not null then
      -- Substituição completa: a tela manda a lista inteira, então item tirado
      -- lá tem de sumir aqui. Merge por id deixaria órfão o que foi apagado.
      delete from appintura2.tabela_preco_itens where tabela_preco_id = v_id;
    end if;

    insert into appintura2.tabela_preco_itens
        (tabela_preco_id, tipo_acabamento, unidade, valor)
      select
        v_id,
        item ->> 'tipo_acabamento',
        (item ->> 'unidade')::appintura2.unidade_cobranca,
        (item ->> 'valor')::numeric
      from jsonb_array_elements(p_itens) as item;
  end if;

  return v_id;
end
$$;

-- ----------------------------------------------------------------------------
-- Romaneio de recebimento + itens
--
-- O número sequencial é gerado por trigger da Fase 2 (MAX+1 escopado por
-- tenant, dentro da transação). Não é calculado no client de propósito: dois
-- tablets na portaria pediriam o mesmo número.
-- ----------------------------------------------------------------------------

create or replace function appintura2.salvar_recebimento(
  p_tenant_id uuid,
  p_dados     jsonb,
  p_itens     jsonb,
  p_id        uuid default null
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform appintura2.exigir_tenant(p_tenant_id);

  if p_id is null then
    insert into appintura2.romaneios_recebimento (
      tenant_id, cliente_id, transportadora_id, data_hora,
      documento_numero, documento_serie, documento_chave,
      conferente_id, status, observacao, assinatura_path, assinatura_nome, os_id
    )
    values (
      p_tenant_id,
      (p_dados ->> 'cliente_id')::uuid,
      nullif(p_dados ->> 'transportadora_id', '')::uuid,
      coalesce((p_dados ->> 'data_hora')::timestamptz, now()),
      coalesce(p_dados ->> 'documento_numero', ''),
      coalesce(p_dados ->> 'documento_serie', ''),
      coalesce(p_dados ->> 'documento_chave', ''),
      -- conferente e responsavel saem SEMPRE da sessao, nunca do corpo: sao a
      -- assinatura de quem conferiu a carga.
      appintura2.usuario_atual(),
      coalesce((p_dados ->> 'status')::appintura2.status_recebimento, 'pendente_conferencia'),
      coalesce(p_dados ->> 'observacao', ''),
      nullif(p_dados ->> 'assinatura_path', ''),
      coalesce(p_dados ->> 'assinatura_nome', ''),
      nullif(p_dados ->> 'os_id', '')::uuid
    )
    returning id into v_id;
  else
    -- `p_dados ? 'campo'` testa a PRESENÇA da chave, e é diferente de testar o
    -- valor: chave ausente = não mexe; chave presente com null/'' = limpa de
    -- verdade. Um `coalesce` simples aqui impediria limpar um campo, e atribuir
    -- direto zeraria tudo que a chamada não mandou — foi o que quebrou o
    -- primeiro teste do Kanban, que só manda `status`.
    update appintura2.romaneios_recebimento
       set cliente_id = case when p_dados ? 'cliente_id'
             then (p_dados ->> 'cliente_id')::uuid else cliente_id end,
           transportadora_id = case when p_dados ? 'transportadora_id'
             then nullif(p_dados ->> 'transportadora_id', '')::uuid else transportadora_id end,
           status = case when p_dados ? 'status'
             then (p_dados ->> 'status')::appintura2.status_recebimento else status end,
           observacao = case when p_dados ? 'observacao'
             then coalesce(p_dados ->> 'observacao', '') else observacao end
     where id = p_id and tenant_id = p_tenant_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Registro não encontrado nesta empresa.' using errcode = 'P0002';
    end if;

  end if;

  -- Romaneio é documento de custódia: as policies da Fase 2 dão INSERT mas NÃO
  -- DELETE em `romaneio_recebimento_itens` de propósito — a carga conferida e assinada é prova,
  -- não rascunho. Então aqui os itens só entram na CRIAÇÃO.
  --
  -- O `raise` existe porque, sem ele, o delete bateria no RLS e apagaria zero
  -- linhas sem erro: a tela diria "salvo" e a carga continuaria a anterior.
  -- Para corrigir um recebimento emitido, emita outro.
  if p_itens is not null then
    if p_id is not null then
      raise exception 'Os itens de um romaneio já emitido não podem ser alterados. Emita um novo romaneio.'
        using errcode = '42501';
    end if;

    insert into appintura2.romaneio_recebimento_itens
        (romaneio_id, descricao, quantidade, unidade, peso_kg, condicao_chegada, observacao)
      select
        v_id,
        item ->> 'descricao',
        (item ->> 'quantidade')::numeric,
        coalesce((item ->> 'unidade')::appintura2.unidade_item, 'peca'),
        nullif(item ->> 'peso_kg', '')::numeric,
        coalesce((item ->> 'condicao_chegada')::appintura2.condicao_item, 'integra'),
        coalesce(item ->> 'observacao', '')
      from jsonb_array_elements(p_itens) as item;
  end if;

  return v_id;
end
$$;

-- ----------------------------------------------------------------------------
-- Romaneio de devolução + itens
-- ----------------------------------------------------------------------------

create or replace function appintura2.salvar_devolucao(
  p_tenant_id uuid,
  p_dados     jsonb,
  p_itens     jsonb,
  p_id        uuid default null
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform appintura2.exigir_tenant(p_tenant_id);

  if p_id is null then
    insert into appintura2.romaneios_devolucao (
      tenant_id, cliente_id, transportadora_id, data_hora,
      retirado_por_nome, retirado_por_documento, placa,
      responsavel_id, status, assinatura_path
    )
    values (
      p_tenant_id,
      (p_dados ->> 'cliente_id')::uuid,
      nullif(p_dados ->> 'transportadora_id', '')::uuid,
      coalesce((p_dados ->> 'data_hora')::timestamptz, now()),
      coalesce(p_dados ->> 'retirado_por_nome', ''),
      coalesce(p_dados ->> 'retirado_por_documento', ''),
      coalesce(p_dados ->> 'placa', ''),
      appintura2.usuario_atual(),
      coalesce((p_dados ->> 'status')::appintura2.status_devolucao, 'aguardando_retirada'),
      nullif(p_dados ->> 'assinatura_path', '')
    )
    returning id into v_id;
  else
    update appintura2.romaneios_devolucao
       set status = case when p_dados ? 'status'
             then (p_dados ->> 'status')::appintura2.status_devolucao else status end
     where id = p_id and tenant_id = p_tenant_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Registro não encontrado nesta empresa.' using errcode = 'P0002';
    end if;

  end if;

  -- `recebimento_item_id` e NOT NULL de proposito: devolucao sempre aponta
  -- para o item recebido que ela baixa. E o que sustenta o saldo de custodia.
  -- Romaneio é documento de custódia: as policies da Fase 2 dão INSERT mas NÃO
  -- DELETE em `romaneio_devolucao_itens` de propósito — a carga conferida e assinada é prova,
  -- não rascunho. Então aqui os itens só entram na CRIAÇÃO.
  --
  -- O `raise` existe porque, sem ele, o delete bateria no RLS e apagaria zero
  -- linhas sem erro: a tela diria "salvo" e a carga continuaria a anterior.
  -- Para corrigir uma devolução emitido, emita outro.
  if p_itens is not null then
    if p_id is not null then
      raise exception 'Os itens de um romaneio já emitido não podem ser alterados. Emita um novo romaneio.'
        using errcode = '42501';
    end if;

    insert into appintura2.romaneio_devolucao_itens
        (devolucao_id, recebimento_item_id, quantidade, condicao_saida, justificativa)
      select
        v_id,
        (item ->> 'recebimento_item_id')::uuid,
        (item ->> 'quantidade')::numeric,
        coalesce((item ->> 'condicao_saida')::appintura2.condicao_item, 'integra'),
        coalesce(item ->> 'justificativa', '')
      from jsonb_array_elements(p_itens) as item;
  end if;

  return v_id;
end
$$;

-- ----------------------------------------------------------------------------
-- Ordem de serviço + itens
--
-- O histórico de status NÃO é tocado aqui: ele é gravado por trigger da Fase 3,
-- que é o único jeito de garantir que toda transição fique registrada mesmo
-- quando o status muda por outro caminho (Kanban, RPC, correção manual).
-- ----------------------------------------------------------------------------

create or replace function appintura2.salvar_ordem_servico(
  p_tenant_id uuid,
  p_dados     jsonb,
  p_itens     jsonb,
  p_id        uuid default null
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform appintura2.exigir_tenant(p_tenant_id);

  if p_id is null then
    insert into appintura2.ordens_servico (
      tenant_id, cliente_id, romaneio_recebimento_id, data_entrada,
      previsao_entrega, urgencia, status, cor_id,
      espessura_min_micron, espessura_max_micron,
      tipo_pretratamento, observacao
    )
    values (
      p_tenant_id,
      (p_dados ->> 'cliente_id')::uuid,
      (p_dados ->> 'romaneio_recebimento_id')::uuid,
      coalesce((p_dados ->> 'data_entrada')::timestamptz, now()),
      (p_dados ->> 'previsao_entrega')::timestamptz,
      coalesce((p_dados ->> 'urgencia')::appintura2.urgencia_os, 'normal'),
      coalesce((p_dados ->> 'status')::appintura2.status_os, 'recebido'),
      (p_dados ->> 'cor_id')::uuid,
      (p_dados ->> 'espessura_min_micron')::numeric,
      (p_dados ->> 'espessura_max_micron')::numeric,
      coalesce((p_dados ->> 'tipo_pretratamento')::appintura2.tipo_pretratamento, 'desengraxe'),
      coalesce(p_dados ->> 'observacao', '')
    )
    returning id into v_id;
  else
    -- `p_dados ? 'campo'` testa a PRESENÇA da chave, e é diferente de testar o
    -- valor: chave ausente = não mexe; chave presente com null/'' = limpa de
    -- verdade. Um `coalesce` simples aqui impediria limpar um campo, e atribuir
    -- direto zeraria tudo que a chamada não mandou — foi o que quebrou o
    -- primeiro teste do Kanban, que só manda `status`.
    update appintura2.ordens_servico
       set cliente_id = case when p_dados ? 'cliente_id'
             then (p_dados ->> 'cliente_id')::uuid else cliente_id end,
           previsao_entrega = case when p_dados ? 'previsao_entrega'
             then (p_dados ->> 'previsao_entrega')::timestamptz else previsao_entrega end,
           urgencia = case when p_dados ? 'urgencia'
             then (p_dados ->> 'urgencia')::appintura2.urgencia_os else urgencia end,
           status = case when p_dados ? 'status'
             then (p_dados ->> 'status')::appintura2.status_os else status end,
           cor_id = case when p_dados ? 'cor_id'
             then (p_dados ->> 'cor_id')::uuid else cor_id end,
           espessura_min_micron = case when p_dados ? 'espessura_min_micron'
             then (p_dados ->> 'espessura_min_micron')::numeric else espessura_min_micron end,
           espessura_max_micron = case when p_dados ? 'espessura_max_micron'
             then (p_dados ->> 'espessura_max_micron')::numeric else espessura_max_micron end,
           tipo_pretratamento = case when p_dados ? 'tipo_pretratamento'
             then (p_dados ->> 'tipo_pretratamento')::appintura2.tipo_pretratamento
             else tipo_pretratamento end,
           observacao = case when p_dados ? 'observacao'
             then coalesce(p_dados ->> 'observacao', '') else observacao end
     where id = p_id and tenant_id = p_tenant_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Registro não encontrado nesta empresa.' using errcode = 'P0002';
    end if;

  end if;

  -- `p_itens` NULO quer dizer "não mexa nos filhos"; `[]` quer dizer "a lista
  -- ficou vazia, apague tudo". Sem essa distinção qualquer update parcial —
  -- mover o card no Kanban, corrigir uma observação — apagaria os itens.
  if p_itens is not null then
    if p_id is not null then
      -- Substituição completa: a tela manda a lista inteira, então item tirado
      -- lá tem de sumir aqui. Merge por id deixaria órfão o que foi apagado.
      delete from appintura2.os_itens where os_id = v_id;
    end if;

    insert into appintura2.os_itens (os_id, descricao, quantidade, area_m2, foto_path)
      select
        v_id,
        item ->> 'descricao',
        (item ->> 'quantidade')::numeric,
        (item ->> 'area_m2')::numeric,
        nullif(item ->> 'foto_path', '')
      from jsonb_array_elements(p_itens) as item;
  end if;

  return v_id;
end
$$;

-- ----------------------------------------------------------------------------
-- Grants
--
-- `authenticated` e não `anon`: toda função depende de
-- `get_user_tenant_ids()`, que devolve vazio sem sessão — o anon já cairia no
-- `exigir_tenant`, mas não convém deixar a porta encostada.
-- ----------------------------------------------------------------------------

revoke all on function appintura2.exigir_tenant(uuid) from public, anon;
grant execute on function appintura2.exigir_tenant(uuid) to authenticated, service_role;

revoke all on function appintura2.salvar_tabela_preco(uuid, jsonb, jsonb, uuid) from public, anon;
revoke all on function appintura2.salvar_recebimento(uuid, jsonb, jsonb, uuid) from public, anon;
revoke all on function appintura2.salvar_devolucao(uuid, jsonb, jsonb, uuid) from public, anon;
revoke all on function appintura2.salvar_ordem_servico(uuid, jsonb, jsonb, uuid) from public, anon;

grant execute on function appintura2.salvar_tabela_preco(uuid, jsonb, jsonb, uuid)
  to authenticated, service_role;
grant execute on function appintura2.salvar_recebimento(uuid, jsonb, jsonb, uuid)
  to authenticated, service_role;
grant execute on function appintura2.salvar_devolucao(uuid, jsonb, jsonb, uuid)
  to authenticated, service_role;
grant execute on function appintura2.salvar_ordem_servico(uuid, jsonb, jsonb, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';

insert into appintura2.schema_migrations (version, name)
values ('20260917160000', 'appintura2_rpc_agregados')
on conflict (version) do nothing;

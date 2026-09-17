-- ============================================================================
-- APPintura — Fase 4: Estoque de insumos e Controle de Qualidade
--
-- Estoque aqui é INSUMO CONSUMÍVEL da produção (tinta em pó e químicos). Não
-- confundir com a custódia de peças de terceiros da Fase 2: lá a mercadoria é do
-- cliente e sai inteira; aqui o material é da casa e some ao ser aplicado.
--
-- Objetos no schema `appintura2`. Depende das migrations das Fases 0 a 3.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

create type appintura2.tipo_item_estoque as enum ('tinta', 'insumo_quimico');

/*
 * `perda` é tecnicamente uma saída, mas separada de propósito: misturar quebra
 * de embalagem com consumo de produção arruinaria o indicador de eficiência
 * (g/m²) da Fase 6.
 */
create type appintura2.tipo_movimento_estoque as enum ('entrada', 'saida', 'perda');

create type appintura2.motivo_perda as enum (
  'vencimento',
  'contaminacao',
  'derrame',
  'quebra_embalagem',
  'sobra_cabine',
  'outro'
);

create type appintura2.resultado_teste as enum ('aprovado', 'reprovado');

create type appintura2.tipo_nao_conformidade as enum (
  'espessura_fora_faixa',
  'aderencia',
  'casca_de_laranja',
  'escorrimento',
  'contaminacao',
  'cor_divergente',
  'outro'
);

-- ----------------------------------------------------------------------------
-- Movimentações de estoque
-- ----------------------------------------------------------------------------

create table appintura2.estoque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  tipo_item appintura2.tipo_item_estoque not null,
  /*
   * FK polimórfica: aponta para `cores` ou `insumos_quimicos` conforme
   * `tipo_item`. O Postgres não valida isso com FK, então a integridade fica na
   * trigger de saldo, que falha se o item não existir.
   */
  item_id uuid not null,
  -- Congelado: o extrato precisa continuar legível se o item for excluído.
  item_descricao text not null,
  tipo_movimento appintura2.tipo_movimento_estoque not null,
  quantidade numeric(12, 3) not null,
  unidade text not null default '',
  os_id uuid references appintura2.ordens_servico (id) on delete set null,
  lote text not null default '',
  motivo_perda appintura2.motivo_perda,
  observacao text not null default '',
  responsavel_id uuid references appintura2.usuarios (id),
  data date not null default current_date,
  created_at timestamptz not null default now(),
  constraint movimentacao_quantidade_positiva check (quantidade > 0),
  -- Perda sem motivo é perda que ninguém investiga.
  constraint movimentacao_perda_com_motivo check (
    (tipo_movimento = 'perda' and motivo_perda is not null)
    or (tipo_movimento <> 'perda' and motivo_perda is null)
  )
);

create index estoque_movimentacoes_tenant_idx
  on appintura2.estoque_movimentacoes (tenant_id, created_at desc);
create index estoque_movimentacoes_item_idx
  on appintura2.estoque_movimentacoes (item_id, created_at desc);
create index estoque_movimentacoes_os_idx
  on appintura2.estoque_movimentacoes (os_id)
  where os_id is not null;

/*
 * Saldo e movimento andam juntos.
 *
 * Com a trigger, é impossível lançar movimento sem mexer no saldo ou mexer no
 * saldo sem deixar rastro — que é exatamente o par de erros que faz o estoque
 * de uma fábrica divergir do sistema em três meses.
 */
create or replace function appintura2.aplicar_movimento_estoque()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta numeric(12, 3);
  v_saldo numeric(12, 3);
begin
  v_delta := case
    when new.tipo_movimento = 'entrada' then new.quantidade
    else -new.quantidade
  end;

  if new.tipo_item = 'tinta' then
    update appintura2.cores
      set estoque_atual = estoque_atual + v_delta
      where id = new.item_id and tenant_id = new.tenant_id
      returning estoque_atual into v_saldo;
  else
    update appintura2.insumos_quimicos
      set estoque_atual = estoque_atual + v_delta
      where id = new.item_id and tenant_id = new.tenant_id
      returning estoque_atual into v_saldo;
  end if;

  if v_saldo is null then
    raise exception 'Item % não existe nesta empresa.', new.item_id
      using errcode = 'foreign_key_violation';
  end if;

  -- Saldo negativo é sintoma de apontamento errado; barrar aqui evita que o
  -- custo por m² da Fase 5 saia de um número impossível.
  if v_saldo < 0 then
    raise exception 'Saldo insuficiente: a operação deixaria % em estoque.', v_saldo
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;

create trigger estoque_movimentacoes_aplicar
  after insert on appintura2.estoque_movimentacoes
  for each row
  execute function appintura2.aplicar_movimento_estoque();

/*
 * Baixa automática de tinta quando a OS entra em "aplicação de pó".
 *
 * Idempotente de propósito: mover o card para frente e para trás no Kanban não
 * pode lançar o mesmo consumo duas vezes.
 */
create or replace function appintura2.baixar_tinta_da_os()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area numeric(12, 3);
  v_cor appintura2.cores%rowtype;
  v_quantidade numeric(12, 3);
begin
  if new.status <> 'aplicacao_po' then
    return new;
  end if;

  if exists (
    select 1 from appintura2.estoque_movimentacoes m
    where m.os_id = new.id
      and m.tipo_movimento = 'saida'
      and m.tipo_item = 'tinta'
  ) then
    return new;
  end if;

  select coalesce(sum(area_m2), 0) into v_area
  from appintura2.os_itens where os_id = new.id;

  select * into v_cor from appintura2.cores where id = new.cor_id;

  if v_cor.id is null or v_area <= 0 then
    return new;
  end if;

  v_quantidade := round((v_area * v_cor.rendimento_teorico_g_m2) / 1000, 3);

  if v_quantidade <= 0 then
    return new;
  end if;

  insert into appintura2.estoque_movimentacoes (
    tenant_id, tipo_item, item_id, item_descricao, tipo_movimento,
    quantidade, unidade, os_id, lote, observacao, responsavel_id
  )
  values (
    new.tenant_id, 'tinta', v_cor.id,
    v_cor.codigo_ral || ' ' || v_cor.nome_comercial, 'saida',
    v_quantidade, 'kg', new.id, v_cor.lote,
    'Baixa automática na entrada em aplicação de pó.', (select appintura2.usuario_atual())
  );

  return new;
end
$$;

create trigger ordens_servico_baixar_tinta
  after update of status on appintura2.ordens_servico
  for each row
  execute function appintura2.baixar_tinta_da_os();

-- ----------------------------------------------------------------------------
-- Controle de qualidade
-- ----------------------------------------------------------------------------

create table appintura2.qualidade_registros (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  os_item_id uuid not null references appintura2.os_itens (id) on delete cascade,
  espessura_medida_micron numeric(6, 1) not null,
  /*
   * A faixa exigida é copiada da OS no momento da medição. Se a ordem for
   * reespecificada depois, o laudo continua provando contra o que valia no dia.
   */
  espessura_min_micron numeric(6, 1) not null,
  espessura_max_micron numeric(6, 1) not null,
  teste_aderencia appintura2.resultado_teste not null,
  observacao text not null default '',
  responsavel_id uuid references appintura2.usuarios (id),
  data date not null default current_date,
  created_at timestamptz not null default now(),
  constraint qualidade_espessura_positiva check (espessura_medida_micron > 0)
);

create index qualidade_registros_tenant_idx
  on appintura2.qualidade_registros (tenant_id, created_at desc);
create index qualidade_registros_item_idx
  on appintura2.qualidade_registros (os_item_id);

create table appintura2.nao_conformidades (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  os_item_id uuid not null references appintura2.os_itens (id) on delete cascade,
  tipo appintura2.tipo_nao_conformidade not null,
  causa text not null,
  acao_corretiva text not null,
  responsavel_id uuid references appintura2.usuarios (id),
  data date not null default current_date,
  created_at timestamptz not null default now()
);

create index nao_conformidades_tenant_idx
  on appintura2.nao_conformidades (tenant_id, created_at desc);
create index nao_conformidades_item_idx on appintura2.nao_conformidades (os_item_id);

-- ----------------------------------------------------------------------------
-- Base do indicador de retrabalho
--
-- Uma linha por OS que CHEGOU À CABINE, com o operador que fez a aplicação e se
-- houve retrabalho. O denominador ser "entrou na cabine" e não "OS aberta" é
-- deliberado: ordem que ainda nem foi pintada não pode ter sido retrabalhada, e
-- incluí-la faria o indicador parecer melhor do que é.
--
-- `security_invoker` é obrigatório — sem ele a view roda com privilégios do dono
-- e ignora RLS.
-- ----------------------------------------------------------------------------

create view appintura2.vw_os_cabine
with (security_invoker = true)
as
select
  os.tenant_id,
  os.id as os_id,
  os.numero,
  os.cliente_id,
  cabine.created_at as entrou_na_cabine_em,
  cabine.responsavel_id as operador_id,
  exists (
    select 1 from appintura2.os_status_historico h
    where h.os_id = os.id and h.para = 'retrabalho'
  ) as teve_retrabalho
from appintura2.ordens_servico os
join lateral (
  select h.created_at, h.responsavel_id
  from appintura2.os_status_historico h
  where h.os_id = os.id and h.para = 'aplicacao_po'
  order by h.created_at
  limit 1
) cabine on true;

comment on view appintura2.vw_os_cabine is
  'Base do cálculo de taxa de retrabalho. O operador é quem aplicou o pó, não quem registrou a reprovação.';

-- ----------------------------------------------------------------------------
-- RLS
--
-- Estoque: leitura para quem vê produção + financeiro (precisa do custo);
-- escrita para admin e gestor. Qualidade: escrita também para a role `qualidade`,
-- que é quem faz a inspeção.
-- ----------------------------------------------------------------------------

create or replace function appintura2.pode_registrar_qualidade(tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from appintura2.user_roles ur
    where ur.user_id = (select appintura2.usuario_atual())
      and ur.tenant_id = pode_registrar_qualidade.tenant_id
      and ur.role in ('admin', 'gestor_producao', 'qualidade')
      and ur.status = 'ativo'
  )
$$;

grant execute on function appintura2.pode_registrar_qualidade(uuid) to authenticated;

alter table appintura2.estoque_movimentacoes enable row level security;
alter table appintura2.qualidade_registros enable row level security;
alter table appintura2.nao_conformidades enable row level security;

create policy "estoque_movimentacoes_select"
  on appintura2.estoque_movimentacoes for select to authenticated
  using (tenant_id in (select appintura2.get_user_tenant_ids()));

create policy "estoque_movimentacoes_insert"
  on appintura2.estoque_movimentacoes for insert to authenticated
  with check (appintura2.pode_gerenciar_cadastros(tenant_id));

-- Sem UPDATE nem DELETE: movimentação de estoque é lançamento. Correção se faz
-- com movimento contrário, preservando o histórico.

do $$
declare
  tabela text;
begin
  foreach tabela in array array['qualidade_registros', 'nao_conformidades']
  loop
    execute format($f$
      create policy %1$I on appintura2.%2$I
        for select to authenticated
        using (tenant_id in (select appintura2.get_user_tenant_ids()));
    $f$, tabela || '_select', tabela);

    execute format($f$
      create policy %1$I on appintura2.%2$I
        for insert to authenticated
        with check (appintura2.pode_registrar_qualidade(tenant_id));
    $f$, tabela || '_insert', tabela);

    execute format($f$
      create policy %1$I on appintura2.%2$I
        for update to authenticated
        using (appintura2.pode_registrar_qualidade(tenant_id))
        with check (appintura2.pode_registrar_qualidade(tenant_id));
    $f$, tabela || '_update', tabela);
  end loop;
end
$$;

insert into appintura2.schema_migrations (version, name)
values ('20260915120000', 'fase4_estoque_qualidade')
on conflict (version) do nothing;

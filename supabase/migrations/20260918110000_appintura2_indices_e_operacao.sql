-- ============================================================================
-- APPintura — índices de FK, rate limit persistente, retenção LGPD e convites
--
-- Depende de 20260918100000_appintura2_orcamento_area_obrigatoria.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Índices de chave estrangeira
--
-- O Postgres indexa a chave PRIMÁRIA automaticamente, mas NÃO as estrangeiras —
-- suposição comum e cara. Sem índice, dois caminhos viram varredura sequencial:
-- o join da listagem e, pior, o `on delete cascade`, que precisa varrer a tabela
-- filha inteira a cada exclusão do pai.
--
-- Com a base vazia nada disso aparece. Aparece quando encher, e aí o índice
-- custa um lock de escrita numa tabela grande. Criar agora é de graça.
--
-- Só as FKs que sobraram descobertas: as de maior cardinalidade (romaneio_id,
-- os_id, orcamento_id) já ganharam índice nas migrations dos seus módulos.
-- ----------------------------------------------------------------------------

create index if not exists contas_pagar_centro_custo_idx
  on appintura2.contas_pagar (centro_custo_id);
create index if not exists contas_receber_centro_custo_idx
  on appintura2.contas_receber (centro_custo_id);
create index if not exists contas_receber_cobranca_responsavel_idx
  on appintura2.contas_receber_cobranca_historico (responsavel_id);

create index if not exists estoque_movimentacoes_responsavel_idx
  on appintura2.estoque_movimentacoes (responsavel_id);
create index if not exists nao_conformidades_responsavel_idx
  on appintura2.nao_conformidades (responsavel_id);
create index if not exists qualidade_registros_responsavel_idx
  on appintura2.qualidade_registros (responsavel_id);
create index if not exists os_status_historico_responsavel_idx
  on appintura2.os_status_historico (responsavel_id);

create index if not exists ordens_servico_cor_idx
  on appintura2.ordens_servico (cor_id);

create index if not exists romaneios_recebimento_conferente_idx
  on appintura2.romaneios_recebimento (conferente_id);
create index if not exists romaneios_recebimento_transportadora_idx
  on appintura2.romaneios_recebimento (transportadora_id);
create index if not exists romaneios_recebimento_os_idx
  on appintura2.romaneios_recebimento (os_id);
create index if not exists romaneios_devolucao_responsavel_idx
  on appintura2.romaneios_devolucao (responsavel_id);
create index if not exists romaneios_devolucao_transportadora_idx
  on appintura2.romaneios_devolucao (transportadora_id);
create index if not exists romaneio_devolucao_recebimentos_recebimento_idx
  on appintura2.romaneio_devolucao_recebimentos (recebimento_id);
create index if not exists romaneio_fotos_tenant_idx
  on appintura2.romaneio_fotos (tenant_id);

create index if not exists orcamentos_cor_idx on appintura2.orcamentos (cor_id);
create index if not exists orcamentos_vendedor_idx on appintura2.orcamentos (vendedor_id);
create index if not exists orcamentos_versao_anterior_idx
  on appintura2.orcamentos (orcamento_versao_anterior_id);
create index if not exists orcamentos_os_idx on appintura2.orcamentos (os_id);
create index if not exists orcamento_anexos_tenant_idx
  on appintura2.orcamento_anexos (tenant_id);
create index if not exists orcamento_links_tenant_idx
  on appintura2.orcamento_links (tenant_id);
create index if not exists orcamento_eventos_tenant_idx
  on appintura2.orcamento_eventos (tenant_id);
create index if not exists orcamento_eventos_usuario_idx
  on appintura2.orcamento_eventos (usuario_id);

-- ----------------------------------------------------------------------------
-- Rate limit persistente
--
-- O controle que existia vivia na memória do isolate da Edge Function: zerava
-- a cada reciclagem do runtime, e cada isolate contava o seu. Servia contra a
-- tentativa distraída, não contra quem tem paciência.
--
-- Aqui a contagem é do banco, então vale para todos os isolates e sobrevive a
-- reinício. A tabela é minúscula por desenho: uma linha por chave, sobrescrita
-- quando a janela vira.
-- ----------------------------------------------------------------------------

create table if not exists appintura2.rate_limit (
  chave          text primary key,
  janela_inicio  timestamptz not null default now(),
  tentativas     integer not null default 0
);

revoke all on appintura2.rate_limit from anon, authenticated;
grant all on appintura2.rate_limit to service_role;

comment on table appintura2.rate_limit is
  'Contador de tentativas por chave (ex: "login:1.2.3.4"). Sem dado pessoal alem do IP, que ja e registrado na auditoria.';

/*
 * Registra a tentativa e diz se PASSOU do limite.
 *
 * `true` = bloqueie. A janela é deslizante por reinício: passou o tempo, o
 * contador recomeça. Não é token bucket — é o suficiente para a superfície
 * pública deste módulo e não precisa de job de limpeza.
 *
 * `on conflict` num único statement: duas requisições simultâneas da mesma
 * chave não conseguem zerar o contador uma da outra.
 */
create or replace function appintura2.excedeu_limite(
  p_chave           text,
  p_limite          integer default 20,
  p_janela_segundos integer default 60
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tentativas integer;
begin
  insert into appintura2.rate_limit (chave, janela_inicio, tentativas)
  values (p_chave, now(), 1)
  on conflict (chave) do update
    set tentativas = case
          when appintura2.rate_limit.janela_inicio
               < now() - make_interval(secs => p_janela_segundos)
          then 1
          else appintura2.rate_limit.tentativas + 1
        end,
        janela_inicio = case
          when appintura2.rate_limit.janela_inicio
               < now() - make_interval(secs => p_janela_segundos)
          then now()
          else appintura2.rate_limit.janela_inicio
        end
  returning tentativas into v_tentativas;

  return v_tentativas > p_limite;
end
$$;

revoke all on function appintura2.excedeu_limite(text, integer, integer)
  from public, anon, authenticated;
grant execute on function appintura2.excedeu_limite(text, integer, integer) to service_role;

/* Higiene: some com chave que ninguém toca há um dia. Roda no job diário. */
create or replace function appintura2.limpar_rate_limit()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with removidas as (
    delete from appintura2.rate_limit
    where janela_inicio < now() - interval '1 day'
    returning 1
  )
  select count(*)::integer from removidas
$$;

revoke all on function appintura2.limpar_rate_limit() from public, anon, authenticated;
grant execute on function appintura2.limpar_rate_limit() to service_role;

-- ----------------------------------------------------------------------------
-- Retenção de dado pessoal (LGPD)
--
-- `orcamento_eventos` guarda nome, CPF/CNPJ e IP de uma pessoa que NÃO é
-- usuária do sistema — ela só clicou num link. Manter isso para sempre não tem
-- finalidade legítima depois que o prazo de contestação comercial passa.
--
-- A função ANONIMIZA em vez de apagar: o evento continua na trilha (data, tipo,
-- orçamento), e some só o que identifica a pessoa. Apagar a linha destruiria a
-- prova de que a aprovação existiu, que é justamente o motivo de a tabela ser
-- somente-inserção.
--
-- O prazo é parâmetro, não constante: quem define é a política de privacidade,
-- não o código.
-- ----------------------------------------------------------------------------

create or replace function appintura2.anonimizar_eventos_antigos(p_meses integer default 60)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  update appintura2.orcamento_eventos
     set autor_nome = case when autor_nome <> '' then '[anonimizado]' else '' end,
         autor_documento = '',
         ip = '',
         user_agent = '',
         metadata = metadata - 'mensagem'
   where created_at < now() - make_interval(months => p_meses)
     and (autor_documento <> '' or ip <> '' or user_agent <> '');

  get diagnostics v_total = row_count;

  return v_total;
end
$$;

revoke all on function appintura2.anonimizar_eventos_antigos(integer) from public, anon;
grant execute on function appintura2.anonimizar_eventos_antigos(integer)
  to authenticated, service_role;

comment on function appintura2.anonimizar_eventos_antigos(integer) is
  'LGPD: remove o que identifica o aprovador, preservando a existencia do evento. Prazo em meses, definido pela politica de privacidade.';

-- ----------------------------------------------------------------------------
-- Convites pendentes
--
-- Enquanto não há envio de e-mail, cada convite cria um usuário com senha
-- aleatória que ninguém conhece — e ele fica lá, sem nunca conseguir entrar.
-- Esta view torna esses casos visíveis em vez de deixá-los acumular em
-- silêncio.
-- ----------------------------------------------------------------------------

create or replace view appintura2.vw_convites_pendentes
with (security_invoker = true)
as
select
  ur.id                as vinculo_id,
  ur.tenant_id,
  ur.role,
  u.id                 as usuario_id,
  u.nome,
  u.email,
  ur.created_at,
  (current_date - ur.created_at::date) as dias_pendente,
  -- Nunca logou desde que foi criado: o convite não chegou a virar acesso.
  u.ultimo_login_em is null as nunca_acessou
from appintura2.user_roles ur
join appintura2.usuarios u on u.id = ur.user_id
where ur.status = 'pendente';

comment on view appintura2.vw_convites_pendentes is
  'Convites que nunca viraram acesso. Enquanto nao ha envio de e-mail, e aqui que eles ficam visiveis.';

insert into appintura2.schema_migrations (version, name)
values ('20260918110000', 'appintura2_indices_e_operacao')
on conflict (version) do nothing;

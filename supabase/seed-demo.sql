-- ============================================================================
-- APPintura — dados de demonstração
--
-- Popula a empresa do usuário informado com um cenário realista de oficina de
-- pintura eletrostática, para navegar e testar o sistema com as telas cheias.
--
-- Rodar:
--   docker exec -i supabase-db psql -U postgres -d postgres -f - < seed-demo.sql
--
-- Para LIMPAR tudo depois, veja `seed-demo-limpar.sql`.
--
-- Os dados passam pelas MESMAS RPCs que a aplicação usa — numeração por
-- trigger, histórico de status, eventos de orçamento e conversão em OS saem
-- todos do caminho real. Um `insert` cru encheria as tabelas sem exercitar
-- nada disso, e esconderia justamente os erros que interessa achar.
-- ============================================================================

\set ON_ERROR_STOP on
\set EMAIL_ALVO 'henrique.rufino@aptechinfo.com.br'

begin;

select id as uid from appintura2.usuarios where email = :'EMAIL_ALVO' \gset
select tenant_id as tid from appintura2.user_roles where user_id = :'uid' limit 1 \gset

-- A sessão é assumida antes de qualquer escrita: `usuario_atual()` alimenta
-- vendedor, conferente e responsável do histórico. Sem isto o seed geraria
-- registros órfãos de autor.
select set_config('request.jwt.claims',
  json_build_object('sub', :'uid', 'role', 'authenticated')::text, true) as _sessao \gset

-- ----------------------------------------------------------------------------
-- Configuração da empresa
-- ----------------------------------------------------------------------------

insert into appintura2.configuracoes_tenant (
  tenant_id, dias_alerta_custodia, multa_percentual, juros_mes_percentual,
  custo_energia_gas_m2, custo_mao_obra_m2, custo_insumos_quimicos_m2,
  custo_depreciacao_m2, despesa_fixa_mensal
)
values (:'tid', 15, 2, 1, 3.80, 12.50, 2.40, 1.90, 38000)
on conflict (tenant_id) do update
  set custo_energia_gas_m2 = excluded.custo_energia_gas_m2,
      custo_mao_obra_m2 = excluded.custo_mao_obra_m2,
      despesa_fixa_mensal = excluded.despesa_fixa_mensal;

-- ----------------------------------------------------------------------------
-- Tabela de preço
-- ----------------------------------------------------------------------------

select appintura2.salvar_tabela_preco(:'tid',
  jsonb_build_object('nome', 'Tabela padrão 2026', 'ativa', true),
  jsonb_build_array(
    jsonb_build_object('tipo_acabamento','Liso brilhante','unidade','m2','valor',52.00),
    jsonb_build_object('tipo_acabamento','Liso fosco','unidade','m2','valor',56.00),
    jsonb_build_object('tipo_acabamento','Texturizado','unidade','m2','valor',68.00),
    jsonb_build_object('tipo_acabamento','Primer + acabamento','unidade','m2','valor',84.00)
  )) as tabela_padrao \gset

select appintura2.salvar_tabela_preco(:'tid',
  jsonb_build_object('nome', 'Tabela volume (acima de 200 m²)', 'ativa', true),
  jsonb_build_array(
    jsonb_build_object('tipo_acabamento','Liso brilhante','unidade','m2','valor',44.00),
    jsonb_build_object('tipo_acabamento','Texturizado','unidade','m2','valor',58.00)
  )) as tabela_volume \gset

-- ----------------------------------------------------------------------------
-- Clientes
--
-- Um deles com inadimplência em aberto, para o painel financeiro não ficar
-- todo verde e esconder o comportamento do alerta.
-- ----------------------------------------------------------------------------

insert into appintura2.clientes (
  tenant_id, razao_social, cnpj_cpf, contato_nome, contato_telefone, contato_email,
  cep, logradouro, numero, bairro, cidade, uf, tabela_preco_id, limite_credito
) values
  (:'tid','Metalúrgica São Bento Ltda','04582137000164','Cláudia Menezes','1134785200','compras@saobento.ind.br',
   '09751000','Av. Industrial','2140','Assunção','São Bernardo do Campo','SP',:'tabela_volume',80000),
  (:'tid','Esquadrias Portal Norte ME','21309874000155','Anderson Prado','1139662140','anderson@portalnorte.com.br',
   '02918030','Rua das Prensas','87','Freguesia do Ó','São Paulo','SP',:'tabela_padrao',25000),
  (:'tid','Serralheria Vale Verde','33102874000108','Marcos Ribeiro','1128740099','marcos@valeverde.com.br',
   '08540110','Estrada do Contorno','455','Jardim Nova Ferraz','Ferraz de Vasconcelos','SP',:'tabela_padrao',15000),
  (:'tid','Indústria Cromaq S/A','07441029000133','Patrícia Lemos','1145203388','suprimentos@cromaq.com.br',
   '06460040','Al. Tocantins','620','Alphaville','Barueri','SP',:'tabela_volume',150000);

select id as cli_saobento from appintura2.clientes where tenant_id=:'tid' and cnpj_cpf='04582137000164' \gset
select id as cli_portal   from appintura2.clientes where tenant_id=:'tid' and cnpj_cpf='21309874000155' \gset
select id as cli_vale     from appintura2.clientes where tenant_id=:'tid' and cnpj_cpf='33102874000108' \gset
select id as cli_cromaq   from appintura2.clientes where tenant_id=:'tid' and cnpj_cpf='07441029000133' \gset

-- ----------------------------------------------------------------------------
-- Cores
--
-- A RAL 7016 entra ABAIXO do estoque mínimo de propósito: é o que faz o alerta
-- de reposição aparecer na tela de estoque.
-- ----------------------------------------------------------------------------

insert into appintura2.cores (
  tenant_id, codigo_ral, nome_comercial, fabricante, tipo, textura, brilho,
  rendimento_teorico_g_m2, custo_kg, estoque_atual, estoque_minimo, lote, validade
) values
  (:'tid','RAL 9005','Preto Absoluto','WEG','poliester','lisa','fosco',      118, 41.90, 180, 40,'L-2609-A','2027-06-30'),
  (:'tid','RAL 9003','Branco Sinal','Sherwin-Williams','poliester','lisa','brilhante',122, 39.50, 240, 50,'L-2608-C','2027-04-15'),
  (:'tid','RAL 7016','Cinza Antracite','WEG','poliester','texturizada','semibrilho',131, 46.20,  22, 45,'L-2605-B','2026-12-20'),
  (:'tid','RAL 5010','Azul Genciana','Tigre','hibrida','lisa','brilhante',   126, 52.80,  95, 30,'L-2607-D','2027-02-28'),
  (:'tid','RAL 3020','Vermelho Trânsito','WEG','epoxi','lisa','brilhante',   134, 58.40,  64, 25,'L-2606-E','2027-01-31');

select id as cor_preto  from appintura2.cores where tenant_id=:'tid' and codigo_ral='RAL 9005' \gset
select id as cor_branco from appintura2.cores where tenant_id=:'tid' and codigo_ral='RAL 9003' \gset
select id as cor_cinza  from appintura2.cores where tenant_id=:'tid' and codigo_ral='RAL 7016' \gset
select id as cor_azul   from appintura2.cores where tenant_id=:'tid' and codigo_ral='RAL 5010' \gset

-- ----------------------------------------------------------------------------
-- Insumos químicos e transportadoras
-- ----------------------------------------------------------------------------

insert into appintura2.insumos_quimicos (
  tenant_id, nome, tipo, fornecedor, estoque_atual, estoque_minimo, unidade_medida, validade
) values
  (:'tid','Desengraxante alcalino DX-40','desengraxante','Químicos Bandeirante',180, 50,'kg','2027-03-31'),
  (:'tid','Fosfato de ferro FF-12','fosfatizante','Químicos Bandeirante',       95, 30,'kg','2027-05-20'),
  (:'tid','Passivador isento de cromo','passivador','Surtec do Brasil',          18, 25,'L','2026-11-30');

insert into appintura2.transportadoras (tenant_id, nome, cnpj, contato_nome, contato_telefone)
values
  (:'tid','Transportes Rodoleste','12874390000177','Sérgio Vidal','1129887744'),
  (:'tid','Log Rápido Cargas ME','29033471000190','Rita Camargo','1135602211');

select id as transp_rodoleste from appintura2.transportadoras where tenant_id=:'tid' and cnpj='12874390000177' \gset

-- ----------------------------------------------------------------------------
-- Centros de custo
-- ----------------------------------------------------------------------------

insert into appintura2.centros_custo (tenant_id, nome, tipo) values
  (:'tid','Cabine de pintura','producao'),
  (:'tid','Comercial','comercial'),
  (:'tid','Administrativo','administrativo');

select id as cc_producao from appintura2.centros_custo where tenant_id=:'tid' and nome='Cabine de pintura' \gset
select id as cc_admin    from appintura2.centros_custo where tenant_id=:'tid' and nome='Administrativo' \gset

commit;

-- ============================================================================
-- APPintura — dados de demonstração, parte 2: operação
--
-- Depende de `seed-demo.sql`, que cria os cadastros.
--
-- Cobre custódia, produção, estoque, qualidade, financeiro e o funil comercial.
-- Tudo passa pelas RPCs reais, então numeração, histórico de status, baixa de
-- tinta, eventos de orçamento e conversão em OS são exercitados de verdade.
-- ============================================================================

\set ON_ERROR_STOP on
\set EMAIL_ALVO 'henrique.rufino@aptechinfo.com.br'

begin;

select id as uid from appintura2.usuarios where email = :'EMAIL_ALVO' \gset
select tenant_id as tid from appintura2.user_roles where user_id = :'uid' limit 1 \gset
select set_config('request.jwt.claims',
  json_build_object('sub', :'uid', 'role', 'authenticated')::text, true) as _s \gset

select id as cli_saobento from appintura2.clientes where tenant_id=:'tid' and cnpj_cpf='04582137000164' \gset
select id as cli_portal   from appintura2.clientes where tenant_id=:'tid' and cnpj_cpf='21309874000155' \gset
select id as cli_vale     from appintura2.clientes where tenant_id=:'tid' and cnpj_cpf='33102874000108' \gset
select id as cli_cromaq   from appintura2.clientes where tenant_id=:'tid' and cnpj_cpf='07441029000133' \gset
select id as cor_preto  from appintura2.cores where tenant_id=:'tid' and codigo_ral='RAL 9005' \gset
select id as cor_branco from appintura2.cores where tenant_id=:'tid' and codigo_ral='RAL 9003' \gset
select id as cor_cinza  from appintura2.cores where tenant_id=:'tid' and codigo_ral='RAL 7016' \gset
select id as cor_azul   from appintura2.cores where tenant_id=:'tid' and codigo_ral='RAL 5010' \gset
select id as cc_producao from appintura2.centros_custo where tenant_id=:'tid' and nome='Cabine de pintura' \gset
select id as cc_admin    from appintura2.centros_custo where tenant_id=:'tid' and nome='Administrativo' \gset

-- ----------------------------------------------------------------------------
-- Custódia: três recebimentos em estados diferentes
-- ----------------------------------------------------------------------------

select appintura2.salvar_recebimento(:'tid',
  jsonb_build_object('cliente_id',:'cli_saobento','documento_numero','44821','documento_serie','1',
    'status','recebido_conferido','observacao','Carga completa, sem avaria aparente.'),
  jsonb_build_array(
    jsonb_build_object('descricao','Portão basculante 3,00 x 2,40 m','quantidade',2,'unidade','peca','peso_kg',96,'condicao_chegada','integra'),
    jsonb_build_object('descricao','Grade de proteção 1,20 x 2,00 m','quantidade',8,'unidade','peca','peso_kg',22,'condicao_chegada','integra'),
    jsonb_build_object('descricao','Corrimão tubular 6 m','quantidade',4,'unidade','peca','peso_kg',14,'condicao_chegada','integra')
  )) as rom_saobento \gset

select appintura2.salvar_recebimento(:'tid',
  jsonb_build_object('cliente_id',:'cli_portal','documento_numero','7712','documento_serie','1',
    'status','recebido_com_ressalva','observacao','Duas esquadrias chegaram com amassado na aba. Cliente ciente.'),
  jsonb_build_array(
    jsonb_build_object('descricao','Esquadria de alumínio 1,50 x 1,20 m','quantidade',12,'unidade','peca','peso_kg',9,'condicao_chegada','avariada','observacao','Amassado na aba inferior em 2 peças'),
    jsonb_build_object('descricao','Contramarco 1,50 m','quantidade',12,'unidade','peca','peso_kg',4,'condicao_chegada','integra')
  )) as rom_portal \gset

select appintura2.salvar_recebimento(:'tid',
  jsonb_build_object('cliente_id',:'cli_vale','documento_numero','1180','documento_serie','1',
    'status','pendente_conferencia','observacao','Chegou no fim do expediente. Conferir pela manhã.'),
  jsonb_build_array(
    jsonb_build_object('descricao','Roda de carrinho industrial 12"','quantidade',40,'unidade','peca','peso_kg',3,'condicao_chegada','integra')
  )) as rom_vale \gset

-- ----------------------------------------------------------------------------
-- Produção: OS espalhadas pelo Kanban
--
-- Os `update` de status são feitos um a um, e não em lote, porque cada
-- transição dispara o trigger de histórico: pular etapas deixaria a trilha com
-- buraco e o gráfico de SLA sem o que medir.
-- ----------------------------------------------------------------------------

insert into appintura2.ordens_servico (
  tenant_id, cliente_id, romaneio_recebimento_id, data_entrada, previsao_entrega,
  urgencia, cor_id, espessura_min_micron, espessura_max_micron, tipo_pretratamento, observacao
) values
  (:'tid',:'cli_saobento',:'rom_saobento', now() - interval '9 days', now() + interval '2 days',
   'alta', :'cor_preto', 60, 90, 'fosfatizacao','Cliente pediu acabamento fosco uniforme.'),
  (:'tid',:'cli_saobento',:'rom_saobento', now() - interval '7 days', now() + interval '4 days',
   'normal', :'cor_cinza', 70, 100, 'fosfatizacao',''),
  (:'tid',:'cli_portal',  :'rom_portal',   now() - interval '6 days', now() + interval '1 day',
   'urgente', :'cor_branco', 60, 85, 'desengraxe','Obra com entrega contratual na sexta.'),
  (:'tid',:'cli_portal',  :'rom_portal',   now() - interval '5 days', now() + interval '6 days',
   'normal', :'cor_azul', 65, 95, 'desengraxe',''),
  (:'tid',:'cli_saobento',:'rom_saobento', now() - interval '14 days', now() - interval '2 days',
   'normal', :'cor_preto', 60, 90, 'fosfatizacao','Entregue no prazo.');

select id as os1 from appintura2.ordens_servico where tenant_id=:'tid' order by numero limit 1 \gset
select id as os2 from appintura2.ordens_servico where tenant_id=:'tid' order by numero offset 1 limit 1 \gset
select id as os3 from appintura2.ordens_servico where tenant_id=:'tid' order by numero offset 2 limit 1 \gset
select id as os4 from appintura2.ordens_servico where tenant_id=:'tid' order by numero offset 3 limit 1 \gset
select id as os5 from appintura2.ordens_servico where tenant_id=:'tid' order by numero offset 4 limit 1 \gset

insert into appintura2.os_itens (os_id, descricao, quantidade, area_m2) values
  (:'os1','Portão basculante 3,00 x 2,40 m', 2, 7.20),
  (:'os1','Corrimão tubular 6 m',            4, 1.90),
  (:'os2','Grade de proteção 1,20 x 2,00 m', 8, 2.40),
  (:'os3','Esquadria de alumínio 1,50 x 1,20 m', 12, 1.80),
  (:'os4','Contramarco 1,50 m',             12, 0.60),
  (:'os5','Portão basculante 3,00 x 2,40 m', 1, 7.20);

-- OS 1 -> controle de qualidade (passou pela cabine, consumiu tinta)
update appintura2.ordens_servico set status='pre_tratamento'     where id=:'os1';
update appintura2.ordens_servico set status='aplicacao_po'       where id=:'os1';
update appintura2.ordens_servico set status='cura'               where id=:'os1';
update appintura2.ordens_servico set status='controle_qualidade' where id=:'os1';

-- OS 2 -> na cabine agora
update appintura2.ordens_servico set status='pre_tratamento' where id=:'os2';
update appintura2.ordens_servico set status='aplicacao_po'   where id=:'os2';

-- OS 3 -> retrabalho (espessura fora de faixa)
update appintura2.ordens_servico set status='pre_tratamento'     where id=:'os3';
update appintura2.ordens_servico set status='aplicacao_po'       where id=:'os3';
update appintura2.ordens_servico set status='cura'               where id=:'os3';
update appintura2.ordens_servico set status='controle_qualidade' where id=:'os3';
update appintura2.ordens_servico set status='retrabalho'         where id=:'os3';

-- OS 4 -> só entrou no pré-tratamento
update appintura2.ordens_servico set status='pre_tratamento' where id=:'os4';

-- OS 5 -> ciclo completo, já entregue
update appintura2.ordens_servico set status='pre_tratamento'     where id=:'os5';
update appintura2.ordens_servico set status='aplicacao_po'       where id=:'os5';
update appintura2.ordens_servico set status='cura'               where id=:'os5';
update appintura2.ordens_servico set status='controle_qualidade' where id=:'os5';
update appintura2.ordens_servico set status='embalagem'          where id=:'os5';
update appintura2.ordens_servico set status='aguardando_retirada' where id=:'os5';
update appintura2.ordens_servico set status='finalizado'         where id=:'os5';

-- ----------------------------------------------------------------------------
-- Devolução da OS já finalizada
-- ----------------------------------------------------------------------------

select id as item_portao from appintura2.romaneio_recebimento_itens
  where romaneio_id=:'rom_saobento' and descricao like 'Portão%' \gset

select appintura2.salvar_devolucao(:'tid',
  jsonb_build_object('cliente_id',:'cli_saobento','retirado_por_nome','Sérgio Vidal',
    'retirado_por_documento','18455092833','placa','FQP4J72','status','retirado_parcial'),
  jsonb_build_array(
    jsonb_build_object('recebimento_item_id',:'item_portao','quantidade',1,'condicao_saida','integra')
  )) as dev1 \gset

-- ----------------------------------------------------------------------------
-- Estoque: compras e uma perda registrada
-- ----------------------------------------------------------------------------

insert into appintura2.estoque_movimentacoes (
  tenant_id, tipo_item, item_id, item_descricao, tipo_movimento, quantidade, unidade,
  observacao, responsavel_id, data
) values
  (:'tid','tinta',:'cor_preto','RAL 9005 Preto Absoluto','entrada',120,'kg','NF 88214 — Distribuidora WEG',:'uid', now() - interval '20 days'),
  (:'tid','tinta',:'cor_branco','RAL 9003 Branco Sinal','entrada',150,'kg','NF 88215 — Sherwin',:'uid', now() - interval '18 days'),
  (:'tid','tinta',:'cor_cinza','RAL 7016 Cinza Antracite','entrada',60,'kg','NF 88402 — Distribuidora WEG',:'uid', now() - interval '6 days');

-- Consumo de um lote grande fechado na semana passada. Derruba a RAL 7016
-- ABAIXO do minimo de proposito: sem isto o alerta de reposicao nunca aparece
-- na tela, e a entrada de 60 kg acima ja tinha anulado o estoque baixo inicial.
insert into appintura2.estoque_movimentacoes (
  tenant_id, tipo_item, item_id, item_descricao, tipo_movimento, quantidade, unidade,
  observacao, responsavel_id, data
) values
  (:'tid','tinta',:'cor_cinza','RAL 7016 Cinza Antracite','saida',42,'kg','Lote de gabinetes da Cromaq.',:'uid', now() - interval '4 days');

insert into appintura2.estoque_movimentacoes (
  tenant_id, tipo_item, item_id, item_descricao, tipo_movimento, quantidade, unidade,
  motivo_perda, observacao, responsavel_id, data
) values
  (:'tid','tinta',:'cor_azul','RAL 5010 Azul Genciana','perda',6,'kg','contaminacao','Lote empedrado por umidade na estufa.',:'uid', now() - interval '3 days');

-- ----------------------------------------------------------------------------
-- Qualidade
-- ----------------------------------------------------------------------------

select id as item_os1 from appintura2.os_itens where os_id=:'os1' limit 1 \gset
select id as item_os3 from appintura2.os_itens where os_id=:'os3' limit 1 \gset

insert into appintura2.qualidade_registros (
  tenant_id, os_item_id, espessura_medida_micron, espessura_min_micron, espessura_max_micron,
  teste_aderencia, observacao, responsavel_id
) values
  (:'tid',:'item_os1', 78, 60, 90,'aprovado','Camada uniforme, sem casca de laranja.',:'uid'),
  (:'tid',:'item_os3', 52, 60, 85,'reprovado','Abaixo da faixa nas duas medições da aba.',:'uid');

insert into appintura2.nao_conformidades (
  tenant_id, os_item_id, tipo, causa, acao_corretiva, responsavel_id
) values
  (:'tid',:'item_os3','espessura_fora_faixa',
   'Pistola com vazão baixa após troca de bico.',
   'Regulagem refeita e peça devolvida à cabine para retrabalho.',:'uid');

-- ----------------------------------------------------------------------------
-- Financeiro
--
-- Inclui um título vencido e um parcialmente pago: sem isso o painel fica todo
-- verde e as telas de inadimplência e de saldo não mostram comportamento.
-- ----------------------------------------------------------------------------

insert into appintura2.contas_receber (
  tenant_id, cliente_id, os_id, descricao, valor, vencimento, forma_pagamento,
  centro_custo_id, parcela, total_parcelas
) values
  (:'tid',:'cli_saobento',:'os5','OS 5 — pintura de portão basculante', 4180.00, current_date - 12,'boleto',:'cc_producao',1,1),
  (:'tid',:'cli_portal',  null, 'Fechamento quinzenal — 1ª quinzena',   7620.00, current_date - 3, 'pix',   :'cc_producao',1,2),
  (:'tid',:'cli_portal',  null, 'Fechamento quinzenal — 2ª quinzena',   7620.00, current_date + 12,'pix',   :'cc_producao',2,2),
  (:'tid',:'cli_cromaq',  null, 'Contrato mensal — volume mínimo',     18400.00, current_date + 20,'boleto',:'cc_producao',1,1),
  (:'tid',:'cli_vale',    null, 'OS avulsa — rodas industriais',        2260.00, current_date + 6, 'pix',   :'cc_producao',1,1);

select id as cr_parcial from appintura2.contas_receber
  where tenant_id=:'tid' and descricao like 'Fechamento quinzenal — 1%' \gset
select id as cr_pago from appintura2.contas_receber
  where tenant_id=:'tid' and descricao like 'OS 5%' \gset

insert into appintura2.contas_receber_pagamentos (conta_receber_id, data_pagamento, valor_pago, juros_multa)
values
  (:'cr_parcial', current_date - 1, 3000.00, 0),
  (:'cr_pago',    current_date - 10, 4180.00, 0);

insert into appintura2.contas_pagar (
  tenant_id, fornecedor, descricao, categoria, valor, vencimento, recorrente, centro_custo_id
) values
  (:'tid','Distribuidora WEG','NF 88402 — tinta em pó RAL 7016','insumo_direto', 2772.00, current_date + 8,  false, :'cc_producao'),
  (:'tid','Químicos Bandeirante','Desengraxante e fosfato','insumo_direto',      1840.00, current_date + 15, false, :'cc_producao'),
  (:'tid','Enel Distribuição','Energia — setembro','fixa',                       6310.00, current_date + 5,  true,  :'cc_producao'),
  (:'tid','Imobiliária Centro','Aluguel do galpão','fixa',                       9500.00, current_date + 10, true,  :'cc_admin');

commit;

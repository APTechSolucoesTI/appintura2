\set ON_ERROR_STOP on
\pset tuples_only on
begin;

select id as uid from appintura2.usuarios where email='henrique.rufino@aptechinfo.com.br' \gset
select id as t1 from appintura2.tenants where cnpj='36471917000111' \gset
insert into appintura2.clientes (tenant_id, razao_social, cnpj_cpf, uf) values (:'t1','C','11222333000144','SP') returning id as c1 \gset
insert into appintura2.cores (tenant_id, codigo_ral, nome_comercial, fabricante, tipo, textura, brilho, rendimento_teorico_g_m2, custo_kg, lote, validade, estoque_atual, estoque_minimo)
values (:'t1','R1','Preto','W','poliester','lisa','fosco',120,38.5,'L',current_date+365, 50, 10) returning id as cor1 \gset
insert into appintura2.insumos_quimicos (tenant_id, nome, tipo, fornecedor, estoque_atual, estoque_minimo, validade, unidade_medida)
values (:'t1','Desengraxante','desengraxante','Fab',100,20,current_date+200,'kg') returning id as ins1 \gset
select set_config('request.jwt.claims', json_build_object('sub', :'uid','role','authenticated')::text, true) as _c \gset
set local role authenticated;

\echo '=========== P. ESTOQUE ==========='
insert into appintura2.estoque_movimentacoes (tenant_id, tipo_item, item_id, tipo_movimento, quantidade, item_descricao, unidade, responsavel_id)
values (:'t1','tinta',:'cor1','entrada',30,'Preto','kg',:'uid') returning id as m1 \gset
select 'P01 '||case when (select estoque_atual from appintura2.cores where id=:'cor1')=80 then 'PASS' else 'FAIL' end||' | entrada soma no estoque da tinta (50+30)';
insert into appintura2.estoque_movimentacoes (tenant_id, tipo_item, item_id, tipo_movimento, quantidade, item_descricao, unidade, responsavel_id)
values (:'t1','tinta',:'cor1','saida',20,'Preto','kg',:'uid');
select 'P02 '||case when (select estoque_atual from appintura2.cores where id=:'cor1')=60 then 'PASS' else 'FAIL' end||' | saida subtrai (80-20)';
insert into appintura2.estoque_movimentacoes (tenant_id, tipo_item, item_id, tipo_movimento, quantidade, item_descricao, unidade, responsavel_id)
values (:'t1','insumo_quimico',:'ins1','saida',30,'Desengraxante','kg',:'uid');
select 'P03 '||case when (select estoque_atual from appintura2.insumos_quimicos where id=:'ins1')=70 then 'PASS' else 'FAIL' end||' | movimenta insumo quimico tambem';
do $blk$ begin
  insert into appintura2.estoque_movimentacoes (tenant_id, tipo_item, item_id, tipo_movimento, quantidade, item_descricao, unidade, responsavel_id)
  values ((select id from appintura2.tenants where cnpj='36471917000111'),'tinta',(select id from appintura2.cores where codigo_ral='R1'),'saida',99999,'Preto','kg',(select appintura2.usuario_atual()));
  raise notice 'P04 INFO | saida maior que o saldo foi ACEITA (estoque negativo permitido)';
exception when others then raise notice 'P04 PASS | saida maior que o saldo recusada'; end $blk$;

\echo '=========== Q. PRODUCAO / CONSUMO ==========='
select appintura2.salvar_recebimento(:'t1', jsonb_build_object('cliente_id',:'c1','status','recebido_conferido'),
  jsonb_build_array(jsonb_build_object('descricao','Portao','quantidade',1))) as rom \gset
insert into appintura2.ordens_servico (tenant_id, cliente_id, romaneio_recebimento_id, data_entrada, previsao_entrega,
  cor_id, espessura_min_micron, espessura_max_micron)
values (:'t1',:'c1',:'rom',now(),now()+interval '7 days',:'cor1',60,90) returning id as os1 \gset
insert into appintura2.os_itens (os_id, descricao, quantidade, area_m2) values (:'os1','Portao',1,10);
select 'Q01 '||case when (select numero from appintura2.ordens_servico where id=:'os1')=1 then 'PASS' else 'FAIL' end||' | OS recebe numero sequencial';
select 'Q02 '||case when (select count(*) from appintura2.os_status_historico where os_id=:'os1')=1 then 'PASS' else 'FAIL' end||' | historico inicial gravado por trigger';
update appintura2.ordens_servico set status='pre_tratamento' where id=:'os1';
update appintura2.ordens_servico set status='aplicacao_po' where id=:'os1';
select 'Q03 '||case when (select count(*) from appintura2.os_status_historico where os_id=:'os1')=3 then 'PASS' else 'FAIL' end||' | cada transicao vira uma linha';
select 'Q04 '||case when (select responsavel_id from appintura2.os_status_historico where os_id=:'os1' order by created_at desc limit 1)=:'uid' then 'PASS' else 'FAIL' end||' | responsavel resolvido no banco';
select 'Q05 '||case when (select count(*) from appintura2.estoque_movimentacoes where os_id=:'os1')>=1 then 'PASS' else 'FAIL' end||' | entrar em aplicacao_po baixa tinta';
update appintura2.ordens_servico set status='cura' where id=:'os1';
update appintura2.ordens_servico set status='aplicacao_po' where id=:'os1';
select 'Q06 '||case when (select count(*) from appintura2.estoque_movimentacoes where os_id=:'os1')=1 then 'PASS' else 'FAIL' end||' | baixa e idempotente (vai e volta nao duplica)';

\echo '=========== R. QUALIDADE ==========='
select id as it1 from appintura2.os_itens where os_id=:'os1' limit 1 \gset
insert into appintura2.qualidade_registros (tenant_id, os_item_id, espessura_medida_micron, espessura_min_micron, espessura_max_micron, teste_aderencia, responsavel_id)
values (:'t1',:'it1',75,60,90,'aprovado',:'uid') returning id as q1 \gset
select 'R01 '||case when (select count(*) from appintura2.qualidade_registros where id=:'q1')=1 then 'PASS' else 'FAIL' end||' | registro de inspecao gravado';
insert into appintura2.nao_conformidades (tenant_id, os_item_id, tipo, causa, acao_corretiva, responsavel_id)
values (:'t1',:'it1','espessura_fora_faixa','pistola','regulagem',:'uid') returning id as nc1 \gset
select 'R02 '||case when (select count(*) from appintura2.nao_conformidades where id=:'nc1')=1 then 'PASS' else 'FAIL' end||' | nao conformidade gravada';
select 'R03 '||case when (select count(*) from appintura2.vw_os_cabine)>=0 then 'PASS' else 'FAIL' end||' | view de cabine consultavel';

\echo '=========== S. FINANCEIRO ==========='
insert into appintura2.centros_custo (tenant_id, nome, tipo) values (:'t1','Producao','producao') returning id as cc1 \gset
insert into appintura2.contas_receber (tenant_id, cliente_id, valor, vencimento, forma_pagamento, centro_custo_id)
values (:'t1',:'c1',1000,current_date+30,'boleto',:'cc1') returning id as cr1 \gset
select 'S01 '||case when (select count(*) from appintura2.contas_receber where id=:'cr1')=1 then 'PASS' else 'FAIL' end||' | conta a receber criada';
insert into appintura2.contas_receber_pagamentos (conta_receber_id, data_pagamento, valor_pago, juros_multa)
values (:'cr1', current_date, 400, 0);
select 'S02 '||case when (select saldo from appintura2.vw_contas_receber_saldo where id=:'cr1')=600 then 'PASS' else 'FAIL' end||' | view calcula saldo (1000-400)';
insert into appintura2.contas_pagar (tenant_id, fornecedor, categoria, valor, vencimento, centro_custo_id)
values (:'t1','Fornecedor','insumo_direto',500,current_date+15,:'cc1') returning id as cp1 \gset
select 'S03 '||case when (select count(*) from appintura2.contas_pagar where id=:'cp1')=1 then 'PASS' else 'FAIL' end||' | conta a pagar criada';
select 'S04 '||case when (select count(*) from appintura2.vw_clientes_inadimplencia)>=0 then 'PASS' else 'FAIL' end||' | view de inadimplencia consultavel';
select 'S05 '||case when (select count(*) from appintura2.vw_sla_os)>=0 then 'PASS' else 'FAIL' end||' | view de SLA consultavel';

\echo '=========== T. CUSTODIA ==========='
select appintura2.salvar_devolucao(:'t1', jsonb_build_object('cliente_id',:'c1','retirado_por_nome','Motorista'),
  jsonb_build_array(jsonb_build_object('recebimento_item_id',(select id from appintura2.romaneio_recebimento_itens where romaneio_id=:'rom' limit 1),'quantidade',1))) as dev \gset
select 'T01 '||case when (select numero from appintura2.romaneios_devolucao where id=:'dev')=1 then 'PASS' else 'FAIL' end||' | devolucao numerada por tenant';
select 'T02 '||case when (select saldo from appintura2.vw_checklist_devolucao where romaneio_id=:'rom' limit 1)=0 then 'PASS' else 'FAIL' end||' | saldo de custodia zera apos devolver tudo';
select 'T03 '||case when (select count(*) from appintura2.saldo_custodia)>=0 then 'PASS' else 'FAIL' end||' | view de saldo consultavel';
rollback;

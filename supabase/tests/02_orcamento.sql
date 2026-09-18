\set ON_ERROR_STOP on
\pset tuples_only on
begin;

select id as uid from appintura2.usuarios where email='henrique.rufino@aptechinfo.com.br' \gset
select id as t1 from appintura2.tenants where cnpj='36471917000111' \gset
insert into appintura2.clientes (tenant_id, razao_social, cnpj_cpf, uf) values (:'t1','Cliente A','11222333000144','SP') returning id as c1 \gset
insert into appintura2.cores (tenant_id, codigo_ral, nome_comercial, fabricante, tipo, textura, brilho, rendimento_teorico_g_m2, custo_kg, lote, validade, estoque_atual, estoque_minimo)
values (:'t1','RAL9005','Preto','WEG','poliester','lisa','fosco',120,38.5,'L1',current_date+365, 100, 10) returning id as cor1 \gset
select set_config('request.jwt.claims', json_build_object('sub', :'uid','role','authenticated')::text, true) as _cfg \gset
set local role authenticated;

-- Fotografia do funil ANTES do teste: as asserções da seção H comparam o
-- DELTA. Medir o valor absoluto só funcionava com o banco vazio, e a view
-- agrupa por (mês, vendedor) — com dados reais ela devolve várias linhas, e o
-- subselect estourava com "more than one row".
select coalesce(sum(ganhos), 0)        as ganhos_antes,
       coalesce(sum(valor_fechado), 0) as fechado_antes
  from appintura2.vw_funil_orcamentos where tenant_id = :'t1' \gset

\echo '=========== E. ORCAMENTO — FASES 1 a 3 ==========='
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+15)::text,
    'espessura_min_micron',60,'espessura_max_micron',90,'prazo_entrega_dias',5,
    'observacoes_internas','SEGREDO','observacoes_cliente','Peca limpa'),
  jsonb_build_array(
    jsonb_build_object('descricao','Portao','quantidade',2,'valor_unitario',300,'area_m2',6),
    jsonb_build_object('descricao','Grade','quantidade',5,'valor_unitario',100,'area_m2',2),
    jsonb_build_object('descricao','Corrimao','quantidade',1,'valor_unitario',250,'area_m2',3))) as orc \gset
select 'E01 '||case when (select valor_total from appintura2.orcamentos where id=:'orc')=1350.00 then 'PASS' else 'FAIL' end||' | total calculado no banco (1350)';
select 'E02 '||case when (select status from appintura2.orcamentos where id=:'orc')='rascunho' then 'PASS' else 'FAIL' end||' | nasce como rascunho';
select 'E03 '||case when (select vendedor_id from appintura2.orcamentos where id=:'orc')=:'uid' then 'PASS' else 'FAIL' end||' | vendedor vem da sessao';
select 'E04 '||case when (select count(*) from appintura2.orcamento_eventos where orcamento_id=:'orc' and tipo='criado')=1 then 'PASS' else 'FAIL' end||' | evento criado registrado';

select appintura2.registrar_link_orcamento(:'orc','hashqa1',15) as lnk \gset
select 'E05 '||case when (select status from appintura2.orcamentos where id=:'orc')='enviado' then 'PASS' else 'FAIL' end||' | enviar muda status';
select 'E06 '||case when (select token_hash from appintura2.orcamento_links where id=:'lnk')='hashqa1' then 'PASS' else 'FAIL' end||' | guarda hash, nao o token';
do $blk$ begin perform appintura2.salvar_orcamento((select id from appintura2.tenants where cnpj='36471917000111'),'{"nome":"x"}'::jsonb,null,(select id from appintura2.orcamentos order by created_at desc limit 1));
  raise notice 'E07 FAIL | deixou editar orcamento enviado';
exception when insufficient_privilege then raise notice 'E07 PASS | orcamento enviado nao pode ser editado'; end $blk$;

select appintura2.registrar_link_orcamento(:'orc','hashqa2',15) as lnk2 \gset
select 'E08 '||case when (select revogado from appintura2.orcamento_links where id=:'lnk')=true then 'PASS' else 'FAIL' end||' | novo link revoga o anterior';

reset role;
\echo '--- portal publico (service_role) ---'
select appintura2.consultar_orcamento_publico('hashqa2','1.2.3.4','curl') as vis \gset
select 'E09 '||case when (:'vis'::jsonb->>'ok')='true' then 'PASS' else 'FAIL' end||' | consulta publica responde';
select 'E10 '||case when :'vis' not like '%SEGREDO%' then 'PASS' else 'FAIL' end||' | observacoes_internas NAO vaza';
select 'E11 '||case when jsonb_array_length(:'vis'::jsonb->'itens')=3 then 'PASS' else 'FAIL' end||' | devolve os 3 itens';
select 'E12 '||case when ((:'vis'::jsonb->'itens'->0)?'id') then 'PASS' else 'FAIL' end||' | itens trazem id (p/ aprovacao parcial)';
select 'E13 '||case when (select status from appintura2.orcamentos where id=:'orc')='visualizado' then 'PASS' else 'FAIL' end||' | primeiro acesso marca visualizado';
select 'E14 '||case when ((select appintura2.consultar_orcamento_publico('naoexiste'))->>'ok')='false' then 'PASS' else 'FAIL' end||' | token inexistente recusado';

select 'E15 '||case when ((select appintura2.decidir_orcamento_publico('hashqa2','aprovado','','','','1.2.3.4','curl'))->>'motivo')='nome_obrigatorio' then 'PASS' else 'FAIL' end||' | aprovar sem nome recusado';

\echo '=========== F. ORCAMENTO — FASE 5 (parcial) ==========='
select id as i1 from appintura2.orcamento_itens where orcamento_id=:'orc' and descricao='Portao' \gset
select id as i3 from appintura2.orcamento_itens where orcamento_id=:'orc' and descricao='Corrimao' \gset
do $blk$ begin perform appintura2.decidir_orcamento_publico('hashqa2','aprovado','Joao','','','1.2.3.4','curl', array['00000000-0000-4000-8000-000000000000'::uuid]);
  raise notice 'F01 FAIL | aceitou item de outro orcamento';
exception when others then raise notice 'F01 PASS | item de outro orcamento recusado'; end $blk$;
select 'F02 '||case when (select status from appintura2.orcamentos where id=:'orc')='visualizado' then 'PASS' else 'FAIL' end||' | tentativa invalida nao decidiu nada';

select appintura2.decidir_orcamento_publico('hashqa2','aprovado','Joao da Silva','12345678900','','1.2.3.4','curl', array[:'i1'::uuid, :'i3'::uuid]) as dec \gset
select 'F03 '||case when (:'dec'::jsonb->>'decisao')='aprovado_parcial' then 'PASS' else 'FAIL' end||' | 2 de 3 = aprovado_parcial';
select 'F04 '||case when (select valor_aprovado from appintura2.orcamentos where id=:'orc')=850.00 then 'PASS' else 'FAIL' end||' | valor fechado = 850';
select 'F05 '||case when (select valor_total from appintura2.orcamentos where id=:'orc')=1350.00 then 'PASS' else 'FAIL' end||' | valor proposto preservado';
select 'F06 '||case when (select count(*) from appintura2.os_itens where os_id=(select os_id from appintura2.orcamentos where id=:'orc'))=2 then 'PASS' else 'FAIL' end||' | OS leva so os aceitos';
select 'F07 '||case when ((select appintura2.decidir_orcamento_publico('hashqa2','rejeitado','X','','','1.2.3.4','curl'))->>'repetido')='true' then 'PASS' else 'FAIL' end||' | duplo clique devolve a decisao ja tomada';
select 'F08 '||case when (select count(*) from appintura2.ordens_servico where orcamento_id=:'orc')=1 then 'PASS' else 'FAIL' end||' | nao criou segunda OS';

\echo '=========== G. ORCAMENTO — FASE 4 (integracao) ==========='
select os_id as os1 from appintura2.orcamentos where id=:'orc' \gset
select romaneio_recebimento_id as rom1 from appintura2.ordens_servico where id=:'os1' \gset
select 'G01 '||case when :'rom1' is not null then 'PASS' else 'FAIL' end||' | conversao criou romaneio esperado';
select 'G02 '||case when (select status from appintura2.romaneios_recebimento where id=:'rom1')='pendente_conferencia' then 'PASS' else 'FAIL' end||' | romaneio nasce pendente de conferencia';
select 'G03 '||case when (select count(*) from appintura2.romaneio_recebimento_itens where romaneio_id=:'rom1')=2 then 'PASS' else 'FAIL' end||' | romaneio so pede os itens aceitos';
select 'G04 '||case when (select os_id from appintura2.romaneios_recebimento where id=:'rom1')=:'os1' then 'PASS' else 'FAIL' end||' | vinculo romaneio->OS nos dois sentidos';
select 'G05 '||case when (select origem from appintura2.ordens_servico where id=:'os1')='orcamento' then 'PASS' else 'FAIL' end||' | OS marcada com origem=orcamento';
do $blk$ begin update appintura2.ordens_servico set status='pre_tratamento' where orcamento_id=(select id from appintura2.orcamentos order by created_at desc limit 1);
  raise notice 'G06 FAIL | produziu sem conferencia';
exception when check_violation then raise notice 'G06 PASS | producao barrada sem conferencia'; end $blk$;
update appintura2.romaneios_recebimento set status='recebido_conferido' where id=:'rom1';
update appintura2.ordens_servico set status='pre_tratamento' where id=:'os1';
select 'G07 '||case when (select status from appintura2.ordens_servico where id=:'os1')='pre_tratamento' then 'PASS' else 'FAIL' end||' | apos conferir, producao liberada';
select 'G08 '||case when (select count(*) from appintura2.os_status_historico where os_id=:'os1')>=2 then 'PASS' else 'FAIL' end||' | historico gravado por trigger';
select 'G09 '||case when (select count(*) from appintura2.vw_checklist_devolucao where romaneio_id=:'rom1')=2 then 'PASS' else 'FAIL' end||' | checklist de devolucao monta a cadeia';

\echo '=========== H. NOTIFICACOES / FUNIL ==========='
select 'H01 '||case when (select count(*) from appintura2.notificacoes where referencia_id=:'orc' and tipo='orcamento_visualizado')=1 then 'PASS' else 'FAIL' end||' | notificacao de visualizacao';
select 'H02 '||case when (select count(*) from appintura2.notificacoes where referencia_id=:'orc' and tipo='orcamento_aprovado')=1 then 'PASS' else 'FAIL' end||' | notificacao de aprovacao';
select 'H03 '||case when (select coalesce(sum(ganhos),0) from appintura2.vw_funil_orcamentos where tenant_id=:'t1') - :ganhos_antes = 1
                then 'PASS' else 'FAIL' end||' | funil contabiliza a aprovacao como ganho';
select 'H04 '||case when (select coalesce(sum(valor_fechado),0) from appintura2.vw_funil_orcamentos where tenant_id=:'t1') - :fechado_antes = 850.00
                then 'PASS' else 'FAIL' end||' | funil soma o valor FECHADO (850), nao o proposto (1350)';

\echo '=========== I. EXPIRACAO / REVISAO ==========='
set local role authenticated;
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+5)::text,
    'espessura_min_micron',60,'espessura_max_micron',90),
  jsonb_build_array(jsonb_build_object('descricao','Velho','quantidade',1,'valor_unitario',10,'area_m2',1))) as orc2 \gset
-- Envio pela RPC, nao por UPDATE direto: `orcamentos` nao tem policy de UPDATE,
-- então um update como `authenticated` afeta ZERO linhas em silêncio. A primeira
-- versao deste teste caiu nessa armadilha e reportou falso negativo.
select appintura2.registrar_link_orcamento(:'orc2','hash-exp-suite',1) as _le \gset
reset role;
update appintura2.orcamentos set data_validade = current_date - 1 where id=:'orc2';
select 'I01 '||case when appintura2.expirar_orcamentos()>=1 then 'PASS' else 'FAIL' end||' | job expira vencido em aberto';
select 'I02 '||case when (select status from appintura2.orcamentos where id=:'orc2')='expirado' then 'PASS' else 'FAIL' end||' | status vira expirado';

set local role authenticated;
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+10)::text,
    'espessura_min_micron',60,'espessura_max_micron',90),
  jsonb_build_array(jsonb_build_object('descricao','Peca','quantidade',1,'valor_unitario',100,'area_m2',1))) as orc3 \gset
select appintura2.registrar_link_orcamento(:'orc3','hashqa3',10) as _l3 \gset
select appintura2.revisar_orcamento(:'orc3') as orc4 \gset
select 'I03 '||case when (select status from appintura2.orcamentos where id=:'orc3')='revisado' then 'PASS' else 'FAIL' end||' | original vira revisado';
select 'I04 '||case when (select revogado from appintura2.orcamento_links where token_hash='hashqa3')=true then 'PASS' else 'FAIL' end||' | revisao revoga o link antigo';
select 'I05 '||case when (select orcamento_versao_anterior_id from appintura2.orcamentos where id=:'orc4')=:'orc3' then 'PASS' else 'FAIL' end||' | nova versao aponta para a anterior';
select 'I06 '||case when (select count(*) from appintura2.orcamento_itens where orcamento_id=:'orc4')=1 then 'PASS' else 'FAIL' end||' | revisao copia os itens';
select 'I07 '||case when (select count(*) from appintura2.diff_orcamento(:'orc4'))>=1 then 'PASS' else 'FAIL' end||' | diff entre versoes responde';
reset role;

\echo '=========== J. CONSULTAS PUBLICAS (QR) ==========='
select 'J01 '||case when (select count(*) from appintura2.consultar_os_publica(:'os1'))=1 then 'PASS' else 'FAIL' end||' | QR da OS responde';
select 'J02 '||case when (select count(*) from appintura2.consultar_romaneio_publico('recebimento', :'rom1'))=1 then 'PASS' else 'FAIL' end||' | QR do romaneio responde';
select 'J03 '||case when has_function_privilege('anon','appintura2.consultar_os_publica(uuid)','execute') then 'PASS' else 'FAIL' end||' | anon pode chamar o QR da OS';
select 'J04 '||case when not has_function_privilege('anon','appintura2.decidir_orcamento_publico(text,text,text,text,text,text,text,uuid[])','execute') then 'PASS' else 'FAIL' end||' | anon NAO pode decidir direto';
select 'J05 '||case when not has_function_privilege('authenticated','appintura2.autenticar(text,text)','execute') then 'PASS' else 'FAIL' end||' | authenticated NAO pode chamar autenticar';
select 'J06 '||case when not has_table_privilege('anon','appintura2.orcamentos','select') then 'PASS' else 'FAIL' end||' | anon sem select em orcamentos';
select 'J07 '||case when not has_column_privilege('authenticated','appintura2.usuarios','senha_hash','select') then 'PASS' else 'FAIL' end||' | senha_hash fora do alcance';
rollback;

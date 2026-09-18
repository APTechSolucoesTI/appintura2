\set ON_ERROR_STOP on
\pset tuples_only on
begin;

select id as uid from appintura2.usuarios where email='henrique.rufino@aptechinfo.com.br' \gset
select id as t1 from appintura2.tenants where cnpj='36471917000111' \gset
insert into appintura2.clientes (tenant_id, razao_social, cnpj_cpf, uf) values (:'t1','C','11222333000144','SP') returning id as c1 \gset
insert into appintura2.cores (tenant_id, codigo_ral, nome_comercial, fabricante, tipo, textura, brilho, rendimento_teorico_g_m2, custo_kg, lote, validade)
values (:'t1','R','P','W','poliester','lisa','fosco',120,38.5,'L',current_date+365) returning id as cor1 \gset
select set_config('request.jwt.claims', json_build_object('sub', :'uid','role','authenticated')::text, true) as _c \gset

\echo '--- diagnostico I01/I02: o UPDATE do meu teste passou? ---'
set local role authenticated;
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date-1)::text,
    'espessura_min_micron',60,'espessura_max_micron',90),
  jsonb_build_array(jsonb_build_object('descricao','Velho','quantidade',1,'valor_unitario',10,'area_m2',1))) as o1 \gset
update appintura2.orcamentos set status='enviado' where id=:'o1';
select 'DIAG1 status apos UPDATE direto como authenticated: '||status from appintura2.orcamentos where id=:'o1';
reset role;

\echo '--- teste correto: enviar pela RPC, depois vencer a validade ---'
set local role authenticated;
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+10)::text,
    'espessura_min_micron',60,'espessura_max_micron',90),
  jsonb_build_array(jsonb_build_object('descricao','Peca','quantidade',1,'valor_unitario',10,'area_m2',1))) as o2 \gset
select appintura2.registrar_link_orcamento(:'o2','hashexp',10) as _l \gset
reset role;
select 'I01b '||case when (select status from appintura2.orcamentos where id=:'o2')='enviado' then 'PASS' else 'FAIL' end||' | RPC de envio muda o status (caminho real)';
update appintura2.orcamentos set data_validade = current_date - 1 where id=:'o2';
select 'I01c '||case when appintura2.expirar_orcamentos()>=1 then 'PASS' else 'FAIL' end||' | job expira orcamento vencido em aberto';
select 'I02c '||case when (select status from appintura2.orcamentos where id=:'o2')='expirado' then 'PASS' else 'FAIL' end||' | status vira expirado';
select 'I03c '||case when (select revogado from appintura2.orcamento_links where token_hash='hashexp')=true then 'PASS' else 'FAIL' end||' | expiracao revoga o link';
select 'I04c '||case when (select count(*) from appintura2.orcamento_eventos where orcamento_id=:'o2' and tipo='expirado')=1 then 'PASS' else 'FAIL' end||' | evento de expiracao registrado';
select 'I05c '||case when (select count(*) from appintura2.notificacoes where referencia_id=:'o2' and tipo='orcamento_expirado')=1 then 'PASS' else 'FAIL' end||' | notificacao de expiracao';

\echo '--- decidir orcamento vencido pelo portal ---'
set local role authenticated;
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+10)::text,
    'espessura_min_micron',60,'espessura_max_micron',90),
  jsonb_build_array(jsonb_build_object('descricao','X','quantidade',1,'valor_unitario',10,'area_m2',1))) as o3 \gset
select appintura2.registrar_link_orcamento(:'o3','hashvenc',10) as _l2 \gset
reset role;
update appintura2.orcamentos set data_validade = current_date - 1 where id=:'o3';
select 'I06c '||case when ((select appintura2.decidir_orcamento_publico('hashvenc','aprovado','Joao','','','1.2.3.4','curl'))->>'motivo')='vencido' then 'PASS' else 'FAIL' end||' | aprovar proposta vencida e recusado';
select 'I07c '||case when (select status from appintura2.orcamentos where id=:'o3')='expirado' then 'PASS' else 'FAIL' end||' | e o evento gravado e expirado, nao aprovado';
select 'I08c '||case when (select count(*) from appintura2.ordens_servico where orcamento_id=:'o3')=0 then 'PASS' else 'FAIL' end||' | vencido NAO gera OS';

\echo '--- lembrete de vencimento ---'
set local role authenticated;
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+1)::text,
    'espessura_min_micron',60,'espessura_max_micron',90),
  jsonb_build_array(jsonb_build_object('descricao','Y','quantidade',1,'valor_unitario',10,'area_m2',1))) as o4 \gset
select appintura2.registrar_link_orcamento(:'o4','hashavisa',10) as _l3 \gset
reset role;
select 'I09c '||case when appintura2.avisar_orcamentos_vencendo(2)>=1 then 'PASS' else 'FAIL' end||' | lembrete 2 dias antes dispara';
select 'I10c '||case when (select count(*) from appintura2.notificacoes where referencia_id=:'o4' and tipo='orcamento_vencendo')=1 then 'PASS' else 'FAIL' end||' | notificacao de vencimento proximo';

\echo '--- recusa total e zero itens aceitos ---'
set local role authenticated;
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+10)::text,
    'espessura_min_micron',60,'espessura_max_micron',90),
  jsonb_build_array(jsonb_build_object('descricao','Z','quantidade',1,'valor_unitario',10,'area_m2',1))) as o5 \gset
select appintura2.registrar_link_orcamento(:'o5','hashrec',10) as _l4 \gset
reset role;
select 'K01 '||case when ((select appintura2.decidir_orcamento_publico('hashrec','rejeitado','Joao','','sem verba','1.2.3.4','curl'))->>'decisao')='rejeitado' then 'PASS' else 'FAIL' end||' | recusa registrada';
select 'K02 '||case when (select valor_aprovado from appintura2.orcamentos where id=:'o5')=0 then 'PASS' else 'FAIL' end||' | recusa zera o valor fechado';
select 'K03 '||case when (select count(*) from appintura2.vw_motivos_recusa where orcamento_id=:'o5')=1 then 'PASS' else 'FAIL' end||' | motivo de recusa aparece na view';

set local role authenticated;
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+10)::text,
    'espessura_min_micron',60,'espessura_max_micron',90),
  jsonb_build_array(jsonb_build_object('descricao','W','quantidade',1,'valor_unitario',10,'area_m2',1))) as o6 \gset
select appintura2.registrar_link_orcamento(:'o6','hashzero',10) as _l5 \gset
reset role;
select 'K04 '||case when ((select appintura2.decidir_orcamento_publico('hashzero','aprovado','Joao','','','1.2.3.4','curl', array[]::uuid[]))->>'decisao')='rejeitado' then 'PASS' else 'FAIL' end||' | desmarcar tudo = recusa, nao OS vazia';
select 'K05 '||case when (select count(*) from appintura2.ordens_servico where orcamento_id=:'o6')=0 then 'PASS' else 'FAIL' end||' | zero itens nao gera OS';

\echo '--- alteracao solicitada mantem o link vivo ---'
set local role authenticated;
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+10)::text,
    'espessura_min_micron',60,'espessura_max_micron',90),
  jsonb_build_array(jsonb_build_object('descricao','V','quantidade',1,'valor_unitario',10,'area_m2',1))) as o7 \gset
select appintura2.registrar_link_orcamento(:'o7','hashalt',10) as _l6 \gset
reset role;
select 'K06 '||case when ((select appintura2.decidir_orcamento_publico('hashalt','alteracao_solicitada','Joao','','troca a cor','1.2.3.4','curl'))->>'decisao')='alteracao_solicitada' then 'PASS' else 'FAIL' end||' | pedido de alteracao registrado';
select 'K07 '||case when (select usado_em from appintura2.orcamento_links where token_hash='hashalt') is null then 'PASS' else 'FAIL' end||' | link continua valido apos pedir alteracao';
select 'K08 '||case when ((select appintura2.decidir_orcamento_publico('hashalt','aprovado','Joao','','','1.2.3.4','curl'))->>'decisao')='aprovado' then 'PASS' else 'FAIL' end||' | cliente ainda pode aprovar depois';
rollback;

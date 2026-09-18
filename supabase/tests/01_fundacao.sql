\set ON_ERROR_STOP on
\pset tuples_only on
begin;

-- ============ preparação ============
select id as uid from appintura2.usuarios where email='henrique.rufino@aptechinfo.com.br' \gset
select id as t1 from appintura2.tenants where cnpj='36471917000111' \gset
insert into appintura2.tenants (razao_social, nome_fantasia, cnpj) values ('Empresa B','B','11111111000191') returning id as t2 \gset
select appintura2.criar_usuario('outro@b.com','senha-forte-1','Outro') as uid2 \gset
insert into appintura2.user_roles (user_id, tenant_id, role, status) values (:'uid2', :'t2', 'admin', 'ativo');

insert into appintura2.clientes (tenant_id, razao_social, cnpj_cpf, uf) values (:'t1','Cliente A','11222333000144','SP') returning id as c1 \gset
insert into appintura2.clientes (tenant_id, razao_social, cnpj_cpf, uf) values (:'t2','Cliente B','55666777000188','RJ') returning id as c2 \gset
insert into appintura2.cores (tenant_id, codigo_ral, nome_comercial, fabricante, tipo, textura, brilho, rendimento_teorico_g_m2, custo_kg, lote, validade)
values (:'t1','RAL9005','Preto','WEG','poliester','lisa','fosco',120,38.5,'L1',current_date+365) returning id as cor1 \gset

\echo '=========== A. AUTENTICACAO ==========='
select 'A01 '||case when (select count(*) from appintura2.autenticar('henrique.rufino@aptechinfo.com.br','AP@Tech#2022*!'))=1 then 'PASS' else 'FAIL' end||' | login com senha correta';
select 'A02 '||case when (select count(*) from appintura2.autenticar('HENRIQUE.RUFINO@APTECHINFO.COM.BR','AP@Tech#2022*!'))=1 then 'PASS' else 'FAIL' end||' | e-mail case-insensitive';
select 'A03 '||case when (select count(*) from appintura2.autenticar('henrique.rufino@aptechinfo.com.br','errada'))=0 then 'PASS' else 'FAIL' end||' | senha errada recusada';
select 'A04 '||case when (select count(*) from appintura2.autenticar('naoexiste@x.com','qualquer'))=0 then 'PASS' else 'FAIL' end||' | e-mail inexistente recusado';
update appintura2.usuarios set ativo=false where id=:'uid2';
select 'A05 '||case when (select count(*) from appintura2.autenticar('outro@b.com','senha-forte-1'))=0 then 'PASS' else 'FAIL' end||' | usuario inativo recusado';
update appintura2.usuarios set ativo=true where id=:'uid2';
select 'A06 '||case when (select senha_hash from appintura2.usuarios where id=:'uid2') like '$2a$%' then 'PASS' else 'FAIL' end||' | senha gravada em bcrypt';
do $blk$ begin perform appintura2.criar_usuario('curta@x.com','1234','X'); raise notice 'A07 FAIL | aceitou senha curta';
exception when others then raise notice 'A07 PASS | senha curta recusada'; end $blk$;

\echo '=========== B. RLS / MULTI-TENANT ==========='
select set_config('request.jwt.claims', json_build_object('sub', :'uid','role','authenticated')::text, true) as _cfg \gset
set local role authenticated;
-- Conta RELATIVA, nao absoluta: a suite roda contra a base real, que tem dados
-- de uso. Fixar em 1 so passava com o banco vazio, e um teste assim envelhece
-- mal -- quebra sem que nada tenha piorado no produto.
select 'B01 '||case when (select count(*) from appintura2.clientes where cnpj_cpf='55666777000188')=0
                     and (select count(*) from appintura2.clientes where cnpj_cpf='11222333000144')=1
                then 'PASS' else 'FAIL' end||' | enxerga o cliente do proprio tenant e NAO o do alheio';
select 'B02 '||case when (select count(*) from appintura2.tenants)=1 then 'PASS' else 'FAIL' end||' | so enxerga o proprio tenant';
do $blk$ begin insert into appintura2.clientes (tenant_id, razao_social, cnpj_cpf, uf) values ((select id from appintura2.tenants where cnpj='11111111000191'),'Invasor','99999999000199','SP');
  raise notice 'B03 FAIL | gravou em tenant alheio'; exception when others then raise notice 'B03 PASS | insert em tenant alheio barrado'; end $blk$;
select 'B04 '||case when (select count(*) from appintura2.get_user_tenant_ids())=1 then 'PASS' else 'FAIL' end||' | get_user_tenant_ids resolve 1 empresa';
select 'A08 '||case when appintura2.alterar_senha('errada','nova-senha-123')=false then 'PASS' else 'FAIL' end||' | alterar_senha exige a senha atual';
select 'B05 '||case when appintura2.usuario_atual()=:'uid' then 'PASS' else 'FAIL' end||' | usuario_atual le o sub do JWT';
reset role;

\echo '=========== C. STORE GENERICO (CRUD) ==========='
set local role authenticated;
insert into appintura2.transportadoras (tenant_id, nome, cnpj) values (:'t1','Transp X','12345678000199') returning id as tr1 \gset
select 'C01 '||case when (select nome from appintura2.transportadoras where id=:'tr1')='Transp X' then 'PASS' else 'FAIL' end||' | insert simples';
update appintura2.transportadoras set nome='Transp Y' where id=:'tr1';
select 'C02 '||case when (select nome from appintura2.transportadoras where id=:'tr1')='Transp Y' then 'PASS' else 'FAIL' end||' | update simples';
delete from appintura2.transportadoras where id=:'tr1';
select 'C03 '||case when (select count(*) from appintura2.transportadoras where id=:'tr1')=0 then 'PASS' else 'FAIL' end||' | delete simples';
reset role;

\echo '=========== D. AGREGADOS (RPC) ==========='
set local role authenticated;
select appintura2.salvar_tabela_preco(:'t1', '{"nome":"T1"}'::jsonb,
  jsonb_build_array(jsonb_build_object('tipo_acabamento','Liso','unidade','m2','valor',50))) as tp \gset
select 'D01 '||case when (select count(*) from appintura2.tabela_preco_itens where tabela_preco_id=:'tp')=1 then 'PASS' else 'FAIL' end||' | tabela de preco grava pai+filho';
select appintura2.salvar_tabela_preco(:'t1', '{"nome":"T2"}'::jsonb, null, :'tp') as _d2 \gset
select 'D02 '||case when (select count(*) from appintura2.tabela_preco_itens where tabela_preco_id=:'tp')=1 and (select nome from appintura2.tabelas_preco where id=:'tp')='T2' then 'PASS' else 'FAIL' end||' | p_itens nulo preserva filhos';
select appintura2.salvar_tabela_preco(:'t1', '{}'::jsonb, '[]'::jsonb, :'tp') as _d3 \gset
select 'D03 '||case when (select count(*) from appintura2.tabela_preco_itens where tabela_preco_id=:'tp')=0 and (select nome from appintura2.tabelas_preco where id=:'tp')='T2' then 'PASS' else 'FAIL' end||' | lista vazia esvazia e nome preservado';
do $blk$ begin perform appintura2.salvar_tabela_preco((select id from appintura2.tenants where cnpj='11111111000191'),'{"nome":"x"}'::jsonb,'[]'::jsonb);
  raise notice 'D04 FAIL | aceitou tenant alheio'; exception when insufficient_privilege then raise notice 'D04 PASS | tenant alheio recusado'; end $blk$;

select appintura2.salvar_recebimento(:'t1', jsonb_build_object('cliente_id', :'c1'),
  jsonb_build_array(jsonb_build_object('descricao','Portao','quantidade',2))) as r1 \gset
-- O numero esperado e o maior que ja existia + 1, e nao literalmente 1: a base
-- real ja tem romaneios emitidos.
select 'D05 '||case when (select numero from appintura2.romaneios_recebimento where id=:'r1')
                    = (select coalesce(max(numero),0) from appintura2.romaneios_recebimento where tenant_id=:'t1' and id<>:'r1') + 1
                then 'PASS' else 'FAIL' end||' | numero sequencial por tenant via trigger';
select 'D06 '||case when (select conferente_id from appintura2.romaneios_recebimento where id=:'r1')=:'uid' then 'PASS' else 'FAIL' end||' | conferente vem da sessao, nao do corpo';
do $blk$ declare v uuid; begin select id into v from appintura2.romaneios_recebimento order by created_at desc limit 1;
  perform appintura2.salvar_recebimento((select id from appintura2.tenants where cnpj='36471917000111'), '{}'::jsonb, '[]'::jsonb, v);
  raise notice 'D07 FAIL | deixou trocar itens de romaneio emitido';
exception when insufficient_privilege then raise notice 'D07 PASS | itens de romaneio sao imutaveis'; end $blk$;
reset role;
rollback;

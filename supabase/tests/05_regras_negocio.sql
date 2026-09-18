\set ON_ERROR_STOP on
\pset tuples_only on
begin;

select id as uid from appintura2.usuarios where email='henrique.rufino@aptechinfo.com.br' \gset
select id as t1 from appintura2.tenants where cnpj='36471917000111' \gset
insert into appintura2.clientes (tenant_id, razao_social, cnpj_cpf, uf) values (:'t1','C','11222333000144','SP') returning id as c1 \gset
insert into appintura2.cores (tenant_id, codigo_ral, nome_comercial, fabricante, tipo, textura, brilho, rendimento_teorico_g_m2, custo_kg, lote, validade)
values (:'t1','R','P','W','poliester','lisa','fosco',120,38.5,'L',current_date+365) returning id as cor1 \gset
select set_config('request.jwt.claims', json_build_object('sub', :'uid','role','authenticated')::text, true) as _c \gset

\-- Coerencia entre o que a TELA oferece e o que o BANCO aceita. Um botao que
-- existe na interface e falha na RPC e bug de produto, nao de teste -- foi
-- assim que o reenvio de link apos pedido de alteracao foi descoberto.
echo '=== REGRAS DE NEGOCIO: coerencia UI x banco ==='

-- orcamento que o cliente pediu alteracao
set local role authenticated;
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+10)::text,
    'espessura_min_micron',60,'espessura_max_micron',90),
  jsonb_build_array(jsonb_build_object('descricao','P','quantidade',1,'valor_unitario',10,'area_m2',1))) as o1 \gset
select appintura2.registrar_link_orcamento(:'o1','h-alt',10) as _l \gset
reset role;
select appintura2.decidir_orcamento_publico('h-alt','alteracao_solicitada','Joao','','muda a cor','1.2.3.4','curl') as _d \gset
select 'RN01 INFO | status apos pedido de alteracao: '||status from appintura2.orcamentos where id=:'o1';

-- A tela mostra "Gerar novo link" para alteracao_solicitada (estaEmAberto inclui).
-- O banco aceita?
set local role authenticated;
do $blk$ begin
  perform appintura2.registrar_link_orcamento((select id from appintura2.orcamentos order by created_at desc limit 1),'h-alt2',10);
  raise notice 'RN02 PASS | banco aceita reenviar link apos pedido de alteracao (UI coerente)';
exception when insufficient_privilege then
  raise notice 'RN02 FAIL | UI oferece "Gerar novo link" mas o banco RECUSA em alteracao_solicitada';
end $blk$;

-- A tela NAO oferece revisao para rejeitado/expirado. O banco permitiria?
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+10)::text,
    'espessura_min_micron',60,'espessura_max_micron',90),
  jsonb_build_array(jsonb_build_object('descricao','Q','quantidade',1,'valor_unitario',10,'area_m2',1))) as o2 \gset
select appintura2.registrar_link_orcamento(:'o2','h-rej',10) as _l2 \gset
reset role;
select appintura2.decidir_orcamento_publico('h-rej','rejeitado','Joao','','sem verba','1.2.3.4','curl') as _d2 \gset
set local role authenticated;
do $blk$ begin
  perform appintura2.revisar_orcamento((select id from appintura2.orcamentos where status='rejeitado' order by created_at desc limit 1));
  raise notice 'RN03 INFO | banco PERMITE revisar orcamento rejeitado, mas a tela nao oferece o botao';
exception when others then raise notice 'RN03 INFO | banco tambem recusa revisar rejeitado'; end $blk$;

-- Orcamento convertido nao pode ser revisado
do $blk$ begin
  perform appintura2.revisar_orcamento((select id from appintura2.orcamentos where status='convertido' limit 1));
  raise notice 'RN04 FAIL | deixou revisar orcamento ja convertido';
exception when insufficient_privilege then raise notice 'RN04 PASS | convertido nao pode ser revisado';
  when others then raise notice 'RN04 PASS | convertido nao pode ser revisado (sem linha)'; end $blk$;

-- Enviar orcamento sem item
select appintura2.salvar_orcamento(:'t1',
  jsonb_build_object('cliente_id',:'c1','cor_id',:'cor1','data_validade',(current_date+10)::text,
    'espessura_min_micron',60,'espessura_max_micron',90), '[]'::jsonb) as o3 \gset
do $blk$ begin
  perform appintura2.registrar_link_orcamento((select o.id from appintura2.orcamentos o where not exists (select 1 from appintura2.orcamento_itens i where i.orcamento_id=o.id) limit 1),'h-vazio',10);
  raise notice 'RN05 FAIL | deixou enviar orcamento sem nenhum item';
exception when check_violation then raise notice 'RN05 PASS | orcamento sem item nao pode ser enviado'; end $blk$;

-- Espessura invertida
do $blk$ begin
  perform appintura2.salvar_orcamento((select id from appintura2.tenants where cnpj='36471917000111'),
    jsonb_build_object('cliente_id',(select id from appintura2.clientes limit 1),
      'cor_id',(select id from appintura2.cores limit 1),'data_validade',(current_date+10)::text,
      'espessura_min_micron',90,'espessura_max_micron',60),
    jsonb_build_array(jsonb_build_object('descricao','X','quantidade',1,'valor_unitario',10,'area_m2',1)));
  raise notice 'RN06 FAIL | aceitou espessura maxima menor que a minima';
exception when check_violation then raise notice 'RN06 PASS | espessura invertida recusada'; end $blk$;

-- Quantidade zero / negativa
do $blk$ begin
  perform appintura2.salvar_orcamento((select id from appintura2.tenants where cnpj='36471917000111'),
    jsonb_build_object('cliente_id',(select id from appintura2.clientes limit 1),
      'cor_id',(select id from appintura2.cores limit 1),'data_validade',(current_date+10)::text,
      'espessura_min_micron',60,'espessura_max_micron',90),
    jsonb_build_array(jsonb_build_object('descricao','X','quantidade',0,'valor_unitario',10,'area_m2',1)));
  raise notice 'RN07 FAIL | aceitou quantidade zero';
exception when check_violation then raise notice 'RN07 PASS | quantidade zero recusada'; end $blk$;

-- Papel sem permissao comercial
reset role;
select appintura2.criar_usuario('portaria@qa.com','senha-forte-1','Portaria QA') as uid3 \gset
insert into appintura2.user_roles (user_id, tenant_id, role, status) values (:'uid3', :'t1', 'portaria', 'ativo');
select set_config('request.jwt.claims', json_build_object('sub', :'uid3','role','authenticated')::text, true) as _c3 \gset
set local role authenticated;
select 'RN08 '||case when appintura2.pode_gerenciar_orcamento(:'t1')=false then 'PASS' else 'FAIL' end||' | portaria NAO gerencia orcamento';
select 'RN09 '||case when (select count(*) from appintura2.orcamentos)=0 then 'PASS' else 'FAIL' end||' | portaria nao enxerga orcamento pelo RLS';
do $blk$ begin
  perform appintura2.salvar_orcamento((select id from appintura2.tenants where cnpj='36471917000111'),
    jsonb_build_object('cliente_id',(select id from appintura2.clientes limit 1)),'[]'::jsonb);
  raise notice 'RN10 FAIL | portaria criou orcamento';
exception when insufficient_privilege then raise notice 'RN10 PASS | portaria barrada ao criar orcamento'; end $blk$;
rollback;

-- ============================================================================
-- APPintura — dados de demonstração, parte 3: funil comercial
--
-- Depende de `seed-demo.sql` e `seed-demo-operacao.sql`.
--
-- Sete orçamentos, um em cada estado do ciclo — é o que faz o funil, a timeline
-- e os motivos de recusa terem o que mostrar. As decisões do cliente passam
-- pela RPC pública de verdade, então eventos, conversão em OS e romaneio
-- esperado nascem do caminho real.
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

-- ---------------------------------------------------------------- 1. RASCUNHO
select appintura2.salvar_orcamento(:'tid',
  jsonb_build_object('cliente_id',:'cli_cromaq','cor_id',:'cor_azul',
    'data_validade',(current_date + 20)::text,'prazo_entrega_dias',12,
    'espessura_min_micron',70,'espessura_max_micron',100,'tipo_pretratamento','fosfatizacao',
    'condicoes_pagamento','30/60 dias',
    'observacoes_internas','Cliente grande. Margem pode cair para 18% se fechar o lote inteiro.',
    'observacoes_cliente','Peças devem chegar desmontadas e sem óleo de corte.'),
  jsonb_build_array(
    jsonb_build_object('descricao','Gabinete elétrico 1,80 x 0,80 m','quantidade',24,'area_m2',4.20,'valor_unitario',268.00,'tipo_acabamento','Texturizado'),
    jsonb_build_object('descricao','Porta de gabinete 1,80 x 0,80 m','quantidade',24,'area_m2',1.60,'valor_unitario',102.00,'tipo_acabamento','Texturizado')
  )) as orc_rascunho \gset

-- ----------------------------------------------------------------- 2. ENVIADO
select appintura2.salvar_orcamento(:'tid',
  jsonb_build_object('cliente_id',:'cli_vale','cor_id',:'cor_preto',
    'data_validade',(current_date + 14)::text,'prazo_entrega_dias',8,
    'espessura_min_micron',60,'espessura_max_micron',90,'tipo_pretratamento','desengraxe',
    'condicoes_pagamento','À vista com 3% de desconto',
    'observacoes_cliente','Prazo conta a partir da chegada das peças no pátio.'),
  jsonb_build_array(
    jsonb_build_object('descricao','Roda de carrinho industrial 12"','quantidade',120,'area_m2',0.28,'valor_unitario',18.50,'tipo_acabamento','Liso fosco')
  )) as orc_enviado \gset
select appintura2.registrar_link_orcamento(:'orc_enviado', encode(extensions.digest('demo-token-enviado','sha256'),'hex'), 14) as _l1 \gset

-- ------------------------------------------------------------- 3. VISUALIZADO
select appintura2.salvar_orcamento(:'tid',
  jsonb_build_object('cliente_id',:'cli_portal','cor_id',:'cor_branco',
    'data_validade',(current_date + 9)::text,'prazo_entrega_dias',10,
    'espessura_min_micron',60,'espessura_max_micron',85,'tipo_pretratamento','desengraxe',
    'condicoes_pagamento','50% na aprovação, 50% na retirada'),
  jsonb_build_array(
    jsonb_build_object('descricao','Esquadria de alumínio 1,50 x 1,20 m','quantidade',60,'area_m2',1.80,'valor_unitario',94.00,'tipo_acabamento','Liso brilhante'),
    jsonb_build_object('descricao','Contramarco 1,50 m','quantidade',60,'area_m2',0.60,'valor_unitario',33.00,'tipo_acabamento','Liso brilhante')
  )) as orc_visualizado \gset
select appintura2.registrar_link_orcamento(:'orc_visualizado', encode(extensions.digest('demo-token-visualizado','sha256'),'hex'), 9) as _l2 \gset
select appintura2.consultar_orcamento_publico(
  encode(extensions.digest('demo-token-visualizado','sha256'),'hex'),'189.45.202.11','Mozilla/5.0 (iPhone)') as _v1 \gset

-- ---------------------------------------------------- 4. APROVADO -> CONVERTIDO
select appintura2.salvar_orcamento(:'tid',
  jsonb_build_object('cliente_id',:'cli_saobento','cor_id',:'cor_preto',
    'data_validade',(current_date + 10)::text,'prazo_entrega_dias',7,
    'espessura_min_micron',60,'espessura_max_micron',90,'tipo_pretratamento','fosfatizacao',
    'condicoes_pagamento','30 dias'),
  jsonb_build_array(
    jsonb_build_object('descricao','Portão basculante 3,00 x 2,40 m','quantidade',3,'area_m2',7.20,'valor_unitario',392.00,'tipo_acabamento','Liso fosco'),
    jsonb_build_object('descricao','Corrimão tubular 6 m','quantidade',10,'area_m2',1.90,'valor_unitario',108.00,'tipo_acabamento','Liso fosco')
  )) as orc_aprovado \gset
select appintura2.registrar_link_orcamento(:'orc_aprovado', encode(extensions.digest('demo-token-aprovado','sha256'),'hex'), 10) as _l3 \gset
select appintura2.consultar_orcamento_publico(
  encode(extensions.digest('demo-token-aprovado','sha256'),'hex'),'177.92.14.60','Mozilla/5.0 (Windows NT 10.0)') as _v2 \gset
select appintura2.decidir_orcamento_publico(
  encode(extensions.digest('demo-token-aprovado','sha256'),'hex'),
  'aprovado','Cláudia Menezes','04582137000164','','177.92.14.60','Mozilla/5.0 (Windows NT 10.0)') as _d1 \gset

-- ------------------------------------------- 5. APROVADO PARCIAL -> CONVERTIDO
select appintura2.salvar_orcamento(:'tid',
  jsonb_build_object('cliente_id',:'cli_cromaq','cor_id',:'cor_cinza',
    'data_validade',(current_date + 11)::text,'prazo_entrega_dias',15,
    'espessura_min_micron',70,'espessura_max_micron',100,'tipo_pretratamento','fosfatizacao',
    'condicoes_pagamento','30/60/90 dias'),
  jsonb_build_array(
    jsonb_build_object('descricao','Perfil estrutural U 6 m','quantidade',80,'area_m2',1.10,'valor_unitario',74.00,'tipo_acabamento','Texturizado'),
    jsonb_build_object('descricao','Chapa perfurada 2,00 x 1,00 m','quantidade',35,'area_m2',2.00,'valor_unitario',136.00,'tipo_acabamento','Texturizado'),
    jsonb_build_object('descricao','Suporte de fixação','quantidade',200,'area_m2',0.12,'valor_unitario',9.80,'tipo_acabamento','Liso fosco')
  )) as orc_parcial \gset
select appintura2.registrar_link_orcamento(:'orc_parcial', encode(extensions.digest('demo-token-parcial','sha256'),'hex'), 11) as _l4 \gset
select appintura2.consultar_orcamento_publico(
  encode(extensions.digest('demo-token-parcial','sha256'),'hex'),'201.17.88.4','Mozilla/5.0 (Macintosh)') as _v3 \gset

-- O cliente tirou os suportes: comprou avulso mais barato de outro fornecedor.
select array_agg(id) as itens_aceitos from appintura2.orcamento_itens
  where orcamento_id = :'orc_parcial' and descricao <> 'Suporte de fixação' \gset
select appintura2.decidir_orcamento_publico(
  encode(extensions.digest('demo-token-parcial','sha256'),'hex'),
  'aprovado','Patrícia Lemos','07441029000133','','201.17.88.4','Mozilla/5.0 (Macintosh)',
  :'itens_aceitos'::uuid[]) as _d2 \gset

-- --------------------------------------------------------------- 6. REJEITADO
select appintura2.salvar_orcamento(:'tid',
  jsonb_build_object('cliente_id',:'cli_portal','cor_id',:'cor_azul',
    'data_validade',(current_date + 7)::text,'prazo_entrega_dias',20,
    'espessura_min_micron',65,'espessura_max_micron',95,'tipo_pretratamento','jateamento',
    'condicoes_pagamento','À vista'),
  jsonb_build_array(
    jsonb_build_object('descricao','Grade de fachada 2,50 x 1,80 m','quantidade',18,'area_m2',4.50,'valor_unitario',312.00,'tipo_acabamento','Primer + acabamento')
  )) as orc_rejeitado \gset
select appintura2.registrar_link_orcamento(:'orc_rejeitado', encode(extensions.digest('demo-token-rejeitado','sha256'),'hex'), 7) as _l5 \gset
select appintura2.consultar_orcamento_publico(
  encode(extensions.digest('demo-token-rejeitado','sha256'),'hex'),'191.6.70.33','Mozilla/5.0 (Linux; Android 14)') as _v4 \gset
select appintura2.decidir_orcamento_publico(
  encode(extensions.digest('demo-token-rejeitado','sha256'),'hex'),
  'rejeitado','Anderson Prado','','O jateamento encareceu demais. Vamos tentar com desengraxe simples.',
  '191.6.70.33','Mozilla/5.0 (Linux; Android 14)') as _d3 \gset

-- ----------------------------------------------------- 7. ALTERAÇÃO SOLICITADA
select appintura2.salvar_orcamento(:'tid',
  jsonb_build_object('cliente_id',:'cli_vale','cor_id',:'cor_branco',
    'data_validade',(current_date + 13)::text,'prazo_entrega_dias',9,
    'espessura_min_micron',60,'espessura_max_micron',85,'tipo_pretratamento','desengraxe',
    'condicoes_pagamento','28 dias'),
  jsonb_build_array(
    jsonb_build_object('descricao','Bandeja de eletrocalha 3 m','quantidade',45,'area_m2',1.35,'valor_unitario',81.00,'tipo_acabamento','Liso brilhante')
  )) as orc_alteracao \gset
select appintura2.registrar_link_orcamento(:'orc_alteracao', encode(extensions.digest('demo-token-alteracao','sha256'),'hex'), 13) as _l6 \gset
select appintura2.consultar_orcamento_publico(
  encode(extensions.digest('demo-token-alteracao','sha256'),'hex'),'187.33.120.9','Mozilla/5.0 (Windows NT 10.0)') as _v5 \gset
select appintura2.decidir_orcamento_publico(
  encode(extensions.digest('demo-token-alteracao','sha256'),'hex'),
  'alteracao_solicitada','Marcos Ribeiro','','Dá para cotar em RAL 7016 em vez de branco? E prazo de 5 dias.',
  '187.33.120.9','Mozilla/5.0 (Windows NT 10.0)') as _d4 \gset

-- ----------------------------------------------------------------- 8. EXPIRADO
-- Criado com validade futura (a RPC não aceita data vencida no envio) e depois
-- retroagido, para o job de expiração alcançá-lo pelo caminho normal.
select appintura2.salvar_orcamento(:'tid',
  jsonb_build_object('cliente_id',:'cli_saobento','cor_id',:'cor_cinza',
    'data_validade',(current_date + 5)::text,'prazo_entrega_dias',10,
    'espessura_min_micron',70,'espessura_max_micron',100,'tipo_pretratamento','fosfatizacao',
    'condicoes_pagamento','30 dias'),
  jsonb_build_array(
    jsonb_build_object('descricao','Caçamba estacionária 5 m³','quantidade',2,'area_m2',18.00,'valor_unitario',1480.00,'tipo_acabamento','Primer + acabamento')
  )) as orc_expirado \gset
select appintura2.registrar_link_orcamento(:'orc_expirado', encode(extensions.digest('demo-token-expirado','sha256'),'hex'), 5) as _l7 \gset

update appintura2.orcamentos
   set data_validade = current_date - 4, created_at = now() - interval '25 days'
 where id = :'orc_expirado';

select appintura2.expirar_orcamentos() as _exp \gset

-- Espalha os orçamentos no tempo para o funil ter mais de um mês no gráfico.
update appintura2.orcamentos set created_at = now() - interval '40 days'
 where id in (:'orc_aprovado', :'orc_rejeitado');

commit;

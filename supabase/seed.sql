-- ============================================================================
-- APPintura — seed da Fase 0 (ambiente local / desenvolvimento)
--
-- Os UUIDs abaixo são os mesmos de `src/mocks/seed.ts`, para que o mock do
-- frontend e o banco local descrevam a mesma realidade.
--
-- NÃO rodar em produção.
-- ============================================================================

insert into public.tenants (id, razao_social, nome_fantasia, cnpj, plano, created_at)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Metalcor Pintura Eletrostática Ltda',
    'Metalcor Matriz',
    '18452093000150',
    'profissional',
    '2024-03-11T13:20:00Z'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Metalcor Acabamentos Industriais Ltda',
    'Metalcor Filial Sul',
    '18452093000231',
    'essencial',
    '2025-01-28T10:05:00Z'
  )
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- user_roles depende de linhas reais em auth.users, que não são criadas por SQL
-- puro. Crie os usuários primeiro (Studio local, ou auth.admin.createUser via
-- script) e então rode o bloco abaixo, que resolve o user_id pelo e-mail.
--
-- Usuários esperados (senha de desenvolvimento: appintura):
--   marina@metalcor.com.br   -> admin na Matriz E na Filial Sul (multi-CNPJ)
--   rogerio@metalcor.com.br  -> gestor_producao na Matriz
--   cleiton@metalcor.com.br  -> portaria na Matriz
-- ----------------------------------------------------------------------------

insert into public.user_roles (user_id, tenant_id, role, status)
select u.id, v.tenant_id, v.role, 'ativo'::public.vinculo_status
from (
  values
    ('marina@metalcor.com.br',  '11111111-1111-4111-8111-111111111111'::uuid, 'admin'::public.app_role),
    ('marina@metalcor.com.br',  '22222222-2222-4222-8222-222222222222'::uuid, 'admin'::public.app_role),
    ('rogerio@metalcor.com.br', '11111111-1111-4111-8111-111111111111'::uuid, 'gestor_producao'::public.app_role),
    ('cleiton@metalcor.com.br', '11111111-1111-4111-8111-111111111111'::uuid, 'portaria'::public.app_role)
) as v (email, tenant_id, role)
join auth.users u on u.email = v.email
on conflict (user_id, tenant_id) do nothing;

-- ============================================================================
-- Fase 1 — Cadastros (mesmos registros de `src/mocks/cadastros-seed.ts`).
-- Só a Matriz recebe cadastro; a Filial Sul fica vazia de propósito.
-- ============================================================================

insert into public.tabelas_preco (id, tenant_id, nome, ativa, created_at)
values
  ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Tabela padrão 2026', true, '2026-01-08T12:00:00Z'),
  ('cccccccc-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Contrato Vale do Aço', true, '2026-03-02T12:00:00Z')
on conflict (id) do nothing;

insert into public.tabela_preco_itens (id, tabela_preco_id, tipo_acabamento, unidade, valor)
values
  ('dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'Pintura lisa poliéster', 'm2', 48.50),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001', 'Pintura texturizada', 'm2', 56.00),
  ('dddddddd-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-000000000001', 'Primer epóxi + acabamento', 'm2', 72.00),
  ('dddddddd-0000-4000-8000-000000000004', 'cccccccc-0000-4000-8000-000000000001', 'Peça pequena avulsa (até 0,3 m²)', 'peca', 18.00),
  ('dddddddd-0000-4000-8000-000000000005', 'cccccccc-0000-4000-8000-000000000002', 'Pintura lisa poliéster', 'm2', 41.00),
  ('dddddddd-0000-4000-8000-000000000006', 'cccccccc-0000-4000-8000-000000000002', 'Portão de correr até 3 m', 'peca', 220.00)
on conflict (id) do nothing;

insert into public.clientes (
  id, tenant_id, razao_social, cnpj_cpf, contato_nome, contato_telefone, contato_email,
  cep, logradouro, numero, complemento, bairro, cidade, uf,
  tabela_preco_id, limite_credito, dias_inadimplencia_atual, ativo, created_at
)
values
  ('eeeeeeee-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Esquadrias Andrade Ltda', '47291038000124', 'Solange Andrade', '31988740125', 'compras@esquadriasandrade.com.br', '32210140', 'Rua dos Metalúrgicos', '480', 'Galpão 3', 'Distrito Industrial', 'Contagem', 'MG', 'cccccccc-0000-4000-8000-000000000001', 45000, 0, true, '2024-05-14T12:00:00Z'),
  ('eeeeeeee-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Portões Vale do Aço Ltda', '61033872000140', 'Wagner Pimenta', '3133419087', 'wagner@portoesvaledoaco.com.br', '35180024', 'Avenida Siderúrgica', '2115', '', 'Cidade Nobre', 'Ipatinga', 'MG', 'cccccccc-0000-4000-8000-000000000002', 120000, 12, true, '2024-09-03T12:00:00Z'),
  ('eeeeeeee-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Belmiro Rodas e Acessórios', '48291077312', 'Belmiro Fontes', '31991260443', 'belmiro.rodas@gmail.com', '30640150', 'Rua Padre Eustáquio', '77', 'Fundos', 'Carlos Prates', 'Belo Horizonte', 'MG', 'cccccccc-0000-4000-8000-000000000001', 8000, 0, true, '2025-07-21T12:00:00Z')
on conflict (id) do nothing;

insert into public.cores (
  id, tenant_id, codigo_ral, nome_comercial, fabricante, tipo, textura, brilho,
  rendimento_teorico_g_m2, custo_kg, estoque_atual, estoque_minimo, lote, validade, created_at
)
values
  ('ffffffff-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'RAL 9005', 'Preto Sinal', 'Sherwin-Williams', 'poliester', 'lisa', 'fosco', 92, 34.90, 48, 25, 'L-2609A', '2027-04-30', '2026-02-10T12:00:00Z'),
  ('ffffffff-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'RAL 9003', 'Branco Sinal', 'Axalta', 'poliester', 'lisa', 'brilhante', 88, 32.50, 18, 30, 'L-2604C', '2027-02-12', '2026-02-10T12:00:00Z'),
  ('ffffffff-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'RAL 7016', 'Cinza Antracite', 'WEG', 'hibrida', 'texturizada', 'semibrilho', 105, 38.20, 62, 20, 'L-2607B', '2026-10-05', '2026-04-18T12:00:00Z'),
  ('ffffffff-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'RAL 5010', 'Azul Genciana', 'Tiger Drylac', 'poliester', 'lisa', 'brilhante', 95, 41.00, 12, 15, 'L-2512F', '2026-08-20', '2025-12-05T12:00:00Z'),
  ('ffffffff-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'RAL 3020', 'Vermelho Trânsito', 'Akzo Nobel', 'epoxi', 'lisa', 'brilhante', 98, 36.75, 35, 15, 'L-2608D', '2027-06-18', '2026-06-01T12:00:00Z')
on conflict (id) do nothing;

insert into public.insumos_quimicos (
  id, tenant_id, nome, tipo, estoque_atual, estoque_minimo, unidade_medida, validade, fornecedor, created_at
)
values
  ('aaaaaaaa-1111-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Desengraxante alcalino DX-40', 'desengraxante', 320, 150, 'L', '2027-01-15', 'Quimatec Produtos Químicos', '2026-03-12T12:00:00Z'),
  ('aaaaaaaa-1111-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Fosfato de ferro FF-200', 'fosfatizante', 85, 100, 'kg', '2026-11-30', 'Quimatec Produtos Químicos', '2026-03-12T12:00:00Z'),
  ('aaaaaaaa-1111-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Passivador selante PS-10', 'passivador', 40, 20, 'L', '2026-09-25', 'Bautec Químicos', '2026-05-20T12:00:00Z')
on conflict (id) do nothing;

insert into public.transportadoras (
  id, tenant_id, nome, cnpj, contato_nome, contato_telefone, contato_email, created_at
)
values
  ('bbbbbbbb-1111-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Transportes Girassol', '28904451000172', 'Divina Rocha', '3132419560', 'operacao@transgirassol.com.br', '2024-06-02T12:00:00Z'),
  ('bbbbbbbb-1111-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Log Minas Cargas', '33567129000135', 'Éder Salgado', '31987330214', 'eder@logminas.com.br', '2025-02-17T12:00:00Z')
on conflict (id) do nothing;

-- ============================================================================
-- Fase 2 — Custódia (espelha `src/mocks/custodia-seed.ts`).
--
-- As fotos NÃO são semeadas: o binário precisa existir no bucket
-- `romaneios-fotos` antes de `romaneio_fotos` apontar para ele. Suba os arquivos
-- e insira os metadados depois, ou registre pela própria tela.
--
-- `numero` é informado explicitamente para casar com o mock; o trigger de
-- numeração só age quando o campo vem nulo. Por isso o contador é sincronizado
-- no final.
-- ============================================================================

insert into public.configuracoes_tenant (tenant_id, dias_alerta_custodia)
values ('11111111-1111-4111-8111-111111111111', 15)
on conflict (tenant_id) do nothing;

insert into public.romaneios_recebimento (
  id, tenant_id, numero, cliente_id, transportadora_id, data_hora,
  documento_numero, documento_serie, conferente_id, status, observacao,
  assinatura_nome, created_at
)
select
  v.id, v.tenant_id, v.numero, v.cliente_id, v.transportadora_id, v.data_hora,
  v.documento_numero, v.documento_serie, u.id, v.status, v.observacao,
  v.assinatura_nome, v.data_hora
from (
  values
    ('a1a1a1a1-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 1,
     'eeeeeeee-0000-4000-8000-000000000001'::uuid, 'bbbbbbbb-1111-4000-8000-000000000001'::uuid,
     '2026-09-10T08:40:00Z'::timestamptz, '10422', '1', 'recebido_conferido'::public.status_recebimento,
     '', 'Jair Peixoto'),
    ('a1a1a1a1-0000-4000-8000-000000000002'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 2,
     'eeeeeeee-0000-4000-8000-000000000002'::uuid, null::uuid,
     '2026-08-20T14:15:00Z'::timestamptz, '8891', '2', 'recebido_com_ressalva'::public.status_recebimento,
     'Veículo próprio do cliente. Um portão chegou com avaria aparente.', 'Wagner Pimenta')
) as v (id, tenant_id, numero, cliente_id, transportadora_id, data_hora,
        documento_numero, documento_serie, status, observacao, assinatura_nome)
cross join (select id from auth.users where email = 'cleiton@metalcor.com.br') u
on conflict (id) do nothing;

insert into public.romaneio_recebimento_itens (
  id, romaneio_id, descricao, quantidade, unidade, peso_kg, condicao_chegada, observacao
)
values
  ('b1b1b1b1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'Perfil de alumínio 6063 — barra de 3 m', 120, 'peca', 340, 'integra', ''),
  ('b1b1b1b1-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000001', 'Cantoneira de alumínio 1"', 60, 'peca', 85, 'integra', ''),
  ('b1b1b1b1-0000-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000002', 'Portão de correr 3,5 m x 2,2 m', 4, 'conjunto', 260, 'avariada', 'Uma unidade com a trave inferior amassada, fotografada na chegada.'),
  ('b1b1b1b1-0000-4000-8000-000000000004', 'a1a1a1a1-0000-4000-8000-000000000002', 'Grade de proteção 1,2 m x 1,0 m', 24, 'peca', 190, 'integra', '')
on conflict (id) do nothing;

insert into public.romaneios_devolucao (
  id, tenant_id, numero, cliente_id, data_hora, retirado_por_nome,
  retirado_por_documento, transportadora_id, placa, status, responsavel_id, created_at
)
select
  'c1c1c1c1-0000-4000-8000-000000000001'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  1,
  'eeeeeeee-0000-4000-8000-000000000001'::uuid,
  '2026-09-12T16:30:00Z'::timestamptz,
  'Jair Peixoto',
  '48291077312',
  'bbbbbbbb-1111-4000-8000-000000000001'::uuid,
  'RQK7A21',
  'retirado_parcial'::public.status_devolucao,
  u.id,
  '2026-09-12T16:30:00Z'::timestamptz
from (select id from auth.users where email = 'cleiton@metalcor.com.br') u
on conflict (id) do nothing;

insert into public.romaneio_devolucao_recebimentos (devolucao_id, recebimento_id)
values ('c1c1c1c1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001')
on conflict do nothing;

insert into public.romaneio_devolucao_itens (
  id, devolucao_id, recebimento_item_id, quantidade, condicao_saida, justificativa
)
values
  ('d1d1d1d1-0000-4000-8000-000000000001', 'c1c1c1c1-0000-4000-8000-000000000001', 'b1b1b1b1-0000-4000-8000-000000000001', 120, 'integra', ''),
  ('d1d1d1d1-0000-4000-8000-000000000002', 'c1c1c1c1-0000-4000-8000-000000000001', 'b1b1b1b1-0000-4000-8000-000000000002', 40, 'integra', '20 peças retidas para retrabalho de espessura.')
on conflict (id) do nothing;

-- Sincroniza o contador para que o próximo romaneio criado pela tela seja o nº 3
-- (recebimento) e o nº 2 (devolução), e não colida com os números semeados.
insert into public.tenant_sequencias (tenant_id, tipo, ultimo_numero)
values
  ('11111111-1111-4111-8111-111111111111', 'recebimento', 2),
  ('11111111-1111-4111-8111-111111111111', 'devolucao', 1)
on conflict (tenant_id, tipo) do update set ultimo_numero = excluded.ultimo_numero;

-- ============================================================================
-- Fase 3 — Ordens de serviço (espelha `src/mocks/producao-seed.ts`).
--
-- O histórico NÃO é semeado: o trigger `ordens_servico_historico_insert` grava a
-- abertura sozinho. A trilha completa do mock existe só para a demonstração no
-- frontend.
-- ============================================================================

insert into public.ordens_servico (
  id, tenant_id, numero, cliente_id, romaneio_recebimento_id, data_entrada,
  previsao_entrega, urgencia, status, cor_id, espessura_min_micron,
  espessura_max_micron, tipo_pretratamento, observacao, created_at
)
values
  ('aa000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 'eeeeeeee-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', '2026-09-10', '2026-09-18', 'normal', 'recebido', 'ffffffff-0000-4000-8000-000000000001', 60, 80, 'desengraxe', 'Cliente pediu acabamento fosco uniforme, sem casca de laranja.', '2026-09-10T09:10:00Z'),
  ('aa000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 2, 'eeeeeeee-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000002', '2026-08-20', '2026-09-11', 'urgente', 'pre_tratamento', 'ffffffff-0000-4000-8000-000000000003', 70, 100, 'fosfatizacao', 'Portão com avaria registrada na entrada — conferir antes da cabine.', '2026-08-20T15:00:00Z'),
  ('aa000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 3, 'eeeeeeee-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000002', '2026-08-20', '2026-09-19', 'normal', 'aplicacao_po', 'ffffffff-0000-4000-8000-000000000005', 65, 90, 'fosfatizacao', '', '2026-08-20T15:05:00Z'),
  ('aa000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 4, 'eeeeeeee-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000002', '2026-08-20', '2026-09-16', 'alta', 'controle_qualidade', 'ffffffff-0000-4000-8000-000000000003', 70, 100, 'fosfatizacao', '', '2026-08-20T15:10:00Z'),
  ('aa000001-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 5, 'eeeeeeee-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', '2026-09-10', '2026-09-15', 'normal', 'aguardando_retirada', 'ffffffff-0000-4000-8000-000000000002', 60, 85, 'desengraxe', '', '2026-09-10T09:20:00Z'),
  ('aa000001-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 6, 'eeeeeeee-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', '2026-09-10', '2026-09-20', 'alta', 'retrabalho', 'ffffffff-0000-4000-8000-000000000004', 70, 95, 'desengraxe', 'Espessura abaixo do mínimo em 6 peças na primeira inspeção.', '2026-09-10T09:30:00Z')
on conflict (id) do nothing;

insert into public.os_itens (id, os_id, descricao, quantidade, area_m2)
values
  ('11110001-0000-4000-8000-000000000001', 'aa000001-0000-4000-8000-000000000001', 'Perfil de alumínio 6063 — barra de 3 m', 60, 43.2),
  ('11110001-0000-4000-8000-000000000002', 'aa000001-0000-4000-8000-000000000002', 'Portão de correr 3,5 m x 2,2 m', 4, 61.6),
  ('11110001-0000-4000-8000-000000000003', 'aa000001-0000-4000-8000-000000000003', 'Grade de proteção 1,2 m x 1,0 m', 14, 33.6),
  ('11110001-0000-4000-8000-000000000004', 'aa000001-0000-4000-8000-000000000004', 'Grade de proteção 1,2 m x 1,0 m', 10, 24),
  ('11110001-0000-4000-8000-000000000005', 'aa000001-0000-4000-8000-000000000005', 'Perfil de alumínio 6063 — barra de 3 m', 60, 43.2),
  ('11110001-0000-4000-8000-000000000006', 'aa000001-0000-4000-8000-000000000006', 'Cantoneira de alumínio 1"', 20, 9.6)
on conflict (id) do nothing;

insert into public.tenant_sequencias (tenant_id, tipo, ultimo_numero)
values ('11111111-1111-4111-8111-111111111111', 'os', 6)
on conflict (tenant_id, tipo) do update set ultimo_numero = excluded.ultimo_numero;

-- ============================================================================
-- Fase 4 — Estoque e qualidade (espelha `src/mocks/estoque-seed.ts`).
--
-- ATENÇÃO: a trigger `estoque_movimentacoes_aplicar` mexe no saldo a cada
-- inserção. O seed das Fases 1 e 4 juntos deixaria o saldo somado duas vezes —
-- por isso o bloco no fim recalcula `estoque_atual` a partir dos movimentos.
-- ============================================================================

insert into public.estoque_movimentacoes (
  id, tenant_id, tipo_item, item_id, item_descricao, tipo_movimento,
  quantidade, unidade, os_id, lote, motivo_perda, observacao, responsavel_id, data
)
select
  v.id, v.tenant_id, v.tipo_item, v.item_id, v.item_descricao, v.tipo_movimento,
  v.quantidade, v.unidade, v.os_id, v.lote, v.motivo_perda, v.observacao, u.id, v.data
from (
  values
    ('m0000001-0000-4000-8000-000000000001'::uuid, 'tinta'::public.tipo_item_estoque, 'ffffffff-0000-4000-8000-000000000001'::uuid, 'RAL 9005 Preto Sinal', 'entrada'::public.tipo_movimento_estoque, 75, 'kg', null::uuid, 'L-2609A', null::public.motivo_perda, 'Compra NF 44120 — Sherwin-Williams.', '2026-02-10'::date),
    ('m0000001-0000-4000-8000-000000000002'::uuid, 'tinta', 'ffffffff-0000-4000-8000-000000000003', 'RAL 7016 Cinza Antracite', 'entrada', 80, 'kg', null, 'L-2607B', null, 'Compra NF 44987 — WEG.', '2026-04-18'),
    ('m0000001-0000-4000-8000-000000000003'::uuid, 'tinta', 'ffffffff-0000-4000-8000-000000000003', 'RAL 7016 Cinza Antracite', 'saida', 2.52, 'kg', 'aa000001-0000-4000-8000-000000000004', 'L-2607B', null, 'Baixa automática na entrada em aplicação de pó.', '2026-09-09'),
    ('m0000001-0000-4000-8000-000000000004'::uuid, 'tinta', 'ffffffff-0000-4000-8000-000000000002', 'RAL 9003 Branco Sinal', 'saida', 3.8, 'kg', 'aa000001-0000-4000-8000-000000000005', 'L-2604C', null, 'Baixa automática na entrada em aplicação de pó.', '2026-09-11'),
    ('m0000001-0000-4000-8000-000000000005'::uuid, 'tinta', 'ffffffff-0000-4000-8000-000000000005', 'RAL 3020 Vermelho Trânsito', 'saida', 3.29, 'kg', 'aa000001-0000-4000-8000-000000000003', 'L-2608D', null, 'Baixa automática na entrada em aplicação de pó.', '2026-09-13'),
    ('m0000001-0000-4000-8000-000000000006'::uuid, 'tinta', 'ffffffff-0000-4000-8000-000000000004', 'RAL 5010 Azul Genciana', 'perda', 6, 'kg', null, 'L-2512F', 'vencimento', 'Lote L-2512F vencido em 20/08. Descartado conforme procedimento.', '2026-08-25'),
    ('m0000001-0000-4000-8000-000000000007'::uuid, 'insumo_quimico', 'aaaaaaaa-1111-4000-8000-000000000001', 'Desengraxante alcalino DX-40', 'entrada', 400, 'L', null, 'DX-2603', null, 'Compra trimestral — Quimatec.', '2026-03-12'),
    ('m0000001-0000-4000-8000-000000000008'::uuid, 'insumo_quimico', 'aaaaaaaa-1111-4000-8000-000000000001', 'Desengraxante alcalino DX-40', 'saida', 80, 'L', null, 'DX-2603', null, 'Reposição do tanque de desengraxe.', '2026-08-30'),
    ('m0000001-0000-4000-8000-000000000009'::uuid, 'insumo_quimico', 'aaaaaaaa-1111-4000-8000-000000000002', 'Fosfato de ferro FF-200', 'saida', 15, 'kg', null, 'FF-2605', null, 'Reposição do banho de fosfatização.', '2026-09-05')
) as v (id, tipo_item, item_id, item_descricao, tipo_movimento, quantidade, unidade, os_id, lote, motivo_perda, observacao, data)
cross join lateral (select '11111111-1111-4111-8111-111111111111'::uuid as tenant_id) t
cross join (select id from auth.users where email = 'marina@metalcor.com.br') u
on conflict (id) do nothing;

insert into public.qualidade_registros (
  id, tenant_id, os_item_id, espessura_medida_micron, espessura_min_micron,
  espessura_max_micron, teste_aderencia, observacao, responsavel_id, data
)
select v.id, '11111111-1111-4111-8111-111111111111'::uuid, v.os_item_id,
       v.medida, v.minimo, v.maximo, v.aderencia, v.observacao, u.id, v.data
from (
  values
    ('q0000001-0000-4000-8000-000000000001'::uuid, '11110001-0000-4000-8000-000000000004'::uuid, 84, 70, 100, 'aprovado'::public.resultado_teste, 'Medição em 5 pontos, média 84 µm. Corte em grade classe 0.', '2026-09-12'::date),
    ('q0000001-0000-4000-8000-000000000002'::uuid, '11110001-0000-4000-8000-000000000006'::uuid, 52, 70, 95, 'aprovado', '6 de 20 peças abaixo de 60 µm nas faces internas.', '2026-09-12')
) as v (id, os_item_id, medida, minimo, maximo, aderencia, observacao, data)
cross join (select id from auth.users where email = 'marina@metalcor.com.br') u
on conflict (id) do nothing;

insert into public.nao_conformidades (
  id, tenant_id, os_item_id, tipo, causa, acao_corretiva, responsavel_id, data
)
select
  'n0000001-0000-4000-8000-000000000001'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  '11110001-0000-4000-8000-000000000006'::uuid,
  'espessura_fora_faixa'::public.tipo_nao_conformidade,
  'Peças penduradas muito próximas no gancho, criando efeito gaiola de Faraday nas faces internas.',
  'Repintar as 20 peças com espaçamento mínimo de 15 cm no transportador e revisar o ajuste de kV da pistola.',
  u.id,
  '2026-09-12'
from (select id from auth.users where email = 'marina@metalcor.com.br') u
on conflict (id) do nothing;

-- Reconcilia o saldo com os movimentos, desfazendo a soma dupla do seed.
update public.cores c
set estoque_atual = v.saldo
from (
  values
    ('ffffffff-0000-4000-8000-000000000001'::uuid, 48),
    ('ffffffff-0000-4000-8000-000000000002'::uuid, 18),
    ('ffffffff-0000-4000-8000-000000000003'::uuid, 62),
    ('ffffffff-0000-4000-8000-000000000004'::uuid, 12),
    ('ffffffff-0000-4000-8000-000000000005'::uuid, 35)
) as v (id, saldo)
where c.id = v.id;

update public.insumos_quimicos i
set estoque_atual = v.saldo
from (
  values
    ('aaaaaaaa-1111-4000-8000-000000000001'::uuid, 320),
    ('aaaaaaaa-1111-4000-8000-000000000002'::uuid, 85),
    ('aaaaaaaa-1111-4000-8000-000000000003'::uuid, 40)
) as v (id, saldo)
where i.id = v.id;

-- ============================================================================
-- Fase 5 — Financeiro (espelha `src/mocks/financeiro-seed.ts`).
-- ============================================================================

update public.configuracoes_tenant
set multa_percentual = 2,
    juros_mes_percentual = 1,
    custo_energia_gas_m2 = 4.2,
    custo_mao_obra_m2 = 9.5,
    custo_insumos_quimicos_m2 = 2.8,
    custo_depreciacao_m2 = 1.6,
    despesa_fixa_mensal = 42000
where tenant_id = '11111111-1111-4111-8111-111111111111';

insert into public.centros_custo (id, tenant_id, nome, tipo, created_at)
values
  ('cc000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Produção — cabine e forno', 'producao', '2026-01-05T12:00:00Z'),
  ('cc000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Comercial', 'comercial', '2026-01-05T12:00:00Z'),
  ('cc000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Administrativo', 'administrativo', '2026-01-05T12:00:00Z')
on conflict (id) do nothing;

insert into public.contas_receber (
  id, tenant_id, cliente_id, os_id, descricao, valor, vencimento, status,
  forma_pagamento, centro_custo_id, parcela, total_parcelas, created_at
)
values
  ('cr000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'eeeeeeee-0000-4000-8000-000000000002', 'aa000001-0000-4000-8000-000000000004', 'Pintura de grades — OS 0004', 1344, '2026-09-03', 'em_aberto', 'boleto', 'cc000001-0000-4000-8000-000000000001', null, null, '2026-08-20T12:00:00Z'),
  ('cr000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'eeeeeeee-0000-4000-8000-000000000001', 'aa000001-0000-4000-8000-000000000005', 'Pintura de perfis 6063 — OS 0005', 2095.20, '2026-09-25', 'em_aberto', 'pix', 'cc000001-0000-4000-8000-000000000001', null, null, '2026-09-12T12:00:00Z'),
  ('cr000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'eeeeeeee-0000-4000-8000-000000000001', null, 'Fechamento quinzenal — 1a quinzena de agosto', 8400, '2026-09-10', 'em_aberto', 'transferencia', 'cc000001-0000-4000-8000-000000000001', null, null, '2026-08-16T12:00:00Z'),
  ('cr000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'eeeeeeee-0000-4000-8000-000000000003', null, 'Pintura de rodas — lote avulso', 960, '2026-08-28', 'em_aberto', 'pix', 'cc000001-0000-4000-8000-000000000001', null, null, '2026-08-14T12:00:00Z'),
  ('cr000001-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'eeeeeeee-0000-4000-8000-000000000002', null, 'Contrato Vale do Aço — parcela 2/3', 12000, '2026-10-05', 'em_aberto', 'boleto', 'cc000001-0000-4000-8000-000000000001', 2, 3, '2026-08-05T12:00:00Z'),
  ('cr000001-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'eeeeeeee-0000-4000-8000-000000000003', null, 'Pintura de esquadrias — saldo renegociado', 1800, '2026-10-20', 'negociado', 'pix', 'cc000001-0000-4000-8000-000000000001', null, null, '2026-07-18T12:00:00Z'),
  ('cr000001-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'eeeeeeee-0000-4000-8000-000000000001', null, 'Fechamento quinzenal — 2a quinzena de julho', 7250, '2026-08-10', 'em_aberto', 'transferencia', 'cc000001-0000-4000-8000-000000000001', null, null, '2026-07-31T12:00:00Z')
on conflict (id) do nothing;

insert into public.contas_receber_pagamentos (id, conta_receber_id, data_pagamento, valor_pago, juros_multa)
values
  ('pg000001-0000-4000-8000-000000000001', 'cr000001-0000-4000-8000-000000000003', '2026-09-10', 4200, 0),
  ('pg000001-0000-4000-8000-000000000002', 'cr000001-0000-4000-8000-000000000004', '2026-08-27', 960, 0),
  ('pg000001-0000-4000-8000-000000000003', 'cr000001-0000-4000-8000-000000000007', '2026-08-10', 7250, 0)
on conflict (id) do nothing;

insert into public.contas_receber_cobranca_historico (
  id, conta_receber_id, data, canal, responsavel_id, resultado, observacao
)
select v.id, v.conta, v.data, v.canal, u.id, v.resultado, v.observacao
from (
  values
    ('cb000001-0000-4000-8000-000000000001'::uuid, 'cr000001-0000-4000-8000-000000000001'::uuid, '2026-09-08'::date, 'whatsapp'::public.canal_cobranca, 'promessa_pagamento'::public.resultado_cobranca, 'Wagner prometeu pagar ate dia 15.'),
    ('cb000001-0000-4000-8000-000000000002'::uuid, 'cr000001-0000-4000-8000-000000000001'::uuid, '2026-09-14'::date, 'telefone', 'sem_retorno', 'Ligacao nao atendida.'),
    ('cb000001-0000-4000-8000-000000000003'::uuid, 'cr000001-0000-4000-8000-000000000006'::uuid, '2026-09-02'::date, 'presencial', 'negociado', 'Prazo estendido para 20/10 sem juros.')
) as v (id, conta, data, canal, resultado, observacao)
cross join (select id from auth.users where email = 'marina@metalcor.com.br') u
on conflict (id) do nothing;

insert into public.contas_pagar (
  id, tenant_id, fornecedor, descricao, categoria, valor, vencimento, status,
  recorrente, centro_custo_id, data_pagamento, created_at
)
values
  ('cp000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Sherwin-Williams', 'Tinta em pó RAL 9005 — 75 kg', 'insumo_direto', 2617.50, '2026-09-20', 'em_aberto', false, 'cc000001-0000-4000-8000-000000000001', null, '2026-02-10T12:00:00Z'),
  ('cp000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Cemig', 'Energia elétrica — agosto', 'fixa', 8940, '2026-09-18', 'em_aberto', true, 'cc000001-0000-4000-8000-000000000001', null, '2026-09-01T12:00:00Z'),
  ('cp000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Quimatec Produtos Químicos', 'Desengraxante DX-40 — 400 L', 'insumo_direto', 4320, '2026-09-08', 'em_aberto', false, 'cc000001-0000-4000-8000-000000000001', null, '2026-03-12T12:00:00Z'),
  ('cp000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Contabilidade Reis', 'Honorários contábeis — setembro', 'fixa', 1850, '2026-09-30', 'em_aberto', true, 'cc000001-0000-4000-8000-000000000003', null, '2026-09-01T12:00:00Z'),
  ('cp000001-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Gasmig', 'Gás do forno — agosto', 'variavel', 5120, '2026-09-05', 'em_aberto', true, 'cc000001-0000-4000-8000-000000000001', '2026-09-04', '2026-09-01T12:00:00Z'),
  ('cp000001-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Folha de pagamento', 'Salários e encargos — setembro', 'fixa', 28400, '2026-10-05', 'em_aberto', true, 'cc000001-0000-4000-8000-000000000001', null, '2026-09-01T12:00:00Z')
on conflict (id) do nothing;

-- ============================================================================
-- Fase 6 — Ordens finalizadas (base dos indicadores de SLA e m² por mês).
--
-- As notificações NÃO são semeadas: elas nascem das triggers e do job
-- `avaliar_notificacoes_periodicas()`. Rode a função depois do seed:
--   select public.avaliar_notificacoes_periodicas();
-- ============================================================================

insert into public.ordens_servico (
  id, tenant_id, numero, cliente_id, romaneio_recebimento_id, data_entrada,
  previsao_entrega, urgencia, status, cor_id, espessura_min_micron,
  espessura_max_micron, tipo_pretratamento, observacao, created_at
)
values
  ('aa000001-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 7, 'eeeeeeee-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', '2026-07-06', '2026-07-17', 'normal', 'finalizado', 'ffffffff-0000-4000-8000-000000000001', 60, 80, 'desengraxe', '', '2026-07-06T08:00:00Z'),
  ('aa000001-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 8, 'eeeeeeee-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000002', '2026-07-20', '2026-08-05', 'alta', 'finalizado', 'ffffffff-0000-4000-8000-000000000003', 70, 100, 'fosfatizacao', 'Atraso por espera de reposição de pó cinza.', '2026-07-20T08:00:00Z'),
  ('aa000001-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 9, 'eeeeeeee-0000-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000001', '2026-08-14', '2026-08-28', 'normal', 'finalizado', 'ffffffff-0000-4000-8000-000000000005', 65, 90, 'jateamento', '', '2026-08-14T08:00:00Z')
on conflict (id) do nothing;

insert into public.os_itens (id, os_id, descricao, quantidade, area_m2)
values
  ('11110001-0000-4000-8000-000000000007', 'aa000001-0000-4000-8000-000000000007', 'Esquadria de alumínio 1,2 m x 1,4 m', 48, 161.28),
  ('11110001-0000-4000-8000-000000000008', 'aa000001-0000-4000-8000-000000000008', 'Portão pivotante 2,8 m x 2,2 m', 6, 73.92),
  ('11110001-0000-4000-8000-000000000009', 'aa000001-0000-4000-8000-000000000009', 'Roda de liga leve aro 17', 24, 28.8)
on conflict (id) do nothing;

/*
 * A trilha histórica precisa ser inserida à mão: a trigger
 * `registrar_transicao_os` só grava a abertura e as transições feitas depois.
 * Sem estas linhas, o SLA e o m² por mês ficariam sem base.
 */
insert into public.os_status_historico (os_id, de, para, responsavel_id, created_at)
select v.os_id, v.de, v.para, u.id, v.quando
from (
  values
    ('aa000001-0000-4000-8000-000000000007'::uuid, null::public.status_os, 'pre_tratamento'::public.status_os, '2026-07-07T07:30:00Z'::timestamptz),
    ('aa000001-0000-4000-8000-000000000007', 'pre_tratamento', 'aplicacao_po', '2026-07-09T09:00:00Z'),
    ('aa000001-0000-4000-8000-000000000007', 'aplicacao_po', 'cura', '2026-07-09T13:00:00Z'),
    ('aa000001-0000-4000-8000-000000000007', 'cura', 'controle_qualidade', '2026-07-10T08:30:00Z'),
    ('aa000001-0000-4000-8000-000000000007', 'controle_qualidade', 'embalagem', '2026-07-13T08:00:00Z'),
    ('aa000001-0000-4000-8000-000000000007', 'embalagem', 'aguardando_retirada', '2026-07-13T15:00:00Z'),
    ('aa000001-0000-4000-8000-000000000007', 'aguardando_retirada', 'finalizado', '2026-07-15T10:00:00Z'),
    ('aa000001-0000-4000-8000-000000000008', null, 'pre_tratamento', '2026-07-28T07:00:00Z'),
    ('aa000001-0000-4000-8000-000000000008', 'pre_tratamento', 'aplicacao_po', '2026-08-04T09:30:00Z'),
    ('aa000001-0000-4000-8000-000000000008', 'aplicacao_po', 'cura', '2026-08-04T14:00:00Z'),
    ('aa000001-0000-4000-8000-000000000008', 'cura', 'controle_qualidade', '2026-08-06T08:00:00Z'),
    ('aa000001-0000-4000-8000-000000000008', 'controle_qualidade', 'embalagem', '2026-08-10T09:00:00Z'),
    ('aa000001-0000-4000-8000-000000000008', 'embalagem', 'finalizado', '2026-08-11T16:00:00Z'),
    ('aa000001-0000-4000-8000-000000000009', null, 'pre_tratamento', '2026-08-17T07:30:00Z'),
    ('aa000001-0000-4000-8000-000000000009', 'pre_tratamento', 'aplicacao_po', '2026-08-19T10:00:00Z'),
    ('aa000001-0000-4000-8000-000000000009', 'aplicacao_po', 'cura', '2026-08-19T14:30:00Z'),
    ('aa000001-0000-4000-8000-000000000009', 'cura', 'controle_qualidade', '2026-08-20T09:00:00Z'),
    ('aa000001-0000-4000-8000-000000000009', 'controle_qualidade', 'embalagem', '2026-08-24T08:00:00Z'),
    ('aa000001-0000-4000-8000-000000000009', 'embalagem', 'finalizado', '2026-08-26T11:00:00Z')
) as v (os_id, de, para, quando)
cross join (select id from auth.users where email = 'rogerio@metalcor.com.br') u;

insert into public.estoque_movimentacoes (
  id, tenant_id, tipo_item, item_id, item_descricao, tipo_movimento,
  quantidade, unidade, os_id, lote, observacao, responsavel_id, data
)
select v.id, '11111111-1111-4111-8111-111111111111'::uuid, 'tinta'::public.tipo_item_estoque,
       v.item_id, v.descricao, 'saida'::public.tipo_movimento_estoque, v.quantidade, 'kg',
       v.os_id, v.lote, 'Baixa automática na entrada em aplicação de pó.', u.id, v.data
from (
  values
    ('m0000001-0000-4000-8000-000000000010'::uuid, 'ffffffff-0000-4000-8000-000000000001'::uuid, 'RAL 9005 Preto Sinal', 16.2, 'aa000001-0000-4000-8000-000000000007'::uuid, 'L-2609A', '2026-07-09'::date),
    ('m0000001-0000-4000-8000-000000000011'::uuid, 'ffffffff-0000-4000-8000-000000000003'::uuid, 'RAL 7016 Cinza Antracite', 8.5, 'aa000001-0000-4000-8000-000000000008'::uuid, 'L-2607B', '2026-08-04'::date),
    ('m0000001-0000-4000-8000-000000000012'::uuid, 'ffffffff-0000-4000-8000-000000000005'::uuid, 'RAL 3020 Vermelho Trânsito', 3.1, 'aa000001-0000-4000-8000-000000000009'::uuid, 'L-2608D', '2026-08-19'::date)
) as v (id, item_id, descricao, quantidade, os_id, lote, data)
cross join (select id from auth.users where email = 'rogerio@metalcor.com.br') u
on conflict (id) do nothing;

-- O contador da OS precisa acompanhar as ordens semeadas.
insert into public.tenant_sequencias (tenant_id, tipo, ultimo_numero)
values ('11111111-1111-4111-8111-111111111111', 'os', 9)
on conflict (tenant_id, tipo) do update set ultimo_numero = excluded.ultimo_numero;

-- Reconcilia os saldos depois das saídas adicionais desta fase.
update public.cores c
set estoque_atual = v.saldo
from (
  values
    ('ffffffff-0000-4000-8000-000000000001'::uuid, 48),
    ('ffffffff-0000-4000-8000-000000000002'::uuid, 18),
    ('ffffffff-0000-4000-8000-000000000003'::uuid, 62),
    ('ffffffff-0000-4000-8000-000000000004'::uuid, 12),
    ('ffffffff-0000-4000-8000-000000000005'::uuid, 35)
) as v (id, saldo)
where c.id = v.id;

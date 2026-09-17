# APPintura — Prompts para Lovable (versão revisada e fatiada em fases)

## ⚠️ Antes de começar: 1 decisão que você já resolveu

Identidade visual: herdando 100% os tokens do APFiscal (opção A). A paleta, tipografia 
e estilo abaixo já estão embutidos na Fase 0 — nenhum placeholder de laranja/âmbar 
sobrou no prompt.

**RLS por tenant**: o padrão `tenant_id = auth.jwt() -> tenant_id` do prompt original está errado em dois pontos — falta `->>` (extração como texto) e cast para uuid, e depender de custom claim no JWT é frágil (exige hook de Auth configurado). O prompt corrigido usa uma **função `get_user_tenant_id()` (security definer)** que lê de uma tabela `user_roles`, que é o padrão recomendado pela própria Supabase para multi-tenant e é o que evita os bugs de RLS mais comuns no Lovable.

---

## Por que fatiar em fases

Um prompt único cobrindo 8 módulos + schema + mocks é grande demais para o Lovable manter consistência (ele tende a truncar, esquecer RLS em tabelas do fim do prompt, ou simplificar componentes). Cada fase abaixo é **autocontida e copy-paste pronta**, na ordem em que deve ser enviada. Rode uma, valide no preview, só então avance.

---

## FASE 0 — Fundação (schema, auth, multi-tenant, design system)

```
Construa a fundação de um SaaS multi-tenant chamado "APPintura", para gestão de 
empresas prestadoras de serviço de pintura eletrostática (peças metálicas, portões, 
rodas, esquadrias, eletrodomésticos de terceiros).

STACK:
- React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres + Auth + Storage + Edge Functions + RLS + Realtime)
- Todas as chamadas a APIs externas devem passar exclusivamente por Supabase Edge 
  Functions, nunca client-side.

IDENTIDADE VISUAL (herdada integralmente do projeto APFiscal — usar exatamente 
estes tokens, não improvisar variações):

Paleta (estender em `tailwind.config.ts` como `brand.*`):
| Token | Hex | Uso |
|---|---|---|
| `brand-dark` | `#0D2B5E` | Títulos, header, footer, CTA principal |
| `brand-medium` | `#1A6B8A` | Degradês, bordas de destaque, hover |
| `brand-accent` | `#00C2CB` | Destaques, ícones, animações, checkmarks |
| `brand-bg` | `#F0F4F8` | Background geral |
| `brand-surface` | `#FFFFFF` | Cards e seções alternadas |
| `brand-text` | `#1A1A2E` | Texto primário |
| `brand-muted` | `#4A5568` | Texto secundário / descrições |

Gradiente hero: `linear-gradient(135deg, #0D2B5E 0%, #1A6B8A 60%, #00C2CB 100%)`

Tipografia (carregar via `next/font/google` ou equivalente no Vite):
| Papel | Família | Pesos | Uso |
|---|---|---|---|
| Display | Inter | 700 (negrito) | H1, H2, títulos de seção |
| Body | Inter | 400, 500, 600 | Parágrafos, labels, UI |
| Mono | JetBrains Mono | 400 | Badges de status, códigos (RAL, nº romaneio/OS) |

Família única em toda a interface: a hierarquia dos títulos vem do peso (700) e do 
tamanho, não da troca de família. Não introduzir uma fonte display separada.

Estilo visual:
- Cards: `border-radius: 12px`, sombra suave, hover com `translateY(-4px)` e 
  sombra ampliada
- Botões: `border-radius: 8px`; inputs: `border-radius: 4px`
- Glassmorphism sutil (`backdrop-blur-sm bg-white/10`) apenas em sobreposições 
  sobre gradiente (ex: hero da homepage)
- Componentes shadcn/ui como base, restilizados com os tokens acima
- Layout responsivo, priorizando uso em tablet nas telas operacionais (portaria, 
  chão de fábrica)

Contraste e acessibilidade:
- Verificar ratio mínimo AA (4.5:1) para texto sobre `brand-bg`
- `brand-accent #00C2CB` sobre `#0D2B5E` passa AA para texto grande; não usar 
  como texto pequeno sobre fundo branco sem validar

Registrar todos os tokens acima em `tailwind.config` e em CSS variables, para 
reuso consistente nas fases seguintes. Não usar cor de destaque laranja/âmbar — 
isso não se aplica, a marca AP usa a paleta azul/petróleo/turquesa acima.

Exceção deliberada: badges semânticos de status (urgência de OS, aprovado/reprovado 
em qualidade, vencido/pago no financeiro, estoque baixo) usam cores semânticas 
padrão (verde/âmbar/vermelho) e NÃO a paleta de marca — isso é convenção universal 
de UI e não conflita com a identidade visual. Registrar como tokens separados: 
`status-success`, `status-warning`, `status-danger`, `status-neutral`.

MULTI-TENANCY:
- Tabela `tenants` (id, razao_social, cnpj, plano, created_at)
- Tabela `user_roles` (user_id, tenant_id, role) — NÃO usar custom claims no JWT, 
  usar esta tabela como fonte da verdade
- Roles: admin, gestor_producao, operador_pintura, qualidade, financeiro, portaria
- Criar função SQL `get_user_tenant_id()` como SECURITY DEFINER, que retorna o 
  tenant_id do usuário autenticado a partir de user_roles — esta função será usada 
  em TODAS as policies de RLS das fases seguintes:

  CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  AS $$
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
  $$;

- Criar também `public.has_role(role_name text)` (SECURITY DEFINER) para checagens 
  de permissão por tela/ação
- Suporte a usuário com acesso a múltiplos tenants (multi-CNPJ/filiais): permitir 
  múltiplas linhas em user_roles por user_id, com seletor de tenant ativo na UI 
  (armazenado em contexto local, não no banco)

AUTENTICAÇÃO:
- Supabase Auth: email/senha
- Fluxo de convite de equipe: tela de "Configurações > Equipe" onde admin convida 
  por e-mail, cria linha pendente em user_roles, envia e-mail via Edge Function 
  (deixar a function com stub, sem integração de envio real ainda)

HOMEPAGE (pública, antes do login):
- Hero explicando a proposta de valor para empresas de pintura eletrostática
- Lista de recursos principais com o ganho prático (ex: "Kanban de produção" → 
  "chão de fábrica sem planilha")
- CTA de "Testar grátis por 7 dias" e seção de planos (pode ser estática por ora)

ENTREGÁVEIS DESTA FASE:
- Migration SQL completa (tenants, user_roles, funções RLS)
- Estrutura de rotas protegidas por auth + seletor de tenant
- Layout base (sidebar com navegação por módulo, topbar com seletor de tenant e 
  usuário logado)
- Homepage pública
- Dados mockados: 1 tenant, 3 usuários com roles diferentes
```

---

## FASE 1 — Cadastros

```
No projeto APPintura (Supabase + RLS via get_user_tenant_id() já configurados), 
crie o módulo de Cadastros, seguindo o design system já estabelecido.

Todas as tabelas abaixo precisam de RLS habilitado com policy:
  USING (tenant_id = get_user_tenant_id())
em SELECT/INSERT/UPDATE/DELETE.

### Clientes
- razao_social, cnpj_cpf, contato (nome/telefone/email), endereço completo
- tabela_preco_id (FK), limite_credito, dias_inadimplencia_atual (calculado)
- Aba de histórico de OS do cliente (populada quando o módulo de OS existir)

### Tabelas de Preço
- tabelas_preco (tenant_id, nome, ativa)
- tabela_preco_itens (tabela_preco_id, tipo_acabamento, unidade [m2|peca], valor)

### Cores e Tintas (catálogo)
- codigo_ral, nome_comercial, fabricante, tipo [poliester|epoxi|hibrida]
- textura, brilho, rendimento_teorico_g_m2, custo_kg
- estoque_atual, estoque_minimo, lote, validade
- Alerta visual (badge) quando estoque_atual < estoque_minimo ou validade < 30 dias

### Insumos Químicos
- tipo [desengraxante|decapante|fosfatizante|passivador], estoque_atual, 
  estoque_minimo, validade, fornecedor

### Transportadoras
- nome, cnpj, contato

ENTREGÁVEIS:
- Migrations com RLS
- CRUDs completos (listagem com busca/filtro, formulário com validação, 
  exclusão com confirmação)
- Dados mockados: 3 clientes, 2 tabelas de preço, 5 cores, 3 insumos, 2 transportadoras
```

---

## FASE 2 — Recebimento e Devolução (custódia de mercadoria de terceiros)

```
No projeto APPintura, crie o módulo de Recebimento e Devolução — controle físico 
da mercadoria do cliente, independente do status de produção (registro de custódia).

STORAGE:
- Bucket "romaneios-fotos" no Supabase Storage, separado por pasta {tenant_id}/
  {romaneio_id}/, com policy de acesso restrita ao tenant

### Romaneio de Recebimento (entrada)
- numero sequencial POR TENANT (usar sequence ou função que calcula MAX+1 
  escopada por tenant_id, não sequence global)
- cliente_id, transportadora_id, data_hora
- documento_referencia_cliente (nota de remessa — número, série, chave opcional)
- itens: descricao, quantidade, unidade, peso opcional, condicao_chegada 
  [integra|avariada|com_observacao]
- Upload obrigatório de ao menos 1 foto por item (Storage), captura via câmera 
  em mobile/tablet
- Captura de assinatura digital em canvas (usar biblioteca leve compatível com 
  React, ex: react-signature-canvas), salva como imagem no Storage
- conferente_id (usuário logado), status 
  [recebido_conferido|recebido_com_ressalva|pendente_conferencia]
- Ao salvar, oferecer criação automática de nova OS vinculada, ou vínculo a OS 
  existente em andamento

### Romaneio de Devolução (saída)
- Vínculo obrigatório a uma ou mais OS finalizadas (multi-select)
- itens_devolvidos: descricao, quantidade, condicao_saida
- Fotos obrigatórias na saída
- Comparativo automático quantidade recebida x devolvida por item, com alerta 
  visual se houver divergência não justificada
- retirado_por (nome, documento), transportadora opcional, placa opcional
- Assinatura digital de quem retirou
- status [aguardando_retirada|retirado|retirado_parcial]

### Painel de Saldo de Custódia
- View em tempo real: por cliente, quantidade recebida - devolvida, agrupada 
  por OS e item
- Alerta de peças paradas há mais de X dias (parametrizável em Configurações 
  do tenant)
- Botão de "Relatório de responsabilidade" (por cliente + intervalo de datas): 
  lista o que estava em custódia, com fotos e romaneios — preparar estrutura de 
  dados; a geração do PDF fica para a fase de Edge Functions

UI:
- Telas de recebimento/devolução otimizadas para portaria: poucos campos por 
  tela, botões grandes, fluxo em etapas (wizard), pensado para tablet

ENTREGÁVEIS:
- Migrations com RLS (romaneios_recebimento, romaneio_recebimento_itens, 
  romaneios_devolucao, romaneio_devolucao_itens)
- Bucket de Storage configurado com policy por tenant
- Fluxos de criação com upload de foto e assinatura
- Painel de saldo de custódia
- Dados mockados: 2 romaneios de recebimento com itens e fotos placeholder
```

---

## FASE 3 — Ordem de Serviço (núcleo de produção) + Kanban

```
No projeto APPintura, crie o módulo de Ordem de Serviço, núcleo de produção.

FLUXO DE STATUS:
recebido → pré-tratamento → aplicação de pó → cura (forno) → controle de qualidade 
→ embalagem → aguardando retirada/entrega → finalizado
+ status "retrabalho" (pode ser disparado de qualquer etapa, retorna para 
"aplicação de pó")

CADA OS DEVE CONTER:
- cliente_id, romaneio_recebimento_id (obrigatório), data_entrada, 
  previsao_entrega, urgencia [normal|alta|urgente]
- itens da OS: descricao, quantidade, area_m2 (calculável a partir de dimensões 
  ou manual), foto
- cor_id (RAL), espessura_min_micron, espessura_max_micron
- tipo_pretratamento_exigido
- Consumo estimado de tinta calculado automaticamente: soma(area_m2) x 
  rendimento_g_m2 da cor selecionada
- os_status_historico: registro de toda transição de status com responsavel_id 
  e timestamp (trigger ou lógica de aplicação — escolha o que for mais confiável 
  no Supabase)
- QR code de rastreabilidade por lote de peças (gerar client-side com biblioteca 
  tipo qrcode.react, apontando para a URL pública de consulta da OS)
- Campo de anexo de laudo de qualidade (Storage)

PAINEL KANBAN:
- Colunas = status de produção, drag-and-drop entre colunas (atualiza status 
  e grava em os_status_historico)
- Cards com cliente, previsão de entrega, badge de urgência colorido
- Tela principal do chão de fábrica: visual simplificado, poucos cliques, 
  adequado para tablet

ENTREGÁVEIS:
- Migrations com RLS (ordens_servico, os_itens, os_status_historico)
- Kanban funcional com drag-and-drop
- Lista alternativa em tabela com filtros
- Dados mockados: 6 OS distribuídas em status diferentes do fluxo
```

---

## FASE 4 — Estoque de Insumos + Qualidade

```
No projeto APPintura, crie os módulos de Controle de Estoque (insumos) e 
Controle de Qualidade.

### Estoque de Insumos
- estoque_movimentacoes (tenant_id, tipo_item [tinta|insumo_quimico], item_id, 
  tipo_movimento [entrada|saida], quantidade, os_id opcional, data)
- Baixa automática de tinta ao registrar consumo em uma OS (trigger ou lógica 
  de aplicação disparada quando OS entra em "aplicação de pó")
- Tela de entrada manual de estoque (compra de tinta/insumo por lote)
- Alertas de estoque mínimo (reutilizar badges já criados na Fase 1)
- Relatório de perdas/quebras de insumo (registro manual com motivo)

Importante: este módulo é sobre insumos consumíveis da produção (tinta, 
químicos) — não confundir com a custódia de peças de terceiros (Fase 2).

### Controle de Qualidade
- qualidade_registros (os_item_id, espessura_medida_micron, teste_aderencia 
  [aprovado|reprovado], data, responsavel_id)
- nao_conformidades (os_item_id, tipo, causa, acao_corretiva, data)
- Indicador de taxa de retrabalho (%) por período, cliente e operador — query 
  agregada exibida como card/gráfico simples

ENTREGÁVEIS:
- Migrations com RLS
- Tela de movimentação de estoque + alertas
- Tela de registro de qualidade vinculada a itens de OS
- Dados mockados: algumas movimentações de estoque, 2 registros de qualidade, 
  1 não conformidade
```

---

## FASE 5 — Financeiro

```
No projeto APPintura, crie o módulo Financeiro completo.

### Contas a Receber
- contas_receber (tenant_id, cliente_id, os_id opcional, valor, vencimento, 
  status [em_aberto|parcialmente_pago|pago|vencido|negociado|cancelado], 
  forma_pagamento, centro_custo_id)
- Formas de faturamento configuráveis por cliente: por OS avulsa, fechamento 
  quinzenal/mensal, ou contrato com volume mínimo garantido
- Parcelamento (à vista, 30/60/90, boleto, PIX)
- contas_receber_pagamentos (conta_receber_id, data_pagamento, valor_pago, 
  juros_multa)
- Cálculo automático de juros/multa por atraso, configurável por tenant 
  (percentual em Configurações)
- contas_receber_cobranca_historico (conta_receber_id, data, canal, 
  responsavel_id, resultado) — régua de cobrança
- Estrutura pronta para Edge Function de geração de boleto/link de pagamento 
  (deixar como stub, sem gateway real ainda)

### Contas a Pagar
- contas_pagar (tenant_id, fornecedor, categoria [fixa|variavel|insumo_direto], 
  valor, vencimento, status, recorrente boolean, centro_custo_id)
- Alertas de vencimento próximo

### Centro de Custo
- centros_custo (tenant_id, nome, tipo [producao|comercial|administrativo])

### Fluxo de Caixa
- View/materialized view combinando contas_receber e contas_pagar, projeção 
  30/60/90 dias
- Comparativo realizado x projetado

### Custos e Precificação
- Cálculo de custo real por m² pintado: (consumo real de tinta x custo/kg) + 
  rateio de energia/gás + mão de obra + insumos químicos + depreciação 
  (campo configurável)
- Comparativo custo real x preço cobrado por OS/cliente/tipo de acabamento
- Margem de contribuição por cliente e tipo de peça
- Ponto de equilíbrio mensal em m²

### Dashboard Financeiro
- DRE gerencial simplificado
- Inadimplência (% e valor) por período/cliente
- Ticket médio, curva ABC de clientes
- Comparativo mês a mês

ENTREGÁVEIS:
- Migrations com RLS em todas as tabelas
- Telas de contas a receber/pagar com filtros por status
- Dashboard financeiro com gráficos (usar recharts)
- Dados mockados: alguns lançamentos em aberto, alguns pagos, 1 vencido
```

---

## FASE 6 — Dashboard geral, KPIs e Notificações

```
No projeto APPintura, finalize com o Dashboard geral de indicadores e o módulo 
de Notificações.

### Dashboard / KPIs
- m² pintados por dia/semana/mês
- Consumo de tinta por m² (eficiência)
- Taxa de retrabalho (%)
- Prazo médio prometido x realizado (SLA)
- Peças em custódia há mais de X dias (Fase 2)
- Inadimplência e fluxo de caixa projetado (Fase 5)
- Ranking de clientes por volume e margem
- Este deve ser o painel inicial pós-login, com OS em atraso e peças paradas 
  em destaque no topo

### Notificações
- Edge Function dedicada para disparo de notificações (deixar estrutura pronta 
  para integração futura com APChat/WhatsApp — não implementar envio real agora)
- Gatilhos: OS muda para "finalizado" ou "aguardando retirada", romaneio de 
  devolução disponível, estoque mínimo atingido, peças paradas em custódia, 
  título vencendo
- Tela interna de central de notificações (sino no topbar) com histórico

ENTREGÁVEIS:
- Dashboard inicial com todos os KPIs acima
- Edge Function stub de notificações + tabela notificacoes (tenant_id, tipo, 
  referencia_id, lida boolean, created_at)
- Central de notificações na UI
```

---

## FASE 7 (opcional, depois de validar tudo) — PDF e QR code de romaneios

```
No projeto APPintura, crie a Edge Function de geração de PDF para os romaneios 
de recebimento e devolução.

- Edge Function em Deno que recebe romaneio_id, busca dados via Supabase client 
  server-side, e gera um PDF com QR code (para consulta pública do romaneio) 
  usando uma biblioteca compatível com o runtime Deno (evitar libs que dependam 
  de Node-only APIs)
- Retornar o PDF como stream de download ou salvar no Storage e retornar URL 
  assinada temporária
- Botão "Gerar PDF" nas telas de romaneio de recebimento e devolução já existentes
```

---

## Observação sobre o Certificado Digital / NFeWizard

Isso não se aplica ao APPintura (é específico do APFiscal), então não incluí. Se em algum momento o APPintura precisar emitir algum documento fiscal, me avise que ajustamos a arquitetura seguindo o mesmo padrão de separação frontend/microserviço que você já usa no APFiscal.

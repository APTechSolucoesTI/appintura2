# APPintura

SaaS multi-tenant para empresas de pintura eletrostática a pó — custódia de mercadoria
de terceiros, ordem de serviço, qualidade, estoque e financeiro.

O escopo completo e o roadmap de fases estão em [CLAUDE.md](CLAUDE.md), que é o prompt
mestre do projeto.

## Estado atual: todas as fases (0 a 6) concluídas

**Fase 0 — Fundação**

| Entregável | Situação |
|---|---|
| Design system com os tokens da marca AP | pronto |
| Layout base (sidebar por módulo + topbar com seletor de tenant) | pronto |
| Rotas protegidas por auth + bloqueio por papel | pronto |
| Homepage pública (hero, recursos, custódia, planos) | pronto |
| Configurações > Equipe com fluxo de convite | pronto |
| Dados mockados (2 tenants, 3 usuários, 1 convite pendente) | pronto |
| Migration SQL com RLS e funções de autorização | escrita, **não aplicada** |
| Edge Function `convidar-membro` | stub escrito, **não publicada** |

**Fase 1 — Cadastros**

| Entregável | Situação |
|---|---|
| CRUD de clientes + ficha com aba de histórico de OS | pronto |
| CRUD de tabelas de preço com itens por acabamento | pronto |
| CRUD de cores e tintas com alerta de estoque e validade | pronto |
| CRUD de insumos químicos | pronto |
| CRUD de transportadoras | pronto |
| Busca, filtros, validação de CPF/CNPJ e exclusão com confirmação | pronto |
| Dados mockados (3 clientes, 2 tabelas, 5 cores, 3 insumos, 2 transportadoras) | pronto |
| Migration SQL com RLS por papel | escrita, **não aplicada** |

**Fase 2 — Recebimento e devolução (custódia)**

| Entregável | Situação |
|---|---|
| Assistente de recebimento em 4 etapas, para tablet | pronto |
| Foto obrigatória por item, com câmera e compressão no cliente | pronto |
| Assinatura digital em canvas (`signature_pad`) | pronto |
| Assistente de devolução com comparativo recebido × devolvido | pronto |
| Bloqueio de divergência sem justificativa | pronto |
| Painel de saldo de custódia com alerta de peça parada | pronto |
| Relatório de responsabilidade (estrutura de dados; PDF na Fase 7) | pronto |
| Configurações > Operação (dias de alerta por empresa) | pronto |
| Dados mockados (2 recebimentos, 1 devolução parcial, fotos placeholder) | pronto |
| Migration SQL, view de saldo e policies do bucket | escrita, **não aplicada** |

**Fase 3 — Ordem de serviço e Kanban**

| Entregável | Situação |
|---|---|
| Kanban com arrastar e soltar (mouse e toque), 9 colunas | pronto |
| Histórico de transições com responsável e horário | pronto |
| Regra de retrabalho: sair dele sempre volta para a cabine | pronto |
| Lista alternativa em tabela com filtros de etapa e urgência | pronto |
| Abertura de OS a partir do romaneio, com itens pré-carregados | pronto |
| Calculadora de área por dimensões | pronto |
| Consumo estimado de pó pelo rendimento da cor | pronto |
| QR code e página pública de consulta, sem dado comercial | pronto |
| Anexo de laudo de qualidade | pronto |
| Aba de histórico de OS na ficha do cliente (pendência da Fase 1) | pronto |
| Dados mockados (6 OS em etapas diferentes) | pronto |
| Migration SQL com trilha por trigger e consulta pública | escrita, **não aplicada** |

**Fase 4 — Estoque de insumos e qualidade**

| Entregável | Situação |
|---|---|
| Posição de estoque unificada (tintas + químicos) com alertas | pronto |
| Movimentações: entrada de compra, saída de produção e perda com motivo | pronto |
| Baixa automática de tinta ao entrar em aplicação de pó, idempotente | pronto |
| Bloqueio de saldo negativo | pronto |
| Inspeção por item de OS: espessura em micron e aderência | pronto |
| Reprovar envia a OS para retrabalho no mesmo passo | pronto |
| Não conformidades com causa raiz e ação corretiva | pronto |
| Taxa de retrabalho por período, cliente e operador | pronto |
| Dados mockados (9 movimentações, 2 inspeções, 1 não conformidade) | pronto |
| Migration SQL com triggers de saldo e baixa automática | escrita, **não aplicada** |

**Fase 5 — Financeiro**

| Entregável | Situação |
|---|---|
| Contas a receber com baixa parcial, juros/multa e régua de cobrança | pronto |
| Contas a pagar por categoria e centro de custo, com alerta de vencimento | pronto |
| Fluxo de caixa 30/60/90 com vencidos fora da projeção | pronto |
| Custo real por m², margem por OS e por cliente, ponto de equilíbrio | pronto |
| Painel: DRE gerencial (caixa), inadimplência, ticket médio, curva ABC | pronto |
| Comparativo mês a mês em gráfico (recharts) | pronto |
| Configurações > Financeiro: encargos e rateios de custo | pronto |
| Dados mockados (7 títulos a receber, 6 a pagar, 3 centros de custo) | pronto |
| Migration SQL, views de saldo e Edge Function de cobrança (stub) | escrita, **não aplicada** |

**Fase 6 — Painel geral, KPIs e notificações**

| Entregável | Situação |
|---|---|
| Painel inicial com OS em atraso e peças paradas em destaque no topo | pronto |
| m² pintados por dia/semana/mês e gráfico dos últimos 6 meses | pronto |
| Consumo de pó real em g/m² contra a ficha técnica | pronto |
| Taxa de retrabalho e SLA (prometido × realizado) | pronto |
| Custódia, inadimplência e saldo projetado de caixa | pronto |
| Ranking de clientes por margem e volume | pronto |
| Sino no topbar + central de notificações com filtros | pronto |
| Gatilhos: OS pronta/finalizada, devolução, estoque, peça parada, título | pronto |
| Dados mockados (3 OS finalizadas em julho/agosto, com trilha completa) | pronto |
| Migration com triggers, job `pg_cron` e Edge Function de disparo (stub) | escrita, **não aplicada** |

**Fase 7 — PDF e QR code dos romaneios**

| Entregável | Situação |
|---|---|
| Layout do romaneio em PDF (A4, QR, itens, assinatura, rodapé) | pronto |
| Botão "Gerar PDF" funcionando no recebimento e na devolução | pronto |
| Assinatura capturada em tela embutida no documento | pronto |
| Página pública do QR (`/romaneio/:tipo/:id`), sem dado de carga | pronto |
| Edge Function `gerar-pdf-romaneio` em Deno | escrita, **não publicada** |
| Migration com a função de consulta pública | escrita, **não aplicada** |

> **Onde o PDF é gerado hoje:** no navegador, usando exatamente o mesmo builder da
> Edge Function ([`supabase/functions/_shared/romaneio-pdf.ts`](supabase/functions/_shared/romaneio-pdf.ts)).
> A biblioteca de PDF entra por parâmetro, então o arquivo roda nos dois runtimes
> sem duplicação — o documento do servidor não pode divergir do baixado pela tela.
> Ao conectar o Supabase, troque o corpo de `src/services/pdf-service.ts` por
> `supabase.functions.invoke('gerar-pdf-romaneio', ...)`.

O Supabase ainda **não está conectado**. Autenticação e dados vêm de mocks em
`src/mocks/seed.ts`, atrás das interfaces em `src/services/`.

## Rodando

```bash
npm install
npm run dev
```

Login de demonstração em `/entrar` — senha `appintura` para qualquer um dos e-mails:

| E-mail | Papel | Empresas |
|---|---|---|
| `marina@metalcor.com.br` | Administrador | Matriz + Filial Sul |
| `rogerio@metalcor.com.br` | Gestor de produção | Matriz |
| `cleiton@metalcor.com.br` | Portaria | Matriz |

Entre como `cleiton` para ver a navegação reduzida ao que a portaria acessa.

Outros comandos:

```bash
npm run build
```

```bash
npm run lint
```

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui (Radix) · React Router 7 ·
TanStack Query · React Hook Form + Zod · Supabase (a conectar)

## Estrutura

```
src/
  components/
    brand/        logo
    layout/       app shell, sidebar, topbar, page header, placeholder de módulo
    ui/           shadcn/ui restilizado com os tokens da marca
  features/
    auth/         contexto de sessão, provider e mapa de permissões por papel
    tenant/       contexto do tenant ativo e seletor de empresa
    cadastros/    casca de CRUD compartilhada pelos cinco cadastros
    custodia/     assistente em etapas, captura de foto e de assinatura
    configuracoes/ abas de configuração do tenant
  lib/            formatação pt-BR, validação de CPF/CNPJ, normalização de busca
  mocks/          seed temporário — remover ao conectar o Supabase
  pages/          homepage, login, 404 e telas de /app
  routes/         layout protegido e guarda por módulo
  services/       contratos de dados — trocar mock por Supabase aqui
  types/          tipos de domínio, espelhando as tabelas
supabase/
  migrations/     schema appintura2 com RLS (aplicado no servidor)
  functions/      Edge Functions (sessao-login real; as demais, stubs)
  seed.sql        dados de desenvolvimento
Dockerfile        build do SPA + nginx (deploy via Dokploy)
nginx.conf        fallback de SPA, cache e healthcheck
```

## Banco: schema `appintura2`

O Supabase é **compartilhado** com aperp, apfiscal e apticket. Duas consequências
que não dá para ignorar:

1. **Todo objeto do APPintura vive em `appintura2`**, nunca em `public` — que é
   do aperp e já tem `tenants`, `user_roles`, `clientes` e `ordens_servico` com
   os mesmos nomes dos nossos. O cliente precisa declarar o schema:

   ```ts
   createClient(URL, ANON_KEY, { db: { schema: 'appintura2' } })
   ```

   Sem essa linha as consultas caem em `public` e leem/gravam dados do aperp —
   sem erro nenhum, porque as tabelas existem lá.

2. **Identidade própria.** O APPintura não usa `auth.users`/Supabase Auth: aquele
   pool é comum a todos os produtos do servidor, então quem se cadastra no aperp
   seria identidade válida aqui. Usamos `appintura2.usuarios`, e
   `appintura2.usuario_atual()` substitui `auth.uid()` nas policies.

### Login

`supabase/functions/sessao-login` troca e-mail+senha por um JWT HS256 assinado
com o mesmo segredo do Supabase — é o que o PostgREST valida. Os claims que
importam são `role: 'authenticated'` (faz o PostgREST trocar de papel) e `sub`
(o `usuarios.id`, lido por `usuario_atual()`).

```ts
const { access_token } = await fetch(`${URL}/functions/v1/sessao-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
  body: JSON.stringify({ email, senha }),
}).then((r) => r.json())

const supabase = createClient(URL, ANON_KEY, {
  db: { schema: 'appintura2' },
  global: { headers: { Authorization: `Bearer ${access_token}` } },
})
```

Senhas são bcrypt (pgcrypto), e `senha_hash` **não tem grant de SELECT** para
`anon`/`authenticated` — os grants de `usuarios` são por coluna, porque RLS
filtra linhas e não colunas.

A função `appintura2.autenticar()` é revogada de `anon`/`authenticated` e só a
Edge Function (service_role) a chama: exposta na API, ela seria um oráculo de
força bruta de senha.

Variável necessária nas Edge Functions:

```
APPINTURA_JWT_SECRET=<mesmo JWT secret do Supabase>
```

## Design system

Tokens em `src/index.css`, herdados integralmente do APFiscal:

| Token | Hex | Uso |
|---|---|---|
| `brand-dark` | `#0D2B5E` | Títulos, sidebar, CTA principal |
| `brand-medium` | `#1A6B8A` | Degradês, bordas, foco |
| `brand-accent` | `#00C2CB` | Destaques, ícones, estado ativo |
| `brand-bg` | `#F0F4F8` | Background geral |
| `brand-surface` | `#FFFFFF` | Cards |
| `brand-text` | `#1A1A2E` | Texto primário |
| `brand-muted` | `#4A5568` | Texto secundário |

Tipografia: **Inter** em toda a interface — títulos em negrito (700), corpo em 400/500
— e **JetBrains Mono** em códigos, CNPJ e números de romaneio/OS. A hierarquia dos
títulos vem do peso e do tamanho, não da troca de família.

Status semânticos (`status-success`, `status-warning`, `status-danger`,
`status-neutral`) ficam **fora** da paleta de marca, por convenção universal de UI.
Cada um tem a variante `-soft` (fundo) e `-strong` (texto, com contraste AA validado
sobre o fundo correspondente).

Alvos de toque dos componentes base foram ampliados para ≥ 40px em relação ao padrão
do shadcn/ui, porque as telas operacionais (portaria, chão de fábrica) são usadas em
tablet.

## Ao conectar o Supabase

1. Aplicar `supabase/migrations/20260914120000_fase0_fundacao.sql`.
2. Criar os usuários de desenvolvimento e rodar `supabase/seed.sql`.
3. Gerar os tipos (`supabase gen types typescript`) e substituir
   `src/types/domain.ts` pelos tipos gerados, mantendo só os rótulos em pt-BR.
4. Implementar `SupabaseAuthService` com a interface de
   `src/services/auth-service.ts` e trocar o export do final do arquivo.
5. Trocar `src/services/equipe-service.ts` por consultas a `user_roles` + invoke da
   Edge Function `convidar-membro`.
6. Apagar `src/mocks/seed.ts` e o bloco de credenciais de demonstração em
   `src/pages/entrar.tsx`.

### Nota sobre `get_user_tenant_id()`

A especificação original usa `get_user_tenant_id()` (singular) em todas as policies.
Essa função retorna **um** tenant, o que quebra para usuário vinculado a mais de um
CNPJ — caso explicitamente suportado pelo produto. A migration entrega as duas
funções; use `get_user_tenant_ids()` (plural) nas policies dos módulos:

```sql
using (tenant_id in (select appintura2.get_user_tenant_ids()))
```

# Suíte de testes do APPintura2

Testes de regra de negócio executados **direto no Postgres**, contra o schema
`appintura2` real.

## Como rodar

```bash
bash supabase/tests/run.sh
```

O script precisa de um `psql` capaz de alcançar o banco. Em servidor
self-hosted, o caminho usual é por dentro do container:

```bash
docker exec -i supabase-db psql -U postgres -d postgres -f - < supabase/tests/01_fundacao.sql
```

## Por que cada arquivo abre `begin` e fecha `rollback`

Os testes criam empresas, usuários, orçamentos e ordens de serviço de verdade —
e desfazem tudo no fim. Isso permite rodá-los **contra o banco de produção** sem
deixar resíduo, que é o único jeito de testar RLS, triggers e `SECURITY DEFINER`
com fidelidade. Um banco de teste separado teria outras policies e outro
`search_path`, e foi exatamente esse tipo de diferença que escondeu bugs antes.

A contrapartida: eles **não** rodam em paralelo com escrita real, porque a
transação segura linhas. Rode em janela de baixa atividade.

## Convenção

Cada asserção imprime uma linha:

```
A01 PASS | login com senha correta
```

Um `FAIL` no meio não interrompe a execução — a suíte roda inteira e você vê o
conjunto. Já um `ERROR` do Postgres para tudo (`ON_ERROR_STOP`), e nesse caso a
falha costuma estar no próprio teste, não no produto.

## Armadilha conhecida

`orcamentos` **não tem policy de UPDATE**: toda escrita passa pelas RPCs. Um
`update` direto rodando como `authenticated` afeta zero linhas **sem erro**. A
primeira versão de `02_orcamento.sql` caiu nisso e reportou falso negativo em
dois testes de expiração. Ao escrever teste novo, mude estado pelo caminho real
(a RPC) ou saia do papel `authenticated` antes.

## Cobertura atual

| Arquivo | Área |
|---|---|
| `01_fundacao.sql` | Autenticação, RLS multi-tenant, CRUD, agregados transacionais |
| `02_orcamento.sql` | Orçamento fases 1–5, portal público, conversão, funil, grants |
| `03_orcamento_bordas.sql` | Expiração, revisão, recusa, aprovação parcial, casos de borda |
| `04_modulos.sql` | Estoque, produção, qualidade, financeiro, custódia |

## O que a suíte **não** cobre

Nada de interface. Nenhum clique, formulário, upload ou drag-and-drop é
exercitado — a suíte prova as regras, não as telas. Também não cobre as Edge
Functions (que rodam em Deno, fora do banco) nem carga/concorrência.

---

## Testes de interface

Vivem em `src/testes/`, rodam com Vitest e cobrem o que esta suíte **não**
alcança: renderização, rótulos, classes de estilo e as regras que moram no
frontend.

```bash
npm test          # uma passada
npm run test:watch
```

Toda asserção lá corresponde a um bug que já aconteceu — selo fora do padrão
visual, item de menu duplicado, permissão de módulo divergente do banco. Não
são testes escritos por completude.

A regra prática: se a lógica decide o que o **banco** aceita, o teste é aqui; se
decide o que a **tela** mostra, é em `src/testes/`.

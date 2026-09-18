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
| `05_regras_negocio.sql` | Regras de negócio transversais |
| `selects-dos-stores.sh` | Cada `select` de `src/services/` contra o PostgREST |

## A terceira camada: os selects dos stores

```bash
EMAIL=... SENHA=... bash supabase/tests/selects-dos-stores.sh
```

Este não fala SQL nem renderiza tela: ele dispara, contra o PostgREST real,
exatamente a string de `select` que cada store escreve em `src/services/`.

Existe por um bug que passou pelas duas outras camadas sem encostar em nenhuma.
O store de custódia pedia `fotos:romaneio_fotos(*)` no nível do **romaneio**,
mas a FK de `romaneio_fotos` aponta para o **item**. O PostgREST respondia 400
(`PGRST200`), a listagem morria — e o painel inicial ficava **em branco**,
porque ele busca o saldo de custódia dentro de um `Promise.all` e uma promessa
rejeitada derruba as outras seis. A tela toda sumiu por causa de uma vírgula no
lugar errado.

A suíte SQL não pegaria: o relacionamento existe no banco, só não é o que foi
pedido. Os testes de interface não pegariam: não fazem rede. O erro só existe na
fronteira entre o select escrito no TypeScript e as FKs que existem de fato.

Ao mudar um `select` em `src/services/`, mude a linha correspondente aqui — é
só isso que mantém o teste honesto.

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

---

## Os testes rodam contra a base REAL, com dados

Por isso nenhuma asserção pode fixar valor absoluto. `count(*) = 1` e
`numero = 1` só passavam com o banco vazio — e quebraram no dia em que os dados
de demonstração entraram, sem que nada tivesse piorado no produto.

A regra: conte a **diferença**, não o total. Para numeração sequencial, compare
com `max(numero) + 1` do que já existia; para visibilidade sob RLS, verifique
que o registro do tenant alheio **não** aparece, em vez de contar os do próprio.

import {
  CLIENTES,
  CORES,
  INSUMOS,
  TABELAS_PRECO,
  TRANSPORTADORAS,
} from '@/mocks/cadastros-seed'
import type {
  Cliente,
  Cor,
  InsumoQuimico,
  TabelaPreco,
  Transportadora,
} from '@/types/cadastros'

import { criarStore } from './mock-store'

/**
 * Serviços do módulo de Cadastros.
 *
 * Ao conectar o Supabase, cada `criarStore` vira um módulo com as consultas
 * equivalentes. As assinaturas (`listar(tenantId)`, `criar(tenantId, valores)`,
 * ...) foram desenhadas para não mudar nessa troca.
 *
 * Observação sobre tabelas de preço: aqui os itens vivem aninhados no objeto; no
 * Postgres serão a tabela `tabela_preco_itens`, gravada em transação junto com a
 * tabela pai.
 */

export class RegraDeNegocioError extends Error {}

/** Ordenação alfabética respeitando acentuação do pt-BR. */
function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

export const clientesStore = criarStore<Cliente>(CLIENTES, (a, b) =>
  compararTexto(a.razao_social, b.razao_social),
)

export const tabelasPrecoStore = criarStore<TabelaPreco>(TABELAS_PRECO, (a, b) =>
  compararTexto(a.nome, b.nome),
)

export const coresStore = criarStore<Cor>(CORES, (a, b) =>
  compararTexto(a.codigo_ral, b.codigo_ral),
)

export const insumosStore = criarStore<InsumoQuimico>(INSUMOS, (a, b) =>
  compararTexto(a.nome, b.nome),
)

export const transportadorasStore = criarStore<Transportadora>(
  TRANSPORTADORAS,
  (a, b) => compararTexto(a.nome, b.nome),
)

/**
 * Impede apagar tabela de preço vinculada a cliente — no banco isso vira
 * `on delete restrict` na FK; aqui a checagem é explícita para a mensagem de erro
 * ser útil.
 */
export async function removerTabelaPreco(
  tenantId: string,
  tabelaPrecoId: string,
): Promise<void> {
  const clientes = await clientesStore.listar(tenantId)
  const emUso = clientes.filter((cliente) => cliente.tabela_preco_id === tabelaPrecoId)

  if (emUso.length > 0) {
    const nomes = emUso.map((cliente) => cliente.razao_social).join(', ')

    throw new RegraDeNegocioError(
      `Esta tabela está vinculada a ${emUso.length} cliente(s): ${nomes}. Troque a tabela desses clientes antes de excluir.`,
    )
  }

  await tabelasPrecoStore.remover(tenantId, tabelaPrecoId)
}

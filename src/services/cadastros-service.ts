import type {
  Cliente,
  Cor,
  InsumoQuimico,
  TabelaPreco,
  Transportadora,
} from '@/types/cadastros'

import { criarStoreSupabase } from './supabase-store'

/**
 * Serviços do módulo de Cadastros.
 *
 * Cada store é uma tabela do schema `appintura2` sob RLS. As assinaturas
 * (`listar(tenantId)`, `criar(tenantId, valores)`, ...) são as mesmas do mock
 * que existia antes — foi por isso que a troca não mexeu na lógica abaixo.
 */

export class RegraDeNegocioError extends Error {}

/** Ordenação alfabética respeitando acentuação do pt-BR. */
function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

export const clientesStore = criarStoreSupabase<Cliente>({
  tabela: 'clientes',
  ordenar: (a, b) => compararTexto(a.razao_social, b.razao_social),
})

// Agregado: os itens vivem em `tabela_preco_itens` e são gravados pela RPC,
// na mesma transação do pai.
export const tabelasPrecoStore = criarStoreSupabase<TabelaPreco>({
  tabela: 'tabelas_preco',
  select: '*, itens:tabela_preco_itens(*)',
  rpcGravar: { nome: 'salvar_tabela_preco', campoItens: 'itens' },
  ordenar: (a, b) => compararTexto(a.nome, b.nome),
})

export const coresStore = criarStoreSupabase<Cor>({
  tabela: 'cores',
  ordenar: (a, b) => compararTexto(a.codigo_ral, b.codigo_ral),
})

export const insumosStore = criarStoreSupabase<InsumoQuimico>({
  tabela: 'insumos_quimicos',
  ordenar: (a, b) => compararTexto(a.nome, b.nome),
})

export const transportadorasStore = criarStoreSupabase<Transportadora>({
  tabela: 'transportadoras',
  ordenar: (a, b) => compararTexto(a.nome, b.nome),
})

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

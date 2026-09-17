import type { PostgrestError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

import { RegistroNaoEncontradoError, type RegistroTenant, type Store } from './store'

/**
 * Implementação do contrato de `Store` sobre o Supabase.
 *
 * A assinatura é idêntica à do mock de propósito: cada serviço troca
 * `criarStore(SEED, cmp)` por `criarStoreSupabase({ tabela, ordenar: cmp })` e
 * toda a lógica de negócio construída em cima continua valendo.
 *
 * Sobre o `tenantId` explícito em toda chamada: o RLS já filtra por empresa, mas
 * o usuário multi-CNPJ enxerga MAIS DE UMA. Sem o `.eq('tenant_id', ...)` a
 * listagem da matriz traria junto as linhas da filial. RLS é o piso de
 * segurança; o filtro é a seleção de contexto.
 */

export interface OpcoesStore<T extends RegistroTenant> {
  tabela: string
  /**
   * Projeção do PostgREST. Para agregados, traz os filhos aninhados:
   * `'*, itens:romaneio_recebimento_itens(*)'`
   */
  select?: string
  /**
   * Comparador aplicado no cliente.
   *
   * Fica aqui, e não em `.order()`, porque a ordenação do produto é
   * `localeCompare` pt-BR — o Postgres ordenaria pelo collation do banco, e
   * "Ártico" cairia depois de "Zinco". Os volumes por tenant são pequenos.
   */
  ordenar?: (a: T, b: T) => number
  /**
   * Agregados: RPC que grava pai + filhos numa transação (PostgREST não faz
   * insert aninhado). Recebe `(p_tenant_id, p_dados, p_itens, p_id)`.
   */
  rpcGravar?: { nome: string; campoItens: keyof T & string }
}

/** `PGRST116` = nenhuma linha. Com RLS, "não existe" e "não é sua" são o mesmo caso. */
function traduzir(erro: PostgrestError): Error {
  if (erro.code === 'PGRST116' || erro.code === 'P0002') {
    return new RegistroNaoEncontradoError()
  }

  // 42501 = insufficient_privilege: RLS barrou, ou a RPC recusou o tenant.
  if (erro.code === '42501') {
    return new Error('Você não tem permissão para esta operação nesta empresa.')
  }

  if (erro.code === '23505') {
    return new Error('Já existe um registro com estes dados.')
  }

  if (erro.code === '23503') {
    return new Error('Este registro está vinculado a outro e não pode ser removido.')
  }

  return new Error(erro.message)
}

export function criarStoreSupabase<T extends RegistroTenant>(
  opcoes: OpcoesStore<T>,
): Store<T> {
  const { tabela, select = '*', ordenar, rpcGravar } = opcoes

  function ordenado(linhas: T[]): T[] {
    return ordenar ? [...linhas].sort(ordenar) : linhas
  }

  async function obterPorId(tenantId: string, id: string): Promise<T> {
    const { data, error } = await supabase
      .from(tabela)
      .select(select)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle()

    if (error) throw traduzir(error)
    if (!data) throw new RegistroNaoEncontradoError()

    return data as unknown as T
  }

  /**
   * Grava agregado via RPC e relê o resultado.
   *
   * A releitura não é desperdício: o banco preenche coisas que o cliente não
   * tem como saber — `numero` sequencial, `created_at`, defaults, e os ids dos
   * filhos. Devolver o objeto enviado deixaria a tela mostrando um romaneio
   * sem número.
   */
  async function gravarAgregado(
    tenantId: string,
    valores: Record<string, unknown>,
    id: string | null,
  ): Promise<T> {
    if (!rpcGravar) throw new Error(`Store de ${tabela} não tem RPC de gravação.`)

    const { [rpcGravar.campoItens]: itens, ...dados } = valores

    const { data, error } = await supabase.rpc(rpcGravar.nome, {
      p_tenant_id: tenantId,
      p_dados: dados,
      // `null` e não `[]`: quando a chamada não traz a lista de filhos (mover
      // card no Kanban, corrigir um campo), a RPC deixa os filhos como estão.
      // Mandar `[]` aqui apagaria os itens do agregado a cada update parcial.
      p_itens: itens ?? null,
      p_id: id,
    })

    if (error) throw traduzir(error)

    return await obterPorId(tenantId, data as string)
  }

  return {
    async listar(tenantId) {
      const { data, error } = await supabase
        .from(tabela)
        .select(select)
        .eq('tenant_id', tenantId)

      if (error) throw traduzir(error)

      return ordenado((data ?? []) as unknown as T[])
    },

    obter: obterPorId,

    async criar(tenantId, valores) {
      if (rpcGravar) {
        return await gravarAgregado(tenantId, valores as Record<string, unknown>, null)
      }

      const { data, error } = await supabase
        .from(tabela)
        // `tenant_id` vem do contexto, nunca do formulário. A policy de INSERT
        // rejeitaria outro valor, mas explicitar evita depender só disso.
        .insert({ ...valores, tenant_id: tenantId } as never)
        .select(select)
        .single()

      if (error) throw traduzir(error)

      return data as unknown as T
    },

    async atualizar(tenantId, id, valores) {
      if (rpcGravar) {
        return await gravarAgregado(tenantId, valores as Record<string, unknown>, id)
      }

      const { data, error } = await supabase
        .from(tabela)
        .update(valores as never)
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .select(select)
        .maybeSingle()

      if (error) throw traduzir(error)
      if (!data) throw new RegistroNaoEncontradoError()

      return data as unknown as T
    },

    async atualizarVarios(tenantId, ids, valores) {
      if (ids.length === 0) return []

      const { data, error } = await supabase
        .from(tabela)
        .update(valores as never)
        .eq('tenant_id', tenantId)
        .in('id', ids)
        .select(select)

      if (error) throw traduzir(error)

      return ordenado((data ?? []) as unknown as T[])
    },

    async remover(tenantId, id) {
      const { data, error } = await supabase
        .from(tabela)
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .select('id')
        .maybeSingle()

      if (error) throw traduzir(error)
      // Sem linha devolvida o delete não achou nada — silenciar viraria um
      // "excluído com sucesso" para registro de outra empresa.
      if (!data) throw new RegistroNaoEncontradoError()
    },
  }
}

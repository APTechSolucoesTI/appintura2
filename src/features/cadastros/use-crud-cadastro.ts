import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { useTenant } from '@/features/tenant/tenant-context'
import { normalizar } from '@/lib/texto'
import type { RegistroTenant, Store } from '@/services/store'

export type ValoresForm<T extends RegistroTenant> = Omit<T, keyof RegistroTenant>

interface UseCrudOptions<T extends RegistroTenant> {
  /** Prefixo da queryKey, ex.: 'clientes'. */
  chave: string
  store: Store<T>
  /** Recebe o termo já normalizado (minúsculo, sem acento). */
  filtrar: (item: T, termo: string) => boolean
  /** Nome do registro para toasts e para o diálogo de exclusão. */
  rotulo: (item: T) => string
  /** Exclusão com regra de negócio própria (ex.: tabela de preço em uso). */
  removerCustom?: (tenantId: string, id: string) => Promise<void>
  substantivo: { singular: string; artigo: 'o' | 'a' }
}

/**
 * Estado e mutações comuns aos cinco CRUDs de cadastro: busca, painel de
 * formulário, diálogo de exclusão e invalidação de cache.
 *
 * A queryKey sempre inclui o tenant ativo — é o que impede a lista de uma
 * empresa reaparecer depois de trocar para outra.
 */
export function useCrudCadastro<T extends RegistroTenant>({
  chave,
  store,
  filtrar,
  rotulo,
  removerCustom,
  substantivo,
}: UseCrudOptions<T>) {
  const { tenantAtivo } = useTenant()
  const queryClient = useQueryClient()

  const [busca, setBusca] = useState('')
  const [formAberto, setFormAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<T | null>(null)
  const [paraExcluir, setParaExcluir] = useState<T | null>(null)

  const queryKey = [chave, tenantAtivo.id]

  const query = useQuery({
    queryKey,
    queryFn: () => store.listar(tenantAtivo.id),
  })

  const registros = useMemo(() => query.data ?? [], [query.data])

  const filtrados = useMemo(() => {
    const termo = normalizar(busca)

    if (!termo) return registros

    return registros.filter((item) => filtrar(item, termo))
  }, [registros, busca, filtrar])

  async function invalidar() {
    await queryClient.invalidateQueries({ queryKey })
  }

  const salvar = useMutation({
    mutationFn: async (valores: ValoresForm<T>) => {
      if (emEdicao) {
        return store.atualizar(tenantAtivo.id, emEdicao.id, valores)
      }

      return store.criar(tenantAtivo.id, valores)
    },
    onSuccess: async (registro) => {
      const verbo = emEdicao ? 'atualizad' : 'cadastrad'

      await invalidar()
      setFormAberto(false)
      setEmEdicao(null)
      toast.success(`${substantivo.singular} ${verbo}${substantivo.artigo}`, {
        description: rotulo(registro),
      })
    },
  })

  const excluir = useMutation({
    mutationFn: async (registro: T) => {
      if (removerCustom) return removerCustom(tenantAtivo.id, registro.id)

      return store.remover(tenantAtivo.id, registro.id)
    },
    onSuccess: async (_resultado, registro) => {
      await invalidar()
      setParaExcluir(null)
      toast.success(
        `${substantivo.singular} ${substantivo.artigo === 'a' ? 'excluída' : 'excluído'}`,
        { description: rotulo(registro) },
      )
    },
    onError: (erro) => {
      toast.error('Não foi possível excluir', {
        description:
          erro instanceof Error ? erro.message : 'Tente novamente em instantes.',
      })
    },
  })

  return {
    tenantAtivo,
    busca,
    setBusca,
    query,
    registros,
    filtrados,

    formAberto,
    emEdicao,
    abrirNovo: () => {
      setEmEdicao(null)
      setFormAberto(true)
    },
    abrirEdicao: (registro: T) => {
      setEmEdicao(registro)
      setFormAberto(true)
    },
    fecharForm: () => {
      setFormAberto(false)
      setEmEdicao(null)
      salvar.reset()
    },
    salvar,

    paraExcluir,
    pedirExclusao: setParaExcluir,
    cancelarExclusao: () => setParaExcluir(null),
    excluir,
  }
}

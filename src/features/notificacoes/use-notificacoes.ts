import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useTenant } from '@/features/tenant/tenant-context'
import { obterConfiguracoes } from '@/services/configuracoes-service'
import {
  marcarComoLida,
  marcarTodasComoLidas,
  sincronizarNotificacoes,
} from '@/services/notificacoes-service'

/**
 * Notificações do tenant ativo.
 *
 * A sincronização roda junto da leitura porque, no mock, não existe job de
 * fundo avaliando os gatilhos. Com o Supabase, a query passa a ser só um
 * `select` — quem cria as linhas são as triggers e o `pg_cron`.
 */
export function useNotificacoes() {
  const { tenantAtivo } = useTenant()
  const queryClient = useQueryClient()
  const queryKey = ['notificacoes', tenantAtivo.id]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const config = await obterConfiguracoes(tenantAtivo.id)

      return sincronizarNotificacoes(tenantAtivo.id, config)
    },
    // O sino precisa reagir a mudanças feitas nas outras telas.
    staleTime: 15_000,
  })

  const marcarUma = useMutation({
    mutationFn: (id: string) => marcarComoLida(tenantAtivo.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const marcarTodas = useMutation({
    mutationFn: () => marcarTodasComoLidas(tenantAtivo.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const notificacoes = query.data ?? []

  return {
    query,
    notificacoes,
    naoLidas: notificacoes.filter((item) => !item.lida),
    marcarUma,
    marcarTodas,
  }
}

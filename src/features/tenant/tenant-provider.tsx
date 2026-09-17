import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import { useAuth } from '@/features/auth/auth-context'

import { TenantContext } from './tenant-context'

const TENANT_KEY = 'appintura.tenant_ativo'

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { vinculos } = useAuth()
  const queryClient = useQueryClient()

  const [tenantIdSelecionado, setTenantIdSelecionado] = useState<string | null>(
    () => localStorage.getItem(TENANT_KEY),
  )

  // Só aceita o valor persistido se o vínculo ainda existir: um acesso revogado
  // não pode continuar selecionado por causa do localStorage.
  const vinculoAtivo =
    vinculos.find((vinculo) => vinculo.tenant.id === tenantIdSelecionado) ??
    vinculos.at(0)

  const trocarTenant = useCallback(
    (tenantId: string) => {
      if (tenantId === vinculoAtivo?.tenant.id) return

      setTenantIdSelecionado(tenantId)
      localStorage.setItem(TENANT_KEY, tenantId)

      // Regra inegociável do multi-tenant: ao trocar de empresa, todo dado em
      // cache pertence ao tenant anterior e precisa ser descartado — senão a tela
      // da empresa B renderiza dados da empresa A até o refetch chegar.
      queryClient.clear()
    },
    [queryClient, vinculoAtivo?.tenant.id],
  )

  const value = useMemo(() => {
    if (!vinculoAtivo) return null

    return {
      tenantAtivo: vinculoAtivo.tenant,
      roleAtual: vinculoAtivo.role,
      vinculos,
      trocarTenant,
    }
  }, [vinculoAtivo, vinculos, trocarTenant])

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Nenhuma empresa vinculada a este usuário. Fale com o administrador da conta.
      </div>
    )
  }

  return <TenantContext value={value}>{children}</TenantContext>
}

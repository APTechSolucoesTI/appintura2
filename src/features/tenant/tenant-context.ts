import { createContext, use } from 'react'

import type { Role, Tenant, TenantVinculo } from '@/types/domain'

export interface TenantContextValue {
  /** Tenant ativo na sessão. Vive só no cliente — não é persistido no banco. */
  tenantAtivo: Tenant
  /** Papel do usuário logado DENTRO do tenant ativo. */
  roleAtual: Role
  vinculos: TenantVinculo[]
  trocarTenant: (tenantId: string) => void
}

export const TenantContext = createContext<TenantContextValue | null>(null)

export function useTenant(): TenantContextValue {
  const context = use(TenantContext)

  if (!context) {
    throw new Error('useTenant precisa estar dentro de <TenantProvider>.')
  }

  return context
}

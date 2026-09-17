import { createContext, use } from 'react'

import type { AppUser, TenantVinculo } from '@/types/domain'

export type AuthStatus = 'carregando' | 'autenticado' | 'anonimo'

export interface AuthContextValue {
  status: AuthStatus
  user: AppUser | null
  /** Tenants aos quais o usuário tem acesso (multi-CNPJ / filiais). */
  vinculos: TenantVinculo[]
  signIn: (email: string, senha: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = use(AuthContext)

  if (!context) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  }

  return context
}

import { useCallback, useEffect, useMemo, useState } from 'react'

import { authService } from '@/services/auth-service'
import type { AppUser, TenantVinculo } from '@/types/domain'

import { AuthContext, type AuthStatus } from './auth-context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('carregando')
  const [user, setUser] = useState<AppUser | null>(null)
  const [vinculos, setVinculos] = useState<TenantVinculo[]>([])

  // Restaura a sessão persistida no primeiro render.
  useEffect(() => {
    let ativo = true

    async function restaurar() {
      const sessao = await authService.getSession()

      if (!ativo) return

      if (!sessao) {
        setStatus('anonimo')
        return
      }

      const acessos = await authService.getVinculos(sessao.id)

      if (!ativo) return

      setUser(sessao)
      setVinculos(acessos)
      setStatus('autenticado')
    }

    void restaurar()

    return () => {
      ativo = false
    }
  }, [])

  const signIn = useCallback(async (email: string, senha: string) => {
    const autenticado = await authService.signIn(email, senha)
    const acessos = await authService.getVinculos(autenticado.id)

    setUser(autenticado)
    setVinculos(acessos)
    setStatus('autenticado')
  }, [])

  const signOut = useCallback(async () => {
    await authService.signOut()

    setUser(null)
    setVinculos([])
    setStatus('anonimo')
  }, [])

  const value = useMemo(
    () => ({ status, user, vinculos, signIn, signOut }),
    [status, user, vinculos, signIn, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

import { Loader2 } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'

import { AppShell } from '@/components/layout/app-shell'
import { useAuth } from '@/features/auth/auth-context'
import { TenantProvider } from '@/features/tenant/tenant-provider'

export function ProtectedLayout() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'carregando') {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-5 animate-spin text-brand-medium" aria-hidden />
        <span className="ml-2 text-sm text-muted-foreground">Carregando sessão…</span>
      </div>
    )
  }

  if (status === 'anonimo') {
    // `from` permite voltar à rota pretendida depois do login.
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  }

  return (
    <TenantProvider>
      <AppShell />
    </TenantProvider>
  )
}

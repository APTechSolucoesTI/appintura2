import { Lock } from 'lucide-react'

import { podeAcessar, type Modulo } from '@/features/auth/permissions'
import { useTenant } from '@/features/tenant/tenant-context'
import { ROLE_LABEL } from '@/types/domain'

/**
 * Bloqueia a rota quando o papel do usuário no tenant ativo não cobre o módulo.
 * É apenas UX — o bloqueio que vale é a policy de RLS no Postgres.
 */
export function ModuloRoute({
  modulo,
  children,
}: {
  modulo: Modulo
  children: React.ReactNode
}) {
  const { roleAtual, tenantAtivo } = useTenant()

  if (!podeAcessar(roleAtual, modulo)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-status-neutral-soft">
          <Lock className="size-5 text-status-neutral-strong" aria-hidden />
        </span>

        <h1 className="text-xl font-bold text-brand-dark">Sem permissão</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Seu acesso em <strong>{tenantAtivo.nome_fantasia}</strong> é de{' '}
          {ROLE_LABEL[roleAtual]}, que não inclui este módulo. Peça a um administrador
          para ajustar seu papel em Configurações &gt; Equipe.
        </p>
      </div>
    )
  }

  return children
}

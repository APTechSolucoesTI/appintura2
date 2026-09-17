import { LogOut, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/auth-context'
import { SinoNotificacoes } from '@/features/notificacoes/components/sino-notificacoes'
import { TenantSwitcher } from '@/features/tenant/components/tenant-switcher'
import { useTenant } from '@/features/tenant/tenant-context'
import { initials } from '@/lib/format'
import { ROLE_LABEL } from '@/types/domain'

export function AppTopbar({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  const { user, signOut } = useAuth()
  const { roleAtual, tenantAtivo } = useTenant()
  const navigate = useNavigate()

  async function handleSair() {
    await signOut()
    navigate('/entrar', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onAbrirMenu}
        aria-label="Abrir menu de módulos"
      >
        <Menu />
      </Button>

      <TenantSwitcher />

      {/* Enquanto os dados vêm do store em memória, a topbar avisa. */}
      <span className="selo hidden bg-accent text-brand-medium md:inline-flex">
        <span className="size-1.5 rounded-full bg-brand-accent" aria-hidden />
        Demonstração
      </span>

      <div className="flex-1" />

      <SinoNotificacoes />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-12 gap-2.5 px-2"
            aria-label={`Conta de ${user?.nome ?? 'usuário'}`}
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-brand-dark text-xs font-semibold text-white">
                {initials(user?.nome ?? '')}
              </AvatarFallback>
            </Avatar>

            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium text-brand-dark">
                {user?.nome}
              </span>
              <span className="block text-xs font-normal text-muted-foreground">
                {ROLE_LABEL[roleAtual]}
              </span>
            </span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <span className="block text-sm font-medium">{user?.nome}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {user?.email}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {ROLE_LABEL[roleAtual]} em {tenantAtivo.nome_fantasia}
            </span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => void handleSair()}>
            <LogOut aria-hidden />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

import { cn } from 'cn'
import { PanelLeftClose, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { Logo } from '@/components/brand/logo'
import { podeAcessar } from '@/features/auth/permissions'
import { useTenant } from '@/features/tenant/tenant-context'
import { PLANO_LABEL } from '@/types/domain'

import { NAV_GRUPOS, exigeRotaExata } from './nav-config'

/** Classes do item de navegação, iguais para os módulos e para Configurações. */
function classesItem(isActive: boolean): string {
  return cn(
    // min-h-11: alvo de toque confortável em tablet
    'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
    isActive
      ? // Pílula branca sólida: o item ativo salta do fundo navy sem depender de
        // diferença sutil de opacidade, que some na luz do galpão.
        'bg-white text-brand-text shadow-card'
      : 'text-sidebar-foreground/80 hover:bg-white/10 hover:text-white',
  )
}

/**
 * Conteúdo da navegação, compartilhado entre a sidebar fixa (desktop) e o
 * drawer (tablet retrato / mobile).
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { roleAtual, tenantAtivo } = useTenant()

  const grupos = NAV_GRUPOS.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter(
      (item) => item.modulo !== 'configuracoes' && podeAcessar(roleAtual, item.modulo),
    ),
  })).filter((grupo) => grupo.itens.length > 0)

  const podeConfigurar = podeAcessar(roleAtual, 'configuracoes')

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo tom="claro" size="sm" />
      </div>

      <nav aria-label="Módulos" className="flex-1 overflow-y-auto px-3 py-4">
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="mb-6 last:mb-0">
            <p className="px-3 pb-2 font-mono text-[0.6rem] tracking-[0.16em] text-sidebar-foreground/50 uppercase">
              {grupo.titulo}
            </p>

            <ul className="space-y-1">
              {grupo.itens.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/app' || exigeRotaExata(item.to)}
                    onClick={onNavigate}
                    className={({ isActive }) => classesItem(isActive)}
                  >
                    <item.icon className="size-[1.15rem] shrink-0" aria-hidden />
                    <span className="flex-1 leading-tight">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Situação da licença: informação que o dono da fábrica quer ver sem
          procurar, e o lugar natural dela é o rodapé da navegação. */}
      <div className="mx-3 mb-3 rounded-card border border-white/10 bg-white/5 px-3 py-3">
        <p className="flex items-center gap-2 text-xs font-medium text-white">
          <span className="size-1.5 rounded-full bg-brand-accent" aria-hidden />
          Minha licença
        </p>

        <p className="mt-1 text-[0.7rem] text-sidebar-foreground/60">
          Plano {PLANO_LABEL[tenantAtivo.plano]}
        </p>

        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"
          role="img"
          aria-label={`Plano ${PLANO_LABEL[tenantAtivo.plano]}`}
        >
          <div className="h-full w-2/3 rounded-full bg-brand-accent" />
        </div>
      </div>

      {podeConfigurar && (
        <div className="px-3 pb-4">
          <NavLink
            to="/app/configuracoes"
            onClick={onNavigate}
            className={({ isActive }) => classesItem(isActive)}
          >
            <Settings className="size-[1.15rem] shrink-0" aria-hidden />
            <span className="flex-1 leading-tight">Configurações</span>
          </NavLink>
        </div>
      )}

      <div className="flex justify-center border-t border-white/10 py-3">
        <PanelLeftClose
          className="size-4 text-sidebar-foreground/40"
          aria-hidden
        />
      </div>
    </div>
  )
}

import { cn } from 'cn'
import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export interface AbaModulo {
  to: string
  label: string
  icon?: LucideIcon
  /** `true` para não marcar a aba como ativa em rotas filhas. */
  exata?: boolean
}

/**
 * Navegação entre as telas de um mesmo módulo.
 *
 * Fica dentro de um cartão branco e a aba ativa é uma pílula navy sólida — o
 * mesmo contraste forte da sidebar, para a posição atual nunca ficar ambígua.
 * Em tela estreita as abas quebram em linhas em vez de rolar de lado: aba que
 * some fora do campo de visão é aba que ninguém acha.
 */
export function AbasModulo({
  rotulo,
  abas,
}: {
  rotulo: string
  abas: AbaModulo[]
}) {
  return (
    <nav
      aria-label={rotulo}
      className="mb-6 rounded-card border border-border bg-card p-1.5 shadow-card"
    >
      <ul className="flex flex-wrap gap-1">
        {abas.map((aba) => (
          <li key={aba.to}>
            <NavLink
              to={aba.to}
              end={aba.exata}
              className={({ isActive }) =>
                cn(
                  'flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  isActive
                    ? 'bg-brand-dark text-white'
                    : 'text-brand-muted hover:bg-muted hover:text-brand-dark',
                )
              }
            >
              {aba.icon && <aba.icon className="size-4 shrink-0" aria-hidden />}
              {aba.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

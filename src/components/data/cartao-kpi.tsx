import { cn } from 'cn'
import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

/** Tom do tile do ícone. Só realce visual — o texto sempre diz o que é. */
export type TomKpi = 'neutro' | 'positivo' | 'atencao' | 'critico'

const TOM: Record<TomKpi, string> = {
  neutro: 'bg-accent text-brand-medium',
  positivo: 'bg-status-success-soft text-status-success-strong',
  atencao: 'bg-status-warning-soft text-status-warning-strong',
  critico: 'bg-status-danger-soft text-status-danger-strong',
}

interface CartaoKpiProps {
  icon: LucideIcon
  rotulo: string
  valor: string
  detalhe?: string
  tom?: TomKpi
  /** Badge curto no canto superior direito, ex.: "ATENÇÃO". */
  selo?: string
}

/**
 * Cartão de indicador: tile do ícone no topo, valor grande e detalhe discreto.
 * É o bloco repetido em todos os painéis, então vive num componente só.
 */
export function CartaoKpi({
  icon: Icone,
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
  selo,
}: CartaoKpiProps) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn('grid size-10 place-items-center rounded-lg', TOM[tom])}
          >
            <Icone className="size-5" aria-hidden />
          </span>

          {selo && (
            <span className="rounded-full bg-status-danger-soft px-2 py-0.5 font-mono text-[0.6rem] font-bold tracking-[0.1em] text-status-danger-strong uppercase">
              {selo}
            </span>
          )}
        </div>

        <p
          className={cn(
            'mt-4 font-heading text-2xl font-extrabold tracking-tight',
            tom === 'critico' ? 'text-status-danger-strong' : 'text-brand-dark',
          )}
        >
          {valor}
        </p>

        <p className="mt-0.5 text-sm font-medium text-brand-text">{rotulo}</p>

        {detalhe && (
          <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>
        )}
      </CardContent>
    </Card>
  )
}

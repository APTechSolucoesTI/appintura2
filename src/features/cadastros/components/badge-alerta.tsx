import { AlertTriangle, CircleAlert, Clock } from 'lucide-react'

import { diasParaVencer, type AlertaEstoque } from '@/types/cadastros'

/** Forma e tipografia vivem no utilitário `selo` (index.css). */
const BASE = 'selo'

/**
 * Badge de estoque mínimo / validade, compartilhado por cores e insumos.
 *
 * Quando a validade é informada, o rótulo mostra os dias que faltam de verdade —
 * "vence em 30 dias" fixo confundiria o limiar do alerta com o prazo real.
 */
export function BadgeAlerta({
  alerta,
  validade,
}: {
  alerta: AlertaEstoque
  validade?: string
}) {
  if (!alerta) {
    return (
      <span className={`${BASE} bg-status-success-soft text-status-success-strong`}>
        OK
      </span>
    )
  }

  if (alerta === 'vencido') {
    const dias = validade ? Math.abs(diasParaVencer(validade)) : null

    return (
      <span className={`${BASE} bg-status-danger-soft text-status-danger-strong`}>
        <CircleAlert className="size-3" aria-hidden />
        {dias === null ? 'Vencido' : `Vencido há ${dias}d`}
      </span>
    )
  }

  if (alerta === 'estoque_baixo') {
    return (
      <span className={`${BASE} bg-status-warning-soft text-status-warning-strong`}>
        <AlertTriangle className="size-3" aria-hidden />
        Estoque baixo
      </span>
    )
  }

  const dias = validade ? diasParaVencer(validade) : null

  return (
    <span className={`${BASE} bg-status-warning-soft text-status-warning-strong`}>
      <Clock className="size-3" aria-hidden />
      {dias === null
        ? 'Vencendo'
        : dias === 0
          ? 'Vence hoje'
          : dias === 1
            ? 'Vence amanhã'
            : `Vence em ${dias}d`}
    </span>
  )
}

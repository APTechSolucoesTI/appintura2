import { AlertTriangle, Check, CircleDot, Handshake, Minus } from 'lucide-react'

import { STATUS_CONTA_LABEL, type StatusConta } from '@/types/financeiro'

const CONFIG: Record<StatusConta, { classe: string; icon: React.ElementType }> = {
  pago: {
    classe: 'bg-status-success-soft text-status-success-strong',
    icon: Check,
  },
  parcialmente_pago: {
    classe: 'bg-status-warning-soft text-status-warning-strong',
    icon: CircleDot,
  },
  vencido: {
    classe: 'bg-status-danger-soft text-status-danger-strong',
    icon: AlertTriangle,
  },
  negociado: {
    classe: 'bg-accent text-accent-foreground',
    icon: Handshake,
  },
  em_aberto: {
    classe: 'bg-status-neutral-soft text-status-neutral-strong',
    icon: CircleDot,
  },
  cancelado: {
    classe: 'bg-status-neutral-soft text-status-neutral-strong',
    icon: Minus,
  },
}

/** Ícone + texto: o estado do título nunca depende só da cor. */
export function BadgeStatusConta({ status }: { status: StatusConta }) {
  const { classe, icon: Icon } = CONFIG[status]

  return (
    <span
      className={`selo ${classe}`}
    >
      <Icon className="size-3" aria-hidden />
      {STATUS_CONTA_LABEL[status]}
    </span>
  )
}

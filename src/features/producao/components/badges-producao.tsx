import { AlertTriangle, Flame } from 'lucide-react'

import {
  STATUS_OS_LABEL,
  URGENCIA_LABEL,
  type StatusOs,
  type Urgencia,
} from '@/types/producao'

/** Forma e tipografia vivem no utilitário `selo` (index.css). */
const BASE = 'selo'

const ESTILO_URGENCIA: Record<Urgencia, string> = {
  normal: 'bg-status-neutral-soft text-status-neutral-strong',
  alta: 'bg-status-warning-soft text-status-warning-strong',
  urgente: 'bg-status-danger-soft text-status-danger-strong',
}

export function BadgeUrgencia({ urgencia }: { urgencia: Urgencia }) {
  return (
    <span className={`${BASE} ${ESTILO_URGENCIA[urgencia]}`}>
      {urgencia === 'urgente' && <Flame className="size-3" aria-hidden />}
      {URGENCIA_LABEL[urgencia]}
    </span>
  )
}

const ESTILO_STATUS: Record<StatusOs, string> = {
  recebido: 'bg-status-neutral-soft text-status-neutral-strong',
  pre_tratamento: 'bg-accent text-accent-foreground',
  aplicacao_po: 'bg-accent text-accent-foreground',
  cura: 'bg-status-warning-soft text-status-warning-strong',
  controle_qualidade: 'bg-accent text-accent-foreground',
  embalagem: 'bg-accent text-accent-foreground',
  aguardando_retirada: 'bg-status-warning-soft text-status-warning-strong',
  finalizado: 'bg-status-success-soft text-status-success-strong',
  retrabalho: 'bg-status-danger-soft text-status-danger-strong',
}

export function BadgeStatusOs({ status }: { status: StatusOs }) {
  return (
    <span className={`${BASE} ${ESTILO_STATUS[status]}`}>
      {STATUS_OS_LABEL[status]}
    </span>
  )
}

export function BadgeAtraso({ dias }: { dias: number }) {
  return (
    <span className={`${BASE} bg-status-danger-soft text-status-danger-strong`}>
      <AlertTriangle className="size-3" aria-hidden />
      {dias === 1 ? '1 dia de atraso' : `${dias} dias de atraso`}
    </span>
  )
}

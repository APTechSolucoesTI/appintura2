import {
  CONDICAO_LABEL,
  STATUS_DEVOLUCAO_LABEL,
  STATUS_RECEBIMENTO_LABEL,
  type Condicao,
  type StatusDevolucao,
  type StatusRecebimento,
} from '@/types/custodia'

/** Forma e tipografia vivem no utilitário `selo` (index.css). */
const BASE = 'selo'

const ESTILO_RECEBIMENTO: Record<StatusRecebimento, string> = {
  recebido_conferido: 'bg-status-success-soft text-status-success-strong',
  recebido_com_ressalva: 'bg-status-warning-soft text-status-warning-strong',
  pendente_conferencia: 'bg-status-neutral-soft text-status-neutral-strong',
}

export function BadgeStatusRecebimento({ status }: { status: StatusRecebimento }) {
  return (
    <span className={`${BASE} ${ESTILO_RECEBIMENTO[status]}`}>
      {STATUS_RECEBIMENTO_LABEL[status]}
    </span>
  )
}

const ESTILO_DEVOLUCAO: Record<StatusDevolucao, string> = {
  retirado: 'bg-status-success-soft text-status-success-strong',
  retirado_parcial: 'bg-status-warning-soft text-status-warning-strong',
  aguardando_retirada: 'bg-status-neutral-soft text-status-neutral-strong',
}

export function BadgeStatusDevolucao({ status }: { status: StatusDevolucao }) {
  return (
    <span className={`${BASE} ${ESTILO_DEVOLUCAO[status]}`}>
      {STATUS_DEVOLUCAO_LABEL[status]}
    </span>
  )
}

const ESTILO_CONDICAO: Record<Condicao, string> = {
  integra: 'bg-status-success-soft text-status-success-strong',
  avariada: 'bg-status-danger-soft text-status-danger-strong',
  com_observacao: 'bg-status-warning-soft text-status-warning-strong',
}

export function BadgeCondicao({ condicao }: { condicao: Condicao }) {
  return (
    <span className={`${BASE} ${ESTILO_CONDICAO[condicao]}`}>
      {CONDICAO_LABEL[condicao]}
    </span>
  )
}

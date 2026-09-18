import {
  STATUS_ORCAMENTO_LABEL,
  STATUS_ORCAMENTO_TOM,
  type StatusOrcamento,
} from '@/types/orcamento'

/**
 * Selo de situação do orçamento.
 *
 * Usa o utilitário `selo` (index.css), como os selos de custódia e de estoque —
 * a primeira versão usava o `<Badge variant="outline">` do shadcn, que traz
 * borda e tipografia próprias e fazia a aba Comercial destoar do resto do app.
 *
 * Fora da pasta `pages/` de propósito: um componente compartilhado exportado de
 * um arquivo de página quebra o fast refresh e esconde a reutilização.
 */

const ESTILO: Record<string, string> = {
  success: 'bg-status-success-soft text-status-success-strong',
  warning: 'bg-status-warning-soft text-status-warning-strong',
  danger: 'bg-status-danger-soft text-status-danger-strong',
  neutral: 'bg-status-neutral-soft text-status-neutral-strong',
}

export function BadgeStatusOrcamento({ status }: { status: StatusOrcamento }) {
  return (
    <span className={`selo ${ESTILO[STATUS_ORCAMENTO_TOM[status]]}`}>
      {STATUS_ORCAMENTO_LABEL[status]}
    </span>
  )
}

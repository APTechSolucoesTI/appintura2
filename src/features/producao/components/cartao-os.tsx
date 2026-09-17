import { useDraggable } from '@dnd-kit/core'
import { cn } from 'cn'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { formatDate } from '@/lib/format'
import {
  diasParaEntrega,
  estaAtrasada,
  URGENCIA_LABEL,
  type OrdemServico,
} from '@/types/producao'

interface CartaoOsProps {
  os: OrdemServico
  clienteNome: string
  corNome: string
  /** Descrição resumida dos itens, exibida abaixo do cliente. */
  itensResumo: string
  /** `true` no card renderizado dentro do DragOverlay. */
  arrastando?: boolean
}

const ESTILO_URGENCIA = {
  normal: 'text-status-neutral-strong',
  alta: 'text-status-warning-strong',
  urgente: 'text-status-danger-strong',
} as const

/**
 * Card do Kanban.
 *
 * O card inteiro é a alça de arraste e o link "Abrir detalhes" é o único alvo
 * de navegação — assim um toque no corpo do card no tablet nunca abre a OS por
 * engano no meio de um arraste.
 */
export function CartaoOs({
  os,
  clienteNome,
  corNome,
  itensResumo,
  arrastando,
}: CartaoOsProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: os.id })

  const atrasada = estaAtrasada(os)
  const dias = diasParaEntrega(os)

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Ordem ${os.numero} de ${clienteNome}. Arraste para mudar de etapa.`}
      className={cn(
        'cursor-grab touch-none rounded-card border bg-card p-3 shadow-card transition-opacity active:cursor-grabbing',
        atrasada ? 'border-status-danger/40' : 'border-border',
        isDragging && !arrastando && 'opacity-40',
        arrastando && 'rotate-2 shadow-card-hover',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-brand-medium">
          OS {String(os.numero).padStart(5, '0')}
        </span>

        <span
          className={cn(
            'font-mono text-[0.6rem] font-bold tracking-[0.1em] uppercase',
            ESTILO_URGENCIA[os.urgencia],
          )}
        >
          {URGENCIA_LABEL[os.urgencia]}
        </span>
      </div>

      <p className="mt-2 truncate text-sm font-semibold text-brand-dark">
        {clienteNome}
      </p>

      <p className="mt-0.5 truncate text-xs text-brand-muted">{itensResumo}</p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <span
          className={cn(
            'font-mono text-xs',
            atrasada ? 'font-semibold text-status-danger-strong' : 'text-muted-foreground',
          )}
        >
          {atrasada
            ? `${Math.abs(dias)}d de atraso`
            : formatDate(os.previsao_entrega)}
        </span>

        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[0.65rem] text-brand-muted">
          {corNome}
        </span>
      </div>

      <Link
        to={`/app/ordens-servico/${os.id}`}
        // O arraste começa no card; aqui ele é interrompido para o clique passar.
        onPointerDown={(evento) => evento.stopPropagation()}
        className="mt-2.5 flex items-center justify-between rounded-md px-1 py-1 text-xs font-semibold text-brand-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Abrir detalhes
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </article>
  )
}

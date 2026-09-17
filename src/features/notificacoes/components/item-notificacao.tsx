import { Boxes, PackageCheck, Timer, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

import { formatDateTime } from '@/lib/format'
import {
  SEVERIDADE_POR_TIPO,
  TIPO_NOTIFICACAO_LABEL,
  type Notificacao,
  type TipoNotificacao,
} from '@/types/notificacoes'

const ICONE: Record<TipoNotificacao, React.ElementType> = {
  os_aguardando_retirada: PackageCheck,
  os_finalizada: PackageCheck,
  devolucao_disponivel: PackageCheck,
  estoque_minimo: Boxes,
  peca_parada: Timer,
  titulo_vencendo: Wallet,
}

const ESTILO_SEVERIDADE = {
  info: 'bg-accent text-brand-medium',
  atencao: 'bg-status-warning-soft text-status-warning-strong',
  critico: 'bg-status-danger-soft text-status-danger-strong',
}

/** Uma linha da central e do sino. Ícone + rótulo do tipo, nunca cor sozinha. */
export function ItemNotificacao({
  notificacao,
  aoAbrir,
}: {
  notificacao: Notificacao
  aoAbrir: () => void
}) {
  const Icone = ICONE[notificacao.tipo]
  const severidade = SEVERIDADE_POR_TIPO[notificacao.tipo]

  return (
    <Link
      to={notificacao.link}
      onClick={aoAbrir}
      className="flex gap-3 rounded-card px-3 py-2.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${ESTILO_SEVERIDADE[severidade]}`}
      >
        <Icone className="size-4" aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[0.6rem] tracking-[0.12em] text-muted-foreground uppercase">
            {TIPO_NOTIFICACAO_LABEL[notificacao.tipo]}
          </span>

          {!notificacao.lida && (
            <span
              className="size-1.5 rounded-full bg-brand-accent"
              aria-label="Não lida"
            />
          )}
        </span>

        <span className="mt-0.5 block truncate text-sm font-medium text-brand-dark">
          {notificacao.titulo}
        </span>

        <span className="block truncate text-xs text-brand-muted">
          {notificacao.descricao}
        </span>

        <span className="mt-0.5 block font-mono text-[0.65rem] text-muted-foreground">
          {formatDateTime(notificacao.created_at)}
        </span>
      </span>
    </Link>
  )
}

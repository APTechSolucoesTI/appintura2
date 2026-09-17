import { cn } from 'cn'

import { formatDateTime } from '@/lib/format'
import { STATUS_OS_LABEL, type OsStatusHistorico } from '@/types/producao'

/** Trilha de transições da OS, do mais recente para o mais antigo. */
export function LinhaDoTempo({ registros }: { registros: OsStatusHistorico[] }) {
  if (registros.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma transição registrada ainda.
      </p>
    )
  }

  const ordenados = [...registros].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )

  return (
    <ol className="space-y-0">
      {ordenados.map((registro, indice) => {
        const retrabalho = registro.para === 'retrabalho'
        const ultimo = indice === ordenados.length - 1

        return (
          <li key={registro.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'mt-1.5 size-2.5 shrink-0 rounded-full',
                  indice === 0
                    ? 'bg-brand-accent ring-4 ring-accent'
                    : retrabalho
                      ? 'bg-status-danger'
                      : 'bg-border',
                )}
              />
              {!ultimo && <span className="w-px flex-1 bg-border" aria-hidden />}
            </div>

            <div className={cn('min-w-0 flex-1', ultimo ? 'pb-0' : 'pb-5')}>
              <p className="text-sm font-medium text-brand-dark">
                {registro.de
                  ? `${STATUS_OS_LABEL[registro.de]} → ${STATUS_OS_LABEL[registro.para]}`
                  : `Ordem aberta em ${STATUS_OS_LABEL[registro.para]}`}
              </p>

              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {formatDateTime(registro.created_at)} · {registro.responsavel_nome}
              </p>

              {registro.observacao && (
                <p className="mt-1 text-xs text-brand-muted">{registro.observacao}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

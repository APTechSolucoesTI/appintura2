import { Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface AcoesLinhaProps {
  rotulo: string
  aoEditar: () => void
  aoExcluir: () => void
}

/** Par editar/excluir das linhas de listagem, com rótulo acessível por registro. */
export function AcoesLinha({ rotulo, aoEditar, aoExcluir }: AcoesLinhaProps) {
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={aoEditar}
        aria-label={`Editar ${rotulo}`}
      >
        <Pencil />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={aoExcluir}
        aria-label={`Excluir ${rotulo}`}
        className="text-muted-foreground hover:bg-status-danger-soft hover:text-status-danger-strong"
      >
        <Trash2 />
      </Button>
    </div>
  )
}

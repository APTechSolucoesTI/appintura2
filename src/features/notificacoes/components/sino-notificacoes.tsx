import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ItemNotificacao } from '@/features/notificacoes/components/item-notificacao'
import { useNotificacoes } from '@/features/notificacoes/use-notificacoes'

/** Mostra as mais recentes; o histórico completo fica na central. */
const LIMITE_NO_SINO = 6

export function SinoNotificacoes() {
  const [aberto, setAberto] = useState(false)
  const { notificacoes, naoLidas, marcarUma, marcarTodas } = useNotificacoes()

  const visiveis = notificacoes.slice(0, LIMITE_NO_SINO)

  return (
    <DropdownMenu open={aberto} onOpenChange={setAberto}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            naoLidas.length === 0
              ? 'Notificações'
              : `Notificações: ${naoLidas.length} não lida(s)`
          }
        >
          <Bell />

          {naoLidas.length > 0 && (
            <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-status-danger px-1 font-mono text-[0.6rem] font-bold text-white">
              {naoLidas.length > 9 ? '9+' : naoLidas.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold text-brand-dark">Notificações</span>

          {naoLidas.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => marcarTodas.mutate()}
              disabled={marcarTodas.isPending}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {visiveis.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nada por aqui. Alertas de prazo, estoque e cobrança aparecem neste sino.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto p-1">
            {visiveis.map((notificacao) => (
              <li key={notificacao.id}>
                <ItemNotificacao
                  notificacao={notificacao}
                  aoAbrir={() => {
                    if (!notificacao.lida) marcarUma.mutate(notificacao.id)
                    setAberto(false)
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border p-1">
          <Button
            asChild
            variant="ghost"
            className="w-full justify-center"
            onClick={() => setAberto(false)}
          >
            <Link to="/app/notificacoes">Ver todas</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

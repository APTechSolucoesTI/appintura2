import { CheckCheck, Info } from 'lucide-react'
import { useMemo, useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ItemNotificacao } from '@/features/notificacoes/components/item-notificacao'
import { useNotificacoes } from '@/features/notificacoes/use-notificacoes'
import {
  TIPO_NOTIFICACAO_LABEL,
  TIPOS_NOTIFICACAO,
  type TipoNotificacao,
} from '@/types/notificacoes'

export function NotificacoesPage() {
  const { query, notificacoes, naoLidas, marcarUma, marcarTodas } = useNotificacoes()
  const [tipo, setTipo] = useState<'todas' | TipoNotificacao>('todas')
  const [somenteNaoLidas, setSomenteNaoLidas] = useState(false)

  const visiveis = useMemo(
    () =>
      notificacoes.filter((item) => {
        if (tipo !== 'todas' && item.tipo !== tipo) return false
        if (somenteNaoLidas && item.lida) return false

        return true
      }),
    [notificacoes, tipo, somenteNaoLidas],
  )

  return (
    <>
      <PageHeader
        sobretitulo="Avisos da operação"
        titulo="Central de notificações"
        descricao="Prazo, estoque, custódia e cobrança num lugar só."
        acoes={
          naoLidas.length > 0 && (
            <Button
              variant="outline"
              onClick={() => marcarTodas.mutate()}
              disabled={marcarTodas.isPending}
            >
              <CheckCheck aria-hidden />
              Marcar todas como lidas
            </Button>
          )
        }
      />

      <Alert className="mb-5">
        <Info aria-hidden />
        <AlertDescription>
          O envio externo (WhatsApp/APChat) ainda não está integrado. A Edge Function{' '}
          <code className="font-mono">disparar-notificacoes</code> já existe como stub e
          é o ponto único de saída quando o canal for plugado.
        </AlertDescription>
      </Alert>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select
          value={tipo}
          onValueChange={(valor) => setTipo(valor as 'todas' | TipoNotificacao)}
        >
          <SelectTrigger className="w-60" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os tipos</SelectItem>
            {TIPOS_NOTIFICACAO.map((item) => (
              <SelectItem key={item} value={item}>
                {TIPO_NOTIFICACAO_LABEL[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={somenteNaoLidas ? 'default' : 'outline'}
          onClick={() => setSomenteNaoLidas((atual) => !atual)}
          aria-pressed={somenteNaoLidas}
        >
          Só não lidas ({naoLidas.length})
        </Button>
      </div>

      {query.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : visiveis.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <h2 className="text-base font-semibold text-brand-dark">
              {notificacoes.length === 0
                ? 'Nenhuma notificação'
                : 'Nada com esse filtro'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">
              {notificacoes.length === 0
                ? 'Avisos de OS pronta, estoque mínimo, peça parada e título vencendo aparecem aqui.'
                : 'Ajuste o tipo ou desmarque o filtro de não lidas.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y divide-border">
              {visiveis.map((notificacao) => (
                <li key={notificacao.id} className="py-1">
                  <ItemNotificacao
                    notificacao={notificacao}
                    aoAbrir={() => {
                      if (!notificacao.lida) marcarUma.mutate(notificacao.id)
                    }}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}

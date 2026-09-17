import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Logo } from '@/components/brand/logo'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { consultaPublica } from '@/services/producao-service'
import {
  FLUXO_PRODUCAO,
  STATUS_OS_LABEL,
  type StatusOs,
} from '@/types/producao'

/**
 * Página apontada pelo QR code colado no lote de peças. Sem login.
 *
 * Expõe SÓ o andamento: número, etapa e previsão. Nada de cliente, preço, custo
 * ou quantidade — qualquer pessoa com o link vê esta tela, inclusive um
 * concorrente que fotografe a etiqueta no caminhão.
 */
export function ConsultaPublicaPage() {
  const { id = '' } = useParams()

  const osQuery = useQuery({
    queryKey: ['consulta-publica', id],
    queryFn: () => consultaPublica(id),
    retry: false,
  })

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-4">
          <Link to="/">
            <Logo size="sm" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        {osQuery.isPending ? (
          <Skeleton className="h-72 w-full" />
        ) : !osQuery.data ? (
          <Card>
            <CardContent className="py-14 text-center">
              <h1 className="text-xl font-bold text-brand-dark">
                Ordem não encontrada
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-brand-muted">
                Confira o código do QR na etiqueta. Se o problema continuar, fale com a
                empresa que está pintando suas peças.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Andamento
            numero={osQuery.data.numero}
            status={osQuery.data.status}
            previsao={osQuery.data.previsao_entrega}
          />
        )}
      </main>
    </div>
  )
}

function Andamento({
  numero,
  status,
  previsao,
}: {
  numero: number
  status: StatusOs
  previsao: string
}) {
  const emRetrabalho = status === 'retrabalho'
  const indiceAtual = emRetrabalho
    ? FLUXO_PRODUCAO.indexOf('aplicacao_po')
    : FLUXO_PRODUCAO.indexOf(status)

  return (
    <>
      <p className="font-mono text-sm text-brand-medium">
        Ordem de serviço #{String(numero).padStart(4, '0')}
      </p>

      <h1 className="mt-1 text-2xl font-bold text-brand-dark lg:text-3xl">
        {STATUS_OS_LABEL[status]}
      </h1>

      <p className="mt-2 text-sm text-brand-muted">
        Previsão de entrega: {formatDate(previsao)}
      </p>

      {emRetrabalho && (
        <p className="mt-4 rounded-card bg-status-warning-soft px-4 py-3 text-sm text-status-warning-strong">
          Este lote voltou para ajuste de acabamento antes da entrega.
        </p>
      )}

      <Card className="mt-6">
        <CardContent>
          <ol className="space-y-0">
            {FLUXO_PRODUCAO.map((etapa, indice) => {
              const concluida = indice < indiceAtual
              const atual = indice === indiceAtual && !emRetrabalho
              const ultima = indice === FLUXO_PRODUCAO.length - 1

              return (
                <li key={etapa} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={
                        concluida
                          ? 'grid size-6 shrink-0 place-items-center rounded-full bg-brand-accent text-brand-dark'
                          : atual
                            ? 'grid size-6 shrink-0 place-items-center rounded-full bg-brand-dark text-white'
                            : 'grid size-6 shrink-0 place-items-center rounded-full bg-muted'
                      }
                    >
                      {concluida ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : (
                        <span className="font-mono text-[0.6rem] text-muted-foreground">
                          {indice + 1}
                        </span>
                      )}
                    </span>

                    {!ultima && <span className="w-px flex-1 bg-border" aria-hidden />}
                  </div>

                  <p
                    className={
                      atual
                        ? 'pb-5 font-semibold text-brand-dark'
                        : concluida
                          ? 'pb-5 text-brand-muted'
                          : 'pb-5 text-muted-foreground'
                    }
                  >
                    {STATUS_OS_LABEL[etapa]}
                  </p>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Acompanhamento fornecido pelo APPintura. Nenhum dado comercial é exibido nesta
        página.
      </p>
    </>
  )
}

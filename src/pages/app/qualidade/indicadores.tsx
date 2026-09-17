import { useQuery } from '@tanstack/react-query'
import { Info, RotateCcw, SprayCan, Undo2 } from 'lucide-react'
import { useState } from 'react'

import { CartaoKpi } from '@/components/data/cartao-kpi'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { BarrasTaxa } from '@/features/qualidade/components/barras-taxa'
import { useTenant } from '@/features/tenant/tenant-context'
import { indicadoresRetrabalho } from '@/services/qualidade-service'

function haDias(dias: number): string {
  const data = new Date()
  data.setDate(data.getDate() - dias)

  return data.toISOString().slice(0, 10)
}

export function IndicadoresPage() {
  const { tenantAtivo } = useTenant()
  const [de, setDe] = useState(() => haDias(90))
  const [ate, setAte] = useState(() => new Date().toISOString().slice(0, 10))

  const indicadoresQuery = useQuery({
    queryKey: ['qualidade-indicadores', tenantAtivo.id, de, ate],
    queryFn: () => indicadoresRetrabalho(tenantAtivo.id, { de, ate }),
  })

  const dados = indicadoresQuery.data

  return (
    <>
      <PageHeader
        sobretitulo="Retrabalho"
        titulo="Indicadores de qualidade"
        descricao="Taxa de retrabalho no período. O denominador são as OS que entraram na cabine — usar o total de ordens abertas faria o número parecer melhor do que é."
      />

      {/* Filtros numa linha só, acima dos gráficos. */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="periodo-de">De</Label>
          <Input
            id="periodo-de"
            type="date"
            value={de}
            onChange={(evento) => setDe(evento.target.value)}
            className="w-44"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="periodo-ate">Até</Label>
          <Input
            id="periodo-ate"
            type="date"
            value={ate}
            onChange={(evento) => setAte(evento.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {indicadoresQuery.isPending || !dados ? (
        <Skeleton className="h-80 w-full" />
      ) : dados.geral.base === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <h2 className="text-base font-semibold text-brand-dark">
              Nenhuma OS entrou na cabine no período
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">
              A taxa de retrabalho só faz sentido sobre ordens que chegaram à aplicação
              de pó. Amplie o intervalo de datas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {/* Número-manchete: um valor único não vira gráfico. */}
            <CartaoKpi
              icon={RotateCcw}
              rotulo="Taxa de retrabalho"
              valor={`${dados.geral.taxa.toFixed(1).replace('.', ',')}%`}
              detalhe="no período selecionado"
              tom={dados.geral.taxa > 10 ? 'critico' : 'positivo'}
            />

            <CartaoKpi
              icon={SprayCan}
              rotulo="OS na cabine"
              valor={String(dados.geral.base)}
              detalhe="base do cálculo"
            />

            <CartaoKpi
              icon={Undo2}
              rotulo="Com retrabalho"
              valor={String(dados.geral.comRetrabalho)}
              detalhe="ordens que voltaram à cabine"
            />
          </div>

          {dados.geral.base < 5 && (
            <Alert className="mb-6">
              <Info aria-hidden />
              <AlertDescription>
                Com {dados.geral.base} ordem(ns) no período, uma única reprovação move a
                taxa em dezenas de pontos. Trate o número como indício, não como
                medida.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <Card>
              <CardHeader>
                <CardTitle>Retrabalho por cliente</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ajuda a identificar peça ou especificação que dá problema sempre.
                </p>
              </CardHeader>

              <CardContent>
                <BarrasTaxa
                  recortes={dados.porCliente}
                  vazio="Nenhum cliente com OS na cabine no período."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Retrabalho por operador</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Quem fez a aplicação, não quem registrou a reprovação — a inspeção não
                  causou o defeito.
                </p>
              </CardHeader>

              <CardContent>
                <BarrasTaxa
                  recortes={dados.porOperador}
                  vazio="Nenhuma aplicação registrada no período."
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  )
}

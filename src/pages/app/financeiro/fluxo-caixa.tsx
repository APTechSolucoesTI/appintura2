import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { eixoMoeda } from '@/features/financeiro/eixos'
import { TooltipGrafico } from '@/features/financeiro/components/grafico-base'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatCurrency, formatDate } from '@/lib/format'
import { fluxoDeCaixa } from '@/services/financeiro-service'

export function FluxoCaixaPage() {
  const { tenantAtivo } = useTenant()

  const fluxoQuery = useQuery({
    queryKey: ['financeiro', tenantAtivo.id, 'fluxo'],
    queryFn: () => fluxoDeCaixa(tenantAtivo.id),
  })

  if (fluxoQuery.isPending || !fluxoQuery.data) {
    return <Skeleton className="h-96 w-full" />
  }

  const fluxo = fluxoQuery.data
  const temVencidos = fluxo.entradasVencidas > 0 || fluxo.saidasVencidas > 0

  const dados = fluxo.janelas.map((janela) => ({
    rotulo: janela.rotulo,
    Entradas: Math.round(janela.entradas),
    Saídas: Math.round(janela.saidas),
  }))

  return (
    <>
      <PageHeader
        sobretitulo="Projeção"
        titulo="Fluxo de caixa"
        descricao="Projeção de 30, 60 e 90 dias a partir dos vencimentos em aberto."
      />

      {temVencidos && (
        <Alert variant="destructive" className="mb-5">
          <AlertTriangle aria-hidden />
          <AlertDescription>
            Fora da projeção: {formatCurrency(fluxo.entradasVencidas)} a receber e{' '}
            {formatCurrency(fluxo.saidasVencidas)} a pagar já venceram. Título vencido
            não é previsão de entrada — é buraco, e some da projeção de propósito.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Entradas e saídas previstas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Valores acumulados por janela, em reais.
          </p>
        </CardHeader>

        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="rotulo"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={eixoMoeda}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'var(--color-muted)' }}
                  content={<TooltipGrafico />}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  iconType="circle"
                />
                <Bar
                  dataKey="Entradas"
                  fill="var(--color-serie-1)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar dataKey="Saídas" fill="var(--color-serie-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto">
        <CardHeader>
          <CardTitle>Projeção detalhada</CardTitle>
          <p className="text-sm text-muted-foreground">
            O acumulado considera as três janelas somadas.
          </p>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Janela</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Até</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {fluxo.janelas.map((janela) => (
                <TableRow key={janela.rotulo}>
                  <TableCell className="font-medium text-brand-dark">
                    {janela.rotulo}
                  </TableCell>

                  <TableCell className="hidden text-right font-mono text-xs text-brand-muted sm:table-cell">
                    {formatDate(janela.ate)}
                  </TableCell>

                  <TableCell className="text-right font-mono text-sm text-brand-dark">
                    {formatCurrency(janela.entradas)}
                  </TableCell>

                  <TableCell className="text-right font-mono text-sm text-brand-dark">
                    {formatCurrency(janela.saidas)}
                  </TableCell>

                  <TableCell
                    className={`text-right font-mono text-sm font-semibold ${
                      janela.saldo < 0
                        ? 'text-status-danger-strong'
                        : 'text-status-success-strong'
                    }`}
                  >
                    {formatCurrency(janela.saldo)}
                  </TableCell>
                </TableRow>
              ))}

              <TableRow>
                <TableCell colSpan={4} className="font-semibold text-brand-dark">
                  Acumulado em 90 dias
                </TableCell>
                <TableCell
                  className={`text-right font-mono text-sm font-semibold ${
                    fluxo.acumulado < 0
                      ? 'text-status-danger-strong'
                      : 'text-status-success-strong'
                  }`}
                >
                  {formatCurrency(fluxo.acumulado)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}

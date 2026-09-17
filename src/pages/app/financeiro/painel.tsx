import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownToLine,
  CircleAlert,
  Receipt,
  Scale,
} from 'lucide-react'
import { useState } from 'react'
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

import { CartaoKpi } from '@/components/data/cartao-kpi'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { formatCurrency } from '@/lib/format'
import {
  comparativoMensal,
  curvaAbc,
  dreGerencial,
  inadimplencia,
} from '@/services/financeiro-service'

function primeiroDiaDoMes(): string {
  const hoje = new Date()

  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
}

export function PainelFinanceiroPage() {
  const { tenantAtivo } = useTenant()
  const [de, setDe] = useState(primeiroDiaDoMes)
  const [ate, setAte] = useState(() => new Date().toISOString().slice(0, 10))

  const dreQuery = useQuery({
    queryKey: ['financeiro', tenantAtivo.id, 'dre', de, ate],
    queryFn: () => dreGerencial(tenantAtivo.id, { de, ate }),
  })

  const inadimplenciaQuery = useQuery({
    queryKey: ['financeiro', tenantAtivo.id, 'inadimplencia'],
    queryFn: () => inadimplencia(tenantAtivo.id),
  })

  const abcQuery = useQuery({
    queryKey: ['financeiro', tenantAtivo.id, 'abc', de, ate],
    queryFn: () => curvaAbc(tenantAtivo.id, { de, ate }),
  })

  const mensalQuery = useQuery({
    queryKey: ['financeiro', tenantAtivo.id, 'mensal'],
    queryFn: () => comparativoMensal(tenantAtivo.id, 6),
  })

  const dre = dreQuery.data
  const atraso = inadimplenciaQuery.data

  return (
    <>
      <PageHeader
        sobretitulo="Controle financeiro"
        titulo="Dinheiro com contexto operacional."
        descricao="DRE gerencial em regime de caixa: o que entrou e saiu no período, não a competência contábil."
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dre-de">De</Label>
          <Input
            id="dre-de"
            type="date"
            value={de}
            onChange={(evento) => setDe(evento.target.value)}
            className="w-44"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dre-ate">Até</Label>
          <Input
            id="dre-ate"
            type="date"
            value={ate}
            onChange={(evento) => setAte(evento.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {atraso && atraso.valorVencido > 0 && (
        <Alert variant="destructive" className="mb-5">
          <AlertTriangle aria-hidden />
          <AlertDescription>
            {formatCurrency(atraso.valorVencido)} vencidos —{' '}
            {atraso.percentual.toFixed(1).replace('.', ',')}% da carteira em aberto.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoKpi
          icon={ArrowDownToLine}
          rotulo="Recebido no período"
          valor={dre ? formatCurrency(dre.receitaBruta) : '—'}
          detalhe={dre ? `${dre.titulosRecebidos} baixa(s)` : undefined}
        />
        <CartaoKpi
          icon={Scale}
          rotulo="Resultado"
          valor={dre ? formatCurrency(dre.resultado) : '—'}
          tom={dre && dre.resultado < 0 ? 'critico' : 'neutro'}
        />
        <CartaoKpi
          icon={Receipt}
          rotulo="Ticket médio"
          valor={dre ? formatCurrency(dre.ticketMedio) : '—'}
        />
        <CartaoKpi
          icon={CircleAlert}
          rotulo="Inadimplência"
          valor={
            atraso ? `${atraso.percentual.toFixed(1).replace('.', ',')}%` : '—'
          }
          detalhe={atraso ? formatCurrency(atraso.valorVencido) : undefined}
          tom={atraso && atraso.percentual > 0 ? 'critico' : 'neutro'}
        />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>DRE gerencial</CardTitle>
            <p className="text-sm text-muted-foreground">
              Regime de caixa — não bate com a DRE contábil do escritório, e não
              deveria.
            </p>
          </CardHeader>

          <CardContent>
            {dreQuery.isPending || !dre ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <dl className="divide-y divide-border">
                <LinhaDre rotulo="Receita bruta recebida" valor={dre.receitaBruta} />
                <LinhaDre
                  rotulo="(−) Insumo direto"
                  valor={-dre.custoInsumoDireto}
                />
                <LinhaDre rotulo="(=) Margem bruta" valor={dre.margemBruta} destaque />
                <LinhaDre rotulo="(−) Despesa variável" valor={-dre.despesaVariavel} />
                <LinhaDre rotulo="(−) Despesa fixa" valor={-dre.despesaFixa} />
                <LinhaDre rotulo="(=) Resultado" valor={dre.resultado} destaque />
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inadimplência por cliente</CardTitle>
            <p className="text-sm text-muted-foreground">
              Títulos vencidos e não pagos, na data de hoje.
            </p>
          </CardHeader>

          <CardContent>
            {inadimplenciaQuery.isPending || !atraso ? (
              <Skeleton className="h-40 w-full" />
            ) : atraso.porCliente.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum título vencido. Carteira em dia.
              </p>
            ) : (
              <ul className="space-y-3">
                {atraso.porCliente.map((cliente) => (
                  <li
                    key={cliente.cliente_id}
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-brand-dark">
                        {cliente.cliente_nome}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {cliente.titulos} título(s) · até {cliente.dias_max}d de atraso
                      </span>
                    </span>

                    <span className="font-mono text-sm font-semibold text-status-danger-strong">
                      {formatCurrency(cliente.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Comparativo mês a mês</CardTitle>
          <p className="text-sm text-muted-foreground">
            Recebimentos e pagamentos efetivados nos últimos 6 meses.
          </p>
        </CardHeader>

        <CardContent>
          {mensalQuery.isPending || !mensalQuery.data ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mensalQuery.data.map((mes) => ({
                    rotulo: mes.rotulo,
                    Recebido: Math.round(mes.recebido),
                    Pago: Math.round(mes.pago),
                  }))}
                  barGap={2}
                  margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
                >
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
                    width={56}
                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--color-muted)' }}
                    content={<TooltipGrafico />}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                  <Bar
                    dataKey="Recebido"
                    fill="var(--color-serie-1)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar dataKey="Pago" fill="var(--color-serie-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-x-auto">
        <CardHeader>
          <CardTitle>Curva ABC de clientes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pelo valor <strong>recebido</strong> no período — quem compra muito e não
            paga não é classe A.
          </p>
        </CardHeader>

        <CardContent>
          {abcQuery.isPending || !abcQuery.data ? (
            <Skeleton className="h-40 w-full" />
          ) : abcQuery.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum recebimento no período selecionado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Classe</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Acumulado</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {abcQuery.data.map((cliente) => (
                  <TableRow key={cliente.cliente_id}>
                    <TableCell>
                      <span
                        className={`inline-flex size-6 items-center justify-center rounded-full font-mono text-xs font-bold ${
                          cliente.classe === 'A'
                            ? 'bg-brand-dark text-white'
                            : cliente.classe === 'B'
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-muted text-brand-muted'
                        }`}
                      >
                        {cliente.classe}
                      </span>
                    </TableCell>

                    <TableCell className="font-medium text-brand-dark">
                      {cliente.cliente_nome}
                    </TableCell>

                    <TableCell className="text-right font-mono text-sm text-brand-dark">
                      {formatCurrency(cliente.faturado)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-sm text-brand-muted">
                      {cliente.acumulado.toFixed(1).replace('.', ',')}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function LinhaDre({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string
  valor: number
  destaque?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt
        className={
          destaque ? 'text-sm font-semibold text-brand-dark' : 'text-sm text-brand-muted'
        }
      >
        {rotulo}
      </dt>
      <dd
        className={`font-mono text-sm ${
          destaque
            ? valor < 0
              ? 'font-bold text-status-danger-strong'
              : 'font-bold text-brand-dark'
            : 'text-brand-text'
        }`}
      >
        {formatCurrency(valor)}
      </dd>
    </div>
  )
}


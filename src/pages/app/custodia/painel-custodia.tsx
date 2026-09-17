import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, FileText, PackageCheck, Settings, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { CartaoKpi } from '@/components/data/cartao-kpi'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { RelatorioResponsabilidade } from '@/features/custodia/components/relatorio-responsabilidade'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDate } from '@/lib/format'
import { obterConfiguracoes } from '@/services/configuracoes-service'
import { calcularSaldoCustodia } from '@/services/custodia-service'
import { UNIDADE_ITEM_LABEL, type SaldoCliente } from '@/types/custodia'

export function PainelCustodiaPage() {
  const { tenantAtivo } = useTenant()
  const [mostrarZerados, setMostrarZerados] = useState(false)
  const [clienteRelatorio, setClienteRelatorio] = useState<SaldoCliente | null>(null)

  const saldoQuery = useQuery({
    queryKey: ['custodia', tenantAtivo.id],
    queryFn: () => calcularSaldoCustodia(tenantAtivo.id),
  })

  const configQuery = useQuery({
    queryKey: ['configuracoes', tenantAtivo.id],
    queryFn: () => obterConfiguracoes(tenantAtivo.id),
  })

  const diasAlerta = configQuery.data?.dias_alerta_custodia ?? 15
  const saldos = useMemo(() => saldoQuery.data ?? [], [saldoQuery.data])

  const resumo = useMemo(() => {
    const comSaldo = saldos.filter((cliente) => cliente.saldo > 0)
    const itensParados = saldos
      .flatMap((cliente) => cliente.itens)
      .filter((item) => item.saldo > 0 && item.dias_em_custodia >= diasAlerta)

    return {
      unidades: comSaldo.reduce((soma, cliente) => soma + cliente.saldo, 0),
      clientes: comSaldo.length,
      parados: itensParados.length,
    }
  }, [saldos, diasAlerta])

  if (saldoQuery.isPending) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <span className="sr-only">Calculando saldo de custódia</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const visiveis = mostrarZerados
    ? saldos
    : saldos.filter((cliente) => cliente.saldo > 0)

  return (
    <>
      <PageHeader
        sobretitulo="Portaria e responsabilidade"
        titulo="Custódia sem pontos cegos."
        descricao="O que ainda está no seu pátio, por cliente. Recebido menos devolvido, calculado a partir dos romaneios."
        acoes={
          <Button asChild variant="outline">
            <Link to="/app/configuracoes/operacao">
              <Settings aria-hidden />
              Alerta: {diasAlerta} dias
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <CartaoKpi
          icon={PackageCheck}
          rotulo="Unidades em custódia"
          valor={String(resumo.unidades)}
          detalhe="Soma do saldo de todos os itens"
        />
        <CartaoKpi
          icon={Timer}
          rotulo="Clientes com saldo"
          valor={String(resumo.clientes)}
          detalhe="Empresas com material no pátio"
        />
        <CartaoKpi
          icon={AlertTriangle}
          rotulo="Itens parados"
          valor={String(resumo.parados)}
          detalhe={`Há ${diasAlerta} dias ou mais`}
          tom={resumo.parados > 0 ? 'critico' : 'neutro'}
          selo={resumo.parados > 0 ? 'Atenção' : undefined}
        />
      </div>

      {resumo.parados > 0 && (
        <Alert variant="destructive" className="mb-5">
          <AlertTriangle aria-hidden />
          <AlertDescription>
            Há {resumo.parados} item(ns) parado(s) há {diasAlerta} dias ou mais. Peça
            parada ocupa espaço e continua sob sua responsabilidade.
          </AlertDescription>
        </Alert>
      )}

      {saldos.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <h2 className="text-base font-semibold text-brand-dark">
              Nada em custódia
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">
              Assim que o primeiro romaneio de recebimento for registrado, o saldo do
              cliente aparece aqui.
            </p>
            <Button asChild className="mt-6">
              <Link to="/app/recebimento/recebimentos/novo">Registrar recebimento</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2.5">
            <Checkbox
              id="mostrar-zerados"
              checked={mostrarZerados}
              onCheckedChange={(marcado) => setMostrarZerados(marcado === true)}
            />
            <Label htmlFor="mostrar-zerados" className="font-normal">
              Mostrar também clientes com saldo zerado
            </Label>
          </div>

          <div className="space-y-5">
            {visiveis.map((cliente) => (
              <CardCliente
                key={cliente.cliente_id}
                cliente={cliente}
                diasAlerta={diasAlerta}
                mostrarZerados={mostrarZerados}
                aoGerarRelatorio={() => setClienteRelatorio(cliente)}
              />
            ))}
          </div>
        </>
      )}

      <RelatorioResponsabilidade
        cliente={clienteRelatorio}
        aoFechar={() => setClienteRelatorio(null)}
      />
    </>
  )
}

function CardCliente({
  cliente,
  diasAlerta,
  mostrarZerados,
  aoGerarRelatorio,
}: {
  cliente: SaldoCliente
  diasAlerta: number
  mostrarZerados: boolean
  aoGerarRelatorio: () => void
}) {
  const itens = mostrarZerados
    ? cliente.itens
    : cliente.itens.filter((item) => item.saldo > 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{cliente.cliente_nome}</CardTitle>
            <p className="mt-1 font-mono text-sm text-brand-muted">
              {cliente.recebido} recebido · {cliente.devolvido} devolvido ·{' '}
              <strong className="text-brand-dark">{cliente.saldo} em custódia</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {cliente.saldo > 0 && cliente.dias_mais_antigo >= diasAlerta && (
              <span className="selo bg-status-danger-soft text-status-danger-strong">
                <AlertTriangle className="size-3" aria-hidden />
                {cliente.dias_mais_antigo} dias
              </span>
            )}

            <Button variant="outline" size="sm" onClick={aoGerarRelatorio}>
              <FileText aria-hidden />
              Relatório
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Recebido</TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                Devolvido
              </TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Em custódia</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {itens.map((item) => {
              const parado = item.saldo > 0 && item.dias_em_custodia >= diasAlerta

              return (
                <TableRow key={item.recebimento_item_id}>
                  <TableCell>
                    <span className="block font-medium text-brand-dark">
                      {item.descricao}
                    </span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      romaneio #{String(item.recebimento_numero).padStart(4, '0')} ·{' '}
                      {formatDate(item.data_entrada)}
                    </span>
                  </TableCell>

                  <TableCell className="hidden text-right font-mono text-sm text-brand-muted sm:table-cell">
                    {item.recebido}
                  </TableCell>

                  <TableCell className="hidden text-right font-mono text-sm text-brand-muted sm:table-cell">
                    {item.devolvido}
                  </TableCell>

                  <TableCell className="text-right font-mono text-sm font-semibold text-brand-dark">
                    {item.saldo} {UNIDADE_ITEM_LABEL[item.unidade]}
                  </TableCell>

                  <TableCell className="text-right">
                    <span
                      className={
                        parado
                          ? 'selo bg-status-danger-soft text-status-danger-strong'
                          : 'font-mono text-xs text-muted-foreground'
                      }
                    >
                      {item.saldo > 0 ? `${item.dias_em_custodia} dias` : 'devolvido'}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

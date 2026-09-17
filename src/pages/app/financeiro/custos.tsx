import { useQuery } from '@tanstack/react-query'
import { Calculator, Info, Settings, Tag, Target, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

import { CartaoKpi } from '@/components/data/cartao-kpi'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { useTenant } from '@/features/tenant/tenant-context'
import { formatCurrency } from '@/lib/format'
import { obterConfiguracoes } from '@/services/configuracoes-service'
import {
  custosPorOs,
  margemPorCliente,
  pontoEquilibrio,
} from '@/services/custos-service'

function porcentagem(valor: number): string {
  return `${valor.toFixed(1).replace('.', ',')}%`
}

export function CustosPage() {
  const { tenantAtivo } = useTenant()

  const configQuery = useQuery({
    queryKey: ['configuracoes', tenantAtivo.id],
    queryFn: () => obterConfiguracoes(tenantAtivo.id),
  })

  const custosQuery = useQuery({
    queryKey: ['financeiro', tenantAtivo.id, 'custos', configQuery.data],
    queryFn: () => custosPorOs(tenantAtivo.id, configQuery.data!),
    enabled: Boolean(configQuery.data),
  })

  if (custosQuery.isPending || !custosQuery.data || !configQuery.data) {
    return <Skeleton className="h-96 w-full" />
  }

  const custos = custosQuery.data
  const margens = margemPorCliente(custos)
  const equilibrio = pontoEquilibrio(custos, configQuery.data)

  return (
    <>
      <PageHeader
        sobretitulo="Precificação"
        titulo="Custos e margem"
        descricao="Custo real por m² pintado e margem contra o preço cobrado."
        acoes={
          <Button asChild variant="outline">
            <Link to="/app/configuracoes/financeiro">
              <Settings aria-hidden />
              Parâmetros de custo
            </Link>
          </Button>
        }
      />

      <Alert className="mb-5">
        <Info aria-hidden />
        <AlertDescription>
          A tinta é o consumo <strong>real</strong> baixado para a OS, valorizado ao
          custo do quilo. Energia e gás, mão de obra, químicos e depreciação são rateios
          por m² definidos em Configurações — não saem de nota fiscal por ordem, então
          são estimativas suas.
        </AlertDescription>
      </Alert>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoKpi
          icon={Tag}
          rotulo="Preço médio por m²"
          valor={formatCurrency(equilibrio.precoMedioM2)}
        />
        <CartaoKpi
          icon={Calculator}
          rotulo="Custo médio por m²"
          valor={formatCurrency(equilibrio.custoVariavelM2)}
        />
        <CartaoKpi
          icon={TrendingUp}
          rotulo="Margem por m²"
          valor={formatCurrency(equilibrio.margemContribuicaoM2)}
          tom={equilibrio.margemContribuicaoM2 <= 0 ? 'critico' : 'neutro'}
        />
        <CartaoKpi
          icon={Target}
          rotulo="Equilíbrio mensal"
          valor={
            equilibrio.m2Necessarios === null
              ? '—'
              : `${Math.ceil(equilibrio.m2Necessarios).toLocaleString('pt-BR')} m²`
          }
          detalhe={
            equilibrio.m2Necessarios === null
              ? 'Margem por m² não positiva'
              : `para cobrir ${formatCurrency(equilibrio.despesaFixaMensal)} de despesa fixa`
          }
          tom={equilibrio.m2Necessarios === null ? 'critico' : 'neutro'}
        />
      </div>

      {equilibrio.margemContribuicaoM2 <= 0 && (
        <Alert variant="destructive" className="mb-5">
          <Info aria-hidden />
          <AlertDescription>
            A margem por m² não é positiva: cada metro pintado aumenta o prejuízo. Não
            existe volume que feche a conta — o que precisa mudar é o preço ou o custo.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-5 overflow-x-auto">
        <CardHeader>
          <CardTitle>Custo por ordem de serviço</CardTitle>
          <p className="text-sm text-muted-foreground">
            OS sem título emitido aparecem sem margem — ainda não foram faturadas.
          </p>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden text-right md:table-cell">Área</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Tinta</TableHead>
                <TableHead className="text-right">Custo/m²</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Margem</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {custos.map((custo) => (
                <TableRow key={custo.os_id}>
                  <TableCell>
                    <Link
                      to={`/app/ordens-servico/${custo.os_id}`}
                      className="font-mono text-sm font-semibold text-brand-medium hover:underline"
                    >
                      #{String(custo.numero).padStart(4, '0')}
                    </Link>
                  </TableCell>

                  <TableCell className="text-sm text-brand-dark">
                    {custo.cliente_nome}
                  </TableCell>

                  <TableCell className="hidden text-right font-mono text-sm text-brand-muted md:table-cell">
                    {custo.area_m2.toLocaleString('pt-BR')} m²
                  </TableCell>

                  <TableCell className="hidden text-right font-mono text-sm text-brand-muted lg:table-cell">
                    {custo.tinta_kg > 0
                      ? `${custo.tinta_kg.toLocaleString('pt-BR')} kg`
                      : '—'}
                    <span className="block text-xs text-muted-foreground">
                      {formatCurrency(custo.custo_tinta)}
                    </span>
                  </TableCell>

                  <TableCell className="text-right font-mono text-sm text-brand-dark">
                    {formatCurrency(custo.custo_m2)}
                    <span className="block text-xs text-muted-foreground">
                      total {formatCurrency(custo.custo_total)}
                    </span>
                  </TableCell>

                  <TableCell className="text-right font-mono text-sm text-brand-dark">
                    {custo.preco_cobrado === null
                      ? '—'
                      : formatCurrency(custo.preco_cobrado)}
                  </TableCell>

                  <TableCell className="text-right font-mono text-sm">
                    {custo.margem === null ? (
                      <span className="text-muted-foreground">não faturada</span>
                    ) : (
                      <span
                        className={
                          custo.margem >= 0
                            ? 'font-semibold text-status-success-strong'
                            : 'font-semibold text-status-danger-strong'
                        }
                      >
                        {formatCurrency(custo.margem)}
                        <span className="block text-xs font-normal">
                          {custo.margem_percentual === null
                            ? ''
                            : porcentagem(custo.margem_percentual)}
                        </span>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto">
        <CardHeader>
          <CardTitle>Margem de contribuição por cliente</CardTitle>
          <p className="text-sm text-muted-foreground">
            Considera apenas as OS já faturadas.
          </p>
        </CardHeader>

        <CardContent>
          {margens.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma OS faturada ainda — emita títulos vinculados às ordens para a
              margem aparecer aqui.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Área</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Custo</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {margens.map((margem) => (
                  <TableRow key={margem.cliente_id}>
                    <TableCell className="font-medium text-brand-dark">
                      {margem.cliente_nome}
                    </TableCell>

                    <TableCell className="hidden text-right font-mono text-sm text-brand-muted sm:table-cell">
                      {margem.area_m2.toLocaleString('pt-BR')} m²
                    </TableCell>

                    <TableCell className="text-right font-mono text-sm text-brand-dark">
                      {formatCurrency(margem.receita)}
                    </TableCell>

                    <TableCell className="hidden text-right font-mono text-sm text-brand-muted md:table-cell">
                      {formatCurrency(margem.custo)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-sm">
                      <span
                        className={
                          margem.margem >= 0
                            ? 'font-semibold text-status-success-strong'
                            : 'font-semibold text-status-danger-strong'
                        }
                      >
                        {formatCurrency(margem.margem)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {porcentagem(margem.margem_percentual)}
                      </span>
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


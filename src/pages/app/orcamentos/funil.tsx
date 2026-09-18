import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'

import {
  equipeDoTenant,
  funilOrcamentos,
  motivosDeRecusa,
} from '@/services/orcamento-service'

function Indicador({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string
  valor: string
  detalhe?: string
}) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <p className="font-mono text-[0.65rem] tracking-[0.14em] text-brand-medium uppercase">
        {rotulo}
      </p>
      <p className="mt-1 font-mono text-2xl text-brand-dark">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  )
}

export function FunilOrcamentosPage() {
  const { tenantAtivo } = useTenant()

  const funilQuery = useQuery({
    queryKey: ['funil-orcamentos', tenantAtivo.id],
    queryFn: () => funilOrcamentos(tenantAtivo.id),
  })

  const motivosQuery = useQuery({
    queryKey: ['motivos-recusa', tenantAtivo.id],
    queryFn: () => motivosDeRecusa(tenantAtivo.id),
  })

  // A view agrupa por (mes, vendedor). Sem o nome na tabela, dois vendedores
  // viram duas linhas com o mesmo mes e nada que as distinga.
  const equipeQuery = useQuery({
    queryKey: ['equipe-nomes', tenantAtivo.id],
    queryFn: () => equipeDoTenant(tenantAtivo.id),
  })

  const nomePorVendedor = useMemo(() => {
    const mapa = new Map<string, string>()

    for (const pessoa of equipeQuery.data ?? []) mapa.set(pessoa.id, pessoa.nome)

    return mapa
  }, [equipeQuery.data])

  const linhas = useMemo(() => funilQuery.data ?? [], [funilQuery.data])

  // Consolidado de todos os meses e vendedores: a view agrupa nos dois eixos,
  // então somar aqui é o que dá o número da empresa.
  const total = useMemo(() => {
    const base = linhas.reduce(
      (acumulado, linha) => ({
        propostos: acumulado.propostos + linha.propostos,
        ganhos: acumulado.ganhos + linha.ganhos,
        perdidos: acumulado.perdidos + linha.perdidos,
        expirados: acumulado.expirados + linha.expirados,
        em_aberto: acumulado.em_aberto + linha.em_aberto,
        valor_proposto: acumulado.valor_proposto + Number(linha.valor_proposto ?? 0),
        valor_fechado: acumulado.valor_fechado + Number(linha.valor_fechado ?? 0),
      }),
      {
        propostos: 0,
        ganhos: 0,
        perdidos: 0,
        expirados: 0,
        em_aberto: 0,
        valor_proposto: 0,
        valor_fechado: 0,
      },
    )

    const decididos = base.ganhos + base.perdidos + base.expirados

    // Média ponderada pelo número de orçamentos: média das médias mensais daria
    // ao mês com 1 proposta o mesmo peso do mês com 40.
    const comPrazo = linhas.filter((linha) => linha.dias_ate_decisao !== null)
    const somaDias = comPrazo.reduce(
      (soma, linha) => soma + Number(linha.dias_ate_decisao) * linha.propostos,
      0,
    )
    const pesoDias = comPrazo.reduce((soma, linha) => soma + linha.propostos, 0)

    return {
      ...base,
      taxa: decididos > 0 ? (100 * base.ganhos) / decididos : null,
      dias: pesoDias > 0 ? somaDias / pesoDias : null,
    }
  }, [linhas])

  return (
    <>
      <PageHeader
        sobretitulo="Comercial"
        titulo="Funil de orçamentos"
        descricao="Quanto foi proposto, quanto fechou e em quanto tempo o cliente decide."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          rotulo="Taxa de aprovação"
          valor={total.taxa === null ? '—' : `${total.taxa.toFixed(1)}%`}
          detalhe={`${total.ganhos} ganhos de ${total.ganhos + total.perdidos + total.expirados} decididos`}
        />
        <Indicador
          rotulo="Valor fechado"
          valor={formatCurrency(total.valor_fechado)}
          detalhe={`de ${formatCurrency(total.valor_proposto)} propostos`}
        />
        <Indicador
          rotulo="Tempo até decidir"
          valor={total.dias === null ? '—' : `${total.dias.toFixed(1)} dias`}
          detalhe="Do envio à resposta do cliente"
        />
        <Indicador
          rotulo="Em aberto"
          valor={String(total.em_aberto)}
          detalhe="Aguardando decisão do cliente"
        />
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Por mês</CardTitle>
          <p className="text-sm text-muted-foreground">
            A taxa considera só o que já foi decidido — incluir os em aberto afundaria
            o mês corrente sem motivo.
          </p>
        </CardHeader>

        <CardContent>
          {linhas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum orçamento registrado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Propostos</TableHead>
                  <TableHead className="text-right">Ganhos</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Perdidos</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Expirados</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Fechado</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {linhas.map((linha) => (
                  <TableRow key={`${linha.mes}-${linha.vendedor_id}`}>
                    <TableCell className="font-mono text-sm">
                      {formatDate(linha.mes).slice(3)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {nomePorVendedor.get(linha.vendedor_id) ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {linha.propostos}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-status-success-strong">
                      {linha.ganhos}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right font-mono text-sm">
                      {linha.perdidos}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right font-mono text-sm">
                      {linha.expirados}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {linha.taxa_aprovacao === null
                        ? '—'
                        : `${Number(linha.taxa_aprovacao).toFixed(1)}%`}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(Number(linha.valor_fechado ?? 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por que o cliente não fechou</CardTitle>
          <p className="text-sm text-muted-foreground">
            O texto que o próprio cliente escreveu ao recusar ou pedir alteração. É o
            dado qualitativo que o percentual não conta.
          </p>
        </CardHeader>

        <CardContent>
          {(motivosQuery.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma recusa com justificativa registrada.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(motivosQuery.data ?? []).map((motivo) => (
                <li key={`${motivo.orcamento_id}-${motivo.created_at}`} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      to={`/app/orcamentos/${motivo.orcamento_id}`}
                      className="font-medium text-brand-dark hover:underline"
                    >
                      Orçamento nº {motivo.orcamento_numero}
                    </Link>

                    <span className="font-mono text-xs text-muted-foreground">
                      {formatDateTime(motivo.created_at)}
                    </span>
                  </div>

                  <p className="mt-1 text-sm">“{motivo.motivo}”</p>

                  {motivo.autor_nome && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {motivo.autor_nome} ·{' '}
                      {motivo.tipo === 'rejeitado' ? 'Recusou' : 'Pediu alteração'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}

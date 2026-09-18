import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, ExternalLink, FileText, Link2, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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
import { clientesStore } from '@/services/cadastros-service'
import {
  gerarLinkPublico,
  obterComTimeline,
  revisarOrcamento,
} from '@/services/orcamento-service'
import {
  EVENTO_ORCAMENTO_LABEL,
  ehEditavel,
  estaEmAberto,
  podeRevisar,
} from '@/types/orcamento'

import { AnexosOrcamento } from '@/features/orcamentos/components/anexos-orcamento'
import { BadgeStatusOrcamento } from '@/features/orcamentos/components/badge-orcamento'
import { DiffVersoes } from '@/features/orcamentos/components/diff-versoes'

export function OrcamentoDetalhePage() {
  const { tenantAtivo } = useTenant()
  const { id = '' } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [linkGerado, setLinkGerado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const orcamentoQuery = useQuery({
    queryKey: ['orcamento', tenantAtivo.id, id],
    queryFn: () => obterComTimeline(tenantAtivo.id, id),
  })

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const enviar = useMutation({
    mutationFn: () => gerarLinkPublico(id),
    onSuccess: async ({ url }) => {
      setLinkGerado(url)
      await queryClient.invalidateQueries({ queryKey: ['orcamento', tenantAtivo.id, id] })
      toast.success('Link gerado', {
        description: 'Copie e envie ao cliente. Links anteriores foram revogados.',
      })
    },
    onError: (erro) =>
      toast.error('Não foi possível gerar o link', {
        description: erro instanceof Error ? erro.message : undefined,
      }),
  })

  const revisar = useMutation({
    mutationFn: () => revisarOrcamento(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orcamentos', tenantAtivo.id] })
      toast.success('Revisão criada', {
        description: 'O link anterior foi revogado. Edite a nova versão e envie de novo.',
      })
    },
  })

  const orcamento = orcamentoQuery.data

  if (orcamentoQuery.isPending) {
    return <p className="py-10 text-sm text-muted-foreground">Carregando orçamento…</p>
  }

  if (!orcamento) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Orçamento não encontrado nesta empresa.
        </AlertDescription>
      </Alert>
    )
  }

  const cliente = (clientesQuery.data ?? []).find((c) => c.id === orcamento.cliente_id)

  return (
    <>
      <PageHeader
        sobretitulo={`Orçamento nº ${orcamento.numero}`}
        titulo={cliente?.razao_social ?? 'Cliente removido'}
        descricao={`Válido até ${formatDate(orcamento.data_validade)} · ${formatCurrency(orcamento.valor_total)}`}
        acoes={
          <div className="flex flex-wrap gap-2">
            {ehEditavel(orcamento.status) && (
              <Button asChild variant="outline">
                <Link to={`/app/orcamentos/${orcamento.id}/editar`}>
                  <Pencil aria-hidden />
                  Editar
                </Link>
              </Button>
            )}

            {(ehEditavel(orcamento.status) || estaEmAberto(orcamento.status)) && (
              <Button onClick={() => enviar.mutate()} disabled={enviar.isPending}>
                <Link2 aria-hidden />
                {orcamento.status === 'rascunho' ? 'Enviar para aprovação' : 'Gerar novo link'}
              </Button>
            )}

            {podeRevisar(orcamento.status) && (
              <Button
                variant="outline"
                onClick={() => revisar.mutate()}
                disabled={revisar.isPending}
              >
                <FileText aria-hidden />
                Criar revisão
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex items-center gap-3">
        <BadgeStatusOrcamento status={orcamento.status} />

        {orcamento.os_id && (
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link to={`/app/ordens-servico/${orcamento.os_id}`}>
              Ver ordem de serviço gerada
              <ExternalLink aria-hidden className="ml-1 size-3" />
            </Link>
          </Button>
        )}
      </div>

      {linkGerado && (
        <Alert className="mb-5">
          <Link2 aria-hidden />
          <AlertDescription className="space-y-2">
            <p>
              Envie este link ao cliente. Ele aparece <strong>uma única vez</strong> — o
              banco guarda só o hash, então não há como recuperá-lo depois. Se perder, gere
              outro.
            </p>

            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-field bg-muted px-2 py-1 font-mono text-xs">
                {linkGerado}
              </code>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(linkGerado)
                  setCopiado(true)
                  setTimeout(() => setCopiado(false), 2000)
                }}
              >
                {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copiado ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Itens</CardTitle>
            </CardHeader>

            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peça</TableHead>
                    <TableHead className="hidden sm:table-cell">Acabamento</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Unitário</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {orcamento.itens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.descricao}
                        {!item.aprovado && (
                          <span className="ml-2 text-xs text-status-danger-strong">
                            recusado pelo cliente
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {item.tipo_acabamento || '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.quantidade}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(item.valor_unitario)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(item.valor_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 space-y-1 border-t border-border pt-3">
                <div className="flex items-baseline justify-end gap-3">
                  <span className="text-sm text-muted-foreground">Proposto</span>
                  <strong className="font-mono text-lg text-brand-dark">
                    {formatCurrency(orcamento.valor_total)}
                  </strong>
                </div>

                {orcamento.valor_aprovado !== null &&
                  Number(orcamento.valor_aprovado) !== Number(orcamento.valor_total) && (
                    <div className="flex items-baseline justify-end gap-3">
                      <span className="text-sm text-muted-foreground">
                        Fechado pelo cliente
                      </span>
                      <strong className="font-mono text-lg text-status-warning-strong">
                        {formatCurrency(Number(orcamento.valor_aprovado))}
                      </strong>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>

          <AnexosOrcamento
            tenantId={tenantAtivo.id}
            orcamentoId={orcamento.id}
            anexos={orcamento.anexos ?? []}
            editavel={ehEditavel(orcamento.status)}
          />

          {orcamento.orcamento_versao_anterior_id && (
            <DiffVersoes orcamentoId={orcamento.id} />
          )}

          {orcamento.observacoes_internas && (
            <Card>
              <CardHeader>
                <CardTitle>Observação interna</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Nunca sai no link do cliente.
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {orcamento.observacoes_internas}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Linha do tempo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Trilha somente-inserção. É o que sustenta a aprovação numa eventual disputa.
            </p>
          </CardHeader>

          <CardContent>
            <ol className="space-y-4">
              {(orcamento.eventos ?? []).map((evento, indice) => (
                <li key={evento.id} className="relative pl-5">
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 size-2 rounded-full bg-brand-accent"
                  />

                  {indice < (orcamento.eventos?.length ?? 0) - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[3px] top-4 h-full w-px bg-border"
                    />
                  )}

                  <p className="text-sm font-medium text-brand-dark">
                    {EVENTO_ORCAMENTO_LABEL[evento.tipo] ?? evento.tipo}
                  </p>

                  <p className="font-mono text-xs text-muted-foreground">
                    {formatDateTime(evento.created_at)}
                  </p>

                  {evento.autor_nome && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Por {evento.autor_nome}
                      {evento.autor_documento && ` · ${evento.autor_documento}`}
                    </p>
                  )}

                  {evento.ip && (
                    <p className="font-mono text-[0.65rem] text-muted-foreground">
                      IP {evento.ip}
                    </p>
                  )}

                  {typeof evento.metadata?.mensagem === 'string' &&
                    evento.metadata.mensagem !== '' && (
                      <p className="mt-1 rounded-field bg-muted px-2 py-1 text-xs">
                        “{evento.metadata.mensagem}”
                      </p>
                    )}
                </li>
              ))}
            </ol>

            <Separator className="my-4" />

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Prazo de entrega</dt>
                <dd>{orcamento.prazo_entrega_dias} dias</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Pagamento</dt>
                <dd className="text-right">{orcamento.condicoes_pagamento || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Espessura</dt>
                <dd>
                  {orcamento.espessura_min_micron} a {orcamento.espessura_max_micron} µm
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

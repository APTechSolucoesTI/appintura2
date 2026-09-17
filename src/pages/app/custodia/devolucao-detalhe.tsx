import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BadgeCondicao,
  BadgeStatusDevolucao,
} from '@/features/custodia/components/badges-custodia'
import { BotaoPdfRomaneio } from '@/features/custodia/components/botao-pdf'
import { GaleriaFotos } from '@/features/custodia/components/galeria-fotos'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDocumento } from '@/lib/documento'
import { formatDateTime } from '@/lib/format'
import { clientesStore, transportadorasStore } from '@/services/cadastros-service'
import { devolucoesStore, recebimentosStore } from '@/services/custodia-service'
import { UNIDADE_ITEM_LABEL } from '@/types/custodia'

export function DevolucaoDetalhePage() {
  const { id = '' } = useParams()
  const { tenantAtivo } = useTenant()

  const devolucaoQuery = useQuery({
    queryKey: ['devolucoes', tenantAtivo.id, id],
    queryFn: () => devolucoesStore.obter(tenantAtivo.id, id),
    retry: false,
  })

  const recebimentosQuery = useQuery({
    queryKey: ['recebimentos', tenantAtivo.id],
    queryFn: () => recebimentosStore.listar(tenantAtivo.id),
  })

  const todasDevolucoesQuery = useQuery({
    queryKey: ['devolucoes', tenantAtivo.id],
    queryFn: () => devolucoesStore.listar(tenantAtivo.id),
  })

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const transportadorasQuery = useQuery({
    queryKey: ['transportadoras', tenantAtivo.id],
    queryFn: () => transportadorasStore.listar(tenantAtivo.id),
  })

  if (devolucaoQuery.isPending) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <span className="sr-only">Carregando devolução</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (devolucaoQuery.isError || !devolucaoQuery.data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold text-brand-dark">Devolução não encontrada</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Este romaneio não existe em {tenantAtivo.nome_fantasia}.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/app/recebimento/devolucoes">Voltar para a lista</Link>
        </Button>
      </div>
    )
  }

  const devolucao = devolucaoQuery.data
  const cliente = clientesQuery.data?.find((item) => item.id === devolucao.cliente_id)
  const transportadora = transportadorasQuery.data?.find(
    (item) => item.id === devolucao.transportadora_id,
  )

  // Quantidade original de cada item, para o comparativo entrada x saída.
  const recebidoPorItem = new Map<string, { quantidade: number; numero: number }>()

  for (const romaneio of recebimentosQuery.data ?? []) {
    for (const item of romaneio.itens) {
      recebidoPorItem.set(item.id, {
        quantidade: item.quantidade,
        numero: romaneio.numero,
      })
    }
  }

  // Soma de TODAS as devoluções do item, não só desta. Sem isso, uma saída final
  // de 8 contra uma entrada de 60 apareceria como divergência — quando na verdade
  // as outras 52 já haviam saído em romaneios anteriores.
  const devolvidoNoTotal = new Map<string, number>()

  for (const outra of todasDevolucoesQuery.data ?? []) {
    for (const item of outra.itens) {
      devolvidoNoTotal.set(
        item.recebimento_item_id,
        (devolvidoNoTotal.get(item.recebimento_item_id) ?? 0) + item.quantidade,
      )
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link to="/app/recebimento/devolucoes">
          <ArrowLeft aria-hidden />
          Devoluções
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-sm text-brand-medium">
            Romaneio de devolução #{String(devolucao.numero).padStart(4, '0')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-brand-dark lg:text-3xl">
            {cliente?.razao_social ?? 'Cliente removido'}
          </h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {formatDateTime(devolucao.data_hora)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <BadgeStatusDevolucao status={devolucao.status} />

          <BotaoPdfRomaneio
            tipo="devolucao"
            romaneioId={devolucao.id}
            numero={devolucao.numero}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dados da retirada</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Dado rotulo="Retirado por" valor={devolucao.retirado_por_nome} />
            <Dado
              rotulo="Documento"
              valor={
                devolucao.retirado_por_documento
                  ? formatDocumento(devolucao.retirado_por_documento)
                  : '—'
              }
              mono
            />
            <Dado
              rotulo="Transportadora"
              valor={transportadora?.nome ?? 'Veículo do cliente'}
            />
            <Dado rotulo="Placa" valor={devolucao.placa || '—'} mono />
            <Dado rotulo="Responsável na empresa" valor={devolucao.responsavel_nome} />
            <Dado
              rotulo="Romaneios de entrada"
              valor={devolucao.recebimento_ids
                .map((recebimentoId) => {
                  const romaneio = recebimentosQuery.data?.find(
                    (item) => item.id === recebimentoId,
                  )

                  return romaneio
                    ? `#${String(romaneio.numero).padStart(4, '0')}`
                    : '—'
                })
                .join(', ')}
              mono
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assinatura de quem retirou</CardTitle>
          </CardHeader>

          <CardContent>
            {devolucao.assinatura_url ? (
              <img
                src={devolucao.assinatura_url}
                alt={`Assinatura de ${devolucao.retirado_por_nome}`}
                className="w-full rounded-card border border-border bg-white"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Ainda sem assinatura — a mercadoria está separada aguardando retirada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-8 mb-4 text-lg font-bold text-brand-dark">
        Comparativo de saída ({devolucao.itens.length} item(ns))
      </h2>

      <div className="space-y-4">
        {devolucao.itens.map((item) => {
          const entrada = recebidoPorItem.get(item.recebimento_item_id)
          const totalDevolvido = devolvidoNoTotal.get(item.recebimento_item_id) ?? 0
          const emCustodia = entrada ? entrada.quantidade - totalDevolvido : 0
          const unidade = UNIDADE_ITEM_LABEL[item.unidade]

          return (
            <Card key={item.id}>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-brand-dark">{item.descricao}</p>
                    <p className="mt-1 font-mono text-sm text-brand-muted">
                      saiu {item.quantidade} {unidade} nesta devolução
                    </p>
                    {entrada && (
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        romaneio de entrada #{String(entrada.numero).padStart(4, '0')} ·{' '}
                        {entrada.quantidade} recebida(s) · {totalDevolvido} devolvida(s)
                        no total
                      </p>
                    )}
                  </div>

                  <BadgeCondicao condicao={item.condicao_saida} />
                </div>

                {emCustodia > 0 && (
                  <p className="flex items-start gap-2 rounded-card bg-status-warning-soft px-3 py-2 text-sm text-status-warning-strong">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      <strong>
                        {emCustodia} {unidade} ainda em custódia.
                      </strong>{' '}
                      {item.justificativa || 'Divergência sem justificativa registrada.'}
                    </span>
                  </p>
                )}

                <GaleriaFotos fotos={item.fotos} rotulo={item.descricao} />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}

function Dado({
  rotulo,
  valor,
  mono = false,
}: {
  rotulo: string
  valor: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
        {rotulo}
      </p>
      <p className={mono ? 'mt-1 font-mono text-brand-dark' : 'mt-1 text-brand-dark'}>
        {valor}
      </p>
    </div>
  )
}

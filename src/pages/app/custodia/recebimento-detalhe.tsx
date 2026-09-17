import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BadgeCondicao,
  BadgeStatusRecebimento,
} from '@/features/custodia/components/badges-custodia'
import { BotaoPdfRomaneio } from '@/features/custodia/components/botao-pdf'
import { GaleriaFotos } from '@/features/custodia/components/galeria-fotos'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDateTime } from '@/lib/format'
import { clientesStore, transportadorasStore } from '@/services/cadastros-service'
import { recebimentosStore } from '@/services/custodia-service'
import { ordensDoRomaneio } from '@/services/producao-service'
import { BadgeStatusOs } from '@/features/producao/components/badges-producao'
import { UNIDADE_ITEM_LABEL } from '@/types/custodia'

export function RecebimentoDetalhePage() {
  const { id = '' } = useParams()
  const { tenantAtivo } = useTenant()

  const romaneioQuery = useQuery({
    queryKey: ['recebimentos', tenantAtivo.id, id],
    queryFn: () => recebimentosStore.obter(tenantAtivo.id, id),
    retry: false,
  })

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const transportadorasQuery = useQuery({
    queryKey: ['transportadoras', tenantAtivo.id],
    queryFn: () => transportadorasStore.listar(tenantAtivo.id),
  })

  const ordensQuery = useQuery({
    queryKey: ['ordens-servico', tenantAtivo.id, 'romaneio', id],
    queryFn: () => ordensDoRomaneio(tenantAtivo.id, id),
  })

  if (romaneioQuery.isPending) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <span className="sr-only">Carregando romaneio</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (romaneioQuery.isError || !romaneioQuery.data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold text-brand-dark">Romaneio não encontrado</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Este romaneio não existe em {tenantAtivo.nome_fantasia}.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/app/recebimento/recebimentos">Voltar para a lista</Link>
        </Button>
      </div>
    )
  }

  const romaneio = romaneioQuery.data
  const cliente = clientesQuery.data?.find((item) => item.id === romaneio.cliente_id)
  const transportadora = transportadorasQuery.data?.find(
    (item) => item.id === romaneio.transportadora_id,
  )

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link to="/app/recebimento/recebimentos">
          <ArrowLeft aria-hidden />
          Recebimentos
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-sm text-brand-medium">
            Romaneio de recebimento #{String(romaneio.numero).padStart(4, '0')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-brand-dark lg:text-3xl">
            {cliente?.razao_social ?? 'Cliente removido'}
          </h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {formatDateTime(romaneio.data_hora)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <BadgeStatusRecebimento status={romaneio.status} />

          <BotaoPdfRomaneio
            tipo="recebimento"
            romaneioId={romaneio.id}
            numero={romaneio.numero}
          />

          <Button asChild>
            <Link to={`/app/ordens-servico/nova?romaneio=${romaneio.id}`}>
              <Plus aria-hidden />
              Abrir OS
            </Link>
          </Button>
        </div>
      </div>

      {ordensQuery.data && ordensQuery.data.length > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Ordens abertas a partir deste romaneio</CardTitle>
            <p className="text-sm text-muted-foreground">
              Uma carga pode gerar várias OS — uma por cor ou acabamento.
            </p>
          </CardHeader>

          <CardContent>
            <ul className="divide-y divide-border rounded-card border border-border">
              {ordensQuery.data.map((os) => (
                <li key={os.id}>
                  <Link
                    to={`/app/ordens-servico/${os.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted"
                  >
                    <span className="font-mono text-sm font-semibold text-brand-medium">
                      OS #{String(os.numero).padStart(4, '0')}
                    </span>
                    <BadgeStatusOs status={os.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dados da entrada</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Dado
              rotulo="Nota de remessa"
              valor={`${romaneio.documento_numero}/${romaneio.documento_serie}`}
              mono
            />
            <Dado
              rotulo="Transportadora"
              valor={transportadora?.nome ?? 'Veículo do cliente'}
            />
            <Dado rotulo="Conferente" valor={romaneio.conferente_nome} />
            <Dado rotulo="Entregue por" valor={romaneio.assinatura_nome} />

            {romaneio.documento_chave && (
              <Dado
                rotulo="Chave de acesso"
                valor={romaneio.documento_chave}
                mono
                className="sm:col-span-2"
              />
            )}

            {romaneio.observacao && (
              <Dado
                rotulo="Observações"
                valor={romaneio.observacao}
                className="sm:col-span-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assinatura de quem entregou</CardTitle>
          </CardHeader>

          <CardContent>
            {romaneio.assinatura_url ? (
              <img
                src={romaneio.assinatura_url}
                alt={`Assinatura de ${romaneio.assinatura_nome}`}
                className="w-full rounded-card border border-border bg-white"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Este romaneio foi gerado sem assinatura.
              </p>
            )}

            <p className="mt-2 text-xs text-muted-foreground">
              {romaneio.assinatura_nome}
            </p>
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-8 mb-4 text-lg font-bold text-brand-dark">
        Itens recebidos ({romaneio.itens.length})
      </h2>

      <div className="space-y-4">
        {romaneio.itens.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-brand-dark">{item.descricao}</p>
                  <p className="mt-1 font-mono text-sm text-brand-muted">
                    {item.quantidade} {UNIDADE_ITEM_LABEL[item.unidade]}
                    {item.peso_kg !== null && ` · ${item.peso_kg} kg`}
                  </p>
                </div>

                <BadgeCondicao condicao={item.condicao_chegada} />
              </div>

              {item.observacao && (
                <p className="rounded-card bg-status-warning-soft px-3 py-2 text-sm text-status-warning-strong">
                  {item.observacao}
                </p>
              )}

              <GaleriaFotos fotos={item.fotos} rotulo={item.descricao} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

function Dado({
  rotulo,
  valor,
  mono = false,
  className,
}: {
  rotulo: string
  valor: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
        {rotulo}
      </p>
      <p
        className={
          mono ? 'mt-1 font-mono break-all text-brand-dark' : 'mt-1 text-brand-dark'
        }
      >
        {valor}
      </p>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { PackageCheck, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Logo } from '@/components/brand/logo'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'
import { consultaPublicaRomaneio } from '@/services/custodia-service'

/**
 * Página do QR code impresso no romaneio. Sem login.
 *
 * Confirma que o documento é autêntico e mostra número, tipo, data e o total de
 * itens — nada além. Nome do cliente e descrição da carga ficam de fora: o papel
 * com o QR pode ser fotografado por qualquer um no pátio ou no caminhão, e a URL
 * vaza junto.
 */
export function ConsultaRomaneioPage() {
  const { tipo = '', id = '' } = useParams()
  const valido = tipo === 'recebimento' || tipo === 'devolucao'

  const romaneioQuery = useQuery({
    queryKey: ['consulta-romaneio', tipo, id],
    queryFn: () => consultaPublicaRomaneio(tipo as 'recebimento' | 'devolucao', id),
    enabled: valido,
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
        {!valido ? (
          <NaoEncontrado />
        ) : romaneioQuery.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : !romaneioQuery.data ? (
          <NaoEncontrado />
        ) : (
          <>
            <p className="font-mono text-sm text-brand-medium">
              Romaneio de {tipo === 'recebimento' ? 'recebimento' : 'devolução'}
            </p>

            <h1 className="mt-1 font-mono text-3xl font-bold text-brand-dark">
              #{String(romaneioQuery.data.numero).padStart(4, '0')}
            </h1>

            <Card className="mt-6">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 rounded-card bg-status-success-soft px-4 py-3">
                  <ShieldCheck
                    className="size-5 shrink-0 text-status-success-strong"
                    aria-hidden
                  />
                  <p className="text-sm font-medium text-status-success-strong">
                    Documento emitido pelo APPintura e confere com o registro da
                    empresa.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Dado
                    rotulo={tipo === 'recebimento' ? 'Entrada em' : 'Saída em'}
                    valor={formatDateTime(romaneioQuery.data.data_hora)}
                  />
                  <Dado
                    rotulo="Itens no documento"
                    valor={`${romaneioQuery.data.total_itens} item(ns) · ${romaneioQuery.data.total_unidades} unidade(s)`}
                  />
                </div>

                <div className="flex items-start gap-3 rounded-card bg-muted px-4 py-3">
                  <PackageCheck
                    className="mt-0.5 size-4 shrink-0 text-brand-medium"
                    aria-hidden
                  />
                  <p className="text-xs text-brand-muted">
                    A descrição da carga e os dados do cliente não são exibidos nesta
                    página pública. Eles constam no documento impresso e no sistema da
                    empresa.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

function NaoEncontrado() {
  return (
    <Card>
      <CardContent className="py-14 text-center">
        <h1 className="text-xl font-bold text-brand-dark">Romaneio não encontrado</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-brand-muted">
          Confira o código do QR impresso no documento. Se o problema continuar, fale
          com a empresa que emitiu o romaneio.
        </p>
      </CardContent>
    </Card>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
        {rotulo}
      </p>
      <p className="mt-1 text-brand-dark">{valor}</p>
    </div>
  )
}

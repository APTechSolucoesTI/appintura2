import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, FileUp, Loader2, PackageCheck, RotateCcw, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/features/auth/auth-context'
import {
  BadgeAtraso,
  BadgeStatusOs,
  BadgeUrgencia,
} from '@/features/producao/components/badges-producao'
import { LinhaDoTempo } from '@/features/producao/components/linha-do-tempo'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDate } from '@/lib/format'
import { clientesStore, coresStore } from '@/services/cadastros-service'
import { recebimentosStore } from '@/services/custodia-service'
import { moverStatus, ordensStore } from '@/services/producao-service'
import {
  areaTotal,
  consumoEstimadoKg,
  diasParaEntrega,
  estaAtrasada,
  PRETRATAMENTO_LABEL,
  STATUS_APOS_RETRABALHO,
  STATUS_OS,
  STATUS_OS_LABEL,
  type StatusOs,
} from '@/types/producao'

export function OrdemDetalhePage() {
  const { id = '' } = useParams()
  const { tenantAtivo } = useTenant()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const osQuery = useQuery({
    queryKey: ['ordens-servico', tenantAtivo.id, id],
    queryFn: () => ordensStore.obter(tenantAtivo.id, id),
    retry: false,
  })

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const coresQuery = useQuery({
    queryKey: ['cores', tenantAtivo.id],
    queryFn: () => coresStore.listar(tenantAtivo.id),
  })

  const recebimentosQuery = useQuery({
    queryKey: ['recebimentos', tenantAtivo.id],
    queryFn: () => recebimentosStore.listar(tenantAtivo.id),
  })

  const mover = useMutation({
    mutationFn: (novoStatus: StatusOs) =>
      moverStatus({
        tenantId: tenantAtivo.id,
        osId: id,
        novoStatus,
        responsavelId: user?.id ?? '',
        responsavelNome: user?.nome ?? '',
      }),
    onSuccess: async (os) => {
      await queryClient.invalidateQueries({ queryKey: ['ordens-servico', tenantAtivo.id] })
      toast.success('Etapa atualizada', {
        description: `OS #${String(os.numero).padStart(4, '0')} agora está em ${STATUS_OS_LABEL[os.status]}.`,
      })
    },
    onError: () => {
      toast.error('Não foi possível mudar a etapa', {
        description: 'Tente novamente em instantes.',
      })
    },
  })

  const anexarLaudo = useMutation({
    mutationFn: ({ url, nome }: { url: string; nome: string }) =>
      ordensStore.atualizar(tenantAtivo.id, id, { laudo_url: url, laudo_nome: nome }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ordens-servico', tenantAtivo.id] })
      toast.success('Laudo anexado')
    },
  })

  if (osQuery.isPending) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <span className="sr-only">Carregando ordem de serviço</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (osQuery.isError || !osQuery.data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold text-brand-dark">Ordem não encontrada</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Esta OS não existe em {tenantAtivo.nome_fantasia}.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/app/ordens-servico/kanban">Voltar para o Kanban</Link>
        </Button>
      </div>
    )
  }

  const os = osQuery.data
  const cliente = clientesQuery.data?.find((item) => item.id === os.cliente_id)
  const cor = coresQuery.data?.find((item) => item.id === os.cor_id)
  const romaneio = recebimentosQuery.data?.find(
    (item) => item.id === os.romaneio_recebimento_id,
  )

  const area = areaTotal(os.itens)
  const consumo = cor ? consumoEstimadoKg(os.itens, cor.rendimento_teorico_g_m2) : null
  const emRetrabalho = os.status === 'retrabalho'
  const urlPublica = `${window.location.origin}/os/${os.id}`

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link to="/app/ordens-servico/kanban">
          <ArrowLeft aria-hidden />
          Ordens de serviço
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-sm text-brand-medium">
            OS #{String(os.numero).padStart(4, '0')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-brand-dark lg:text-3xl">
            {cliente?.razao_social ?? 'Cliente removido'}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <BadgeStatusOs status={os.status} />
            <BadgeUrgencia urgencia={os.urgencia} />
            {estaAtrasada(os) && <BadgeAtraso dias={Math.abs(diasParaEntrega(os))} />}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={os.status}
            onValueChange={(valor) => mover.mutate(valor as StatusOs)}
            disabled={mover.isPending}
          >
            <SelectTrigger className="w-56" aria-label="Mudar etapa da ordem">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OS.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_OS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {emRetrabalho ? (
            <Button
              onClick={() => mover.mutate(STATUS_APOS_RETRABALHO)}
              disabled={mover.isPending}
            >
              {mover.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <PackageCheck aria-hidden />
              )}
              Voltar para a cabine
            </Button>
          ) : (
            os.status !== 'finalizado' && (
              <Button
                variant="outline"
                onClick={() => mover.mutate('retrabalho')}
                disabled={mover.isPending}
                className="border-status-danger/40 text-status-danger-strong hover:bg-status-danger-soft"
              >
                <RotateCcw aria-hidden />
                Retrabalho
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Especificação de produção</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Dado
              rotulo="Cor"
              valor={cor ? `${cor.codigo_ral} — ${cor.nome_comercial}` : '—'}
            />
            <Dado
              rotulo="Espessura exigida"
              valor={`${os.espessura_min_micron} a ${os.espessura_max_micron} µm`}
              mono
            />
            <Dado
              rotulo="Pré-tratamento"
              valor={PRETRATAMENTO_LABEL[os.tipo_pretratamento]}
            />
            <Dado
              rotulo="Romaneio de entrada"
              valor={romaneio ? `#${String(romaneio.numero).padStart(4, '0')}` : '—'}
              mono
              link={
                romaneio ? `/app/recebimento/recebimentos/${romaneio.id}` : undefined
              }
            />
            <Dado rotulo="Entrada" valor={formatDate(os.data_entrada)} mono />
            <Dado
              rotulo="Previsão de entrega"
              valor={formatDate(os.previsao_entrega)}
              mono
            />

            {os.observacao && (
              <Dado
                rotulo="Observações"
                valor={os.observacao}
                className="sm:col-span-2"
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Consumo estimado de pó</CardTitle>
            </CardHeader>

            <CardContent>
              <p className="font-heading text-3xl font-bold text-brand-dark">
                {consumo !== null ? `${consumo.toFixed(2)} kg` : '—'}
              </p>

              <p className="mt-2 text-xs text-muted-foreground">
                {area.toLocaleString('pt-BR')} m² ×{' '}
                {cor?.rendimento_teorico_g_m2 ?? '—'} g/m² da ficha técnica.
                Estimativa de planejamento — o consumo real é apontado na Fase 4.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rastreabilidade</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cole no lote de peças. Aponta para a consulta pública desta OS.
              </p>
            </CardHeader>

            <CardContent className="flex flex-col items-center gap-3">
              <div className="rounded-card border border-border bg-white p-3">
                <QRCodeSVG value={urlPublica} size={148} level="M" />
              </div>

              <a
                href={`/os/${os.id}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs break-all text-brand-medium hover:underline"
              >
                /os/{os.id.slice(0, 8)}…
              </a>
            </CardContent>
          </Card>
        </div>
      </div>

      <h2 className="mt-8 mb-4 text-lg font-bold text-brand-dark">
        Itens da ordem ({os.itens.length})
      </h2>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="text-right">Área total</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {os.itens.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-brand-dark">
                  {item.descricao}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-brand-text">
                  {item.quantidade.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-brand-text">
                  {item.area_m2.toLocaleString('pt-BR')} m²
                </TableCell>
              </TableRow>
            ))}

            <TableRow>
              <TableCell className="font-semibold text-brand-dark">Total</TableCell>
              <TableCell />
              <TableCell className="text-right font-mono text-sm font-semibold text-brand-dark">
                {area.toLocaleString('pt-BR')} m²
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <div className="mt-8 grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Laudo de qualidade</CardTitle>
            <p className="text-sm text-muted-foreground">
              Anexo do relatório de inspeção. Os registros de medição entram na Fase 4.
            </p>
          </CardHeader>

          <CardContent>
            <AnexoLaudo
              nome={os.laudo_nome}
              url={os.laudo_url}
              salvando={anexarLaudo.isPending}
              aoAnexar={(url, nome) => anexarLaudo.mutate({ url, nome })}
              aoRemover={() => anexarLaudo.mutate({ url: '', nome: '' })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de etapas</CardTitle>
            <p className="text-sm text-muted-foreground">
              Toda transição registra quem moveu e quando.
            </p>
          </CardHeader>

          <CardContent>
            <LinhaDoTempo registros={os.historico} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function AnexoLaudo({
  nome,
  url,
  salvando,
  aoAnexar,
  aoRemover,
}: {
  nome: string
  url: string | null
  salvando: boolean
  aoAnexar: (url: string, nome: string) => void
  aoRemover: () => void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  function selecionar(arquivo: File | undefined) {
    if (!arquivo) return

    // 8 MB: laudo é PDF ou foto do relatório, não um scan de 300 dpi de 40 páginas.
    if (arquivo.size > 8 * 1024 * 1024) {
      setErro('Arquivo muito grande. O limite é 8 MB.')
      return
    }

    setErro(null)

    const leitor = new FileReader()
    leitor.onload = () => aoAnexar(String(leitor.result), arquivo.name)
    leitor.onerror = () => setErro('Não foi possível ler o arquivo.')
    leitor.readAsDataURL(arquivo)
  }

  if (url) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-background p-3">
        <a
          href={url}
          download={nome}
          className="min-w-0 flex-1 truncate text-sm font-medium text-brand-medium hover:underline"
        >
          {nome}
        </a>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={aoRemover}
          disabled={salvando}
          aria-label="Remover laudo"
          className="text-muted-foreground hover:bg-status-danger-soft hover:text-status-danger-strong"
        >
          <X />
        </Button>
      </div>
    )
  }

  return (
    <div>
      <Button
        variant="outline"
        size="lg"
        onClick={() => entrada.current?.click()}
        disabled={salvando}
      >
        {salvando ? <Loader2 className="animate-spin" aria-hidden /> : <FileUp aria-hidden />}
        Anexar laudo
      </Button>

      <input
        ref={entrada}
        type="file"
        accept="application/pdf,image/*"
        className="sr-only"
        aria-label="Selecionar arquivo do laudo"
        onChange={(evento) => selecionar(evento.target.files?.[0])}
      />

      {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}
    </div>
  )
}

function Dado({
  rotulo,
  valor,
  mono = false,
  link,
  className,
}: {
  rotulo: string
  valor: string
  mono?: boolean
  link?: string
  className?: string
}) {
  const classeValor = mono ? 'mt-1 font-mono text-brand-dark' : 'mt-1 text-brand-dark'

  return (
    <div className={className}>
      <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
        {rotulo}
      </p>

      {link ? (
        <Link to={link} className={`${classeValor} block hover:underline`}>
          {valor}
        </Link>
      ) : (
        <p className={classeValor}>{valor}</p>
      )}
    </div>
  )
}

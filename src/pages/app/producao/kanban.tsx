import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from 'cn'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { CartaoOs } from '@/features/producao/components/cartao-os'
import { useTenant } from '@/features/tenant/tenant-context'
import { clientesStore, coresStore } from '@/services/cadastros-service'
import { moverStatus, ordensStore } from '@/services/producao-service'
import {
  FLUXO_PRODUCAO,
  STATUS_APOS_RETRABALHO,
  STATUS_OS_DESCRICAO,
  STATUS_OS_LABEL,
  type OrdemServico,
  type StatusOs,
} from '@/types/producao'

/** Retrabalho vive fora da linha, como desvio — por isso vem depois do fluxo. */
const COLUNAS: StatusOs[] = [...FLUXO_PRODUCAO, 'retrabalho']

/**
 * Cor de topo de cada coluna.
 *
 * É uma rampa que caminha do navy ao turquesa acompanhando o avanço na linha —
 * a cor indica POSIÇÃO no fluxo, não identidade. Retrabalho sai da rampa em
 * vermelho porque é desvio, não etapa.
 */
const ACENTO_COLUNA: Record<StatusOs, string> = {
  recebido: '#64748b',
  pre_tratamento: '#0d2b5e',
  aplicacao_po: '#1a6b8a',
  cura: '#0e86b0',
  controle_qualidade: '#0aa3bd',
  embalagem: '#00b8c4',
  aguardando_retirada: '#00c2cb',
  finalizado: '#16a34a',
  retrabalho: '#dc2626',
}

/** Primeiros itens da OS, para o card mostrar o que é sem abrir a ordem. */
function resumoItens(os: OrdemServico): string {
  const descricoes = os.itens.map((item) => item.descricao)

  if (descricoes.length === 0) return 'Sem itens'
  if (descricoes.length === 1) return descricoes[0]

  return `${descricoes[0]} +${descricoes.length - 1}`
}

export function KanbanPage() {
  const { tenantAtivo } = useTenant()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [arrastando, setArrastando] = useState<OrdemServico | null>(null)

  const queryKey = ['ordens-servico', tenantAtivo.id]

  const ordensQuery = useQuery({
    queryKey,
    queryFn: () => ordensStore.listar(tenantAtivo.id),
  })

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const coresQuery = useQuery({
    queryKey: ['cores', tenantAtivo.id],
    queryFn: () => coresStore.listar(tenantAtivo.id),
  })

  const nomeCliente = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const cliente of clientesQuery.data ?? []) {
      mapa.set(cliente.id, cliente.razao_social)
    }
    return mapa
  }, [clientesQuery.data])

  const nomeCor = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const cor of coresQuery.data ?? []) {
      mapa.set(cor.id, `${cor.codigo_ral} ${cor.nome_comercial}`)
    }
    return mapa
  }, [coresQuery.data])

  const porColuna = useMemo(() => {
    const mapa = new Map<StatusOs, OrdemServico[]>()

    for (const status of COLUNAS) mapa.set(status, [])

    for (const os of ordensQuery.data ?? []) {
      mapa.get(os.status)?.push(os)
    }

    return mapa
  }, [ordensQuery.data])

  const mover = useMutation({
    mutationFn: ({ os, status }: { os: OrdemServico; status: StatusOs }) =>
      moverStatus({
        tenantId: tenantAtivo.id,
        osId: os.id,
        novoStatus: status,
        responsavelId: user?.id ?? '',
        responsavelNome: user?.nome ?? '',
      }),
    // Otimista: no chão de fábrica o card tem que sair da coluna na hora, mesmo
    // com a rede ruim do galpão. Se falhar, volta para onde estava.
    onMutate: async ({ os, status }) => {
      await queryClient.cancelQueries({ queryKey })

      const anterior = queryClient.getQueryData<OrdemServico[]>(queryKey)

      queryClient.setQueryData<OrdemServico[]>(queryKey, (atual) =>
        (atual ?? []).map((item) => (item.id === os.id ? { ...item, status } : item)),
      )

      return { anterior }
    },
    onError: (_erro, _variaveis, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(queryKey, contexto.anterior)

      toast.error('Não foi possível mover a ordem', {
        description: 'A etapa foi restaurada. Tente novamente.',
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  // Distância/atraso de ativação: sem isso, rolar a lista no tablet arrastaria
  // um card sem querer.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  function aoIniciar(evento: DragStartEvent) {
    const os = (ordensQuery.data ?? []).find((item) => item.id === evento.active.id)

    setArrastando(os ?? null)
  }

  function aoSoltar(evento: DragEndEvent) {
    setArrastando(null)

    const { active, over } = evento

    if (!over) return

    const os = (ordensQuery.data ?? []).find((item) => item.id === active.id)
    const destino = over.id as StatusOs

    if (!os || os.status === destino) return

    // Sair do retrabalho sempre leva de volta à cabine: repintar exige reaplicar
    // o pó, então soltar o card em "cura" ou "embalagem" seria pular etapa.
    const statusFinal =
      os.status === 'retrabalho' && destino !== 'retrabalho'
        ? STATUS_APOS_RETRABALHO
        : destino

    mover.mutate({ os, status: statusFinal })

    if (statusFinal !== destino) {
      toast.info('Retrabalho volta para a cabine', {
        description: `A OS #${String(os.numero).padStart(4, '0')} foi para ${STATUS_OS_LABEL[statusFinal]}.`,
      })
    }
  }

  if (ordensQuery.isPending) {
    return (
      <div className="flex gap-4 overflow-hidden" role="status" aria-live="polite">
        <span className="sr-only">Carregando ordens de serviço</span>
        {[0, 1, 2, 3].map((coluna) => (
          <Skeleton key={coluna} className="h-96 w-72 shrink-0" />
        ))}
      </div>
    )
  }

  const total = ordensQuery.data?.length ?? 0

  return (
    <>
      <PageHeader
        sobretitulo="Chão de fábrica"
        titulo="Produção em movimento."
        descricao="Prioridades, prazos e etapas visíveis para toda a equipe — com histórico a cada avanço."
        acoes={
          <Button asChild size="lg">
            <Link to="/app/ordens-servico/nova">
              <Plus aria-hidden />
              Nova ordem de serviço
            </Link>
          </Button>
        }
      />

      {total === 0 ? (
        <div className="rounded-card border border-border bg-card py-14 text-center">
          <h2 className="text-base font-semibold text-brand-dark">
            Nenhuma ordem de serviço
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">
            A OS nasce de um romaneio de recebimento. Registre a entrada da
            mercadoria e abra a ordem a partir dela.
          </p>
          <Button asChild className="mt-6">
            <Link to="/app/recebimento/recebimentos">Ver recebimentos</Link>
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensores}
          collisionDetection={closestCorners}
          onDragStart={aoIniciar}
          onDragEnd={aoSoltar}
          onDragCancel={() => setArrastando(null)}
        >
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
            {COLUNAS.map((status) => (
              <Coluna
                key={status}
                status={status}
                ordens={porColuna.get(status) ?? []}
                nomeCliente={nomeCliente}
                nomeCor={nomeCor}
              />
            ))}
          </div>

          <DragOverlay>
            {arrastando && (
              <div className="w-64">
                <CartaoOs
                  os={arrastando}
                  clienteNome={nomeCliente.get(arrastando.cliente_id) ?? ''}
                  corNome={nomeCor.get(arrastando.cor_id) ?? ''}
                  itensResumo={resumoItens(arrastando)}
                  arrastando
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </>
  )
}

function Coluna({
  status,
  ordens,
  nomeCliente,
  nomeCor,
}: {
  status: StatusOs
  ordens: OrdemServico[]
  nomeCliente: Map<string, string>
  nomeCor: Map<string, string>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const indice = COLUNAS.indexOf(status) + 1
  const acento = ACENTO_COLUNA[status]

  return (
    <section
      className="flex w-72 shrink-0 flex-col"
      aria-label={`${STATUS_OS_LABEL[status]}: ${ordens.length} ordem(ns)`}
    >
      <header
        className="mb-2 rounded-card border-t-[3px] border-r border-b border-l border-border bg-card px-3 py-2.5 shadow-card"
        style={{ borderTopColor: acento }}
      >
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: acento }}
            aria-hidden
          />

          <span className="font-mono text-[0.65rem] text-muted-foreground">
            {String(indice).padStart(2, '0')}
          </span>

          <h2 className="flex-1 truncate text-sm font-semibold text-brand-dark">
            {STATUS_OS_LABEL[status]}
          </h2>

          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-brand-muted">
            {ordens.length}
          </span>
        </div>

        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {STATUS_OS_DESCRICAO[status]}
        </p>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-72 flex-1 flex-col gap-3 rounded-card p-2 transition-colors',
          isOver ? 'bg-accent ring-2 ring-brand-medium' : 'bg-muted/50',
        )}
      >
        {ordens.map((os) => (
          <CartaoOs
            key={os.id}
            os={os}
            clienteNome={nomeCliente.get(os.cliente_id) ?? 'Cliente removido'}
            corNome={nomeCor.get(os.cor_id) ?? 'Cor removida'}
            itensResumo={resumoItens(os)}
          />
        ))}

        {ordens.length === 0 && (
          <p className="rounded-card border border-dashed border-border px-2 py-8 text-center text-xs text-muted-foreground">
            Solte uma OS aqui
          </p>
        )}
      </div>
    </section>
  )
}

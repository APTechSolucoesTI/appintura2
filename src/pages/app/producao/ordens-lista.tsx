import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ListaRegistros } from '@/components/data/lista-registros'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BadgeAtraso,
  BadgeStatusOs,
  BadgeUrgencia,
} from '@/features/producao/components/badges-producao'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDate } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import { clientesStore, coresStore } from '@/services/cadastros-service'
import { ordensStore } from '@/services/producao-service'
import {
  areaTotal,
  diasParaEntrega,
  estaAtrasada,
  STATUS_OS,
  STATUS_OS_LABEL,
  URGENCIA_LABEL,
  URGENCIAS,
} from '@/types/producao'

type FiltroStatus = 'todos' | 'em_producao' | (typeof STATUS_OS)[number]
type FiltroUrgencia = 'todas' | (typeof URGENCIAS)[number]

export function OrdensListaPage() {
  const { tenantAtivo } = useTenant()
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<FiltroStatus>('todos')
  const [urgencia, setUrgencia] = useState<FiltroUrgencia>('todas')

  const ordensQuery = useQuery({
    queryKey: ['ordens-servico', tenantAtivo.id],
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

  const registros = useMemo(() => ordensQuery.data ?? [], [ordensQuery.data])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca)

    return registros.filter((os) => {
      if (status === 'em_producao') {
        // "Em produção" = tudo que ainda dá trabalho: exclui o que já saiu.
        if (os.status === 'finalizado') return false
      } else if (status !== 'todos' && os.status !== status) {
        return false
      }

      if (urgencia !== 'todas' && os.urgencia !== urgencia) return false

      if (!termo) return true

      return (
        String(os.numero).includes(termo) ||
        normalizar(nomeCliente.get(os.cliente_id) ?? '').includes(termo) ||
        normalizar(nomeCor.get(os.cor_id) ?? '').includes(termo) ||
        os.itens.some((item) => normalizar(item.descricao).includes(termo))
      )
    })
  }, [registros, busca, status, urgencia, nomeCliente, nomeCor])

  return (
    <>
      <PageHeader
        sobretitulo="Chão de fábrica"
        titulo="Ordens de serviço"
        descricao="Todas as OS em tabela, com filtro por etapa e urgência."
        acoes={
          <Button asChild size="lg">
            <Link to="/app/ordens-servico/nova">
              <Plus aria-hidden />
              Nova OS
            </Link>
          </Button>
        }
      />

      <ListaRegistros
        busca={busca}
        aoBuscar={setBusca}
        placeholderBusca="Buscar por número, cliente, cor ou item"
        filtros={
          <>
            <Select
              value={status}
              onValueChange={(valor) => setStatus(valor as FiltroStatus)}
            >
              <SelectTrigger className="w-52" aria-label="Filtrar por etapa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as etapas</SelectItem>
                <SelectItem value="em_producao">Em produção (não finalizadas)</SelectItem>
                {STATUS_OS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {STATUS_OS_LABEL[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={urgencia}
              onValueChange={(valor) => setUrgencia(valor as FiltroUrgencia)}
            >
              <SelectTrigger className="w-40" aria-label="Filtrar por urgência">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Toda urgência</SelectItem>
                {URGENCIAS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {URGENCIA_LABEL[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        carregando={ordensQuery.isPending}
        erro={ordensQuery.isError}
        aoTentarNovamente={() => void ordensQuery.refetch()}
        totalRegistros={registros.length}
        totalFiltrado={visiveis.length}
        vazioTitulo="Nenhuma ordem de serviço"
        vazioDescricao="A OS nasce de um romaneio de recebimento — registre a entrada da mercadoria e abra a ordem a partir dela."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">OS</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden lg:table-cell">Cor</TableHead>
              <TableHead className="hidden text-right md:table-cell">Área</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead className="w-16 text-right">Abrir</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.map((os) => (
              <TableRow key={os.id}>
                <TableCell className="font-mono text-sm font-semibold text-brand-medium">
                  #{String(os.numero).padStart(4, '0')}
                </TableCell>

                <TableCell>
                  <Link
                    to={`/app/ordens-servico/${os.id}`}
                    className="font-medium text-brand-dark hover:underline"
                  >
                    {nomeCliente.get(os.cliente_id) ?? 'Cliente removido'}
                  </Link>
                  <span className="mt-1 block">
                    <BadgeUrgencia urgencia={os.urgencia} />
                  </span>
                </TableCell>

                <TableCell className="hidden font-mono text-xs text-brand-muted lg:table-cell">
                  {nomeCor.get(os.cor_id) ?? '—'}
                </TableCell>

                <TableCell className="hidden text-right font-mono text-sm text-brand-text md:table-cell">
                  {areaTotal(os.itens).toLocaleString('pt-BR')} m²
                </TableCell>

                <TableCell>
                  <BadgeStatusOs status={os.status} />
                </TableCell>

                <TableCell>
                  {estaAtrasada(os) ? (
                    <BadgeAtraso dias={Math.abs(diasParaEntrega(os))} />
                  ) : (
                    <span className="font-mono text-xs text-brand-muted">
                      {formatDate(os.previsao_entrega)}
                    </span>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Abrir ordem ${os.numero}`}
                  >
                    <Link to={`/app/ordens-servico/${os.id}`}>
                      <ChevronRight />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ListaRegistros>
    </>
  )
}

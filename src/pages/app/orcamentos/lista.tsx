import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ListaRegistros } from '@/components/data/lista-registros'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
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
import { useTenant } from '@/features/tenant/tenant-context'
import { formatCurrency, formatDate } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import { clientesStore } from '@/services/cadastros-service'
import { orcamentosStore } from '@/services/orcamento-service'
import {
  STATUS_ORCAMENTO,
  STATUS_ORCAMENTO_LABEL,
  STATUS_ORCAMENTO_TOM,
  type StatusOrcamento,
} from '@/types/orcamento'

const TOM_CLASSE: Record<string, string> = {
  success: 'bg-status-success-soft text-status-success-strong',
  warning: 'bg-status-warning-soft text-status-warning-strong',
  danger: 'bg-status-danger-soft text-status-danger-strong',
  neutral: 'bg-status-neutral-soft text-status-neutral-strong',
}

export function BadgeStatusOrcamento({ status }: { status: StatusOrcamento }) {
  return (
    <Badge variant="outline" className={TOM_CLASSE[STATUS_ORCAMENTO_TOM[status]]}>
      {STATUS_ORCAMENTO_LABEL[status]}
    </Badge>
  )
}

export function OrcamentosPage() {
  const { tenantAtivo } = useTenant()
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusOrcamento | 'todos'>('todos')

  const orcamentosQuery = useQuery({
    queryKey: ['orcamentos', tenantAtivo.id],
    queryFn: () => orcamentosStore.listar(tenantAtivo.id),
  })

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const registros = useMemo(() => orcamentosQuery.data ?? [], [orcamentosQuery.data])

  const nomePorCliente = useMemo(() => {
    const mapa = new Map<string, string>()

    for (const cliente of clientesQuery.data ?? []) {
      mapa.set(cliente.id, cliente.razao_social)
    }

    return mapa
  }, [clientesQuery.data])

  const filtrados = useMemo(() => {
    const termo = normalizar(busca)

    return registros.filter((orcamento) => {
      if (statusFiltro !== 'todos' && orcamento.status !== statusFiltro) return false
      if (!termo) return true

      return (
        String(orcamento.numero).includes(termo) ||
        normalizar(nomePorCliente.get(orcamento.cliente_id) ?? '').includes(termo) ||
        orcamento.itens.some((item) => normalizar(item.descricao).includes(termo))
      )
    })
  }, [registros, busca, statusFiltro, nomePorCliente])

  return (
    <>
      <PageHeader
        sobretitulo="Comercial"
        titulo="Orçamentos"
        descricao="A proposta que o cliente aprova por link, sem precisar de conta. Aprovado, vira ordem de serviço sozinho."
      />

      <ListaRegistros
        busca={busca}
        aoBuscar={setBusca}
        placeholderBusca="Buscar por número, cliente ou item"
        filtros={
          <Select
            value={statusFiltro}
            onValueChange={(valor) => setStatusFiltro(valor as StatusOrcamento | 'todos')}
          >
            <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por situação">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="todos">Todas as situações</SelectItem>
              {STATUS_ORCAMENTO.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_ORCAMENTO_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        acao={
          <Button asChild size="lg">
            <Link to="/app/orcamentos/novo">
              <Plus aria-hidden />
              Novo orçamento
            </Link>
          </Button>
        }
        carregando={orcamentosQuery.isPending || clientesQuery.isPending}
        erro={orcamentosQuery.isError}
        aoTentarNovamente={() => void orcamentosQuery.refetch()}
        totalRegistros={registros.length}
        totalFiltrado={filtrados.length}
        vazioTitulo="Nenhum orçamento ainda"
        vazioDescricao="O orçamento é o começo do funil: o cliente aprova pelo link, e a ordem de serviço nasce já com o que foi acordado — sem redigitar nada."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Validade</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Valor</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-16 text-right">Abrir</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtrados.map((orcamento) => {
              const vencido =
                orcamento.data_validade < new Date().toISOString().slice(0, 10)

              return (
                <TableRow key={orcamento.id}>
                  <TableCell className="font-mono text-sm">{orcamento.numero}</TableCell>

                  <TableCell className="font-medium">
                    {nomePorCliente.get(orcamento.cliente_id) ?? 'Cliente removido'}
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    <span
                      className={
                        vencido && orcamento.status !== 'convertido'
                          ? 'text-status-danger-strong'
                          : undefined
                      }
                    >
                      {formatDate(orcamento.data_validade)}
                    </span>
                  </TableCell>

                  <TableCell className="hidden sm:table-cell text-right font-mono text-sm">
                    {formatCurrency(orcamento.valor_total)}
                  </TableCell>

                  <TableCell>
                    <BadgeStatusOrcamento status={orcamento.status} />
                  </TableCell>

                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon">
                      <Link
                        to={`/app/orcamentos/${orcamento.id}`}
                        aria-label={`Abrir orçamento ${orcamento.numero}`}
                      >
                        <ChevronRight aria-hidden />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ListaRegistros>
    </>
  )
}

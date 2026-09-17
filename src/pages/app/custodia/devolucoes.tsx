import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ListaRegistros } from '@/components/data/lista-registros'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BadgeStatusDevolucao } from '@/features/custodia/components/badges-custodia'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDateTime } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import { clientesStore } from '@/services/cadastros-service'
import { devolucoesStore } from '@/services/custodia-service'

export function DevolucoesPage() {
  const { tenantAtivo } = useTenant()
  const [busca, setBusca] = useState('')

  const devolucoesQuery = useQuery({
    queryKey: ['devolucoes', tenantAtivo.id],
    queryFn: () => devolucoesStore.listar(tenantAtivo.id),
  })

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const registros = useMemo(() => devolucoesQuery.data ?? [], [devolucoesQuery.data])

  const nomePorCliente = useMemo(() => {
    const mapa = new Map<string, string>()

    for (const cliente of clientesQuery.data ?? []) {
      mapa.set(cliente.id, cliente.razao_social)
    }

    return mapa
  }, [clientesQuery.data])

  const filtrados = useMemo(() => {
    const termo = normalizar(busca)

    if (!termo) return registros

    return registros.filter(
      (romaneio) =>
        String(romaneio.numero).includes(termo) ||
        normalizar(nomePorCliente.get(romaneio.cliente_id) ?? '').includes(termo) ||
        normalizar(romaneio.retirado_por_nome).includes(termo) ||
        normalizar(romaneio.placa).includes(termo),
    )
  }, [registros, busca, nomePorCliente])

  return (
    <>
      <PageHeader
        sobretitulo="Saída de mercadoria"
        titulo="Devoluções"
        descricao="Saída de mercadoria do pátio, com comparativo contra o que entrou e assinatura de quem retirou."
      />

      <ListaRegistros
        busca={busca}
        aoBuscar={setBusca}
        placeholderBusca="Buscar por número, cliente, quem retirou ou placa"
        acao={
          <Button asChild size="lg">
            <Link to="/app/recebimento/devolucoes/nova">
              <Plus aria-hidden />
              Nova devolução
            </Link>
          </Button>
        }
        carregando={devolucoesQuery.isPending || clientesQuery.isPending}
        erro={devolucoesQuery.isError}
        aoTentarNovamente={() => void devolucoesQuery.refetch()}
        totalRegistros={registros.length}
        totalFiltrado={filtrados.length}
        vazioTitulo="Nenhuma devolução registrada"
        vazioDescricao="Quando a mercadoria sair do pátio, gere o romaneio de devolução — é ele que zera o saldo de custódia e prova a entrega."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Saída</TableHead>
              <TableHead className="hidden sm:table-cell">Retirado por</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-16 text-right">Abrir</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtrados.map((romaneio) => (
              <TableRow key={romaneio.id}>
                <TableCell className="font-mono text-sm font-semibold text-brand-medium">
                  #{String(romaneio.numero).padStart(4, '0')}
                </TableCell>

                <TableCell>
                  <Link
                    to={`/app/recebimento/devolucoes/${romaneio.id}`}
                    className="font-medium text-brand-dark hover:underline"
                  >
                    {nomePorCliente.get(romaneio.cliente_id) ?? 'Cliente removido'}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {romaneio.itens.length} item(ns)
                  </span>
                </TableCell>

                <TableCell className="hidden font-mono text-xs text-brand-muted md:table-cell">
                  {formatDateTime(romaneio.data_hora)}
                </TableCell>

                <TableCell className="hidden text-sm sm:table-cell">
                  <span className="block text-brand-text">
                    {romaneio.retirado_por_nome}
                  </span>
                  {romaneio.placa && (
                    <span className="block font-mono text-xs text-muted-foreground">
                      placa {romaneio.placa}
                    </span>
                  )}
                </TableCell>

                <TableCell>
                  <BadgeStatusDevolucao status={romaneio.status} />
                </TableCell>

                <TableCell className="text-right">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Abrir devolução ${romaneio.numero}`}
                  >
                    <Link to={`/app/recebimento/devolucoes/${romaneio.id}`}>
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

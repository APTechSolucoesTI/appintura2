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
import { BadgeStatusRecebimento } from '@/features/custodia/components/badges-custodia'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDateTime } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import { clientesStore } from '@/services/cadastros-service'
import { recebimentosStore } from '@/services/custodia-service'

export function RecebimentosPage() {
  const { tenantAtivo } = useTenant()
  const [busca, setBusca] = useState('')

  const recebimentosQuery = useQuery({
    queryKey: ['recebimentos', tenantAtivo.id],
    queryFn: () => recebimentosStore.listar(tenantAtivo.id),
  })

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const registros = useMemo(() => recebimentosQuery.data ?? [], [recebimentosQuery.data])

  const nomePorCliente = useMemo(() => {
    const mapa = new Map<string, string>()

    for (const cliente of clientesQuery.data ?? []) {
      mapa.set(cliente.id, cliente.razao_social)
    }

    return mapa
  }, [clientesQuery.data])

  const nomeCliente = (clienteId: string) =>
    nomePorCliente.get(clienteId) ?? 'Cliente removido'

  const filtrados = useMemo(() => {
    const termo = normalizar(busca)

    if (!termo) return registros

    return registros.filter(
      (romaneio) =>
        String(romaneio.numero).includes(termo) ||
        normalizar(nomePorCliente.get(romaneio.cliente_id) ?? '').includes(termo) ||
        normalizar(romaneio.documento_numero).includes(termo) ||
        romaneio.itens.some((item) => normalizar(item.descricao).includes(termo)),
    )
  }, [registros, busca, nomePorCliente])

  return (
    <>
      <PageHeader
        sobretitulo="Entrada de mercadoria"
        titulo="Recebimentos"
        descricao="Entrada de mercadoria do cliente no pátio, com foto por item e assinatura de quem entregou."
      />

      <ListaRegistros
        busca={busca}
        aoBuscar={setBusca}
        placeholderBusca="Buscar por número, cliente, nota ou item"
        acao={
          <Button asChild size="lg">
            <Link to="/app/recebimento/recebimentos/novo">
              <Plus aria-hidden />
              Novo recebimento
            </Link>
          </Button>
        }
        carregando={recebimentosQuery.isPending || clientesQuery.isPending}
        erro={recebimentosQuery.isError}
        aoTentarNovamente={() => void recebimentosQuery.refetch()}
        totalRegistros={registros.length}
        totalFiltrado={filtrados.length}
        vazioTitulo="Nenhum recebimento registrado"
        vazioDescricao="Todo material que entra no pátio deve ter romaneio de recebimento — é ele que prova o que chegou, em que estado e quem entregou."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Entrada</TableHead>
              <TableHead className="hidden sm:table-cell">Itens</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-16 text-right">Abrir</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtrados.map((romaneio) => {
              const totalPecas = romaneio.itens.reduce(
                (soma, item) => soma + item.quantidade,
                0,
              )

              return (
                <TableRow key={romaneio.id}>
                  <TableCell className="font-mono text-sm font-semibold text-brand-medium">
                    #{String(romaneio.numero).padStart(4, '0')}
                  </TableCell>

                  <TableCell>
                    <Link
                      to={`/app/recebimento/recebimentos/${romaneio.id}`}
                      className="font-medium text-brand-dark hover:underline"
                    >
                      {nomeCliente(romaneio.cliente_id)}
                    </Link>
                    <span className="block font-mono text-xs text-muted-foreground">
                      nota {romaneio.documento_numero}/{romaneio.documento_serie}
                    </span>
                  </TableCell>

                  <TableCell className="hidden font-mono text-xs text-brand-muted md:table-cell">
                    {formatDateTime(romaneio.data_hora)}
                  </TableCell>

                  <TableCell className="hidden text-sm text-brand-muted sm:table-cell">
                    {romaneio.itens.length} item(ns)
                    <span className="block font-mono text-xs text-muted-foreground">
                      {totalPecas} unidade(s)
                    </span>
                  </TableCell>

                  <TableCell>
                    <BadgeStatusRecebimento status={romaneio.status} />
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Abrir romaneio ${romaneio.numero}`}
                    >
                      <Link to={`/app/recebimento/recebimentos/${romaneio.id}`}>
                        <ChevronRight />
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

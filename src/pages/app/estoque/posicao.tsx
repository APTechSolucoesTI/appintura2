import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Boxes, CircleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ListaRegistros } from '@/components/data/lista-registros'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { BadgeAlerta } from '@/features/cadastros/components/badge-alerta'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDate } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import { posicaoEstoque } from '@/services/estoque-service'
import { TIPO_ITEM_LABEL, TIPOS_ITEM, type TipoItem } from '@/types/estoque'

export function PosicaoEstoquePage() {
  const { tenantAtivo } = useTenant()
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState<'todos' | TipoItem>('todos')

  const posicaoQuery = useQuery({
    queryKey: ['estoque-posicao', tenantAtivo.id],
    queryFn: () => posicaoEstoque(tenantAtivo.id),
  })

  const itens = useMemo(() => posicaoQuery.data ?? [], [posicaoQuery.data])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca)

    return itens.filter((item) => {
      if (tipo !== 'todos' && item.tipo_item !== tipo) return false
      if (!termo) return true

      return (
        normalizar(item.descricao).includes(termo) ||
        normalizar(item.detalhe).includes(termo)
      )
    })
  }, [itens, busca, tipo])

  const alertas = itens.filter((item) => item.alerta !== null)
  const vencidos = alertas.filter((item) => item.alerta === 'vencido')

  return (
    <>
      <PageHeader
        sobretitulo="Insumos consumíveis"
        titulo="Estoque que acompanha a produção."
        descricao="Compras, consumo automático e perdas no mesmo extrato — sem misturar insumos com peças em custódia."
      />

      {alertas.length > 0 && (
        <Alert
          variant={vencidos.length > 0 ? 'destructive' : 'default'}
          className="mb-5"
        >
          {vencidos.length > 0 ? (
            <CircleAlert aria-hidden />
          ) : (
            <AlertTriangle aria-hidden />
          )}
          <AlertDescription>
            {alertas.length} item(ns) precisam de atenção
            {vencidos.length > 0 &&
              `, sendo ${vencidos.length} com lote vencido — não aplicar`}
            .
          </AlertDescription>
        </Alert>
      )}

      <ListaRegistros
        busca={busca}
        aoBuscar={setBusca}
        placeholderBusca="Buscar por cor, insumo ou fornecedor"
        filtros={
          <Select
            value={tipo}
            onValueChange={(valor) => setTipo(valor as 'todos' | TipoItem)}
          >
            <SelectTrigger className="w-48" aria-label="Filtrar por tipo de item">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Tintas e químicos</SelectItem>
              {TIPOS_ITEM.map((item) => (
                <SelectItem key={item} value={item}>
                  {TIPO_ITEM_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        acao={
          <Button asChild size="lg">
            <Link to="/app/estoque/movimentacoes">
              Movimentações
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
        carregando={posicaoQuery.isPending}
        erro={posicaoQuery.isError}
        aoTentarNovamente={() => void posicaoQuery.refetch()}
        totalRegistros={itens.length}
        totalFiltrado={visiveis.length}
        vazioTitulo="Nenhum insumo cadastrado"
        vazioDescricao="Cadastre cores e insumos químicos para acompanhar saldo, estoque mínimo e validade."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="hidden md:table-cell">Tipo</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Validade</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.map((item) => (
              <TableRow key={`${item.tipo_item}-${item.id}`}>
                <TableCell>
                  <span className="block font-medium text-brand-dark">
                    {item.descricao}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {item.detalhe}
                    {item.lote && ` · lote ${item.lote}`}
                  </span>
                </TableCell>

                <TableCell className="hidden text-sm text-brand-muted md:table-cell">
                  {TIPO_ITEM_LABEL[item.tipo_item]}
                </TableCell>

                <TableCell className="text-right font-mono text-sm">
                  <span className="text-brand-dark">
                    {item.estoque_atual.toLocaleString('pt-BR')} {item.unidade}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    mín. {item.estoque_minimo.toLocaleString('pt-BR')}
                  </span>
                </TableCell>

                <TableCell className="hidden text-right font-mono text-xs text-brand-muted sm:table-cell">
                  {formatDate(item.validade)}
                </TableCell>

                <TableCell>
                  <BadgeAlerta alerta={item.alerta} validade={item.validade} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ListaRegistros>

      <Card className="mt-5">
        <CardContent className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent">
            <Boxes className="size-5 text-brand-medium" aria-hidden />
          </span>

          <p className="text-sm text-brand-muted">
            A baixa de tinta é lançada sozinha quando a OS entra em{' '}
            <strong className="text-brand-dark">aplicação de pó</strong>, usando a área
            total da ordem e o rendimento da cor. Entradas de compra e perdas são
            registradas na aba de movimentações.
          </p>
        </CardContent>
      </Card>
    </>
  )
}

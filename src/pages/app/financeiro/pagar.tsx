import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowUpFromLine,
  Check,
  CircleAlert,
  Repeat,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { CartaoKpi } from '@/components/data/cartao-kpi'
import { ListaRegistros } from '@/components/data/lista-registros'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { BadgeStatusConta } from '@/features/financeiro/components/badge-status-conta'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatCurrency, formatDate, parseData } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import {
  baixarContaPagar,
  centrosCustoStore,
  contasPagarStore,
} from '@/services/financeiro-service'
import {
  CATEGORIA_PAGAR_LABEL,
  CATEGORIAS_PAGAR,
  diasEmAtraso,
  statusEfetivoPagar,
  type CategoriaPagar,
} from '@/types/financeiro'

/** Janela de "vence logo" — uma semana é o horizonte que dá para reagir. */
const DIAS_ALERTA_VENCIMENTO = 7

export function PagarPage() {
  const { tenantAtivo } = useTenant()
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<'todas' | CategoriaPagar>('todas')
  /** "Hoje" fixado na montagem: ler o relógio durante o render é impuro. */
  const [hoje] = useState(() => new Date())

  const contasQuery = useQuery({
    queryKey: ['contas-pagar', tenantAtivo.id],
    queryFn: () => contasPagarStore.listar(tenantAtivo.id),
  })

  const centrosQuery = useQuery({
    queryKey: ['centros-custo', tenantAtivo.id],
    queryFn: () => centrosCustoStore.listar(tenantAtivo.id),
  })

  const nomeCentro = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const centro of centrosQuery.data ?? []) mapa.set(centro.id, centro.nome)
    return mapa
  }, [centrosQuery.data])

  const registros = useMemo(() => contasQuery.data ?? [], [contasQuery.data])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca)

    return registros.filter((conta) => {
      if (categoria !== 'todas' && conta.categoria !== categoria) return false
      if (!termo) return true

      return (
        normalizar(conta.fornecedor).includes(termo) ||
        normalizar(conta.descricao).includes(termo)
      )
    })
  }, [registros, busca, categoria])

  const resumo = useMemo(() => {
    let aberto = 0
    let vencido = 0
    let venceLogo = 0

    const inicioDeHoje = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
    ).getTime()

    for (const conta of registros) {
      const status = statusEfetivoPagar(conta, hoje)

      if (status === 'pago' || status === 'cancelado') continue

      aberto += conta.valor

      if (status === 'vencido') {
        vencido += conta.valor
        continue
      }

      const dias = Math.round(
        (parseData(conta.vencimento).getTime() - inicioDeHoje) / 86_400_000,
      )

      if (dias <= DIAS_ALERTA_VENCIMENTO) venceLogo += conta.valor
    }

    return { aberto, vencido, venceLogo }
  }, [registros, hoje])

  const baixar = useMutation({
    mutationFn: (contaId: string) =>
      baixarContaPagar(tenantAtivo.id, contaId, new Date().toISOString().slice(0, 10)),
    onSuccess: async (conta) => {
      await queryClient.invalidateQueries({ queryKey: ['contas-pagar', tenantAtivo.id] })
      await queryClient.invalidateQueries({ queryKey: ['financeiro', tenantAtivo.id] })
      toast.success('Pagamento registrado', { description: conta.descricao })
    },
  })

  return (
    <>
      <PageHeader
        sobretitulo="Saídas"
        titulo="Contas a pagar"
        descricao="Fornecedores, despesas fixas e insumo direto. A categoria é o que separa custo de produção de despesa administrativa no DRE."
      />

      {(resumo.vencido > 0 || resumo.venceLogo > 0) && (
        <Alert variant={resumo.vencido > 0 ? 'destructive' : 'default'} className="mb-5">
          <AlertTriangle aria-hidden />
          <AlertDescription>
            {resumo.vencido > 0 && (
              <>
                {formatCurrency(resumo.vencido)} já vencido
                {resumo.venceLogo > 0 && ' · '}
              </>
            )}
            {resumo.venceLogo > 0 && (
              <>
                {formatCurrency(resumo.venceLogo)} vence nos próximos{' '}
                {DIAS_ALERTA_VENCIMENTO} dias
              </>
            )}
            .
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <CartaoKpi
          icon={ArrowUpFromLine}
          rotulo="Total em aberto"
          valor={formatCurrency(resumo.aberto)}
          detalhe="Compromissos ainda não quitados"
        />

        <CartaoKpi
          icon={CircleAlert}
          rotulo="Vencido"
          valor={formatCurrency(resumo.vencido)}
          detalhe="Passou da data e segue sem pagamento"
          tom={resumo.vencido > 0 ? 'critico' : 'positivo'}
        />
      </div>

      <ListaRegistros
        busca={busca}
        aoBuscar={setBusca}
        placeholderBusca="Buscar por fornecedor ou descrição"
        filtros={
          <Select
            value={categoria}
            onValueChange={(valor) => setCategoria(valor as 'todas' | CategoriaPagar)}
          >
            <SelectTrigger className="w-52" aria-label="Filtrar por categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {CATEGORIAS_PAGAR.map((item) => (
                <SelectItem key={item} value={item}>
                  {CATEGORIA_PAGAR_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        carregando={contasQuery.isPending}
        erro={contasQuery.isError}
        aoTentarNovamente={() => void contasQuery.refetch()}
        totalRegistros={registros.length}
        totalFiltrado={visiveis.length}
        vazioTitulo="Nenhuma conta a pagar"
        vazioDescricao="Registre compras de insumo e despesas fixas para o fluxo de caixa ter as duas pontas."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="hidden lg:table-cell">Centro de custo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Vencimento</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-16 text-right">Baixa</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.map((conta) => {
              const status = statusEfetivoPagar(conta, hoje)
              const atraso = diasEmAtraso(conta.vencimento, hoje)

              return (
                <TableRow key={conta.id}>
                  <TableCell>
                    <span className="flex items-center gap-1.5 font-medium text-brand-dark">
                      {conta.fornecedor}
                      {conta.recorrente && (
                        <Repeat
                          className="size-3.5 text-muted-foreground"
                          aria-label="Despesa recorrente"
                        />
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {conta.descricao} · {CATEGORIA_PAGAR_LABEL[conta.categoria]}
                    </span>
                  </TableCell>

                  <TableCell className="hidden text-sm text-brand-muted lg:table-cell">
                    {conta.centro_custo_id
                      ? (nomeCentro.get(conta.centro_custo_id) ?? '—')
                      : '—'}
                  </TableCell>

                  <TableCell className="text-right font-mono text-sm text-brand-dark">
                    {formatCurrency(conta.valor)}
                  </TableCell>

                  <TableCell className="text-right font-mono text-xs">
                    <span className="text-brand-muted">
                      {formatDate(conta.vencimento)}
                    </span>
                    {status === 'vencido' && (
                      <span className="block text-status-danger-strong">
                        {atraso}d de atraso
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <BadgeStatusConta status={status} />
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={status === 'pago' || baixar.isPending}
                      onClick={() => baixar.mutate(conta.id)}
                      aria-label={`Registrar pagamento de ${conta.descricao}`}
                    >
                      <Check />
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

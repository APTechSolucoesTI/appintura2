import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownToLine,
  CircleAlert,
  HandCoins,
  MessageSquarePlus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { CartaoKpi } from '@/components/data/cartao-kpi'
import { ListaRegistros } from '@/components/data/lista-registros'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Textarea } from '@/components/ui/textarea'
import { FormSheet } from '@/features/cadastros/components/form-sheet'
import { paraNumero } from '@/features/cadastros/validacao'
import { useAuth } from '@/features/auth/auth-context'
import { BadgeStatusConta } from '@/features/financeiro/components/badge-status-conta'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatCurrency, formatDate } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import { clientesStore } from '@/services/cadastros-service'
import { obterConfiguracoes } from '@/services/configuracoes-service'
import {
  contasReceberStore,
  FinanceiroError,
  registrarCobranca,
  registrarPagamento,
} from '@/services/financeiro-service'
import {
  CANAIS_COBRANCA,
  CANAL_COBRANCA_LABEL,
  calcularJurosMulta,
  diasEmAtraso,
  RESULTADO_COBRANCA_LABEL,
  RESULTADOS_COBRANCA,
  saldoAberto,
  STATUS_CONTA,
  STATUS_CONTA_LABEL,
  statusEfetivo,
  totalPago,
  type CanalCobranca,
  type ContaReceber,
  type ResultadoCobranca,
  type StatusConta,
} from '@/types/financeiro'

export function ReceberPage() {
  const { tenantAtivo } = useTenant()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | StatusConta>('todos')
  const [baixando, setBaixando] = useState<ContaReceber | null>(null)
  const [cobrando, setCobrando] = useState<ContaReceber | null>(null)

  const contasQuery = useQuery({
    queryKey: ['contas-receber', tenantAtivo.id],
    queryFn: () => contasReceberStore.listar(tenantAtivo.id),
  })

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const configQuery = useQuery({
    queryKey: ['configuracoes', tenantAtivo.id],
    queryFn: () => obterConfiguracoes(tenantAtivo.id),
  })

  const nomeCliente = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const cliente of clientesQuery.data ?? []) {
      mapa.set(cliente.id, cliente.razao_social)
    }
    return mapa
  }, [clientesQuery.data])

  const registros = useMemo(() => contasQuery.data ?? [], [contasQuery.data])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca)

    return registros.filter((conta) => {
      if (filtro !== 'todos' && statusEfetivo(conta) !== filtro) return false
      if (!termo) return true

      return (
        normalizar(conta.descricao).includes(termo) ||
        normalizar(nomeCliente.get(conta.cliente_id) ?? '').includes(termo) ||
        String(conta.os_numero ?? '').includes(termo)
      )
    })
  }, [registros, busca, filtro, nomeCliente])

  const totais = useMemo(() => {
    let aberto = 0
    let vencido = 0

    for (const conta of registros) {
      const status = statusEfetivo(conta)

      if (status === 'pago' || status === 'cancelado') continue

      aberto += saldoAberto(conta)
      if (status === 'vencido') vencido += saldoAberto(conta)
    }

    return { aberto, vencido }
  }, [registros])

  async function invalidar() {
    await queryClient.invalidateQueries({ queryKey: ['contas-receber', tenantAtivo.id] })
    await queryClient.invalidateQueries({ queryKey: ['financeiro', tenantAtivo.id] })
  }

  return (
    <>
      <PageHeader
        sobretitulo="Entradas"
        titulo="Contas a receber"
        descricao="Títulos emitidos, baixas e régua de cobrança. O status é calculado a partir dos pagamentos e do prazo — nunca digitado."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <CartaoKpi
          icon={ArrowDownToLine}
          rotulo="Em aberto"
          valor={formatCurrency(totais.aberto)}
          detalhe="Títulos ainda não baixados"
        />

        <CartaoKpi
          icon={CircleAlert}
          rotulo="Vencido"
          valor={formatCurrency(totais.vencido)}
          detalhe="Passou da data e segue sem pagamento"
          tom={totais.vencido > 0 ? 'critico' : 'positivo'}
        />
      </div>

      <ListaRegistros
        busca={busca}
        aoBuscar={setBusca}
        placeholderBusca="Buscar por cliente, descrição ou OS"
        filtros={
          <Select
            value={filtro}
            onValueChange={(valor) => setFiltro(valor as 'todos' | StatusConta)}
          >
            <SelectTrigger className="w-52" aria-label="Filtrar por situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as situações</SelectItem>
              {STATUS_CONTA.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === 'em_aberto'
                    ? 'Em aberto (no prazo)'
                    : STATUS_CONTA_LABEL[status]}
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
        vazioTitulo="Nenhum título emitido"
        vazioDescricao="Os títulos a receber nascem do faturamento das ordens de serviço."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden lg:table-cell">Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Vencimento</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-28 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.map((conta) => {
              const status = statusEfetivo(conta)
              const saldo = saldoAberto(conta)
              const atraso = diasEmAtraso(conta.vencimento)
              const encerrada = status === 'pago' || status === 'cancelado'

              return (
                <TableRow key={conta.id}>
                  <TableCell>
                    <span className="block font-medium text-brand-dark">
                      {nomeCliente.get(conta.cliente_id) ?? 'Cliente removido'}
                    </span>
                    {conta.os_numero && (
                      <Link
                        to={`/app/ordens-servico/${conta.os_id}`}
                        className="block font-mono text-xs text-brand-medium hover:underline"
                      >
                        OS #{String(conta.os_numero).padStart(4, '0')}
                      </Link>
                    )}
                  </TableCell>

                  <TableCell className="hidden text-sm text-brand-muted lg:table-cell">
                    {conta.descricao}
                    {conta.parcela && (
                      <span className="block font-mono text-xs text-muted-foreground">
                        parcela {conta.parcela}/{conta.total_parcelas}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-right font-mono text-sm">
                    <span className="text-brand-dark">{formatCurrency(conta.valor)}</span>
                    {totalPago(conta) > 0 && saldo > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        saldo {formatCurrency(saldo)}
                      </span>
                    )}
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
                    {conta.cobrancas.length > 0 && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {conta.cobrancas.length} contato(s)
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setCobrando(conta)}
                        disabled={encerrada}
                        aria-label={`Registrar cobrança de ${conta.descricao}`}
                      >
                        <MessageSquarePlus />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setBaixando(conta)}
                        disabled={encerrada}
                        aria-label={`Dar baixa em ${conta.descricao}`}
                      >
                        <HandCoins />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ListaRegistros>

      {baixando && configQuery.data && (
        <DialogoBaixa
          conta={baixando}
          multaPercentual={configQuery.data.multa_percentual}
          jurosMesPercentual={configQuery.data.juros_mes_percentual}
          aoFechar={() => setBaixando(null)}
          aoConcluir={async () => {
            await invalidar()
            setBaixando(null)
          }}
          tenantId={tenantAtivo.id}
        />
      )}

      {cobrando && (
        <DialogoCobranca
          conta={cobrando}
          tenantId={tenantAtivo.id}
          responsavel={{ id: user?.id ?? '', nome: user?.nome ?? '' }}
          aoFechar={() => setCobrando(null)}
          aoConcluir={async () => {
            await invalidar()
            setCobrando(null)
          }}
        />
      )}
    </>
  )
}

function DialogoBaixa({
  conta,
  multaPercentual,
  jurosMesPercentual,
  tenantId,
  aoFechar,
  aoConcluir,
}: {
  conta: ContaReceber
  multaPercentual: number
  jurosMesPercentual: number
  tenantId: string
  aoFechar: () => void
  aoConcluir: () => Promise<void>
}) {
  const saldo = saldoAberto(conta)
  const atraso = diasEmAtraso(conta.vencimento)
  const encargos = calcularJurosMulta(saldo, atraso, {
    multa_percentual: multaPercentual,
    juros_mes_percentual: jurosMesPercentual,
  })

  const [valor, setValor] = useState(saldo.toFixed(2).replace('.', ','))
  const [jurosMulta, setJurosMulta] = useState(
    encargos.total.toFixed(2).replace('.', ','),
  )
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))

  const salvar = useMutation({
    mutationFn: () =>
      registrarPagamento(tenantId, conta.id, {
        data_pagamento: data,
        valor_pago: paraNumero(valor),
        juros_multa: paraNumero(jurosMulta),
      }),
    onSuccess: async () => {
      toast.success('Baixa registrada', { description: conta.descricao })
      await aoConcluir()
    },
  })

  return (
    <FormSheet
      aberto
      aoFechar={aoFechar}
      titulo="Dar baixa"
      descricao={conta.descricao}
      salvando={salvar.isPending}
      aoSalvar={(evento) => {
        evento.preventDefault()
        salvar.mutate()
      }}
    >
      <div className="space-y-4">
        {salvar.isError && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>
              {salvar.error instanceof FinanceiroError
                ? salvar.error.message
                : 'Não foi possível registrar a baixa.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-card bg-muted p-3 text-sm">
          <p className="text-brand-text">
            Saldo em aberto:{' '}
            <strong className="font-mono text-brand-dark">
              {formatCurrency(saldo)}
            </strong>
          </p>

          {atraso > 0 && (
            <p className="mt-1 text-status-warning-strong">
              {atraso} dia(s) de atraso · multa {multaPercentual}% +{' '}
              {jurosMesPercentual}% ao mês ={' '}
              <strong className="font-mono">{formatCurrency(encargos.total)}</strong>
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="baixa-valor">Valor recebido (principal)</Label>
          <Input
            id="baixa-valor"
            inputMode="decimal"
            value={valor}
            onChange={(evento) => setValor(evento.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="baixa-encargos">Juros e multa recebidos</Label>
          <Input
            id="baixa-encargos"
            inputMode="decimal"
            value={jurosMulta}
            onChange={(evento) => setJurosMulta(evento.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Sugerido pelo cálculo automático. Ajuste se você abonou parte.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="baixa-data">Data do pagamento</Label>
          <Input
            id="baixa-data"
            type="date"
            value={data}
            onChange={(evento) => setData(evento.target.value)}
          />
        </div>
      </div>
    </FormSheet>
  )
}

function DialogoCobranca({
  conta,
  tenantId,
  responsavel,
  aoFechar,
  aoConcluir,
}: {
  conta: ContaReceber
  tenantId: string
  responsavel: { id: string; nome: string }
  aoFechar: () => void
  aoConcluir: () => Promise<void>
}) {
  const [canal, setCanal] = useState<CanalCobranca>('whatsapp')
  const [resultado, setResultado] = useState<ResultadoCobranca>('promessa_pagamento')
  const [observacao, setObservacao] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))

  const salvar = useMutation({
    mutationFn: () =>
      registrarCobranca(tenantId, conta.id, {
        data,
        canal,
        resultado,
        observacao: observacao.trim(),
        responsavel_id: responsavel.id,
        responsavel_nome: responsavel.nome,
      }),
    onSuccess: async () => {
      toast.success('Contato registrado', { description: conta.descricao })
      await aoConcluir()
    },
  })

  return (
    <FormSheet
      aberto
      aoFechar={aoFechar}
      titulo="Registrar cobrança"
      descricao={conta.descricao}
      salvando={salvar.isPending}
      aoSalvar={(evento) => {
        evento.preventDefault()
        salvar.mutate()
      }}
    >
      <div className="space-y-4">
        {conta.cobrancas.length > 0 && (
          <div className="rounded-card border border-border p-3">
            <p className="mb-2 font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
              Contatos anteriores
            </p>

            <ul className="space-y-2">
              {conta.cobrancas.map((cobranca) => (
                <li key={cobranca.id} className="text-xs">
                  <span className="font-mono text-brand-medium">
                    {formatDate(cobranca.data)}
                  </span>{' '}
                  <span className="text-brand-text">
                    {CANAL_COBRANCA_LABEL[cobranca.canal]} ·{' '}
                    {RESULTADO_COBRANCA_LABEL[cobranca.resultado]}
                  </span>
                  {cobranca.observacao && (
                    <span className="block text-muted-foreground">
                      {cobranca.observacao}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="cobranca-canal">Canal</Label>
          <Select
            value={canal}
            onValueChange={(valor) => setCanal(valor as CanalCobranca)}
          >
            <SelectTrigger id="cobranca-canal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANAIS_COBRANCA.map((item) => (
                <SelectItem key={item} value={item}>
                  {CANAL_COBRANCA_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cobranca-resultado">Resultado</Label>
          <Select
            value={resultado}
            onValueChange={(valor) => setResultado(valor as ResultadoCobranca)}
          >
            <SelectTrigger id="cobranca-resultado" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESULTADOS_COBRANCA.map((item) => (
                <SelectItem key={item} value={item}>
                  {RESULTADO_COBRANCA_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {resultado === 'negociado' && (
            <p className="text-xs text-muted-foreground">
              Marcar como negociado tira o título da régua de inadimplência.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cobranca-data">Data do contato</Label>
          <Input
            id="cobranca-data"
            type="date"
            value={data}
            onChange={(evento) => setData(evento.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cobranca-obs">O que foi combinado</Label>
          <Textarea
            id="cobranca-obs"
            rows={3}
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
          />
        </div>
      </div>
    </FormSheet>
  )
}

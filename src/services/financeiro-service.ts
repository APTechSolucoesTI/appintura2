import { parseData } from '@/lib/format'
import type {
  CanalCobranca,
  CentroCusto,
  ContaPagar,
  ContaReceber,
  ResultadoCobranca,
} from '@/types/financeiro'
import {
  diasEmAtraso,
  saldoAberto,
  statusEfetivo,
  statusEfetivoPagar,
  totalPago,
} from '@/types/financeiro'

import { clientesStore } from './cadastros-service'
import { criarStoreSupabase } from './supabase-store'

export const centrosCustoStore = criarStoreSupabase<CentroCusto>({
  tabela: 'centros_custo',
  ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
})

// Agregado de leitura: pagamentos e histórico de cobrança vêm aninhados, mas a
// gravação deles tem tela e regra próprias (baixa, régua) — por isso sem RPC.
export const contasReceberStore = criarStoreSupabase<ContaReceber>({
  tabela: 'contas_receber',
  select:
    '*, pagamentos:contas_receber_pagamentos(*), cobrancas:contas_receber_cobranca_historico(*)',
  ordenar: (a, b) => a.vencimento.localeCompare(b.vencimento),
})

export const contasPagarStore = criarStoreSupabase<ContaPagar>({
  tabela: 'contas_pagar',
  ordenar: (a, b) => a.vencimento.localeCompare(b.vencimento),
})

export class FinanceiroError extends Error {}

// ---------------------------------------------------------------------------
// Baixas e cobrança
// ---------------------------------------------------------------------------

export async function registrarPagamento(
  tenantId: string,
  contaId: string,
  pagamento: { data_pagamento: string; valor_pago: number; juros_multa: number },
): Promise<ContaReceber> {
  const conta = await contasReceberStore.obter(tenantId, contaId)
  const saldo = saldoAberto(conta)

  // O principal é limitado ao saldo; juros e multa entram à parte. Sem isso um
  // pagamento com juros marcaria o título como "pago a mais".
  if (pagamento.valor_pago > saldo) {
    throw new FinanceiroError(
      `O saldo em aberto é de ${saldo.toFixed(2)}. Lance juros e multa no campo próprio.`,
    )
  }

  return contasReceberStore.atualizar(tenantId, contaId, {
    pagamentos: [
      ...conta.pagamentos,
      { id: crypto.randomUUID(), conta_receber_id: contaId, ...pagamento },
    ],
  })
}

export async function registrarCobranca(
  tenantId: string,
  contaId: string,
  cobranca: {
    data: string
    canal: CanalCobranca
    resultado: ResultadoCobranca
    observacao: string
    responsavel_id: string
    responsavel_nome: string
  },
): Promise<ContaReceber> {
  const conta = await contasReceberStore.obter(tenantId, contaId)

  return contasReceberStore.atualizar(tenantId, contaId, {
    cobrancas: [
      ...conta.cobrancas,
      { id: crypto.randomUUID(), conta_receber_id: contaId, ...cobranca },
    ],
    // Acordo fechado tira o título da régua: continua em aberto, mas para de
    // aparecer como inadimplente.
    status: cobranca.resultado === 'negociado' ? 'negociado' : conta.status,
  })
}

export async function baixarContaPagar(
  tenantId: string,
  contaId: string,
  dataPagamento: string,
): Promise<ContaPagar> {
  return contasPagarStore.atualizar(tenantId, contaId, {
    data_pagamento: dataPagamento,
  })
}

// ---------------------------------------------------------------------------
// Fluxo de caixa
// ---------------------------------------------------------------------------

export interface JanelaFluxo {
  rotulo: string
  /** Fim da janela, inclusivo. */
  ate: string
  entradas: number
  saidas: number
  saldo: number
}

export interface FluxoCaixa {
  janelas: JanelaFluxo[]
  /** Já vencido e não pago — não é projeção, é buraco. */
  entradasVencidas: number
  saidasVencidas: number
  acumulado: number
}

function emDias(dias: number, hoje: Date): Date {
  const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  data.setDate(data.getDate() + dias)

  return data
}

/**
 * Projeção 30/60/90 dias.
 *
 * O que já venceu e não foi pago fica FORA das janelas, num bloco próprio:
 * empurrar título vencido para "próximos 30 dias" é como as projeções de caixa
 * mentem — o dinheiro é tratado como se fosse entrar, e ele já não entrou.
 */
export async function fluxoDeCaixa(
  tenantId: string,
  hoje = new Date(),
): Promise<FluxoCaixa> {
  const [receber, pagar] = await Promise.all([
    contasReceberStore.listar(tenantId),
    contasPagarStore.listar(tenantId),
  ])

  const abertas = receber.filter((conta) => {
    const status = statusEfetivo(conta, hoje)

    return status !== 'pago' && status !== 'cancelado'
  })

  const aPagar = pagar.filter((conta) => {
    const status = statusEfetivoPagar(conta, hoje)

    return status !== 'pago' && status !== 'cancelado'
  })

  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()

  const entradasVencidas = abertas
    .filter((conta) => parseData(conta.vencimento).getTime() < inicio)
    .reduce((soma, conta) => soma + saldoAberto(conta), 0)

  const saidasVencidas = aPagar
    .filter((conta) => parseData(conta.vencimento).getTime() < inicio)
    .reduce((soma, conta) => soma + conta.valor, 0)

  let anterior = inicio
  let acumulado = 0

  const janelas = [30, 60, 90].map((dias) => {
    const limite = emDias(dias, hoje).getTime()

    const entradas = abertas
      .filter((conta) => {
        const quando = parseData(conta.vencimento).getTime()

        return quando >= anterior && quando <= limite
      })
      .reduce((soma, conta) => soma + saldoAberto(conta), 0)

    const saidas = aPagar
      .filter((conta) => {
        const quando = parseData(conta.vencimento).getTime()

        return quando >= anterior && quando <= limite
      })
      .reduce((soma, conta) => soma + conta.valor, 0)

    anterior = limite + 1
    acumulado += entradas - saidas

    return {
      rotulo: `${dias} dias`,
      ate: new Date(limite).toISOString().slice(0, 10),
      entradas,
      saidas,
      saldo: entradas - saidas,
    }
  })

  return { janelas, entradasVencidas, saidasVencidas, acumulado }
}

// ---------------------------------------------------------------------------
// Inadimplência, ticket médio e curva ABC
// ---------------------------------------------------------------------------

export interface InadimplenciaCliente {
  cliente_id: string
  cliente_nome: string
  valor: number
  dias_max: number
  titulos: number
}

export interface Inadimplencia {
  valorVencido: number
  valorEmAberto: number
  percentual: number
  porCliente: InadimplenciaCliente[]
}

export async function inadimplencia(
  tenantId: string,
  hoje = new Date(),
): Promise<Inadimplencia> {
  const [contas, clientes] = await Promise.all([
    contasReceberStore.listar(tenantId),
    clientesStore.listar(tenantId),
  ])

  const porCliente = new Map<string, InadimplenciaCliente>()
  let valorVencido = 0
  let valorEmAberto = 0

  for (const conta of contas) {
    const status = statusEfetivo(conta, hoje)

    if (status === 'pago' || status === 'cancelado') continue

    const saldo = saldoAberto(conta)
    valorEmAberto += saldo

    if (status !== 'vencido') continue

    valorVencido += saldo

    const atual = porCliente.get(conta.cliente_id) ?? {
      cliente_id: conta.cliente_id,
      cliente_nome:
        clientes.find((cliente) => cliente.id === conta.cliente_id)?.razao_social ??
        'Cliente removido',
      valor: 0,
      dias_max: 0,
      titulos: 0,
    }

    atual.valor += saldo
    atual.titulos += 1
    atual.dias_max = Math.max(atual.dias_max, diasEmAtraso(conta.vencimento, hoje))
    porCliente.set(conta.cliente_id, atual)
  }

  return {
    valorVencido,
    valorEmAberto,
    percentual: valorEmAberto === 0 ? 0 : (valorVencido / valorEmAberto) * 100,
    porCliente: [...porCliente.values()].sort((a, b) => b.valor - a.valor),
  }
}

/**
 * Dias de atraso do título mais antigo de cada cliente.
 *
 * É o cálculo que a Fase 1 prometeu para `dias_inadimplencia_atual`: o campo
 * deixa de ser um número digitado e passa a sair das contas a receber.
 */
export async function diasInadimplenciaPorCliente(
  tenantId: string,
  hoje = new Date(),
): Promise<Map<string, number>> {
  const contas = await contasReceberStore.listar(tenantId)
  const mapa = new Map<string, number>()

  for (const conta of contas) {
    if (statusEfetivo(conta, hoje) !== 'vencido') continue

    const dias = diasEmAtraso(conta.vencimento, hoje)
    mapa.set(conta.cliente_id, Math.max(mapa.get(conta.cliente_id) ?? 0, dias))
  }

  return mapa
}

export interface ClienteFaturamento {
  cliente_id: string
  cliente_nome: string
  faturado: number
  /** Participação acumulada até este cliente, em %. */
  acumulado: number
  classe: 'A' | 'B' | 'C'
}

/**
 * Curva ABC pelo valor RECEBIDO, não pelo faturado em aberto — cliente que
 * compra muito e não paga não é cliente classe A.
 */
export async function curvaAbc(
  tenantId: string,
  periodo: { de: string; ate: string },
): Promise<ClienteFaturamento[]> {
  const [contas, clientes] = await Promise.all([
    contasReceberStore.listar(tenantId),
    clientesStore.listar(tenantId),
  ])

  const inicio = parseData(periodo.de).getTime()
  const fim = parseData(periodo.ate).getTime() + 86_400_000 - 1

  const porCliente = new Map<string, number>()

  for (const conta of contas) {
    for (const pagamento of conta.pagamentos) {
      const quando = parseData(pagamento.data_pagamento).getTime()

      if (quando < inicio || quando > fim) continue

      porCliente.set(
        conta.cliente_id,
        (porCliente.get(conta.cliente_id) ?? 0) + pagamento.valor_pago,
      )
    }
  }

  const total = [...porCliente.values()].reduce((soma, valor) => soma + valor, 0)
  let acumulado = 0

  return [...porCliente.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, faturado]) => {
      // A classe sai do acumulado ANTES deste cliente: quem cruza a faixa de 80%
      // ainda é A. Classificar pelo acumulado já somado faria o maior cliente de
      // uma carteira com um só nome cair em C, com 100%.
      const anterior = acumulado
      acumulado += total === 0 ? 0 : (faturado / total) * 100

      return {
        cliente_id: id,
        cliente_nome:
          clientes.find((cliente) => cliente.id === id)?.razao_social ??
          'Cliente removido',
        faturado,
        acumulado,
        classe: anterior < 80 ? 'A' : anterior < 95 ? 'B' : 'C',
      } as ClienteFaturamento
    })
}

export interface ResumoMes {
  /** `YYYY-MM`. */
  mes: string
  rotulo: string
  recebido: number
  pago: number
  resultado: number
}

function rotuloMes(ano: number, mes: number): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(new Date(ano, mes, 1))
    .replace('.', '')
}

/** Últimos N meses, em regime de CAIXA (o que entrou e saiu de verdade). */
export async function comparativoMensal(
  tenantId: string,
  meses = 6,
  hoje = new Date(),
): Promise<ResumoMes[]> {
  const [receber, pagar] = await Promise.all([
    contasReceberStore.listar(tenantId),
    contasPagarStore.listar(tenantId),
  ])

  const resultado: ResumoMes[] = []

  for (let passo = meses - 1; passo >= 0; passo -= 1) {
    const referencia = new Date(hoje.getFullYear(), hoje.getMonth() - passo, 1)
    const chave = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, '0')}`

    const recebido = receber
      .flatMap((conta) => conta.pagamentos)
      .filter((pagamento) => pagamento.data_pagamento.startsWith(chave))
      .reduce((soma, pagamento) => soma + pagamento.valor_pago + pagamento.juros_multa, 0)

    const pago = pagar
      .filter((conta) => conta.data_pagamento?.startsWith(chave))
      .reduce((soma, conta) => soma + conta.valor, 0)

    resultado.push({
      mes: chave,
      rotulo: rotuloMes(referencia.getFullYear(), referencia.getMonth()),
      recebido,
      pago,
      resultado: recebido - pago,
    })
  }

  return resultado
}

export interface Dre {
  receitaBruta: number
  custoInsumoDireto: number
  margemBruta: number
  despesaVariavel: number
  despesaFixa: number
  resultado: number
  ticketMedio: number
  titulosRecebidos: number
}

/**
 * DRE gerencial em REGIME DE CAIXA: considera o que entrou e saiu no período,
 * não o que foi competência dele. É o que a fábrica pequena consegue conferir
 * contra o extrato — e precisa estar rotulado, porque não bate com a DRE
 * contábil do escritório.
 */
export async function dreGerencial(
  tenantId: string,
  periodo: { de: string; ate: string },
): Promise<Dre> {
  const [receber, pagar] = await Promise.all([
    contasReceberStore.listar(tenantId),
    contasPagarStore.listar(tenantId),
  ])

  const inicio = parseData(periodo.de).getTime()
  const fim = parseData(periodo.ate).getTime() + 86_400_000 - 1

  const dentro = (data: string) => {
    const quando = parseData(data).getTime()

    return quando >= inicio && quando <= fim
  }

  const pagamentos = receber
    .flatMap((conta) => conta.pagamentos)
    .filter((pagamento) => dentro(pagamento.data_pagamento))

  const receitaBruta = pagamentos.reduce(
    (soma, pagamento) => soma + pagamento.valor_pago + pagamento.juros_multa,
    0,
  )

  const pagos = pagar.filter(
    (conta) => conta.data_pagamento && dentro(conta.data_pagamento),
  )

  const porCategoria = (categoria: ContaPagar['categoria']) =>
    pagos
      .filter((conta) => conta.categoria === categoria)
      .reduce((soma, conta) => soma + conta.valor, 0)

  const custoInsumoDireto = porCategoria('insumo_direto')
  const despesaVariavel = porCategoria('variavel')
  const despesaFixa = porCategoria('fixa')
  const margemBruta = receitaBruta - custoInsumoDireto

  return {
    receitaBruta,
    custoInsumoDireto,
    margemBruta,
    despesaVariavel,
    despesaFixa,
    resultado: margemBruta - despesaVariavel - despesaFixa,
    ticketMedio: pagamentos.length === 0 ? 0 : receitaBruta / pagamentos.length,
    titulosRecebidos: pagamentos.length,
  }
}

/** Total já recebido de um título, para exibir na listagem. */
export { saldoAberto, statusEfetivo, statusEfetivoPagar, totalPago }

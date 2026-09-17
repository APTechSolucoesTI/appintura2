/**
 * Tipos do módulo Financeiro (Fase 5).
 */

import { parseData } from '@/lib/format'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Estado que o usuário escolhe. `pago`, `parcialmente_pago` e `vencido` NÃO
 * ficam aqui: são derivados dos pagamentos e da data. Guardar um status que
 * depende do relógio é a receita para o título aparecer "em aberto" três meses
 * depois de vencer.
 */
export const STATUS_CONTA_BASE = ['em_aberto', 'negociado', 'cancelado'] as const
export type StatusContaBase = (typeof STATUS_CONTA_BASE)[number]

export const STATUS_CONTA = [
  'em_aberto',
  'parcialmente_pago',
  'pago',
  'vencido',
  'negociado',
  'cancelado',
] as const
export type StatusConta = (typeof STATUS_CONTA)[number]

export const STATUS_CONTA_LABEL: Record<StatusConta, string> = {
  em_aberto: 'Em aberto',
  parcialmente_pago: 'Parcialmente pago',
  pago: 'Pago',
  vencido: 'Vencido',
  negociado: 'Negociado',
  cancelado: 'Cancelado',
}

export const FORMAS_PAGAMENTO = [
  'pix',
  'boleto',
  'transferencia',
  'dinheiro',
  'cartao',
] as const
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
}

export const FORMAS_FATURAMENTO = [
  'os_avulsa',
  'quinzenal',
  'mensal',
  'contrato',
] as const
export type FormaFaturamento = (typeof FORMAS_FATURAMENTO)[number]

export const FORMA_FATURAMENTO_LABEL: Record<FormaFaturamento, string> = {
  os_avulsa: 'Por OS avulsa',
  quinzenal: 'Fechamento quinzenal',
  mensal: 'Fechamento mensal',
  contrato: 'Contrato com volume mínimo',
}

export const CATEGORIAS_PAGAR = ['fixa', 'variavel', 'insumo_direto'] as const
export type CategoriaPagar = (typeof CATEGORIAS_PAGAR)[number]

export const CATEGORIA_PAGAR_LABEL: Record<CategoriaPagar, string> = {
  fixa: 'Despesa fixa',
  variavel: 'Despesa variável',
  insumo_direto: 'Insumo direto',
}

export const TIPOS_CENTRO_CUSTO = ['producao', 'comercial', 'administrativo'] as const
export type TipoCentroCusto = (typeof TIPOS_CENTRO_CUSTO)[number]

export const TIPO_CENTRO_CUSTO_LABEL: Record<TipoCentroCusto, string> = {
  producao: 'Produção',
  comercial: 'Comercial',
  administrativo: 'Administrativo',
}

export const CANAIS_COBRANCA = ['telefone', 'whatsapp', 'email', 'presencial'] as const
export type CanalCobranca = (typeof CANAIS_COBRANCA)[number]

export const CANAL_COBRANCA_LABEL: Record<CanalCobranca, string> = {
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  presencial: 'Presencial',
}

export const RESULTADOS_COBRANCA = [
  'promessa_pagamento',
  'sem_retorno',
  'contestado',
  'negociado',
  'pago',
] as const
export type ResultadoCobranca = (typeof RESULTADOS_COBRANCA)[number]

export const RESULTADO_COBRANCA_LABEL: Record<ResultadoCobranca, string> = {
  promessa_pagamento: 'Promessa de pagamento',
  sem_retorno: 'Sem retorno',
  contestado: 'Valor contestado',
  negociado: 'Negociado',
  pago: 'Pagou na hora',
}

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

export interface CentroCusto {
  id: string
  tenant_id: string
  nome: string
  tipo: TipoCentroCusto
  created_at: string
}

export interface PagamentoRecebido {
  id: string
  conta_receber_id: string
  data_pagamento: string
  valor_pago: number
  juros_multa: number
}

export interface CobrancaHistorico {
  id: string
  conta_receber_id: string
  data: string
  canal: CanalCobranca
  responsavel_id: string
  responsavel_nome: string
  resultado: ResultadoCobranca
  observacao: string
}

export interface ContaReceber {
  id: string
  tenant_id: string
  cliente_id: string
  os_id: string | null
  os_numero: number | null
  descricao: string
  valor: number
  vencimento: string
  status: StatusContaBase
  forma_pagamento: FormaPagamento
  centro_custo_id: string | null
  /** 1/3, 2/3… para títulos parcelados. `null` quando é à vista. */
  parcela: number | null
  total_parcelas: number | null
  pagamentos: PagamentoRecebido[]
  cobrancas: CobrancaHistorico[]
  created_at: string
}

export interface ContaPagar {
  id: string
  tenant_id: string
  fornecedor: string
  descricao: string
  categoria: CategoriaPagar
  valor: number
  vencimento: string
  status: StatusContaBase
  recorrente: boolean
  centro_custo_id: string | null
  data_pagamento: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

export function totalPago(conta: ContaReceber): number {
  return conta.pagamentos.reduce((soma, item) => soma + item.valor_pago, 0)
}

export function saldoAberto(conta: ContaReceber): number {
  return Math.max(0, conta.valor - totalPago(conta))
}

function inicioDoDia(data: Date): number {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime()
}

export function diasEmAtraso(vencimento: string, hoje = new Date()): number {
  const diferenca = inicioDoDia(hoje) - parseData(vencimento).getTime()

  return Math.max(0, Math.round(diferenca / 86_400_000))
}

/** O status que o usuário vê: combina o estado manual com pagamentos e prazo. */
export function statusEfetivo(conta: ContaReceber, hoje = new Date()): StatusConta {
  if (conta.status === 'cancelado') return 'cancelado'

  const saldo = saldoAberto(conta)

  if (saldo === 0) return 'pago'
  if (conta.status === 'negociado') return 'negociado'

  const atraso = diasEmAtraso(conta.vencimento, hoje)

  if (atraso > 0) return 'vencido'
  if (totalPago(conta) > 0) return 'parcialmente_pago'

  return 'em_aberto'
}

export function statusEfetivoPagar(conta: ContaPagar, hoje = new Date()): StatusConta {
  if (conta.status === 'cancelado') return 'cancelado'
  if (conta.data_pagamento) return 'pago'
  if (conta.status === 'negociado') return 'negociado'

  return diasEmAtraso(conta.vencimento, hoje) > 0 ? 'vencido' : 'em_aberto'
}

export interface ParametrosJuros {
  /** Percentual fixo cobrado uma vez sobre o saldo em atraso. */
  multa_percentual: number
  /** Percentual ao mês, cobrado pro rata die. */
  juros_mes_percentual: number
}

/**
 * Multa é aplicada uma vez; juros correm por dia (taxa mensal ÷ 30).
 * É a convenção comercial usada no Brasil e o que o cliente espera ver na
 * planilha de cobrança.
 */
export function calcularJurosMulta(
  saldo: number,
  diasAtraso: number,
  parametros: ParametrosJuros,
): { multa: number; juros: number; total: number } {
  if (saldo <= 0 || diasAtraso <= 0) return { multa: 0, juros: 0, total: 0 }

  const multa = saldo * (parametros.multa_percentual / 100)
  const juros = saldo * (parametros.juros_mes_percentual / 100 / 30) * diasAtraso

  return { multa, juros, total: multa + juros }
}

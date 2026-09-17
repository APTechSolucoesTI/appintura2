/**
 * Tipos do módulo de Ordem de Serviço (Fase 3) — núcleo de produção.
 *
 * A OS nasce obrigatoriamente de um romaneio de recebimento: não se pinta peça
 * que não entrou pela portaria. Custódia (Fase 2) e produção são registros
 * separados de propósito — finalizar a OS não devolve peça nenhuma.
 */

import { parseData } from '@/lib/format'

// ---------------------------------------------------------------------------
// Fluxo de status
// ---------------------------------------------------------------------------

export const STATUS_OS = [
  'recebido',
  'pre_tratamento',
  'aplicacao_po',
  'cura',
  'controle_qualidade',
  'embalagem',
  'aguardando_retirada',
  'finalizado',
  'retrabalho',
] as const

export type StatusOs = (typeof STATUS_OS)[number]

export const STATUS_OS_LABEL: Record<StatusOs, string> = {
  recebido: 'Recebido',
  pre_tratamento: 'Pré-tratamento',
  aplicacao_po: 'Aplicação de pó',
  cura: 'Cura (forno)',
  controle_qualidade: 'Controle de qualidade',
  embalagem: 'Embalagem',
  aguardando_retirada: 'Aguardando retirada',
  finalizado: 'Finalizado',
  retrabalho: 'Retrabalho',
}

export const STATUS_OS_DESCRICAO: Record<StatusOs, string> = {
  recebido: 'Na fila, ainda não entrou na linha',
  pre_tratamento: 'Desengraxe, decapagem ou fosfatização',
  aplicacao_po: 'Cabine de pintura eletrostática',
  cura: 'Polimerização no forno',
  controle_qualidade: 'Espessura e aderência conferidas',
  embalagem: 'Protegido para transporte',
  aguardando_retirada: 'Pronto, esperando o cliente',
  finalizado: 'Entregue ou retirado',
  retrabalho: 'Reprovado, volta para a cabine',
}

/** Ordem das colunas do Kanban. Retrabalho fica por último, fora da linha. */
export const FLUXO_PRODUCAO: StatusOs[] = [
  'recebido',
  'pre_tratamento',
  'aplicacao_po',
  'cura',
  'controle_qualidade',
  'embalagem',
  'aguardando_retirada',
  'finalizado',
]

/**
 * Retrabalho pode ser disparado de qualquer etapa; sair dele leva sempre de
 * volta para a cabine, porque repintar exige reaplicar o pó.
 */
export const STATUS_APOS_RETRABALHO: StatusOs = 'aplicacao_po'

export const URGENCIAS = ['normal', 'alta', 'urgente'] as const
export type Urgencia = (typeof URGENCIAS)[number]

export const URGENCIA_LABEL: Record<Urgencia, string> = {
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const PRETRATAMENTOS = [
  'desengraxe',
  'decapagem',
  'fosfatizacao',
  'jateamento',
  'nenhum',
] as const
export type Pretratamento = (typeof PRETRATAMENTOS)[number]

export const PRETRATAMENTO_LABEL: Record<Pretratamento, string> = {
  desengraxe: 'Desengraxe',
  decapagem: 'Decapagem',
  fosfatizacao: 'Fosfatização',
  jateamento: 'Jateamento',
  nenhum: 'Nenhum',
}

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

export interface OrdemServicoItem {
  id: string
  os_id: string
  descricao: string
  quantidade: number
  /** Área TOTAL da linha em m², já multiplicada pela quantidade. */
  area_m2: number
  foto_url: string | null
}

export interface OsStatusHistorico {
  id: string
  os_id: string
  /** `null` na abertura da OS. */
  de: StatusOs | null
  para: StatusOs
  responsavel_id: string
  responsavel_nome: string
  observacao: string
  created_at: string
}

export interface OrdemServico {
  id: string
  tenant_id: string
  numero: number
  cliente_id: string
  /** Obrigatório: toda OS rastreia de qual entrada veio a peça. */
  romaneio_recebimento_id: string
  data_entrada: string
  previsao_entrega: string
  urgencia: Urgencia
  status: StatusOs
  cor_id: string
  espessura_min_micron: number
  espessura_max_micron: number
  tipo_pretratamento: Pretratamento
  laudo_url: string | null
  laudo_nome: string
  observacao: string
  itens: OrdemServicoItem[]
  historico: OsStatusHistorico[]
  created_at: string
}

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------

export function areaTotal(itens: OrdemServicoItem[]): number {
  return itens.reduce((soma, item) => soma + item.area_m2, 0)
}

/**
 * Consumo estimado de pó, em quilos: área total x rendimento da ficha técnica.
 * É estimativa de planejamento — o consumo real vem do apontamento da Fase 4.
 */
export function consumoEstimadoKg(
  itens: OrdemServicoItem[],
  rendimentoGm2: number,
): number {
  return (areaTotal(itens) * rendimentoGm2) / 1000
}

/** OS atrasada: prazo vencido e ainda não finalizada. */
export function estaAtrasada(os: OrdemServico, hoje = new Date()): boolean {
  if (os.status === 'finalizado') return false

  const inicioDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())

  return parseData(os.previsao_entrega).getTime() < inicioDeHoje.getTime()
}

export function diasParaEntrega(os: OrdemServico, hoje = new Date()): number {
  const inicioDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())

  return Math.round(
    (parseData(os.previsao_entrega).getTime() - inicioDeHoje.getTime()) / 86_400_000,
  )
}

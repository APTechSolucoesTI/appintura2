/**
 * Tipos do Controle de Estoque (Fase 4).
 *
 * Este módulo é sobre INSUMO CONSUMÍVEL da produção — tinta em pó e químicos de
 * pré-tratamento. Não confundir com a custódia de peças de terceiros (Fase 2):
 * lá a mercadoria é do cliente e sai inteira; aqui o material é da casa e some
 * ao ser aplicado.
 */

export const TIPOS_ITEM = ['tinta', 'insumo_quimico'] as const
export type TipoItem = (typeof TIPOS_ITEM)[number]

export const TIPO_ITEM_LABEL: Record<TipoItem, string> = {
  tinta: 'Tinta em pó',
  insumo_quimico: 'Insumo químico',
}

/**
 * `perda` é tecnicamente uma saída, mas separada de propósito: misturar quebra
 * de embalagem com consumo de produção arruinaria o indicador de eficiência
 * (g/m²) da Fase 6.
 */
export const TIPOS_MOVIMENTO = ['entrada', 'saida', 'perda'] as const
export type TipoMovimento = (typeof TIPOS_MOVIMENTO)[number]

export const TIPO_MOVIMENTO_LABEL: Record<TipoMovimento, string> = {
  entrada: 'Entrada',
  saida: 'Saída para produção',
  perda: 'Perda',
}

export const MOTIVOS_PERDA = [
  'vencimento',
  'contaminacao',
  'derrame',
  'quebra_embalagem',
  'sobra_cabine',
  'outro',
] as const
export type MotivoPerda = (typeof MOTIVOS_PERDA)[number]

export const MOTIVO_PERDA_LABEL: Record<MotivoPerda, string> = {
  vencimento: 'Vencimento do lote',
  contaminacao: 'Contaminação',
  derrame: 'Derrame',
  quebra_embalagem: 'Quebra de embalagem',
  sobra_cabine: 'Sobra de cabine não recuperável',
  outro: 'Outro',
}

export interface EstoqueMovimentacao {
  id: string
  tenant_id: string
  tipo_item: TipoItem
  /** FK para `cores` ou `insumos_quimicos`, conforme `tipo_item`. */
  item_id: string
  /** Guardado junto para o extrato continuar legível se o item for excluído. */
  item_descricao: string
  tipo_movimento: TipoMovimento
  quantidade: number
  unidade: string
  /** Preenchido nas saídas automáticas disparadas pela produção. */
  os_id: string | null
  os_numero: number | null
  lote: string
  motivo_perda: MotivoPerda | null
  observacao: string
  responsavel_id: string
  responsavel_nome: string
  data: string
  created_at: string
}

/** Entrada soma; saída e perda subtraem. */
export function efeitoNoSaldo(movimento: EstoqueMovimentacao): number {
  return movimento.tipo_movimento === 'entrada'
    ? movimento.quantidade
    : -movimento.quantidade
}

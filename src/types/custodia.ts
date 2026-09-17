/**
 * Tipos do módulo de Recebimento e Devolução (Fase 2).
 *
 * Este módulo registra a CUSTÓDIA FÍSICA da mercadoria do cliente — o que entrou
 * no pátio e o que saiu. É deliberadamente independente do status de produção:
 * uma OS finalizada não devolve peça nenhuma; quem devolve é o romaneio de saída.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const UNIDADES_ITEM = ['peca', 'kg', 'm2', 'conjunto'] as const
export type UnidadeItem = (typeof UNIDADES_ITEM)[number]

export const UNIDADE_ITEM_LABEL: Record<UnidadeItem, string> = {
  peca: 'peça(s)',
  kg: 'kg',
  m2: 'm²',
  conjunto: 'conjunto(s)',
}

export const CONDICOES = ['integra', 'avariada', 'com_observacao'] as const
export type Condicao = (typeof CONDICOES)[number]

export const CONDICAO_LABEL: Record<Condicao, string> = {
  integra: 'Íntegra',
  avariada: 'Avariada',
  com_observacao: 'Com observação',
}

export const STATUS_RECEBIMENTO = [
  'pendente_conferencia',
  'recebido_conferido',
  'recebido_com_ressalva',
] as const
export type StatusRecebimento = (typeof STATUS_RECEBIMENTO)[number]

export const STATUS_RECEBIMENTO_LABEL: Record<StatusRecebimento, string> = {
  pendente_conferencia: 'Pendente de conferência',
  recebido_conferido: 'Recebido e conferido',
  recebido_com_ressalva: 'Recebido com ressalva',
}

export const STATUS_DEVOLUCAO = [
  'aguardando_retirada',
  'retirado',
  'retirado_parcial',
] as const
export type StatusDevolucao = (typeof STATUS_DEVOLUCAO)[number]

export const STATUS_DEVOLUCAO_LABEL: Record<StatusDevolucao, string> = {
  aguardando_retirada: 'Aguardando retirada',
  retirado: 'Retirado',
  retirado_parcial: 'Retirado parcialmente',
}

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

/**
 * No mock a imagem vive como data URL. Ao conectar o Supabase, `url` passa a ser
 * o caminho no bucket `appintura2-romaneios-fotos` ({tenant_id}/{romaneio_id}/{arquivo}) e a
 * exibição usa signed URL de curta duração.
 */
export interface Foto {
  id: string
  url: string
  nome: string
  capturada_em: string
}

export interface RomaneioRecebimentoItem {
  id: string
  romaneio_id: string
  descricao: string
  quantidade: number
  unidade: UnidadeItem
  peso_kg: number | null
  condicao_chegada: Condicao
  observacao: string
  fotos: Foto[]
}

export interface RomaneioRecebimento {
  id: string
  tenant_id: string
  /** Sequencial POR TENANT — cada empresa tem seu próprio nº 1. */
  numero: number
  cliente_id: string
  transportadora_id: string | null
  data_hora: string
  /** Nota de remessa do cliente. */
  documento_numero: string
  documento_serie: string
  documento_chave: string
  conferente_id: string
  conferente_nome: string
  status: StatusRecebimento
  observacao: string
  assinatura_url: string | null
  assinatura_nome: string
  /** Vínculo com a OS — preenchido a partir da Fase 3. */
  os_id: string | null
  itens: RomaneioRecebimentoItem[]
  created_at: string
}

export interface RomaneioDevolucaoItem {
  id: string
  romaneio_devolucao_id: string
  /** Aponta para o item recebido: é isto que permite o comparativo. */
  recebimento_item_id: string
  descricao: string
  quantidade: number
  unidade: UnidadeItem
  condicao_saida: Condicao
  /** Obrigatória quando devolve menos do que recebeu. */
  justificativa: string
  fotos: Foto[]
}

export interface RomaneioDevolucao {
  id: string
  tenant_id: string
  numero: number
  cliente_id: string
  /** Um ou mais romaneios de entrada cujos itens estão saindo. */
  recebimento_ids: string[]
  data_hora: string
  retirado_por_nome: string
  retirado_por_documento: string
  transportadora_id: string | null
  placa: string
  status: StatusDevolucao
  assinatura_url: string | null
  responsavel_id: string
  responsavel_nome: string
  itens: RomaneioDevolucaoItem[]
  created_at: string
}

// ---------------------------------------------------------------------------
// Saldo de custódia (derivado)
// ---------------------------------------------------------------------------

export interface SaldoItem {
  recebimento_item_id: string
  recebimento_id: string
  recebimento_numero: number
  descricao: string
  unidade: UnidadeItem
  recebido: number
  devolvido: number
  saldo: number
  data_entrada: string
  dias_em_custodia: number
}

export interface SaldoCliente {
  cliente_id: string
  cliente_nome: string
  recebido: number
  devolvido: number
  saldo: number
  /** Maior tempo de permanência entre os itens ainda em custódia. */
  dias_mais_antigo: number
  itens: SaldoItem[]
}

/** Devolver menos do que entrou sem justificar é o que o painel precisa gritar. */
export function temDivergenciaNaoJustificada(
  recebido: number,
  devolvido: number,
  justificativa: string,
): boolean {
  return devolvido < recebido && justificativa.trim().length === 0
}

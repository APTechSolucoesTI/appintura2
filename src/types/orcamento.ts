import type { Pretratamento } from './producao'

/**
 * Tipos do módulo de Orçamento — a etapa comercial anterior à Ordem de Serviço.
 *
 * Espelham as tabelas `appintura2.orcamento*`.
 */

export const STATUS_ORCAMENTO = [
  'rascunho',
  'enviado',
  'visualizado',
  'aprovado',
  'rejeitado',
  'alteracao_solicitada',
  'expirado',
  'revisado',
  'convertido',
  'aprovado_parcial',
] as const

export type StatusOrcamento = (typeof STATUS_ORCAMENTO)[number]

export const STATUS_ORCAMENTO_LABEL: Record<StatusOrcamento, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  visualizado: 'Visualizado',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  alteracao_solicitada: 'Alteração solicitada',
  expirado: 'Expirado',
  revisado: 'Revisado',
  convertido: 'Convertido em OS',
  aprovado_parcial: 'Aprovado em parte',
}

/**
 * Cores semânticas, não a paleta de marca: verde/âmbar/vermelho para estado é
 * convenção universal de UI e o usuário lê sem precisar aprender.
 */
export const STATUS_ORCAMENTO_TOM: Record<StatusOrcamento, 'success' | 'warning' | 'danger' | 'neutral'> = {
  rascunho: 'neutral',
  enviado: 'neutral',
  visualizado: 'warning',
  aprovado: 'success',
  rejeitado: 'danger',
  alteracao_solicitada: 'warning',
  expirado: 'danger',
  revisado: 'neutral',
  convertido: 'success',
  // Ambar e nao verde: fechou negocio, mas parte da proposta foi recusada -- o
  // vendedor precisa olhar o que caiu.
  aprovado_parcial: 'warning',
}

/** Status em que o orçamento ainda pode ser editado sem virar revisão. */
export function ehEditavel(status: StatusOrcamento): boolean {
  return status === 'rascunho'
}

/** Status em que o cliente ainda pode decidir. */
export function estaEmAberto(status: StatusOrcamento): boolean {
  return ['enviado', 'visualizado', 'alteracao_solicitada'].includes(status)
}

/**
 * Da para criar uma nova versao a partir deste?
 *
 * Vale tambem para recusado e expirado -- e justamente ai que se faz nova
 * proposta. So o convertido e o ja revisado ficam de fora: um virou ordem de
 * servico, o outro ja tem sucessor.
 *
 * Rascunho nao entra porque ele se edita direto, sem gerar versao.
 */
export function podeRevisar(status: StatusOrcamento): boolean {
  return ['enviado', 'visualizado', 'alteracao_solicitada', 'rejeitado', 'expirado'].includes(
    status,
  )
}

export interface OrcamentoItem {
  id: string
  orcamento_id: string
  descricao: string
  tipo_acabamento: string
  quantidade: number
  area_m2: number
  valor_unitario: number
  valor_total: number
  ordem: number
  /** Comeca true. O cliente pode desmarcar no portal antes de aprovar. */
  aprovado: boolean
}

export interface OrcamentoAnexo {
  id: string
  orcamento_id: string
  storage_path: string
  nome: string
  tipo: 'foto_referencia' | 'desenho_tecnico' | 'outro'
  created_at: string
}

export interface OrcamentoLink {
  id: string
  orcamento_id: string
  expira_em: string
  usado_em: string | null
  revogado: boolean
  created_at: string
}

export const EVENTO_ORCAMENTO_LABEL: Record<string, string> = {
  criado: 'Orçamento criado',
  enviado: 'Enviado ao cliente',
  visualizado: 'Cliente abriu o link',
  aprovado: 'Aprovado pelo cliente',
  rejeitado: 'Recusado pelo cliente',
  alteracao_solicitada: 'Cliente pediu alteração',
  expirado: 'Validade vencida',
  revisado: 'Substituído por uma revisão',
  convertido: 'Convertido em ordem de serviço',
  aprovado_parcial: 'Aprovado em parte pelo cliente',
}

export interface OrcamentoEvento {
  id: string
  orcamento_id: string
  tipo: keyof typeof EVENTO_ORCAMENTO_LABEL
  autor_nome: string
  autor_documento: string
  ip: string
  user_agent: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface Orcamento {
  id: string
  tenant_id: string
  numero: number
  cliente_id: string
  vendedor_id: string
  status: StatusOrcamento
  data_validade: string
  condicoes_pagamento: string
  prazo_entrega_dias: number
  cor_id: string
  espessura_min_micron: number
  espessura_max_micron: number
  tipo_pretratamento: Pretratamento
  valor_total: number
  /** Valor fechado. NULL enquanto nao ha decisao; menor que o total na parcial. */
  valor_aprovado: number | null
  observacoes_internas: string
  observacoes_cliente: string
  orcamento_versao_anterior_id: string | null
  os_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  itens: OrcamentoItem[]
  anexos?: OrcamentoAnexo[]
  eventos?: OrcamentoEvento[]
}

/** O que o portal público devolve. Bem menos do que a tabela tem. */
export interface OrcamentoPublico {
  ok: boolean
  decidido: boolean
  orcamento: {
    numero: number
    status: StatusOrcamento
    data_validade: string
    vencido: boolean
    condicoes_pagamento: string
    prazo_entrega_dias: number
    valor_total: number
    valor_aprovado: number | null
    observacoes_cliente: string
    cor: string
    espessura: string
  }
  empresa: { nome: string; cnpj: string }
  cliente: { nome: string }
  itens: {
    id: string
    aprovado: boolean
    descricao: string
    tipo_acabamento: string
    quantidade: number
    area_m2: number
    valor_unitario: number
    valor_total: number
  }[]
  anexos: { nome: string; path: string; tipo: string }[]
}

/** Soma dos itens, para o formulário mostrar o total antes de salvar. */
export function totalDosItens(
  itens: { quantidade: number; valor_unitario: number }[],
): number {
  return itens.reduce(
    (soma, item) => soma + Math.round(item.quantidade * item.valor_unitario * 100) / 100,
    0,
  )
}

// ---------------------------------------------------------------------------
// Fase 5 — diff de versões e funil comercial
// ---------------------------------------------------------------------------

export type SituacaoDiff = 'incluido' | 'removido' | 'alterado' | 'igual'

export const SITUACAO_DIFF_LABEL: Record<SituacaoDiff, string> = {
  incluido: 'Incluído',
  removido: 'Removido',
  alterado: 'Alterado',
  igual: 'Sem mudança',
}

export interface LinhaDiff {
  situacao: SituacaoDiff
  descricao: string
  quantidade_antes: number | null
  quantidade_depois: number | null
  valor_antes: number | null
  valor_depois: number | null
}

export interface LinhaFunil {
  tenant_id: string
  mes: string
  vendedor_id: string
  propostos: number
  ganhos: number
  perdidos: number
  expirados: number
  em_aberto: number
  valor_proposto: number
  valor_fechado: number
  /** Percentual sobre o que JÁ FOI DECIDIDO — em aberto não entra no denominador. */
  taxa_aprovacao: number | null
  dias_ate_decisao: number | null
}

export interface MotivoRecusa {
  orcamento_id: string
  orcamento_numero: number
  cliente_id: string
  tipo: 'rejeitado' | 'alteracao_solicitada'
  autor_nome: string
  motivo: string
  created_at: string
}

/** Item do checklist de devolução, já ligado ao orçamento de origem. */
export interface LinhaChecklistDevolucao {
  orcamento_id: string | null
  orcamento_numero: number | null
  romaneio_id: string
  romaneio_numero: number
  recebimento_item_id: string
  descricao: string
  quantidade_recebida: number
  quantidade_devolvida: number
  saldo: number
  houve_avaria: boolean | null
}

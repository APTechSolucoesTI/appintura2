/**
 * Tipos do módulo de Cadastros (Fase 1). Espelham as tabelas de
 * `supabase/migrations/20260914130000_fase1_cadastros.sql`.
 */

import { parseData } from '@/lib/format'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const UNIDADES = ['m2', 'peca'] as const
export type Unidade = (typeof UNIDADES)[number]

export const UNIDADE_LABEL: Record<Unidade, string> = {
  m2: 'por m²',
  peca: 'por peça',
}

export const TIPOS_TINTA = ['poliester', 'epoxi', 'hibrida'] as const
export type TipoTinta = (typeof TIPOS_TINTA)[number]

export const TIPO_TINTA_LABEL: Record<TipoTinta, string> = {
  poliester: 'Poliéster',
  epoxi: 'Epóxi',
  hibrida: 'Híbrida',
}

export const TEXTURAS = ['lisa', 'texturizada', 'martelada'] as const
export type Textura = (typeof TEXTURAS)[number]

export const TEXTURA_LABEL: Record<Textura, string> = {
  lisa: 'Lisa',
  texturizada: 'Texturizada',
  martelada: 'Martelada',
}

export const BRILHOS = ['fosco', 'semibrilho', 'brilhante'] as const
export type Brilho = (typeof BRILHOS)[number]

export const BRILHO_LABEL: Record<Brilho, string> = {
  fosco: 'Fosco',
  semibrilho: 'Semibrilho',
  brilhante: 'Brilhante',
}

export const TIPOS_INSUMO = [
  'desengraxante',
  'decapante',
  'fosfatizante',
  'passivador',
] as const
export type TipoInsumo = (typeof TIPOS_INSUMO)[number]

export const TIPO_INSUMO_LABEL: Record<TipoInsumo, string> = {
  desengraxante: 'Desengraxante',
  decapante: 'Decapante',
  fosfatizante: 'Fosfatizante',
  passivador: 'Passivador',
}

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const
export type Uf = (typeof UFS)[number]

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

export interface Cliente {
  id: string
  tenant_id: string
  razao_social: string
  cnpj_cpf: string
  contato_nome: string
  contato_telefone: string
  contato_email: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: Uf
  tabela_preco_id: string | null
  limite_credito: number
  /** Derivado das contas a receber vencidas (Fase 5). Hoje vem zerado do mock. */
  dias_inadimplencia_atual: number
  ativo: boolean
  created_at: string
}

export interface TabelaPrecoItem {
  id: string
  tabela_preco_id: string
  tipo_acabamento: string
  unidade: Unidade
  valor: number
}

export interface TabelaPreco {
  id: string
  tenant_id: string
  nome: string
  ativa: boolean
  created_at: string
  itens: TabelaPrecoItem[]
}

export interface Cor {
  id: string
  tenant_id: string
  codigo_ral: string
  nome_comercial: string
  fabricante: string
  tipo: TipoTinta
  textura: Textura
  brilho: Brilho
  /** Gramas de pó por m² segundo a ficha técnica — base do consumo estimado da OS. */
  rendimento_teorico_g_m2: number
  custo_kg: number
  estoque_atual: number
  estoque_minimo: number
  lote: string
  validade: string
  created_at: string
}

export const UNIDADES_MEDIDA = ['kg', 'L'] as const
export type UnidadeMedida = (typeof UNIDADES_MEDIDA)[number]

export interface InsumoQuimico {
  id: string
  tenant_id: string
  nome: string
  tipo: TipoInsumo
  estoque_atual: number
  estoque_minimo: number
  /** Desengraxante e passivador vêm em litro; fosfatizante em pó, em quilo. */
  unidade_medida: UnidadeMedida
  validade: string
  fornecedor: string
  created_at: string
}

export interface Transportadora {
  id: string
  tenant_id: string
  nome: string
  cnpj: string
  contato_nome: string
  contato_telefone: string
  contato_email: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Regras de alerta compartilhadas por cores e insumos
// ---------------------------------------------------------------------------

export const DIAS_ALERTA_VALIDADE = 30

export type AlertaEstoque = 'estoque_baixo' | 'vencido' | 'vencendo' | null

/** Dias até a validade. Negativo quando já venceu. */
export function diasParaVencer(validade: string, hoje = new Date()): number {
  const inicioDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())

  return Math.round(
    (parseData(validade).getTime() - inicioDeHoje.getTime()) / 86_400_000,
  )
}

/**
 * Prioriza o problema mais grave: item vencido não deve ser exibido apenas como
 * "estoque baixo".
 */
export function avaliarAlerta(
  estoque_atual: number,
  estoque_minimo: number,
  validade: string,
  hoje = new Date(),
): AlertaEstoque {
  // Compara dia contra dia: a validade é uma data, não um instante.
  const inicioDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const diasParaVencer = Math.round(
    (parseData(validade).getTime() - inicioDeHoje.getTime()) / 86_400_000,
  )

  if (diasParaVencer < 0) return 'vencido'
  if (estoque_atual < estoque_minimo) return 'estoque_baixo'
  if (diasParaVencer <= DIAS_ALERTA_VALIDADE) return 'vencendo'

  return null
}

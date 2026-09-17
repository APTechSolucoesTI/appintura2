/**
 * Tipos do Controle de Qualidade (Fase 4).
 *
 * A inspeção é por ITEM de OS, não pela OS inteira: numa mesma ordem uma grade
 * pode passar e a outra reprovar por espessura.
 */

export const RESULTADOS_TESTE = ['aprovado', 'reprovado'] as const
export type ResultadoTeste = (typeof RESULTADOS_TESTE)[number]

export const RESULTADO_TESTE_LABEL: Record<ResultadoTeste, string> = {
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
}

export interface QualidadeRegistro {
  id: string
  tenant_id: string
  os_id: string
  os_numero: number
  os_item_id: string
  os_item_descricao: string
  espessura_medida_micron: number
  /** Faixa exigida na OS no momento da medição — congelada para auditoria. */
  espessura_min_micron: number
  espessura_max_micron: number
  teste_aderencia: ResultadoTeste
  observacao: string
  responsavel_id: string
  responsavel_nome: string
  data: string
  created_at: string
}

export const TIPOS_NAO_CONFORMIDADE = [
  'espessura_fora_faixa',
  'aderencia',
  'casca_de_laranja',
  'escorrimento',
  'contaminacao',
  'cor_divergente',
  'outro',
] as const
export type TipoNaoConformidade = (typeof TIPOS_NAO_CONFORMIDADE)[number]

export const TIPO_NAO_CONFORMIDADE_LABEL: Record<TipoNaoConformidade, string> = {
  espessura_fora_faixa: 'Espessura fora da faixa',
  aderencia: 'Falha de aderência',
  casca_de_laranja: 'Casca de laranja',
  escorrimento: 'Escorrimento',
  contaminacao: 'Contaminação da superfície',
  cor_divergente: 'Cor divergente',
  outro: 'Outro',
}

export interface NaoConformidade {
  id: string
  tenant_id: string
  os_id: string
  os_numero: number
  os_item_id: string
  os_item_descricao: string
  tipo: TipoNaoConformidade
  causa: string
  acao_corretiva: string
  responsavel_id: string
  responsavel_nome: string
  data: string
  created_at: string
}

/** A espessura medida cai dentro da faixa exigida pela OS? */
export function espessuraConforme(registro: QualidadeRegistro): boolean {
  return (
    registro.espessura_medida_micron >= registro.espessura_min_micron &&
    registro.espessura_medida_micron <= registro.espessura_max_micron
  )
}

/** Reprova se a aderência falhou OU a espessura saiu da faixa. */
export function registroAprovado(registro: QualidadeRegistro): boolean {
  return registro.teste_aderencia === 'aprovado' && espessuraConforme(registro)
}

/** Tipos da central de notificações (Fase 6). */

export const TIPOS_NOTIFICACAO = [
  'os_aguardando_retirada',
  'os_finalizada',
  'devolucao_disponivel',
  'estoque_minimo',
  'peca_parada',
  'titulo_vencendo',
] as const

export type TipoNotificacao = (typeof TIPOS_NOTIFICACAO)[number]

export const TIPO_NOTIFICACAO_LABEL: Record<TipoNotificacao, string> = {
  os_aguardando_retirada: 'Pronto para retirada',
  os_finalizada: 'OS finalizada',
  devolucao_disponivel: 'Devolução aguardando retirada',
  estoque_minimo: 'Estoque',
  peca_parada: 'Peça parada em custódia',
  titulo_vencendo: 'Título vencendo',
}

/**
 * Severidade define só o realce visual. Ela nunca é a única pista: cada
 * notificação carrega ícone e texto próprios.
 */
export type Severidade = 'info' | 'atencao' | 'critico'

export const SEVERIDADE_POR_TIPO: Record<TipoNotificacao, Severidade> = {
  os_aguardando_retirada: 'info',
  os_finalizada: 'info',
  devolucao_disponivel: 'info',
  estoque_minimo: 'atencao',
  peca_parada: 'atencao',
  titulo_vencendo: 'critico',
}

export interface Notificacao {
  id: string
  tenant_id: string
  tipo: TipoNotificacao
  titulo: string
  descricao: string
  /** Id da OS, romaneio, item de estoque ou título que originou o aviso. */
  referencia_id: string
  /** Rota interna para onde o clique leva. */
  link: string
  lida: boolean
  created_at: string
}

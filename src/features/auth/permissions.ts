import type { Role } from '@/types/domain'

/**
 * Espelho no frontend do `public.has_role()` do banco.
 *
 * ATENÇÃO: isto é conveniência de UI (esconder menu / bloquear rota), NUNCA
 * controle de acesso. A autorização real é feita por RLS no Postgres — toda tabela
 * dos módulos seguintes precisa de policy própria, independente deste arquivo.
 */

export const MODULOS = [
  'dashboard',
  'cadastros',
  'orcamentos',
  'recebimento',
  'ordens_servico',
  'estoque',
  'qualidade',
  'financeiro',
  'configuracoes',
] as const

export type Modulo = (typeof MODULOS)[number]

const ACESSO_POR_MODULO: Record<Modulo, readonly Role[]> = {
  dashboard: ['admin', 'gestor_producao', 'operador_pintura', 'qualidade', 'financeiro', 'portaria'],
  cadastros: ['admin', 'gestor_producao'],
  // Orçamento carrega preço de venda e margem: cabine, qualidade e portaria
  // não tem por que ver. Espelha `pode_gerenciar_orcamento()` no banco.
  orcamentos: ['admin', 'gestor_producao', 'financeiro'],
  recebimento: ['admin', 'gestor_producao', 'portaria'],
  ordens_servico: ['admin', 'gestor_producao', 'operador_pintura', 'qualidade'],
  estoque: ['admin', 'gestor_producao'],
  qualidade: ['admin', 'gestor_producao', 'qualidade'],
  financeiro: ['admin', 'financeiro'],
  configuracoes: ['admin'],
}

export function podeAcessar(role: Role, modulo: Modulo): boolean {
  return ACESSO_POR_MODULO[modulo].includes(role)
}

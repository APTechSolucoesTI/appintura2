/**
 * Tipos de domínio da Fase 0 (fundação multi-tenant).
 *
 * Estes tipos espelham 1:1 as tabelas em `supabase/migrations/`. Quando o Supabase
 * for conectado, substitua-os pelos tipos gerados (`supabase gen types typescript`)
 * e mantenha apenas os aliases semânticos (Role, Plano, ...) aqui.
 */

export const ROLES = [
  'admin',
  'gestor_producao',
  'operador_pintura',
  'qualidade',
  'financeiro',
  'portaria',
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  gestor_producao: 'Gestor de produção',
  operador_pintura: 'Operador de pintura',
  qualidade: 'Qualidade',
  financeiro: 'Financeiro',
  portaria: 'Portaria',
}

export const ROLE_DESCRICAO: Record<Role, string> = {
  admin: 'Acesso total, incluindo configurações e equipe',
  gestor_producao: 'Cadastros, ordens de serviço, estoque e indicadores',
  operador_pintura: 'Kanban de produção e apontamento de etapas',
  qualidade: 'Registro de inspeção, laudos e não conformidades',
  financeiro: 'Contas a receber/pagar, fluxo de caixa e custos',
  portaria: 'Recebimento e devolução de mercadoria em custódia',
}

export type Plano = 'trial' | 'essencial' | 'profissional' | 'enterprise'

export const PLANO_LABEL: Record<Plano, string> = {
  trial: 'Trial',
  essencial: 'Essencial',
  profissional: 'Profissional',
  enterprise: 'Enterprise',
}

export interface Tenant {
  id: string
  razao_social: string
  nome_fantasia: string
  cnpj: string
  plano: Plano
  created_at: string
}

/** Vínculo pendente = convite enviado, usuário ainda não aceitou. */
export type VinculoStatus = 'ativo' | 'pendente' | 'inativo'

export interface UserRole {
  id: string
  user_id: string
  tenant_id: string
  role: Role
  status: VinculoStatus
  created_at: string
}

export interface AppUser {
  id: string
  email: string
  nome: string
}

/** Tenant + papel do usuário logado naquele tenant, já resolvido para a UI. */
export interface TenantVinculo {
  tenant: Tenant
  role: Role
  status: VinculoStatus
}

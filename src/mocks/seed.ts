import type { AppUser, Tenant, UserRole } from '@/types/domain'

/**
 * Dados mockados da Fase 0. Substituídos pelo Supabase quando o backend entrar —
 * os IDs abaixo são uuids fixos para que o seed SQL e o mock do frontend batam.
 *
 * Dois tenants (matriz + filial) em vez de um: é o mínimo para exercitar o seletor
 * de tenant ativo exigido pelo requisito multi-CNPJ.
 */

export const TENANTS: Tenant[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    razao_social: 'Metalcor Pintura Eletrostática Ltda',
    nome_fantasia: 'Metalcor Matriz',
    cnpj: '18452093000150',
    plano: 'profissional',
    created_at: '2024-03-11T13:20:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    razao_social: 'Metalcor Acabamentos Industriais Ltda',
    nome_fantasia: 'Metalcor Filial Sul',
    cnpj: '18452093000231',
    plano: 'essencial',
    created_at: '2025-01-28T10:05:00.000Z',
  },
]

export const USERS: AppUser[] = [
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    email: 'marina@metalcor.com.br',
    nome: 'Marina Alcântara',
  },
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000002',
    email: 'rogerio@metalcor.com.br',
    nome: 'Rogério Tavares',
  },
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000003',
    email: 'cleiton@metalcor.com.br',
    nome: 'Cleiton Barros',
  },
]

export const USER_ROLES: UserRole[] = [
  // Admin com acesso aos dois CNPJs — exercita o seletor de tenant.
  {
    id: 'bbbbbbbb-0000-4000-8000-000000000001',
    user_id: USERS[0].id,
    tenant_id: TENANTS[0].id,
    role: 'admin',
    status: 'ativo',
    created_at: '2024-03-11T13:20:00.000Z',
  },
  {
    id: 'bbbbbbbb-0000-4000-8000-000000000002',
    user_id: USERS[0].id,
    tenant_id: TENANTS[1].id,
    role: 'admin',
    status: 'ativo',
    created_at: '2025-01-28T10:05:00.000Z',
  },
  {
    id: 'bbbbbbbb-0000-4000-8000-000000000003',
    user_id: USERS[1].id,
    tenant_id: TENANTS[0].id,
    role: 'gestor_producao',
    status: 'ativo',
    created_at: '2024-04-02T11:00:00.000Z',
  },
  {
    id: 'bbbbbbbb-0000-4000-8000-000000000004',
    user_id: USERS[2].id,
    tenant_id: TENANTS[0].id,
    role: 'portaria',
    status: 'ativo',
    created_at: '2024-06-19T08:30:00.000Z',
  },
]

/** Convite aberto, para a tela de Configurações > Equipe ter estado "pendente". */
export const CONVITES_PENDENTES: Array<UserRole & { email: string }> = [
  {
    id: 'bbbbbbbb-0000-4000-8000-000000000005',
    user_id: 'aaaaaaaa-0000-4000-8000-000000000009',
    tenant_id: TENANTS[0].id,
    role: 'qualidade',
    status: 'pendente',
    created_at: '2025-09-02T14:45:00.000Z',
    email: 'patricia.lima@metalcor.com.br',
  },
]

/** Senha única de demonstração enquanto o Supabase Auth não está conectado. */
export const DEMO_PASSWORD = 'appintura'

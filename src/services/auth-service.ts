import { DEMO_PASSWORD, TENANTS, USER_ROLES, USERS } from '@/mocks/seed'
import type { AppUser, TenantVinculo } from '@/types/domain'

/**
 * Contrato de autenticação. A implementação atual é um mock em localStorage;
 * ao conectar o Supabase, crie `supabase-auth-service.ts` implementando esta mesma
 * interface (signIn -> supabase.auth.signInWithPassword, getVinculos -> select em
 * user_roles) e troque apenas o export no final deste arquivo.
 */
export interface AuthService {
  getSession(): Promise<AppUser | null>
  signIn(email: string, senha: string): Promise<AppUser>
  signOut(): Promise<void>
  /** Tenants aos quais o usuário tem vínculo ativo, com o papel em cada um. */
  getVinculos(userId: string): Promise<TenantVinculo[]>
}

export class AuthError extends Error {}

const SESSION_KEY = 'appintura.session.user_id'
const LATENCIA_MS = 350

function delay<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

const mockAuthService: AuthService = {
  async getSession() {
    const userId = localStorage.getItem(SESSION_KEY)

    if (!userId) return null

    return USERS.find((user) => user.id === userId) ?? null
  },

  async signIn(email, senha) {
    await delay(null)

    const user = USERS.find(
      (candidato) => candidato.email.toLowerCase() === email.trim().toLowerCase(),
    )

    // Mensagem genérica de propósito: não revelar se o e-mail existe.
    if (!user || senha !== DEMO_PASSWORD) {
      throw new AuthError('E-mail ou senha inválidos.')
    }

    const vinculos = USER_ROLES.filter(
      (vinculo) => vinculo.user_id === user.id && vinculo.status === 'ativo',
    )

    if (vinculos.length === 0) {
      throw new AuthError(
        'Seu usuário não está vinculado a nenhuma empresa. Fale com o administrador.',
      )
    }

    localStorage.setItem(SESSION_KEY, user.id)

    return user
  },

  async signOut() {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem('appintura.tenant_ativo')
  },

  async getVinculos(userId) {
    const vinculos = USER_ROLES.filter(
      (vinculo) => vinculo.user_id === userId && vinculo.status === 'ativo',
    )

    return vinculos.flatMap((vinculo) => {
      const tenant = TENANTS.find((item) => item.id === vinculo.tenant_id)

      if (!tenant) return []

      return [{ tenant, role: vinculo.role, status: vinculo.status }]
    })
  },
}

export const authService: AuthService = mockAuthService

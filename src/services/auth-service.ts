import {
  CHAVE_ANON_PUBLICA,
  definirToken,
  supabase,
  tokenArmazenado,
  urlFuncao,
} from '@/lib/supabase'
import type { AppUser, Role, TenantVinculo, VinculoStatus } from '@/types/domain'

/**
 * Autenticação do APPintura.
 *
 * Não usa Supabase Auth: o `auth.users` deste servidor é um pool compartilhado
 * com aperp, apfiscal e apticket, então quem se cadastra em qualquer um deles
 * seria identidade válida aqui. A identidade é `appintura2.usuarios`, e o token
 * é emitido pela Edge Function `appintura2-sessao-login`.
 */
export interface AuthService {
  getSession(): Promise<AppUser | null>
  signIn(email: string, senha: string): Promise<AppUser>
  signOut(): Promise<void>
  /** Tenants aos quais o usuário tem vínculo ativo, com o papel em cada um. */
  getVinculos(userId: string): Promise<TenantVinculo[]>
}

export class AuthError extends Error {}

interface RespostaLogin {
  access_token: string
  expires_at: number
  usuario: { id: string; email: string; nome: string }
  erro?: string
}

async function buscarUsuario(userId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nome')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null

  return data as AppUser
}

/**
 * Lê o `sub` do JWT sem verificar assinatura.
 *
 * É seguro porque não decide nada: serve só para saber por qual id perguntar.
 * Quem valida o token é o PostgREST, e a consulta seguinte volta vazia se ele
 * não prestar — nenhuma tela é liberada com base nisto.
 */
function usuarioDoToken(token: string): string | null {
  try {
    const corpo = token.split('.')[1]
    const json = atob(corpo.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as { sub?: string; exp?: number }

    if (!claims.sub) return null
    if (claims.exp && claims.exp <= Math.floor(Date.now() / 1000)) return null

    return claims.sub
  } catch {
    return null
  }
}

const supabaseAuthService: AuthService = {
  async getSession() {
    const token = tokenArmazenado()

    if (!token) return null

    const userId = usuarioDoToken(token)

    if (!userId) {
      definirToken(null)
      return null
    }

    const usuario = await buscarUsuario(userId)

    // Token válido no formato mas recusado pelo banco (revogado, usuário
    // desativado, segredo trocado): a sessão não existe mais.
    if (!usuario) definirToken(null)

    return usuario
  },

  async signIn(email, senha) {
    let resposta: Response

    try {
      resposta = await fetch(urlFuncao('sessao-login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CHAVE_ANON_PUBLICA,
        },
        body: JSON.stringify({ email, senha }),
      })
    } catch {
      throw new AuthError('Não foi possível falar com o servidor. Verifique sua conexão.')
    }

    const corpo = (await resposta.json().catch(() => null)) as RespostaLogin | null

    if (!resposta.ok || !corpo?.access_token) {
      // A função devolve a mesma mensagem para e-mail inexistente, senha errada
      // e usuário inativo — não repassar detalhe que ela não deu.
      throw new AuthError(corpo?.erro ?? 'E-mail ou senha inválidos.')
    }

    definirToken(corpo.access_token)

    const vinculos = await this.getVinculos(corpo.usuario.id)

    if (vinculos.length === 0) {
      // Sem vínculo ativo o usuário entraria num app vazio, sem entender por
      // quê: o RLS filtraria tudo. Melhor recusar com a causa.
      definirToken(null)
      throw new AuthError(
        'Seu usuário não está vinculado a nenhuma empresa. Fale com o administrador.',
      )
    }

    const usuario = await buscarUsuario(corpo.usuario.id)

    if (!usuario) {
      definirToken(null)
      throw new AuthError('Não foi possível carregar seu perfil.')
    }

    return usuario
  },

  async signOut() {
    definirToken(null)
    localStorage.removeItem('appintura.tenant_ativo')
  },

  async getVinculos(userId) {
    // O embed traz o tenant junto: uma requisição em vez de N+1.
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, status, tenant:tenants(*)')
      .eq('user_id', userId)
      .eq('status', 'ativo')

    if (error) throw new AuthError('Não foi possível carregar suas empresas.')

    type Linha = {
      role: Role
      status: VinculoStatus
      tenant: TenantVinculo['tenant'] | null
    }

    return ((data ?? []) as unknown as Linha[]).flatMap((linha) =>
      linha.tenant ? [{ tenant: linha.tenant, role: linha.role, status: linha.status }] : [],
    )
  },
}

export const authService: AuthService = supabaseAuthService

import { createClient } from '@supabase/supabase-js'

/**
 * Client do Supabase.
 *
 * Duas configurações aqui não são preferência, são obrigatórias:
 *
 * 1. `db.schema: 'appintura2'` — este Supabase é compartilhado com aperp,
 *    apfiscal e apticket, e o aperp ocupa o schema `public`, onde já existem
 *    `tenants`, `user_roles`, `clientes` e `ordens_servico` com os mesmos nomes
 *    dos nossos. Sem esta linha as consultas caem lá e leem/gravam dados de
 *    outro produto SEM ERRO NENHUM, porque as tabelas existem.
 *
 * 2. `auth` desligado — o APPintura não usa GoTrue (aquele `auth.users` é um
 *    pool comum a todos os produtos do servidor). O token vem da Edge Function
 *    `appintura2-sessao-login` e é injetado pelo `fetch` abaixo.
 */

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL
const CHAVE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!URL_SUPABASE || !CHAVE_ANON) {
  // Falha na carga do módulo, de propósito: sem isto o erro apareceria só na
  // primeira consulta, como um 401 confuso.
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. ' +
      'No Dokploy elas vão em Build Args (não em variáveis de ambiente do ' +
      'serviço): o Vite as resolve em tempo de build.',
  )
}

/**
 * Token da sessão, em memória.
 *
 * A alternativa seria recriar o client a cada login, mas aí qualquer módulo que
 * tenha importado `supabase` continuaria com a instância antiga e sem token.
 */
let tokenAtual: string | null = null

const CHAVE_TOKEN = 'appintura2.access_token'

export function definirToken(token: string | null): void {
  tokenAtual = token

  try {
    if (token) localStorage.setItem(CHAVE_TOKEN, token)
    else localStorage.removeItem(CHAVE_TOKEN)
  } catch {
    // Modo privado / storage bloqueado: a sessão vale só para esta aba.
  }
}

export function tokenArmazenado(): string | null {
  if (tokenAtual) return tokenAtual

  try {
    tokenAtual = localStorage.getItem(CHAVE_TOKEN)
  } catch {
    tokenAtual = null
  }

  return tokenAtual
}

/**
 * `fetch` que carimba o token vigente em toda requisição.
 *
 * Lê `tokenAtual` na hora da chamada, e não na criação do client — é o que
 * permite login e logout sem recriar nada.
 */
function fetchComToken(entrada: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const token = tokenArmazenado()

  if (token) headers.set('Authorization', `Bearer ${token}`)

  return fetch(entrada, { ...init, headers })
}

export const supabase = createClient(URL_SUPABASE, CHAVE_ANON, {
  db: { schema: 'appintura2' },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchComToken },
})

/** URL de uma Edge Function nossa. O prefixo evita colisão no runtime compartilhado. */
export function urlFuncao(nome: string): string {
  return `${URL_SUPABASE}/functions/v1/appintura2-${nome}`
}

export const CHAVE_ANON_PUBLICA = CHAVE_ANON

/**
 * Erro do PostgREST traduzido para mensagem de tela.
 *
 * `PGRST116` é "nenhuma linha" — com RLS ligado ele significa, na prática,
 * "não existe OU não é sua", e as duas devem dar a mesma resposta.
 */
export class SupabaseError extends Error {
  readonly codigo?: string

  constructor(mensagem: string, codigo?: string) {
    super(mensagem)
    this.codigo = codigo
  }
}

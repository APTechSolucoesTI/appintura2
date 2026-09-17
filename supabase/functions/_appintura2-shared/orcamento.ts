/**
 * Utilidades compartilhadas pelas funções de orçamento.
 */

const encoder = new TextEncoder()

/**
 * sha-256 em hex.
 *
 * O banco guarda só este hash. Se o dump vazar, os links não viram chave de
 * acesso — mesmo raciocínio de senha.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Token opaco de 32 bytes.
 *
 * Nunca o id sequencial do orçamento na URL: com `ORC-000123` qualquer um
 * enumera a carteira de clientes da empresa trocando o número.
 */
export function gerarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))

  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * IP de origem atrás do proxy.
 *
 * O primeiro da lista em `x-forwarded-for` é o cliente; os demais são saltos.
 * Vale para auditoria, não para autorização — o header é falsificável.
 */
export function ipDaRequisicao(req: Request): string {
  const encaminhado = req.headers.get('x-forwarded-for')

  if (encaminhado) return encaminhado.split(',')[0].trim().slice(0, 64)

  return (req.headers.get('x-real-ip') ?? '').slice(0, 64)
}

export function userAgentDaRequisicao(req: Request): string {
  return (req.headers.get('user-agent') ?? '').slice(0, 512)
}

/**
 * Freio de força bruta, em memória do isolate.
 *
 * Não substitui um rate limit de verdade no proxy: o isolate recicla e a
 * contagem zera. Segura a tentativa trivial de varrer tokens, que é o ataque
 * que essa rota atrai.
 */
const tentativas = new Map<string, { contador: number; janela: number }>()

export function excedeuLimite(chave: string, maximo = 20, janelaMs = 60_000): boolean {
  const agora = Date.now()
  const atual = tentativas.get(chave)

  if (!atual || agora - atual.janela > janelaMs) {
    tentativas.set(chave, { contador: 1, janela: agora })
    return false
  }

  atual.contador += 1

  return atual.contador > maximo
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** Token válido é hex de 64 caracteres. Rejeitar antes de tocar no banco. */
export function tokenValido(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[0-9a-f]{64}$/.test(valor)
}

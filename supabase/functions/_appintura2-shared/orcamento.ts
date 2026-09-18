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
 * Freio de força bruta.
 *
 * A contagem vive no BANCO, não na memória do isolate: o runtime recicla a
 * qualquer momento e cada isolate contava o seu, então o limite anterior
 * segurava a tentativa distraída e mais nada.
 *
 * Falha ABERTO de propósito. Se o banco não responder, a alternativa seria
 * recusar todo mundo — e aí uma indisponibilidade do Postgres derrubaria
 * também o portal de aprovação, que é o que o cliente usa.
 */
export async function excedeuLimite(
  supabase: { rpc: (nome: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  chave: string,
  limite = 20,
  janelaSegundos = 60,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('excedeu_limite', {
    p_chave: chave,
    p_limite: limite,
    p_janela_segundos: janelaSegundos,
  })

  if (error) {
    console.error('rate limit indisponivel', error)
    return false
  }

  return data === true
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

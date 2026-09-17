/**
 * Edge Function: appintura2-orcamento-link
 *
 * Gera o link público de aprovação de um orçamento.
 *
 * O token em claro existe UMA vez: nesta resposta. O banco recebe só o hash,
 * então nem um dump nem os logs do Postgres permitem reconstruir a URL.
 *
 * Exige usuário autenticado — quem valida o papel é a própria RPC, sob o JWT do
 * chamador, para a regra viver num lugar só.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

import { segredoJwt, tokenDoHeader, verificarToken } from '../_appintura2-shared/jwt.ts'
import { CORS, gerarToken, hashToken, json } from '../_appintura2-shared/orcamento.ts'

interface Payload {
  orcamento_id: string
  dias_validade?: number
}

function validar(corpo: unknown): Payload | null {
  if (typeof corpo !== 'object' || corpo === null) return null

  const { orcamento_id, dias_validade } = corpo as Record<string, unknown>

  if (typeof orcamento_id !== 'string' || !/^[0-9a-f-]{36}$/.test(orcamento_id)) return null
  if (dias_validade !== undefined && typeof dias_validade !== 'number') return null

  return { orcamento_id, dias_validade }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405)

  const token = tokenDoHeader(req.headers.get('Authorization'))

  if (!token) return json({ erro: 'Não autenticado.' }, 401)

  const claims = await verificarToken(token, segredoJwt())

  if (!claims) return json({ erro: 'Sessão inválida ou expirada.' }, 401)

  const payload = validar(await req.json().catch(() => null))

  if (!payload) return json({ erro: 'Payload inválido.' }, 400)

  const tokenPublico = gerarToken()
  const hash = await hashToken(tokenPublico)

  // Cliente com o JWT do vendedor: `registrar_link_orcamento` checa o papel e a
  // empresa. Usar service_role aqui deixaria qualquer usuário gerar link do
  // orçamento de outra empresa.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      db: { schema: 'appintura2' },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  )

  const { error } = await supabase.rpc('registrar_link_orcamento', {
    p_orcamento_id: payload.orcamento_id,
    p_token_hash: hash,
    p_dias_validade: payload.dias_validade ?? 15,
  })

  if (error) {
    console.error('falha ao registrar link', error.code)
    return json({ erro: error.message }, error.code === '42501' ? 403 : 400)
  }

  const base = Deno.env.get('APP_PUBLIC_URL') ?? ''

  return json({
    ok: true,
    // O token nunca é logado; só volta no corpo desta resposta.
    url: `${base}/orcamento/${tokenPublico}`,
    token: tokenPublico,
  })
})

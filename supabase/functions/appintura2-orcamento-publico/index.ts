/**
 * Edge Function: appintura2-orcamento-publico
 *
 * O que o cliente sem conta enxerga. Recebe o token em claro, calcula o hash e
 * pede à RPC os campos seguros.
 *
 * Usa service_role internamente e NUNCA a expõe: o cliente só manda o token. A
 * alternativa — abrir uma policy pública em `orcamentos` — deixaria a tabela de
 * negócio acessível ao papel `anon` para sempre.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

import {
  CORS,
  excedeuLimite,
  hashToken,
  ipDaRequisicao,
  json,
  tokenValido,
  userAgentDaRequisicao,
} from '../_appintura2-shared/orcamento.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405)

  const ip = ipDaRequisicao(req)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { db: { schema: 'appintura2' } },
  )

  // O contador vive no banco, então o cliente precisa existir antes da checagem.
  if (await excedeuLimite(supabase, `ver:${ip}`)) {
    return json({ ok: false, motivo: 'muitas_tentativas' }, 429)
  }

  const corpo = (await req.json().catch(() => null)) as { token?: unknown } | null

  // Formato conferido antes de tocar no banco: varredura de token nem chega a
  // consumir conexão do Postgres.
  if (!corpo || !tokenValido(corpo.token)) {
    return json({ ok: false, motivo: 'indisponivel' }, 404)
  }

  const { data, error } = await supabase.rpc('consultar_orcamento_publico', {
    p_token_hash: await hashToken(corpo.token),
    p_ip: ip,
    p_user_agent: userAgentDaRequisicao(req),
  })

  if (error) {
    console.error('falha na consulta pública', error.code)
    return json({ ok: false, motivo: 'indisponivel' }, 500)
  }

  const resposta = data as { ok: boolean }

  // Motivo genérico e status 404: o portal não distingue "não existe" de
  // "revogado" ou "expirado", senão vira oráculo para sondar tokens.
  if (!resposta?.ok) return json({ ok: false, motivo: 'indisponivel' }, 404)

  return json(resposta)
})

/**
 * Edge Function: sessao-login
 *
 * Troca e-mail + senha por um JWT de sessão. É o substituto do
 * `supabase.auth.signInWithPassword()` — o APPintura tem identidade própria
 * (`appintura2.usuarios`) e não usa o GoTrue, que neste servidor é compartilhado
 * com os outros produtos.
 *
 * Roda com service_role porque `appintura2.autenticar()` está revogada de
 * anon/authenticated: se ela fosse chamável direto da API, a rota viraria um
 * oráculo de força bruta com o PostgREST fazendo o trabalho.
 *
 * O token devolvido vai no header das chamadas seguintes:
 *   createClient(URL, ANON_KEY, {
 *     db: { schema: 'appintura2' },
 *     global: { headers: { Authorization: `Bearer ${access_token}` } },
 *   })
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

import { assinarToken, segredoJwt } from '../_appintura2-shared/jwt.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 8 horas: um turno de fábrica. Quem entra na portaria às 7h não deve ser
// deslogado no meio do expediente.
const DURACAO_SESSAO_SEGUNDOS = 8 * 60 * 60

interface LoginPayload {
  email: string
  senha: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function validar(payload: unknown): LoginPayload | null {
  if (typeof payload !== 'object' || payload === null) return null

  const { email, senha } = payload as Record<string, unknown>

  if (typeof email !== 'string' || typeof senha !== 'string') return null
  if (email.trim() === '' || senha === '') return null

  return { email: email.trim(), senha }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405)

  const payload = validar(await req.json().catch(() => null))

  if (!payload) return json({ erro: 'Informe e-mail e senha.' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { db: { schema: 'appintura2' } },
  )

  const { data, error } = await admin.rpc('autenticar', {
    p_email: payload.email,
    p_senha: payload.senha,
  })

  if (error) {
    console.error('falha ao autenticar', error.message)
    return json({ erro: 'Não foi possível entrar agora.' }, 500)
  }

  const usuario = Array.isArray(data) ? data[0] : data

  // `autenticar` devolve zero linhas para e-mail inexistente, senha errada e
  // usuário inativo. A resposta é a mesma nos três casos de propósito.
  if (!usuario) {
    return json({ erro: 'E-mail ou senha inválidos.' }, 401)
  }

  const { token, expiraEm } = await assinarToken(
    { sub: usuario.usuario_id, email: usuario.email, nome: usuario.nome },
    segredoJwt(),
    DURACAO_SESSAO_SEGUNDOS,
  )

  return json({
    access_token: token,
    token_type: 'bearer',
    expires_at: expiraEm,
    usuario: {
      id: usuario.usuario_id,
      email: usuario.email,
      nome: usuario.nome,
    },
  })
})

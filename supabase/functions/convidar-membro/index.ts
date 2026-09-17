/**
 * Edge Function: convidar-membro (STUB parcial — Fase 0)
 *
 * Cria o usuário (se ainda não existir), o vínculo pendente em `user_roles` e
 * dispararia o e-mail de convite. O ENVIO real ainda NÃO está integrado: o
 * ponto de integração está marcado com TODO no final.
 *
 * Sem GoTrue, o convite deixou de ser `auth.admin.inviteUserByEmail()`: o
 * usuário nasce aqui com uma senha aleatória que ninguém conhece — nem quem
 * convidou — e o e-mail de convite é o único caminho para definir a senha real.
 *
 * Roda com service_role (precisa criar usuário e vínculo), então a autorização
 * do chamador é verificada à mão ANTES de qualquer escrita.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

import { segredoJwt, tokenDoHeader, verificarToken } from '../_shared/jwt.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROLES_VALIDOS = [
  'admin',
  'gestor_producao',
  'operador_pintura',
  'qualidade',
  'financeiro',
  'portaria',
] as const

type Role = (typeof ROLES_VALIDOS)[number]

interface ConvitePayload {
  tenant_id: string
  email: string
  nome: string
  role: Role
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function validar(payload: unknown): ConvitePayload | null {
  if (typeof payload !== 'object' || payload === null) return null

  const { tenant_id, email, nome, role } = payload as Record<string, unknown>

  if (typeof tenant_id !== 'string' || typeof email !== 'string') return null
  if (typeof nome !== 'string' || nome.trim() === '') return null
  if (typeof role !== 'string' || !ROLES_VALIDOS.includes(role as Role)) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null

  return {
    tenant_id,
    email: email.trim().toLowerCase(),
    nome: nome.trim(),
    role: role as Role,
  }
}

/**
 * Senha descartável para o usuário recém-criado.
 *
 * Não é mostrada a ninguém: existe só para satisfazer o NOT NULL de
 * `senha_hash` enquanto o convite não é aceito. Quem define a senha de verdade
 * é o próprio convidado, pelo link do e-mail.
 */
function senhaDescartavel(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405)

  const authorization = req.headers.get('Authorization')
  const token = tokenDoHeader(authorization)

  if (!token) return json({ erro: 'Não autenticado.' }, 401)

  // Validação local do JWT (assinatura + exp). Substitui `auth.getUser()`,
  // que falava com o GoTrue.
  const claims = await verificarToken(token, segredoJwt())

  if (!claims) return json({ erro: 'Sessão inválida ou expirada.' }, 401)

  const payload = validar(await req.json().catch(() => null))

  if (!payload) return json({ erro: 'Payload inválido.' }, 400)

  // Cliente com o JWT do chamador: a checagem de papel passa pelo RLS, não pela
  // nossa palavra. Sem ela, a service_role abaixo deixaria qualquer usuário
  // criar vínculo em qualquer empresa.
  const clienteUsuario = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      db: { schema: 'appintura2' },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  )

  const { data: ehAdmin, error: erroRole } = await clienteUsuario.rpc('has_role', {
    role_name: 'admin',
    tenant_id: payload.tenant_id,
  })

  if (erroRole) return json({ erro: 'Falha ao verificar permissão.' }, 500)
  if (!ehAdmin) return json({ erro: 'Apenas administradores podem convidar.' }, 403)

  const clienteAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { db: { schema: 'appintura2' } },
  )

  // O convidado pode já existir — é o caso de quem trabalha em duas filiais,
  // que são tenants distintos. Reaproveitar a identidade é o certo aqui;
  // criar uma segunda esbarraria no índice único de e-mail.
  const { data: existente, error: erroBusca } = await clienteAdmin
    .from('usuarios')
    .select('id')
    .eq('email', payload.email)
    .maybeSingle()

  if (erroBusca) return json({ erro: 'Falha ao consultar usuário.' }, 500)

  let usuarioId = existente?.id as string | undefined

  if (!usuarioId) {
    const { data: criado, error: erroCriacao } = await clienteAdmin.rpc('criar_usuario', {
      p_email: payload.email,
      p_senha: senhaDescartavel(),
      p_nome: payload.nome,
    })

    if (erroCriacao || !criado) {
      console.error('falha ao criar usuário', erroCriacao?.message)
      return json({ erro: 'Não foi possível criar o usuário.' }, 500)
    }

    usuarioId = criado as string
  }

  const { error: erroVinculo } = await clienteAdmin.from('user_roles').insert({
    user_id: usuarioId,
    tenant_id: payload.tenant_id,
    role: payload.role,
    status: 'pendente',
  })

  if (erroVinculo) {
    // 23505 = unique_violation: já existe vínculo desta pessoa com esta empresa.
    if (erroVinculo.code === '23505') {
      return json({ erro: 'Este usuário já faz parte da empresa.' }, 409)
    }
    return json({ erro: 'Não foi possível registrar o vínculo.' }, 500)
  }

  // TODO(Fase 6): disparar o e-mail de convite com um link de definição de
  // senha (token de uso único, curta validade), pelo provedor definido
  // (Resend/SES), com template da marca AP e registro em `notificacoes`.
  // Enquanto isso não existe, o convidado NÃO consegue entrar: a senha gerada
  // acima é aleatória e não foi guardada em lugar nenhum.
  console.info('convite registrado', {
    tenant_id: payload.tenant_id,
    role: payload.role,
    convidado_por: claims.sub,
  })

  return json({ ok: true, user_id: usuarioId }, 201)
})

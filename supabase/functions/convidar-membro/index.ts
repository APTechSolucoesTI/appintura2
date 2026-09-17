/**
 * Edge Function: convidar-membro (STUB — Fase 0)
 *
 * Cria o vínculo pendente em `user_roles` e dispararia o e-mail de convite.
 * O envio real ainda NÃO está integrado: o ponto de integração está marcado
 * com TODO no final.
 *
 * Roda com service_role de propósito (precisa inserir vínculo para um usuário
 * que ainda não existe), então a autorização do chamador é verificada à mão
 * antes de qualquer escrita.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

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

  const { tenant_id, email, role } = payload as Record<string, unknown>

  if (typeof tenant_id !== 'string' || typeof email !== 'string') return null
  if (typeof role !== 'string' || !ROLES_VALIDOS.includes(role as Role)) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null

  return { tenant_id, email: email.trim().toLowerCase(), role: role as Role }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405)

  const authorization = req.headers.get('Authorization')

  if (!authorization) return json({ erro: 'Não autenticado.' }, 401)

  const payload = validar(await req.json().catch(() => null))

  if (!payload) return json({ erro: 'Payload inválido.' }, 400)

  // Cliente com o JWT do chamador: respeita RLS e resolve quem está pedindo.
  const clienteUsuario = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  )

  const { data: sessao } = await clienteUsuario.auth.getUser()

  if (!sessao.user) return json({ erro: 'Não autenticado.' }, 401)

  // Só admin DAQUELE tenant convida. Sem esta checagem, a service_role abaixo
  // permitiria a qualquer usuário criar vínculo em qualquer empresa.
  const { data: ehAdmin, error: erroRole } = await clienteUsuario.rpc('has_role', {
    role_name: 'admin',
    tenant_id: payload.tenant_id,
  })

  if (erroRole) return json({ erro: 'Falha ao verificar permissão.' }, 500)
  if (!ehAdmin) return json({ erro: 'Apenas administradores podem convidar.' }, 403)

  const clienteAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: convite, error: erroConvite } =
    await clienteAdmin.auth.admin.inviteUserByEmail(payload.email)

  if (erroConvite || !convite.user) {
    return json({ erro: 'Não foi possível gerar o convite.' }, 500)
  }

  const { error: erroVinculo } = await clienteAdmin.from('user_roles').insert({
    user_id: convite.user.id,
    tenant_id: payload.tenant_id,
    role: payload.role,
    status: 'pendente',
  })

  if (erroVinculo) {
    return json({ erro: 'Não foi possível registrar o vínculo.' }, 500)
  }

  // TODO(Fase 6): substituir o e-mail padrão do Supabase por um template da marca
  // AP, disparado pelo provedor definido (Resend/SES) e registrado em notificacoes.
  console.info('convite registrado', {
    tenant_id: payload.tenant_id,
    role: payload.role,
  })

  return json({ ok: true, user_id: convite.user.id }, 201)
})

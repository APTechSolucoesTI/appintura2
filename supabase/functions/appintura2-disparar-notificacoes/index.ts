/**
 * Edge Function: disparar-notificacoes (STUB — Fase 6)
 *
 * Ponto ÚNICO de saída das notificações para canais externos (APChat/WhatsApp,
 * e-mail). Nenhum canal está integrado: o envio está marcado com TODO.
 *
 * Existe separada do banco de propósito. As triggers e o job de `pg_cron` criam
 * a linha em `notificacoes`; esta função decide o que sai para fora e por qual
 * canal. Assim, ligar o WhatsApp depois não exige mexer em trigger nenhuma.
 *
 * Uso previsto:
 *   - Agendado (pg_cron -> net.http_post) para o lote diário.
 *   - Chamado pelo app quando o usuário pede reenvio manual.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Só estes tipos justificam incomodar alguém fora do sistema. */
const TIPOS_EXTERNOS = [
  'os_aguardando_retirada',
  'devolucao_disponivel',
  'titulo_vencendo',
] as const

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405)

  const corpo = (await req.json().catch(() => null)) as {
    tenant_id?: string
    notificacao_ids?: string[]
  } | null

  if (!corpo?.tenant_id) return json({ erro: 'Informe tenant_id.' }, 400)

  // Roda como job de fundo, sem usuário logado, então usa service_role. O
  // escopo é limitado à mão pelo filtro de tenant_id abaixo.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { db: { schema: 'appintura2' } },
  )

  let consulta = supabase
    .from('notificacoes')
    .select('id, tipo, titulo, descricao, link, created_at')
    .eq('tenant_id', corpo.tenant_id)
    .eq('lida', false)
    .in('tipo', TIPOS_EXTERNOS)

  if (corpo.notificacao_ids?.length) {
    consulta = consulta.in('id', corpo.notificacao_ids)
  }

  const { data: pendentes, error } = await consulta

  if (error) return json({ erro: 'Falha ao carregar notificações.' }, 500)

  // TODO(integração): enviar cada item pelo canal configurado do tenant
  // (APChat/WhatsApp Business, e-mail) e gravar o retorno numa tabela de
  // entregas. Enquanto o canal não existe, a resposta é explicitamente um stub
  // para ninguém tratar como mensagem enviada.
  console.info('[stub] disparar-notificacoes', {
    tenant_id: corpo.tenant_id,
    pendentes: pendentes?.length ?? 0,
  })

  return json({
    stub: true,
    mensagem:
      'Nenhum canal externo integrado. Nada foi enviado ao cliente — as notificações continuam só na central interna.',
    pendentes: pendentes ?? [],
  })
})

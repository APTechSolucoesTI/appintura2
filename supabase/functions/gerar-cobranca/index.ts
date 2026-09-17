/**
 * Edge Function: gerar-cobranca (STUB — Fase 5)
 *
 * Geraria o boleto ou o link de pagamento de um título e devolveria a URL.
 * Nenhum gateway está integrado: o ponto de integração está marcado com TODO.
 *
 * Roda server-side de propósito. A chave do gateway (Asaas, Gerencianet, Pagar.me)
 * NUNCA pode ir para o client — quem tem a chave emite cobrança em nome da
 * empresa.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FORMAS = ['boleto', 'pix'] as const
type Forma = (typeof FORMAS)[number]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405)

  const authorization = req.headers.get('Authorization')

  if (!authorization) return json({ erro: 'Não autenticado.' }, 401)

  const corpo = (await req.json().catch(() => null)) as {
    conta_receber_id?: string
    forma?: string
  } | null

  if (
    !corpo?.conta_receber_id ||
    !FORMAS.includes(corpo.forma as Forma)
  ) {
    return json({ erro: 'Informe conta_receber_id e forma (boleto ou pix).' }, 400)
  }

  // Cliente com o JWT do chamador: a RLS de contas_receber é quem decide se esta
  // pessoa pode enxergar o título. Nada de service_role aqui.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      db: { schema: 'appintura2' },
      global: { headers: { Authorization: authorization } },
    },
  )

  const { data: conta, error } = await supabase
    .from('vw_contas_receber_saldo')
    .select('id, tenant_id, cliente_id, saldo, vencimento, descricao, status_efetivo')
    .eq('id', corpo.conta_receber_id)
    .maybeSingle()

  if (error) return json({ erro: 'Falha ao carregar o título.' }, 500)
  if (!conta) return json({ erro: 'Título não encontrado.' }, 404)

  if (conta.status_efetivo === 'pago' || conta.status_efetivo === 'cancelado') {
    return json({ erro: 'Este título não está em aberto.' }, 409)
  }

  // TODO(integração): chamar o gateway com a chave de
  // Deno.env.get('GATEWAY_API_KEY'), gravar o id externo em contas_receber e
  // devolver a URL real. Enquanto isso, a resposta é explicitamente um stub para
  // o frontend não tratar como cobrança emitida.
  return json({
    stub: true,
    mensagem:
      'Gateway de pagamento ainda não integrado. Nenhuma cobrança foi emitida.',
    titulo: {
      id: conta.id,
      descricao: conta.descricao,
      saldo: conta.saldo,
      vencimento: conta.vencimento,
      forma: corpo.forma,
    },
  })
})

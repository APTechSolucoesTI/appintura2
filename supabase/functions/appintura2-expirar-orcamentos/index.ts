/**
 * Edge Function: appintura2-expirar-orcamentos (job diário)
 *
 * Varre os orçamentos com validade vencida e ainda em aberto, marca `expirado`
 * e revoga os links pendentes.
 *
 * Por que uma varredura e não só checar na hora do acesso: o caso mais comum de
 * expiração é justamente o orçamento que o cliente NUNCA abriu. Sem o job, ele
 * ficaria eternamente como "enviado" no painel do vendedor.
 *
 * Agendamento (pg_cron já está instalado neste servidor):
 *   select cron.schedule('appintura2-expirar-orcamentos', '0 3 * * *',
 *     $$ select appintura2.expirar_orcamentos() $$);
 *
 * Esta função HTTP existe para disparo manual e para quem preferir agendar por
 * fora do banco.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

import { CORS, json } from '../_appintura2-shared/orcamento.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405)

  // Rota administrativa: exige a service_role no header, porque ela muda o
  // status de documentos comerciais em lote.
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const autorizacao = req.headers.get('Authorization') ?? ''

  if (!chave || autorizacao !== `Bearer ${chave}`) {
    return json({ erro: 'Não autorizado.' }, 401)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', chave, {
    db: { schema: 'appintura2' },
  })

  const { data, error } = await supabase.rpc('expirar_orcamentos')

  if (error) {
    console.error('falha ao expirar orçamentos', error.code)
    return json({ erro: 'Não foi possível expirar os orçamentos.' }, 500)
  }

  // TODO(Fase 9): lembrete 2 dias ANTES de vencer, e aviso interno ao vendedor
  // quando o orçamento expirar.
  console.info('orçamentos expirados', { total: data })

  return json({ ok: true, expirados: data })
})

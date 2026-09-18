/**
 * Edge Function: appintura2-orcamento-decisao
 *
 * Registra a decisão do cliente e, quando é aprovação, dispara a conversão em
 * Ordem de Serviço — dentro da mesma transação do banco, para não existir
 * orçamento aprovado pendurado sem OS.
 *
 * A idempotência mora na RPC (`for update` + `usado_em`), não aqui: duplo
 * clique e retry de rede recebem de volta a decisão já registrada, sem gerar
 * uma segunda OS.
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

const DECISOES = ['aprovado', 'rejeitado', 'alteracao_solicitada'] as const

type Decisao = (typeof DECISOES)[number]

interface Payload {
  token: string
  decisao: Decisao
  autor_nome: string
  autor_documento: string
  mensagem: string
  /** Aprovacao parcial: ids aceitos. `null` = aceitou tudo. */
  itens_aprovados: string[] | null
}

/**
 * UUID de verdade, não "36 caracteres do alfabeto certo".
 *
 * A versão anterior era `/^[0-9a-f-]{36}$/`, que aceita 36 hífens: o valor
 * passava daqui, o Postgres recusava com 22P02 e o cliente recebia 500 — ou
 * seja, a resposta que manda tentar de novo para sempre. Ela também rejeitava
 * maiúsculas, que a RFC 4122 considera válidas.
 */
function ehUuid(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
  )
}

/**
 * Teto de itens por decisão.
 *
 * Alto o bastante para nunca estorvar um orçamento real, baixo o bastante para
 * a rota pública não aceitar payload arbitrário. Estourar devolve motivo
 * próprio, e não uma recusa genérica: o cliente precisa saber por que travou.
 */
const LIMITE_ITENS = 500

/** Schema estrito: a superfície pública é o ponto mais sensível do módulo. */
function validar(corpo: unknown): Payload | 'muitos_itens' | null {
  if (typeof corpo !== 'object' || corpo === null) return null

  const { token, decisao, autor_nome, autor_documento, mensagem, itens_aprovados } =
    corpo as Record<string, unknown>

  if (!tokenValido(token)) return null
  if (typeof decisao !== 'string' || !DECISOES.includes(decisao as Decisao)) return null

  const texto = (valor: unknown, limite: number) =>
    typeof valor === 'string' ? valor.trim().slice(0, limite) : ''

  // Lista de itens: ausente/null = aceitou tudo.
  let itens: string[] | null = null

  if (itens_aprovados !== undefined && itens_aprovados !== null) {
    if (!Array.isArray(itens_aprovados)) return null
    if (itens_aprovados.length > LIMITE_ITENS) return 'muitos_itens'
    if (!itens_aprovados.every(ehUuid)) return null

    itens = itens_aprovados as string[]
  }

  return {
    token,
    decisao: decisao as Decisao,
    autor_nome: texto(autor_nome, 200),
    autor_documento: texto(autor_documento, 32),
    mensagem: texto(mensagem, 2000),
    itens_aprovados: itens,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405)

  const ip = ipDaRequisicao(req)

  if (excedeuLimite(`decidir:${ip}`, 10)) {
    return json({ ok: false, motivo: 'muitas_tentativas' }, 429)
  }

  const validado = validar(await req.json().catch(() => null))

  // Lista grande demais tem motivo próprio: "payload_invalido" faria o cliente
  // procurar erro de digitação num problema de tamanho.
  if (validado === 'muitos_itens') {
    return json({ ok: false, motivo: 'muitos_itens' }, 400)
  }

  if (!validado) return json({ ok: false, motivo: 'payload_invalido' }, 400)

  const payload = validado

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { db: { schema: 'appintura2' } },
  )

  const { data, error } = await supabase.rpc('decidir_orcamento_publico', {
    p_token_hash: await hashToken(payload.token),
    p_decisao: payload.decisao,
    p_autor_nome: payload.autor_nome,
    p_autor_documento: payload.autor_documento,
    p_mensagem: payload.mensagem,
    p_ip: ip,
    p_user_agent: userAgentDaRequisicao(req),
    p_itens_aprovados: payload.itens_aprovados,
  })

  if (error) {
    console.error('falha ao registrar decisão', error.code)

    // 22023 vem da guarda que recusa id de item de outro orçamento. É erro do
    // pedido, não do servidor — 500 aqui mandaria o cliente tentar de novo
    // eternamente.
    if (error.code === '22023') {
      return json({ ok: false, motivo: 'itens_invalidos' }, 400)
    }

    return json({ ok: false, motivo: 'falha' }, 500)
  }

  const resposta = data as { ok: boolean; motivo?: string }

  if (!resposta?.ok) {
    // `vencido` e `nome_obrigatorio` são 400 (o cliente pode reagir);
    // `indisponivel` é 404 e não diz o porquê.
    const status = resposta?.motivo === 'indisponivel' ? 404 : 400
    return json(resposta ?? { ok: false, motivo: 'falha' }, status)
  }

  // TODO(Fase 9): notificar o vendedor (in-app + e-mail) via
  // `appintura2-disparar-notificacoes`. Hoje ele descobre pela timeline.
  console.info('decisão registrada', { decisao: payload.decisao })

  return json(resposta)
})

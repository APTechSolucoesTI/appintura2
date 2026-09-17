import { CHAVE_ANON_PUBLICA, supabase, tokenArmazenado, urlFuncao } from '@/lib/supabase'
import type { Orcamento, OrcamentoLink, OrcamentoPublico } from '@/types/orcamento'

import { criarStoreSupabase } from './supabase-store'

/**
 * Serviços do módulo de Orçamento.
 *
 * A leitura passa pelo store genérico com embed dos filhos; a ESCRITA não usa o
 * caminho normal de tabela, porque `orcamentos` não tem policy de INSERT/UPDATE
 * de propósito — as regras de imutabilidade por status vivem nas RPCs. Tentar
 * um `.update()` direto daqui seria barrado pelo RLS, e é exatamente o que
 * queremos.
 */

export class OrcamentoError extends Error {}

export const orcamentosStore = criarStoreSupabase<Orcamento>({
  tabela: 'orcamentos',
  select: '*, itens:orcamento_itens(*), anexos:orcamento_anexos(*)',
  rpcGravar: { nome: 'salvar_orcamento', campoItens: 'itens' },
  // Mais recente primeiro: o vendedor quase sempre quer o que acabou de mexer.
  ordenar: (a, b) => b.numero - a.numero,
})

/** Orçamento com a trilha de eventos, para a tela de detalhe. */
export async function obterComTimeline(
  tenantId: string,
  orcamentoId: string,
): Promise<Orcamento> {
  const { data, error } = await supabase
    .from('orcamentos')
    .select(
      '*, itens:orcamento_itens(*), anexos:orcamento_anexos(*), eventos:orcamento_eventos(*)',
    )
    .eq('tenant_id', tenantId)
    .eq('id', orcamentoId)
    .maybeSingle()

  if (error) throw new OrcamentoError('Não foi possível carregar o orçamento.')
  if (!data) throw new OrcamentoError('Orçamento não encontrado nesta empresa.')

  const orcamento = data as unknown as Orcamento

  return {
    ...orcamento,
    itens: [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem),
    eventos: [...(orcamento.eventos ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
  }
}

/**
 * Gera o link público e devolve a URL pronta para enviar.
 *
 * O token volta UMA vez, nesta resposta. Não há como recuperá-lo depois — se o
 * vendedor perder, gera outro (o anterior é revogado no mesmo ato).
 */
export async function gerarLinkPublico(
  orcamentoId: string,
  diasValidade = 15,
): Promise<{ url: string }> {
  const token = tokenArmazenado()

  if (!token) throw new OrcamentoError('Sessão expirada. Entre novamente.')

  let resposta: Response

  try {
    resposta = await fetch(urlFuncao('orcamento-link'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CHAVE_ANON_PUBLICA,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orcamento_id: orcamentoId, dias_validade: diasValidade }),
    })
  } catch {
    throw new OrcamentoError('Não foi possível falar com o servidor.')
  }

  const corpo = (await resposta.json().catch(() => null)) as
    | { url?: string; erro?: string }
    | null

  if (!resposta.ok || !corpo?.url) {
    throw new OrcamentoError(corpo?.erro ?? 'Não foi possível gerar o link.')
  }

  // A Edge Function só devolve URL absoluta quando `APP_PUBLIC_URL` está
  // definida no servidor. Completar aqui com a origem da própria página é mais
  // robusto: o app sempre sabe em que domínio está sendo servido, e o servidor
  // não precisa saber em quantos domínios ele responde.
  const url = corpo.url.startsWith('http')
    ? corpo.url
    : `${window.location.origin}${corpo.url}`

  return { url }
}

/** Links já emitidos, para a tela mostrar validade e se já foi usado. */
export async function listarLinks(
  tenantId: string,
  orcamentoId: string,
): Promise<OrcamentoLink[]> {
  const { data, error } = await supabase
    .from('orcamento_links')
    .select('id, orcamento_id, expira_em, usado_em, revogado, created_at')
    .eq('tenant_id', tenantId)
    .eq('orcamento_id', orcamentoId)

  if (error) throw new OrcamentoError('Não foi possível carregar os links.')

  return ((data ?? []) as unknown as OrcamentoLink[]).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )
}

/** Cria uma nova versão a partir de um orçamento já enviado. */
export async function revisarOrcamento(orcamentoId: string): Promise<string> {
  const { data, error } = await supabase.rpc('revisar_orcamento', {
    p_orcamento_id: orcamentoId,
  })

  if (error) throw new OrcamentoError(error.message)

  return data as string
}

// ---------------------------------------------------------------------------
// Portal público — sem sessão
//
// Estas duas são as únicas do app que rodam para alguém sem login. Mandam só o
// token; toda a validação acontece do outro lado.
// ---------------------------------------------------------------------------

export async function consultarOrcamentoPublico(
  token: string,
): Promise<OrcamentoPublico | null> {
  try {
    const resposta = await fetch(urlFuncao('orcamento-publico'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CHAVE_ANON_PUBLICA },
      body: JSON.stringify({ token }),
    })

    const corpo = (await resposta.json().catch(() => null)) as OrcamentoPublico | null

    if (!resposta.ok || !corpo?.ok) return null

    return corpo
  } catch {
    return null
  }
}

export type Decisao = 'aprovado' | 'rejeitado' | 'alteracao_solicitada'

export interface ResultadoDecisao {
  ok: boolean
  motivo?: string
  decisao?: string
  numero?: number
  repetido?: boolean
}

export async function decidirOrcamentoPublico(
  token: string,
  decisao: Decisao,
  dados: { autor_nome?: string; autor_documento?: string; mensagem?: string } = {},
): Promise<ResultadoDecisao> {
  try {
    const resposta = await fetch(urlFuncao('orcamento-decisao'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CHAVE_ANON_PUBLICA },
      body: JSON.stringify({
        token,
        decisao,
        autor_nome: dados.autor_nome ?? '',
        autor_documento: dados.autor_documento ?? '',
        mensagem: dados.mensagem ?? '',
      }),
    })

    const corpo = (await resposta.json().catch(() => null)) as ResultadoDecisao | null

    return corpo ?? { ok: false, motivo: 'falha' }
  } catch {
    return { ok: false, motivo: 'rede' }
  }
}

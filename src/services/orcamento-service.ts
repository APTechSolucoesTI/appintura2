import { CHAVE_ANON_PUBLICA, supabase, tokenArmazenado, urlFuncao } from '@/lib/supabase'
import type {
  LinhaChecklistDevolucao,
  LinhaDiff,
  LinhaFunil,
  MotivoRecusa,
  Orcamento,
  OrcamentoLink,
  OrcamentoPublico,
} from '@/types/orcamento'

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

  // A ORIGEM é sempre a desta página, nunca a que o servidor supõe. Só o
  // caminho vem da resposta.
  //
  // A versão anterior confiava na URL absoluta quando o servidor mandava uma, e
  // foi assim que o link chegou quebrado ao cliente: `APP_PUBLIC_URL` estava
  // configurada sem a porta `:75`, então o link apontava para a 443 do IP
  // público, que o roteador não encaminha — o navegador do cliente ficava
  // esperando até dar timeout, sem mensagem nenhuma.
  //
  // O servidor conhece no máximo um domínio; a página sabe de qual ela foi
  // servida. Entre os dois, a página está sempre certa.
  const caminho = corpo.url.startsWith('http')
    ? new URL(corpo.url).pathname
    : corpo.url

  return { url: `${window.location.origin}${caminho}` }
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
  itens_aprovados?: number
  itens_propostos?: number
}

export async function decidirOrcamentoPublico(
  token: string,
  decisao: Decisao,
  dados: {
    autor_nome?: string
    autor_documento?: string
    mensagem?: string
    /** Aprovacao parcial: ids aceitos. Omitir = aceitou tudo. */
    itens_aprovados?: string[]
  } = {},
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
        itens_aprovados: dados.itens_aprovados ?? null,
      }),
    })

    const corpo = (await resposta.json().catch(() => null)) as ResultadoDecisao | null

    return corpo ?? { ok: false, motivo: 'falha' }
  } catch {
    return { ok: false, motivo: 'rede' }
  }
}

// ---------------------------------------------------------------------------
// Fase 4 — anexos e checklist de devolução
// ---------------------------------------------------------------------------

const BUCKET_ANEXOS = 'appintura2-orcamento-anexos'

/**
 * Sobe um anexo e registra a linha.
 *
 * Caminho `{tenant_id}/{orcamento_id}/...` porque a policy de Storage compara
 * exatamente a primeira pasta com os tenants do usuário — o `tenantId` aqui
 * nunca pode vir do formulário.
 */
export async function anexarArquivo(
  tenantId: string,
  orcamentoId: string,
  arquivo: File,
  tipo: 'foto_referencia' | 'desenho_tecnico' | 'outro' = 'foto_referencia',
): Promise<void> {
  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const caminho = `${tenantId}/${orcamentoId}/${crypto.randomUUID()}.${extensao}`

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })

  if (erroUpload) {
    throw new OrcamentoError(`Não foi possível enviar o anexo: ${erroUpload.message}`)
  }

  const { error } = await supabase.from('orcamento_anexos').insert({
    tenant_id: tenantId,
    orcamento_id: orcamentoId,
    storage_path: caminho,
    nome: arquivo.name,
    tipo,
  } as never)

  if (error) {
    throw new OrcamentoError('Arquivo enviado, mas não foi possível registrá-lo.')
  }
}

/** URL temporária: o bucket é privado, um `<img src>` direto receberia 400. */
export async function urlAnexo(caminho: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .createSignedUrl(caminho, 3600)

  return error ? null : data.signedUrl
}

export async function removerAnexo(tenantId: string, anexoId: string): Promise<void> {
  const { error } = await supabase
    .from('orcamento_anexos')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', anexoId)

  if (error) throw new OrcamentoError('Não foi possível remover o anexo.')
}

/** Recebido x devolvido por item, já ligado ao orçamento de origem. */
export async function checklistDevolucao(
  tenantId: string,
  romaneioId: string,
): Promise<LinhaChecklistDevolucao[]> {
  const { data, error } = await supabase
    .from('vw_checklist_devolucao')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('romaneio_id', romaneioId)

  if (error) throw new OrcamentoError('Não foi possível carregar o checklist.')

  return (data ?? []) as unknown as LinhaChecklistDevolucao[]
}

// ---------------------------------------------------------------------------
// Fase 5 — diff de versões e funil
// ---------------------------------------------------------------------------

/** Diferença entre este orçamento e a versão que ele substituiu. */
export async function diffOrcamento(orcamentoId: string): Promise<LinhaDiff[]> {
  const { data, error } = await supabase.rpc('diff_orcamento', {
    p_orcamento_id: orcamentoId,
  })

  if (error) throw new OrcamentoError('Não foi possível comparar as versões.')

  // `igual` não vai para a tela: o que interessa numa revisão é o que MUDOU.
  return ((data ?? []) as LinhaDiff[]).filter((linha) => linha.situacao !== 'igual')
}

export async function funilOrcamentos(tenantId: string): Promise<LinhaFunil[]> {
  const { data, error } = await supabase
    .from('vw_funil_orcamentos')
    .select('*')
    .eq('tenant_id', tenantId)

  if (error) throw new OrcamentoError('Não foi possível carregar o funil.')

  return ((data ?? []) as unknown as LinhaFunil[]).sort((a, b) =>
    b.mes.localeCompare(a.mes),
  )
}

export async function motivosDeRecusa(tenantId: string): Promise<MotivoRecusa[]> {
  const { data, error } = await supabase
    .from('vw_motivos_recusa')
    .select('*')
    .eq('tenant_id', tenantId)

  if (error) throw new OrcamentoError('Não foi possível carregar os motivos.')

  return ((data ?? []) as unknown as MotivoRecusa[]).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )
}

/**
 * Nomes da equipe, para traduzir `vendedor_id` na tela do funil.
 *
 * Sai de `usuarios`, que a policy da Fase 0 já limita a quem divide empresa com
 * você — não vira diretório de todos os usuários do produto.
 */
export async function equipeDoTenant(
  tenantId: string,
): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('usuario:usuarios(id, nome)')
    .eq('tenant_id', tenantId)

  if (error) throw new OrcamentoError('Nao foi possivel carregar a equipe.')

  type Linha = { usuario: { id: string; nome: string } | null }

  return ((data ?? []) as unknown as Linha[]).flatMap((linha) =>
    linha.usuario ? [linha.usuario] : [],
  )
}

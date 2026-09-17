import { supabase } from '@/lib/supabase'
import { subirImagem, subirImagens, UploadError } from '@/lib/storage'
import type {
  RomaneioDevolucao,
  RomaneioRecebimento,
  SaldoCliente,
  SaldoItem,
} from '@/types/custodia'

import { clientesStore } from './cadastros-service'
import { criarStoreSupabase } from './supabase-store'

/**
 * Serviços de custódia (Fase 2).
 *
 * O saldo é calculado a partir dos romaneios, nunca guardado: qualquer número
 * materializado aqui viraria mentira no primeiro romaneio corrigido. Com o
 * Supabase, `calcularSaldoCustodia` vira uma view.
 */

// Mais recente primeiro: a portaria quase sempre quer o último romaneio.
export const recebimentosStore = criarStoreSupabase<RomaneioRecebimento>({
  tabela: 'romaneios_recebimento',
  select: '*, itens:romaneio_recebimento_itens(*), fotos:romaneio_fotos(*)',
  rpcGravar: { nome: 'salvar_recebimento', campoItens: 'itens' },
  ordenar: (a, b) => b.numero - a.numero,
})

export const devolucoesStore = criarStoreSupabase<RomaneioDevolucao>({
  tabela: 'romaneios_devolucao',
  select: '*, itens:romaneio_devolucao_itens(*), fotos:romaneio_fotos(*)',
  rpcGravar: { nome: 'salvar_devolucao', campoItens: 'itens' },
  ordenar: (a, b) => b.numero - a.numero,
})

/**
 * Sequencial por tenant. No Postgres isto vira uma função que faz
 * `max(numero) + 1 where tenant_id = ...` dentro da transação de insert — nunca
 * uma sequence global, que vazaria o volume de uma empresa para outra.
 */
export async function proximoNumeroRecebimento(tenantId: string): Promise<number> {
  const existentes = await recebimentosStore.listar(tenantId)

  return existentes.reduce((maior, item) => Math.max(maior, item.numero), 0) + 1
}

export async function proximoNumeroDevolucao(tenantId: string): Promise<number> {
  const existentes = await devolucoesStore.listar(tenantId)

  return existentes.reduce((maior, item) => Math.max(maior, item.numero), 0) + 1
}

function diasDesde(iso: string, hoje = new Date()): number {
  const inicioDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const entrada = new Date(iso)
  const inicioDaEntrada = new Date(
    entrada.getFullYear(),
    entrada.getMonth(),
    entrada.getDate(),
  )

  return Math.max(
    0,
    Math.round((inicioDeHoje.getTime() - inicioDaEntrada.getTime()) / 86_400_000),
  )
}

/** Quanto já saiu de cada item recebido, somando todas as devoluções. */
async function devolvidoPorItem(tenantId: string): Promise<Map<string, number>> {
  const devolucoes = await devolucoesStore.listar(tenantId)
  const total = new Map<string, number>()

  for (const devolucao of devolucoes) {
    for (const item of devolucao.itens) {
      total.set(
        item.recebimento_item_id,
        (total.get(item.recebimento_item_id) ?? 0) + item.quantidade,
      )
    }
  }

  return total
}

export async function calcularSaldoCustodia(
  tenantId: string,
): Promise<SaldoCliente[]> {
  const [recebimentos, clientes, devolvido] = await Promise.all([
    recebimentosStore.listar(tenantId),
    clientesStore.listar(tenantId),
    devolvidoPorItem(tenantId),
  ])

  const porCliente = new Map<string, SaldoCliente>()

  for (const recebimento of recebimentos) {
    const cliente = clientes.find((item) => item.id === recebimento.cliente_id)

    const atual =
      porCliente.get(recebimento.cliente_id) ??
      ({
        cliente_id: recebimento.cliente_id,
        cliente_nome: cliente?.razao_social ?? 'Cliente removido',
        recebido: 0,
        devolvido: 0,
        saldo: 0,
        dias_mais_antigo: 0,
        itens: [],
      } satisfies SaldoCliente)

    for (const item of recebimento.itens) {
      const saiu = devolvido.get(item.id) ?? 0
      const saldo = item.quantidade - saiu
      const dias = diasDesde(recebimento.data_hora)

      const linha: SaldoItem = {
        recebimento_item_id: item.id,
        recebimento_id: recebimento.id,
        recebimento_numero: recebimento.numero,
        descricao: item.descricao,
        unidade: item.unidade,
        recebido: item.quantidade,
        devolvido: saiu,
        saldo,
        data_entrada: recebimento.data_hora,
        dias_em_custodia: dias,
      }

      atual.itens.push(linha)
      atual.recebido += item.quantidade
      atual.devolvido += saiu
      atual.saldo += saldo

      // Só conta o relógio de item que ainda está no pátio.
      if (saldo > 0) {
        atual.dias_mais_antigo = Math.max(atual.dias_mais_antigo, dias)
      }
    }

    porCliente.set(recebimento.cliente_id, atual)
  }

  return [...porCliente.values()].sort((a, b) => b.saldo - a.saldo)
}

export interface RomaneioPublico {
  numero: number
  data_hora: string
  total_itens: number
  total_unidades: number
}

/**
 * Consulta pública do QR impresso no romaneio, sem saber o tenant.
 *
 * Devolve só o que confirma a autenticidade do papel: número, data e totais.
 * No Supabase isto é a função `consultar_romaneio_publico`, SECURITY DEFINER e
 * concedida ao papel `anon` — nunca um select direto, que exporia a carga e o
 * cliente a quem fotografar a etiqueta.
 */
export async function consultaPublicaRomaneio(
  tipo: 'recebimento' | 'devolucao',
  id: string,
): Promise<RomaneioPublico | null> {
  const { data, error } = await supabase.rpc('consultar_romaneio_publico', {
    p_tipo: tipo,
    p_romaneio_id: id,
  })

  if (error) return null

  const linha = Array.isArray(data) ? data.at(0) : data

  return (linha as RomaneioPublico | undefined) ?? null
}

/**
 * Itens ainda em custódia dos romaneios informados — é a fonte da lista de
 * "o que pode ser devolvido" no assistente de devolução.
 */
export async function itensEmCustodia(
  tenantId: string,
  recebimentoIds: string[],
): Promise<SaldoItem[]> {
  const saldos = await calcularSaldoCustodia(tenantId)

  return saldos
    .flatMap((cliente) => cliente.itens)
    .filter(
      (item) => recebimentoIds.includes(item.recebimento_id) && item.saldo > 0,
    )
}

// ---------------------------------------------------------------------------
// Provas de custódia: assinatura e fotos
//
// As telas capturam em canvas e entregam data URL; o banco guarda CAMINHO no
// bucket. A ponte é aqui, e não no store genérico, porque o fluxo é
// necessariamente em etapas: o caminho do arquivo inclui o id do romaneio, que
// só existe depois do insert.
//
// Consequência assumida: upload NÃO é atômico com o romaneio. Se a rede cair no
// meio, sobra romaneio sem foto — e é por isso que a falha é propagada em vez
// de engolida, para a portaria saber que precisa reanexar. O inverso (perder o
// romaneio por causa de uma foto) seria pior: a carga já está no pátio.
// ---------------------------------------------------------------------------

interface ItemComFotos {
  fotos?: string[]
}

/** Sobe assinatura e fotos, grava os vínculos e devolve o romaneio já relido. */
async function anexarProvas(
  tenantId: string,
  tabela: 'romaneios_recebimento' | 'romaneios_devolucao',
  colunaItem: 'recebimento_item_id' | 'devolucao_item_id',
  romaneioId: string,
  itensSalvos: { id: string }[],
  itensEnviados: ItemComFotos[],
  assinaturaDataUrl: string | null,
): Promise<void> {
  if (assinaturaDataUrl) {
    const caminho = await subirImagem(tenantId, romaneioId, assinaturaDataUrl, 'assinatura')
    const { error } = await supabase
      .from(tabela)
      .update({ assinatura_path: caminho })
      .eq('id', romaneioId)
      .eq('tenant_id', tenantId)

    if (error) throw new UploadError('Romaneio salvo, mas a assinatura não foi anexada.')
  }

  // Os itens voltam do banco na mesma ordem em que foram enviados (a RPC
  // insere com `jsonb_array_elements`, que preserva a ordem do array).
  const linhas: {
    tenant_id: string
    storage_path: string
    nome: string
    capturada_em: string
    recebimento_item_id?: string
    devolucao_item_id?: string
  }[] = []

  for (const [indice, enviado] of itensEnviados.entries()) {
    const salvo = itensSalvos[indice]

    if (!salvo || !enviado.fotos?.length) continue

    const caminhos = await subirImagens(tenantId, romaneioId, enviado.fotos, `item-${indice + 1}`)

    for (const [n, caminho] of caminhos.entries()) {
      linhas.push({
        tenant_id: tenantId,
        storage_path: caminho,
        nome: `Item ${indice + 1} — foto ${n + 1}`,
        capturada_em: new Date().toISOString(),
        [colunaItem]: salvo.id,
      })
    }
  }

  if (linhas.length === 0) return

  const { error } = await supabase.from('romaneio_fotos').insert(linhas)

  if (error) throw new UploadError('Romaneio salvo, mas as fotos não foram anexadas.')
}

/**
 * Cria o recebimento e anexa as provas.
 *
 * Use esta em vez de `recebimentosStore.criar` direto: o store sozinho grava o
 * romaneio e os itens, mas descarta assinatura e fotos, porque elas não são
 * colunas — são arquivos.
 */
export async function criarRecebimentoComProvas(
  tenantId: string,
  valores: Record<string, unknown>,
): Promise<RomaneioRecebimento> {
  const { assinatura_url: assinatura, ...resto } = valores as {
    assinatura_url?: string | null
    itens?: ItemComFotos[]
  }

  const salvo = await recebimentosStore.criar(
    tenantId,
    resto as never,
  )

  await anexarProvas(
    tenantId,
    'romaneios_recebimento',
    'recebimento_item_id',
    salvo.id,
    salvo.itens,
    (resto.itens ?? []) as ItemComFotos[],
    assinatura ?? null,
  )

  return await recebimentosStore.obter(tenantId, salvo.id)
}

/** Idem para a devolução. */
export async function criarDevolucaoComProvas(
  tenantId: string,
  valores: Record<string, unknown>,
): Promise<RomaneioDevolucao> {
  const { assinatura_url: assinatura, ...resto } = valores as {
    assinatura_url?: string | null
    itens?: ItemComFotos[]
  }

  const salvo = await devolucoesStore.criar(tenantId, resto as never)

  await anexarProvas(
    tenantId,
    'romaneios_devolucao',
    'devolucao_item_id',
    salvo.id,
    salvo.itens,
    (resto.itens ?? []) as ItemComFotos[],
    assinatura ?? null,
  )

  return await devolucoesStore.obter(tenantId, salvo.id)
}

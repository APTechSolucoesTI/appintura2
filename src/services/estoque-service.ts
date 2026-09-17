import { MOVIMENTACOES } from '@/mocks/estoque-seed'
import { avaliarAlerta, type AlertaEstoque } from '@/types/cadastros'
import type {
  EstoqueMovimentacao,
  MotivoPerda,
  TipoItem,
  TipoMovimento,
} from '@/types/estoque'
import { consumoEstimadoKg, type OrdemServico } from '@/types/producao'

import { coresStore, insumosStore } from './cadastros-service'
import { criarStore } from './mock-store'

/**
 * Serviços de estoque (Fase 4).
 *
 * O saldo vive em `cores.estoque_atual` / `insumos_quimicos.estoque_atual` e é
 * atualizado junto com cada movimentação. No Postgres isso vira um trigger em
 * `estoque_movimentacoes`: assim é impossível lançar movimento sem mexer no
 * saldo, ou mexer no saldo sem deixar rastro.
 */

export const movimentacoesStore = criarStore<EstoqueMovimentacao>(
  MOVIMENTACOES,
  (a, b) => b.created_at.localeCompare(a.created_at),
)

export class EstoqueError extends Error {}

export interface ItemEstoque {
  id: string
  tipo_item: TipoItem
  descricao: string
  detalhe: string
  estoque_atual: number
  estoque_minimo: number
  unidade: string
  lote: string
  validade: string
  alerta: AlertaEstoque
}

/** Tintas e químicos numa lista só, que é como o almoxarifado enxerga. */
export async function posicaoEstoque(tenantId: string): Promise<ItemEstoque[]> {
  const [cores, insumos] = await Promise.all([
    coresStore.listar(tenantId),
    insumosStore.listar(tenantId),
  ])

  const tintas: ItemEstoque[] = cores.map((cor) => ({
    id: cor.id,
    tipo_item: 'tinta',
    descricao: `${cor.codigo_ral} — ${cor.nome_comercial}`,
    detalhe: `${cor.fabricante} · ${cor.rendimento_teorico_g_m2} g/m²`,
    estoque_atual: cor.estoque_atual,
    estoque_minimo: cor.estoque_minimo,
    unidade: 'kg',
    lote: cor.lote,
    validade: cor.validade,
    alerta: avaliarAlerta(cor.estoque_atual, cor.estoque_minimo, cor.validade),
  }))

  const quimicos: ItemEstoque[] = insumos.map((insumo) => ({
    id: insumo.id,
    tipo_item: 'insumo_quimico',
    descricao: insumo.nome,
    detalhe: insumo.fornecedor,
    estoque_atual: insumo.estoque_atual,
    estoque_minimo: insumo.estoque_minimo,
    unidade: insumo.unidade_medida,
    lote: '',
    validade: insumo.validade,
    alerta: avaliarAlerta(
      insumo.estoque_atual,
      insumo.estoque_minimo,
      insumo.validade,
    ),
  }))

  return [...tintas, ...quimicos].sort((a, b) =>
    a.descricao.localeCompare(b.descricao, 'pt-BR'),
  )
}

async function ajustarSaldo(
  tenantId: string,
  tipoItem: TipoItem,
  itemId: string,
  delta: number,
): Promise<void> {
  if (tipoItem === 'tinta') {
    const cor = await coresStore.obter(tenantId, itemId)

    // Saldo negativo é sintoma de apontamento errado; travar aqui evita que o
    // custo por m² da Fase 5 saia de um número impossível.
    const novo = cor.estoque_atual + delta

    if (novo < 0) {
      throw new EstoqueError(
        `Saldo insuficiente de ${cor.codigo_ral}: há ${cor.estoque_atual} kg em estoque.`,
      )
    }

    await coresStore.atualizar(tenantId, itemId, { estoque_atual: novo })
    return
  }

  const insumo = await insumosStore.obter(tenantId, itemId)
  const novo = insumo.estoque_atual + delta

  if (novo < 0) {
    throw new EstoqueError(
      `Saldo insuficiente de ${insumo.nome}: há ${insumo.estoque_atual} ${insumo.unidade_medida} em estoque.`,
    )
  }

  await insumosStore.atualizar(tenantId, itemId, { estoque_atual: novo })
}

export interface NovoMovimento {
  tipo_item: TipoItem
  item_id: string
  item_descricao: string
  tipo_movimento: TipoMovimento
  quantidade: number
  unidade: string
  lote: string
  motivo_perda: MotivoPerda | null
  observacao: string
  os_id: string | null
  os_numero: number | null
  data: string
  responsavel_id: string
  responsavel_nome: string
}

export async function registrarMovimento(
  tenantId: string,
  movimento: NovoMovimento,
): Promise<EstoqueMovimentacao> {
  const delta =
    movimento.tipo_movimento === 'entrada'
      ? movimento.quantidade
      : -movimento.quantidade

  // Saldo primeiro: se ele recusar, nenhum movimento é gravado.
  await ajustarSaldo(tenantId, movimento.tipo_item, movimento.item_id, delta)

  return movimentacoesStore.criar(tenantId, movimento)
}

/**
 * Baixa de tinta disparada quando a OS entra em "aplicação de pó".
 *
 * Idempotente de propósito: mover o card para frente e para trás no Kanban não
 * pode baixar o mesmo consumo duas vezes.
 */
export async function baixarTintaDaOs(
  tenantId: string,
  os: OrdemServico,
  responsavelId: string,
  responsavelNome: string,
): Promise<EstoqueMovimentacao | null> {
  const movimentos = await movimentacoesStore.listar(tenantId)

  const jaBaixado = movimentos.some(
    (item) =>
      item.os_id === os.id &&
      item.tipo_movimento === 'saida' &&
      item.tipo_item === 'tinta',
  )

  if (jaBaixado) return null

  const cor = await coresStore.obter(tenantId, os.cor_id)
  const quantidade = Number(
    consumoEstimadoKg(os.itens, cor.rendimento_teorico_g_m2).toFixed(3),
  )

  if (quantidade <= 0) return null

  return registrarMovimento(tenantId, {
    tipo_item: 'tinta',
    item_id: cor.id,
    item_descricao: `${cor.codigo_ral} ${cor.nome_comercial}`,
    tipo_movimento: 'saida',
    quantidade,
    unidade: 'kg',
    lote: cor.lote,
    motivo_perda: null,
    observacao: 'Baixa automática na entrada em aplicação de pó.',
    os_id: os.id,
    os_numero: os.numero,
    data: new Date().toISOString().slice(0, 10),
    responsavel_id: responsavelId,
    responsavel_nome: responsavelNome,
  })
}

/** Extrato de um item específico, para a ficha do produto. */
export async function movimentacoesDoItem(
  tenantId: string,
  itemId: string,
): Promise<EstoqueMovimentacao[]> {
  const movimentos = await movimentacoesStore.listar(tenantId)

  return movimentos.filter((item) => item.item_id === itemId)
}

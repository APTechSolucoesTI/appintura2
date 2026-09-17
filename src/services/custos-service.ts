import type { ConfiguracoesTenant } from './configuracoes-service'
import { clientesStore, coresStore } from './cadastros-service'
import { contasReceberStore } from './financeiro-service'
import { movimentacoesStore } from './estoque-service'
import { ordensStore } from './producao-service'
import { areaTotal } from '@/types/producao'

/**
 * Custo real por m² pintado.
 *
 * "Real" aqui é a tinta REALMENTE baixada para a OS (Fase 4) valorizada ao custo
 * do quilo — não a estimativa da abertura da ordem. Os demais componentes são
 * rateios por m² parametrizados em Configurações: energia e gás, mão de obra,
 * químicos e depreciação não saem de nota fiscal por OS, então são estimados.
 */

export interface CustoOs {
  os_id: string
  numero: number
  cliente_id: string
  cliente_nome: string
  area_m2: number
  tinta_kg: number
  custo_tinta: number
  custo_energia_gas: number
  custo_mao_obra: number
  custo_quimicos: number
  custo_depreciacao: number
  custo_total: number
  custo_m2: number
  /** Soma dos títulos emitidos para esta OS. `null` quando ainda não faturada. */
  preco_cobrado: number | null
  margem: number | null
  margem_percentual: number | null
}

export async function custosPorOs(
  tenantId: string,
  config: ConfiguracoesTenant,
): Promise<CustoOs[]> {
  const [ordens, movimentos, cores, contas, clientes] = await Promise.all([
    ordensStore.listar(tenantId),
    movimentacoesStore.listar(tenantId),
    coresStore.listar(tenantId),
    contasReceberStore.listar(tenantId),
    clientesStore.listar(tenantId),
  ])

  const rateioM2 =
    config.custo_energia_gas_m2 +
    config.custo_mao_obra_m2 +
    config.custo_insumos_quimicos_m2 +
    config.custo_depreciacao_m2

  return ordens
    .map((os) => {
      const area = areaTotal(os.itens)

      const tintaKg = movimentos
        .filter(
          (movimento) =>
            movimento.os_id === os.id &&
            movimento.tipo_item === 'tinta' &&
            movimento.tipo_movimento === 'saida',
        )
        .reduce((soma, movimento) => soma + movimento.quantidade, 0)

      const cor = cores.find((item) => item.id === os.cor_id)
      const custoTinta = tintaKg * (cor?.custo_kg ?? 0)

      const custoTotal = custoTinta + rateioM2 * area

      const titulos = contas.filter((conta) => conta.os_id === os.id)
      const precoCobrado =
        titulos.length === 0
          ? null
          : titulos.reduce((soma, conta) => soma + conta.valor, 0)

      return {
        os_id: os.id,
        numero: os.numero,
        cliente_id: os.cliente_id,
        cliente_nome:
          clientes.find((cliente) => cliente.id === os.cliente_id)?.razao_social ??
          'Cliente removido',
        area_m2: area,
        tinta_kg: tintaKg,
        custo_tinta: custoTinta,
        custo_energia_gas: config.custo_energia_gas_m2 * area,
        custo_mao_obra: config.custo_mao_obra_m2 * area,
        custo_quimicos: config.custo_insumos_quimicos_m2 * area,
        custo_depreciacao: config.custo_depreciacao_m2 * area,
        custo_total: custoTotal,
        custo_m2: area === 0 ? 0 : custoTotal / area,
        preco_cobrado: precoCobrado,
        margem: precoCobrado === null ? null : precoCobrado - custoTotal,
        margem_percentual:
          precoCobrado === null || precoCobrado === 0
            ? null
            : ((precoCobrado - custoTotal) / precoCobrado) * 100,
      }
    })
    .sort((a, b) => b.numero - a.numero)
}

export interface MargemCliente {
  cliente_id: string
  cliente_nome: string
  area_m2: number
  custo: number
  receita: number
  margem: number
  margem_percentual: number
}

/** Margem de contribuição por cliente, só sobre OS já faturadas. */
export function margemPorCliente(custos: CustoOs[]): MargemCliente[] {
  const mapa = new Map<string, MargemCliente>()

  for (const custo of custos) {
    if (custo.preco_cobrado === null) continue

    const atual = mapa.get(custo.cliente_id) ?? {
      cliente_id: custo.cliente_id,
      cliente_nome: custo.cliente_nome,
      area_m2: 0,
      custo: 0,
      receita: 0,
      margem: 0,
      margem_percentual: 0,
    }

    atual.area_m2 += custo.area_m2
    atual.custo += custo.custo_total
    atual.receita += custo.preco_cobrado
    atual.margem = atual.receita - atual.custo
    atual.margem_percentual =
      atual.receita === 0 ? 0 : (atual.margem / atual.receita) * 100

    mapa.set(custo.cliente_id, atual)
  }

  return [...mapa.values()].sort((a, b) => b.margem - a.margem)
}

export interface PontoEquilibrio {
  precoMedioM2: number
  custoVariavelM2: number
  margemContribuicaoM2: number
  despesaFixaMensal: number
  /** m² que precisam ser pintados no mês para o resultado ficar em zero. */
  m2Necessarios: number | null
}

/**
 * Ponto de equilíbrio mensal em m².
 *
 * Trata como variáveis os quatro rateios parametrizados (eles foram definidos
 * por m²) e como fixo o bloco de despesa fixa mensal. Mão de obra na prática é
 * semi-fixa — a conta é uma aproximação gerencial, não contabilidade.
 */
export function pontoEquilibrio(
  custos: CustoOs[],
  config: ConfiguracoesTenant,
): PontoEquilibrio {
  const faturadas = custos.filter((custo) => custo.preco_cobrado !== null)

  const areaTotalFaturada = faturadas.reduce((soma, custo) => soma + custo.area_m2, 0)
  const receitaTotal = faturadas.reduce(
    (soma, custo) => soma + (custo.preco_cobrado ?? 0),
    0,
  )
  const custoTotal = faturadas.reduce((soma, custo) => soma + custo.custo_total, 0)

  const precoMedioM2 = areaTotalFaturada === 0 ? 0 : receitaTotal / areaTotalFaturada
  const custoVariavelM2 = areaTotalFaturada === 0 ? 0 : custoTotal / areaTotalFaturada
  const margemContribuicaoM2 = precoMedioM2 - custoVariavelM2

  return {
    precoMedioM2,
    custoVariavelM2,
    margemContribuicaoM2,
    despesaFixaMensal: config.despesa_fixa_mensal,
    // Margem negativa significa que cada m² pintado aumenta o prejuízo: não
    // existe volume que feche a conta, e mostrar um número aqui seria mentira.
    m2Necessarios:
      margemContribuicaoM2 <= 0
        ? null
        : config.despesa_fixa_mensal / margemContribuicaoM2,
  }
}

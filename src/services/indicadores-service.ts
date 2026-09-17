import { parseData } from '@/lib/format'
import { areaTotal, estaAtrasada, type OrdemServico } from '@/types/producao'
import type { SaldoItem } from '@/types/custodia'

import { coresStore } from './cadastros-service'
import type { ConfiguracoesTenant } from './configuracoes-service'
import { custosPorOs, margemPorCliente } from './custos-service'
import { calcularSaldoCustodia } from './custodia-service'
import { movimentacoesStore } from './estoque-service'
import { fluxoDeCaixa, inadimplencia } from './financeiro-service'
import { ordensStore } from './producao-service'
import { indicadoresRetrabalho, type TaxaRetrabalho } from './qualidade-service'

/**
 * Indicadores do painel inicial (Fase 6).
 *
 * Tudo aqui é derivado dos módulos anteriores — nenhum número é digitado. O
 * serviço só junta e recorta; a regra de cada cálculo continua onde ela nasceu.
 */

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate())
}

/** Data em que a OS entrou na cabine — é quando a tinta foi de fato aplicada. */
function entrouNaCabine(os: OrdemServico): Date | null {
  const registro = os.historico.find((item) => item.para === 'aplicacao_po')

  return registro ? new Date(registro.created_at) : null
}

function finalizadaEm(os: OrdemServico): Date | null {
  const registro = [...os.historico]
    .reverse()
    .find((item) => item.para === 'finalizado')

  return registro ? new Date(registro.created_at) : null
}

export interface KpisProducao {
  m2Hoje: number
  m2Semana: number
  m2Mes: number
  /** Consumo real de pó, em gramas por m². */
  consumoRealGm2: number | null
  /** Rendimento da ficha técnica das cores usadas, ponderado pela área. */
  consumoTeoricoGm2: number | null
  /** Quanto o real excede o teórico, em %. Positivo = gastando mais. */
  desvioConsumo: number | null
}

export interface Sla {
  finalizadas: number
  noPrazo: number
  percentualNoPrazo: number
  /** Média de dias entre a entrada e a finalização. */
  prazoRealizadoMedio: number
  prazoPrometidoMedio: number
}

export interface RankingCliente {
  cliente_id: string
  cliente_nome: string
  m2: number
  margem: number
  margemPercentual: number
}

export interface PainelGeral {
  osEmAtraso: OrdemServico[]
  pecasParadas: SaldoItem[]
  diasAlertaCustodia: number
  producao: KpisProducao
  sla: Sla
  retrabalho: TaxaRetrabalho
  custodia: { unidades: number; clientes: number }
  financeiro: {
    inadimplenciaPercentual: number
    valorVencido: number
    saldo30: number
  }
  ranking: RankingCliente[]
  m2PorMes: Array<{ mes: string; rotulo: string; m2: number }>
}

function rotuloMes(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(data)
    .replace('.', '')
}

export async function montarPainel(
  tenantId: string,
  config: ConfiguracoesTenant,
  hoje = new Date(),
): Promise<PainelGeral> {
  const [ordens, movimentos, cores, saldos, atraso, fluxo, custos] = await Promise.all([
    ordensStore.listar(tenantId),
    movimentacoesStore.listar(tenantId),
    coresStore.listar(tenantId),
    calcularSaldoCustodia(tenantId),
    inadimplencia(tenantId, hoje),
    fluxoDeCaixa(tenantId, hoje),
    custosPorOs(tenantId, config),
  ])

  const inicio = inicioDoDia(hoje)
  const inicioSemana = new Date(inicio)
  inicioSemana.setDate(inicioSemana.getDate() - 6)
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)

  // --- m² pintados por janela ---
  let m2Hoje = 0
  let m2Semana = 0
  let m2Mes = 0

  for (const os of ordens) {
    const quando = entrouNaCabine(os)

    if (!quando) continue

    const area = areaTotal(os.itens)
    const dia = inicioDoDia(quando).getTime()

    if (dia === inicio.getTime()) m2Hoje += area
    if (dia >= inicioSemana.getTime()) m2Semana += area
    if (dia >= inicioMes.getTime()) m2Mes += area
  }

  // --- eficiência de tinta ---
  // Só entram OS que já passaram pela cabine: dividir consumo por área de ordem
  // que nem foi pintada inflaria artificialmente a eficiência.
  const pintadas = ordens.filter((os) => entrouNaCabine(os) !== null)
  const areaPintada = pintadas.reduce((soma, os) => soma + areaTotal(os.itens), 0)

  const consumoKg = movimentos
    .filter(
      (movimento) =>
        movimento.tipo_item === 'tinta' &&
        movimento.tipo_movimento === 'saida' &&
        movimento.os_id !== null,
    )
    .reduce((soma, movimento) => soma + movimento.quantidade, 0)

  const teoricoPonderado = pintadas.reduce((soma, os) => {
    const cor = cores.find((item) => item.id === os.cor_id)

    return soma + areaTotal(os.itens) * (cor?.rendimento_teorico_g_m2 ?? 0)
  }, 0)

  const consumoRealGm2 = areaPintada === 0 ? null : (consumoKg * 1000) / areaPintada
  const consumoTeoricoGm2 = areaPintada === 0 ? null : teoricoPonderado / areaPintada

  // --- SLA ---
  const finalizadas = ordens.filter((os) => finalizadaEm(os) !== null)
  let noPrazo = 0
  let somaRealizado = 0
  let somaPrometido = 0

  for (const os of finalizadas) {
    const fim = finalizadaEm(os)

    if (!fim) continue

    const prometido = parseData(os.previsao_entrega).getTime()
    const entrada = parseData(os.data_entrada).getTime()
    const realizado = inicioDoDia(fim).getTime()

    if (realizado <= prometido) noPrazo += 1

    somaRealizado += (realizado - entrada) / 86_400_000
    somaPrometido += (prometido - entrada) / 86_400_000
  }

  const retrabalho = await indicadoresRetrabalho(tenantId, {
    de: new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1).toISOString().slice(0, 10),
    ate: hoje.toISOString().slice(0, 10),
  })

  // --- custódia ---
  const parados = saldos
    .flatMap((cliente) => cliente.itens)
    .filter(
      (item) => item.saldo > 0 && item.dias_em_custodia >= config.dias_alerta_custodia,
    )
    .sort((a, b) => b.dias_em_custodia - a.dias_em_custodia)

  const comSaldo = saldos.filter((cliente) => cliente.saldo > 0)

  // --- ranking de clientes ---
  const margens = margemPorCliente(custos)
  const m2PorCliente = new Map<string, number>()

  for (const os of pintadas) {
    m2PorCliente.set(
      os.cliente_id,
      (m2PorCliente.get(os.cliente_id) ?? 0) + areaTotal(os.itens),
    )
  }

  const ranking: RankingCliente[] = margens
    .map((margem) => ({
      cliente_id: margem.cliente_id,
      cliente_nome: margem.cliente_nome,
      m2: m2PorCliente.get(margem.cliente_id) ?? 0,
      margem: margem.margem,
      margemPercentual: margem.margem_percentual,
    }))
    .sort((a, b) => b.margem - a.margem)

  // --- m² por mês, últimos 6 ---
  const m2PorMes = Array.from({ length: 6 }, (_, indice) => {
    const referencia = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - indice), 1)
    const chave = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, '0')}`

    const m2 = ordens.reduce((soma, os) => {
      const quando = entrouNaCabine(os)

      if (!quando) return soma

      const mes = `${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, '0')}`

      return mes === chave ? soma + areaTotal(os.itens) : soma
    }, 0)

    return { mes: chave, rotulo: rotuloMes(referencia), m2 }
  })

  return {
    osEmAtraso: ordens
      .filter((os) => estaAtrasada(os, hoje))
      .sort((a, b) => a.previsao_entrega.localeCompare(b.previsao_entrega)),
    pecasParadas: parados,
    diasAlertaCustodia: config.dias_alerta_custodia,
    producao: {
      m2Hoje,
      m2Semana,
      m2Mes,
      consumoRealGm2,
      consumoTeoricoGm2,
      desvioConsumo:
        consumoRealGm2 === null || consumoTeoricoGm2 === null || consumoTeoricoGm2 === 0
          ? null
          : ((consumoRealGm2 - consumoTeoricoGm2) / consumoTeoricoGm2) * 100,
    },
    sla: {
      finalizadas: finalizadas.length,
      noPrazo,
      percentualNoPrazo:
        finalizadas.length === 0 ? 0 : (noPrazo / finalizadas.length) * 100,
      prazoRealizadoMedio:
        finalizadas.length === 0 ? 0 : somaRealizado / finalizadas.length,
      prazoPrometidoMedio:
        finalizadas.length === 0 ? 0 : somaPrometido / finalizadas.length,
    },
    retrabalho: retrabalho.geral,
    custodia: {
      unidades: comSaldo.reduce((soma, cliente) => soma + cliente.saldo, 0),
      clientes: comSaldo.length,
    },
    financeiro: {
      inadimplenciaPercentual: atraso.percentual,
      valorVencido: atraso.valorVencido,
      saldo30: fluxo.janelas[0]?.saldo ?? 0,
    },
    ranking,
    m2PorMes,
  }
}

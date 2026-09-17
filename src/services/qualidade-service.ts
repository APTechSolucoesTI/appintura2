import type { NaoConformidade, QualidadeRegistro } from '@/types/qualidade'

import { clientesStore } from './cadastros-service'
import { criarStoreSupabase } from './supabase-store'
import { ordensStore } from './producao-service'

export const qualidadeRegistrosStore = criarStoreSupabase<QualidadeRegistro>({
  tabela: 'qualidade_registros',
  ordenar: (a, b) => b.created_at.localeCompare(a.created_at),
})

export const naoConformidadesStore = criarStoreSupabase<NaoConformidade>({
  tabela: 'nao_conformidades',
  ordenar: (a, b) => b.created_at.localeCompare(a.created_at),
})

export interface TaxaRetrabalho {
  /** OS que chegaram à cabine no período. */
  base: number
  comRetrabalho: number
  /** Percentual, 0 a 100. */
  taxa: number
}

export interface RecorteRetrabalho extends TaxaRetrabalho {
  id: string
  nome: string
}

export interface IndicadoresRetrabalho {
  geral: TaxaRetrabalho
  porCliente: RecorteRetrabalho[]
  porOperador: RecorteRetrabalho[]
}

function calcular(base: number, comRetrabalho: number): TaxaRetrabalho {
  return {
    base,
    comRetrabalho,
    taxa: base === 0 ? 0 : (comRetrabalho / base) * 100,
  }
}

/**
 * Taxa de retrabalho no período.
 *
 * Denominador: OS que ENTRARAM NA CABINE no intervalo. Usar o total de OS
 * abertas inflaria o denominador com ordens que ainda nem foram pintadas e
 * faria o indicador parecer melhor do que é.
 *
 * O operador responsabilizado é o que fez a aplicação, não o que registrou a
 * reprovação — a inspeção não causou o defeito.
 */
export async function indicadoresRetrabalho(
  tenantId: string,
  periodo: { de: string; ate: string },
): Promise<IndicadoresRetrabalho> {
  const [ordens, clientes] = await Promise.all([
    ordensStore.listar(tenantId),
    clientesStore.listar(tenantId),
  ])

  const inicio = new Date(`${periodo.de}T00:00:00`).getTime()
  const fim = new Date(`${periodo.ate}T23:59:59`).getTime()

  const porCliente = new Map<string, { base: number; retrabalho: number }>()
  const porOperador = new Map<
    string,
    { nome: string; base: number; retrabalho: number }
  >()

  let base = 0
  let comRetrabalho = 0

  for (const os of ordens) {
    const aplicacao = os.historico.find((registro) => registro.para === 'aplicacao_po')

    if (!aplicacao) continue

    const quando = new Date(aplicacao.created_at).getTime()

    if (quando < inicio || quando > fim) continue

    const teveRetrabalho = os.historico.some(
      (registro) => registro.para === 'retrabalho',
    )

    base += 1
    if (teveRetrabalho) comRetrabalho += 1

    const cliente = porCliente.get(os.cliente_id) ?? { base: 0, retrabalho: 0 }
    cliente.base += 1
    if (teveRetrabalho) cliente.retrabalho += 1
    porCliente.set(os.cliente_id, cliente)

    const operador = porOperador.get(aplicacao.responsavel_id) ?? {
      nome: aplicacao.responsavel_nome,
      base: 0,
      retrabalho: 0,
    }
    operador.base += 1
    if (teveRetrabalho) operador.retrabalho += 1
    porOperador.set(aplicacao.responsavel_id, operador)
  }

  const ordenarPorTaxa = (a: RecorteRetrabalho, b: RecorteRetrabalho) =>
    b.taxa - a.taxa || b.base - a.base

  return {
    geral: calcular(base, comRetrabalho),
    porCliente: [...porCliente.entries()]
      .map(([id, valor]) => ({
        id,
        nome:
          clientes.find((cliente) => cliente.id === id)?.razao_social ??
          'Cliente removido',
        ...calcular(valor.base, valor.retrabalho),
      }))
      .sort(ordenarPorTaxa),
    porOperador: [...porOperador.entries()]
      .map(([id, valor]) => ({
        id,
        nome: valor.nome,
        ...calcular(valor.base, valor.retrabalho),
      }))
      .sort(ordenarPorTaxa),
  }
}

/** Inspeções de uma OS específica, para a ficha da ordem. */
export async function registrosDaOs(
  tenantId: string,
  osId: string,
): Promise<QualidadeRegistro[]> {
  const registros = await qualidadeRegistrosStore.listar(tenantId)

  return registros.filter((registro) => registro.os_id === osId)
}

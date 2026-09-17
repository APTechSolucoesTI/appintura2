/**
 * Parâmetros operacionais e financeiros por empresa.
 *
 * Hoje persistidos em localStorage; ao conectar o Supabase viram a tabela
 * `configuracoes_tenant` (uma linha por tenant, RLS por tenant_id).
 */

export interface ConfiguracoesTenant {
  tenant_id: string
  /** Dias em custódia a partir dos quais a peça entra em alerta no painel. */
  dias_alerta_custodia: number
  /** Percentual fixo de multa sobre o saldo em atraso. */
  multa_percentual: number
  /** Percentual de juros ao mês, cobrado pro rata die. */
  juros_mes_percentual: number
  /**
   * Custos indiretos rateados por m² pintado. São a parte do custo que não sai
   * de nota fiscal — precisam ser estimados pelo dono da fábrica.
   */
  custo_energia_gas_m2: number
  custo_mao_obra_m2: number
  custo_insumos_quimicos_m2: number
  custo_depreciacao_m2: number
  /** Despesa fixa mensal, base do ponto de equilíbrio. */
  despesa_fixa_mensal: number
}

export const CONFIGURACOES_PADRAO: Omit<ConfiguracoesTenant, 'tenant_id'> = {
  dias_alerta_custodia: 15,
  multa_percentual: 2,
  juros_mes_percentual: 1,
  custo_energia_gas_m2: 4.2,
  custo_mao_obra_m2: 9.5,
  custo_insumos_quimicos_m2: 2.8,
  custo_depreciacao_m2: 1.6,
  despesa_fixa_mensal: 42000,
}

const CHAVE = 'appintura.configuracoes'

type Armazenado = Record<string, Partial<Omit<ConfiguracoesTenant, 'tenant_id'>>>

function ler(): Armazenado {
  try {
    const bruto = localStorage.getItem(CHAVE)

    return bruto ? (JSON.parse(bruto) as Armazenado) : {}
  } catch {
    // localStorage corrompido não pode derrubar a tela — cai no padrão.
    return {}
  }
}

export async function obterConfiguracoes(
  tenantId: string,
): Promise<ConfiguracoesTenant> {
  const salvo = ler()[tenantId] ?? {}

  return { tenant_id: tenantId, ...CONFIGURACOES_PADRAO, ...salvo }
}

/**
 * Patch parcial: cada tela de configuração salva só os campos que edita, sem
 * sobrescrever o que outra aba ajustou.
 */
export async function salvarConfiguracoes(
  tenantId: string,
  patch: Partial<Omit<ConfiguracoesTenant, 'tenant_id'>>,
): Promise<ConfiguracoesTenant> {
  const atual = ler()
  const mesclado = { ...CONFIGURACOES_PADRAO, ...atual[tenantId], ...patch }

  localStorage.setItem(CHAVE, JSON.stringify({ ...atual, [tenantId]: mesclado }))

  return { tenant_id: tenantId, ...mesclado }
}

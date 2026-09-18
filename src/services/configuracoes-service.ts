import { supabase } from '@/lib/supabase'

/**
 * Parâmetros operacionais e financeiros por empresa.
 *
 * Moram em `appintura2.configuracoes_tenant`, uma linha por tenant, com RLS.
 *
 * Já estiveram em localStorage, e isso era pior do que "ainda não migrado": as
 * views do banco — `vw_sla_os` e as de custo — LEEM esta tabela. Com os valores
 * só no navegador, o mesmo indicador saía diferente conforme quem calculava, e
 * um parâmetro ajustado num computador não existia para o resto da equipe. São
 * números que decidem preço e alerta de peça parada; não podem ser locais.
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

const CAMPOS = Object.keys(CONFIGURACOES_PADRAO) as (keyof Omit<
  ConfiguracoesTenant,
  'tenant_id'
>)[]

/**
 * Preenche campo a campo a partir do padrão.
 *
 * A linha pode não existir (empresa nova) e, mesmo existindo, uma coluna criada
 * por migration posterior pode estar ausente na resposta. Nos dois casos o valor
 * padrão vale — o que não pode acontecer é `undefined` chegar num cálculo de
 * custo e virar `NaN` silencioso na tela.
 *
 * O `Number()` é cinto de segurança: este PostgREST devolve `numeric` como
 * número JSON, mas a garantia do tipo é do driver, e custo caro demais para
 * confiar de graça.
 */
function normalizar(tenantId: string, linha: Record<string, unknown> | null) {
  const valores = { ...CONFIGURACOES_PADRAO }

  for (const campo of CAMPOS) {
    const bruto = linha?.[campo]

    if (bruto === null || bruto === undefined) continue

    const numero = Number(bruto)

    if (Number.isFinite(numero)) valores[campo] = numero
  }

  return { tenant_id: tenantId, ...valores }
}

export async function obterConfiguracoes(
  tenantId: string,
): Promise<ConfiguracoesTenant> {
  const { data, error } = await supabase
    .from('configuracoes_tenant')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  // Empresa recém-criada ainda não tem linha, e ler configuração não é hora de
  // gravar. Os padrões valem até alguém salvar de verdade.
  if (error) throw new Error(error.message)

  return normalizar(tenantId, data as Record<string, unknown> | null)
}

/**
 * Patch parcial: cada tela de configuração salva só os campos que edita, sem
 * sobrescrever o que outra aba ajustou.
 *
 * É upsert porque a linha pode não existir — e o `onConflict` em `tenant_id`
 * evita a corrida entre duas abas salvando abas diferentes ao mesmo tempo, que
 * com insert-ou-update no cliente daria violação de chave primária.
 */
export async function salvarConfiguracoes(
  tenantId: string,
  patch: Partial<Omit<ConfiguracoesTenant, 'tenant_id'>>,
): Promise<ConfiguracoesTenant> {
  const atual = await obterConfiguracoes(tenantId)
  const { tenant_id: _ignorado, ...semId } = { ...atual, ...patch }

  const { data, error } = await supabase
    .from('configuracoes_tenant')
    .upsert({ tenant_id: tenantId, ...semId }, { onConflict: 'tenant_id' })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return normalizar(tenantId, data as Record<string, unknown>)
}

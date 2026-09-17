import { ORDENS_SERVICO } from '@/mocks/producao-seed'
import type { OrdemServico, OsStatusHistorico, StatusOs } from '@/types/producao'

import { baixarTintaDaOs } from './estoque-service'
import { criarStore } from './mock-store'

/**
 * Serviços de produção (Fase 3).
 *
 * A transição de status e o registro no histórico acontecem SEMPRE juntos —
 * no Postgres isso vira um trigger em `ordens_servico`, para que ninguém consiga
 * mudar o status por fora e deixar a trilha com buraco.
 */

export const ordensStore = criarStore<OrdemServico>(
  ORDENS_SERVICO,
  (a, b) => b.numero - a.numero,
)

export async function proximoNumeroOs(tenantId: string): Promise<number> {
  const existentes = await ordensStore.listar(tenantId)

  return existentes.reduce((maior, os) => Math.max(maior, os.numero), 0) + 1
}

export class TransicaoInvalidaError extends Error {}

export interface MoverParams {
  tenantId: string
  osId: string
  novoStatus: StatusOs
  responsavelId: string
  responsavelNome: string
  observacao?: string
}

export async function moverStatus({
  tenantId,
  osId,
  novoStatus,
  responsavelId,
  responsavelNome,
  observacao = '',
}: MoverParams): Promise<OrdemServico> {
  const os = await ordensStore.obter(tenantId, osId)

  if (os.status === novoStatus) {
    throw new TransicaoInvalidaError('A ordem já está nesta etapa.')
  }

  const registro: OsStatusHistorico = {
    id: crypto.randomUUID(),
    os_id: osId,
    de: os.status,
    para: novoStatus,
    responsavel_id: responsavelId,
    responsavel_nome: responsavelNome,
    observacao,
    created_at: new Date().toISOString(),
  }

  const atualizada = await ordensStore.atualizar(tenantId, osId, {
    status: novoStatus,
    historico: [...os.historico, registro],
  })

  // Entrar na cabine consome tinta. A baixa é idempotente, então mover o card
  // para frente e para trás não lança o consumo duas vezes.
  if (novoStatus === 'aplicacao_po') {
    await baixarTintaDaOs(tenantId, atualizada, responsavelId, responsavelNome)
  }

  return atualizada
}

/** OS abertas a partir de um romaneio — usado na tela do recebimento. */
export async function ordensDoRomaneio(
  tenantId: string,
  romaneioId: string,
): Promise<OrdemServico[]> {
  const ordens = await ordensStore.listar(tenantId)

  return ordens.filter((os) => os.romaneio_recebimento_id === romaneioId)
}

/** OS de um cliente — alimenta a aba de histórico da ficha do cliente. */
export async function ordensDoCliente(
  tenantId: string,
  clienteId: string,
): Promise<OrdemServico[]> {
  const ordens = await ordensStore.listar(tenantId)

  return ordens.filter((os) => os.cliente_id === clienteId)
}

/**
 * Consulta pública pelo QR code: acha a OS sem saber o tenant.
 *
 * No Supabase isto NÃO pode ser um select direto na tabela — vira uma Edge
 * Function ou uma view restrita que devolve só o que pode ser exposto sem
 * login (número, status, previsão), nunca preço, custo ou dados do cliente.
 */
export async function consultaPublica(osId: string): Promise<OrdemServico | null> {
  const todas = ORDENS_SERVICO.filter((os) => os.id === osId)

  return todas.at(0) ?? null
}

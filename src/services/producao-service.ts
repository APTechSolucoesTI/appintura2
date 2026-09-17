import { supabase } from '@/lib/supabase'
import type { OrdemServico, StatusOs } from '@/types/producao'

import { baixarTintaDaOs } from './estoque-service'
import { criarStoreSupabase } from './supabase-store'

/**
 * Serviços de produção (Fase 3).
 *
 * A transição de status e o registro no histórico acontecem SEMPRE juntos —
 * no Postgres isso vira um trigger em `ordens_servico`, para que ninguém consiga
 * mudar o status por fora e deixar a trilha com buraco.
 */

export const ordensStore = criarStoreSupabase<OrdemServico>({
  tabela: 'ordens_servico',
  select: '*, itens:os_itens(*), historico:os_status_historico(*)',
  rpcGravar: { nome: 'salvar_ordem_servico', campoItens: 'itens' },
  ordenar: (a, b) => b.numero - a.numero,
})

export async function proximoNumeroOs(tenantId: string): Promise<number> {
  const existentes = await ordensStore.listar(tenantId)

  return existentes.reduce((maior, os) => Math.max(maior, os.numero), 0) + 1
}

export class TransicaoInvalidaError extends Error {}

export interface MoverParams {
  tenantId: string
  osId: string
  novoStatus: StatusOs
  /**
   * Quem está movendo. NÃO vai para o histórico — lá o responsável é resolvido
   * no banco, por `usuario_atual()`, que lê o JWT. É o único jeito de a trilha
   * não depender do que o cliente afirma ser.
   *
   * Continua aqui porque a baixa de tinta registra quem consumiu.
   */
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
}: MoverParams): Promise<OrdemServico> {
  const os = await ordensStore.obter(tenantId, osId)

  if (os.status === novoStatus) {
    throw new TransicaoInvalidaError('A ordem já está nesta etapa.')
  }

  // O histórico NÃO é montado aqui: quem grava é o trigger da Fase 3, em
  // `ordens_servico`. Mandar a lista junto duplicaria a trilha, e montá-la no
  // cliente deixaria de fora toda transição feita por outro caminho.
  //
  // Sem a chave `itens`, a RPC preserva os itens da OS — é o que permite mover
  // o card sem tocar na carga.
  const atualizada = await ordensStore.atualizar(tenantId, osId, {
    status: novoStatus,
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

/** O que o QR code expõe sem login. Deliberadamente sem cliente, preço ou custo. */
export interface ConsultaPublicaOs {
  numero: number
  status: StatusOs
  previsao_entrega: string
  atualizado_em: string
}

/**
 * Consulta pública pelo QR code: acha a OS sem saber o tenant.
 *
 * NÃO é um select na tabela: é uma função SECURITY DEFINER que devolve só
 * número, status e previsão. O papel `anon` não tem grant em `ordens_servico`,
 * e é isso que garante que a etiqueta colada na peça — que circula no pátio e
 * no caminhão — não vire uma porta para a carteira de clientes.
 */
export async function consultaPublica(osId: string): Promise<ConsultaPublicaOs | null> {
  const { data, error } = await supabase.rpc('consultar_os_publica', { p_os_id: osId })

  if (error) return null

  const linha = Array.isArray(data) ? data.at(0) : data

  return (linha as ConsultaPublicaOs | undefined) ?? null
}

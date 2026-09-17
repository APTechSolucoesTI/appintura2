import { parseData } from '@/lib/format'
import { formatCurrency } from '@/lib/format'
import type { Notificacao, TipoNotificacao } from '@/types/notificacoes'
import { saldoAberto, statusEfetivo } from '@/types/financeiro'

import type { ConfiguracoesTenant } from './configuracoes-service'
import { calcularSaldoCustodia, devolucoesStore } from './custodia-service'
import { posicaoEstoque } from './estoque-service'
import { contasReceberStore } from './financeiro-service'
import { criarStore } from './mock-store'
import { ordensStore } from './producao-service'

/**
 * Central de notificações.
 *
 * Aqui os gatilhos são avaliados sob demanda, a partir do estado atual. No
 * Supabase viram triggers (OS mudou de status, romaneio criado) e um job de
 * `pg_cron` para os que dependem do tempo passar — estoque vencendo, peça
 * parada, título a vencer. A Edge Function `disparar-notificacoes` é o ponto
 * único de saída para WhatsApp/APChat.
 */

export const notificacoesStore = criarStore<Notificacao>(
  [],
  (a, b) => b.created_at.localeCompare(a.created_at),
)

/** Dias de antecedência do aviso de vencimento de título. */
const DIAS_AVISO_VENCIMENTO = 5

interface Candidata {
  tipo: TipoNotificacao
  titulo: string
  descricao: string
  referencia_id: string
  link: string
}

async function candidatas(
  tenantId: string,
  config: ConfiguracoesTenant,
  hoje: Date,
): Promise<Candidata[]> {
  const [ordens, devolucoes, estoque, saldos, contas] = await Promise.all([
    ordensStore.listar(tenantId),
    devolucoesStore.listar(tenantId),
    posicaoEstoque(tenantId),
    calcularSaldoCustodia(tenantId),
    contasReceberStore.listar(tenantId),
  ])

  const lista: Candidata[] = []

  for (const os of ordens) {
    if (os.status === 'aguardando_retirada') {
      lista.push({
        tipo: 'os_aguardando_retirada',
        titulo: `OS #${String(os.numero).padStart(4, '0')} pronta`,
        descricao: 'Peças embaladas, aguardando o cliente retirar.',
        referencia_id: os.id,
        link: `/app/ordens-servico/${os.id}`,
      })
    }

    if (os.status === 'finalizado') {
      lista.push({
        tipo: 'os_finalizada',
        titulo: `OS #${String(os.numero).padStart(4, '0')} finalizada`,
        descricao: 'Ordem concluída e entregue.',
        referencia_id: os.id,
        link: `/app/ordens-servico/${os.id}`,
      })
    }
  }

  for (const devolucao of devolucoes) {
    if (devolucao.status !== 'aguardando_retirada') continue

    lista.push({
      tipo: 'devolucao_disponivel',
      titulo: `Devolução #${String(devolucao.numero).padStart(4, '0')} separada`,
      descricao: `Aguardando ${devolucao.retirado_por_nome} retirar.`,
      referencia_id: devolucao.id,
      link: `/app/recebimento/devolucoes/${devolucao.id}`,
    })
  }

  for (const item of estoque) {
    if (item.alerta === null) continue

    lista.push({
      tipo: 'estoque_minimo',
      titulo: item.descricao,
      descricao:
        item.alerta === 'vencido'
          ? 'Lote vencido — não aplicar.'
          : item.alerta === 'estoque_baixo'
            ? `Saldo de ${item.estoque_atual} ${item.unidade}, abaixo do mínimo de ${item.estoque_minimo}.`
            : 'Validade próxima do fim.',
      referencia_id: item.id,
      link: '/app/estoque/posicao',
    })
  }

  for (const cliente of saldos) {
    for (const item of cliente.itens) {
      if (item.saldo <= 0) continue
      if (item.dias_em_custodia < config.dias_alerta_custodia) continue

      lista.push({
        tipo: 'peca_parada',
        titulo: `${item.descricao} parada há ${item.dias_em_custodia} dias`,
        descricao: `${cliente.cliente_nome} — ${item.saldo} unidade(s) no pátio.`,
        referencia_id: item.recebimento_item_id,
        link: '/app/recebimento/custodia',
      })
    }
  }

  const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  limite.setDate(limite.getDate() + DIAS_AVISO_VENCIMENTO)

  for (const conta of contas) {
    const status = statusEfetivo(conta, hoje)

    if (status === 'pago' || status === 'cancelado' || status === 'negociado') continue

    const vence = parseData(conta.vencimento).getTime()

    if (vence > limite.getTime()) continue

    lista.push({
      tipo: 'titulo_vencendo',
      titulo:
        status === 'vencido'
          ? `Título vencido: ${formatCurrency(saldoAberto(conta))}`
          : `Vence em breve: ${formatCurrency(saldoAberto(conta))}`,
      descricao: conta.descricao,
      referencia_id: conta.id,
      link: '/app/financeiro/receber',
    })
  }

  return lista
}

/**
 * Cria as notificações que ainda não existem e devolve a lista completa.
 *
 * A chave de idempotência é `tipo + referencia_id`: reavaliar os gatilhos não
 * pode encher o sino com a mesma peça parada todo dia.
 */
export async function sincronizarNotificacoes(
  tenantId: string,
  config: ConfiguracoesTenant,
  hoje = new Date(),
): Promise<Notificacao[]> {
  const existentes = await notificacoesStore.listar(tenantId)
  const chaves = new Set(
    existentes.map((item) => `${item.tipo}:${item.referencia_id}`),
  )

  const novas = (await candidatas(tenantId, config, hoje)).filter(
    (item) => !chaves.has(`${item.tipo}:${item.referencia_id}`),
  )

  for (const nova of novas) {
    await notificacoesStore.criar(tenantId, { ...nova, lida: false })
  }

  return notificacoesStore.listar(tenantId)
}

export async function marcarComoLida(
  tenantId: string,
  id: string,
): Promise<Notificacao> {
  return notificacoesStore.atualizar(tenantId, id, { lida: true })
}

export async function marcarTodasComoLidas(tenantId: string): Promise<void> {
  const lista = await notificacoesStore.listar(tenantId)
  const naoLidas = lista.filter((item) => !item.lida).map((item) => item.id)

  if (naoLidas.length === 0) return

  // Em lote: um update para todas. Uma chamada por notificação viraria N idas
  // ao servidor com o Supabase — e o sino levaria segundos para zerar.
  await notificacoesStore.atualizarVarios(tenantId, naoLidas, { lida: true })
}

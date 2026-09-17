import type { OrdemServico, OsStatusHistorico, StatusOs } from '@/types/producao'

import { CLIENTES, CORES } from './cadastros-seed'
import { RECEBIMENTOS } from './custodia-seed'
import { TENANTS, USERS } from './seed'

/**
 * Seed da Fase 3: 6 ordens de serviço espalhadas pelo fluxo.
 *
 * Mais de uma OS aponta para o mesmo romaneio de recebimento — é o caso comum:
 * uma carga chega com peças que vão para cores e acabamentos diferentes, e cada
 * combinação vira uma OS própria.
 */

const MATRIZ = TENANTS[0].id
const MARINA = USERS[0]
const ROGERIO = USERS[1]

const ANDRADE = CLIENTES[0]
const VALE_DO_ACO = CLIENTES[1]
const BELMIRO = CLIENTES[2]

const PRETO = CORES[0]
const BRANCO = CORES[1]
const CINZA = CORES[2]
const AZUL = CORES[3]
const VERMELHO = CORES[4]

const RECEBIMENTO_ANDRADE = RECEBIMENTOS[0].id
const RECEBIMENTO_VALE = RECEBIMENTOS[1].id

let contadorHistorico = 0

/** Monta a trilha de status até a etapa atual, com datas plausíveis. */
function trilha(
  osId: string,
  etapas: Array<{ status: StatusOs; em: string; por: typeof MARINA }>,
): OsStatusHistorico[] {
  return etapas.map((etapa, indice) => {
    contadorHistorico += 1

    return {
      id: `h-${String(contadorHistorico).padStart(4, '0')}`,
      os_id: osId,
      de: indice === 0 ? null : etapas[indice - 1].status,
      para: etapa.status,
      responsavel_id: etapa.por.id,
      responsavel_nome: etapa.por.nome,
      observacao: '',
      created_at: etapa.em,
    }
  })
}

const OS_1 = 'aa000001-0000-4000-8000-000000000001'
const OS_2 = 'aa000001-0000-4000-8000-000000000002'
const OS_3 = 'aa000001-0000-4000-8000-000000000003'
const OS_4 = 'aa000001-0000-4000-8000-000000000004'
const OS_5 = 'aa000001-0000-4000-8000-000000000005'
const OS_6 = 'aa000001-0000-4000-8000-000000000006'

/**
 * Ordens já concluídas em julho e agosto.
 *
 * Existem para os indicadores da Fase 6 terem base: SLA, m² pintados por mês e
 * eficiência de tinta só fazem sentido sobre trabalho terminado. Uma delas
 * atrasou de propósito — um painel em que tudo sempre bateu o prazo não ajuda
 * ninguém a enxergar problema.
 */
const OS_7 = 'aa000001-0000-4000-8000-000000000007'
const OS_8 = 'aa000001-0000-4000-8000-000000000008'
const OS_9 = 'aa000001-0000-4000-8000-000000000009'

export const ORDENS_SERVICO: OrdemServico[] = [
  {
    id: OS_1,
    tenant_id: MATRIZ,
    numero: 1,
    cliente_id: ANDRADE.id,
    romaneio_recebimento_id: RECEBIMENTO_ANDRADE,
    data_entrada: '2026-09-10',
    previsao_entrega: '2026-09-18',
    urgencia: 'normal',
    status: 'recebido',
    cor_id: PRETO.id,
    espessura_min_micron: 60,
    espessura_max_micron: 80,
    tipo_pretratamento: 'desengraxe',
    laudo_url: null,
    laudo_nome: '',
    observacao: 'Cliente pediu acabamento fosco uniforme, sem casca de laranja.',
    created_at: '2026-09-10T09:10:00.000Z',
    itens: [
      {
        id: 'i-0001',
        os_id: OS_1,
        descricao: 'Perfil de alumínio 6063 — barra de 3 m',
        quantidade: 60,
        area_m2: 43.2,
        foto_url: null,
      },
    ],
    historico: trilha(OS_1, [
      { status: 'recebido', em: '2026-09-10T09:10:00.000Z', por: ROGERIO },
    ]),
  },
  {
    // Prazo vencido e urgência máxima: o card precisa gritar no Kanban.
    id: OS_2,
    tenant_id: MATRIZ,
    numero: 2,
    cliente_id: VALE_DO_ACO.id,
    romaneio_recebimento_id: RECEBIMENTO_VALE,
    data_entrada: '2026-08-20',
    previsao_entrega: '2026-09-11',
    urgencia: 'urgente',
    status: 'pre_tratamento',
    cor_id: CINZA.id,
    espessura_min_micron: 70,
    espessura_max_micron: 100,
    tipo_pretratamento: 'fosfatizacao',
    laudo_url: null,
    laudo_nome: '',
    observacao: 'Portão com avaria registrada na entrada — conferir antes da cabine.',
    created_at: '2026-08-20T15:00:00.000Z',
    itens: [
      {
        id: 'i-0002',
        os_id: OS_2,
        descricao: 'Portão de correr 3,5 m x 2,2 m',
        quantidade: 4,
        area_m2: 61.6,
        foto_url: null,
      },
    ],
    historico: trilha(OS_2, [
      { status: 'recebido', em: '2026-08-20T15:00:00.000Z', por: ROGERIO },
      { status: 'pre_tratamento', em: '2026-09-08T07:30:00.000Z', por: ROGERIO },
    ]),
  },
  {
    id: OS_3,
    tenant_id: MATRIZ,
    numero: 3,
    cliente_id: VALE_DO_ACO.id,
    romaneio_recebimento_id: RECEBIMENTO_VALE,
    data_entrada: '2026-08-20',
    previsao_entrega: '2026-09-19',
    urgencia: 'normal',
    status: 'aplicacao_po',
    cor_id: VERMELHO.id,
    espessura_min_micron: 65,
    espessura_max_micron: 90,
    tipo_pretratamento: 'fosfatizacao',
    laudo_url: null,
    laudo_nome: '',
    observacao: '',
    created_at: '2026-08-20T15:05:00.000Z',
    itens: [
      {
        id: 'i-0003',
        os_id: OS_3,
        descricao: 'Grade de proteção 1,2 m x 1,0 m',
        quantidade: 14,
        area_m2: 33.6,
        foto_url: null,
      },
    ],
    historico: trilha(OS_3, [
      { status: 'recebido', em: '2026-08-20T15:05:00.000Z', por: ROGERIO },
      { status: 'pre_tratamento', em: '2026-09-09T08:00:00.000Z', por: ROGERIO },
      { status: 'aplicacao_po', em: '2026-09-13T10:20:00.000Z', por: ROGERIO },
    ]),
  },
  {
    id: OS_4,
    tenant_id: MATRIZ,
    numero: 4,
    cliente_id: VALE_DO_ACO.id,
    romaneio_recebimento_id: RECEBIMENTO_VALE,
    data_entrada: '2026-08-20',
    previsao_entrega: '2026-09-16',
    urgencia: 'alta',
    status: 'controle_qualidade',
    cor_id: CINZA.id,
    espessura_min_micron: 70,
    espessura_max_micron: 100,
    tipo_pretratamento: 'fosfatizacao',
    laudo_url: null,
    laudo_nome: '',
    observacao: '',
    created_at: '2026-08-20T15:10:00.000Z',
    itens: [
      {
        id: 'i-0004',
        os_id: OS_4,
        descricao: 'Grade de proteção 1,2 m x 1,0 m',
        quantidade: 10,
        area_m2: 24,
        foto_url: null,
      },
    ],
    historico: trilha(OS_4, [
      { status: 'recebido', em: '2026-08-20T15:10:00.000Z', por: ROGERIO },
      { status: 'pre_tratamento', em: '2026-09-07T07:45:00.000Z', por: ROGERIO },
      { status: 'aplicacao_po', em: '2026-09-09T09:15:00.000Z', por: ROGERIO },
      { status: 'cura', em: '2026-09-09T14:00:00.000Z', por: ROGERIO },
      { status: 'controle_qualidade', em: '2026-09-12T08:40:00.000Z', por: MARINA },
    ]),
  },
  {
    id: OS_5,
    tenant_id: MATRIZ,
    numero: 5,
    cliente_id: ANDRADE.id,
    romaneio_recebimento_id: RECEBIMENTO_ANDRADE,
    data_entrada: '2026-09-10',
    previsao_entrega: '2026-09-15',
    urgencia: 'normal',
    status: 'aguardando_retirada',
    cor_id: BRANCO.id,
    espessura_min_micron: 60,
    espessura_max_micron: 85,
    tipo_pretratamento: 'desengraxe',
    laudo_url: null,
    laudo_nome: '',
    observacao: '',
    created_at: '2026-09-10T09:20:00.000Z',
    itens: [
      {
        id: 'i-0005',
        os_id: OS_5,
        descricao: 'Perfil de alumínio 6063 — barra de 3 m',
        quantidade: 60,
        area_m2: 43.2,
        foto_url: null,
      },
    ],
    historico: trilha(OS_5, [
      { status: 'recebido', em: '2026-09-10T09:20:00.000Z', por: ROGERIO },
      { status: 'pre_tratamento', em: '2026-09-10T13:00:00.000Z', por: ROGERIO },
      { status: 'aplicacao_po', em: '2026-09-11T08:10:00.000Z', por: ROGERIO },
      { status: 'cura', em: '2026-09-11T11:30:00.000Z', por: ROGERIO },
      { status: 'controle_qualidade', em: '2026-09-11T15:00:00.000Z', por: MARINA },
      { status: 'embalagem', em: '2026-09-12T08:00:00.000Z', por: ROGERIO },
      { status: 'aguardando_retirada', em: '2026-09-12T10:15:00.000Z', por: ROGERIO },
    ]),
  },
  {
    // Reprovada na qualidade: volta para a cabine quando sair do retrabalho.
    id: OS_6,
    tenant_id: MATRIZ,
    numero: 6,
    cliente_id: ANDRADE.id,
    romaneio_recebimento_id: RECEBIMENTO_ANDRADE,
    data_entrada: '2026-09-10',
    previsao_entrega: '2026-09-20',
    urgencia: 'alta',
    status: 'retrabalho',
    cor_id: AZUL.id,
    espessura_min_micron: 70,
    espessura_max_micron: 95,
    tipo_pretratamento: 'desengraxe',
    laudo_url: null,
    laudo_nome: '',
    observacao: 'Espessura abaixo do mínimo em 6 peças na primeira inspeção.',
    created_at: '2026-09-10T09:30:00.000Z',
    itens: [
      {
        id: 'i-0006',
        os_id: OS_6,
        descricao: 'Cantoneira de alumínio 1"',
        quantidade: 20,
        area_m2: 9.6,
        foto_url: null,
      },
    ],
    historico: trilha(OS_6, [
      { status: 'recebido', em: '2026-09-10T09:30:00.000Z', por: ROGERIO },
      { status: 'pre_tratamento', em: '2026-09-10T14:00:00.000Z', por: ROGERIO },
      { status: 'aplicacao_po', em: '2026-09-11T09:00:00.000Z', por: ROGERIO },
      { status: 'cura', em: '2026-09-11T12:00:00.000Z', por: ROGERIO },
      { status: 'controle_qualidade', em: '2026-09-12T09:00:00.000Z', por: MARINA },
      { status: 'retrabalho', em: '2026-09-12T09:40:00.000Z', por: MARINA },
    ]),
  },
  {
    id: OS_7,
    tenant_id: MATRIZ,
    numero: 7,
    cliente_id: ANDRADE.id,
    romaneio_recebimento_id: RECEBIMENTO_ANDRADE,
    data_entrada: '2026-07-06',
    previsao_entrega: '2026-07-17',
    urgencia: 'normal',
    status: 'finalizado',
    cor_id: PRETO.id,
    espessura_min_micron: 60,
    espessura_max_micron: 80,
    tipo_pretratamento: 'desengraxe',
    laudo_url: null,
    laudo_nome: '',
    observacao: '',
    created_at: '2026-07-06T08:00:00.000Z',
    itens: [
      {
        id: 'i-0007',
        os_id: OS_7,
        descricao: 'Esquadria de alumínio 1,2 m x 1,4 m',
        quantidade: 48,
        area_m2: 161.28,
        foto_url: null,
      },
    ],
    historico: trilha(OS_7, [
      { status: 'recebido', em: '2026-07-06T08:00:00.000Z', por: ROGERIO },
      { status: 'pre_tratamento', em: '2026-07-07T07:30:00.000Z', por: ROGERIO },
      { status: 'aplicacao_po', em: '2026-07-09T09:00:00.000Z', por: ROGERIO },
      { status: 'cura', em: '2026-07-09T13:00:00.000Z', por: ROGERIO },
      { status: 'controle_qualidade', em: '2026-07-10T08:30:00.000Z', por: MARINA },
      { status: 'embalagem', em: '2026-07-13T08:00:00.000Z', por: ROGERIO },
      { status: 'aguardando_retirada', em: '2026-07-13T15:00:00.000Z', por: ROGERIO },
      { status: 'finalizado', em: '2026-07-15T10:00:00.000Z', por: ROGERIO },
    ]),
  },
  {
    // Entregue 6 dias depois do prometido: puxa o SLA para baixo.
    id: OS_8,
    tenant_id: MATRIZ,
    numero: 8,
    cliente_id: VALE_DO_ACO.id,
    romaneio_recebimento_id: RECEBIMENTO_VALE,
    data_entrada: '2026-07-20',
    previsao_entrega: '2026-08-05',
    urgencia: 'alta',
    status: 'finalizado',
    cor_id: CINZA.id,
    espessura_min_micron: 70,
    espessura_max_micron: 100,
    tipo_pretratamento: 'fosfatizacao',
    laudo_url: null,
    laudo_nome: '',
    observacao: 'Atraso por espera de reposição de pó cinza.',
    created_at: '2026-07-20T08:00:00.000Z',
    itens: [
      {
        id: 'i-0008',
        os_id: OS_8,
        descricao: 'Portão pivotante 2,8 m x 2,2 m',
        quantidade: 6,
        area_m2: 73.92,
        foto_url: null,
      },
    ],
    historico: trilha(OS_8, [
      { status: 'recebido', em: '2026-07-20T08:00:00.000Z', por: ROGERIO },
      { status: 'pre_tratamento', em: '2026-07-28T07:00:00.000Z', por: ROGERIO },
      { status: 'aplicacao_po', em: '2026-08-04T09:30:00.000Z', por: ROGERIO },
      { status: 'cura', em: '2026-08-04T14:00:00.000Z', por: ROGERIO },
      { status: 'controle_qualidade', em: '2026-08-06T08:00:00.000Z', por: MARINA },
      { status: 'embalagem', em: '2026-08-10T09:00:00.000Z', por: ROGERIO },
      { status: 'finalizado', em: '2026-08-11T16:00:00.000Z', por: ROGERIO },
    ]),
  },
  {
    id: OS_9,
    tenant_id: MATRIZ,
    numero: 9,
    cliente_id: BELMIRO.id,
    romaneio_recebimento_id: RECEBIMENTO_ANDRADE,
    data_entrada: '2026-08-14',
    previsao_entrega: '2026-08-28',
    urgencia: 'normal',
    status: 'finalizado',
    cor_id: VERMELHO.id,
    espessura_min_micron: 65,
    espessura_max_micron: 90,
    tipo_pretratamento: 'jateamento',
    laudo_url: null,
    laudo_nome: '',
    observacao: '',
    created_at: '2026-08-14T08:00:00.000Z',
    itens: [
      {
        id: 'i-0009',
        os_id: OS_9,
        descricao: 'Roda de liga leve aro 17',
        quantidade: 24,
        area_m2: 28.8,
        foto_url: null,
      },
    ],
    historico: trilha(OS_9, [
      { status: 'recebido', em: '2026-08-14T08:00:00.000Z', por: ROGERIO },
      { status: 'pre_tratamento', em: '2026-08-17T07:30:00.000Z', por: ROGERIO },
      { status: 'aplicacao_po', em: '2026-08-19T10:00:00.000Z', por: ROGERIO },
      { status: 'cura', em: '2026-08-19T14:30:00.000Z', por: ROGERIO },
      { status: 'controle_qualidade', em: '2026-08-20T09:00:00.000Z', por: MARINA },
      { status: 'embalagem', em: '2026-08-24T08:00:00.000Z', por: ROGERIO },
      { status: 'finalizado', em: '2026-08-26T11:00:00.000Z', por: ROGERIO },
    ]),
  },
]

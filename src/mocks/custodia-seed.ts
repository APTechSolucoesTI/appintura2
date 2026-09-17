import type { RomaneioDevolucao, RomaneioRecebimento } from '@/types/custodia'

import { CLIENTES, TRANSPORTADORAS } from './cadastros-seed'
import { TENANTS, USERS } from './seed'

/**
 * Seed da Fase 2. Como na Fase 1, só a Matriz tem dados.
 *
 * As datas são relativas a setembro/2026 para produzir os dois casos que o painel
 * de custódia precisa mostrar: entrada recente e peça parada além do limite de
 * alerta (padrão de 15 dias).
 */

const MATRIZ = TENANTS[0].id
const CLEITON = USERS[2] // portaria
const ANDRADE = CLIENTES[0]
const VALE_DO_ACO = CLIENTES[1]
const GIRASSOL = TRANSPORTADORAS[0]

/**
 * Placeholder honesto: um SVG que se identifica como exemplo, em vez de uma foto
 * de banco de imagens fingindo ser registro de conferência.
 */
function fotoPlaceholder(rotulo: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">
    <rect width="480" height="360" fill="#e2eaf3"/>
    <rect x="12" y="12" width="456" height="336" fill="none" stroke="#1a6b8a" stroke-width="2" stroke-dasharray="8 6"/>
    <text x="240" y="170" font-family="monospace" font-size="20" fill="#0d2b5e" text-anchor="middle">${rotulo}</text>
    <text x="240" y="200" font-family="monospace" font-size="13" fill="#4a5568" text-anchor="middle">foto de exemplo</text>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function assinaturaPlaceholder(nome: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="140">
    <rect width="420" height="140" fill="#ffffff"/>
    <path d="M30 100 C70 40, 110 120, 150 70 S 230 30, 270 85 S 340 110, 390 60"
      fill="none" stroke="#1a1a2e" stroke-width="2.5" stroke-linecap="round"/>
    <text x="210" y="128" font-family="monospace" font-size="11" fill="#4a5568" text-anchor="middle">${nome}</text>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const RECEBIMENTO_1 = 'a1a1a1a1-0000-4000-8000-000000000001'
const RECEBIMENTO_2 = 'a1a1a1a1-0000-4000-8000-000000000002'

export const ITEM_PERFIL = 'b1b1b1b1-0000-4000-8000-000000000001'
export const ITEM_CANTONEIRA = 'b1b1b1b1-0000-4000-8000-000000000002'
export const ITEM_PORTAO = 'b1b1b1b1-0000-4000-8000-000000000003'
export const ITEM_GRADE = 'b1b1b1b1-0000-4000-8000-000000000004'

export const RECEBIMENTOS: RomaneioRecebimento[] = [
  {
    id: RECEBIMENTO_1,
    tenant_id: MATRIZ,
    numero: 1,
    cliente_id: ANDRADE.id,
    transportadora_id: GIRASSOL.id,
    data_hora: '2026-09-10T08:40:00.000Z',
    documento_numero: '10422',
    documento_serie: '1',
    documento_chave: '',
    conferente_id: CLEITON.id,
    conferente_nome: CLEITON.nome,
    status: 'recebido_conferido',
    observacao: '',
    assinatura_url: assinaturaPlaceholder('Motorista — Transportes Girassol'),
    assinatura_nome: 'Jair Peixoto',
    os_id: null,
    created_at: '2026-09-10T08:40:00.000Z',
    itens: [
      {
        id: ITEM_PERFIL,
        romaneio_id: RECEBIMENTO_1,
        descricao: 'Perfil de alumínio 6063 — barra de 3 m',
        quantidade: 120,
        unidade: 'peca',
        peso_kg: 340,
        condicao_chegada: 'integra',
        observacao: '',
        fotos: [
          {
            id: 'f1-0001',
            url: fotoPlaceholder('Perfil 6063 — entrada'),
            nome: 'perfil-6063-entrada.svg',
            capturada_em: '2026-09-10T08:42:00.000Z',
          },
        ],
      },
      {
        id: ITEM_CANTONEIRA,
        romaneio_id: RECEBIMENTO_1,
        descricao: 'Cantoneira de alumínio 1"',
        quantidade: 60,
        unidade: 'peca',
        peso_kg: 85,
        condicao_chegada: 'integra',
        observacao: '',
        fotos: [
          {
            id: 'f1-0002',
            url: fotoPlaceholder('Cantoneira 1" — entrada'),
            nome: 'cantoneira-entrada.svg',
            capturada_em: '2026-09-10T08:45:00.000Z',
          },
        ],
      },
    ],
  },
  {
    // Entrada antiga: aciona o alerta de peça parada no painel de custódia.
    id: RECEBIMENTO_2,
    tenant_id: MATRIZ,
    numero: 2,
    cliente_id: VALE_DO_ACO.id,
    transportadora_id: null,
    data_hora: '2026-08-20T14:15:00.000Z',
    documento_numero: '8891',
    documento_serie: '2',
    documento_chave: '',
    conferente_id: CLEITON.id,
    conferente_nome: CLEITON.nome,
    status: 'recebido_com_ressalva',
    observacao: 'Veículo próprio do cliente. Um portão chegou com avaria aparente.',
    assinatura_url: assinaturaPlaceholder('Wagner Pimenta — Portões Vale do Aço'),
    assinatura_nome: 'Wagner Pimenta',
    os_id: null,
    created_at: '2026-08-20T14:15:00.000Z',
    itens: [
      {
        id: ITEM_PORTAO,
        romaneio_id: RECEBIMENTO_2,
        descricao: 'Portão de correr 3,5 m x 2,2 m',
        quantidade: 4,
        unidade: 'conjunto',
        peso_kg: 260,
        condicao_chegada: 'avariada',
        observacao: 'Uma unidade com a trave inferior amassada, fotografada na chegada.',
        fotos: [
          {
            id: 'f2-0001',
            url: fotoPlaceholder('Portão — visão geral'),
            nome: 'portao-geral.svg',
            capturada_em: '2026-08-20T14:18:00.000Z',
          },
          {
            id: 'f2-0002',
            url: fotoPlaceholder('Portão — avaria na trave'),
            nome: 'portao-avaria.svg',
            capturada_em: '2026-08-20T14:19:00.000Z',
          },
        ],
      },
      {
        id: ITEM_GRADE,
        romaneio_id: RECEBIMENTO_2,
        descricao: 'Grade de proteção 1,2 m x 1,0 m',
        quantidade: 24,
        unidade: 'peca',
        peso_kg: 190,
        condicao_chegada: 'integra',
        observacao: '',
        fotos: [
          {
            id: 'f2-0003',
            url: fotoPlaceholder('Grade de proteção — entrada'),
            nome: 'grade-entrada.svg',
            capturada_em: '2026-08-20T14:22:00.000Z',
          },
        ],
      },
    ],
  },
]

const DEVOLUCAO_1 = 'c1c1c1c1-0000-4000-8000-000000000001'

/**
 * Devolução parcial: sai tudo do perfil e só parte das cantoneiras, com
 * justificativa. É o que faz o painel de saldo ter saldo diferente de zero e o
 * comparativo ter o que comparar.
 */
export const DEVOLUCOES: RomaneioDevolucao[] = [
  {
    id: DEVOLUCAO_1,
    tenant_id: MATRIZ,
    numero: 1,
    cliente_id: ANDRADE.id,
    recebimento_ids: [RECEBIMENTO_1],
    data_hora: '2026-09-12T16:30:00.000Z',
    retirado_por_nome: 'Jair Peixoto',
    retirado_por_documento: '48291077312',
    transportadora_id: GIRASSOL.id,
    placa: 'RQK7A21',
    status: 'retirado_parcial',
    assinatura_url: assinaturaPlaceholder('Jair Peixoto'),
    responsavel_id: CLEITON.id,
    responsavel_nome: CLEITON.nome,
    created_at: '2026-09-12T16:30:00.000Z',
    itens: [
      {
        id: 'd1-0001',
        romaneio_devolucao_id: DEVOLUCAO_1,
        recebimento_item_id: ITEM_PERFIL,
        descricao: 'Perfil de alumínio 6063 — barra de 3 m',
        quantidade: 120,
        unidade: 'peca',
        condicao_saida: 'integra',
        justificativa: '',
        fotos: [
          {
            id: 'f3-0001',
            url: fotoPlaceholder('Perfil 6063 — saída'),
            nome: 'perfil-saida.svg',
            capturada_em: '2026-09-12T16:32:00.000Z',
          },
        ],
      },
      {
        id: 'd1-0002',
        romaneio_devolucao_id: DEVOLUCAO_1,
        recebimento_item_id: ITEM_CANTONEIRA,
        descricao: 'Cantoneira de alumínio 1"',
        quantidade: 40,
        unidade: 'peca',
        condicao_saida: 'integra',
        justificativa: '20 peças retidas para retrabalho de espessura.',
        fotos: [
          {
            id: 'f3-0002',
            url: fotoPlaceholder('Cantoneira — saída'),
            nome: 'cantoneira-saida.svg',
            capturada_em: '2026-09-12T16:34:00.000Z',
          },
        ],
      },
    ],
  },
]

import type { CentroCusto, ContaPagar, ContaReceber } from '@/types/financeiro'

import { CLIENTES } from './cadastros-seed'
import { ORDENS_SERVICO } from './producao-seed'
import { TENANTS, USERS } from './seed'

/**
 * Seed da Fase 5. Cobre os estados que o financeiro precisa saber exibir:
 * em aberto, parcialmente pago, pago, vencido com régua de cobrança e negociado.
 *
 * Datas relativas a setembro/2026.
 */

const MATRIZ = TENANTS[0].id
const MARINA = USERS[0]

const ANDRADE = CLIENTES[0]
const VALE_DO_ACO = CLIENTES[1]
const BELMIRO = CLIENTES[2]

export const CC_PRODUCAO = 'cc000001-0000-4000-8000-000000000001'
export const CC_COMERCIAL = 'cc000001-0000-4000-8000-000000000002'
export const CC_ADMIN = 'cc000001-0000-4000-8000-000000000003'

export const CENTROS_CUSTO: CentroCusto[] = [
  {
    id: CC_PRODUCAO,
    tenant_id: MATRIZ,
    nome: 'Produção — cabine e forno',
    tipo: 'producao',
    created_at: '2026-01-05T12:00:00.000Z',
  },
  {
    id: CC_COMERCIAL,
    tenant_id: MATRIZ,
    nome: 'Comercial',
    tipo: 'comercial',
    created_at: '2026-01-05T12:00:00.000Z',
  },
  {
    id: CC_ADMIN,
    tenant_id: MATRIZ,
    nome: 'Administrativo',
    tipo: 'administrativo',
    created_at: '2026-01-05T12:00:00.000Z',
  },
]

export const CONTAS_RECEBER: ContaReceber[] = [
  {
    // Vencido há 12 dias, com régua de cobrança — bate com os 12 dias de
    // inadimplência que o cliente já mostrava no cadastro da Fase 1.
    id: 'cr000001-0000-4000-8000-000000000001',
    tenant_id: MATRIZ,
    cliente_id: VALE_DO_ACO.id,
    os_id: ORDENS_SERVICO[3].id,
    os_numero: ORDENS_SERVICO[3].numero,
    descricao: 'Pintura de grades — OS 0004',
    valor: 1344,
    vencimento: '2026-09-03',
    status: 'em_aberto',
    forma_pagamento: 'boleto',
    centro_custo_id: CC_PRODUCAO,
    parcela: null,
    total_parcelas: null,
    pagamentos: [],
    cobrancas: [
      {
        id: 'cb000001-0000-4000-8000-000000000001',
        conta_receber_id: 'cr000001-0000-4000-8000-000000000001',
        data: '2026-09-08',
        canal: 'whatsapp',
        responsavel_id: MARINA.id,
        responsavel_nome: MARINA.nome,
        resultado: 'promessa_pagamento',
        observacao: 'Wagner prometeu pagar até dia 15.',
      },
      {
        id: 'cb000001-0000-4000-8000-000000000002',
        conta_receber_id: 'cr000001-0000-4000-8000-000000000001',
        data: '2026-09-14',
        canal: 'telefone',
        responsavel_id: MARINA.id,
        responsavel_nome: MARINA.nome,
        resultado: 'sem_retorno',
        observacao: 'Ligação não atendida.',
      },
    ],
    created_at: '2026-08-20T12:00:00.000Z',
  },
  {
    id: 'cr000001-0000-4000-8000-000000000002',
    tenant_id: MATRIZ,
    cliente_id: ANDRADE.id,
    os_id: ORDENS_SERVICO[4].id,
    os_numero: ORDENS_SERVICO[4].numero,
    descricao: 'Pintura de perfis 6063 — OS 0005',
    valor: 2095.2,
    vencimento: '2026-09-25',
    status: 'em_aberto',
    forma_pagamento: 'pix',
    centro_custo_id: CC_PRODUCAO,
    parcela: null,
    total_parcelas: null,
    pagamentos: [],
    cobrancas: [],
    created_at: '2026-09-12T12:00:00.000Z',
  },
  {
    // Parcialmente pago: metade entrou, metade continua em aberto.
    id: 'cr000001-0000-4000-8000-000000000003',
    tenant_id: MATRIZ,
    cliente_id: ANDRADE.id,
    os_id: null,
    os_numero: null,
    descricao: 'Fechamento quinzenal — 1ª quinzena de agosto',
    valor: 8400,
    vencimento: '2026-09-10',
    status: 'em_aberto',
    forma_pagamento: 'transferencia',
    centro_custo_id: CC_PRODUCAO,
    parcela: null,
    total_parcelas: null,
    pagamentos: [
      {
        id: 'pg000001-0000-4000-8000-000000000001',
        conta_receber_id: 'cr000001-0000-4000-8000-000000000003',
        data_pagamento: '2026-09-10',
        valor_pago: 4200,
        juros_multa: 0,
      },
    ],
    cobrancas: [],
    created_at: '2026-08-16T12:00:00.000Z',
  },
  {
    id: 'cr000001-0000-4000-8000-000000000004',
    tenant_id: MATRIZ,
    cliente_id: BELMIRO.id,
    os_id: null,
    os_numero: null,
    descricao: 'Pintura de rodas — lote avulso',
    valor: 960,
    vencimento: '2026-08-28',
    status: 'em_aberto',
    forma_pagamento: 'pix',
    centro_custo_id: CC_PRODUCAO,
    parcela: null,
    total_parcelas: null,
    pagamentos: [
      {
        id: 'pg000001-0000-4000-8000-000000000002',
        conta_receber_id: 'cr000001-0000-4000-8000-000000000004',
        data_pagamento: '2026-08-27',
        valor_pago: 960,
        juros_multa: 0,
      },
    ],
    cobrancas: [],
    created_at: '2026-08-14T12:00:00.000Z',
  },
  {
    id: 'cr000001-0000-4000-8000-000000000005',
    tenant_id: MATRIZ,
    cliente_id: VALE_DO_ACO.id,
    os_id: null,
    os_numero: null,
    descricao: 'Contrato Vale do Aço — parcela 2/3',
    valor: 12000,
    vencimento: '2026-10-05',
    status: 'em_aberto',
    forma_pagamento: 'boleto',
    centro_custo_id: CC_PRODUCAO,
    parcela: 2,
    total_parcelas: 3,
    pagamentos: [],
    cobrancas: [],
    created_at: '2026-08-05T12:00:00.000Z',
  },
  {
    // Negociado: saiu da régua de cobrança por acordo.
    id: 'cr000001-0000-4000-8000-000000000006',
    tenant_id: MATRIZ,
    cliente_id: BELMIRO.id,
    os_id: null,
    os_numero: null,
    descricao: 'Pintura de esquadrias — saldo renegociado',
    valor: 1800,
    vencimento: '2026-10-20',
    status: 'negociado',
    forma_pagamento: 'pix',
    centro_custo_id: CC_PRODUCAO,
    parcela: null,
    total_parcelas: null,
    pagamentos: [],
    cobrancas: [
      {
        id: 'cb000001-0000-4000-8000-000000000003',
        conta_receber_id: 'cr000001-0000-4000-8000-000000000006',
        data: '2026-09-02',
        canal: 'presencial',
        responsavel_id: MARINA.id,
        responsavel_nome: MARINA.nome,
        resultado: 'negociado',
        observacao: 'Prazo estendido para 20/10 sem juros.',
      },
    ],
    created_at: '2026-07-18T12:00:00.000Z',
  },
  {
    id: 'cr000001-0000-4000-8000-000000000007',
    tenant_id: MATRIZ,
    cliente_id: ANDRADE.id,
    os_id: null,
    os_numero: null,
    descricao: 'Fechamento quinzenal — 2ª quinzena de julho',
    valor: 7250,
    vencimento: '2026-08-10',
    status: 'em_aberto',
    forma_pagamento: 'transferencia',
    centro_custo_id: CC_PRODUCAO,
    parcela: null,
    total_parcelas: null,
    pagamentos: [
      {
        id: 'pg000001-0000-4000-8000-000000000003',
        conta_receber_id: 'cr000001-0000-4000-8000-000000000007',
        data_pagamento: '2026-08-10',
        valor_pago: 7250,
        juros_multa: 0,
      },
    ],
    cobrancas: [],
    created_at: '2026-07-31T12:00:00.000Z',
  },
]

export const CONTAS_PAGAR: ContaPagar[] = [
  {
    id: 'cp000001-0000-4000-8000-000000000001',
    tenant_id: MATRIZ,
    fornecedor: 'Sherwin-Williams',
    descricao: 'Tinta em pó RAL 9005 — 75 kg',
    categoria: 'insumo_direto',
    valor: 2617.5,
    vencimento: '2026-09-20',
    status: 'em_aberto',
    recorrente: false,
    centro_custo_id: CC_PRODUCAO,
    data_pagamento: null,
    created_at: '2026-02-10T12:00:00.000Z',
  },
  {
    id: 'cp000001-0000-4000-8000-000000000002',
    tenant_id: MATRIZ,
    fornecedor: 'Cemig',
    descricao: 'Energia elétrica — agosto',
    categoria: 'fixa',
    valor: 8940,
    vencimento: '2026-09-18',
    status: 'em_aberto',
    recorrente: true,
    centro_custo_id: CC_PRODUCAO,
    data_pagamento: null,
    created_at: '2026-09-01T12:00:00.000Z',
  },
  {
    // Vencida: aparece em vermelho no painel.
    id: 'cp000001-0000-4000-8000-000000000003',
    tenant_id: MATRIZ,
    fornecedor: 'Quimatec Produtos Químicos',
    descricao: 'Desengraxante DX-40 — 400 L',
    categoria: 'insumo_direto',
    valor: 4320,
    vencimento: '2026-09-08',
    status: 'em_aberto',
    recorrente: false,
    centro_custo_id: CC_PRODUCAO,
    data_pagamento: null,
    created_at: '2026-03-12T12:00:00.000Z',
  },
  {
    id: 'cp000001-0000-4000-8000-000000000004',
    tenant_id: MATRIZ,
    fornecedor: 'Contabilidade Reis',
    descricao: 'Honorários contábeis — setembro',
    categoria: 'fixa',
    valor: 1850,
    vencimento: '2026-09-30',
    status: 'em_aberto',
    recorrente: true,
    centro_custo_id: CC_ADMIN,
    data_pagamento: null,
    created_at: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'cp000001-0000-4000-8000-000000000005',
    tenant_id: MATRIZ,
    fornecedor: 'Gasmig',
    descricao: 'Gás do forno — agosto',
    categoria: 'variavel',
    valor: 5120,
    vencimento: '2026-09-05',
    status: 'em_aberto',
    recorrente: true,
    centro_custo_id: CC_PRODUCAO,
    data_pagamento: '2026-09-04',
    created_at: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'cp000001-0000-4000-8000-000000000006',
    tenant_id: MATRIZ,
    fornecedor: 'Folha de pagamento',
    descricao: 'Salários e encargos — setembro',
    categoria: 'fixa',
    valor: 28400,
    vencimento: '2026-10-05',
    status: 'em_aberto',
    recorrente: true,
    centro_custo_id: CC_PRODUCAO,
    data_pagamento: null,
    created_at: '2026-09-01T12:00:00.000Z',
  },
]

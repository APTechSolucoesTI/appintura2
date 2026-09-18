import { describe, expect, it } from 'vitest'

import { exigeRotaExata } from '@/components/layout/nav-config'
import { podeAcessar } from '@/features/auth/permissions'
import {
  STATUS_ORCAMENTO,
  STATUS_ORCAMENTO_LABEL,
  STATUS_ORCAMENTO_TOM,
  ehEditavel,
  estaEmAberto,
  podeRevisar,
  totalDosItens,
} from '@/types/orcamento'

/**
 * Regras que vivem no frontend.
 *
 * Toda asserção aqui corresponde a um bug que já aconteceu — não são testes
 * escritos por completude. Os de regra de banco ficam em `supabase/tests/`.
 */

describe('navegação', () => {
  it('exige rota exata quando o caminho é prefixo de outro', () => {
    // O bug: `/app/orcamentos` e `/app/orcamentos/funil` ficavam os dois
    // destacados na barra lateral ao abrir o funil.
    expect(exigeRotaExata('/app/orcamentos')).toBe(true)
  })

  it('não exige rota exata em item sem sub-rota', () => {
    expect(exigeRotaExata('/app/qualidade')).toBe(false)
    expect(exigeRotaExata('/app/orcamentos/funil')).toBe(false)
  })
})

describe('permissões de orçamento', () => {
  it('libera o módulo para quem trata de preço', () => {
    expect(podeAcessar('admin', 'orcamentos')).toBe(true)
    expect(podeAcessar('gestor_producao', 'orcamentos')).toBe(true)
    expect(podeAcessar('financeiro', 'orcamentos')).toBe(true)
  })

  it('esconde de quem não deve ver margem', () => {
    // Espelha `pode_gerenciar_orcamento()` no banco. Se um dos dois mudar sem o
    // outro, a tela some mas o dado continua acessível — ou o contrário.
    expect(podeAcessar('operador_pintura', 'orcamentos')).toBe(false)
    expect(podeAcessar('qualidade', 'orcamentos')).toBe(false)
    expect(podeAcessar('portaria', 'orcamentos')).toBe(false)
  })
})

describe('estados do orçamento', () => {
  it('só o rascunho é editável direto', () => {
    expect(ehEditavel('rascunho')).toBe(true)

    for (const status of STATUS_ORCAMENTO.filter((s) => s !== 'rascunho')) {
      expect(ehEditavel(status), status).toBe(false)
    }
  })

  it('permite revisar recusado e expirado, não só os em aberto', () => {
    // O banco sempre permitiu; a tela escondia o botão. Recusa é justamente
    // quando se faz nova proposta.
    expect(podeRevisar('rejeitado')).toBe(true)
    expect(podeRevisar('expirado')).toBe(true)
    expect(podeRevisar('convertido')).toBe(false)
    expect(podeRevisar('rascunho')).toBe(false)
  })

  it('distingue "em aberto" de "pode revisar"', () => {
    // São perguntas diferentes: uma é "o cliente ainda decide", a outra é "dá
    // para fazer outra versão". Usar uma no lugar da outra foi o bug RN03.
    expect(estaEmAberto('rejeitado')).toBe(false)
    expect(podeRevisar('rejeitado')).toBe(true)
  })

  it('tem rótulo e tom para TODO status do enum', () => {
    // Status novo sem rótulo renderiza `undefined` na tabela; sem tom, o selo
    // sai sem classe e fica invisível sobre o fundo.
    for (const status of STATUS_ORCAMENTO) {
      expect(STATUS_ORCAMENTO_LABEL[status], status).toBeTruthy()
      expect(STATUS_ORCAMENTO_TOM[status], status).toBeTruthy()
    }
  })

  it('marca aprovação parcial em âmbar, não em verde', () => {
    // Fechou negócio, mas parte da proposta caiu — o vendedor precisa olhar.
    expect(STATUS_ORCAMENTO_TOM.aprovado).toBe('success')
    expect(STATUS_ORCAMENTO_TOM.aprovado_parcial).toBe('warning')
  })
})

describe('total dos itens', () => {
  it('soma quantidade x unitário', () => {
    expect(
      totalDosItens([
        { quantidade: 2, valor_unitario: 300 },
        { quantidade: 5, valor_unitario: 100 },
      ]),
    ).toBe(1100)
  })

  it('arredonda cada linha antes de somar', () => {
    // Somar primeiro e arredondar depois dá centavo diferente do que o banco
    // calcula, e aí a tela mostra um total e o cliente recebe outro.
    expect(totalDosItens([{ quantidade: 3, valor_unitario: 0.335 }])).toBe(1.01)
  })

  it('devolve zero para lista vazia', () => {
    expect(totalDosItens([])).toBe(0)
  })
})

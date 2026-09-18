import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { BadgeStatusOrcamento } from '@/features/orcamentos/components/badge-orcamento'
import { PreRequisitosOrcamento } from '@/features/orcamentos/components/pre-requisitos'

/**
 * Testes que de fato RENDERIZAM.
 *
 * Os bugs visuais desta sessão — selo fora do padrão, item de menu duplicado,
 * mensagem errada no portal — todos passaram por baixo da suíte de banco,
 * porque ela não abre tela nenhuma. Estes fecham essa lacuna nos pontos onde
 * já houve erro.
 */

function comRotas(no: React.ReactNode) {
  return render(<MemoryRouter>{no}</MemoryRouter>)
}

describe('selo de status do orçamento', () => {
  it('usa o utilitário `selo`, como os demais selos do app', () => {
    // O bug: usava `<Badge variant="outline">` do shadcn, que traz borda e
    // tipografia próprias, e a aba Comercial destoava de custódia e estoque.
    const { container } = render(<BadgeStatusOrcamento status="aprovado" />)

    expect(container.firstElementChild).toHaveClass('selo')
  })

  it('pinta cada situação com o tom correspondente', () => {
    const { container: verde } = render(<BadgeStatusOrcamento status="aprovado" />)
    expect(verde.firstElementChild).toHaveClass('bg-status-success-soft')

    const { container: ambar } = render(
      <BadgeStatusOrcamento status="aprovado_parcial" />,
    )
    expect(ambar.firstElementChild).toHaveClass('bg-status-warning-soft')

    const { container: vermelho } = render(<BadgeStatusOrcamento status="rejeitado" />)
    expect(vermelho.firstElementChild).toHaveClass('bg-status-danger-soft')
  })

  it('escreve o rótulo em português, não o valor do enum', () => {
    render(<BadgeStatusOrcamento status="alteracao_solicitada" />)

    expect(screen.getByText('Alteração solicitada')).toBeInTheDocument()
  })
})

describe('pré-requisitos do orçamento', () => {
  it('não aparece quando cliente e cor já existem', () => {
    const { container } = comRotas(
      <PreRequisitosOrcamento temCliente temCor />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('avisa e leva ao cadastro quando falta cor', () => {
    // Antes disto o `<Select>` de cor aparecia vazio, sem dizer por quê.
    comRotas(<PreRequisitosOrcamento temCliente temCor={false} />)

    expect(screen.getByText('Nenhuma cor cadastrada')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Cadastrar cor/ })).toHaveAttribute(
      'href',
      '/app/cadastros/cores',
    )
  })

  it('lista os dois quando a empresa está vazia', () => {
    comRotas(<PreRequisitosOrcamento temCliente={false} temCor={false} />)

    expect(screen.getByText('Nenhum cliente cadastrado')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma cor cadastrada')).toBeInTheDocument()
  })
})

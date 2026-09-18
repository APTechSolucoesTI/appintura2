import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O painel inicial precisa DIZER quando falha.
 *
 * O bug que originou este teste tinha duas metades. A primeira era um select
 * errado no store de custódia (corrigido, e coberto por
 * `supabase/tests/selects-dos-stores.sh`). A segunda é a que este arquivo trava:
 * `if (painelQuery.isPending || !painelQuery.data)` mandava falha e carregamento
 * para o mesmo lugar, então a tela mostrava esqueleto INDEFINIDAMENTE — sem
 * erro, sem explicação, sem botão de tentar de novo.
 *
 * O resultado foi um relato de "não tem nada na tela de painel" para o que era,
 * na verdade, uma consulta devolvendo 400. A primeira metade volta a acontecer
 * um dia; a segunda é o que decide se ela vai ser diagnosticável.
 */

vi.mock('@/services/configuracoes-service', () => ({
  obterConfiguracoes: vi.fn(),
  CONFIGURACOES_PADRAO: {},
}))

vi.mock('@/services/indicadores-service', () => ({
  montarPainel: vi.fn(),
}))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ user: { nome: 'Henrique Rufino' } }),
}))

vi.mock('@/features/tenant/tenant-context', () => ({
  useTenant: () => ({
    tenantAtivo: { id: 'tenant-1', nome_fantasia: 'APTech' },
  }),
}))

const { obterConfiguracoes } = await import('@/services/configuracoes-service')
const { montarPainel } = await import('@/services/indicadores-service')
const { InicioPage } = await import('@/pages/app/inicio')

function montar() {
  // `retry: false` para a asserção medir a primeira falha, e não esperar as
  // tentativas que o TanStack Query faria em produção.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InicioPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('painel inicial quando a consulta falha', () => {
  beforeEach(() => {
    vi.mocked(obterConfiguracoes).mockReset()
    vi.mocked(montarPainel).mockReset()
  })

  it('mostra erro e oferta de recarregar quando o painel quebra', async () => {
    vi.mocked(obterConfiguracoes).mockResolvedValue({
      tenant_id: 'tenant-1',
      dias_alerta_custodia: 15,
    } as never)

    // É literalmente o erro que o PostgREST devolvia.
    vi.mocked(montarPainel).mockRejectedValue(
      new Error(
        "Could not find a relationship between 'romaneios_recebimento' and 'romaneio_fotos'",
      ),
    )

    montar()

    expect(
      await screen.findByText(/Não foi possível carregar os indicadores/i),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: /tentar novamente/i }),
    ).toBeInTheDocument()
  })

  it('também avisa quando quem falha é a configuração do tenant', async () => {
    // Desde que as configurações saíram do localStorage, ler parâmetro é ida à
    // rede — e pode falhar como qualquer outra.
    vi.mocked(obterConfiguracoes).mockRejectedValue(new Error('rede indisponível'))

    montar()

    expect(
      await screen.findByText(/Não foi possível carregar os indicadores/i),
    ).toBeInTheDocument()
  })

  it('não confunde carregando com falhou', async () => {
    vi.mocked(obterConfiguracoes).mockResolvedValue({
      tenant_id: 'tenant-1',
      dias_alerta_custodia: 15,
    } as never)

    // Promessa que nunca resolve: o estado legítimo de "ainda carregando".
    vi.mocked(montarPainel).mockReturnValue(new Promise(() => {}) as never)

    montar()

    await waitFor(() => {
      expect(
        screen.queryByText(/Não foi possível carregar os indicadores/i),
      ).not.toBeInTheDocument()
    })
  })
})

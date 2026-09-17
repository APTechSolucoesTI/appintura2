import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { CarregandoRota } from '@/components/layout/carregando-rota'
import { EntrarPage } from '@/pages/entrar'
import { HomePage } from '@/pages/home'
import { NaoEncontradaPage } from '@/pages/nao-encontrada'
import { ModuloRoute } from '@/routes/modulo-route'
import { ProtectedLayout } from '@/routes/protected-layout'

/**
 * Cada módulo vira um chunk próprio. A portaria abre o app no tablet e só usa
 * recebimento — não faz sentido baixar o Kanban, os gráficos e o financeiro
 * junto.
 *
 * O painel inicial também é lazy: ele usa recharts, e importá-lo de forma
 * estática arrastaria a biblioteca inteira para o bundle que a homepage e a
 * tela de login carregam.
 */
const InicioPage = lazy(() =>
  import('@/pages/app/inicio').then((m) => ({ default: m.InicioPage })),
)
const CadastrosLayout = lazy(() =>
  import('@/features/cadastros/components/cadastros-layout').then((m) => ({
    default: m.CadastrosLayout,
  })),
)
const ClientesPage = lazy(() =>
  import('@/pages/app/cadastros/clientes').then((m) => ({ default: m.ClientesPage })),
)
const ClienteDetalhePage = lazy(() =>
  import('@/pages/app/cadastros/cliente-detalhe').then((m) => ({
    default: m.ClienteDetalhePage,
  })),
)
const TabelasPrecoPage = lazy(() =>
  import('@/pages/app/cadastros/tabelas-preco').then((m) => ({
    default: m.TabelasPrecoPage,
  })),
)
const CoresPage = lazy(() =>
  import('@/pages/app/cadastros/cores').then((m) => ({ default: m.CoresPage })),
)
const InsumosPage = lazy(() =>
  import('@/pages/app/cadastros/insumos').then((m) => ({ default: m.InsumosPage })),
)
const TransportadorasPage = lazy(() =>
  import('@/pages/app/cadastros/transportadoras').then((m) => ({
    default: m.TransportadorasPage,
  })),
)

const CustodiaLayout = lazy(() =>
  import('@/features/custodia/components/custodia-layout').then((m) => ({
    default: m.CustodiaLayout,
  })),
)
const PainelCustodiaPage = lazy(() =>
  import('@/pages/app/custodia/painel-custodia').then((m) => ({
    default: m.PainelCustodiaPage,
  })),
)
const RecebimentosPage = lazy(() =>
  import('@/pages/app/custodia/recebimentos').then((m) => ({
    default: m.RecebimentosPage,
  })),
)
const RecebimentoDetalhePage = lazy(() =>
  import('@/pages/app/custodia/recebimento-detalhe').then((m) => ({
    default: m.RecebimentoDetalhePage,
  })),
)
const NovoRecebimentoPage = lazy(() =>
  import('@/pages/app/custodia/novo-recebimento').then((m) => ({
    default: m.NovoRecebimentoPage,
  })),
)
const DevolucoesPage = lazy(() =>
  import('@/pages/app/custodia/devolucoes').then((m) => ({ default: m.DevolucoesPage })),
)
const DevolucaoDetalhePage = lazy(() =>
  import('@/pages/app/custodia/devolucao-detalhe').then((m) => ({
    default: m.DevolucaoDetalhePage,
  })),
)
const NovaDevolucaoPage = lazy(() =>
  import('@/pages/app/custodia/nova-devolucao').then((m) => ({
    default: m.NovaDevolucaoPage,
  })),
)

const ProducaoLayout = lazy(() =>
  import('@/features/producao/components/producao-layout').then((m) => ({
    default: m.ProducaoLayout,
  })),
)
const KanbanPage = lazy(() =>
  import('@/pages/app/producao/kanban').then((m) => ({ default: m.KanbanPage })),
)
const OrdensListaPage = lazy(() =>
  import('@/pages/app/producao/ordens-lista').then((m) => ({
    default: m.OrdensListaPage,
  })),
)
const OrdemDetalhePage = lazy(() =>
  import('@/pages/app/producao/ordem-detalhe').then((m) => ({
    default: m.OrdemDetalhePage,
  })),
)
const NovaOrdemPage = lazy(() =>
  import('@/pages/app/producao/nova-ordem').then((m) => ({ default: m.NovaOrdemPage })),
)
const ConsultaPublicaPage = lazy(() =>
  import('@/pages/consulta-os').then((m) => ({ default: m.ConsultaPublicaPage })),
)
const ConsultaRomaneioPage = lazy(() =>
  import('@/pages/consulta-romaneio').then((m) => ({
    default: m.ConsultaRomaneioPage,
  })),
)

const ConfiguracoesLayout = lazy(() =>
  import('@/features/configuracoes/components/configuracoes-layout').then((m) => ({
    default: m.ConfiguracoesLayout,
  })),
)
const EquipePage = lazy(() =>
  import('@/pages/app/configuracoes/equipe').then((m) => ({ default: m.EquipePage })),
)
const OperacaoPage = lazy(() =>
  import('@/pages/app/configuracoes/operacao').then((m) => ({ default: m.OperacaoPage })),
)

const EstoqueLayout = lazy(() =>
  import('@/features/estoque/components/estoque-layout').then((m) => ({
    default: m.EstoqueLayout,
  })),
)
const PosicaoEstoquePage = lazy(() =>
  import('@/pages/app/estoque/posicao').then((m) => ({ default: m.PosicaoEstoquePage })),
)
const MovimentacoesPage = lazy(() =>
  import('@/pages/app/estoque/movimentacoes').then((m) => ({
    default: m.MovimentacoesPage,
  })),
)

const QualidadeLayout = lazy(() =>
  import('@/features/qualidade/components/qualidade-layout').then((m) => ({
    default: m.QualidadeLayout,
  })),
)
const InspecoesPage = lazy(() =>
  import('@/pages/app/qualidade/inspecoes').then((m) => ({ default: m.InspecoesPage })),
)
const NaoConformidadesPage = lazy(() =>
  import('@/pages/app/qualidade/nao-conformidades').then((m) => ({
    default: m.NaoConformidadesPage,
  })),
)
const IndicadoresPage = lazy(() =>
  import('@/pages/app/qualidade/indicadores').then((m) => ({
    default: m.IndicadoresPage,
  })),
)

const FinanceiroLayout = lazy(() =>
  import('@/features/financeiro/components/financeiro-layout').then((m) => ({
    default: m.FinanceiroLayout,
  })),
)
const PainelFinanceiroPage = lazy(() =>
  import('@/pages/app/financeiro/painel').then((m) => ({
    default: m.PainelFinanceiroPage,
  })),
)
const ReceberPage = lazy(() =>
  import('@/pages/app/financeiro/receber').then((m) => ({ default: m.ReceberPage })),
)
const PagarPage = lazy(() =>
  import('@/pages/app/financeiro/pagar').then((m) => ({ default: m.PagarPage })),
)
const FluxoCaixaPage = lazy(() =>
  import('@/pages/app/financeiro/fluxo-caixa').then((m) => ({
    default: m.FluxoCaixaPage,
  })),
)
const CustosPage = lazy(() =>
  import('@/pages/app/financeiro/custos').then((m) => ({ default: m.CustosPage })),
)
const ConfigFinanceiroPage = lazy(() =>
  import('@/pages/app/configuracoes/financeiro').then((m) => ({
    default: m.ConfigFinanceiroPage,
  })),
)
const NotificacoesPage = lazy(() =>
  import('@/pages/app/notificacoes').then((m) => ({ default: m.NotificacoesPage })),
)

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<CarregandoRota />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/entrar" element={<EntrarPage />} />
          {/* Consultas públicas apontadas pelos QR codes — sem login. */}
          <Route path="/os/:id" element={<ConsultaPublicaPage />} />
          <Route path="/romaneio/:tipo/:id" element={<ConsultaRomaneioPage />} />

          <Route path="/app" element={<ProtectedLayout />}>
            <Route index element={<InicioPage />} />
            {/* Sem ModuloRoute: a central de notificações vale para todo papel. */}
            <Route path="notificacoes" element={<NotificacoesPage />} />

            <Route
              path="cadastros"
              element={
                <ModuloRoute modulo="cadastros">
                  <CadastrosLayout />
                </ModuloRoute>
              }
            >
              <Route index element={<Navigate to="clientes" replace />} />
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="clientes/:id" element={<ClienteDetalhePage />} />
              <Route path="tabelas-preco" element={<TabelasPrecoPage />} />
              <Route path="cores" element={<CoresPage />} />
              <Route path="insumos" element={<InsumosPage />} />
              <Route path="transportadoras" element={<TransportadorasPage />} />
            </Route>

            {/* Os assistentes ficam fora do layout de abas: na portaria a tela
                precisa ser uma etapa por vez, sem navegação competindo. */}
            <Route
              path="recebimento/recebimentos/novo"
              element={
                <ModuloRoute modulo="recebimento">
                  <NovoRecebimentoPage />
                </ModuloRoute>
              }
            />
            <Route
              path="recebimento/devolucoes/nova"
              element={
                <ModuloRoute modulo="recebimento">
                  <NovaDevolucaoPage />
                </ModuloRoute>
              }
            />
            <Route
              path="recebimento"
              element={
                <ModuloRoute modulo="recebimento">
                  <CustodiaLayout />
                </ModuloRoute>
              }
            >
              <Route index element={<Navigate to="custodia" replace />} />
              <Route path="custodia" element={<PainelCustodiaPage />} />
              <Route path="recebimentos" element={<RecebimentosPage />} />
              <Route path="recebimentos/:id" element={<RecebimentoDetalhePage />} />
              <Route path="devolucoes" element={<DevolucoesPage />} />
              <Route path="devolucoes/:id" element={<DevolucaoDetalhePage />} />
            </Route>

            <Route
              path="ordens-servico/nova"
              element={
                <ModuloRoute modulo="ordens_servico">
                  <NovaOrdemPage />
                </ModuloRoute>
              }
            />
            <Route
              path="ordens-servico"
              element={
                <ModuloRoute modulo="ordens_servico">
                  <ProducaoLayout />
                </ModuloRoute>
              }
            >
              <Route index element={<Navigate to="kanban" replace />} />
              <Route path="kanban" element={<KanbanPage />} />
              <Route path="lista" element={<OrdensListaPage />} />
              <Route path=":id" element={<OrdemDetalhePage />} />
            </Route>

            <Route
              path="qualidade"
              element={
                <ModuloRoute modulo="qualidade">
                  <QualidadeLayout />
                </ModuloRoute>
              }
            >
              <Route index element={<Navigate to="inspecoes" replace />} />
              <Route path="inspecoes" element={<InspecoesPage />} />
              <Route path="nao-conformidades" element={<NaoConformidadesPage />} />
              <Route path="indicadores" element={<IndicadoresPage />} />
            </Route>

            <Route
              path="estoque"
              element={
                <ModuloRoute modulo="estoque">
                  <EstoqueLayout />
                </ModuloRoute>
              }
            >
              <Route index element={<Navigate to="posicao" replace />} />
              <Route path="posicao" element={<PosicaoEstoquePage />} />
              <Route path="movimentacoes" element={<MovimentacoesPage />} />
            </Route>
            <Route
              path="financeiro"
              element={
                <ModuloRoute modulo="financeiro">
                  <FinanceiroLayout />
                </ModuloRoute>
              }
            >
              <Route index element={<Navigate to="painel" replace />} />
              <Route path="painel" element={<PainelFinanceiroPage />} />
              <Route path="receber" element={<ReceberPage />} />
              <Route path="pagar" element={<PagarPage />} />
              <Route path="fluxo-caixa" element={<FluxoCaixaPage />} />
              <Route path="custos" element={<CustosPage />} />
            </Route>

            <Route
              path="configuracoes"
              element={
                <ModuloRoute modulo="configuracoes">
                  <ConfiguracoesLayout />
                </ModuloRoute>
              }
            >
              <Route index element={<Navigate to="equipe" replace />} />
              <Route path="equipe" element={<EquipePage />} />
              <Route path="operacao" element={<OperacaoPage />} />
              <Route path="financeiro" element={<ConfigFinanceiroPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NaoEncontradaPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

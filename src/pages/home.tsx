import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Camera,
  Check,
  ClipboardList,
  Gauge,
  PackageCheck,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const RECURSOS = [
  {
    icon: ClipboardList,
    titulo: 'Kanban de produção',
    ganho: 'Chão de fábrica sem planilha',
    descricao:
      'Pré-tratamento, aplicação de pó, cura, qualidade e embalagem em colunas. O operador arrasta o card no tablet e o histórico de quem mexeu fica gravado.',
  },
  {
    icon: Camera,
    titulo: 'Romaneio com foto e assinatura',
    ganho: 'Peça de terceiro com prova de entrada e saída',
    descricao:
      'A portaria fotografa cada item, registra a condição de chegada e colhe a assinatura na tela. Divergência de quantidade some do "eu achei que tinha mandado 40".',
  },
  {
    icon: PackageCheck,
    titulo: 'Saldo de custódia em tempo real',
    ganho: 'Você sabe o que é seu e o que é do cliente',
    descricao:
      'Recebido menos devolvido, por cliente e por item, com alerta de peça parada há mais de X dias no seu pátio.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Controle de qualidade',
    ganho: 'Laudo pronto antes do cliente pedir',
    descricao:
      'Espessura medida em micron contra a faixa exigida, teste de aderência e registro de não conformidade com causa e ação corretiva.',
  },
  {
    icon: Boxes,
    titulo: 'Estoque de tinta e químicos',
    ganho: 'Baixa automática por m² pintado',
    descricao:
      'Consumo estimado pelo rendimento em g/m² da cor, alerta de estoque mínimo, controle de lote e validade de desengraxante e fosfatizante.',
  },
  {
    icon: TrendingUp,
    titulo: 'Custo real por m²',
    ganho: 'Preço com margem, não com achismo',
    descricao:
      'Tinta consumida, energia e gás do forno, mão de obra e insumos químicos comparados ao preço cobrado, por cliente e por tipo de acabamento.',
  },
  {
    icon: Wallet,
    titulo: 'Financeiro com régua de cobrança',
    ganho: 'Inadimplência que não vira surpresa',
    descricao:
      'Faturamento por OS avulsa, fechamento quinzenal ou contrato, juros por atraso configurável e histórico de cada contato de cobrança.',
  },
  {
    icon: Gauge,
    titulo: 'Indicadores de produção',
    ganho: 'Retrabalho e SLA medidos, não estimados',
    descricao:
      'M² pintados por período, consumo de tinta por m², taxa de retrabalho por operador e prazo prometido contra o realizado.',
  },
]

const PLANOS = [
  {
    nome: 'Essencial',
    preco: 'R$ 249',
    resumo: 'Para a oficina que quer sair do caderno e da planilha.',
    itens: [
      '1 CNPJ',
      'Até 5 usuários',
      'Cadastros, romaneios e custódia',
      'Ordem de serviço e Kanban',
    ],
    destaque: false,
  },
  {
    nome: 'Profissional',
    preco: 'R$ 489',
    resumo: 'Para quem precisa fechar o custo e cobrar em dia.',
    itens: [
      '1 CNPJ',
      'Usuários ilimitados',
      'Tudo do Essencial',
      'Qualidade, estoque e financeiro completo',
      'Custo real por m² e margem por cliente',
    ],
    destaque: true,
  },
  {
    nome: 'Enterprise',
    preco: 'Sob consulta',
    resumo: 'Para grupo com matriz e filiais no mesmo painel.',
    itens: [
      'Múltiplos CNPJs',
      'Tudo do Profissional',
      'Indicadores consolidados por filial',
      'Suporte prioritário',
    ],
    destaque: false,
  },
]

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 lg:px-6">
          <Logo />

          <nav aria-label="Seções" className="hidden flex-1 gap-6 md:flex">
            <a
              href="#recursos"
              className="text-sm font-medium text-brand-muted hover:text-brand-dark"
            >
              Recursos
            </a>
            <a
              href="#custodia"
              className="text-sm font-medium text-brand-muted hover:text-brand-dark"
            >
              Custódia
            </a>
            <a
              href="#planos"
              className="text-sm font-medium text-brand-muted hover:text-brand-dark"
            >
              Planos
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Button asChild variant="ghost">
              <Link to="/entrar">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/entrar">Testar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      <Hero />
      <Recursos />
      <Custodia />
      <Planos />
      <Rodape />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-gradient">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,rgba(0,194,203,0.35),transparent)]"
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-6 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 font-mono text-xs text-white backdrop-blur-sm">
            ERP para pintura eletrostática a pó
          </span>

          <h1 className="mt-6 text-[2rem] leading-[1.12] font-bold text-white sm:text-4xl lg:text-[2.75rem] xl:text-5xl">
            <span className="block text-balance">A peça é do cliente.</span>
            <span className="block text-balance">A responsabilidade é sua.</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg text-white/85">
            O APPintura controla o que entra no seu pátio, o que está no forno e o que
            já saiu — com foto, assinatura e custo real por m² pintado. Da portaria ao
            fechamento financeiro, num sistema só.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-white text-brand-dark hover:bg-white/90"
            >
              <Link to="/entrar">
                Testar grátis por 7 dias
                <ArrowRight aria-hidden />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
            >
              <a href="#recursos">Ver recursos</a>
            </Button>
          </div>

          <p className="mt-4 text-sm text-white/70">
            Sem cartão de crédito. Sem instalação no servidor da fábrica.
          </p>
        </div>

        <PainelCustodiaGlass />
      </div>
    </section>
  )
}

/** Prévia do produto no hero — único lugar onde o glassmorphism é usado. */
function PainelCustodiaGlass() {
  const linhas = [
    { cliente: 'Esquadrias Andrade', recebido: 180, devolvido: 180, dias: 0 },
    { cliente: 'Portões Vale Aço', recebido: 64, devolvido: 40, dias: 6 },
    { cliente: 'Rodas Belmiro', recebido: 32, devolvido: 0, dias: 23 },
  ]

  return (
    <div className="rounded-card border border-white/20 bg-white/10 p-5 shadow-card-hover backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <p className="font-heading text-sm font-bold text-white">Saldo de custódia</p>
        <span className="font-mono text-[0.65rem] tracking-wider text-white/70 uppercase">
          Tempo real
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {linhas.map((linha) => {
          const saldo = linha.recebido - linha.devolvido
          const alerta = linha.dias >= 15

          return (
            <li
              key={linha.cliente}
              className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">
                  {linha.cliente}
                </span>
                <span className="block font-mono text-xs text-white/65">
                  {linha.recebido} recebidas · {linha.devolvido} devolvidas
                </span>
              </span>

              <span
                className={
                  alerta
                    ? 'selo bg-status-warning-soft text-status-warning-strong'
                    : 'selo bg-white/15 text-white'
                }
              >
                {saldo === 0 ? 'zerado' : `${saldo} em custódia`}
              </span>
            </li>
          )
        })}
      </ul>

      <p className="mt-4 flex items-center gap-2 text-xs text-white/70">
        <BadgeCheck className="size-4 shrink-0 text-brand-accent" aria-hidden />
        Cada item com foto de entrada e assinatura de quem retirou.
      </p>
    </div>
  )
}

function Recursos() {
  return (
    <section id="recursos" className="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-24">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-bold text-brand-dark lg:text-4xl">
          Cada recurso resolve um problema que você já teve
        </h2>
        <p className="mt-3 text-brand-muted">
          Nada de módulo genérico de ERP. O APPintura foi desenhado em cima da rotina de
          quem recebe peça de terceiro, pinta e devolve.
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {RECURSOS.map((recurso) => (
          <Card key={recurso.titulo} className="card-interactive h-full">
            <CardHeader>
              <span className="mb-1 grid size-10 place-items-center rounded-lg bg-accent">
                <recurso.icon className="size-5 text-brand-medium" aria-hidden />
              </span>
              <CardTitle>{recurso.titulo}</CardTitle>
              <p className="font-mono text-xs text-brand-medium">{recurso.ganho}</p>
            </CardHeader>

            <CardContent>
              <p className="text-sm text-brand-muted">{recurso.descricao}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function Custodia() {
  const etapas = [
    {
      titulo: 'Entrada conferida',
      texto:
        'Romaneio numerado por empresa, nota de remessa do cliente, foto obrigatória por item e condição de chegada registrada.',
    },
    {
      titulo: 'Produção rastreada',
      texto:
        'A OS nasce vinculada ao romaneio. Cor RAL, faixa de espessura e pré-tratamento exigido ficam presos ao item, não à memória do operador.',
    },
    {
      titulo: 'Saída com assinatura',
      texto:
        'Na devolução o sistema compara quantidade recebida e devolvida e trava a divergência não justificada antes de liberar a retirada.',
    },
  ]

  return (
    <section id="custodia" className="border-y border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:px-6 lg:py-24">
        <div>
          <span className="font-mono text-xs tracking-[0.14em] text-brand-medium uppercase">
            O diferencial
          </span>
          <h2 className="mt-3 text-3xl font-bold text-brand-dark lg:text-4xl">
            Custódia separada da produção
          </h2>
          <p className="mt-4 text-brand-muted">
            Na pintura eletrostática o material não é seu. Se sumir uma peça, a conta é
            sua. Por isso o controle físico da mercadoria vive em um registro próprio,
            independente do status de produção — e não some quando a OS é finalizada.
          </p>

          <Button asChild className="mt-6" size="lg">
            <Link to="/entrar">
              Começar agora
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        <ol className="space-y-4">
          {etapas.map((etapa, index) => (
            <li
              key={etapa.titulo}
              className="flex gap-4 rounded-card border border-border bg-background p-5"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-dark font-mono text-sm font-semibold text-white">
                {index + 1}
              </span>

              <span>
                <span className="block font-heading font-bold text-brand-dark">
                  {etapa.titulo}
                </span>
                <span className="mt-1 block text-sm text-brand-muted">{etapa.texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Planos() {
  return (
    <section id="planos" className="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold text-brand-dark lg:text-4xl">
          Planos por empresa, não por peça pintada
        </h2>
        <p className="mt-3 text-brand-muted">
          Sete dias de teste em qualquer plano. Você troca de plano quando a produção
          crescer, sem migrar dado nenhum.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLANOS.map((plano) => (
          <Card
            key={plano.nome}
            className={
              plano.destaque
                ? 'relative h-full ring-2 ring-brand-medium'
                : 'card-interactive h-full'
            }
          >
            {plano.destaque && (
              <span className="absolute top-4 right-4 rounded-full bg-brand-accent px-2.5 py-1 font-mono text-[0.65rem] font-semibold tracking-wide text-brand-dark uppercase">
                Mais usado
              </span>
            )}

            <CardHeader>
              <CardTitle className="text-lg">{plano.nome}</CardTitle>
              <p className="mt-1 font-heading text-3xl font-bold text-brand-dark">
                {plano.preco}
                {plano.preco.startsWith('R$') && (
                  <span className="ml-1 font-sans text-sm font-normal text-brand-muted">
                    /mês
                  </span>
                )}
              </p>
              <p className="mt-2 text-sm text-brand-muted">{plano.resumo}</p>
            </CardHeader>

            <CardContent>
              <ul className="space-y-2.5">
                {plano.itens.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-brand-text">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-brand-accent"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="mt-6 w-full"
                size="lg"
                variant={plano.destaque ? 'default' : 'outline'}
              >
                <Link to="/entrar">
                  {plano.preco === 'Sob consulta' ? 'Falar com o time' : 'Testar grátis'}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function Rodape() {
  return (
    <footer className="bg-brand-dark">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-white/65 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <Logo tom="claro" size="sm" />
        <p>Feito para quem pinta peça de terceiro e responde por ela.</p>
        <p className="font-mono text-xs">© {new Date().getFullYear()} APPintura</p>
      </div>
    </footer>
  )
}

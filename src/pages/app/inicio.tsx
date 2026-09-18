import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CircleAlert,
  CircleDollarSign,
  Droplets,
  RotateCcw,
  Timer,
  TimerReset,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link } from 'react-router-dom'

import { CartaoKpi } from '@/components/data/cartao-kpi'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { TooltipGrafico } from '@/features/financeiro/components/grafico-base'
import { BadgeUrgencia } from '@/features/producao/components/badges-producao'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatCurrency, formatDate } from '@/lib/format'
import { obterConfiguracoes } from '@/services/configuracoes-service'
import { montarPainel } from '@/services/indicadores-service'
import { diasParaEntrega } from '@/types/producao'

function saudacao(): string {
  const hora = new Date().getHours()

  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'

  return 'Boa noite'
}

function numero(valor: number, casas = 0): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

export function InicioPage() {
  const { user } = useAuth()
  const { tenantAtivo } = useTenant()

  const configQuery = useQuery({
    queryKey: ['configuracoes', tenantAtivo.id],
    queryFn: () => obterConfiguracoes(tenantAtivo.id),
  })

  const painelQuery = useQuery({
    queryKey: ['painel', tenantAtivo.id, configQuery.data],
    queryFn: () => montarPainel(tenantAtivo.id, configQuery.data!),
    enabled: Boolean(configQuery.data),
  })

  const primeiroNome = user?.nome.split(' ').at(0) ?? ''

  // Falha e carregamento eram o mesmo ramo, e `!painelQuery.data` engolia os
  // dois: quando o painel quebrava, a tela mostrava esqueleto PARA SEMPRE, sem
  // erro, sem dica, sem como tentar de novo. Foi assim que um select errado no
  // store de custódia virou "o painel está vazio" em vez de "a consulta falhou".
  if (painelQuery.isError || configQuery.isError) {
    return (
      <>
        <PageHeader titulo={`${saudacao()}, ${primeiroNome}`} />
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            Não foi possível carregar os indicadores.
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void configQuery.refetch()
                void painelQuery.refetch()
              }}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </>
    )
  }

  if (painelQuery.isPending || !painelQuery.data) {
    return (
      <>
        <PageHeader titulo={`${saudacao()}, ${primeiroNome}`} />
        <Skeleton className="h-96 w-full" />
      </>
    )
  }

  const painel = painelQuery.data

  return (
    <>
      <PageHeader
        sobretitulo={tenantAtivo.nome_fantasia}
        titulo={`${saudacao()}, ${primeiroNome}.`}
        descricao="O que precisa da sua atenção hoje — produção, custódia e financeiro no mesmo lugar."
      />

      {/* Faixa de abertura: os três números que resumem o dia, sem precisar rolar. */}
      <section className="bg-surface-gradient mb-6 rounded-xl px-5 py-6 text-white sm:px-7">
        <p className="eyebrow text-brand-accent!">Pulso da operação</p>

        <dl className="mt-4 grid gap-5 sm:grid-cols-3">
          <Pulso
            rotulo="m² pintados no mês"
            valor={`${numero(painel.producao.m2Mes, 1)} m²`}
          />
          <Pulso
            rotulo="Unidades em custódia"
            valor={`${numero(painel.custodia.unidades)} un.`}
          />
          <Pulso
            rotulo="OS em atraso"
            valor={String(painel.osEmAtraso.length)}
            alerta={painel.osEmAtraso.length > 0}
          />
        </dl>
      </section>

      {/* O topo é reservado ao que exige ação hoje. */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        <CardAtencao
          titulo="OS em atraso"
          icone={AlertTriangle}
          total={painel.osEmAtraso.length}
          vazio="Nenhuma ordem passou do prazo."
          verTudo="/app/ordens-servico/lista"
        >
          {painel.osEmAtraso.slice(0, 5).map((os) => (
            <li key={os.id}>
              <Link
                to={`/app/ordens-servico/${os.id}`}
                className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-muted"
              >
                <span className="font-mono text-xs font-semibold text-brand-medium">
                  #{String(os.numero).padStart(4, '0')}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-brand-dark">
                    {formatDate(os.previsao_entrega)}
                  </span>
                  <span className="block font-mono text-xs text-status-danger-strong">
                    {Math.abs(diasParaEntrega(os))} dia(s) de atraso
                  </span>
                </span>

                <BadgeUrgencia urgencia={os.urgencia} />
              </Link>
            </li>
          ))}
        </CardAtencao>

        <CardAtencao
          titulo={`Peças paradas há ${painel.diasAlertaCustodia}+ dias`}
          icone={Timer}
          total={painel.pecasParadas.length}
          vazio="Nada parado além do limite configurado."
          verTudo="/app/recebimento/custodia"
        >
          {painel.pecasParadas.slice(0, 5).map((item) => (
            <li
              key={item.recebimento_item_id}
              className="flex min-h-11 items-center gap-3 px-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-brand-dark">
                  {item.descricao}
                </span>
                <span className="block font-mono text-xs text-muted-foreground">
                  romaneio #{String(item.recebimento_numero).padStart(4, '0')} ·{' '}
                  {item.saldo} unidade(s)
                </span>
              </span>

              <span className="selo shrink-0 bg-status-warning-soft text-status-warning-strong">
                {item.dias_em_custodia}d
              </span>
            </li>
          ))}
        </CardAtencao>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CartaoKpi
          icon={Droplets}
          rotulo="Consumo de pó"
          valor={
            painel.producao.consumoRealGm2 === null
              ? '—'
              : `${numero(painel.producao.consumoRealGm2, 0)} g/m²`
          }
          detalhe={
            painel.producao.desvioConsumo === null
              ? 'Sem OS pintada ainda'
              : `${painel.producao.desvioConsumo > 0 ? '+' : ''}${numero(painel.producao.desvioConsumo, 1)}% sobre a ficha técnica`
          }
          tom={
            painel.producao.desvioConsumo && painel.producao.desvioConsumo > 15
              ? 'critico'
              : 'neutro'
          }
        />

        <CartaoKpi
          icon={RotateCcw}
          rotulo="Taxa de retrabalho"
          valor={`${numero(painel.retrabalho.taxa, 1)}%`}
          detalhe={`${painel.retrabalho.comRetrabalho} de ${painel.retrabalho.base} OS na cabine`}
          tom={painel.retrabalho.taxa > 10 ? 'critico' : 'neutro'}
        />

        <CartaoKpi
          icon={CalendarCheck}
          rotulo="Entrega no prazo"
          valor={
            painel.sla.finalizadas === 0
              ? '—'
              : `${numero(painel.sla.percentualNoPrazo, 0)}%`
          }
          detalhe={
            painel.sla.finalizadas === 0
              ? 'Nenhuma OS finalizada'
              : `${painel.sla.noPrazo} de ${painel.sla.finalizadas} finalizadas`
          }
          tom={painel.sla.finalizadas > 0 && painel.sla.percentualNoPrazo < 80 ? 'critico' : 'neutro'}
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CartaoKpi
          icon={CalendarClock}
          rotulo="Prazo prometido"
          valor={
            painel.sla.finalizadas === 0
              ? '—'
              : `${numero(painel.sla.prazoPrometidoMedio, 1)} dias`
          }
          detalhe="Média da entrada até a data prometida"
        />

        <CartaoKpi
          icon={TimerReset}
          rotulo="Prazo realizado"
          valor={
            painel.sla.finalizadas === 0
              ? '—'
              : `${numero(painel.sla.prazoRealizadoMedio, 1)} dias`
          }
          detalhe="Média da entrada até a entrega"
          tom={painel.sla.prazoRealizadoMedio > painel.sla.prazoPrometidoMedio ? 'critico' : 'neutro'}
        />

        <CartaoKpi
          icon={CircleDollarSign}
          rotulo="Inadimplência"
          valor={`${numero(painel.financeiro.inadimplenciaPercentual, 1)}%`}
          detalhe={`${formatCurrency(painel.financeiro.valorVencido)} vencidos`}
          tom={painel.financeiro.inadimplenciaPercentual > 0 ? 'critico' : 'neutro'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>m² pintados por mês</CardTitle>
            <p className="text-sm text-muted-foreground">
              Contados na entrada da OS na cabine — é quando a tinta foi aplicada.
            </p>
          </CardHeader>

          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={painel.m2PorMes.map((mes) => ({
                    rotulo: mes.rotulo,
                    'm² pintados': Math.round(mes.m2),
                  }))}
                  margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="rotulo"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--color-muted)' }}
                    content={
                      <TooltipGrafico formatar={(valor) => `${numero(valor)} m²`} />
                    }
                  />
                  {/* Série única: o título do card já a nomeia, então sem legenda. */}
                  <Bar
                    dataKey="m² pintados"
                    fill="var(--color-serie-1)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de clientes</CardTitle>
            <p className="text-sm text-muted-foreground">
              Por margem das OS faturadas, com o volume pintado ao lado.
            </p>
          </CardHeader>

          <CardContent>
            {painel.ranking.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma OS faturada ainda — a margem aparece quando houver título
                vinculado à ordem.
              </p>
            ) : (
              <ul className="space-y-3">
                {painel.ranking.map((cliente) => (
                  <li
                    key={cliente.cliente_id}
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-brand-dark">
                        {cliente.cliente_nome}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {numero(cliente.m2, 1)} m² pintados
                      </span>
                    </span>

                    <span className="text-right">
                      <span
                        className={`block font-mono text-sm font-semibold ${
                          cliente.margem >= 0
                            ? 'text-status-success-strong'
                            : 'text-status-danger-strong'
                        }`}
                      >
                        {formatCurrency(cliente.margem)}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {numero(cliente.margemPercentual, 1)}% de margem
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-brand-muted">
            Saldo projetado de caixa para os próximos 30 dias:{' '}
            <strong
              className={`font-mono ${
                painel.financeiro.saldo30 < 0
                  ? 'text-status-danger-strong'
                  : 'text-status-success-strong'
              }`}
            >
              {formatCurrency(painel.financeiro.saldo30)}
            </strong>
          </p>

          <Link
            to="/app/financeiro/fluxo-caixa"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-medium hover:underline"
          >
            Ver fluxo de caixa
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </CardContent>
      </Card>
    </>
  )
}

function CardAtencao({
  titulo,
  icone: Icone,
  total,
  vazio,
  verTudo,
  children,
}: {
  titulo: string
  icone: React.ElementType
  total: number
  vazio: string
  verTudo: string
  children: React.ReactNode
}) {
  return (
    <Card className={total > 0 ? 'ring-1 ring-status-danger/30' : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`grid size-8 place-items-center rounded-lg ${
                total > 0
                  ? 'bg-status-danger-soft text-status-danger-strong'
                  : 'bg-status-success-soft text-status-success-strong'
              }`}
            >
              <Icone className="size-4" aria-hidden />
            </span>

            <CardTitle>{titulo}</CardTitle>
          </div>

          <span className="font-heading text-2xl font-bold text-brand-dark">
            {total}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {total === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <>
            <ul className="space-y-1">{children}</ul>

            {total > 5 && (
              <Link
                to={verTudo}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-medium hover:underline"
              >
                Ver os {total}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}


/** Item da faixa de abertura: número grande sobre o gradiente escuro. */
function Pulso({
  rotulo,
  valor,
  alerta = false,
}: {
  rotulo: string
  valor: string
  alerta?: boolean
}) {
  return (
    <div>
      <dt className="font-mono text-[0.65rem] tracking-[0.14em] text-white/60 uppercase">
        {rotulo}
      </dt>
      <dd
        className={`mt-1 font-heading text-3xl font-extrabold tracking-tight ${
          alerta ? 'text-status-warning-soft' : 'text-white'
        }`}
      >
        {valor}
      </dd>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BadgeInadimplencia } from '@/features/cadastros/components/badge-inadimplencia'
import {
  BadgeAtraso,
  BadgeStatusOs,
} from '@/features/producao/components/badges-producao'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDocumento, mascararCep, mascararTelefone } from '@/lib/documento'
import { formatCurrency, formatDate } from '@/lib/format'
import { clientesStore, tabelasPrecoStore } from '@/services/cadastros-service'
import { ordensDoCliente } from '@/services/producao-service'
import { UNIDADE_LABEL } from '@/types/cadastros'
import { areaTotal, diasParaEntrega, estaAtrasada } from '@/types/producao'

export function ClienteDetalhePage() {
  const { id = '' } = useParams()
  const { tenantAtivo } = useTenant()

  const clienteQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id, id],
    queryFn: () => clientesStore.obter(tenantAtivo.id, id),
    retry: false,
  })

  const tabelasQuery = useQuery({
    queryKey: ['tabelas-preco', tenantAtivo.id],
    queryFn: () => tabelasPrecoStore.listar(tenantAtivo.id),
  })

  if (clienteQuery.isPending) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <span className="sr-only">Carregando ficha do cliente</span>
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Inclui o caso de tentar abrir pelo id um cliente de OUTRA empresa: o store
  // não devolve registro fora do tenant ativo, então cai aqui.
  if (clienteQuery.isError || !clienteQuery.data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold text-brand-dark">Cliente não encontrado</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Este cliente não existe em {tenantAtivo.nome_fantasia} ou foi excluído.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/app/cadastros/clientes">Voltar para a lista</Link>
        </Button>
      </div>
    )
  }

  const cliente = clienteQuery.data
  const tabela = tabelasQuery.data?.find(
    (item) => item.id === cliente.tabela_preco_id,
  )

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link to="/app/cadastros/clientes">
          <ArrowLeft aria-hidden />
          Clientes
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-brand-dark lg:text-3xl">
            {cliente.razao_social}
          </h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {formatDocumento(cliente.cnpj_cpf)} · cliente desde{' '}
            {formatDate(cliente.created_at)}
          </p>
        </div>

        <BadgeInadimplencia
          dias={cliente.dias_inadimplencia_atual}
          ativo={cliente.ativo}
        />
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados cadastrais</TabsTrigger>
          <TabsTrigger value="historico">Histórico de OS</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <Card>
              <CardHeader>
                <CardTitle>Contato</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Dado rotulo="Nome" valor={cliente.contato_nome} />
                <Dado
                  rotulo="Telefone"
                  valor={mascararTelefone(cliente.contato_telefone)}
                  mono
                />
                <Dado
                  rotulo="E-mail"
                  valor={cliente.contato_email || '—'}
                  className="sm:col-span-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Endereço</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Dado
                  rotulo="Logradouro"
                  valor={`${cliente.logradouro}, ${cliente.numero}${
                    cliente.complemento ? ` — ${cliente.complemento}` : ''
                  }`}
                  className="sm:col-span-2"
                />
                <Dado rotulo="Bairro" valor={cliente.bairro} />
                <Dado rotulo="CEP" valor={mascararCep(cliente.cep)} mono />
                <Dado
                  rotulo="Cidade"
                  valor={`${cliente.cidade}/${cliente.uf}`}
                  className="sm:col-span-2"
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Comercial</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Dado rotulo="Tabela de preço" valor={tabela?.nome ?? '—'} />
                  <Dado
                    rotulo="Limite de crédito"
                    valor={formatCurrency(cliente.limite_credito)}
                    mono
                  />
                  <Dado
                    rotulo="Inadimplência"
                    valor={
                      cliente.dias_inadimplencia_atual > 0
                        ? `${cliente.dias_inadimplencia_atual} dias`
                        : 'Em dia'
                    }
                    mono
                  />
                </div>

                {tabela && tabela.itens.length > 0 && (
                  <ul className="mt-5 divide-y divide-border rounded-card border border-border">
                    {tabela.itens.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                      >
                        <span className="text-brand-text">{item.tipo_acabamento}</span>
                        <span className="font-mono text-brand-dark">
                          {formatCurrency(item.valor)}{' '}
                          <span className="text-xs text-muted-foreground">
                            {UNIDADE_LABEL[item.unidade]}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-5">
          <HistoricoOs clienteId={cliente.id} clienteNome={cliente.razao_social} />
        </TabsContent>
      </Tabs>
    </>
  )
}

/** Aba de histórico: as OS deste cliente, da mais recente para a mais antiga. */
function HistoricoOs({
  clienteId,
  clienteNome,
}: {
  clienteId: string
  clienteNome: string
}) {
  const { tenantAtivo } = useTenant()

  const ordensQuery = useQuery({
    queryKey: ['ordens-servico', tenantAtivo.id, 'cliente', clienteId],
    queryFn: () => ordensDoCliente(tenantAtivo.id, clienteId),
  })

  if (ordensQuery.isPending) {
    return <Skeleton className="h-48 w-full" />
  }

  const ordens = ordensQuery.data ?? []

  if (ordens.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-accent">
            <ClipboardList className="size-5 text-brand-medium" aria-hidden />
          </span>

          <h2 className="text-base font-semibold text-brand-dark">
            Sem ordens de serviço ainda
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">
            Nenhuma OS foi aberta para {clienteNome} nesta empresa.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">OS</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Área</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead className="text-right">Entrega</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {ordens.map((os) => (
            <TableRow key={os.id}>
              <TableCell>
                <Link
                  to={`/app/ordens-servico/${os.id}`}
                  className="font-mono text-sm font-semibold text-brand-medium hover:underline"
                >
                  #{String(os.numero).padStart(4, '0')}
                </Link>
              </TableCell>

              <TableCell className="font-mono text-xs text-brand-muted">
                {formatDate(os.data_entrada)}
              </TableCell>

              <TableCell className="hidden text-right font-mono text-sm text-brand-text sm:table-cell">
                {areaTotal(os.itens).toLocaleString('pt-BR')} m²
              </TableCell>

              <TableCell>
                <BadgeStatusOs status={os.status} />
              </TableCell>

              <TableCell className="text-right">
                {estaAtrasada(os) ? (
                  <BadgeAtraso dias={Math.abs(diasParaEntrega(os))} />
                ) : (
                  <span className="font-mono text-xs text-brand-muted">
                    {formatDate(os.previsao_entrega)}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function Dado({
  rotulo,
  valor,
  mono = false,
  className,
}: {
  rotulo: string
  valor: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
        {rotulo}
      </p>
      <p className={mono ? 'mt-1 font-mono text-brand-dark' : 'mt-1 text-brand-dark'}>
        {valor}
      </p>
    </div>
  )
}

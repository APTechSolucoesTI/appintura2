import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, CircleAlert, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { ListaRegistros } from '@/components/data/lista-registros'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { descricaoDoCampo } from '@/features/cadastros/aria'
import { Campo } from '@/features/cadastros/components/campo'
import { FormSheet } from '@/features/cadastros/components/form-sheet'
import { dataObrigatoria, numeroPositivo, paraNumero } from '@/features/cadastros/validacao'
import { useAuth } from '@/features/auth/auth-context'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDate } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import {
  EstoqueError,
  posicaoEstoque,
  registrarMovimento,
  movimentacoesStore,
} from '@/services/estoque-service'
import {
  MOTIVO_PERDA_LABEL,
  MOTIVOS_PERDA,
  TIPO_MOVIMENTO_LABEL,
  TIPOS_MOVIMENTO,
  type TipoMovimento,
} from '@/types/estoque'

const schema = z.object({
  item: z.string().min(1, 'Selecione o item.'),
  quantidade: numeroPositivo('Informe a quantidade.'),
  lote: z.string(),
  data: dataObrigatoria('Informe a data.'),
  motivo_perda: z.enum(MOTIVOS_PERDA),
  observacao: z.string(),
})

type FormValues = z.infer<typeof schema>

/** O select carrega tipo e id juntos: cor e insumo podem ter ids de tabelas diferentes. */
function chaveItem(tipo: string, id: string) {
  return `${tipo}:${id}`
}

export function MovimentacoesPage() {
  const { tenantAtivo } = useTenant()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | TipoMovimento>('todos')
  const [modo, setModo] = useState<'entrada' | 'perda' | null>(null)

  const movimentosQuery = useQuery({
    queryKey: ['estoque-movimentacoes', tenantAtivo.id],
    queryFn: () => movimentacoesStore.listar(tenantAtivo.id),
  })

  const posicaoQuery = useQuery({
    queryKey: ['estoque-posicao', tenantAtivo.id],
    queryFn: () => posicaoEstoque(tenantAtivo.id),
  })

  const itens = posicaoQuery.data ?? []
  const registros = useMemo(() => movimentosQuery.data ?? [], [movimentosQuery.data])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca)

    return registros.filter((movimento) => {
      if (filtro !== 'todos' && movimento.tipo_movimento !== filtro) return false
      if (!termo) return true

      return (
        normalizar(movimento.item_descricao).includes(termo) ||
        normalizar(movimento.observacao).includes(termo) ||
        String(movimento.os_numero ?? '').includes(termo)
      )
    })
  }, [registros, busca, filtro])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      item: '',
      quantidade: '',
      lote: '',
      data: new Date().toISOString().slice(0, 10),
      motivo_perda: 'quebra_embalagem',
      observacao: '',
    },
  })

  const { reset } = form

  useEffect(() => {
    if (!modo) return

    reset({
      item: '',
      quantidade: '',
      lote: '',
      data: new Date().toISOString().slice(0, 10),
      motivo_perda: 'quebra_embalagem',
      observacao: '',
    })
  }, [modo, reset])

  const itemSelecionado = useWatch({ control: form.control, name: 'item' })
  const item = itens.find((candidato) => chaveItem(candidato.tipo_item, candidato.id) === itemSelecionado)

  const salvar = useMutation({
    mutationFn: async (valores: FormValues) => {
      if (!item) throw new EstoqueError('Selecione um item válido.')

      return registrarMovimento(tenantAtivo.id, {
        tipo_item: item.tipo_item,
        item_id: item.id,
        item_descricao: item.descricao,
        tipo_movimento: modo === 'perda' ? 'perda' : 'entrada',
        quantidade: paraNumero(valores.quantidade),
        unidade: item.unidade,
        lote: valores.lote.trim() || item.lote,
        motivo_perda: modo === 'perda' ? valores.motivo_perda : null,
        observacao: valores.observacao.trim(),
        os_id: null,
        os_numero: null,
        data: valores.data,
        responsavel_id: user?.id ?? '',
        responsavel_nome: user?.nome ?? '',
      })
    },
    onSuccess: async (movimento) => {
      await queryClient.invalidateQueries({
        queryKey: ['estoque-movimentacoes', tenantAtivo.id],
      })
      await queryClient.invalidateQueries({
        queryKey: ['estoque-posicao', tenantAtivo.id],
      })
      // O saldo vive nas tabelas de cadastro, então elas também ficam obsoletas.
      await queryClient.invalidateQueries({ queryKey: ['cores', tenantAtivo.id] })
      await queryClient.invalidateQueries({ queryKey: ['insumos', tenantAtivo.id] })

      setModo(null)
      toast.success(
        movimento.tipo_movimento === 'entrada'
          ? 'Entrada registrada'
          : 'Perda registrada',
        { description: `${movimento.item_descricao} · ${movimento.quantidade} ${movimento.unidade}` },
      )
    },
    onError: (erro) => {
      toast.error('Não foi possível registrar', {
        description:
          erro instanceof EstoqueError
            ? erro.message
            : 'Tente novamente em instantes.',
      })
    },
  })

  const erros = form.formState.errors

  return (
    <>
      <PageHeader
        sobretitulo="Entradas e baixas"
        titulo="Movimentações de estoque"
        descricao="Entradas de compra, saídas para produção e perdas. A saída de tinta é lançada automaticamente pela OS."
        acoes={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setModo('perda')}>
              <TriangleAlert aria-hidden />
              Registrar perda
            </Button>

            <Button onClick={() => setModo('entrada')}>
              <ArrowDownToLine aria-hidden />
              Registrar entrada
            </Button>
          </div>
        }
      />

      <ListaRegistros
        busca={busca}
        aoBuscar={setBusca}
        placeholderBusca="Buscar por item, OS ou observação"
        filtros={
          <Select
            value={filtro}
            onValueChange={(valor) => setFiltro(valor as 'todos' | TipoMovimento)}
          >
            <SelectTrigger className="w-52" aria-label="Filtrar por tipo de movimento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os movimentos</SelectItem>
              {TIPOS_MOVIMENTO.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {TIPO_MOVIMENTO_LABEL[tipo]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        carregando={movimentosQuery.isPending}
        erro={movimentosQuery.isError}
        aoTentarNovamente={() => void movimentosQuery.refetch()}
        totalRegistros={registros.length}
        totalFiltrado={visiveis.length}
        vazioTitulo="Nenhuma movimentação registrada"
        vazioDescricao="Registre a compra de tinta e de químicos para o saldo passar a ter histórico."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Movimento</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="hidden lg:table-cell">Origem</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Data</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.map((movimento) => (
              <TableRow key={movimento.id}>
                <TableCell>
                  <span className="block font-medium text-brand-dark">
                    {movimento.item_descricao}
                  </span>
                  {movimento.lote && (
                    <span className="block font-mono text-xs text-muted-foreground">
                      lote {movimento.lote}
                    </span>
                  )}
                </TableCell>

                <TableCell>
                  <BadgeMovimento tipo={movimento.tipo_movimento} />
                  {movimento.motivo_perda && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {MOTIVO_PERDA_LABEL[movimento.motivo_perda]}
                    </span>
                  )}
                </TableCell>

                <TableCell className="text-right font-mono text-sm text-brand-dark">
                  {movimento.tipo_movimento === 'entrada' ? '+' : '−'}
                  {movimento.quantidade.toLocaleString('pt-BR')} {movimento.unidade}
                </TableCell>

                <TableCell className="hidden text-sm text-brand-muted lg:table-cell">
                  {movimento.os_numero
                    ? `OS #${String(movimento.os_numero).padStart(4, '0')}`
                    : movimento.observacao || '—'}
                  <span className="block text-xs text-muted-foreground">
                    {movimento.responsavel_nome}
                  </span>
                </TableCell>

                <TableCell className="hidden text-right font-mono text-xs text-brand-muted sm:table-cell">
                  {formatDate(movimento.data)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ListaRegistros>

      <FormSheet
        aberto={modo !== null}
        aoFechar={() => setModo(null)}
        titulo={modo === 'perda' ? 'Registrar perda' : 'Registrar entrada'}
        descricao={
          modo === 'perda'
            ? 'Perda sai do saldo mas fica fora do consumo de produção, para não distorcer o indicador de g/m².'
            : 'Compra de tinta ou de insumo químico por lote.'
        }
        salvando={salvar.isPending}
        aoSalvar={(evento) =>
          void form.handleSubmit((valores) =>
            salvar.mutateAsync(valores).catch(() => {}),
          )(evento)
        }
      >
        <div className="space-y-4">
          {salvar.isError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>
                {salvar.error instanceof EstoqueError
                  ? salvar.error.message
                  : 'Não foi possível registrar o movimento.'}
              </AlertDescription>
            </Alert>
          )}

          <Campo id="item" label="Item" erro={erros.item?.message}>
            <Controller
              control={form.control}
              name="item"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="item" className="w-full">
                    <SelectValue placeholder="Selecione a tinta ou o insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {itens.map((candidato) => (
                      <SelectItem
                        key={chaveItem(candidato.tipo_item, candidato.id)}
                        value={chaveItem(candidato.tipo_item, candidato.id)}
                      >
                        {candidato.descricao} — {candidato.estoque_atual}{' '}
                        {candidato.unidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="quantidade"
              label={`Quantidade${item ? ` (${item.unidade})` : ''}`}
              erro={erros.quantidade?.message}
              dica={
                item && modo === 'perda'
                  ? `Saldo atual: ${item.estoque_atual} ${item.unidade}.`
                  : undefined
              }
            >
              <Input
                id="quantidade"
                inputMode="decimal"
                aria-invalid={Boolean(erros.quantidade)}
                aria-describedby={descricaoDoCampo(
                  'quantidade',
                  erros.quantidade?.message,
                )}
                {...form.register('quantidade')}
              />
            </Campo>

            <Campo id="data" label="Data" erro={erros.data?.message}>
              <Input
                id="data"
                type="date"
                aria-invalid={Boolean(erros.data)}
                {...form.register('data')}
              />
            </Campo>
          </div>

          {modo === 'perda' && (
            <Campo id="motivo_perda" label="Motivo da perda">
              <Controller
                control={form.control}
                name="motivo_perda"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="motivo_perda" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVOS_PERDA.map((motivo) => (
                        <SelectItem key={motivo} value={motivo}>
                          {MOTIVO_PERDA_LABEL[motivo]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>
          )}

          <Campo
            id="lote"
            label="Lote"
            dica={item?.lote ? `Em branco usa o lote atual (${item.lote}).` : 'Opcional.'}
          >
            <Input id="lote" className="font-mono" {...form.register('lote')} />
          </Campo>

          <Campo
            id="observacao"
            label={modo === 'perda' ? 'O que aconteceu' : 'Nota fiscal / fornecedor'}
            dica="Opcional."
          >
            <Textarea id="observacao" rows={2} {...form.register('observacao')} />
          </Campo>
        </div>
      </FormSheet>
    </>
  )
}

const ESTILO_MOVIMENTO: Record<TipoMovimento, string> = {
  entrada: 'bg-status-success-soft text-status-success-strong',
  saida: 'bg-accent text-accent-foreground',
  perda: 'bg-status-danger-soft text-status-danger-strong',
}

function BadgeMovimento({ tipo }: { tipo: TipoMovimento }) {
  return (
    <span
      className={`selo ${ESTILO_MOVIMENTO[tipo]}`}
    >
      {TIPO_MOVIMENTO_LABEL[tipo]}
    </span>
  )
}

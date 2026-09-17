import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { AcoesLinha } from '@/features/cadastros/components/acoes-linha'
import { descricaoDoCampo } from '@/features/cadastros/aria'
import { Campo } from '@/features/cadastros/components/campo'
import { ConfirmarExclusao } from '@/features/cadastros/components/confirmar-exclusao'
import { FormSheet } from '@/features/cadastros/components/form-sheet'
import { ListaRegistros } from '@/components/data/lista-registros'
import { useCrudCadastro } from '@/features/cadastros/use-crud-cadastro'
import { numeroPositivo, paraCampo, paraNumero } from '@/features/cadastros/validacao'
import { formatCurrency } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import { removerTabelaPreco, tabelasPrecoStore } from '@/services/cadastros-service'
import { UNIDADE_LABEL, UNIDADES, type TabelaPreco } from '@/types/cadastros'

const schema = z.object({
  nome: z.string().min(2, 'Informe o nome da tabela.'),
  ativa: z.boolean(),
  itens: z
    .array(
      z.object({
        id: z.string(),
        tipo_acabamento: z.string().min(2, 'Descreva o acabamento.'),
        unidade: z.enum(UNIDADES),
        valor: numeroPositivo('Informe o valor.'),
      }),
    )
    .min(1, 'Uma tabela precisa de ao menos um item de preço.'),
})

type FormValues = z.infer<typeof schema>

function itemVazio() {
  return {
    id: crypto.randomUUID(),
    tipo_acabamento: '',
    unidade: 'm2' as const,
    valor: '',
  }
}

const VAZIO: FormValues = { nome: '', ativa: true, itens: [itemVazio()] }

export function TabelasPrecoPage() {
  const filtrar = useCallback(
    (item: TabelaPreco, termo: string) =>
      normalizar(item.nome).includes(termo) ||
      item.itens.some((preco) => normalizar(preco.tipo_acabamento).includes(termo)),
    [],
  )

  const crud = useCrudCadastro<TabelaPreco>({
    chave: 'tabelas-preco',
    store: tabelasPrecoStore,
    filtrar,
    rotulo: (item) => item.nome,
    removerCustom: removerTabelaPreco,
    substantivo: { singular: 'Tabela de preço', artigo: 'a' },
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: VAZIO,
  })

  const itens = useFieldArray({ control: form.control, name: 'itens' })

  const { reset } = form
  const { formAberto, emEdicao } = crud

  useEffect(() => {
    if (!formAberto) return

    reset(
      emEdicao
        ? {
            nome: emEdicao.nome,
            ativa: emEdicao.ativa,
            itens: emEdicao.itens.map((item) => ({
              id: item.id,
              tipo_acabamento: item.tipo_acabamento,
              unidade: item.unidade,
              valor: paraCampo(item.valor),
            })),
          }
        : { ...VAZIO, itens: [itemVazio()] },
    )
  }, [formAberto, emEdicao, reset])

  function onSubmit(valores: FormValues) {
    const tabelaId = emEdicao?.id ?? crypto.randomUUID()

    crud.salvar.mutate({
      nome: valores.nome.trim(),
      ativa: valores.ativa,
      itens: valores.itens.map((item) => ({
        id: item.id,
        tabela_preco_id: tabelaId,
        tipo_acabamento: item.tipo_acabamento.trim(),
        unidade: item.unidade,
        valor: paraNumero(item.valor),
      })),
    })
  }

  const erros = form.formState.errors

  return (
    <>
      <PageHeader
        sobretitulo="Comercial"
        titulo="Tabelas de preço"
        descricao="Cada cliente é vinculado a uma tabela. É dela que sai o valor cobrado por m² ou por peça."
      />

      <ListaRegistros
        busca={crud.busca}
        aoBuscar={crud.setBusca}
        placeholderBusca="Buscar por nome da tabela ou acabamento"
        acao={
          <Button onClick={crud.abrirNovo}>
            <Plus aria-hidden />
            Nova tabela
          </Button>
        }
        carregando={crud.query.isPending}
        erro={crud.query.isError}
        aoTentarNovamente={() => void crud.query.refetch()}
        totalRegistros={crud.registros.length}
        totalFiltrado={crud.filtrados.length}
        vazioTitulo="Nenhuma tabela de preço cadastrada"
        vazioDescricao="Crie ao menos uma tabela antes de cadastrar clientes — é ela que define quanto será cobrado por tipo de acabamento."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tabela</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Faixa</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {crud.filtrados.map((tabela) => {
              const valores = tabela.itens.map((item) => item.valor)
              const menor = valores.length > 0 ? Math.min(...valores) : 0
              const maior = valores.length > 0 ? Math.max(...valores) : 0

              return (
                <TableRow key={tabela.id}>
                  <TableCell className="font-medium text-brand-dark">
                    {tabela.nome}
                  </TableCell>

                  <TableCell className="text-sm text-brand-muted">
                    {tabela.itens.length} acabamento(s)
                    <span className="block text-xs text-muted-foreground">
                      {tabela.itens
                        .slice(0, 2)
                        .map((item) => item.tipo_acabamento)
                        .join(', ')}
                      {tabela.itens.length > 2 && '…'}
                    </span>
                  </TableCell>

                  <TableCell className="hidden text-right font-mono text-sm text-brand-text sm:table-cell">
                    {menor === maior
                      ? formatCurrency(menor)
                      : `${formatCurrency(menor)} – ${formatCurrency(maior)}`}
                  </TableCell>

                  <TableCell>
                    <span
                      className={
                        tabela.ativa
                          ? 'selo bg-status-success-soft text-status-success-strong'
                          : 'selo bg-status-neutral-soft text-status-neutral-strong'
                      }
                    >
                      {tabela.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </TableCell>

                  <TableCell>
                    <AcoesLinha
                      rotulo={tabela.nome}
                      aoEditar={() => crud.abrirEdicao(tabela)}
                      aoExcluir={() => crud.pedirExclusao(tabela)}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ListaRegistros>

      <FormSheet
        aberto={crud.formAberto}
        aoFechar={crud.fecharForm}
        titulo={emEdicao ? 'Editar tabela de preço' : 'Nova tabela de preço'}
        descricao="Liste os acabamentos que você cobra e o valor de cada um."
        largura="xl"
        salvando={crud.salvar.isPending}
        aoSalvar={(event) => void form.handleSubmit(onSubmit)(event)}
      >
        <div className="space-y-5">
          <Campo id="nome" label="Nome da tabela" erro={erros.nome?.message}>
            <Input
              id="nome"
              autoComplete="off"
              placeholder="Tabela padrão 2026"
              aria-invalid={Boolean(erros.nome)}
              aria-describedby={descricaoDoCampo('nome', erros.nome?.message)}
              {...form.register('nome')}
            />
          </Campo>

          <div className="flex items-center gap-2.5">
            <Controller
              control={form.control}
              name="ativa"
              render={({ field }) => (
                <Checkbox
                  id="ativa"
                  checked={field.value}
                  onCheckedChange={(marcado) => field.onChange(marcado === true)}
                />
              )}
            />
            <Label htmlFor="ativa" className="font-normal">
              Tabela ativa (disponível para vincular a clientes)
            </Label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-dark">Itens de preço</h3>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => itens.append(itemVazio())}
              >
                <Plus aria-hidden />
                Adicionar item
              </Button>
            </div>

            {erros.itens?.root && (
              <p className="mb-2 text-xs text-destructive">{erros.itens.root.message}</p>
            )}

            <ul className="space-y-3">
              {itens.fields.map((campo, indice) => {
                const erroItem = erros.itens?.[indice]

                return (
                  <li
                    key={campo.id}
                    className="rounded-card border border-border bg-background p-3"
                  >
                    <div className="flex gap-3">
                      <div className="grid flex-1 gap-3 sm:grid-cols-[1.7fr_1fr_0.8fr]">
                        <Campo
                          id={`itens.${indice}.tipo_acabamento`}
                          label="Acabamento"
                          erro={erroItem?.tipo_acabamento?.message}
                        >
                          <Input
                            id={`itens.${indice}.tipo_acabamento`}
                            autoComplete="off"
                            placeholder="Pintura lisa poliéster"
                            aria-invalid={Boolean(erroItem?.tipo_acabamento)}
                            {...form.register(`itens.${indice}.tipo_acabamento`)}
                          />
                        </Campo>

                        <Campo
                          id={`itens.${indice}.unidade`}
                          label="Unidade"
                          erro={erroItem?.unidade?.message}
                        >
                          <Controller
                            control={form.control}
                            name={`itens.${indice}.unidade`}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger
                                  id={`itens.${indice}.unidade`}
                                  className="w-full"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNIDADES.map((unidade) => (
                                    <SelectItem key={unidade} value={unidade}>
                                      {UNIDADE_LABEL[unidade]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </Campo>

                        <Campo
                          id={`itens.${indice}.valor`}
                          label="Valor R$"
                          erro={erroItem?.valor?.message}
                        >
                          <Input
                            id={`itens.${indice}.valor`}
                            inputMode="decimal"
                            placeholder="48,50"
                            aria-invalid={Boolean(erroItem?.valor)}
                            {...form.register(`itens.${indice}.valor`)}
                          />
                        </Campo>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mt-7 shrink-0 text-muted-foreground hover:bg-status-danger-soft hover:text-status-danger-strong"
                        onClick={() => itens.remove(indice)}
                        disabled={itens.fields.length === 1}
                        aria-label={`Remover item ${indice + 1}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </FormSheet>

      <ConfirmarExclusao
        aberto={crud.paraExcluir !== null}
        aoFechar={crud.cancelarExclusao}
        aoConfirmar={() => {
          if (crud.paraExcluir) crud.excluir.mutate(crud.paraExcluir)
        }}
        excluindo={crud.excluir.isPending}
        registro={crud.paraExcluir?.nome ?? ''}
        consequencia="A tabela e todos os seus itens de preço são removidos. Clientes vinculados precisam ser migrados antes."
      />
    </>
  )
}

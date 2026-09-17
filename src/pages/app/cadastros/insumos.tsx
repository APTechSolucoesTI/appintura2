import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/page-header'
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
import { AcoesLinha } from '@/features/cadastros/components/acoes-linha'
import { BadgeAlerta } from '@/features/cadastros/components/badge-alerta'
import { descricaoDoCampo } from '@/features/cadastros/aria'
import { Campo } from '@/features/cadastros/components/campo'
import { ConfirmarExclusao } from '@/features/cadastros/components/confirmar-exclusao'
import { FormSheet } from '@/features/cadastros/components/form-sheet'
import { ListaRegistros } from '@/components/data/lista-registros'
import { useCrudCadastro } from '@/features/cadastros/use-crud-cadastro'
import {
  dataObrigatoria,
  numeroNaoNegativo,
  paraCampo,
  paraNumero,
} from '@/features/cadastros/validacao'
import { formatDate } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import { insumosStore } from '@/services/cadastros-service'
import {
  avaliarAlerta,
  TIPO_INSUMO_LABEL,
  TIPOS_INSUMO,
  UNIDADES_MEDIDA,
  type InsumoQuimico,
} from '@/types/cadastros'

const schema = z.object({
  nome: z.string().min(2, 'Informe o nome do insumo.'),
  tipo: z.enum(TIPOS_INSUMO),
  unidade_medida: z.enum(UNIDADES_MEDIDA),
  estoque_atual: numeroNaoNegativo('Informe o estoque atual.'),
  estoque_minimo: numeroNaoNegativo('Informe o estoque mínimo.'),
  validade: dataObrigatoria('Informe a validade do lote.'),
  fornecedor: z.string().min(2, 'Informe o fornecedor.'),
})

type FormValues = z.infer<typeof schema>

const VAZIO: FormValues = {
  nome: '',
  tipo: 'desengraxante',
  unidade_medida: 'L',
  estoque_atual: '',
  estoque_minimo: '',
  validade: '',
  fornecedor: '',
}

export function InsumosPage() {
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | (typeof TIPOS_INSUMO)[number]>(
    'todos',
  )

  const filtrar = useCallback(
    (item: InsumoQuimico, termo: string) =>
      normalizar(item.nome).includes(termo) ||
      normalizar(item.fornecedor).includes(termo) ||
      normalizar(TIPO_INSUMO_LABEL[item.tipo]).includes(termo),
    [],
  )

  const crud = useCrudCadastro<InsumoQuimico>({
    chave: 'insumos',
    store: insumosStore,
    filtrar,
    rotulo: (item) => item.nome,
    substantivo: { singular: 'Insumo', artigo: 'o' },
  })

  // O filtro por tipo é aplicado depois da busca textual do hook.
  const visiveis = useMemo(
    () =>
      tipoFiltro === 'todos'
        ? crud.filtrados
        : crud.filtrados.filter((item) => item.tipo === tipoFiltro),
    [crud.filtrados, tipoFiltro],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: VAZIO,
  })

  const { reset } = form
  const { formAberto, emEdicao } = crud

  useEffect(() => {
    if (!formAberto) return

    reset(
      emEdicao
        ? {
            nome: emEdicao.nome,
            tipo: emEdicao.tipo,
            unidade_medida: emEdicao.unidade_medida,
            estoque_atual: paraCampo(emEdicao.estoque_atual),
            estoque_minimo: paraCampo(emEdicao.estoque_minimo),
            validade: emEdicao.validade,
            fornecedor: emEdicao.fornecedor,
          }
        : VAZIO,
    )
  }, [formAberto, emEdicao, reset])

  function onSubmit(valores: FormValues) {
    crud.salvar.mutate({
      nome: valores.nome.trim(),
      tipo: valores.tipo,
      unidade_medida: valores.unidade_medida,
      estoque_atual: paraNumero(valores.estoque_atual),
      estoque_minimo: paraNumero(valores.estoque_minimo),
      validade: valores.validade,
      fornecedor: valores.fornecedor.trim(),
    })
  }

  const erros = form.formState.errors

  return (
    <>
      <PageHeader
        sobretitulo="Catálogo"
        titulo="Insumos químicos"
        descricao="Desengraxante, decapante, fosfatizante e passivador usados no pré-tratamento. O consumo é baixado na Fase 4."
      />

      <ListaRegistros
        busca={crud.busca}
        aoBuscar={crud.setBusca}
        placeholderBusca="Buscar por nome, tipo ou fornecedor"
        filtros={
          <Select
            value={tipoFiltro}
            onValueChange={(valor) =>
              setTipoFiltro(valor as 'todos' | (typeof TIPOS_INSUMO)[number])
            }
          >
            <SelectTrigger className="w-48" aria-label="Filtrar por tipo">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS_INSUMO.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {TIPO_INSUMO_LABEL[tipo]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        acao={
          <Button onClick={crud.abrirNovo}>
            <Plus aria-hidden />
            Novo insumo
          </Button>
        }
        carregando={crud.query.isPending}
        erro={crud.query.isError}
        aoTentarNovamente={() => void crud.query.refetch()}
        totalRegistros={crud.registros.length}
        totalFiltrado={visiveis.length}
        vazioTitulo="Nenhum insumo cadastrado"
        vazioDescricao="Cadastre os químicos do pré-tratamento para acompanhar estoque mínimo e validade de lote."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead className="hidden lg:table-cell">Fornecedor</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Validade</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="block font-medium text-brand-dark">{item.nome}</span>
                  <span className="block text-xs text-muted-foreground">
                    {TIPO_INSUMO_LABEL[item.tipo]}
                  </span>
                </TableCell>

                <TableCell className="hidden text-brand-muted lg:table-cell">
                  {item.fornecedor}
                </TableCell>

                <TableCell className="text-right font-mono text-sm">
                  <span className="text-brand-dark">
                    {item.estoque_atual} {item.unidade_medida}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    mín. {item.estoque_minimo}
                  </span>
                </TableCell>

                <TableCell className="hidden text-right font-mono text-xs text-brand-muted sm:table-cell">
                  {formatDate(item.validade)}
                </TableCell>

                <TableCell>
                  <BadgeAlerta
                    alerta={avaliarAlerta(
                      item.estoque_atual,
                      item.estoque_minimo,
                      item.validade,
                    )}
                  validade={item.validade}
                  />
                </TableCell>

                <TableCell>
                  <AcoesLinha
                    rotulo={item.nome}
                    aoEditar={() => crud.abrirEdicao(item)}
                    aoExcluir={() => crud.pedirExclusao(item)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ListaRegistros>

      <FormSheet
        aberto={crud.formAberto}
        aoFechar={crud.fecharForm}
        titulo={emEdicao ? 'Editar insumo' : 'Novo insumo químico'}
        descricao="Estoque mínimo e validade alimentam os alertas do painel."
        salvando={crud.salvar.isPending}
        aoSalvar={(event) => void form.handleSubmit(onSubmit)(event)}
      >
        <div className="space-y-4">
          <Campo id="nome" label="Nome do insumo" erro={erros.nome?.message}>
            <Input
              id="nome"
              autoComplete="off"
              placeholder="Desengraxante alcalino DX-40"
              aria-invalid={Boolean(erros.nome)}
              aria-describedby={descricaoDoCampo('nome', erros.nome?.message)}
              {...form.register('nome')}
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="tipo" label="Tipo" erro={erros.tipo?.message}>
              <Controller
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="tipo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {TIPOS_INSUMO.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {TIPO_INSUMO_LABEL[tipo]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <Campo
              id="unidade_medida"
              label="Unidade"
              erro={erros.unidade_medida?.message}
            >
              <Controller
                control={form.control}
                name="unidade_medida"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="unidade_medida" className="w-full">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {UNIDADES_MEDIDA.map((unidade) => (
                        <SelectItem key={unidade} value={unidade}>
                          {unidade === 'kg' ? 'Quilo (kg)' : 'Litro (L)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="estoque_atual"
              label="Estoque atual"
              erro={erros.estoque_atual?.message}
            >
              <Input
                id="estoque_atual"
                inputMode="decimal"
                aria-invalid={Boolean(erros.estoque_atual)}
                aria-describedby={descricaoDoCampo(
                  'estoque_atual',
                  erros.estoque_atual?.message,
                )}
                {...form.register('estoque_atual')}
              />
            </Campo>

            <Campo
              id="estoque_minimo"
              label="Estoque mínimo"
              erro={erros.estoque_minimo?.message}
              dica="Dispara o alerta de reposição."
            >
              <Input
                id="estoque_minimo"
                inputMode="decimal"
                aria-invalid={Boolean(erros.estoque_minimo)}
                aria-describedby={descricaoDoCampo(
                  'estoque_minimo',
                  erros.estoque_minimo?.message,
                  'Dispara o alerta de reposição.',
                )}
                {...form.register('estoque_minimo')}
              />
            </Campo>
          </div>

          <Campo id="validade" label="Validade do lote" erro={erros.validade?.message}>
            <Input
              id="validade"
              type="date"
              aria-invalid={Boolean(erros.validade)}
              aria-describedby={descricaoDoCampo('validade', erros.validade?.message)}
              {...form.register('validade')}
            />
          </Campo>

          <Campo id="fornecedor" label="Fornecedor" erro={erros.fornecedor?.message}>
            <Input
              id="fornecedor"
              autoComplete="off"
              aria-invalid={Boolean(erros.fornecedor)}
              aria-describedby={descricaoDoCampo(
                'fornecedor',
                erros.fornecedor?.message,
              )}
              {...form.register('fornecedor')}
            />
          </Campo>
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
        consequencia="O insumo sai do catálogo e dos alertas de estoque. As movimentações já registradas permanecem."
      />
    </>
  )
}

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
  numeroPositivo,
  paraCampo,
  paraNumero,
} from '@/features/cadastros/validacao'
import { formatCurrency, formatDate } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import { coresStore } from '@/services/cadastros-service'
import {
  avaliarAlerta,
  BRILHO_LABEL,
  BRILHOS,
  TEXTURA_LABEL,
  TEXTURAS,
  TIPO_TINTA_LABEL,
  TIPOS_TINTA,
  type Cor,
} from '@/types/cadastros'

const schema = z.object({
  codigo_ral: z.string().min(2, 'Informe o código RAL.'),
  nome_comercial: z.string().min(2, 'Informe o nome comercial.'),
  fabricante: z.string().min(2, 'Informe o fabricante.'),
  tipo: z.enum(TIPOS_TINTA),
  textura: z.enum(TEXTURAS),
  brilho: z.enum(BRILHOS),
  rendimento_teorico_g_m2: numeroPositivo('Informe o rendimento da ficha técnica.'),
  custo_kg: numeroPositivo('Informe o custo por quilo.'),
  estoque_atual: numeroNaoNegativo('Informe o estoque atual.'),
  estoque_minimo: numeroNaoNegativo('Informe o estoque mínimo.'),
  lote: z.string().min(1, 'Informe o lote.'),
  validade: dataObrigatoria('Informe a validade do lote.'),
})

type FormValues = z.infer<typeof schema>

const VAZIO: FormValues = {
  codigo_ral: '',
  nome_comercial: '',
  fabricante: '',
  tipo: 'poliester',
  textura: 'lisa',
  brilho: 'brilhante',
  rendimento_teorico_g_m2: '',
  custo_kg: '',
  estoque_atual: '',
  estoque_minimo: '',
  lote: '',
  validade: '',
}

export function CoresPage() {
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | (typeof TIPOS_TINTA)[number]>(
    'todos',
  )

  const filtrar = useCallback(
    (item: Cor, termo: string) =>
      normalizar(item.codigo_ral).includes(termo) ||
      normalizar(item.nome_comercial).includes(termo) ||
      normalizar(item.fabricante).includes(termo) ||
      normalizar(item.lote).includes(termo),
    [],
  )

  const crud = useCrudCadastro<Cor>({
    chave: 'cores',
    store: coresStore,
    filtrar,
    rotulo: (item) => `${item.codigo_ral} — ${item.nome_comercial}`,
    substantivo: { singular: 'Cor', artigo: 'a' },
  })

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
            codigo_ral: emEdicao.codigo_ral,
            nome_comercial: emEdicao.nome_comercial,
            fabricante: emEdicao.fabricante,
            tipo: emEdicao.tipo,
            textura: emEdicao.textura,
            brilho: emEdicao.brilho,
            rendimento_teorico_g_m2: paraCampo(emEdicao.rendimento_teorico_g_m2),
            custo_kg: paraCampo(emEdicao.custo_kg),
            estoque_atual: paraCampo(emEdicao.estoque_atual),
            estoque_minimo: paraCampo(emEdicao.estoque_minimo),
            lote: emEdicao.lote,
            validade: emEdicao.validade,
          }
        : VAZIO,
    )
  }, [formAberto, emEdicao, reset])

  function onSubmit(valores: FormValues) {
    crud.salvar.mutate({
      codigo_ral: valores.codigo_ral.trim().toUpperCase(),
      nome_comercial: valores.nome_comercial.trim(),
      fabricante: valores.fabricante.trim(),
      tipo: valores.tipo,
      textura: valores.textura,
      brilho: valores.brilho,
      rendimento_teorico_g_m2: paraNumero(valores.rendimento_teorico_g_m2),
      custo_kg: paraNumero(valores.custo_kg),
      estoque_atual: paraNumero(valores.estoque_atual),
      estoque_minimo: paraNumero(valores.estoque_minimo),
      lote: valores.lote.trim(),
      validade: valores.validade,
    })
  }

  const erros = form.formState.errors

  return (
    <>
      <PageHeader
        sobretitulo="Catálogo"
        titulo="Cores e tintas"
        descricao="Catálogo de pó por RAL. O rendimento em g/m² é o que calcula o consumo estimado de cada OS."
      />

      <ListaRegistros
        busca={crud.busca}
        aoBuscar={crud.setBusca}
        placeholderBusca="Buscar por RAL, nome, fabricante ou lote"
        filtros={
          <Select
            value={tipoFiltro}
            onValueChange={(valor) =>
              setTipoFiltro(valor as 'todos' | (typeof TIPOS_TINTA)[number])
            }
          >
            <SelectTrigger className="w-44" aria-label="Filtrar por tipo de tinta">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS_TINTA.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {TIPO_TINTA_LABEL[tipo]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        acao={
          <Button onClick={crud.abrirNovo}>
            <Plus aria-hidden />
            Nova cor
          </Button>
        }
        carregando={crud.query.isPending}
        erro={crud.query.isError}
        aoTentarNovamente={() => void crud.query.refetch()}
        totalRegistros={crud.registros.length}
        totalFiltrado={visiveis.length}
        vazioTitulo="Nenhuma cor cadastrada"
        vazioDescricao="Cadastre as cores que você aplica, com rendimento e custo por quilo, para o sistema estimar consumo e custo de cada ordem de serviço."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cor</TableHead>
              <TableHead className="hidden lg:table-cell">Acabamento</TableHead>
              <TableHead className="hidden text-right md:table-cell">
                Rendimento
              </TableHead>
              <TableHead className="hidden text-right md:table-cell">Custo/kg</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="block font-mono text-xs text-brand-medium">
                    {item.codigo_ral}
                  </span>
                  <span className="block font-medium text-brand-dark">
                    {item.nome_comercial}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {item.fabricante} · lote {item.lote}
                  </span>
                </TableCell>

                <TableCell className="hidden text-sm text-brand-muted lg:table-cell">
                  {TIPO_TINTA_LABEL[item.tipo]}
                  <span className="block text-xs text-muted-foreground">
                    {TEXTURA_LABEL[item.textura]} · {BRILHO_LABEL[item.brilho]}
                  </span>
                </TableCell>

                <TableCell className="hidden text-right font-mono text-sm text-brand-text md:table-cell">
                  {item.rendimento_teorico_g_m2} g/m²
                </TableCell>

                <TableCell className="hidden text-right font-mono text-sm text-brand-text md:table-cell">
                  {formatCurrency(item.custo_kg)}
                </TableCell>

                <TableCell className="text-right font-mono text-sm">
                  <span className="text-brand-dark">{item.estoque_atual} kg</span>
                  <span className="block text-xs text-muted-foreground">
                    mín. {item.estoque_minimo} · {formatDate(item.validade)}
                  </span>
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
                    rotulo={`${item.codigo_ral} ${item.nome_comercial}`}
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
        titulo={emEdicao ? 'Editar cor' : 'Nova cor'}
        descricao="Use os dados da ficha técnica do fabricante — eles alimentam o cálculo de consumo e de custo."
        largura="xl"
        salvando={crud.salvar.isPending}
        aoSalvar={(event) => void form.handleSubmit(onSubmit)(event)}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="codigo_ral" label="Código RAL" erro={erros.codigo_ral?.message}>
              <Input
                id="codigo_ral"
                autoComplete="off"
                placeholder="RAL 9005"
                className="font-mono"
                aria-invalid={Boolean(erros.codigo_ral)}
                aria-describedby={descricaoDoCampo(
                  'codigo_ral',
                  erros.codigo_ral?.message,
                )}
                {...form.register('codigo_ral')}
              />
            </Campo>

            <Campo
              id="nome_comercial"
              label="Nome comercial"
              erro={erros.nome_comercial?.message}
            >
              <Input
                id="nome_comercial"
                autoComplete="off"
                placeholder="Preto Sinal"
                aria-invalid={Boolean(erros.nome_comercial)}
                aria-describedby={descricaoDoCampo(
                  'nome_comercial',
                  erros.nome_comercial?.message,
                )}
                {...form.register('nome_comercial')}
              />
            </Campo>
          </div>

          <Campo id="fabricante" label="Fabricante" erro={erros.fabricante?.message}>
            <Input
              id="fabricante"
              autoComplete="off"
              aria-invalid={Boolean(erros.fabricante)}
              aria-describedby={descricaoDoCampo(
                'fabricante',
                erros.fabricante?.message,
              )}
              {...form.register('fabricante')}
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo id="tipo" label="Resina" erro={erros.tipo?.message}>
              <Controller
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="tipo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_TINTA.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {TIPO_TINTA_LABEL[tipo]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <Campo id="textura" label="Textura" erro={erros.textura?.message}>
              <Controller
                control={form.control}
                name="textura"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="textura" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXTURAS.map((textura) => (
                        <SelectItem key={textura} value={textura}>
                          {TEXTURA_LABEL[textura]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <Campo id="brilho" label="Brilho" erro={erros.brilho?.message}>
              <Controller
                control={form.control}
                name="brilho"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="brilho" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BRILHOS.map((brilho) => (
                        <SelectItem key={brilho} value={brilho}>
                          {BRILHO_LABEL[brilho]}
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
              id="rendimento_teorico_g_m2"
              label="Rendimento teórico (g/m²)"
              erro={erros.rendimento_teorico_g_m2?.message}
              dica="Consta na ficha técnica do fabricante."
            >
              <Input
                id="rendimento_teorico_g_m2"
                inputMode="decimal"
                aria-invalid={Boolean(erros.rendimento_teorico_g_m2)}
                aria-describedby={descricaoDoCampo(
                  'rendimento_teorico_g_m2',
                  erros.rendimento_teorico_g_m2?.message,
                  'Consta na ficha técnica do fabricante.',
                )}
                {...form.register('rendimento_teorico_g_m2')}
              />
            </Campo>

            <Campo id="custo_kg" label="Custo por quilo (R$)" erro={erros.custo_kg?.message}>
              <Input
                id="custo_kg"
                inputMode="decimal"
                placeholder="34,90"
                aria-invalid={Boolean(erros.custo_kg)}
                aria-describedby={descricaoDoCampo('custo_kg', erros.custo_kg?.message)}
                {...form.register('custo_kg')}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="estoque_atual"
              label="Estoque atual (kg)"
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
              label="Estoque mínimo (kg)"
              erro={erros.estoque_minimo?.message}
            >
              <Input
                id="estoque_minimo"
                inputMode="decimal"
                aria-invalid={Boolean(erros.estoque_minimo)}
                aria-describedby={descricaoDoCampo(
                  'estoque_minimo',
                  erros.estoque_minimo?.message,
                )}
                {...form.register('estoque_minimo')}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="lote" label="Lote" erro={erros.lote?.message}>
              <Input
                id="lote"
                autoComplete="off"
                className="font-mono"
                aria-invalid={Boolean(erros.lote)}
                aria-describedby={descricaoDoCampo('lote', erros.lote?.message)}
                {...form.register('lote')}
              />
            </Campo>

            <Campo id="validade" label="Validade" erro={erros.validade?.message}>
              <Input
                id="validade"
                type="date"
                aria-invalid={Boolean(erros.validade)}
                aria-describedby={descricaoDoCampo('validade', erros.validade?.message)}
                {...form.register('validade')}
              />
            </Campo>
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
        registro={
          crud.paraExcluir
            ? `${crud.paraExcluir.codigo_ral} — ${crud.paraExcluir.nome_comercial}`
            : ''
        }
        consequencia="A cor sai do catálogo e deixa de ser selecionável em novas ordens de serviço."
      />
    </>
  )
}

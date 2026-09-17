import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
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
import { InputMascarado } from '@/features/cadastros/components/input-mascarado'
import { ListaRegistros } from '@/components/data/lista-registros'
import { BadgeInadimplencia } from '@/features/cadastros/components/badge-inadimplencia'
import { useCrudCadastro } from '@/features/cadastros/use-crud-cadastro'
import { numeroNaoNegativo, paraCampo, paraNumero } from '@/features/cadastros/validacao'
import {
  apenasDigitos,
  formatDocumento,
  mascararCep,
  mascararDocumento,
  mascararTelefone,
  validarCpfCnpj,
} from '@/lib/documento'
import { formatCurrency } from '@/lib/format'
import { normalizar, somenteDigitos } from '@/lib/texto'
import { clientesStore, tabelasPrecoStore } from '@/services/cadastros-service'
import { UFS, type Cliente, type Uf } from '@/types/cadastros'

const schema = z.object({
  razao_social: z.string().min(2, 'Informe a razão social ou o nome.'),
  cnpj_cpf: z
    .string()
    .min(1, 'Informe o CNPJ ou CPF.')
    .refine(validarCpfCnpj, 'Documento inválido — confira os dígitos.'),
  contato_nome: z.string().min(2, 'Informe quem é o contato.'),
  contato_telefone: z.string().min(14, 'Informe um telefone com DDD.'),
  contato_email: z.union([z.literal(''), z.string().email('E-mail inválido.')]),
  cep: z.string().min(9, 'Informe o CEP completo.'),
  logradouro: z.string().min(2, 'Informe o logradouro.'),
  numero: z.string().min(1, 'Informe o número.'),
  complemento: z.string(),
  bairro: z.string().min(2, 'Informe o bairro.'),
  cidade: z.string().min(2, 'Informe a cidade.'),
  uf: z.enum(UFS),
  tabela_preco_id: z.string().min(1, 'Selecione a tabela de preço.'),
  limite_credito: numeroNaoNegativo('Informe o limite de crédito.'),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const VAZIO: FormValues = {
  razao_social: '',
  cnpj_cpf: '',
  contato_nome: '',
  contato_telefone: '',
  contato_email: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: 'MG',
  tabela_preco_id: '',
  limite_credito: '0',
  ativo: true,
}

export function ClientesPage() {
  const filtrar = useCallback(
    (item: Cliente, termo: string) =>
      normalizar(item.razao_social).includes(termo) ||
      normalizar(item.contato_nome).includes(termo) ||
      normalizar(item.cidade).includes(termo) ||
      item.cnpj_cpf.includes(somenteDigitos(termo)),
    [],
  )

  const crud = useCrudCadastro<Cliente>({
    chave: 'clientes',
    store: clientesStore,
    filtrar,
    rotulo: (item) => item.razao_social,
    substantivo: { singular: 'Cliente', artigo: 'o' },
  })

  const tabelasQuery = useQuery({
    queryKey: ['tabelas-preco', crud.tenantAtivo.id],
    queryFn: () => tabelasPrecoStore.listar(crud.tenantAtivo.id),
  })

  const tabelas = tabelasQuery.data ?? []
  const tabelasAtivas = tabelas.filter((tabela) => tabela.ativa)

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
            razao_social: emEdicao.razao_social,
            cnpj_cpf: formatDocumento(emEdicao.cnpj_cpf),
            contato_nome: emEdicao.contato_nome,
            contato_telefone: mascararTelefone(emEdicao.contato_telefone),
            contato_email: emEdicao.contato_email,
            cep: mascararCep(emEdicao.cep),
            logradouro: emEdicao.logradouro,
            numero: emEdicao.numero,
            complemento: emEdicao.complemento,
            bairro: emEdicao.bairro,
            cidade: emEdicao.cidade,
            uf: emEdicao.uf,
            tabela_preco_id: emEdicao.tabela_preco_id ?? '',
            limite_credito: paraCampo(emEdicao.limite_credito),
            ativo: emEdicao.ativo,
          }
        : VAZIO,
    )
  }, [formAberto, emEdicao, reset])

  function onSubmit(valores: FormValues) {
    crud.salvar.mutate({
      razao_social: valores.razao_social.trim(),
      cnpj_cpf: apenasDigitos(valores.cnpj_cpf),
      contato_nome: valores.contato_nome.trim(),
      contato_telefone: apenasDigitos(valores.contato_telefone),
      contato_email: valores.contato_email.trim(),
      cep: apenasDigitos(valores.cep),
      logradouro: valores.logradouro.trim(),
      numero: valores.numero.trim(),
      complemento: valores.complemento.trim(),
      bairro: valores.bairro.trim(),
      cidade: valores.cidade.trim(),
      uf: valores.uf as Uf,
      tabela_preco_id: valores.tabela_preco_id,
      limite_credito: paraNumero(valores.limite_credito),
      // Calculado a partir das contas a receber vencidas (Fase 5), nunca digitado.
      dias_inadimplencia_atual: emEdicao?.dias_inadimplencia_atual ?? 0,
      ativo: valores.ativo,
    })
  }

  const erros = form.formState.errors
  const semTabelas = !tabelasQuery.isPending && tabelasAtivas.length === 0

  return (
    <>
      <PageHeader
        sobretitulo="Carteira"
        titulo="Clientes"
        descricao="Quem manda peça para pintar. A tabela de preço vinculada define quanto será cobrado em cada OS."
      />

      <ListaRegistros
        busca={crud.busca}
        aoBuscar={crud.setBusca}
        placeholderBusca="Buscar por razão social, documento, contato ou cidade"
        acao={
          <Button onClick={crud.abrirNovo} disabled={semTabelas}>
            <Plus aria-hidden />
            Novo cliente
          </Button>
        }
        carregando={crud.query.isPending}
        erro={crud.query.isError}
        aoTentarNovamente={() => void crud.query.refetch()}
        totalRegistros={crud.registros.length}
        totalFiltrado={crud.filtrados.length}
        vazioTitulo="Nenhum cliente cadastrado"
        vazioDescricao={
          semTabelas
            ? 'Cadastre primeiro uma tabela de preço ativa — todo cliente precisa estar vinculado a uma.'
            : 'Cadastre os clientes que enviam peças para pintura. Eles aparecem na abertura de romaneio e de OS.'
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden lg:table-cell">Contato</TableHead>
              <TableHead className="hidden md:table-cell">Cidade</TableHead>
              <TableHead className="hidden xl:table-cell">Tabela</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {crud.filtrados.map((cliente) => (
              <TableRow key={cliente.id}>
                <TableCell>
                  <Link
                    to={`/app/cadastros/clientes/${cliente.id}`}
                    className="font-medium text-brand-dark hover:underline"
                  >
                    {cliente.razao_social}
                  </Link>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {formatDocumento(cliente.cnpj_cpf)}
                  </span>
                </TableCell>

                <TableCell className="hidden lg:table-cell">
                  <span className="block text-sm text-brand-text">
                    {cliente.contato_nome}
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {mascararTelefone(cliente.contato_telefone)}
                  </span>
                </TableCell>

                <TableCell className="hidden text-sm text-brand-muted md:table-cell">
                  {cliente.cidade}/{cliente.uf}
                </TableCell>

                <TableCell className="hidden text-sm text-brand-muted xl:table-cell">
                  {tabelas.find((tabela) => tabela.id === cliente.tabela_preco_id)
                    ?.nome ?? '—'}
                  <span className="block font-mono text-xs text-muted-foreground">
                    limite {formatCurrency(cliente.limite_credito)}
                  </span>
                </TableCell>

                <TableCell>
                  <BadgeInadimplencia
                    dias={cliente.dias_inadimplencia_atual}
                    ativo={cliente.ativo}
                  />
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Abrir ficha de ${cliente.razao_social}`}
                    >
                      <Link to={`/app/cadastros/clientes/${cliente.id}`}>
                        <ChevronRight />
                      </Link>
                    </Button>

                    <AcoesLinha
                      rotulo={cliente.razao_social}
                      aoEditar={() => crud.abrirEdicao(cliente)}
                      aoExcluir={() => crud.pedirExclusao(cliente)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ListaRegistros>

      <FormSheet
        aberto={crud.formAberto}
        aoFechar={crud.fecharForm}
        titulo={emEdicao ? 'Editar cliente' : 'Novo cliente'}
        descricao="Dados usados em romaneios, ordens de serviço e faturamento."
        largura="xl"
        salvando={crud.salvar.isPending}
        aoSalvar={(event) => void form.handleSubmit(onSubmit)(event)}
      >
        <div className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-brand-dark">Identificação</h3>

            <Campo
              id="razao_social"
              label="Razão social / nome"
              erro={erros.razao_social?.message}
            >
              <Input
                id="razao_social"
                autoComplete="off"
                aria-invalid={Boolean(erros.razao_social)}
                aria-describedby={descricaoDoCampo(
                  'razao_social',
                  erros.razao_social?.message,
                )}
                {...form.register('razao_social')}
              />
            </Campo>

            <Campo
              id="cnpj_cpf"
              label="CNPJ ou CPF"
              erro={erros.cnpj_cpf?.message}
              dica="Aceita pessoa jurídica ou física."
            >
              <InputMascarado
                id="cnpj_cpf"
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                control={form.control}
                name="cnpj_cpf"
                mascara={mascararDocumento}
                aria-invalid={Boolean(erros.cnpj_cpf)}
                aria-describedby={descricaoDoCampo(
                  'cnpj_cpf',
                  erros.cnpj_cpf?.message,
                  'Aceita pessoa jurídica ou física.',
                )}
              />
            </Campo>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-brand-dark">Contato</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                id="contato_nome"
                label="Nome"
                erro={erros.contato_nome?.message}
              >
                <Input
                  id="contato_nome"
                  autoComplete="off"
                  aria-invalid={Boolean(erros.contato_nome)}
                  {...form.register('contato_nome')}
                />
              </Campo>

              <Campo
                id="contato_telefone"
                label="Telefone"
                erro={erros.contato_telefone?.message}
              >
                <InputMascarado
                  id="contato_telefone"
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  control={form.control}
                  name="contato_telefone"
                  mascara={mascararTelefone}
                  aria-invalid={Boolean(erros.contato_telefone)}
                />
              </Campo>
            </div>

            <Campo
              id="contato_email"
              label="E-mail"
              erro={erros.contato_email?.message}
              dica="Opcional."
            >
              <Input
                id="contato_email"
                type="email"
                autoComplete="off"
                aria-invalid={Boolean(erros.contato_email)}
                {...form.register('contato_email')}
              />
            </Campo>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-brand-dark">Endereço</h3>

            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Campo id="cep" label="CEP" erro={erros.cep?.message}>
                <InputMascarado
                  id="cep"
                  inputMode="numeric"
                  placeholder="00000-000"
                  control={form.control}
                  name="cep"
                  mascara={mascararCep}
                  aria-invalid={Boolean(erros.cep)}
                />
              </Campo>

              <Campo id="logradouro" label="Logradouro" erro={erros.logradouro?.message}>
                <Input
                  id="logradouro"
                  autoComplete="off"
                  aria-invalid={Boolean(erros.logradouro)}
                  {...form.register('logradouro')}
                />
              </Campo>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="numero" label="Número" erro={erros.numero?.message}>
                <Input
                  id="numero"
                  autoComplete="off"
                  aria-invalid={Boolean(erros.numero)}
                  {...form.register('numero')}
                />
              </Campo>

              <Campo
                id="complemento"
                label="Complemento"
                erro={erros.complemento?.message}
                dica="Opcional."
              >
                <Input id="complemento" autoComplete="off" {...form.register('complemento')} />
              </Campo>
            </div>

            <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
              <Campo id="bairro" label="Bairro" erro={erros.bairro?.message}>
                <Input
                  id="bairro"
                  autoComplete="off"
                  aria-invalid={Boolean(erros.bairro)}
                  {...form.register('bairro')}
                />
              </Campo>

              <Campo id="cidade" label="Cidade" erro={erros.cidade?.message}>
                <Input
                  id="cidade"
                  autoComplete="off"
                  aria-invalid={Boolean(erros.cidade)}
                  {...form.register('cidade')}
                />
              </Campo>

              <Campo id="uf" label="UF" erro={erros.uf?.message}>
                <Controller
                  control={form.control}
                  name="uf"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="uf" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UFS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Campo>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-brand-dark">Comercial</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                id="tabela_preco_id"
                label="Tabela de preço"
                erro={erros.tabela_preco_id?.message}
              >
                <Controller
                  control={form.control}
                  name="tabela_preco_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="tabela_preco_id" className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {tabelasAtivas.map((tabela) => (
                          <SelectItem key={tabela.id} value={tabela.id}>
                            {tabela.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Campo>

              <Campo
                id="limite_credito"
                label="Limite de crédito (R$)"
                erro={erros.limite_credito?.message}
              >
                <Input
                  id="limite_credito"
                  inputMode="decimal"
                  placeholder="45000"
                  aria-invalid={Boolean(erros.limite_credito)}
                  {...form.register('limite_credito')}
                />
              </Campo>
            </div>

            <div className="flex items-center gap-2.5">
              <Controller
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <Checkbox
                    id="ativo"
                    checked={field.value}
                    onCheckedChange={(marcado) => field.onChange(marcado === true)}
                  />
                )}
              />
              <Label htmlFor="ativo" className="font-normal">
                Cliente ativo (pode abrir novos romaneios e OS)
              </Label>
            </div>
          </section>
        </div>
      </FormSheet>

      <ConfirmarExclusao
        aberto={crud.paraExcluir !== null}
        aoFechar={crud.cancelarExclusao}
        aoConfirmar={() => {
          if (crud.paraExcluir) crud.excluir.mutate(crud.paraExcluir)
        }}
        excluindo={crud.excluir.isPending}
        registro={crud.paraExcluir?.razao_social ?? ''}
        consequencia="O cliente some das listagens. Se ele já tiver romaneio ou OS, prefira desmarcar 'Cliente ativo' em vez de excluir."
      />
    </>
  )
}

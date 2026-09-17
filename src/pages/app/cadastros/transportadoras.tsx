import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { useCrudCadastro } from '@/features/cadastros/use-crud-cadastro'
import {
  apenasDigitos,
  formatDocumento,
  mascararDocumento,
  mascararTelefone,
  validarCnpj,
} from '@/lib/documento'
import { normalizar, somenteDigitos } from '@/lib/texto'
import { transportadorasStore } from '@/services/cadastros-service'
import type { Transportadora } from '@/types/cadastros'

const schema = z.object({
  nome: z.string().min(2, 'Informe o nome da transportadora.'),
  cnpj: z
    .string()
    .min(1, 'Informe o CNPJ.')
    .refine(validarCnpj, 'CNPJ inválido — confira os dígitos.'),
  contato_nome: z.string().min(2, 'Informe o nome de quem atende.'),
  contato_telefone: z.string().min(14, 'Informe um telefone com DDD.'),
  contato_email: z.union([z.literal(''), z.string().email('E-mail inválido.')]),
})

type FormValues = z.infer<typeof schema>

const VAZIO: FormValues = {
  nome: '',
  cnpj: '',
  contato_nome: '',
  contato_telefone: '',
  contato_email: '',
}

export function TransportadorasPage() {
  const filtrar = useCallback(
    (item: Transportadora, termo: string) =>
      normalizar(item.nome).includes(termo) ||
      normalizar(item.contato_nome).includes(termo) ||
      item.cnpj.includes(somenteDigitos(termo)),
    [],
  )

  const crud = useCrudCadastro<Transportadora>({
    chave: 'transportadoras',
    store: transportadorasStore,
    filtrar,
    rotulo: (item) => item.nome,
    substantivo: { singular: 'Transportadora', artigo: 'a' },
  })

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
            cnpj: formatDocumento(emEdicao.cnpj),
            contato_nome: emEdicao.contato_nome,
            contato_telefone: mascararTelefone(emEdicao.contato_telefone),
            contato_email: emEdicao.contato_email,
          }
        : VAZIO,
    )
  }, [formAberto, emEdicao, reset])

  function onSubmit(valores: FormValues) {
    crud.salvar.mutate({
      nome: valores.nome.trim(),
      cnpj: apenasDigitos(valores.cnpj),
      contato_nome: valores.contato_nome.trim(),
      contato_telefone: apenasDigitos(valores.contato_telefone),
      contato_email: valores.contato_email.trim(),
    })
  }

  const erros = form.formState.errors

  return (
    <>
      <PageHeader
        sobretitulo="Logística"
        titulo="Transportadoras"
        descricao="Quem traz e leva a mercadoria do cliente. Usada nos romaneios de recebimento e devolução."
      />

      <ListaRegistros
        busca={crud.busca}
        aoBuscar={crud.setBusca}
        placeholderBusca="Buscar por nome, CNPJ ou contato"
        acao={
          <Button onClick={crud.abrirNovo}>
            <Plus aria-hidden />
            Nova transportadora
          </Button>
        }
        carregando={crud.query.isPending}
        erro={crud.query.isError}
        aoTentarNovamente={() => void crud.query.refetch()}
        totalRegistros={crud.registros.length}
        totalFiltrado={crud.filtrados.length}
        vazioTitulo="Nenhuma transportadora cadastrada"
        vazioDescricao="Cadastre as transportadoras que costumam entregar e retirar peças, para vinculá-las aos romaneios."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transportadora</TableHead>
              <TableHead className="hidden md:table-cell">CNPJ</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {crud.filtrados.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-brand-dark">
                  {item.nome}
                  <span className="block font-mono text-xs font-normal text-muted-foreground md:hidden">
                    {formatDocumento(item.cnpj)}
                  </span>
                </TableCell>

                <TableCell className="hidden font-mono text-xs text-brand-muted md:table-cell">
                  {formatDocumento(item.cnpj)}
                </TableCell>

                <TableCell>
                  <span className="block text-brand-text">{item.contato_nome}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {mascararTelefone(item.contato_telefone)}
                  </span>
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
        titulo={emEdicao ? 'Editar transportadora' : 'Nova transportadora'}
        descricao="Dados usados nos romaneios de entrada e saída de mercadoria."
        salvando={crud.salvar.isPending}
        aoSalvar={(event) => void form.handleSubmit(onSubmit)(event)}
      >
        <div className="space-y-4">
          <Campo id="nome" label="Nome" erro={erros.nome?.message}>
            <Input
              id="nome"
              autoComplete="off"
              aria-invalid={Boolean(erros.nome)}
              aria-describedby={descricaoDoCampo('nome', erros.nome?.message)}
              {...form.register('nome')}
            />
          </Campo>

          <Campo id="cnpj" label="CNPJ" erro={erros.cnpj?.message}>
            <InputMascarado
              id="cnpj"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              control={form.control}
              name="cnpj"
              mascara={mascararDocumento}
              aria-invalid={Boolean(erros.cnpj)}
              aria-describedby={descricaoDoCampo('cnpj', erros.cnpj?.message)}
            />
          </Campo>

          <Campo
            id="contato_nome"
            label="Pessoa de contato"
            erro={erros.contato_nome?.message}
          >
            <Input
              id="contato_nome"
              autoComplete="off"
              aria-invalid={Boolean(erros.contato_nome)}
              aria-describedby={descricaoDoCampo(
                'contato_nome',
                erros.contato_nome?.message,
              )}
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
              aria-describedby={descricaoDoCampo(
                'contato_telefone',
                erros.contato_telefone?.message,
              )}
            />
          </Campo>

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
              aria-describedby={descricaoDoCampo(
                'contato_email',
                erros.contato_email?.message,
                'Opcional.',
              )}
              {...form.register('contato_email')}
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
        consequencia="A transportadora deixa de aparecer na seleção dos romaneios. Romaneios já emitidos mantêm o registro histórico."
      />
    </>
  )
}

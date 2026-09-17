import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { ListaRegistros } from '@/components/data/lista-registros'
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
import { Textarea } from '@/components/ui/textarea'
import { Campo } from '@/features/cadastros/components/campo'
import { FormSheet } from '@/features/cadastros/components/form-sheet'
import { dataObrigatoria } from '@/features/cadastros/validacao'
import { useAuth } from '@/features/auth/auth-context'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDate } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import { ordensStore } from '@/services/producao-service'
import { naoConformidadesStore } from '@/services/qualidade-service'
import {
  TIPO_NAO_CONFORMIDADE_LABEL,
  TIPOS_NAO_CONFORMIDADE,
} from '@/types/qualidade'

const schema = z.object({
  os_item: z.string().min(1, 'Selecione o item.'),
  tipo: z.enum(TIPOS_NAO_CONFORMIDADE),
  causa: z.string().min(10, 'Descreva a causa raiz com pelo menos 10 caracteres.'),
  acao_corretiva: z.string().min(10, 'Descreva a ação corretiva.'),
  data: dataObrigatoria('Informe a data.'),
})

type FormValues = z.infer<typeof schema>

export function NaoConformidadesPage() {
  const { tenantAtivo } = useTenant()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)

  const ncQuery = useQuery({
    queryKey: ['nao-conformidades', tenantAtivo.id],
    queryFn: () => naoConformidadesStore.listar(tenantAtivo.id),
  })

  const ordensQuery = useQuery({
    queryKey: ['ordens-servico', tenantAtivo.id],
    queryFn: () => ordensStore.listar(tenantAtivo.id),
  })

  const opcoes = useMemo(
    () =>
      (ordensQuery.data ?? []).flatMap((os) =>
        os.itens.map((item) => ({
          valor: `${os.id}|${item.id}`,
          rotulo: `OS #${String(os.numero).padStart(4, '0')} — ${item.descricao}`,
          os,
          item,
        })),
      ),
    [ordensQuery.data],
  )

  const registros = useMemo(() => ncQuery.data ?? [], [ncQuery.data])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca)

    if (!termo) return registros

    return registros.filter(
      (nc) =>
        String(nc.os_numero).includes(termo) ||
        normalizar(nc.os_item_descricao).includes(termo) ||
        normalizar(nc.causa).includes(termo) ||
        normalizar(TIPO_NAO_CONFORMIDADE_LABEL[nc.tipo]).includes(termo),
    )
  }, [registros, busca])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      os_item: '',
      tipo: 'espessura_fora_faixa',
      causa: '',
      acao_corretiva: '',
      data: new Date().toISOString().slice(0, 10),
    },
  })

  const { reset } = form

  useEffect(() => {
    if (!aberto) return

    reset({
      os_item: '',
      tipo: 'espessura_fora_faixa',
      causa: '',
      acao_corretiva: '',
      data: new Date().toISOString().slice(0, 10),
    })
  }, [aberto, reset])

  const salvar = useMutation({
    mutationFn: async (valores: FormValues) => {
      const opcao = opcoes.find((item) => item.valor === valores.os_item)

      if (!opcao) throw new Error('Item inválido.')

      return naoConformidadesStore.criar(tenantAtivo.id, {
        os_id: opcao.os.id,
        os_numero: opcao.os.numero,
        os_item_id: opcao.item.id,
        os_item_descricao: opcao.item.descricao,
        tipo: valores.tipo,
        causa: valores.causa.trim(),
        acao_corretiva: valores.acao_corretiva.trim(),
        responsavel_id: user?.id ?? '',
        responsavel_nome: user?.nome ?? '',
        data: valores.data,
      })
    },
    onSuccess: async (nc) => {
      await queryClient.invalidateQueries({
        queryKey: ['nao-conformidades', tenantAtivo.id],
      })
      setAberto(false)
      toast.success('Não conformidade registrada', {
        description: `OS #${String(nc.os_numero).padStart(4, '0')} — ${TIPO_NAO_CONFORMIDADE_LABEL[nc.tipo]}`,
      })
    },
  })

  const erros = form.formState.errors

  return (
    <>
      <PageHeader
        sobretitulo="Causa e ação corretiva"
        titulo="Não conformidades"
        descricao="Causa raiz e ação corretiva de cada defeito. É o registro que evita repetir o mesmo erro na próxima carga."
        acoes={
          <Button size="lg" onClick={() => setAberto(true)} disabled={opcoes.length === 0}>
            <Plus aria-hidden />
            Registrar
          </Button>
        }
      />

      <ListaRegistros
        busca={busca}
        aoBuscar={setBusca}
        placeholderBusca="Buscar por OS, item, tipo ou causa"
        carregando={ncQuery.isPending}
        erro={ncQuery.isError}
        aoTentarNovamente={() => void ncQuery.refetch()}
        totalRegistros={registros.length}
        totalFiltrado={visiveis.length}
        vazioTitulo="Nenhuma não conformidade registrada"
        vazioDescricao="Quando um item reprovar, registre a causa e a ação corretiva — é o que transforma retrabalho em aprendizado."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">OS</TableHead>
              <TableHead>Defeito</TableHead>
              <TableHead className="hidden lg:table-cell">Causa</TableHead>
              <TableHead className="hidden xl:table-cell">Ação corretiva</TableHead>
              <TableHead className="text-right">Data</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.map((nc) => (
              <TableRow key={nc.id}>
                <TableCell>
                  <Link
                    to={`/app/ordens-servico/${nc.os_id}`}
                    className="font-mono text-sm font-semibold text-brand-medium hover:underline"
                  >
                    #{String(nc.os_numero).padStart(4, '0')}
                  </Link>
                </TableCell>

                <TableCell>
                  <span className="selo bg-status-danger-soft text-status-danger-strong">
                    {TIPO_NAO_CONFORMIDADE_LABEL[nc.tipo]}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {nc.os_item_descricao}
                  </span>
                </TableCell>

                <TableCell className="hidden max-w-xs text-sm text-brand-muted lg:table-cell">
                  {nc.causa}
                </TableCell>

                <TableCell className="hidden max-w-xs text-sm text-brand-muted xl:table-cell">
                  {nc.acao_corretiva}
                </TableCell>

                <TableCell className="text-right font-mono text-xs text-brand-muted">
                  {formatDate(nc.data)}
                  <span className="block text-muted-foreground">
                    {nc.responsavel_nome}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ListaRegistros>

      <FormSheet
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Registrar não conformidade"
        descricao="Descreva a causa raiz, não só o sintoma — é dela que sai a ação corretiva útil."
        salvando={salvar.isPending}
        aoSalvar={(evento) =>
          void form.handleSubmit((valores) =>
            salvar.mutateAsync(valores).catch(() => {}),
          )(evento)
        }
      >
        <div className="space-y-4">
          <Campo id="os_item" label="Item com defeito" erro={erros.os_item?.message}>
            <Controller
              control={form.control}
              name="os_item"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="os_item" className="w-full">
                    <SelectValue placeholder="Selecione a OS e o item" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoes.map((item) => (
                      <SelectItem key={item.valor} value={item.valor}>
                        {item.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>

          <Campo id="tipo" label="Tipo de defeito">
            <Controller
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_NAO_CONFORMIDADE.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {TIPO_NAO_CONFORMIDADE_LABEL[tipo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>

          <Campo
            id="causa"
            label="Causa raiz"
            erro={erros.causa?.message}
            dica="Por que aconteceu, não o que aconteceu."
          >
            <Textarea
              id="causa"
              rows={3}
              aria-invalid={Boolean(erros.causa)}
              {...form.register('causa')}
            />
          </Campo>

          <Campo
            id="acao_corretiva"
            label="Ação corretiva"
            erro={erros.acao_corretiva?.message}
          >
            <Textarea
              id="acao_corretiva"
              rows={3}
              aria-invalid={Boolean(erros.acao_corretiva)}
              {...form.register('acao_corretiva')}
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
      </FormSheet>
    </>
  )
}

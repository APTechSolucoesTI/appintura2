import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { ListaRegistros } from '@/components/data/lista-registros'
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
import { Textarea } from '@/components/ui/textarea'
import { descricaoDoCampo } from '@/features/cadastros/aria'
import { Campo } from '@/features/cadastros/components/campo'
import { FormSheet } from '@/features/cadastros/components/form-sheet'
import { dataObrigatoria, numeroPositivo, paraNumero } from '@/features/cadastros/validacao'
import { useAuth } from '@/features/auth/auth-context'
import { BadgeResultado } from '@/features/qualidade/components/badge-resultado'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDate } from '@/lib/format'
import { normalizar } from '@/lib/texto'
import { moverStatus, ordensStore } from '@/services/producao-service'
import { qualidadeRegistrosStore } from '@/services/qualidade-service'
import {
  RESULTADO_TESTE_LABEL,
  RESULTADOS_TESTE,
  espessuraConforme,
} from '@/types/qualidade'

const schema = z.object({
  os_item: z.string().min(1, 'Selecione o item inspecionado.'),
  espessura_medida_micron: numeroPositivo('Informe a espessura medida.'),
  teste_aderencia: z.enum(RESULTADOS_TESTE),
  data: dataObrigatoria('Informe a data da inspeção.'),
  observacao: z.string(),
  enviar_retrabalho: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const VAZIO: FormValues = {
  os_item: '',
  espessura_medida_micron: '',
  teste_aderencia: 'aprovado',
  data: new Date().toISOString().slice(0, 10),
  observacao: '',
  enviar_retrabalho: true,
}

function chave(osId: string, itemId: string) {
  return `${osId}|${itemId}`
}

export function InspecoesPage() {
  const { tenantAtivo } = useTenant()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)

  const registrosQuery = useQuery({
    queryKey: ['qualidade-registros', tenantAtivo.id],
    queryFn: () => qualidadeRegistrosStore.listar(tenantAtivo.id),
  })

  const ordensQuery = useQuery({
    queryKey: ['ordens-servico', tenantAtivo.id],
    queryFn: () => ordensStore.listar(tenantAtivo.id),
  })

  /** Só faz sentido inspecionar o que já passou pelo forno. */
  const inspecionaveis = useMemo(
    () =>
      (ordensQuery.data ?? []).filter((os) =>
        ['cura', 'controle_qualidade', 'embalagem', 'retrabalho'].includes(os.status),
      ),
    [ordensQuery.data],
  )

  const opcoes = useMemo(
    () =>
      inspecionaveis.flatMap((os) =>
        os.itens.map((item) => ({
          valor: chave(os.id, item.id),
          rotulo: `OS #${String(os.numero).padStart(4, '0')} — ${item.descricao}`,
          os,
          item,
        })),
      ),
    [inspecionaveis],
  )

  const registros = useMemo(() => registrosQuery.data ?? [], [registrosQuery.data])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca)

    if (!termo) return registros

    return registros.filter(
      (registro) =>
        String(registro.os_numero).includes(termo) ||
        normalizar(registro.os_item_descricao).includes(termo) ||
        normalizar(registro.responsavel_nome).includes(termo),
    )
  }, [registros, busca])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: VAZIO,
  })

  const { reset } = form

  useEffect(() => {
    if (aberto) reset({ ...VAZIO, data: new Date().toISOString().slice(0, 10) })
  }, [aberto, reset])

  const selecionado = useWatch({ control: form.control, name: 'os_item' })
  const espessura = useWatch({ control: form.control, name: 'espessura_medida_micron' })
  const aderencia = useWatch({ control: form.control, name: 'teste_aderencia' })

  const opcao = opcoes.find((item) => item.valor === selecionado)

  // Prévia do veredito enquanto digita: o inspetor vê na hora se vai reprovar.
  const medida = paraNumero(espessura)
  const foraDaFaixa =
    opcao && Number.isFinite(medida) && medida > 0
      ? medida < opcao.os.espessura_min_micron || medida > opcao.os.espessura_max_micron
      : false
  const vaiReprovar = foraDaFaixa || aderencia === 'reprovado'

  const salvar = useMutation({
    mutationFn: async (valores: FormValues) => {
      if (!opcao) throw new Error('Item inválido.')

      const registro = await qualidadeRegistrosStore.criar(tenantAtivo.id, {
        os_id: opcao.os.id,
        os_numero: opcao.os.numero,
        os_item_id: opcao.item.id,
        os_item_descricao: opcao.item.descricao,
        espessura_medida_micron: paraNumero(valores.espessura_medida_micron),
        // Congela a faixa vigente: se a OS for reespecificada depois, o laudo
        // continua provando contra o que era exigido no dia.
        espessura_min_micron: opcao.os.espessura_min_micron,
        espessura_max_micron: opcao.os.espessura_max_micron,
        teste_aderencia: valores.teste_aderencia,
        observacao: valores.observacao.trim(),
        responsavel_id: user?.id ?? '',
        responsavel_nome: user?.nome ?? '',
        data: valores.data,
      })

      const reprovou =
        valores.teste_aderencia === 'reprovado' ||
        registro.espessura_medida_micron < registro.espessura_min_micron ||
        registro.espessura_medida_micron > registro.espessura_max_micron

      if (reprovou && valores.enviar_retrabalho && opcao.os.status !== 'retrabalho') {
        await moverStatus({
          tenantId: tenantAtivo.id,
          osId: opcao.os.id,
          novoStatus: 'retrabalho',
          responsavelId: user?.id ?? '',
          responsavelNome: user?.nome ?? '',
          observacao: 'Reprovado no controle de qualidade.',
        })
      }

      return { registro, reprovou }
    },
    onSuccess: async ({ registro, reprovou }) => {
      await queryClient.invalidateQueries({
        queryKey: ['qualidade-registros', tenantAtivo.id],
      })
      await queryClient.invalidateQueries({
        queryKey: ['ordens-servico', tenantAtivo.id],
      })

      setAberto(false)
      toast.success(reprovou ? 'Inspeção reprovada' : 'Inspeção aprovada', {
        description: `OS #${String(registro.os_numero).padStart(4, '0')} — ${registro.os_item_descricao}`,
      })
    },
    onError: () => {
      toast.error('Não foi possível registrar a inspeção')
    },
  })

  const erros = form.formState.errors

  return (
    <>
      <PageHeader
        sobretitulo="Liberação e conformidade"
        titulo="Qualidade que deixa evidência."
        descricao="Espessura em micron e teste de aderência por item de OS. Reprovar manda a ordem para retrabalho."
        acoes={
          <Button size="lg" onClick={() => setAberto(true)} disabled={opcoes.length === 0}>
            <Plus aria-hidden />
            Nova inspeção
          </Button>
        }
      />

      <ListaRegistros
        busca={busca}
        aoBuscar={setBusca}
        placeholderBusca="Buscar por OS, item ou responsável"
        carregando={registrosQuery.isPending}
        erro={registrosQuery.isError}
        aoTentarNovamente={() => void registrosQuery.refetch()}
        totalRegistros={registros.length}
        totalFiltrado={visiveis.length}
        vazioTitulo="Nenhuma inspeção registrada"
        vazioDescricao="Registre a medição de espessura e o teste de aderência das OS que saíram do forno."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">OS</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Espessura</TableHead>
              <TableHead className="hidden md:table-cell">Aderência</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Data</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.map((registro) => (
              <TableRow key={registro.id}>
                <TableCell>
                  <Link
                    to={`/app/ordens-servico/${registro.os_id}`}
                    className="font-mono text-sm font-semibold text-brand-medium hover:underline"
                  >
                    #{String(registro.os_numero).padStart(4, '0')}
                  </Link>
                </TableCell>

                <TableCell className="text-brand-dark">
                  {registro.os_item_descricao}
                  <span className="block text-xs text-muted-foreground">
                    {registro.responsavel_nome}
                  </span>
                </TableCell>

                <TableCell className="text-right font-mono text-sm">
                  <span
                    className={
                      espessuraConforme(registro)
                        ? 'text-brand-dark'
                        : 'font-semibold text-status-danger-strong'
                    }
                  >
                    {registro.espessura_medida_micron} µm
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    exigido {registro.espessura_min_micron}–
                    {registro.espessura_max_micron}
                  </span>
                </TableCell>

                <TableCell className="hidden text-sm text-brand-muted md:table-cell">
                  {RESULTADO_TESTE_LABEL[registro.teste_aderencia]}
                </TableCell>

                <TableCell>
                  <BadgeResultado registro={registro} />
                </TableCell>

                <TableCell className="hidden text-right font-mono text-xs text-brand-muted sm:table-cell">
                  {formatDate(registro.data)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ListaRegistros>

      <FormSheet
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Nova inspeção"
        descricao="A faixa exigida vem da OS e fica congelada neste registro."
        salvando={salvar.isPending}
        aoSalvar={(evento) =>
          void form.handleSubmit((valores) =>
            salvar.mutateAsync(valores).catch(() => {}),
          )(evento)
        }
      >
        <div className="space-y-4">
          <Campo id="os_item" label="Item inspecionado" erro={erros.os_item?.message}>
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

          <Campo
            id="espessura_medida_micron"
            label="Espessura medida (µm)"
            erro={erros.espessura_medida_micron?.message}
            dica={
              opcao
                ? `Faixa exigida: ${opcao.os.espessura_min_micron} a ${opcao.os.espessura_max_micron} µm.`
                : undefined
            }
          >
            <Input
              id="espessura_medida_micron"
              inputMode="decimal"
              aria-invalid={Boolean(erros.espessura_medida_micron)}
              aria-describedby={descricaoDoCampo(
                'espessura_medida_micron',
                erros.espessura_medida_micron?.message,
                opcao ? 'faixa' : undefined,
              )}
              {...form.register('espessura_medida_micron')}
            />
          </Campo>

          <Campo id="teste_aderencia" label="Teste de aderência">
            <Controller
              control={form.control}
              name="teste_aderencia"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="teste_aderencia" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULTADOS_TESTE.map((resultado) => (
                      <SelectItem key={resultado} value={resultado}>
                        {RESULTADO_TESTE_LABEL[resultado]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>

          <Campo id="data" label="Data da inspeção" erro={erros.data?.message}>
            <Input
              id="data"
              type="date"
              aria-invalid={Boolean(erros.data)}
              {...form.register('data')}
            />
          </Campo>

          <Campo id="observacao" label="Observações" dica="Pontos medidos, classe do corte em grade.">
            <Textarea id="observacao" rows={3} {...form.register('observacao')} />
          </Campo>

          {vaiReprovar && (
            <div className="rounded-card bg-status-danger-soft p-3">
              <p className="text-sm font-medium text-status-danger-strong">
                {foraDaFaixa
                  ? 'Espessura fora da faixa exigida.'
                  : 'Aderência reprovada.'}
              </p>

              <label className="mt-2 flex items-center gap-2.5">
                <Controller
                  control={form.control}
                  name="enviar_retrabalho"
                  render={({ field }) => (
                    <Checkbox
                      id="enviar_retrabalho"
                      checked={field.value}
                      onCheckedChange={(valor) => field.onChange(valor === true)}
                    />
                  )}
                />
                <Label htmlFor="enviar_retrabalho" className="font-normal">
                  Enviar a OS para retrabalho ao salvar
                </Label>
              </label>
            </div>
          )}
        </div>
      </FormSheet>
    </>
  )
}

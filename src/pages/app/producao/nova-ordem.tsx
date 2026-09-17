import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calculator, CircleAlert, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { descricaoDoCampo } from '@/features/cadastros/aria'
import { Campo } from '@/features/cadastros/components/campo'
import {
  dataObrigatoria,
  numeroPositivo,
  paraCampo,
  paraNumero,
} from '@/features/cadastros/validacao'
import { useAuth } from '@/features/auth/auth-context'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDate, paraDatetimeLocal } from '@/lib/format'
import { clientesStore, coresStore } from '@/services/cadastros-service'
import { recebimentosStore } from '@/services/custodia-service'
import { ordensStore, proximoNumeroOs } from '@/services/producao-service'
import type { Cliente, Cor } from '@/types/cadastros'
import type { RomaneioRecebimento } from '@/types/custodia'
import {
  consumoEstimadoKg,
  PRETRATAMENTO_LABEL,
  PRETRATAMENTOS,
  URGENCIA_LABEL,
  URGENCIAS,
} from '@/types/producao'

const schema = z.object({
  romaneio_recebimento_id: z.string().min(1, 'Selecione o romaneio de entrada.'),
  previsao_entrega: dataObrigatoria('Informe a previsão de entrega.'),
  urgencia: z.enum(URGENCIAS),
  cor_id: z.string().min(1, 'Selecione a cor.'),
  espessura_min_micron: numeroPositivo('Informe a espessura mínima.'),
  espessura_max_micron: numeroPositivo('Informe a espessura máxima.'),
  tipo_pretratamento: z.enum(PRETRATAMENTOS),
  observacao: z.string(),
  itens: z
    .array(
      z.object({
        id: z.string(),
        descricao: z.string().min(3, 'Descreva o item.'),
        quantidade: numeroPositivo('Informe a quantidade.'),
        area_m2: numeroPositivo('Informe a área total em m².'),
      }),
    )
    .min(1, 'A ordem precisa de ao menos um item.'),
})

type FormValues = z.infer<typeof schema>

function itemVazio() {
  return { id: crypto.randomUUID(), descricao: '', quantidade: '', area_m2: '' }
}

export function NovaOrdemPage() {
  const { tenantAtivo } = useTenant()
  const [params] = useSearchParams()
  const romaneioInicial = params.get('romaneio') ?? ''

  const recebimentosQuery = useQuery({
    queryKey: ['recebimentos', tenantAtivo.id],
    queryFn: () => recebimentosStore.listar(tenantAtivo.id),
  })

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const coresQuery = useQuery({
    queryKey: ['cores', tenantAtivo.id],
    queryFn: () => coresStore.listar(tenantAtivo.id),
  })

  if (recebimentosQuery.isPending) {
    return <Skeleton className="h-96 w-full" />
  }

  const romaneiosDisponiveis = recebimentosQuery.data ?? []

  if (romaneiosDisponiveis.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold text-brand-dark">Nenhum romaneio de entrada</h1>
        <p className="mt-2 text-sm text-brand-muted">
          A OS precisa vir de um recebimento: é dele que sai a rastreabilidade da peça.
          Registre a entrada da mercadoria primeiro.
        </p>
        <Button asChild className="mt-6">
          <Link to="/app/recebimento/recebimentos/novo">Registrar recebimento</Link>
        </Button>
      </div>
    )
  }

  // O formulário só monta com os dados na mão: assim os valores iniciais já saem
  // certos do romaneio da URL, sem um efeito reescrevendo o form depois.
  return (
    <FormularioOrdem
      romaneios={romaneiosDisponiveis}
      clientes={clientesQuery.data ?? []}
      cores={coresQuery.data ?? []}
      romaneioInicial={romaneioInicial}
    />
  )
}

function itensDoRomaneio(romaneio: RomaneioRecebimento | undefined) {
  if (!romaneio) return [itemVazio()]

  // Descrição e quantidade já foram conferidas na portaria; só a área falta.
  return romaneio.itens.map((item) => ({
    id: crypto.randomUUID(),
    descricao: item.descricao,
    quantidade: paraCampo(item.quantidade),
    area_m2: '',
  }))
}

function FormularioOrdem({
  romaneios,
  clientes,
  cores,
  romaneioInicial,
}: {
  romaneios: RomaneioRecebimento[]
  clientes: Cliente[]
  cores: Cor[]
  romaneioInicial: string
}) {
  const { tenantAtivo } = useTenant()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const inicial = romaneios.find((item) => item.id === romaneioInicial)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      romaneio_recebimento_id: inicial?.id ?? '',
      previsao_entrega: paraDatetimeLocal().slice(0, 10),
      urgencia: 'normal',
      cor_id: '',
      espessura_min_micron: '60',
      espessura_max_micron: '80',
      tipo_pretratamento: 'desengraxe',
      observacao: '',
      itens: itensDoRomaneio(inicial),
    },
  })

  const itens = useFieldArray({ control: form.control, name: 'itens' })
  const valores = useWatch({ control: form.control })

  const romaneio = romaneios.find(
    (item) => item.id === valores.romaneio_recebimento_id,
  )
  const cliente = clientes.find((item) => item.id === romaneio?.cliente_id)
  const cor = cores.find((item) => item.id === valores.cor_id)

  const { replace } = itens

  const areaPrevia = (valores.itens ?? []).reduce((soma, item) => {
    const area = paraNumero(item?.area_m2 ?? '')

    return soma + (Number.isFinite(area) ? area : 0)
  }, 0)

  const consumoPrevio =
    cor && areaPrevia > 0
      ? consumoEstimadoKg(
          [
            {
              id: '',
              os_id: '',
              descricao: '',
              quantidade: 0,
              area_m2: areaPrevia,
              foto_url: null,
            },
          ],
          cor.rendimento_teorico_g_m2,
        )
      : null

  const criar = useMutation({
    mutationFn: async (dados: FormValues) => {
      const numero = await proximoNumeroOs(tenantAtivo.id)
      const osId = crypto.randomUUID()
      const agora = new Date().toISOString()

      if (!romaneio) throw new Error('Romaneio não encontrado.')

      return ordensStore.criar(tenantAtivo.id, {
        numero,
        cliente_id: romaneio.cliente_id,
        romaneio_recebimento_id: dados.romaneio_recebimento_id,
        data_entrada: romaneio.data_hora.slice(0, 10),
        previsao_entrega: dados.previsao_entrega,
        urgencia: dados.urgencia,
        status: 'recebido',
        cor_id: dados.cor_id,
        espessura_min_micron: paraNumero(dados.espessura_min_micron),
        espessura_max_micron: paraNumero(dados.espessura_max_micron),
        tipo_pretratamento: dados.tipo_pretratamento,
        laudo_url: null,
        laudo_nome: '',
        observacao: dados.observacao.trim(),
        itens: dados.itens.map((item) => ({
          id: item.id,
          os_id: osId,
          descricao: item.descricao.trim(),
          quantidade: paraNumero(item.quantidade),
          area_m2: paraNumero(item.area_m2),
          foto_url: null,
        })),
        historico: [
          {
            id: crypto.randomUUID(),
            os_id: osId,
            de: null,
            para: 'recebido' as const,
            responsavel_id: user?.id ?? '',
            responsavel_nome: user?.nome ?? '',
            observacao: '',
            created_at: agora,
          },
        ],
      })
    },
    onSuccess: async (os) => {
      await queryClient.invalidateQueries({
        queryKey: ['ordens-servico', tenantAtivo.id],
      })
      toast.success(`OS #${String(os.numero).padStart(4, '0')} aberta`, {
        description: 'A ordem entrou no Kanban na coluna "Recebido".',
      })
      navigate(`/app/ordens-servico/${os.id}`, { replace: true })
    },
    onError: () => {
      toast.error('Não foi possível abrir a ordem', {
        description: 'Tente novamente em instantes.',
      })
    },
  })

  const erros = form.formState.errors
  const semCores = cores.length === 0

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link to="/app/ordens-servico/kanban">
          <ArrowLeft aria-hidden />
          Ordens de serviço
        </Link>
      </Button>

      <h1 className="mb-6 text-2xl font-bold text-brand-dark lg:text-3xl">
        Nova ordem de serviço
      </h1>

      {semCores && (
        <Alert variant="destructive" className="mb-5">
          <CircleAlert aria-hidden />
          <AlertDescription>
            Cadastre ao menos uma cor antes — é o rendimento dela que calcula o consumo
            de pó.
          </AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={(evento) =>
          void form.handleSubmit((dados) => criar.mutate(dados))(evento)
        }
        noValidate
        className="space-y-5"
      >
        <Card>
          <CardHeader>
            <CardTitle>Origem e prazo</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Campo
              id="romaneio_recebimento_id"
              label="Romaneio de entrada"
              erro={erros.romaneio_recebimento_id?.message}
              dica="A OS é rastreada até a carga que entrou na portaria."
            >
              <Controller
                control={form.control}
                name="romaneio_recebimento_id"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(valor) => {
                      field.onChange(valor)
                      // Trocar de romaneio repovoa os itens a partir da carga nova.
                      replace(itensDoRomaneio(romaneios.find((r) => r.id === valor)))
                    }}
                  >
                    <SelectTrigger id="romaneio_recebimento_id" className="w-full">
                      <SelectValue placeholder="Selecione o romaneio" />
                    </SelectTrigger>
                    <SelectContent>
                      {romaneios.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          #{String(item.numero).padStart(4, '0')} —{' '}
                          {formatDate(item.data_hora)} — {item.itens.length} item(ns)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            {cliente && (
              <p className="rounded-card bg-accent px-3 py-2 text-sm text-accent-foreground">
                Cliente: <strong>{cliente.razao_social}</strong> — herdado do romaneio.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                id="previsao_entrega"
                label="Previsão de entrega"
                erro={erros.previsao_entrega?.message}
              >
                <Input
                  id="previsao_entrega"
                  type="date"
                  aria-invalid={Boolean(erros.previsao_entrega)}
                  {...form.register('previsao_entrega')}
                />
              </Campo>

              <Campo id="urgencia" label="Urgência">
                <Controller
                  control={form.control}
                  name="urgencia"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="urgencia" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {URGENCIAS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {URGENCIA_LABEL[item]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Campo>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Especificação técnica</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Campo id="cor_id" label="Cor" erro={erros.cor_id?.message}>
              <Controller
                control={form.control}
                name="cor_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="cor_id" className="w-full">
                      <SelectValue placeholder="Selecione a cor" />
                    </SelectTrigger>
                    <SelectContent>
                      {cores.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.codigo_ral} — {item.nome_comercial} (
                          {item.rendimento_teorico_g_m2} g/m²)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <div className="grid gap-4 sm:grid-cols-3">
              <Campo
                id="espessura_min_micron"
                label="Espessura mín. (µm)"
                erro={erros.espessura_min_micron?.message}
              >
                <Input
                  id="espessura_min_micron"
                  inputMode="decimal"
                  aria-invalid={Boolean(erros.espessura_min_micron)}
                  {...form.register('espessura_min_micron')}
                />
              </Campo>

              <Campo
                id="espessura_max_micron"
                label="Espessura máx. (µm)"
                erro={erros.espessura_max_micron?.message}
              >
                <Input
                  id="espessura_max_micron"
                  inputMode="decimal"
                  aria-invalid={Boolean(erros.espessura_max_micron)}
                  {...form.register('espessura_max_micron')}
                />
              </Campo>

              <Campo id="tipo_pretratamento" label="Pré-tratamento">
                <Controller
                  control={form.control}
                  name="tipo_pretratamento"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="tipo_pretratamento" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRETRATAMENTOS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {PRETRATAMENTO_LABEL[item]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Campo>
            </div>

            <Campo id="observacao" label="Observações" dica="Opcional.">
              <Textarea id="observacao" rows={2} {...form.register('observacao')} />
            </Campo>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Itens e área</CardTitle>
                <p className="text-sm text-muted-foreground">
                  A área total é o que define o consumo de pó.
                </p>
              </div>

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
          </CardHeader>

          <CardContent className="space-y-4">
            {erros.itens?.root && (
              <p className="text-xs text-destructive">{erros.itens.root.message}</p>
            )}

            {itens.fields.map((campo, indice) => (
              <LinhaItem
                key={campo.id}
                indice={indice}
                form={form}
                podeRemover={itens.fields.length > 1}
                aoRemover={() => itens.remove(indice)}
              />
            ))}

            <div className="flex flex-wrap items-baseline justify-between gap-3 rounded-card bg-muted px-4 py-3">
              <span className="text-sm text-brand-muted">
                Área total:{' '}
                <strong className="font-mono text-brand-dark">
                  {areaPrevia.toLocaleString('pt-BR')} m²
                </strong>
              </span>

              <span className="text-sm text-brand-muted">
                Consumo estimado:{' '}
                <strong className="font-mono text-brand-dark">
                  {consumoPrevio !== null ? `${consumoPrevio.toFixed(2)} kg` : '—'}
                </strong>
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button asChild type="button" variant="outline" size="lg">
            <Link to="/app/ordens-servico/kanban">Cancelar</Link>
          </Button>

          <Button type="submit" size="lg" disabled={criar.isPending || semCores}>
            {criar.isPending ? 'Abrindo…' : 'Abrir ordem de serviço'}
          </Button>
        </div>
      </form>
    </div>
  )
}

/**
 * Linha de item com calculadora de área embutida: quem está na fábrica sabe as
 * dimensões da peça, não a metragem quadrada somada do lote.
 */
function LinhaItem({
  indice,
  form,
  podeRemover,
  aoRemover,
}: {
  indice: number
  form: ReturnType<typeof useForm<FormValues>>
  podeRemover: boolean
  aoRemover: () => void
}) {
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [doisLados, setDoisLados] = useState(true)
  const [aberta, setAberta] = useState(false)

  const erros = form.formState.errors.itens?.[indice]
  const quantidade = useWatch({ control: form.control, name: `itens.${indice}.quantidade` })

  function aplicar() {
    const l = paraNumero(largura)
    const a = paraNumero(altura)
    const q = paraNumero(quantidade ?? '')

    if (!Number.isFinite(l) || !Number.isFinite(a) || !Number.isFinite(q)) return

    const total = l * a * q * (doisLados ? 2 : 1)

    form.setValue(`itens.${indice}.area_m2`, paraCampo(Number(total.toFixed(3))), {
      shouldValidate: true,
    })
    setAberta(false)
  }

  return (
    <div className="rounded-card border border-border p-3">
      <div className="flex gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <Campo
            id={`itens.${indice}.descricao`}
            label="Item"
            erro={erros?.descricao?.message}
          >
            <Input
              id={`itens.${indice}.descricao`}
              aria-invalid={Boolean(erros?.descricao)}
              aria-describedby={descricaoDoCampo(
                `itens.${indice}.descricao`,
                erros?.descricao?.message,
              )}
              {...form.register(`itens.${indice}.descricao`)}
            />
          </Campo>

          <Campo
            id={`itens.${indice}.quantidade`}
            label="Qtd."
            erro={erros?.quantidade?.message}
          >
            <Input
              id={`itens.${indice}.quantidade`}
              inputMode="decimal"
              aria-invalid={Boolean(erros?.quantidade)}
              {...form.register(`itens.${indice}.quantidade`)}
            />
          </Campo>

          <Campo
            id={`itens.${indice}.area_m2`}
            label="Área m²"
            erro={erros?.area_m2?.message}
          >
            <Input
              id={`itens.${indice}.area_m2`}
              inputMode="decimal"
              aria-invalid={Boolean(erros?.area_m2)}
              {...form.register(`itens.${indice}.area_m2`)}
            />
          </Campo>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="mt-7 shrink-0 text-muted-foreground hover:bg-status-danger-soft hover:text-status-danger-strong"
          onClick={aoRemover}
          disabled={!podeRemover}
          aria-label={`Remover item ${indice + 1}`}
        >
          <Trash2 />
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1"
        onClick={() => setAberta((atual) => !atual)}
        aria-expanded={aberta}
      >
        <Calculator aria-hidden />
        Calcular por dimensões
      </Button>

      {aberta && (
        <div className="mt-2 rounded-card bg-muted p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo id={`calc-l-${indice}`} label="Largura (m)">
              <Input
                id={`calc-l-${indice}`}
                inputMode="decimal"
                value={largura}
                onChange={(evento) => setLargura(evento.target.value)}
              />
            </Campo>

            <Campo id={`calc-a-${indice}`} label="Altura (m)">
              <Input
                id={`calc-a-${indice}`}
                inputMode="decimal"
                value={altura}
                onChange={(evento) => setAltura(evento.target.value)}
              />
            </Campo>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 text-sm text-brand-text">
              <Checkbox
                checked={doisLados}
                onCheckedChange={(valor) => setDoisLados(valor === true)}
              />
              Pintar os dois lados
            </label>

            <Button type="button" size="sm" onClick={aplicar}>
              Aplicar na área
            </Button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            largura × altura × quantidade{doisLados ? ' × 2 faces' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

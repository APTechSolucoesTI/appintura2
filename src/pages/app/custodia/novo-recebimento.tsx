import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, Info, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { descricaoDoCampo } from '@/features/cadastros/aria'
import { Campo } from '@/features/cadastros/components/campo'
import { numeroPositivo, paraNumero } from '@/features/cadastros/validacao'
import { CapturaAssinatura } from '@/features/custodia/components/captura-assinatura'
import { CapturaFotos } from '@/features/custodia/components/captura-fotos'
import { Wizard, type EtapaWizard } from '@/features/custodia/components/wizard'
import { useAuth } from '@/features/auth/auth-context'
import { useTenant } from '@/features/tenant/tenant-context'
import { deDatetimeLocal, paraDatetimeLocal } from '@/lib/format'
import { clientesStore, transportadorasStore } from '@/services/cadastros-service'
import {
  criarRecebimentoComProvas,
  proximoNumeroRecebimento,
} from '@/services/custodia-service'
import {
  CONDICAO_LABEL,
  CONDICOES,
  STATUS_RECEBIMENTO,
  STATUS_RECEBIMENTO_LABEL,
  UNIDADE_ITEM_LABEL,
  UNIDADES_ITEM,
  type Foto,
} from '@/types/custodia'

const ETAPAS: EtapaWizard[] = [
  {
    id: 'origem',
    titulo: 'De quem é a carga',
    descricao: 'Cliente, transportadora e a nota de remessa que acompanha o material.',
  },
  {
    id: 'itens',
    titulo: 'O que chegou',
    descricao:
      'Descreva cada item, confira a quantidade e fotografe. Sem foto não dá para provar o estado de entrada.',
  },
  {
    id: 'conferencia',
    titulo: 'Conferência e assinatura',
    descricao: 'Resultado da conferência e assinatura de quem entregou.',
  },
  {
    id: 'revisao',
    titulo: 'Revisão',
    descricao: 'Confira antes de gerar o romaneio.',
  },
]

// Sem anotação explícita de tipo: `z.ZodType<Foto>` apagaria a forma inferida e
// `z.array(...)` passaria a produzir `unknown[]` no tipo de entrada do formulário.
const fotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  nome: z.string(),
  capturada_em: z.string(),
})

const itemSchema = z.object({
  id: z.string(),
  descricao: z.string().min(3, 'Descreva o item com pelo menos 3 caracteres.'),
  quantidade: numeroPositivo('Informe a quantidade.'),
  unidade: z.enum(UNIDADES_ITEM),
  peso_kg: z.string(),
  condicao_chegada: z.enum(CONDICOES),
  observacao: z.string(),
  fotos: z.array(fotoSchema).min(1, 'Cada item precisa de pelo menos uma foto.'),
})

const schema = z.object({
  cliente_id: z.string().min(1, 'Selecione o cliente dono da carga.'),
  transportadora_id: z.string(),
  data_hora: z.string().min(1, 'Informe a data e a hora da entrada.'),
  documento_numero: z.string().min(1, 'Informe o número da nota de remessa.'),
  documento_serie: z.string().min(1, 'Informe a série.'),
  documento_chave: z.string(),
  itens: z.array(itemSchema).min(1, 'Registre ao menos um item.'),
  status: z.enum(STATUS_RECEBIMENTO),
  observacao: z.string(),
  assinatura_nome: z.string().min(3, 'Informe quem está entregando.'),
  assinatura_url: z.string().min(1, 'Colha a assinatura de quem entregou.'),
})

type FormValues = z.infer<typeof schema>

function itemVazio() {
  return {
    id: crypto.randomUUID(),
    descricao: '',
    quantidade: '',
    unidade: 'peca' as const,
    peso_kg: '',
    condicao_chegada: 'integra' as const,
    observacao: '',
    fotos: [] as Foto[],
  }
}

/** Campos validados ao tentar sair de cada etapa. */
const CAMPOS_POR_ETAPA: Array<Array<keyof FormValues>> = [
  ['cliente_id', 'data_hora', 'documento_numero', 'documento_serie'],
  ['itens'],
  ['status', 'assinatura_nome', 'assinatura_url'],
  [],
]

export function NovoRecebimentoPage() {
  const { tenantAtivo } = useTenant()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [etapa, setEtapa] = useState(0)

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const transportadorasQuery = useQuery({
    queryKey: ['transportadoras', tenantAtivo.id],
    queryFn: () => transportadorasStore.listar(tenantAtivo.id),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cliente_id: '',
      transportadora_id: '',
      data_hora: paraDatetimeLocal(),
      documento_numero: '',
      documento_serie: '1',
      documento_chave: '',
      itens: [itemVazio()],
      status: 'recebido_conferido',
      observacao: '',
      assinatura_nome: '',
      assinatura_url: '',
    },
  })

  const itens = useFieldArray({ control: form.control, name: 'itens' })
  const valores = useWatch({ control: form.control })

  const salvar = useMutation({
    mutationFn: async (dados: FormValues) => {
      const numero = await proximoNumeroRecebimento(tenantAtivo.id)
      const romaneioId = crypto.randomUUID()

      return criarRecebimentoComProvas(tenantAtivo.id, {
        numero,
        cliente_id: dados.cliente_id,
        transportadora_id: dados.transportadora_id || null,
        data_hora: deDatetimeLocal(dados.data_hora),
        documento_numero: dados.documento_numero.trim(),
        documento_serie: dados.documento_serie.trim(),
        documento_chave: dados.documento_chave.trim(),
        conferente_id: user?.id ?? '',
        conferente_nome: user?.nome ?? '',
        status: dados.status,
        observacao: dados.observacao.trim(),
        assinatura_url: dados.assinatura_url,
        assinatura_nome: dados.assinatura_nome.trim(),
        os_id: null,
        itens: dados.itens.map((item) => ({
          id: item.id,
          romaneio_id: romaneioId,
          descricao: item.descricao.trim(),
          quantidade: paraNumero(item.quantidade),
          unidade: item.unidade,
          peso_kg: item.peso_kg.trim() ? paraNumero(item.peso_kg) : null,
          condicao_chegada: item.condicao_chegada,
          observacao: item.observacao.trim(),
          fotos: item.fotos,
        })),
      })
    },
    onSuccess: async (romaneio) => {
      await queryClient.invalidateQueries({ queryKey: ['recebimentos', tenantAtivo.id] })
      await queryClient.invalidateQueries({ queryKey: ['custodia', tenantAtivo.id] })
      toast.success(`Romaneio #${String(romaneio.numero).padStart(4, '0')} gerado`, {
        description: 'A mercadoria já aparece no saldo de custódia do cliente.',
      })
      navigate(`/app/recebimento/recebimentos/${romaneio.id}`, { replace: true })
    },
    onError: () => {
      toast.error('Não foi possível gerar o romaneio', {
        description: 'Tente novamente em instantes.',
      })
    },
  })

  async function avancar() {
    const valido = await form.trigger(CAMPOS_POR_ETAPA[etapa])

    if (!valido) return

    setEtapa((atual) => atual + 1)
  }

  function voltar() {
    if (etapa === 0) {
      navigate('/app/recebimento/recebimentos')
      return
    }

    setEtapa((atual) => atual - 1)
  }

  const erros = form.formState.errors
  const clientes = clientesQuery.data ?? []
  const transportadoras = transportadorasQuery.data ?? []
  const semClientes = !clientesQuery.isPending && clientes.length === 0

  if (semClientes) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold text-brand-dark">Cadastre um cliente antes</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Todo romaneio de recebimento pertence a um cliente. Cadastre o cliente em{' '}
          {tenantAtivo.nome_fantasia} para registrar a entrada.
        </p>
        <Button className="mt-6" onClick={() => navigate('/app/cadastros/clientes')}>
          Ir para Clientes
        </Button>
      </div>
    )
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-brand-dark lg:text-3xl">
        Novo recebimento
      </h1>

      <Wizard
        etapas={ETAPAS}
        indiceAtual={etapa}
        aoVoltar={voltar}
        aoAvancar={() => void avancar()}
        aoConcluir={() => void form.handleSubmit((dados) => salvar.mutate(dados))()}
        concluindo={salvar.isPending}
        rotuloConcluir="Gerar romaneio"
      >
        {etapa === 0 && (
          <div className="space-y-5">
            <Campo id="cliente_id" label="Cliente" erro={erros.cliente_id?.message}>
              <Controller
                control={form.control}
                name="cliente_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="cliente_id" className="w-full" size="default">
                      <SelectValue placeholder="Selecione o dono da mercadoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <Campo
              id="transportadora_id"
              label="Transportadora"
              dica="Deixe em branco se veio em veículo do próprio cliente."
            >
              <Controller
                control={form.control}
                name="transportadora_id"
                render={({ field }) => (
                  <Select
                    value={field.value || 'nenhuma'}
                    onValueChange={(valor) =>
                      field.onChange(valor === 'nenhuma' ? '' : valor)
                    }
                  >
                    <SelectTrigger id="transportadora_id" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Veículo do cliente</SelectItem>
                      {transportadoras.map((transportadora) => (
                        <SelectItem key={transportadora.id} value={transportadora.id}>
                          {transportadora.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <Campo
              id="data_hora"
              label="Data e hora da entrada"
              erro={erros.data_hora?.message}
            >
              <Input
                id="data_hora"
                type="datetime-local"
                aria-invalid={Boolean(erros.data_hora)}
                {...form.register('data_hora')}
              />
            </Campo>

            <fieldset className="rounded-card border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-brand-dark">
                Nota de remessa do cliente
              </legend>

              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <Campo
                  id="documento_numero"
                  label="Número"
                  erro={erros.documento_numero?.message}
                >
                  <Input
                    id="documento_numero"
                    inputMode="numeric"
                    className="font-mono"
                    aria-invalid={Boolean(erros.documento_numero)}
                    {...form.register('documento_numero')}
                  />
                </Campo>

                <Campo
                  id="documento_serie"
                  label="Série"
                  erro={erros.documento_serie?.message}
                >
                  <Input
                    id="documento_serie"
                    inputMode="numeric"
                    className="font-mono"
                    aria-invalid={Boolean(erros.documento_serie)}
                    {...form.register('documento_serie')}
                  />
                </Campo>
              </div>

              <Campo
                id="documento_chave"
                label="Chave de acesso"
                dica="Opcional — 44 dígitos da NF-e."
                className="mt-4"
              >
                <Input
                  id="documento_chave"
                  inputMode="numeric"
                  className="font-mono text-xs"
                  {...form.register('documento_chave')}
                />
              </Campo>
            </fieldset>
          </div>
        )}

        {etapa === 1 && (
          <div className="space-y-4">
            {erros.itens?.root && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertDescription>{erros.itens.root.message}</AlertDescription>
              </Alert>
            )}

            {itens.fields.map((campo, indice) => {
              const erroItem = erros.itens?.[indice]
              const descricao = valores.itens?.[indice]?.descricao || `item ${indice + 1}`

              return (
                <Card key={campo.id}>
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-xs tracking-[0.14em] text-brand-medium uppercase">
                        Item {indice + 1}
                      </span>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => itens.remove(indice)}
                        disabled={itens.fields.length === 1}
                        aria-label={`Remover item ${indice + 1}`}
                        className="text-muted-foreground hover:bg-status-danger-soft hover:text-status-danger-strong"
                      >
                        <Trash2 />
                      </Button>
                    </div>

                    <Campo
                      id={`itens.${indice}.descricao`}
                      label="Descrição"
                      erro={erroItem?.descricao?.message}
                    >
                      <Input
                        id={`itens.${indice}.descricao`}
                        placeholder="Portão de correr 3,5 m x 2,2 m"
                        aria-invalid={Boolean(erroItem?.descricao)}
                        {...form.register(`itens.${indice}.descricao`)}
                      />
                    </Campo>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <Campo
                        id={`itens.${indice}.quantidade`}
                        label="Quantidade"
                        erro={erroItem?.quantidade?.message}
                      >
                        <Input
                          id={`itens.${indice}.quantidade`}
                          inputMode="decimal"
                          aria-invalid={Boolean(erroItem?.quantidade)}
                          {...form.register(`itens.${indice}.quantidade`)}
                        />
                      </Campo>

                      <Campo id={`itens.${indice}.unidade`} label="Unidade">
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
                                {UNIDADES_ITEM.map((unidade) => (
                                  <SelectItem key={unidade} value={unidade}>
                                    {UNIDADE_ITEM_LABEL[unidade]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </Campo>

                      <Campo
                        id={`itens.${indice}.peso_kg`}
                        label="Peso (kg)"
                        dica="Opcional."
                      >
                        <Input
                          id={`itens.${indice}.peso_kg`}
                          inputMode="decimal"
                          {...form.register(`itens.${indice}.peso_kg`)}
                        />
                      </Campo>
                    </div>

                    <Campo
                      id={`itens.${indice}.condicao_chegada`}
                      label="Condição na chegada"
                    >
                      <Controller
                        control={form.control}
                        name={`itens.${indice}.condicao_chegada`}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger
                              id={`itens.${indice}.condicao_chegada`}
                              className="w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONDICOES.map((condicao) => (
                                <SelectItem key={condicao} value={condicao}>
                                  {CONDICAO_LABEL[condicao]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Campo>

                    {valores.itens?.[indice]?.condicao_chegada !== 'integra' && (
                      <Campo
                        id={`itens.${indice}.observacao`}
                        label="O que foi observado"
                        dica="Descreva a avaria ou a ressalva — é o que protege você depois."
                      >
                        <Textarea
                          id={`itens.${indice}.observacao`}
                          rows={2}
                          {...form.register(`itens.${indice}.observacao`)}
                        />
                      </Campo>
                    )}

                    <div>
                      <p className="mb-2 text-sm font-medium text-brand-dark">
                        Fotos da entrada
                      </p>

                      <Controller
                        control={form.control}
                        name={`itens.${indice}.fotos`}
                        render={({ field }) => (
                          <CapturaFotos
                            fotos={field.value}
                            aoAlterar={field.onChange}
                            rotulo={descricao}
                            erro={erroItem?.fotos?.message ?? erroItem?.fotos?.root?.message}
                          />
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => itens.append(itemVazio())}
            >
              <Plus aria-hidden />
              Adicionar item
            </Button>
          </div>
        )}

        {etapa === 2 && (
          <div className="space-y-5">
            <Campo id="status" label="Resultado da conferência">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_RECEBIMENTO.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_RECEBIMENTO_LABEL[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <Campo
              id="observacao"
              label="Observações do recebimento"
              dica="Opcional. Vale para o romaneio inteiro."
            >
              <Textarea id="observacao" rows={3} {...form.register('observacao')} />
            </Campo>

            <Campo
              id="assinatura_nome"
              label="Quem entregou"
              erro={erros.assinatura_nome?.message}
            >
              <Input
                id="assinatura_nome"
                placeholder="Nome do motorista ou do responsável"
                aria-invalid={Boolean(erros.assinatura_nome)}
                aria-describedby={descricaoDoCampo(
                  'assinatura_nome',
                  erros.assinatura_nome?.message,
                )}
                {...form.register('assinatura_nome')}
              />
            </Campo>

            <div>
              <p className="mb-2 text-sm font-medium text-brand-dark">Assinatura</p>

              <Controller
                control={form.control}
                name="assinatura_url"
                render={({ field }) => (
                  <CapturaAssinatura
                    valor={field.value || null}
                    aoAlterar={(dataUrl) => field.onChange(dataUrl ?? '')}
                    rotulo={valores.assinatura_nome || 'quem entregou'}
                    erro={erros.assinatura_url?.message}
                  />
                )}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Conferente: {user?.nome} — registrado automaticamente no romaneio.
            </p>
          </div>
        )}

        {etapa === 3 && (
          <Revisao
            valores={valores as Partial<FormValues>}
            nomeCliente={
              clientes.find((cliente) => cliente.id === valores.cliente_id)
                ?.razao_social ?? ''
            }
            nomeTransportadora={
              transportadoras.find(
                (transportadora) => transportadora.id === valores.transportadora_id,
              )?.nome ?? 'Veículo do cliente'
            }
          />
        )}
      </Wizard>
    </>
  )
}

function Revisao({
  valores,
  nomeCliente,
  nomeTransportadora,
}: {
  valores: Partial<FormValues>
  nomeCliente: string
  nomeTransportadora: string
}) {
  const totalFotos = (valores.itens ?? []).reduce(
    (soma, item) => soma + (item?.fotos?.length ?? 0),
    0,
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Linha rotulo="Cliente" valor={nomeCliente} />
          <Linha rotulo="Transportadora" valor={nomeTransportadora} />
          <Linha
            rotulo="Nota de remessa"
            valor={`${valores.documento_numero}/${valores.documento_serie}`}
            mono
          />
          <Linha
            rotulo="Conferência"
            valor={
              valores.status ? STATUS_RECEBIMENTO_LABEL[valores.status] : '—'
            }
          />
          <Linha
            rotulo="Itens"
            valor={`${valores.itens?.length ?? 0} item(ns), ${totalFotos} foto(s)`}
          />
          <Linha rotulo="Entregue por" valor={valores.assinatura_nome ?? '—'} />
        </CardContent>
      </Card>

      <ul className="space-y-2">
        {(valores.itens ?? []).map((item, indice) => (
          <li
            key={item?.id ?? indice}
            className="flex items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3 text-sm"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-brand-dark">
                {item?.descricao}
              </span>
              <span className="block text-xs text-muted-foreground">
                {item?.condicao_chegada
                  ? CONDICAO_LABEL[item.condicao_chegada]
                  : ''}{' '}
                · {item?.fotos?.length ?? 0} foto(s)
              </span>
            </span>

            <span className="shrink-0 font-mono text-brand-dark">
              {item?.quantidade}{' '}
              {item?.unidade ? UNIDADE_ITEM_LABEL[item.unidade] : ''}
            </span>
          </li>
        ))}
      </ul>

      {/* Fase 3 liga o romaneio à OS. Mostramos o passo para a portaria saber que
          ele existe, em vez de esconder e surpreender depois. */}
      <Alert>
        <Info aria-hidden />
        <AlertDescription>
          A abertura automática de OS a partir deste romaneio entra na Fase 3. Por
          enquanto o romaneio é gerado apenas como registro de custódia — o que já
          basta para o saldo do cliente ficar correto.
        </AlertDescription>
      </Alert>
    </div>
  )
}

function Linha({
  rotulo,
  valor,
  mono = false,
}: {
  rotulo: string
  valor: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
        {rotulo}
      </p>
      <p className={mono ? 'mt-1 font-mono text-brand-dark' : 'mt-1 text-brand-dark'}>
        {valor}
      </p>
    </div>
  )
}

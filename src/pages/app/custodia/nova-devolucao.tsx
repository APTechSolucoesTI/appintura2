import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CircleAlert, Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Campo } from '@/features/cadastros/components/campo'
import { paraNumero } from '@/features/cadastros/validacao'
import { useAuth } from '@/features/auth/auth-context'
import { CapturaAssinatura } from '@/features/custodia/components/captura-assinatura'
import { CapturaFotos } from '@/features/custodia/components/captura-fotos'
import { Wizard, type EtapaWizard } from '@/features/custodia/components/wizard'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDate } from '@/lib/format'
import { mascararDocumento, apenasDigitos, validarCpfCnpj } from '@/lib/documento'
import { clientesStore, transportadorasStore } from '@/services/cadastros-service'
import {
  calcularSaldoCustodia,
  devolucoesStore,
  proximoNumeroDevolucao,
  recebimentosStore,
} from '@/services/custodia-service'
import {
  CONDICAO_LABEL,
  CONDICOES,
  UNIDADE_ITEM_LABEL,
  type Condicao,
  type Foto,
  type SaldoItem,
  type StatusDevolucao,
} from '@/types/custodia'

const ETAPAS: EtapaWizard[] = [
  {
    id: 'origem',
    titulo: 'De quem é a saída',
    descricao: 'Escolha o cliente e os romaneios de entrada cujo material está saindo.',
  },
  {
    id: 'itens',
    titulo: 'O que está saindo',
    descricao:
      'Ajuste a quantidade, registre a condição de saída e fotografe. Devolver menos do que entrou exige justificativa.',
  },
  {
    id: 'retirada',
    titulo: 'Quem está retirando',
    descricao: 'Identificação de quem leva a mercadoria e assinatura da retirada.',
  },
  { id: 'revisao', titulo: 'Revisão', descricao: 'Comparativo antes de gerar o romaneio.' },
]

interface ItemDevolucao {
  saldo: SaldoItem
  incluir: boolean
  quantidade: string
  condicao_saida: Condicao
  justificativa: string
  fotos: Foto[]
}

export function NovaDevolucaoPage() {
  const { tenantAtivo } = useTenant()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [etapa, setEtapa] = useState(0)
  const [clienteId, setClienteId] = useState('')
  const [recebimentoIds, setRecebimentoIds] = useState<string[]>([])
  /** Só o que o usuário mexeu; o resto é derivado do saldo durante o render. */
  const [ajustes, setAjustes] = useState<Record<string, Partial<ItemDevolucao>>>({})
  const [saindoAgora, setSaindoAgora] = useState(true)
  const [retiradoNome, setRetiradoNome] = useState('')
  const [retiradoDocumento, setRetiradoDocumento] = useState('')
  const [transportadoraId, setTransportadoraId] = useState('')
  const [placa, setPlaca] = useState('')
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const transportadorasQuery = useQuery({
    queryKey: ['transportadoras', tenantAtivo.id],
    queryFn: () => transportadorasStore.listar(tenantAtivo.id),
  })

  const recebimentosQuery = useQuery({
    queryKey: ['recebimentos', tenantAtivo.id],
    queryFn: () => recebimentosStore.listar(tenantAtivo.id),
  })

  const saldoQuery = useQuery({
    queryKey: ['custodia', tenantAtivo.id],
    queryFn: () => calcularSaldoCustodia(tenantAtivo.id),
  })

  const saldos = useMemo(() => saldoQuery.data ?? [], [saldoQuery.data])

  /** Clientes que têm efetivamente algo no pátio — devolver o que não entrou não existe. */
  const clientesComSaldo = useMemo(
    () => saldos.filter((cliente) => cliente.saldo > 0),
    [saldos],
  )

  const recebimentosDisponiveis = useMemo(() => {
    if (!clienteId) return []

    const cliente = saldos.find((item) => item.cliente_id === clienteId)

    if (!cliente) return []

    const idsComSaldo = new Set(
      cliente.itens.filter((item) => item.saldo > 0).map((item) => item.recebimento_id),
    )

    return (recebimentosQuery.data ?? []).filter((romaneio) =>
      idsComSaldo.has(romaneio.id),
    )
  }, [clienteId, saldos, recebimentosQuery.data])

  /**
   * A lista sai do saldo real, com os ajustes do usuário aplicados por cima.
   * Derivar em vez de espelhar em estado evita que um romaneio desmarcado
   * continue na lista — e que a quantidade fique presa a um saldo já vencido.
   */
  const itens = useMemo<ItemDevolucao[]>(() => {
    const cliente = saldos.find((item) => item.cliente_id === clienteId)

    if (!cliente) return []

    return cliente.itens
      .filter((item) => item.saldo > 0 && recebimentoIds.includes(item.recebimento_id))
      .map((saldo) => ({
        saldo,
        incluir: true,
        quantidade: String(saldo.saldo),
        condicao_saida: 'integra' as Condicao,
        justificativa: '',
        fotos: [] as Foto[],
        ...ajustes[saldo.recebimento_item_id],
      }))
  }, [clienteId, recebimentoIds, saldos, ajustes])

  function alterarItem(id: string, mudanca: Partial<ItemDevolucao>) {
    setAjustes((atual) => ({ ...atual, [id]: { ...atual[id], ...mudanca } }))
  }

  const selecionados = itens.filter((item) => item.incluir)

  function validarEtapa(indice: number): boolean {
    const novos: Record<string, string> = {}

    if (indice === 0) {
      if (!clienteId) novos.cliente = 'Selecione o cliente.'
      if (recebimentoIds.length === 0) {
        novos.recebimentos = 'Selecione ao menos um romaneio de entrada.'
      }
    }

    if (indice === 1) {
      if (selecionados.length === 0) {
        novos.itens = 'Selecione ao menos um item para devolver.'
      }

      for (const item of selecionados) {
        const chave = item.saldo.recebimento_item_id
        const quantidade = paraNumero(item.quantidade)

        if (!Number.isFinite(quantidade) || quantidade <= 0) {
          novos[`qtd-${chave}`] = 'Informe uma quantidade maior que zero.'
        } else if (quantidade > item.saldo.saldo) {
          // Impede devolver mais do que entrou — seria saldo negativo.
          novos[`qtd-${chave}`] =
            `Só há ${item.saldo.saldo} em custódia deste item.`
        } else if (quantidade < item.saldo.saldo && !item.justificativa.trim()) {
          novos[`just-${chave}`] =
            'Devolução parcial precisa de justificativa — é o que evita divergência sem explicação.'
        }

        if (item.fotos.length === 0) {
          novos[`foto-${chave}`] = 'Fotografe o item na saída.'
        }
      }
    }

    if (indice === 2) {
      if (retiradoNome.trim().length < 3) {
        novos.retiradoNome = 'Informe quem está retirando.'
      }

      if (saindoAgora) {
        if (!validarCpfCnpj(retiradoDocumento)) {
          novos.retiradoDocumento = 'Informe um CPF ou CNPJ válido.'
        }

        if (!assinatura) {
          novos.assinatura = 'Colha a assinatura de quem está retirando.'
        }
      }
    }

    setErros(novos)

    return Object.keys(novos).length === 0
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const numero = await proximoNumeroDevolucao(tenantAtivo.id)
      const devolucaoId = crypto.randomUUID()

      // Saiu tudo o que estava em custódia nos romaneios escolhidos? Então é
      // retirada completa; caso contrário, parcial.
      const totalEmCustodia = itens.reduce((soma, item) => soma + item.saldo.saldo, 0)
      const totalSaindo = selecionados.reduce(
        (soma, item) => soma + paraNumero(item.quantidade),
        0,
      )

      const status: StatusDevolucao = !saindoAgora
        ? 'aguardando_retirada'
        : totalSaindo >= totalEmCustodia
          ? 'retirado'
          : 'retirado_parcial'

      return devolucoesStore.criar(tenantAtivo.id, {
        numero,
        cliente_id: clienteId,
        recebimento_ids: recebimentoIds,
        data_hora: new Date().toISOString(),
        retirado_por_nome: retiradoNome.trim(),
        retirado_por_documento: apenasDigitos(retiradoDocumento),
        transportadora_id: transportadoraId || null,
        placa: placa.trim().toUpperCase(),
        status,
        assinatura_url: assinatura,
        responsavel_id: user?.id ?? '',
        responsavel_nome: user?.nome ?? '',
        itens: selecionados.map((item) => ({
          id: crypto.randomUUID(),
          romaneio_devolucao_id: devolucaoId,
          recebimento_item_id: item.saldo.recebimento_item_id,
          descricao: item.saldo.descricao,
          quantidade: paraNumero(item.quantidade),
          unidade: item.saldo.unidade,
          condicao_saida: item.condicao_saida,
          justificativa: item.justificativa.trim(),
          fotos: item.fotos,
        })),
      })
    },
    onSuccess: async (devolucao) => {
      await queryClient.invalidateQueries({ queryKey: ['devolucoes', tenantAtivo.id] })
      await queryClient.invalidateQueries({ queryKey: ['custodia', tenantAtivo.id] })
      toast.success(
        `Romaneio de devolução #${String(devolucao.numero).padStart(4, '0')} gerado`,
        { description: 'O saldo de custódia do cliente foi atualizado.' },
      )
      navigate(`/app/recebimento/devolucoes/${devolucao.id}`, { replace: true })
    },
    onError: () => {
      toast.error('Não foi possível gerar a devolução', {
        description: 'Tente novamente em instantes.',
      })
    },
  })

  function avancar() {
    if (!validarEtapa(etapa)) return

    setEtapa((atual) => atual + 1)
  }

  function voltar() {
    if (etapa === 0) {
      navigate('/app/recebimento/devolucoes')
      return
    }

    setErros({})
    setEtapa((atual) => atual - 1)
  }

  if (saldoQuery.isSuccess && clientesComSaldo.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold text-brand-dark">Nada para devolver</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Não há mercadoria em custódia em {tenantAtivo.nome_fantasia}. A devolução só
          existe a partir de um recebimento com saldo.
        </p>
        <Button className="mt-6" onClick={() => navigate('/app/recebimento/custodia')}>
          Ver saldo de custódia
        </Button>
      </div>
    )
  }

  const clientes = clientesQuery.data ?? []
  const transportadoras = transportadorasQuery.data ?? []

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-brand-dark lg:text-3xl">
        Nova devolução
      </h1>

      <Wizard
        etapas={ETAPAS}
        indiceAtual={etapa}
        aoVoltar={voltar}
        aoAvancar={avancar}
        aoConcluir={() => salvar.mutate()}
        concluindo={salvar.isPending}
        rotuloConcluir="Gerar romaneio de saída"
      >
        {etapa === 0 && (
          <div className="space-y-5">
            <Campo id="cliente" label="Cliente" erro={erros.cliente}>
              <Select
                value={clienteId}
                onValueChange={(valor) => {
                  setClienteId(valor)
                  setRecebimentoIds([])
                  setAjustes({})
                }}
              >
                <SelectTrigger id="cliente" className="w-full">
                  <SelectValue placeholder="Selecione o cliente com material no pátio" />
                </SelectTrigger>
                <SelectContent>
                  {clientesComSaldo.map((cliente) => (
                    <SelectItem key={cliente.cliente_id} value={cliente.cliente_id}>
                      {cliente.cliente_nome} — {cliente.saldo} em custódia
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            {clienteId && (
              <div>
                <p className="mb-2 text-sm font-medium text-brand-dark">
                  Romaneios de entrada
                </p>

                {erros.recebimentos && (
                  <p className="mb-2 text-xs text-destructive">{erros.recebimentos}</p>
                )}

                <ul className="space-y-2">
                  {recebimentosDisponiveis.map((romaneio) => {
                    const marcado = recebimentoIds.includes(romaneio.id)

                    return (
                      <li key={romaneio.id}>
                        <label
                          className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-card border p-3 transition-colors ${
                            marcado
                              ? 'border-brand-medium bg-accent'
                              : 'border-border bg-card hover:bg-muted'
                          }`}
                        >
                          <Checkbox
                            checked={marcado}
                            onCheckedChange={(valor) =>
                              setRecebimentoIds((atual) =>
                                valor === true
                                  ? [...atual, romaneio.id]
                                  : atual.filter((id) => id !== romaneio.id),
                              )
                            }
                          />

                          <span className="min-w-0 flex-1">
                            <span className="block font-mono text-sm font-semibold text-brand-medium">
                              #{String(romaneio.numero).padStart(4, '0')}
                            </span>
                            <span className="block text-sm text-brand-text">
                              {romaneio.itens.length} item(ns) · entrada em{' '}
                              {formatDate(romaneio.data_hora)}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <Alert>
              <Info aria-hidden />
              <AlertDescription>
                O vínculo com ordens de serviço finalizadas entra na Fase 3. Hoje a saída
                é amarrada ao romaneio de entrada, que é o que garante o comparativo de
                quantidade.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {etapa === 1 && (
          <div className="space-y-4">
            {erros.itens && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertDescription>{erros.itens}</AlertDescription>
              </Alert>
            )}

            {itens.map((item) => {
              const chave = item.saldo.recebimento_item_id
              const quantidade = paraNumero(item.quantidade)
              const parcial =
                Number.isFinite(quantidade) && quantidade < item.saldo.saldo

              return (
                <Card key={chave}>
                  <CardContent className="space-y-4">
                    <label className="flex items-start gap-3">
                      <Checkbox
                        checked={item.incluir}
                        onCheckedChange={(valor) =>
                          alterarItem(chave, { incluir: valor === true })
                        }
                        aria-label={`Incluir ${item.saldo.descricao} na devolução`}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-brand-dark">
                          {item.saldo.descricao}
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {item.saldo.saldo} {UNIDADE_ITEM_LABEL[item.saldo.unidade]} em
                          custódia · romaneio #
                          {String(item.saldo.recebimento_numero).padStart(4, '0')}
                        </span>
                      </span>
                    </label>

                    {item.incluir && (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Campo
                            id={`qtd-${chave}`}
                            label="Quantidade devolvida"
                            erro={erros[`qtd-${chave}`]}
                          >
                            <Input
                              id={`qtd-${chave}`}
                              inputMode="decimal"
                              value={item.quantidade}
                              onChange={(event) =>
                                alterarItem(chave, { quantidade: event.target.value })
                              }
                              aria-invalid={Boolean(erros[`qtd-${chave}`])}
                            />
                          </Campo>

                          <Campo id={`cond-${chave}`} label="Condição na saída">
                            <Select
                              value={item.condicao_saida}
                              onValueChange={(valor) =>
                                alterarItem(chave, {
                                  condicao_saida: valor as Condicao,
                                })
                              }
                            >
                              <SelectTrigger id={`cond-${chave}`} className="w-full">
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
                          </Campo>
                        </div>

                        {parcial && (
                          <Campo
                            id={`just-${chave}`}
                            label="Justificativa da devolução parcial"
                            erro={erros[`just-${chave}`]}
                            dica={`Ficam ${item.saldo.saldo - quantidade} unidade(s) em custódia.`}
                          >
                            <Textarea
                              id={`just-${chave}`}
                              rows={2}
                              value={item.justificativa}
                              onChange={(event) =>
                                alterarItem(chave, { justificativa: event.target.value })
                              }
                              aria-invalid={Boolean(erros[`just-${chave}`])}
                            />
                          </Campo>
                        )}

                        <div>
                          <p className="mb-2 text-sm font-medium text-brand-dark">
                            Fotos da saída
                          </p>

                          <CapturaFotos
                            fotos={item.fotos}
                            aoAlterar={(fotos) => alterarItem(chave, { fotos })}
                            rotulo={item.saldo.descricao}
                            erro={erros[`foto-${chave}`]}
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {etapa === 2 && (
          <div className="space-y-5">
            <fieldset className="rounded-card border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-brand-dark">
                Momento da saída
              </legend>

              <div className="space-y-2">
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-field px-1">
                  <input
                    type="radio"
                    name="momento"
                    checked={saindoAgora}
                    onChange={() => setSaindoAgora(true)}
                    className="size-4 accent-[var(--brand-dark)]"
                  />
                  <span className="text-sm text-brand-text">
                    A mercadoria está saindo agora
                  </span>
                </label>

                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-field px-1">
                  <input
                    type="radio"
                    name="momento"
                    checked={!saindoAgora}
                    onChange={() => setSaindoAgora(false)}
                    className="size-4 accent-[var(--brand-dark)]"
                  />
                  <span className="text-sm text-brand-text">
                    Separar e deixar aguardando retirada
                  </span>
                </label>
              </div>
            </fieldset>

            <Campo
              id="retirado_nome"
              label={saindoAgora ? 'Quem está retirando' : 'Quem vai retirar'}
              erro={erros.retiradoNome}
            >
              <Input
                id="retirado_nome"
                value={retiradoNome}
                onChange={(event) => setRetiradoNome(event.target.value)}
                aria-invalid={Boolean(erros.retiradoNome)}
              />
            </Campo>

            <Campo
              id="retirado_documento"
              label="CPF ou CNPJ de quem retira"
              erro={erros.retiradoDocumento}
              dica={saindoAgora ? undefined : 'Pode ser preenchido na retirada.'}
            >
              <Input
                id="retirado_documento"
                inputMode="numeric"
                value={retiradoDocumento}
                onChange={(event) =>
                  setRetiradoDocumento(mascararDocumento(event.target.value))
                }
                aria-invalid={Boolean(erros.retiradoDocumento)}
              />
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="transportadora" label="Transportadora" dica="Opcional.">
                <Select
                  value={transportadoraId || 'nenhuma'}
                  onValueChange={(valor) =>
                    setTransportadoraId(valor === 'nenhuma' ? '' : valor)
                  }
                >
                  <SelectTrigger id="transportadora" className="w-full">
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
              </Campo>

              <Campo id="placa" label="Placa do veículo" dica="Opcional.">
                <Input
                  id="placa"
                  value={placa}
                  onChange={(event) => setPlaca(event.target.value.toUpperCase())}
                  className="font-mono uppercase"
                  maxLength={8}
                />
              </Campo>
            </div>

            {saindoAgora && (
              <div>
                <p className="mb-2 text-sm font-medium text-brand-dark">
                  Assinatura de quem retira
                </p>

                <CapturaAssinatura
                  valor={assinatura}
                  aoAlterar={setAssinatura}
                  rotulo={retiradoNome || 'quem retira'}
                  erro={erros.assinatura}
                />
              </div>
            )}
          </div>
        )}

        {etapa === 3 && (
          <Comparativo
            itens={selecionados}
            clienteNome={
              clientes.find((cliente) => cliente.id === clienteId)?.razao_social ?? ''
            }
            saindoAgora={saindoAgora}
            retiradoNome={retiradoNome}
          />
        )}
      </Wizard>
    </>
  )
}

/** Recebido × devolvido item a item — o entregável central da devolução. */
function Comparativo({
  itens,
  clienteNome,
  saindoAgora,
  retiradoNome,
}: {
  itens: ItemDevolucao[]
  clienteNome: string
  saindoAgora: boolean
  retiradoNome: string
}) {
  const divergencias = itens.filter(
    (item) => paraNumero(item.quantidade) < item.saldo.saldo,
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
              Cliente
            </p>
            <p className="mt-1 text-brand-dark">{clienteNome}</p>
          </div>

          <div>
            <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
              {saindoAgora ? 'Retirado por' : 'Aguardando retirada de'}
            </p>
            <p className="mt-1 text-brand-dark">{retiradoNome}</p>
          </div>
        </CardContent>
      </Card>

      <ul className="divide-y divide-border rounded-card border border-border bg-card">
        {itens.map((item) => {
          const devolvido = paraNumero(item.quantidade)
          const resta = item.saldo.saldo - devolvido

          return (
            <li key={item.saldo.recebimento_item_id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-brand-dark">
                  {item.saldo.descricao}
                </span>

                <span className="font-mono text-sm text-brand-dark">
                  {devolvido} de {item.saldo.saldo}{' '}
                  {UNIDADE_ITEM_LABEL[item.saldo.unidade]}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Entrou {item.saldo.recebido} · já havia saído {item.saldo.devolvido} ·{' '}
                {CONDICAO_LABEL[item.condicao_saida]} · {item.fotos.length} foto(s)
              </p>

              {resta > 0 && (
                <p className="mt-2 rounded-field bg-status-warning-soft px-2 py-1 text-xs text-status-warning-strong">
                  Ficam {resta} unidade(s) em custódia. {item.justificativa}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {divergencias.length > 0 && (
        <Alert>
          <AlertTriangle aria-hidden />
          <AlertDescription>
            {divergencias.length} item(ns) saem em quantidade menor do que a que está em
            custódia. Todas as diferenças estão justificadas e ficam registradas no
            romaneio.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatCurrency } from '@/lib/format'
import { clientesStore, coresStore } from '@/services/cadastros-service'
import { orcamentosStore } from '@/services/orcamento-service'
import { totalDosItens } from '@/types/orcamento'
import { PRETRATAMENTO_LABEL, PRETRATAMENTOS } from '@/types/producao'

interface LinhaItem {
  chave: string
  descricao: string
  tipo_acabamento: string
  quantidade: string
  area_m2: string
  valor_unitario: string
}

function linhaVazia(): LinhaItem {
  return {
    chave: crypto.randomUUID(),
    descricao: '',
    tipo_acabamento: '',
    quantidade: '1',
    area_m2: '0',
    valor_unitario: '0',
  }
}

function paraNumero(valor: string): number {
  const limpo = valor.replace(/\./g, '').replace(',', '.')
  const numero = Number.parseFloat(limpo)

  return Number.isFinite(numero) ? numero : 0
}

/** Data de hoje + N dias, no formato do input[type=date]. */
function emDias(dias: number): string {
  const data = new Date()
  data.setDate(data.getDate() + dias)

  return data.toISOString().slice(0, 10)
}

export function OrcamentoFormularioPage() {
  const { tenantAtivo } = useTenant()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const editando = Boolean(id)

  const clientesQuery = useQuery({
    queryKey: ['clientes', tenantAtivo.id],
    queryFn: () => clientesStore.listar(tenantAtivo.id),
  })

  const coresQuery = useQuery({
    queryKey: ['cores', tenantAtivo.id],
    queryFn: () => coresStore.listar(tenantAtivo.id),
  })

  const orcamentoQuery = useQuery({
    queryKey: ['orcamento', tenantAtivo.id, id],
    queryFn: () => orcamentosStore.obter(tenantAtivo.id, id ?? ''),
    enabled: editando,
  })

  const [clienteId, setClienteId] = useState('')
  const [corId, setCorId] = useState('')
  const [dataValidade, setDataValidade] = useState(emDias(15))
  const [prazoDias, setPrazoDias] = useState('7')
  const [condicoes, setCondicoes] = useState('')
  const [espessuraMin, setEspessuraMin] = useState('60')
  const [espessuraMax, setEspessuraMax] = useState('90')
  const [pretratamento, setPretratamento] = useState<string>('desengraxe')
  const [obsCliente, setObsCliente] = useState('')
  const [obsInternas, setObsInternas] = useState('')
  const [itens, setItens] = useState<LinhaItem[]>([linhaVazia()])

  // Preenche o formulário quando o orçamento chega, só uma vez.
  useEffect(() => {
    const orcamento = orcamentoQuery.data

    if (!orcamento) return

    setClienteId(orcamento.cliente_id)
    setCorId(orcamento.cor_id)
    setDataValidade(orcamento.data_validade)
    setPrazoDias(String(orcamento.prazo_entrega_dias))
    setCondicoes(orcamento.condicoes_pagamento)
    setEspessuraMin(String(orcamento.espessura_min_micron))
    setEspessuraMax(String(orcamento.espessura_max_micron))
    setPretratamento(orcamento.tipo_pretratamento)
    setObsCliente(orcamento.observacoes_cliente)
    setObsInternas(orcamento.observacoes_internas)
    setItens(
      orcamento.itens.length > 0
        ? orcamento.itens.map((item) => ({
            chave: item.id,
            descricao: item.descricao,
            tipo_acabamento: item.tipo_acabamento,
            quantidade: String(item.quantidade),
            area_m2: String(item.area_m2),
            valor_unitario: String(item.valor_unitario),
          }))
        : [linhaVazia()],
    )
  }, [orcamentoQuery.data])

  const total = useMemo(
    () =>
      totalDosItens(
        itens.map((item) => ({
          quantidade: paraNumero(item.quantidade),
          valor_unitario: paraNumero(item.valor_unitario),
        })),
      ),
    [itens],
  )

  const atualizarItem = (chave: string, campo: keyof LinhaItem, valor: string) => {
    setItens((atual) =>
      atual.map((item) => (item.chave === chave ? { ...item, [campo]: valor } : item)),
    )
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const validos = itens.filter((item) => item.descricao.trim() !== '')

      if (!clienteId) throw new Error('Escolha o cliente.')
      if (!corId) throw new Error('Escolha a cor que será aplicada.')
      if (validos.length === 0) throw new Error('Adicione ao menos um item.')

      const valores = {
        cliente_id: clienteId,
        cor_id: corId,
        data_validade: dataValidade,
        prazo_entrega_dias: Number.parseInt(prazoDias, 10) || 0,
        condicoes_pagamento: condicoes.trim(),
        espessura_min_micron: paraNumero(espessuraMin),
        espessura_max_micron: paraNumero(espessuraMax),
        tipo_pretratamento: pretratamento,
        observacoes_cliente: obsCliente.trim(),
        observacoes_internas: obsInternas.trim(),
        itens: validos.map((item, indice) => ({
          descricao: item.descricao.trim(),
          tipo_acabamento: item.tipo_acabamento.trim(),
          quantidade: paraNumero(item.quantidade),
          area_m2: paraNumero(item.area_m2),
          valor_unitario: paraNumero(item.valor_unitario),
          ordem: indice,
        })),
      }

      return editando
        ? await orcamentosStore.atualizar(tenantAtivo.id, id ?? '', valores as never)
        : await orcamentosStore.criar(tenantAtivo.id, valores as never)
    },
    onSuccess: async (orcamento) => {
      await queryClient.invalidateQueries({ queryKey: ['orcamentos', tenantAtivo.id] })
      toast.success(editando ? 'Orçamento atualizado' : 'Orçamento criado', {
        description: `Nº ${orcamento.numero}. Revise e envie ao cliente quando estiver pronto.`,
      })
      void navigate(`/app/orcamentos/${orcamento.id}`)
    },
  })

  const bloqueado = editando && orcamentoQuery.data?.status !== 'rascunho'

  return (
    <>
      <PageHeader
        sobretitulo="Comercial"
        titulo={editando ? 'Editar orçamento' : 'Novo orçamento'}
        descricao="A cor, a espessura e o pré-tratamento definidos aqui são copiados para a ordem de serviço na aprovação."
      />

      {bloqueado && (
        <Alert variant="destructive" className="mb-5">
          <CircleAlert aria-hidden />
          <AlertDescription>
            Este orçamento já foi enviado ao cliente e não pode ser editado. Para mudar o
            escopo, crie uma revisão na tela de detalhe — assim o que o cliente já viu fica
            preservado.
          </AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          salvar.mutate()
        }}
        className="space-y-5"
      >
        {salvar.isError && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>
              {salvar.error instanceof Error
                ? salvar.error.message
                : 'Não foi possível salvar o orçamento.'}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Cliente e condições</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cliente">Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId} disabled={bloqueado}>
                <SelectTrigger id="cliente">
                  <SelectValue placeholder="Escolha o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(clientesQuery.data ?? []).map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="validade">Válido até</Label>
              <Input
                id="validade"
                type="date"
                value={dataValidade}
                onChange={(e) => setDataValidade(e.target.value)}
                disabled={bloqueado}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prazo">Prazo de entrega (dias)</Label>
              <Input
                id="prazo"
                type="number"
                min={0}
                value={prazoDias}
                onChange={(e) => setPrazoDias(e.target.value)}
                disabled={bloqueado}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="condicoes">Condições de pagamento</Label>
              <Input
                id="condicoes"
                placeholder="Ex: 30/60 dias"
                value={condicoes}
                onChange={(e) => setCondicoes(e.target.value)}
                disabled={bloqueado}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Especificação técnica</CardTitle>
            <p className="text-sm text-muted-foreground">
              Vale para o orçamento inteiro: não se pinta dois RAL na mesma passada. Se o
              cliente precisar de cores diferentes, faça um orçamento por cor.
            </p>
          </CardHeader>

          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cor">Cor (RAL)</Label>
              <Select value={corId} onValueChange={setCorId} disabled={bloqueado}>
                <SelectTrigger id="cor">
                  <SelectValue placeholder="Escolha a cor" />
                </SelectTrigger>
                <SelectContent>
                  {(coresQuery.data ?? []).map((cor) => (
                    <SelectItem key={cor.id} value={cor.id}>
                      {cor.codigo_ral} — {cor.nome_comercial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pretratamento">Pré-tratamento</Label>
              <Select
                value={pretratamento}
                onValueChange={setPretratamento}
                disabled={bloqueado}
              >
                <SelectTrigger id="pretratamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRETRATAMENTOS.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {PRETRATAMENTO_LABEL[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="esp-min">Espessura mínima (µm)</Label>
              <Input
                id="esp-min"
                inputMode="decimal"
                value={espessuraMin}
                onChange={(e) => setEspessuraMin(e.target.value)}
                disabled={bloqueado}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="esp-max">Espessura máxima (µm)</Label>
              <Input
                id="esp-max"
                inputMode="decimal"
                value={espessuraMax}
                onChange={(e) => setEspessuraMax(e.target.value)}
                disabled={bloqueado}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>Itens</CardTitle>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={bloqueado}
              onClick={() => setItens((atual) => [...atual, linhaVazia()])}
            >
              <Plus aria-hidden />
              Adicionar item
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {itens.map((item, indice) => (
              <div
                key={item.chave}
                className="grid gap-3 rounded-card border border-border p-3 sm:grid-cols-12"
              >
                <div className="space-y-1.5 sm:col-span-4">
                  <Label htmlFor={`desc-${item.chave}`}>Descrição da peça</Label>
                  <Input
                    id={`desc-${item.chave}`}
                    value={item.descricao}
                    placeholder="Ex: Portão 3x2 m"
                    onChange={(e) => atualizarItem(item.chave, 'descricao', e.target.value)}
                    disabled={bloqueado}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-3">
                  <Label htmlFor={`acab-${item.chave}`}>Acabamento</Label>
                  <Input
                    id={`acab-${item.chave}`}
                    value={item.tipo_acabamento}
                    placeholder="Liso brilhante"
                    onChange={(e) =>
                      atualizarItem(item.chave, 'tipo_acabamento', e.target.value)
                    }
                    disabled={bloqueado}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`qtd-${item.chave}`}>Qtd</Label>
                  <Input
                    id={`qtd-${item.chave}`}
                    inputMode="decimal"
                    value={item.quantidade}
                    onChange={(e) =>
                      atualizarItem(item.chave, 'quantidade', e.target.value)
                    }
                    disabled={bloqueado}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`area-${item.chave}`}>m² un.</Label>
                  <Input
                    id={`area-${item.chave}`}
                    inputMode="decimal"
                    value={item.area_m2}
                    onChange={(e) => atualizarItem(item.chave, 'area_m2', e.target.value)}
                    disabled={bloqueado}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`vu-${item.chave}`}>Valor unitário</Label>
                  <Input
                    id={`vu-${item.chave}`}
                    inputMode="decimal"
                    value={item.valor_unitario}
                    onChange={(e) =>
                      atualizarItem(item.chave, 'valor_unitario', e.target.value)
                    }
                    disabled={bloqueado}
                  />
                </div>

                <div className="flex items-end justify-end sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={bloqueado || itens.length === 1}
                    aria-label={`Remover item ${indice + 1}`}
                    onClick={() =>
                      setItens((atual) => atual.filter((linha) => linha.chave !== item.chave))
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex items-baseline justify-end gap-3 border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">Total do orçamento</span>
              <strong className="font-mono text-lg text-brand-dark">
                {formatCurrency(total)}
              </strong>
            </div>

            <p className="text-xs text-muted-foreground">
              O total é recalculado no banco ao salvar — o valor que chega ao cliente nunca
              depende de conta feita no navegador.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="obs-cliente">Visível ao cliente</Label>
              <Textarea
                id="obs-cliente"
                rows={4}
                value={obsCliente}
                onChange={(e) => setObsCliente(e.target.value)}
                disabled={bloqueado}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs-internas">Interna (nunca sai no link)</Label>
              <Textarea
                id="obs-internas"
                rows={4}
                value={obsInternas}
                onChange={(e) => setObsInternas(e.target.value)}
                disabled={bloqueado}
              />
              <p className="text-xs text-muted-foreground">
                A função de consulta pública não seleciona esta coluna: ela não vaza nem se
                a tela pedir.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => void navigate(-1)}>
            Cancelar
          </Button>

          <Button type="submit" size="lg" disabled={bloqueado || salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : 'Salvar orçamento'}
          </Button>
        </div>
      </form>
    </>
  )
}

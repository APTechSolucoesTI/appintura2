import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, CircleAlert, CircleCheck, MessageSquare, X } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  consultarOrcamentoPublico,
  decidirOrcamentoPublico,
  type Decisao,
  type ResultadoDecisao,
} from '@/services/orcamento-service'

/**
 * Portal público de aprovação.
 *
 * Página isolada de propósito: sem sidebar, sem link para o login, sem dar a
 * entender que existe um painel administrativo atrás. Quem abre isto é um
 * cliente que recebeu um link, não um usuário do sistema.
 */

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-status-neutral-soft">
        <CircleAlert className="size-6 text-status-neutral-strong" aria-hidden />
      </span>

      <h1 className="text-xl font-bold text-brand-dark">{titulo}</h1>
      <p className="mt-2 text-sm text-brand-muted">{texto}</p>
    </main>
  )
}

export function OrcamentoPublicoPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [modal, setModal] = useState<Decisao | null>(null)
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [aceite, setAceite] = useState(false)
  // Comeca vazio e vira a lista completa quando os dados chegam: antes da
  // decisao, o proposto E o conjunto todo.
  const [selecionados, setSelecionados] = useState<Set<string> | null>(null)
  const [resultado, setResultado] = useState<ResultadoDecisao | null>(null)

  const consulta = useQuery({
    queryKey: ['orcamento-publico', token],
    queryFn: () => consultarOrcamentoPublico(token),
    retry: false,
  })

  const decidir = useMutation({
    mutationFn: (decisao: Decisao) =>
      decidirOrcamentoPublico(token, decisao, {
        autor_nome: nome,
        autor_documento: documento,
        mensagem,
        // Só manda a lista quando o cliente mexeu na seleção. Omitir é "aceitei
        // tudo", e mantém o caminho de quem só clica em Aprovar intacto.
        itens_aprovados: selecionados ? [...selecionados] : undefined,
      }),
    onSuccess: (dados) => {
      if (dados.ok) {
        setResultado(dados)
        setModal(null)
      }
    },
  })

  if (consulta.isPending) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <p className="text-sm text-brand-muted">Carregando proposta…</p>
      </main>
    )
  }

  // Motivo genérico de propósito: "não existe", "revogado" e "expirado"
  // respondem igual, para o link não virar sonda de tokens.
  if (!consulta.data) {
    return (
      <Aviso
        titulo="Proposta indisponível"
        texto="Este orçamento não está mais disponível. Entre em contato com seu vendedor para receber um link atualizado."
      />
    )
  }

  const { orcamento, empresa, cliente, itens } = consulta.data
  const aceitos = selecionados ?? new Set(itens.map((item) => item.id))
  const totalAceito = itens
    .filter((item) => aceitos.has(item.id))
    .reduce((soma, item) => soma + Number(item.valor_total), 0)
  const parcial = aceitos.size > 0 && aceitos.size < itens.length
  const jaDecidido = consulta.data.decidido || resultado !== null
  const podeDecidir = !jaDecidido && !orcamento.vencido

  if (resultado?.ok) {
    // Mapa explícito, e não uma cadeia de ternários com "else": a RPC devolve
    // 'aprovado_parcial' e, na repetição do duplo clique, 'convertido'. Os dois
    // caíam no último ramo e diziam ao cliente que ele havia PEDIDO ALTERAÇÃO
    // logo depois de ele aprovar.
    const TEXTO_POR_DECISAO: Record<string, string> = {
      aprovado:
        'Sua aprovação foi registrada. A produção já foi acionada e seu vendedor entrará em contato para combinar a entrega das peças.',
      convertido:
        'Sua aprovação já estava registrada. A produção foi acionada e seu vendedor entrará em contato.',
      aprovado_parcial:
        resultado.itens_aprovados !== undefined
          ? `Sua aprovação de ${resultado.itens_aprovados} de ${resultado.itens_propostos} itens foi registrada. Só o que você selecionou será produzido e cobrado.`
          : 'Sua aprovação parcial foi registrada. Só os itens que você selecionou serão produzidos e cobrados.',
      rejeitado: 'Sua recusa foi registrada. Seu vendedor foi avisado.',
      alteracao_solicitada:
        'Seu pedido de alteração foi registrado. Seu vendedor vai revisar a proposta e reenviar.',
    }

    const texto =
      TEXTO_POR_DECISAO[resultado.decisao ?? ''] ??
      'Sua resposta foi registrada. Seu vendedor foi avisado.'

    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <span className="mb-4 grid size-14 place-items-center rounded-full bg-status-success-soft">
          <CircleCheck className="size-6 text-status-success-strong" aria-hidden />
        </span>

        <h1 className="text-xl font-bold text-brand-dark">
          Orçamento nº {resultado.numero}
        </h1>
        <p className="mt-2 text-sm text-brand-muted">{texto}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-[0.14em] text-brand-medium uppercase">
          {empresa.nome}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-brand-dark">
          Orçamento nº {orcamento.numero}
        </h1>
        <p className="mt-1 text-sm text-brand-muted">Para {cliente.nome}</p>
      </header>

      {orcamento.vencido && (
        <Alert variant="destructive" className="mb-5">
          <CircleAlert aria-hidden />
          <AlertDescription>
            Esta proposta venceu em {formatDate(orcamento.data_validade)}. Solicite uma
            atualização ao seu vendedor — os valores podem ter mudado.
          </AlertDescription>
        </Alert>
      )}

      {jaDecidido && !orcamento.vencido && (
        <Alert className="mb-5">
          <Check aria-hidden />
          <AlertDescription>
            A decisão sobre esta proposta já foi registrada. Este link não aceita uma nova
            resposta.
          </AlertDescription>
        </Alert>
      )}

      <section className="rounded-card border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-brand-dark">Itens</h2>

        {podeDecidir && (
          <p className="mt-1 text-xs text-brand-muted">
            Desmarque o que não quiser contratar. O que ficar marcado é o que será
            produzido e cobrado.
          </p>
        )}

        <ul className="mt-3 divide-y divide-border">
          {itens.map((item, indice) => (
            <li key={item.id ?? indice} className="flex items-start justify-between gap-4 py-3">
              {podeDecidir && (
                <Checkbox
                  className="mt-1"
                  checked={aceitos.has(item.id)}
                  aria-label={`Incluir ${item.descricao}`}
                  onCheckedChange={(valor) => {
                    const proximo = new Set(aceitos)
                    if (valor === true) proximo.add(item.id)
                    else proximo.delete(item.id)
                    setSelecionados(proximo)
                  }}
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="font-medium text-brand-text">{item.descricao}</p>
                <p className="text-xs text-brand-muted">
                  {item.quantidade} un.
                  {item.tipo_acabamento && ` · ${item.tipo_acabamento}`}
                  {` · ${formatCurrency(item.valor_unitario)} cada`}
                </p>
              </div>

              <span className="shrink-0 font-mono text-sm text-brand-dark">
                {formatCurrency(item.valor_total)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1 border-t border-border pt-3">
          {parcial && (
            <div className="flex items-baseline justify-between text-sm text-brand-muted">
              <span>Proposta completa</span>
              <span className="font-mono line-through">
                {formatCurrency(orcamento.valor_total)}
              </span>
            </div>
          )}

          <div className="flex items-baseline justify-between">
            <span className="text-sm text-brand-muted">
              {parcial ? 'Total do que você selecionou' : 'Total'}
            </span>
            <strong className="font-mono text-xl text-brand-dark">
              {formatCurrency(podeDecidir ? totalAceito : orcamento.valor_total)}
            </strong>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-card border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-brand-dark">Condições</h2>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-brand-muted">Cor</dt>
            <dd className="text-right">{orcamento.cor}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-brand-muted">Espessura</dt>
            <dd>{orcamento.espessura}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-brand-muted">Prazo de entrega</dt>
            <dd>{orcamento.prazo_entrega_dias} dias após o recebimento das peças</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-brand-muted">Pagamento</dt>
            <dd className="text-right">{orcamento.condicoes_pagamento || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-brand-muted">Validade</dt>
            <dd>{formatDate(orcamento.data_validade)}</dd>
          </div>
        </dl>

        {orcamento.observacoes_cliente && (
          <p className="mt-3 rounded-field bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
            {orcamento.observacoes_cliente}
          </p>
        )}
      </section>

      {podeDecidir && (
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <Button
            size="lg"
            onClick={() => setModal('aprovado')}
            disabled={aceitos.size === 0}
          >
            <Check aria-hidden />
            {parcial ? `Aprovar ${aceitos.size} de ${itens.length}` : 'Aprovar'}
          </Button>

          <Button size="lg" variant="outline" onClick={() => setModal('alteracao_solicitada')}>
            <MessageSquare aria-hidden />
            Solicitar alteração
          </Button>

          <Button size="lg" variant="outline" onClick={() => setModal('rejeitado')}>
            <X aria-hidden />
            Recusar
          </Button>
        </div>
      )}

      <Dialog open={modal !== null} onOpenChange={(aberto) => !aberto && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modal === 'aprovado'
                ? 'Aprovar orçamento'
                : modal === 'rejeitado'
                  ? 'Recusar orçamento'
                  : 'Solicitar alteração'}
            </DialogTitle>

            <DialogDescription>
              {modal === 'aprovado'
                ? 'Sua aprovação libera a produção. Registramos seu nome, a data e o endereço de origem do acesso.'
                : modal === 'rejeitado'
                  ? 'Seu vendedor será avisado. Esta ação não pode ser desfeita neste link.'
                  : 'Descreva o que precisa mudar. A proposta continua válida enquanto seu vendedor prepara uma revisão.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {decidir.data && !decidir.data.ok && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertDescription>
                  {decidir.data.motivo === 'nome_obrigatorio'
                    ? 'Informe seu nome completo para aprovar.'
                    : decidir.data.motivo === 'vencido'
                      ? 'Esta proposta venceu. Solicite uma atualização ao seu vendedor.'
                      : decidir.data.motivo === 'itens_invalidos'
                        ? 'Houve um problema com os itens selecionados. Recarregue a página e tente de novo.'
                        : decidir.data.motivo === 'muitos_itens'
                          ? 'Esta proposta tem itens demais para seleção individual. Fale com seu vendedor.'
                          : 'Não foi possível registrar sua resposta. Tente novamente.'}
                </AlertDescription>
              </Alert>
            )}

            {modal === 'aprovado' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Seu nome completo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="doc">CPF ou CNPJ (opcional)</Label>
                  <Input
                    id="doc"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    inputMode="numeric"
                  />
                </div>

                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={aceite}
                    onCheckedChange={(valor) => setAceite(valor === true)}
                  />
                  <span>
                    Li e aceito as condições comerciais descritas nesta proposta, incluindo
                    valores, prazo de entrega e forma de pagamento.
                  </span>
                </label>
              </>
            )}

            {modal !== 'aprovado' && (
              <div className="space-y-1.5">
                <Label htmlFor="msg">
                  {modal === 'rejeitado' ? 'Motivo (opcional)' : 'O que precisa mudar'}
                </Label>
                <Textarea
                  id="msg"
                  rows={4}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancelar
            </Button>

            <Button
              onClick={() => modal && decidir.mutate(modal)}
              disabled={
                decidir.isPending ||
                (modal === 'aprovado' && (!aceite || nome.trim().length < 3))
              }
            >
              {decidir.isPending ? 'Registrando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="mt-8 text-center text-xs text-brand-muted">
        {empresa.nome} · CNPJ {empresa.cnpj}
      </footer>
    </main>
  )
}

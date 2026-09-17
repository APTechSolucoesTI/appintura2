import { FileText, Info } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { formatDate, parseData } from '@/lib/format'
import { UNIDADE_ITEM_LABEL, type SaldoCliente } from '@/types/custodia'

function haMeses(quantidade: number): string {
  const data = new Date()
  data.setMonth(data.getMonth() - quantidade)

  return data.toISOString().slice(0, 10)
}

/**
 * Relatório de responsabilidade por cliente e período: o que estava sob custódia,
 * de qual romaneio veio e há quanto tempo está parado.
 *
 * A estrutura de dados é a final; falta só a renderização em PDF, que sai na
 * Edge Function da Fase 7 (o mesmo payload alimenta os dois).
 */
export function RelatorioResponsabilidade({
  cliente,
  aoFechar,
}: {
  cliente: SaldoCliente | null
  aoFechar: () => void
}) {
  const [de, setDe] = useState(() => haMeses(6))
  const [ate, setAte] = useState(() => new Date().toISOString().slice(0, 10))

  const itens = useMemo(() => {
    if (!cliente) return []

    const inicio = parseData(de).getTime()
    // Até o fim do dia escolhido, senão o próprio dia fica de fora.
    const fim = parseData(ate).getTime() + 86_400_000 - 1

    return cliente.itens.filter((item) => {
      const entrada = new Date(item.data_entrada).getTime()

      return entrada >= inicio && entrada <= fim
    })
  }, [cliente, de, ate])

  const totalEmCustodia = itens.reduce((soma, item) => soma + item.saldo, 0)

  return (
    <Dialog open={cliente !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório de responsabilidade</DialogTitle>
          <DialogDescription>{cliente?.cliente_nome}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="relatorio-de">Entradas a partir de</Label>
            <Input
              id="relatorio-de"
              type="date"
              value={de}
              onChange={(event) => setDe(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="relatorio-ate">Até</Label>
            <Input
              id="relatorio-ate"
              type="date"
              value={ate}
              onChange={(event) => setAte(event.target.value)}
            />
          </div>
        </div>

        <div className="rounded-card border border-border bg-background p-4">
          <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
            Resumo do período
          </p>
          <p className="mt-1 text-sm text-brand-text">
            {itens.length} item(ns) recebido(s), {totalEmCustodia} unidade(s) ainda sob
            custódia da empresa.
          </p>
        </div>

        {itens.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma entrada deste cliente no período escolhido.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border">
            {itens.map((item) => (
              <li key={item.recebimento_item_id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-brand-dark">{item.descricao}</span>
                  <span className="font-mono text-sm text-brand-dark">
                    {item.saldo} de {item.recebido} {UNIDADE_ITEM_LABEL[item.unidade]}
                  </span>
                </div>

                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  romaneio #{String(item.recebimento_numero).padStart(4, '0')} · entrada
                  em {formatDate(item.data_entrada)}
                  {item.saldo > 0 && ` · ${item.dias_em_custodia} dias em custódia`}
                </p>
              </li>
            ))}
          </ul>
        )}

        <Alert>
          <Info aria-hidden />
          <AlertDescription>
            O PDF com as fotos de entrada é gerado por Edge Function na Fase 7. Os dados
            acima já são exatamente o conteúdo que será impresso.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Fechar
          </Button>

          <Button disabled title="Disponível na Fase 7">
            <FileText aria-hidden />
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

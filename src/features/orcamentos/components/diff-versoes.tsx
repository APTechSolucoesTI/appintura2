import { useQuery } from '@tanstack/react-query'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { diffOrcamento } from '@/services/orcamento-service'
import { SITUACAO_DIFF_LABEL, type SituacaoDiff } from '@/types/orcamento'

const TOM: Record<SituacaoDiff, string> = {
  incluido: 'text-status-success-strong',
  removido: 'text-status-danger-strong',
  alterado: 'text-status-warning-strong',
  igual: 'text-muted-foreground',
}

const SINAL: Record<SituacaoDiff, string> = {
  incluido: '+',
  removido: '−',
  alterado: '~',
  igual: ' ',
}

/**
 * O que mudou desta versão para a anterior.
 *
 * Só aparece quando o orçamento é revisão de outro. Itens sem mudança são
 * filtrados no serviço: numa revisão o que interessa é a diferença, e listar
 * vinte linhas iguais esconderia as três que mudaram.
 */
export function DiffVersoes({ orcamentoId }: { orcamentoId: string }) {
  const diffQuery = useQuery({
    queryKey: ['diff-orcamento', orcamentoId],
    queryFn: () => diffOrcamento(orcamentoId),
  })

  const linhas = diffQuery.data ?? []

  if (diffQuery.isPending || linhas.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>O que mudou nesta revisão</CardTitle>
        <p className="text-sm text-muted-foreground">
          Comparado com a versão que esta substituiu.
        </p>
      </CardHeader>

      <CardContent>
        <ul className="space-y-2">
          {linhas.map((linha, indice) => (
            <li
              key={`${linha.descricao}-${indice}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2 last:border-0"
            >
              <span
                aria-hidden
                className={`font-mono text-base ${TOM[linha.situacao]}`}
              >
                {SINAL[linha.situacao]}
              </span>

              <span className="font-medium text-brand-text">{linha.descricao}</span>

              <span className={`text-xs ${TOM[linha.situacao]}`}>
                {SITUACAO_DIFF_LABEL[linha.situacao]}
              </span>

              {linha.situacao === 'alterado' && (
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {linha.quantidade_antes} un. {formatCurrency(Number(linha.valor_antes))}
                  {' → '}
                  {linha.quantidade_depois} un.{' '}
                  {formatCurrency(Number(linha.valor_depois))}
                </span>
              )}

              {linha.situacao === 'incluido' && (
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {linha.quantidade_depois} un.{' '}
                  {formatCurrency(Number(linha.valor_depois))}
                </span>
              )}

              {linha.situacao === 'removido' && (
                <span className="ml-auto font-mono text-xs text-muted-foreground line-through">
                  {linha.quantidade_antes} un. {formatCurrency(Number(linha.valor_antes))}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

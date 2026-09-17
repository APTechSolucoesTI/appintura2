import { cn } from 'cn'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface EtapaWizard {
  id: string
  titulo: string
  descricao: string
}

interface WizardProps {
  etapas: EtapaWizard[]
  indiceAtual: number
  aoVoltar: () => void
  aoAvancar: () => void
  aoConcluir: () => void
  concluindo: boolean
  rotuloConcluir: string
  children: React.ReactNode
}

/**
 * Fluxo em etapas para a portaria: uma decisão por tela, botões grandes fixos no
 * rodapé e nada de rolagem para achar o "continuar" — é operado em pé, com tablet
 * na mão e o caminhão esperando.
 */
export function Wizard({
  etapas,
  indiceAtual,
  aoVoltar,
  aoAvancar,
  aoConcluir,
  concluindo,
  rotuloConcluir,
  children,
}: WizardProps) {
  const etapa = etapas[indiceAtual]
  const ultima = indiceAtual === etapas.length - 1

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <ol className="mb-6 flex items-center gap-2" aria-label="Etapas">
        {etapas.map((item, indice) => {
          const concluida = indice < indiceAtual
          const atual = indice === indiceAtual

          return (
            <li key={item.id} className="flex flex-1 items-center gap-2">
              <span
                aria-current={atual ? 'step' : undefined}
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold transition-colors',
                  concluida && 'bg-brand-accent text-brand-dark',
                  atual && 'bg-brand-dark text-white',
                  !concluida && !atual && 'bg-muted text-muted-foreground',
                )}
              >
                {concluida ? <Check className="size-4" aria-hidden /> : indice + 1}
              </span>

              <span className="sr-only">{item.titulo}</span>

              {indice < etapas.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    concluida ? 'bg-brand-accent' : 'bg-muted',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>

      <div className="mb-5">
        <h2 className="text-xl font-bold text-brand-dark">{etapa.titulo}</h2>
        <p className="mt-1 text-sm text-brand-muted">{etapa.descricao}</p>
      </div>

      <div className="flex-1">{children}</div>

      <div className="sticky bottom-0 -mx-4 mt-8 flex gap-3 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-sm lg:-mx-8 lg:px-8">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={aoVoltar}
          disabled={concluindo}
          className="flex-1 sm:flex-none"
        >
          <ArrowLeft aria-hidden />
          {indiceAtual === 0 ? 'Cancelar' : 'Voltar'}
        </Button>

        <Button
          type="button"
          size="lg"
          onClick={ultima ? aoConcluir : aoAvancar}
          disabled={concluindo}
          className="flex-1"
        >
          {concluindo && <Loader2 className="animate-spin" aria-hidden />}
          {ultima ? rotuloConcluir : 'Continuar'}
          {!ultima && <ArrowRight aria-hidden />}
        </Button>
      </div>
    </div>
  )
}

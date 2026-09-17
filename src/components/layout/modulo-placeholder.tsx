import { Check, type LucideIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ModuloPlaceholderProps {
  icon: LucideIcon
  titulo: string
  descricao: string
  fase: number
  escopo: string[]
}

/**
 * Estado honesto para módulo ainda não implementado: diz qual fase o entrega e o que
 * ela cobre, em vez de simular tela pronta com dado falso.
 */
export function ModuloPlaceholder({
  icon: Icon,
  titulo,
  descricao,
  fase,
  escopo,
}: ModuloPlaceholderProps) {
  return (
    <>
      <PageHeader titulo={titulo} descricao={descricao} />

      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent">
              <Icon className="size-5 text-brand-medium" aria-hidden />
            </span>

            <div>
              <CardTitle>Módulo previsto para a Fase {fase}</CardTitle>
              <p className="text-sm text-muted-foreground">
                A fundação (auth, multi-tenant, design system) já está pronta — este
                módulo entra na sequência do roadmap.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <p className="font-mono text-[0.65rem] tracking-[0.14em] text-brand-medium uppercase">
            Escopo da fase
          </p>

          <ul className="mt-3 space-y-2">
            {escopo.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-brand-text">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-accent" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}

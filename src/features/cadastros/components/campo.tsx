import { cn } from 'cn'

import { Label } from '@/components/ui/label'

interface CampoProps {
  id: string
  label: string
  erro?: string
  dica?: string
  className?: string
  children: React.ReactNode
}

/**
 * Agrupa label, controle, dica e mensagem de erro com o `aria-describedby`
 * correto — evita repetir esse encadeamento em cada um dos cinco formulários.
 * O controle deve receber `id={id}` e `aria-invalid` por conta própria.
 */
export function Campo({ id, label, erro, dica, className, children }: CampoProps) {
  const idErro = `${id}-erro`
  const idDica = `${id}-dica`

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>

      {children}

      {dica && !erro && (
        <p id={idDica} className="text-xs text-muted-foreground">
          {dica}
        </p>
      )}

      {erro && (
        <p id={idErro} className="text-xs text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}

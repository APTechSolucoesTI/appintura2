import { SprayCan } from 'lucide-react'
import { cn } from 'cn'

interface LogoProps {
  className?: string
  /** `escuro` = sobre fundo claro; `claro` = sobre gradiente/sidebar. */
  tom?: 'escuro' | 'claro'
  size?: 'sm' | 'default'
}

export function Logo({ className, tom = 'escuro', size = 'default' }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-lg bg-brand-gradient text-white',
          size === 'sm' ? 'size-7' : 'size-9',
        )}
      >
        <SprayCan className={size === 'sm' ? 'size-4' : 'size-5'} aria-hidden />
      </span>

      <span
        className={cn(
          'font-heading font-bold tracking-tight',
          size === 'sm' ? 'text-base' : 'text-lg',
          tom === 'claro' ? 'text-white' : 'text-brand-dark',
        )}
      >
        AP
        <span className={tom === 'claro' ? 'text-brand-accent' : 'text-brand-medium'}>
          Pintura
        </span>
      </span>
    </span>
  )
}

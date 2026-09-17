import { Loader2 } from 'lucide-react'

/** Fallback do `Suspense` enquanto o chunk do módulo é baixado. */
export function CarregandoRota() {
  return (
    <div
      className="flex min-h-64 flex-1 items-center justify-center p-10"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-5 animate-spin text-brand-medium" aria-hidden />
      <span className="ml-2 text-sm text-muted-foreground">Carregando…</span>
    </div>
  )
}

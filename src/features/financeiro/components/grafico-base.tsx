import { formatCurrency } from '@/lib/format'

interface ItemTooltip {
  name?: string
  value?: number | string
  color?: string
}

/**
 * Tooltip dos gráficos com os tokens da interface.
 *
 * O texto usa a cor de tinta do tema; a identidade da série vem do ponto colorido
 * ao lado, nunca do texto — rótulo colorido cai abaixo do contraste mínimo.
 */
export function TooltipGrafico({
  active,
  payload,
  label,
  formatar = formatCurrency,
}: {
  active?: boolean
  payload?: ItemTooltip[]
  label?: string | number
  /** Padrão é moeda; gráficos de área passam o formatador de m². */
  formatar?: (valor: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-card border border-border bg-card px-3 py-2 shadow-card">
      {label !== undefined && (
        <p className="mb-1 text-xs font-medium text-brand-dark">{label}</p>
      )}

      <ul className="space-y-0.5">
        {payload.map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-brand-muted">{item.name}</span>
            <span className="ml-auto font-mono font-medium text-brand-dark">
              {formatar(Number(item.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

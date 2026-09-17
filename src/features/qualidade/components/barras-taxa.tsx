import type { RecorteRetrabalho } from '@/services/qualidade-service'

/**
 * Barras horizontais de série única — uma medida (a taxa) em poucas categorias.
 *
 * Escala fixa de 0 a 100%: é o domínio natural de um percentual. Escalar pelo
 * maior valor faria 4% e 6% parecerem mundos diferentes.
 *
 * Sem legenda de propósito: uma série só é nomeada pelo título. O valor vai
 * rotulado em cada barra e a base aparece ao lado, então não há informação
 * escondida atrás de hover.
 */
export function BarrasTaxa({
  recortes,
  vazio,
}: {
  recortes: RecorteRetrabalho[]
  vazio: string
}) {
  if (recortes.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{vazio}</p>
  }

  return (
    <div>
      <ul className="space-y-4">
        {recortes.map((recorte) => (
          <li key={recorte.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium text-brand-dark">
                {recorte.nome}
              </span>

              <span className="shrink-0 font-mono text-sm font-semibold text-brand-dark">
                {recorte.taxa.toFixed(1).replace('.', ',')}%
              </span>
            </div>

            <div
              className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${recorte.nome}: ${recorte.taxa.toFixed(1)}% de retrabalho, ${recorte.comRetrabalho} de ${recorte.base} ordens`}
              title={`${recorte.comRetrabalho} de ${recorte.base} OS com retrabalho`}
            >
              <div
                className="h-full rounded-r-[4px] bg-brand-medium dark:bg-brand-accent"
                style={{ width: `${Math.min(100, recorte.taxa)}%` }}
              />
            </div>

            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {recorte.comRetrabalho} de {recorte.base} OS
              {recorte.base < 5 && ' · base pequena, a porcentagem oscila muito'}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-between border-t border-border pt-2 font-mono text-[0.65rem] text-muted-foreground">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

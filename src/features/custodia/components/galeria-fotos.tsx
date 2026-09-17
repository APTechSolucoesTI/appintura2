import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Foto } from '@/types/custodia'
import { formatDateTime } from '@/lib/format'

/** Miniaturas das fotos do item, com ampliação ao toque. */
export function GaleriaFotos({ fotos, rotulo }: { fotos: Foto[]; rotulo: string }) {
  const [ampliada, setAmpliada] = useState<Foto | null>(null)

  if (fotos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma foto registrada para este item.
      </p>
    )
  }

  return (
    <>
      <ul className="flex flex-wrap gap-3">
        {fotos.map((foto, indice) => (
          <li key={foto.id}>
            <button
              type="button"
              onClick={() => setAmpliada(foto)}
              className="rounded-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Ampliar foto ${indice + 1} de ${rotulo}`}
            >
              <img
                src={foto.url}
                alt={`Foto ${indice + 1} de ${rotulo}`}
                className="size-24 rounded-card border border-border object-cover transition-transform hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={ampliada !== null} onOpenChange={() => setAmpliada(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{rotulo}</DialogTitle>
            <DialogDescription>
              {ampliada && `Capturada em ${formatDateTime(ampliada.capturada_em)}`}
            </DialogDescription>
          </DialogHeader>

          {ampliada && (
            <img
              src={ampliada.url}
              alt={`Foto ampliada de ${rotulo}`}
              className="w-full rounded-card border border-border"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

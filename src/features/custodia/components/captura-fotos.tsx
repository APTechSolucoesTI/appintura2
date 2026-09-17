import { Camera, ImagePlus, Loader2, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Foto } from '@/types/custodia'

const LARGURA_MAXIMA = 1280
const QUALIDADE_JPEG = 0.75

/**
 * Reduz a imagem antes de guardar. A portaria fotografa em celular, onde cada
 * foto tem vários MB — subir isso cru em 4G de galpão é o caminho mais curto
 * para o conferente desistir de fotografar.
 */
async function comprimir(arquivo: File): Promise<string> {
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.min(1, LARGURA_MAXIMA / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura

  const contexto = canvas.getContext('2d')

  if (!contexto) {
    bitmap.close()
    throw new Error('Não foi possível processar a imagem.')
  }

  contexto.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', QUALIDADE_JPEG)
}

interface CapturaFotosProps {
  fotos: Foto[]
  aoAlterar: (fotos: Foto[]) => void
  erro?: string
  /** Descrição do item, usada nos rótulos acessíveis. */
  rotulo: string
}

export function CapturaFotos({ fotos, aoAlterar, erro, rotulo }: CapturaFotosProps) {
  const idBase = useId()
  const [processando, setProcessando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  const entradaCamera = useRef<HTMLInputElement>(null)
  const entradaArquivo = useRef<HTMLInputElement>(null)

  async function adicionar(lista: FileList | null) {
    if (!lista || lista.length === 0) return

    setProcessando(true)
    setFalha(null)

    try {
      const novas = await Promise.all(
        [...lista].map(async (arquivo) => ({
          id: crypto.randomUUID(),
          url: await comprimir(arquivo),
          nome: arquivo.name,
          capturada_em: new Date().toISOString(),
        })),
      )

      aoAlterar([...fotos, ...novas])
    } catch {
      setFalha('Não foi possível processar a imagem. Tente outra foto.')
    } finally {
      setProcessando(false)
      // Permite reenviar o mesmo arquivo logo em seguida.
      if (entradaCamera.current) entradaCamera.current.value = ''
      if (entradaArquivo.current) entradaArquivo.current.value = ''
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={processando}
          onClick={() => entradaCamera.current?.click()}
        >
          {processando ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
          Tirar foto
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={processando}
          onClick={() => entradaArquivo.current?.click()}
        >
          <ImagePlus aria-hidden />
          Escolher arquivo
        </Button>
      </div>

      {/* capture="environment" abre direto a câmera traseira em celular/tablet. */}
      <input
        ref={entradaCamera}
        id={`${idBase}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={`Tirar foto de ${rotulo}`}
        onChange={(event) => void adicionar(event.target.files)}
      />

      <input
        ref={entradaArquivo}
        id={`${idBase}-arquivo`}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label={`Escolher fotos de ${rotulo}`}
        onChange={(event) => void adicionar(event.target.files)}
      />

      {fotos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {fotos.map((foto, indice) => (
            <li key={foto.id} className="relative">
              <img
                src={foto.url}
                alt={`Foto ${indice + 1} de ${rotulo}`}
                className="size-24 rounded-card border border-border object-cover"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => aoAlterar(fotos.filter((item) => item.id !== foto.id))}
                aria-label={`Remover foto ${indice + 1} de ${rotulo}`}
                className="absolute -top-2 -right-2 rounded-full bg-card shadow-card hover:bg-status-danger-soft hover:text-status-danger-strong"
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {(erro ?? falha) && (
        <p className="mt-2 text-xs text-destructive">{erro ?? falha}</p>
      )}
    </div>
  )
}

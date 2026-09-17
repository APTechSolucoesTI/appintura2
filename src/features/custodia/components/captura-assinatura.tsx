import { Eraser } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'

import { Button } from '@/components/ui/button'

interface CapturaAssinaturaProps {
  valor: string | null
  aoAlterar: (dataUrl: string | null) => void
  rotulo: string
  erro?: string
}

/**
 * Assinatura a dedo no tablet, sobre `signature_pad`.
 *
 * Usamos a biblioteca direto em vez do wrapper React: o wrapper está em alpha e
 * arrasta `prop-types` junto, e aqui só precisamos de um canvas controlado.
 */
export function CapturaAssinatura({
  valor,
  aoAlterar,
  rotulo,
  erro,
}: CapturaAssinaturaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [temTraco, setTemTraco] = useState(Boolean(valor))

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    const pad = new SignaturePad(canvas, {
      penColor: '#1a1a2e',
      backgroundColor: '#ffffff',
      minWidth: 0.8,
      maxWidth: 2.4,
    })

    padRef.current = pad

    // O canvas precisa acompanhar a densidade da tela, senão o traço sai
    // serrilhado no tablet. Redimensionar limpa o conteúdo, então só fazemos
    // isso quando a caixa muda de tamanho de verdade.
    function ajustarResolucao() {
      if (!canvas) return

      const proporcao = Math.max(window.devicePixelRatio || 1, 1)
      const largura = canvas.offsetWidth
      const altura = canvas.offsetHeight

      if (largura === 0 || altura === 0) return

      const dados = pad.toData()

      canvas.width = largura * proporcao
      canvas.height = altura * proporcao
      canvas.getContext('2d')?.scale(proporcao, proporcao)

      pad.clear()
      if (dados.length > 0) pad.fromData(dados)
    }

    ajustarResolucao()

    const observador = new ResizeObserver(ajustarResolucao)
    observador.observe(canvas)

    pad.addEventListener('endStroke', () => {
      setTemTraco(true)
      aoAlterar(pad.toDataURL('image/png'))
    })

    return () => {
      observador.disconnect()
      pad.off()
      padRef.current = null
    }
  }, [aoAlterar])

  function limpar() {
    padRef.current?.clear()
    setTemTraco(false)
    aoAlterar(null)
  }

  return (
    <div>
      <div className="rounded-card border border-input bg-white p-1">
        <canvas
          ref={canvasRef}
          // touch-none: sem isso o gesto de desenhar rola a página no tablet.
          className="h-40 w-full touch-none rounded-field"
          aria-label={`Área de assinatura de ${rotulo}`}
          role="img"
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {temTraco
            ? 'Assinatura capturada.'
            : `Peça para ${rotulo} assinar com o dedo na área acima.`}
        </p>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={limpar}
          disabled={!temTraco}
        >
          <Eraser aria-hidden />
          Limpar
        </Button>
      </div>

      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  )
}

import { useMutation } from '@tanstack/react-query'
import { FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useTenant } from '@/features/tenant/tenant-context'
import {
  baixarPdf,
  gerarPdfDevolucao,
  gerarPdfRecebimento,
} from '@/services/pdf-service'

/** Botão de emissão do romaneio em PDF, usado nas duas telas de detalhe. */
export function BotaoPdfRomaneio({
  tipo,
  romaneioId,
  numero,
}: {
  tipo: 'recebimento' | 'devolucao'
  romaneioId: string
  numero: number
}) {
  const { tenantAtivo } = useTenant()

  const gerar = useMutation({
    mutationFn: async () => {
      const blob =
        tipo === 'recebimento'
          ? await gerarPdfRecebimento(tenantAtivo, romaneioId)
          : await gerarPdfDevolucao(tenantAtivo, romaneioId)

      baixarPdf(
        blob,
        `romaneio-${tipo}-${String(numero).padStart(4, '0')}.pdf`,
      )
    },
    onError: () => {
      toast.error('Não foi possível gerar o PDF', {
        description: 'Tente novamente em instantes.',
      })
    },
  })

  return (
    <Button
      variant="outline"
      onClick={() => gerar.mutate()}
      disabled={gerar.isPending}
    >
      {gerar.isPending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <FileText aria-hidden />
      )}
      {gerar.isPending ? 'Gerando…' : 'Gerar PDF'}
    </Button>
  )
}

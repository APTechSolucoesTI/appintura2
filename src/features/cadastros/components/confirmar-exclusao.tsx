import { Loader2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmarExclusaoProps {
  aberto: boolean
  aoFechar: () => void
  aoConfirmar: () => void
  excluindo: boolean
  /** Nome do registro, exibido para o usuário confirmar que é o certo. */
  registro: string
  consequencia: string
}

export function ConfirmarExclusao({
  aberto,
  aoFechar,
  aoConfirmar,
  excluindo,
  registro,
  consequencia,
}: ConfirmarExclusaoProps) {
  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(proximo) => {
        if (!proximo && !excluindo) aoFechar()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {registro}?</AlertDialogTitle>
          <AlertDialogDescription>{consequencia}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>

          <AlertDialogAction
            onClick={(event) => {
              // Sem isto o Radix fecha o diálogo antes da mutação terminar.
              event.preventDefault()
              aoConfirmar()
            }}
            disabled={excluindo}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {excluindo && <Loader2 className="animate-spin" aria-hidden />}
            {excluindo ? 'Excluindo…' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

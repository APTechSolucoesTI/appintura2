import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface FormSheetProps {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  descricao: string
  salvando: boolean
  aoSalvar: (event: React.FormEvent<HTMLFormElement>) => void
  /** `xl` para formulários com muitos campos (cliente, cor). */
  largura?: 'default' | 'xl'
  children: React.ReactNode
}

/**
 * Painel lateral padrão dos formulários de cadastro. Painel em vez de modal
 * porque os formulários são longos e precisam rolar confortavelmente em tablet.
 */
export function FormSheet({
  aberto,
  aoFechar,
  titulo,
  descricao,
  salvando,
  aoSalvar,
  largura = 'default',
  children,
}: FormSheetProps) {
  return (
    <Sheet
      open={aberto}
      onOpenChange={(proximo) => {
        // Não deixa fechar no meio de um salvamento em andamento.
        if (!proximo && !salvando) aoFechar()
      }}
    >
      <SheetContent
        side="right"
        className={
          largura === 'xl'
            ? 'flex w-full flex-col gap-0 p-0 sm:max-w-2xl'
            : 'flex w-full flex-col gap-0 p-0 sm:max-w-md'
        }
      >
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>{descricao}</SheetDescription>
        </SheetHeader>

        <form onSubmit={aoSalvar} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-muted/40 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={aoFechar}
              disabled={salvando}
            >
              Cancelar
            </Button>

            <Button type="submit" size="lg" disabled={salvando}>
              {salvando && <Loader2 className="animate-spin" aria-hidden />}
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

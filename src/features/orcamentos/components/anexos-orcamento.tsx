import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileUp, Paperclip, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { anexarArquivo, removerAnexo, urlAnexo } from '@/services/orcamento-service'
import type { OrcamentoAnexo } from '@/types/orcamento'

const TIPOS = [
  { valor: 'foto_referencia', label: 'Foto de referência' },
  { valor: 'desenho_tecnico', label: 'Desenho técnico' },
  { valor: 'outro', label: 'Outro' },
] as const

type TipoAnexo = (typeof TIPOS)[number]['valor']

const ROTULO = Object.fromEntries(TIPOS.map((t) => [t.valor, t.label])) as Record<
  string,
  string
>

/**
 * Anexos do orçamento: fotos da peça e desenhos técnicos.
 *
 * Aparecem também no link do cliente — é o que evita a conversa de "não era
 * essa peça" depois da aprovação.
 *
 * Só permite mexer enquanto o orçamento é rascunho: depois de enviado, o
 * conjunto de arquivos faz parte do que o cliente viu.
 */
export function AnexosOrcamento({
  tenantId,
  orcamentoId,
  anexos,
  editavel,
}: {
  tenantId: string
  orcamentoId: string
  anexos: OrcamentoAnexo[]
  editavel: boolean
}) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [tipo, setTipo] = useState<TipoAnexo>('foto_referencia')

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: ['orcamento', tenantId, orcamentoId] })

  const enviar = useMutation({
    mutationFn: (arquivo: File) => anexarArquivo(tenantId, orcamentoId, arquivo, tipo),
    onSuccess: async () => {
      await invalidar()
      toast.success('Anexo enviado')
    },
    onError: (erro) =>
      toast.error('Não foi possível enviar', {
        description: erro instanceof Error ? erro.message : undefined,
      }),
  })

  const remover = useMutation({
    mutationFn: (anexoId: string) => removerAnexo(tenantId, anexoId),
    onSuccess: async () => {
      await invalidar()
      toast.success('Anexo removido')
    },
  })

  async function abrir(caminho: string) {
    // O bucket é privado: sem a URL assinada o navegador recebe 400.
    const url = await urlAnexo(caminho)

    if (!url) {
      toast.error('Não foi possível abrir o anexo')
      return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anexos</CardTitle>
        <p className="text-sm text-muted-foreground">
          Fotos e desenhos vão junto no link do cliente — é o que evita discussão sobre
          qual peça foi orçada.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {anexos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
        ) : (
          <ul className="divide-y divide-border">
            {anexos.map((anexo) => (
              <li key={anexo.id} className="flex items-center gap-3 py-2">
                <Paperclip className="size-4 shrink-0 text-brand-medium" aria-hidden />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{anexo.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROTULO[anexo.tipo] ?? anexo.tipo}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Abrir ${anexo.nome}`}
                  onClick={() => void abrir(anexo.storage_path)}
                >
                  <Download aria-hidden />
                </Button>

                {editavel && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${anexo.nome}`}
                    disabled={remover.isPending}
                    onClick={() => remover.mutate(anexo.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {editavel && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Select value={tipo} onValueChange={(valor) => setTipo(valor as TipoAnexo)}>
              <SelectTrigger className="w-48" aria-label="Tipo do anexo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((opcao) => (
                  <SelectItem key={opcao.valor} value={opcao.valor}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(evento) => {
                const arquivo = evento.target.files?.[0]

                if (arquivo) enviar.mutate(arquivo)
                // Zera o input: sem isso, reenviar o mesmo arquivo não dispara
                // `change` e a tela parece travada.
                evento.target.value = ''
              }}
            />

            <Button
              variant="outline"
              disabled={enviar.isPending}
              onClick={() => inputRef.current?.click()}
            >
              <FileUp aria-hidden />
              {enviar.isPending ? 'Enviando…' : 'Adicionar anexo'}
            </Button>

            <span className="text-xs text-muted-foreground">
              JPG, PNG, WebP ou PDF, até 10 MB.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

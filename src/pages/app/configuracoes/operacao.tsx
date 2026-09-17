import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Campo } from '@/features/cadastros/components/campo'
import { useTenant } from '@/features/tenant/tenant-context'
import {
  obterConfiguracoes,
  salvarConfiguracoes,
} from '@/services/configuracoes-service'

export function OperacaoPage() {
  const { tenantAtivo } = useTenant()

  return (
    <>
      <PageHeader
        sobretitulo="Parâmetros"
        titulo="Operação"
        descricao={`Parâmetros de chão de fábrica de ${tenantAtivo.nome_fantasia}. Valem só para esta empresa.`}
      />

      {/* key por tenant: trocar de empresa descarta o que estava digitado em vez
          de misturar o rascunho de uma com a configuração da outra. */}
      <FormularioOperacao key={tenantAtivo.id} tenantId={tenantAtivo.id} />
    </>
  )
}

function FormularioOperacao({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient()
  /** `null` = ainda não editado; o valor exibido vem da consulta. */
  const [rascunho, setRascunho] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const configQuery = useQuery({
    queryKey: ['configuracoes', tenantId],
    queryFn: () => obterConfiguracoes(tenantId),
  })

  const dias = rascunho ?? String(configQuery.data?.dias_alerta_custodia ?? '')

  const salvar = useMutation({
    mutationFn: (valor: number) =>
      salvarConfiguracoes(tenantId, { dias_alerta_custodia: valor }),
    onSuccess: async () => {
      setRascunho(null)
      await queryClient.invalidateQueries({
        queryKey: ['configuracoes', tenantId],
      })
      toast.success('Configuração salva', {
        description: 'O painel de custódia já usa o novo limite.',
      })
    },
  })

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()

    const valor = Number(dias)

    if (!Number.isInteger(valor) || valor < 1 || valor > 365) {
      setErro('Informe um número inteiro de 1 a 365 dias.')
      return
    }

    setErro(null)
    salvar.mutate(valor)
  }

  return (
    <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Alerta de peça parada</CardTitle>
          <p className="text-sm text-muted-foreground">
            A partir de quantos dias no pátio uma peça em custódia passa a ser
            destacada no painel.
          </p>
        </CardHeader>

        <CardContent>
          {configQuery.isPending ? (
            <Skeleton className="h-10 w-40" />
          ) : (
            <form onSubmit={enviar} noValidate className="space-y-4">
              <Campo
                id="dias_alerta"
                label="Dias em custódia"
                erro={erro ?? undefined}
                dica="O padrão de 15 dias costuma ser suficiente para pintura com cura no mesmo dia."
              >
                <Input
                  id="dias_alerta"
                  inputMode="numeric"
                  value={dias}
                  onChange={(evento) => setRascunho(evento.target.value)}
                  aria-invalid={Boolean(erro)}
                  className="max-w-32 font-mono"
                />
              </Campo>

              <Button type="submit" size="lg" disabled={salvar.isPending}>
                {salvar.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Salvar
              </Button>
            </form>
          )}
      </CardContent>
    </Card>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Campo } from '@/features/cadastros/components/campo'
import { paraCampo, paraNumero } from '@/features/cadastros/validacao'
import { useTenant } from '@/features/tenant/tenant-context'
import {
  obterConfiguracoes,
  salvarConfiguracoes,
  type ConfiguracoesTenant,
} from '@/services/configuracoes-service'
import { centrosCustoStore } from '@/services/financeiro-service'
import { TIPO_CENTRO_CUSTO_LABEL } from '@/types/financeiro'

type CamposNumericos = Exclude<keyof ConfiguracoesTenant, 'tenant_id'>

const CAMPOS_ENCARGOS: Array<{ chave: CamposNumericos; label: string; dica: string }> = [
  {
    chave: 'multa_percentual',
    label: 'Multa por atraso (%)',
    dica: 'Percentual fixo, cobrado uma única vez sobre o saldo.',
  },
  {
    chave: 'juros_mes_percentual',
    label: 'Juros ao mês (%)',
    dica: 'Cobrado pro rata die — a taxa mensal dividida por 30, por dia de atraso.',
  },
]

const CAMPOS_CUSTO: Array<{ chave: CamposNumericos; label: string; dica: string }> = [
  {
    chave: 'custo_energia_gas_m2',
    label: 'Energia e gás por m² (R$)',
    dica: 'Conta de luz e gás do forno divididas pelo m² pintado no mês.',
  },
  {
    chave: 'custo_mao_obra_m2',
    label: 'Mão de obra por m² (R$)',
    dica: 'Folha da produção dividida pelo m² pintado.',
  },
  {
    chave: 'custo_insumos_quimicos_m2',
    label: 'Químicos por m² (R$)',
    dica: 'Desengraxante, fosfatizante e afins.',
  },
  {
    chave: 'custo_depreciacao_m2',
    label: 'Depreciação por m² (R$)',
    dica: 'Cabine, forno e transportador.',
  },
  {
    chave: 'despesa_fixa_mensal',
    label: 'Despesa fixa mensal (R$)',
    dica: 'Base do ponto de equilíbrio: aluguel, administrativo, contador.',
  },
]

export function ConfigFinanceiroPage() {
  const { tenantAtivo } = useTenant()

  return (
    <>
      <PageHeader
        sobretitulo="Parâmetros"
        titulo="Financeiro"
        descricao={`Encargos de atraso e custos indiretos de ${tenantAtivo.nome_fantasia}. Estes números alimentam a cobrança e o custo por m².`}
      />

      <FormularioFinanceiro key={tenantAtivo.id} tenantId={tenantAtivo.id} />
      <CentrosDeCusto tenantId={tenantAtivo.id} />
    </>
  )
}

function FormularioFinanceiro({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient()
  const [rascunho, setRascunho] = useState<Partial<Record<CamposNumericos, string>>>({})
  const [erro, setErro] = useState<string | null>(null)

  const configQuery = useQuery({
    queryKey: ['configuracoes', tenantId],
    queryFn: () => obterConfiguracoes(tenantId),
  })

  const salvar = useMutation({
    mutationFn: (patch: Partial<Omit<ConfiguracoesTenant, 'tenant_id'>>) =>
      salvarConfiguracoes(tenantId, patch),
    onSuccess: async () => {
      setRascunho({})
      await queryClient.invalidateQueries({ queryKey: ['configuracoes', tenantId] })
      await queryClient.invalidateQueries({ queryKey: ['financeiro', tenantId] })
      toast.success('Parâmetros salvos', {
        description: 'O custo por m² e a cobrança já usam os novos valores.',
      })
    },
  })

  if (configQuery.isPending || !configQuery.data) {
    return <Skeleton className="h-96 w-full" />
  }

  const config = configQuery.data
  const valorDe = (chave: CamposNumericos) =>
    rascunho[chave] ?? paraCampo(config[chave])

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()

    const patch: Partial<Omit<ConfiguracoesTenant, 'tenant_id'>> = {}

    for (const chave of [...CAMPOS_ENCARGOS, ...CAMPOS_CUSTO].map((c) => c.chave)) {
      const numero = paraNumero(valorDe(chave))

      if (!Number.isFinite(numero) || numero < 0) {
        setErro(`Valor inválido em "${chave}". Use apenas números não negativos.`)
        return
      }

      patch[chave] = numero
    }

    setErro(null)
    salvar.mutate(patch)
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Encargos por atraso</CardTitle>
          <p className="text-sm text-muted-foreground">
            Multa incide uma vez; juros correm por dia. É a convenção usada na cobrança
            comercial brasileira.
          </p>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          {CAMPOS_ENCARGOS.map((campo) => (
            <Campo key={campo.chave} id={campo.chave} label={campo.label} dica={campo.dica}>
              <Input
                id={campo.chave}
                inputMode="decimal"
                className="font-mono"
                value={valorDe(campo.chave)}
                onChange={(evento) =>
                  setRascunho((atual) => ({
                    ...atual,
                    [campo.chave]: evento.target.value,
                  }))
                }
              />
            </Campo>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custos indiretos por m²</CardTitle>
          <p className="text-sm text-muted-foreground">
            Estes valores não saem de nota fiscal por OS — são rateios que você estima.
            Quanto mais honestos, mais confiável fica a margem.
          </p>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          {CAMPOS_CUSTO.map((campo) => (
            <Campo key={campo.chave} id={campo.chave} label={campo.label} dica={campo.dica}>
              <Input
                id={campo.chave}
                inputMode="decimal"
                className="font-mono"
                value={valorDe(campo.chave)}
                onChange={(evento) =>
                  setRascunho((atual) => ({
                    ...atual,
                    [campo.chave]: evento.target.value,
                  }))
                }
              />
            </Campo>
          ))}
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Button type="submit" size="lg" disabled={salvar.isPending}>
        {salvar.isPending && <Loader2 className="animate-spin" aria-hidden />}
        Salvar parâmetros
      </Button>
    </form>
  )
}

function CentrosDeCusto({ tenantId }: { tenantId: string }) {
  const centrosQuery = useQuery({
    queryKey: ['centros-custo', tenantId],
    queryFn: () => centrosCustoStore.listar(tenantId),
  })

  return (
    <Card className="mt-5 overflow-x-auto">
      <CardHeader>
        <CardTitle>Centros de custo</CardTitle>
        <p className="text-sm text-muted-foreground">
          Usados para classificar contas a pagar. Cadastro completo entra junto com o
          Supabase.
        </p>
      </CardHeader>

      <CardContent>
        {centrosQuery.isPending ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centro</TableHead>
                <TableHead>Tipo</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {(centrosQuery.data ?? []).map((centro) => (
                <TableRow key={centro.id}>
                  <TableCell className="font-medium text-brand-dark">
                    {centro.nome}
                  </TableCell>
                  <TableCell className="text-sm text-brand-muted">
                    {TIPO_CENTRO_CUSTO_LABEL[centro.tipo]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

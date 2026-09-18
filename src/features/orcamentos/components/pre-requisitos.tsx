import { ArrowRight, CircleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Empresa recém-criada não consegue orçar: faltam cliente e cor cadastrados.
 *
 * Antes disto os dois `<Select>` do formulário simplesmente apareciam vazios,
 * sem dizer por quê — o usuário clicava, não via opção nenhuma e não tinha
 * como adivinhar que o caminho era outro módulo.
 *
 * A cor é pré-requisito real, não burocracia: ela carrega RAL, rendimento e
 * custo por quilo, e é o que a OS e o cálculo de consumo de tinta usam depois.
 */
export function PreRequisitosOrcamento({
  temCliente,
  temCor,
}: {
  temCliente: boolean
  temCor: boolean
}) {
  if (temCliente && temCor) return null

  const faltando = [
    !temCliente && {
      titulo: 'Nenhum cliente cadastrado',
      texto: 'O orçamento é sempre para um cliente — é dele o CNPJ que vai na proposta.',
      rotulo: 'Cadastrar cliente',
      para: '/app/cadastros/clientes',
    },
    !temCor && {
      titulo: 'Nenhuma cor cadastrada',
      texto:
        'A cor define o RAL, o rendimento da tinta e o custo por quilo. Sem ela não há como estimar consumo nem abrir a ordem de serviço.',
      rotulo: 'Cadastrar cor',
      para: '/app/cadastros/cores',
    },
  ].filter(Boolean) as {
    titulo: string
    texto: string
    rotulo: string
    para: string
  }[]

  return (
    <Card className="border-status-warning-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleAlert className="size-5 text-status-warning-strong" aria-hidden />
          Falta preencher o cadastro antes de orçar
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          São dados que o orçamento copia para a ordem de serviço. Leva um minuto e
          serve para todos os próximos.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {faltando.map((item) => (
          <div
            key={item.para}
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border p-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-brand-dark">{item.titulo}</p>
              <p className="text-sm text-muted-foreground">{item.texto}</p>
            </div>

            <Button asChild variant="outline">
              <Link to={item.para}>
                {item.rotulo}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

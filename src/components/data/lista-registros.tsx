import { CircleAlert, Search, X } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

interface ListaRegistrosProps {
  busca: string
  aoBuscar: (valor: string) => void
  placeholderBusca: string
  /** Botão de "Novo ...". */
  acao?: React.ReactNode
  filtros?: React.ReactNode
  carregando: boolean
  erro: boolean
  aoTentarNovamente: () => void
  /** Total no tenant, antes de qualquer filtro — distingue "vazio" de "sem resultado". */
  totalRegistros: number
  totalFiltrado: number
  vazioTitulo: string
  vazioDescricao: string
  children: React.ReactNode
}

/**
 * Casca comum das listagens do sistema: busca, filtros e os cinco estados
 * (carregando, erro, sem nenhum cadastro, sem resultado de busca, com dados).
 */
export function ListaRegistros({
  busca,
  aoBuscar,
  placeholderBusca,
  acao,
  filtros,
  carregando,
  erro,
  aoTentarNovamente,
  totalRegistros,
  totalFiltrado,
  vazioTitulo,
  vazioDescricao,
  children,
}: ListaRegistrosProps) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />

          <Input
            type="search"
            value={busca}
            onChange={(event) => aoBuscar(event.target.value)}
            placeholder={placeholderBusca}
            aria-label={placeholderBusca}
            className="pl-9"
          />

          {busca && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => aoBuscar('')}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-1 -translate-y-1/2"
            >
              <X />
            </Button>
          )}
        </div>

        {filtros}

        {!carregando && !erro && totalRegistros > 0 && (
          <span className="eyebrow shrink-0" aria-live="polite">
            {totalFiltrado === totalRegistros
              ? `${totalRegistros} ${totalRegistros === 1 ? 'registro' : 'registros'}`
              : `${totalFiltrado} de ${totalRegistros}`}
          </span>
        )}

        <div className="ml-auto">{acao}</div>
      </div>

      {carregando ? (
        <Card>
          <CardContent className="space-y-2" role="status" aria-live="polite">
            <span className="sr-only">Carregando cadastros</span>
            {[0, 1, 2, 3].map((linha) => (
              <Skeleton key={linha} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : erro ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            Não foi possível carregar os dados.
            <Button size="sm" variant="outline" onClick={aoTentarNovamente}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : totalRegistros === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <h2 className="text-base font-semibold text-brand-dark">{vazioTitulo}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">
              {vazioDescricao}
            </p>
            {acao && <div className="mt-6 flex justify-center">{acao}</div>}
          </CardContent>
        </Card>
      ) : totalFiltrado === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <h2 className="text-base font-semibold text-brand-dark">
              Nenhum resultado
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">
              Nada encontrado para a busca atual entre os {totalRegistros} registros
              desta empresa.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => aoBuscar('')}>
              Limpar busca
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">{children}</Card>
      )}
    </>
  )
}

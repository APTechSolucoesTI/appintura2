import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, Loader2, Send } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatDate } from '@/lib/format'
import {
  convidarMembro,
  listarMembros,
  EquipeError,
  type Membro,
} from '@/services/equipe-service'
import { ROLE_DESCRICAO, ROLE_LABEL, ROLES, type VinculoStatus } from '@/types/domain'

const conviteSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe o e-mail de quem você quer convidar.')
    .email('Informe um e-mail válido.'),
  role: z.enum(ROLES),
})

type ConviteForm = z.infer<typeof conviteSchema>

export function EquipePage() {
  const { tenantAtivo } = useTenant()
  const queryClient = useQueryClient()

  // tenant_id na queryKey: dado de empresa nenhuma compartilha cache com outra.
  const membrosQuery = useQuery({
    queryKey: ['equipe', 'membros', tenantAtivo.id],
    queryFn: () => listarMembros(tenantAtivo.id),
  })

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ConviteForm>({
    resolver: zodResolver(conviteSchema),
    defaultValues: { email: '', role: 'operador_pintura' },
  })

  const roleSelecionada = useWatch({ control, name: 'role' })

  const convite = useMutation({
    mutationFn: (valores: ConviteForm) =>
      convidarMembro(tenantAtivo.id, valores.email, valores.role),
    onSuccess: async (membro) => {
      await queryClient.invalidateQueries({
        queryKey: ['equipe', 'membros', tenantAtivo.id],
      })
      reset()
      toast.success('Convite registrado', {
        description: `${membro.email} aparece como pendente até aceitar o acesso.`,
      })
    },
  })

  return (
    <>
      <PageHeader
        sobretitulo="Acessos"
        titulo="Equipe"
        descricao={`Quem tem acesso a ${tenantAtivo.nome_fantasia}. O papel define quais módulos a pessoa enxerga.`}
      />

      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Convidar por e-mail</CardTitle>
            <p className="text-sm text-muted-foreground">
              O convite fica pendente até a pessoa criar a senha dela.
            </p>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={(event) =>
                void handleSubmit((valores) => convite.mutateAsync(valores).catch(() => {}))(
                  event,
                )
              }
              noValidate
              className="space-y-4"
            >
              {convite.isError && (
                <Alert variant="destructive">
                  <CircleAlert aria-hidden />
                  <AlertDescription>
                    {convite.error instanceof EquipeError
                      ? convite.error.message
                      : 'Não foi possível enviar o convite agora.'}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="convite-email">E-mail</Label>
                <Input
                  id="convite-email"
                  type="email"
                  autoComplete="off"
                  placeholder="nome@suaempresa.com.br"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'convite-email-erro' : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p id="convite-email-erro" className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="convite-role">Papel</Label>

                <Controller
                  control={control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="convite-role" className="w-full">
                        <SelectValue placeholder="Selecione o papel" />
                      </SelectTrigger>

                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />

                <p className="text-xs text-muted-foreground">
                  {ROLE_DESCRICAO[roleSelecionada]}
                </p>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={convite.isPending}
              >
                {convite.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Send aria-hidden />
                )}
                {convite.isPending ? 'Enviando…' : 'Enviar convite'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pessoas com acesso</CardTitle>
            <p className="text-sm text-muted-foreground">
              {membrosQuery.data
                ? `${membrosQuery.data.length} vínculo(s) nesta empresa`
                : 'Carregando vínculos…'}
            </p>
          </CardHeader>

          <CardContent>
            <ListaMembros
              membros={membrosQuery.data}
              carregando={membrosQuery.isPending}
              erro={membrosQuery.isError}
              aoTentarNovamente={() => void membrosQuery.refetch()}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function ListaMembros({
  membros,
  carregando,
  erro,
  aoTentarNovamente,
}: {
  membros: Membro[] | undefined
  carregando: boolean
  erro: boolean
  aoTentarNovamente: () => void
}) {
  if (carregando) {
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <span className="sr-only">Carregando equipe</span>
        {[0, 1, 2].map((linha) => (
          <Skeleton key={linha} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (erro) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription className="flex flex-wrap items-center gap-3">
          Não foi possível carregar a equipe.
          <Button size="sm" variant="outline" onClick={aoTentarNovamente}>
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!membros || membros.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum vínculo nesta empresa ainda. Use o formulário ao lado para convidar
        alguém.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pessoa</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Desde</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {membros.map((membro) => (
            <TableRow key={membro.id}>
              <TableCell>
                <span className="block font-medium text-brand-dark">
                  {membro.nome ?? 'Convite pendente'}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {membro.email}
                </span>
              </TableCell>

              <TableCell className="text-brand-text">{ROLE_LABEL[membro.role]}</TableCell>

              <TableCell>
                <StatusVinculo status={membro.status} />
              </TableCell>

              <TableCell className="hidden text-right font-mono text-xs text-muted-foreground sm:table-cell">
                {formatDate(membro.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

const ESTILO_STATUS: Record<VinculoStatus, string> = {
  ativo: 'bg-status-success-soft text-status-success-strong',
  pendente: 'bg-status-warning-soft text-status-warning-strong',
  inativo: 'bg-status-neutral-soft text-status-neutral-strong',
}

const ROTULO_STATUS: Record<VinculoStatus, string> = {
  ativo: 'Ativo',
  pendente: 'Pendente',
  inativo: 'Inativo',
}

function StatusVinculo({ status }: { status: VinculoStatus }) {
  return (
    <span
      className={`selo ${ESTILO_STATUS[status]}`}
    >
      {ROTULO_STATUS[status]}
    </span>
  )
}

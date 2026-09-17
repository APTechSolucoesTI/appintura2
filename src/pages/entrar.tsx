import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { Logo } from '@/components/brand/logo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/auth-context'
import { AuthError } from '@/services/auth-service'
import { DEMO_PASSWORD, USERS } from '@/mocks/seed'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe seu e-mail.')
    .email('Informe um e-mail válido.'),
  senha: z.string().min(1, 'Informe sua senha.'),
})

type LoginForm = z.infer<typeof loginSchema>

export function EntrarPage() {
  const { status, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [erro, setErro] = useState<string | null>(null)

  const destino = (location.state as { from?: string } | null)?.from ?? '/app'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', senha: '' },
  })

  if (status === 'autenticado') {
    return <Navigate to={destino} replace />
  }

  async function onSubmit(valores: LoginForm) {
    setErro(null)

    try {
      await signIn(valores.email, valores.senha)
      navigate(destino, { replace: true })
    } catch (causa) {
      setErro(
        causa instanceof AuthError
          ? causa.message
          : 'Não foi possível entrar agora. Tente novamente em instantes.',
      )
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <PainelMarca />

      <main className="flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden">
            <Logo />
          </Link>

          <h1 className="mt-8 text-2xl font-bold text-brand-dark lg:mt-0">
            Entrar no APPintura
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            Use o e-mail cadastrado pelo administrador da sua empresa.
          </p>

          <form
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
            noValidate
            className="mt-7 space-y-4"
          >
            {erro && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@suaempresa.com.br"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-erro' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-erro" className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.senha)}
                aria-describedby={errors.senha ? 'senha-erro' : undefined}
                {...register('senha')}
              />
              {errors.senha && (
                <p id="senha-erro" className="text-xs text-destructive">
                  {errors.senha.message}
                </p>
              )}
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          <CredenciaisDemo />

          <p className="mt-6 text-center text-sm text-brand-muted">
            <Link to="/" className="font-medium text-brand-medium hover:underline">
              Voltar para a página inicial
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

function PainelMarca() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-gradient p-10 lg:flex lg:flex-col">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(70%_50%_at_20%_100%,rgba(0,194,203,0.35),transparent)]"
      />

      <Link to="/" className="relative">
        <Logo tom="claro" />
      </Link>

      <div className="relative mt-auto max-w-md">
        <h2 className="text-3xl font-bold text-white">
          Da portaria ao fechamento do mês.
        </h2>
        <p className="mt-4 text-white/80">
          Romaneio com foto e assinatura, Kanban no chão de fábrica, custo real por m² e
          cobrança em dia — com os dados de cada CNPJ isolados uns dos outros.
        </p>
      </div>
    </aside>
  )
}

/**
 * Bloco temporário da Fase 0: enquanto o Supabase Auth não está conectado, o login
 * é um mock em memória. REMOVER junto com `src/mocks/seed.ts` ao plugar o backend.
 */
function CredenciaisDemo() {
  return (
    <div className="mt-6 rounded-card border border-dashed border-border bg-card p-4">
      <p className="font-mono text-[0.65rem] tracking-[0.14em] text-brand-medium uppercase">
        Ambiente de demonstração
      </p>

      <p className="mt-2 text-xs text-brand-muted">
        Senha para qualquer usuário:{' '}
        <code className="rounded-field bg-muted px-1.5 py-0.5 font-mono text-brand-dark">
          {DEMO_PASSWORD}
        </code>
      </p>

      <ul className="mt-2 space-y-1">
        {USERS.map((user) => (
          <li key={user.id} className="font-mono text-xs text-brand-muted">
            {user.email}
          </li>
        ))}
      </ul>
    </div>
  )
}

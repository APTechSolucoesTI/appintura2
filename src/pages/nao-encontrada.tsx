import { Link } from 'react-router-dom'

import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export function NaoEncontradaPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <Logo />

      <p className="mt-10 font-mono text-sm tracking-[0.14em] text-brand-medium uppercase">
        Erro 404
      </p>

      <h1 className="mt-2 text-3xl font-bold text-brand-dark">Página não encontrada</h1>

      <p className="mt-3 max-w-md text-sm text-brand-muted">
        O endereço acessado não existe ou o módulo ainda não foi liberado para o seu
        papel nesta empresa.
      </p>

      <Button asChild size="lg" className="mt-8">
        <Link to="/app">Ir para o painel</Link>
      </Button>
    </main>
  )
}

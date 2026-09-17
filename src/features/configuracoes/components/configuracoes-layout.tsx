import { Factory, Users, Wallet } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { AbasModulo } from '@/components/layout/abas-modulo'

const ABAS = [
  { to: '/app/configuracoes/equipe', label: 'Equipe', icon: Users },
  { to: '/app/configuracoes/operacao', label: 'Operação', icon: Factory },
  { to: '/app/configuracoes/financeiro', label: 'Financeiro', icon: Wallet },
]

export function ConfiguracoesLayout() {
  return (
    <>
      <AbasModulo rotulo="Configurações" abas={ABAS} />
      <Outlet />
    </>
  )
}

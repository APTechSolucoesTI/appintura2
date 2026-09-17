import { Calculator, LayoutDashboard, TrendingDown, TrendingUp, Waves } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { AbasModulo } from '@/components/layout/abas-modulo'

const ABAS = [
  { to: '/app/financeiro/painel', label: 'Painel', icon: LayoutDashboard },
  { to: '/app/financeiro/receber', label: 'A receber', icon: TrendingUp },
  { to: '/app/financeiro/pagar', label: 'A pagar', icon: TrendingDown },
  { to: '/app/financeiro/fluxo-caixa', label: 'Fluxo de caixa', icon: Waves },
  { to: '/app/financeiro/custos', label: 'Custos e margem', icon: Calculator },
]

export function FinanceiroLayout() {
  return (
    <>
      <AbasModulo rotulo="Financeiro" abas={ABAS} />
      <Outlet />
    </>
  )
}

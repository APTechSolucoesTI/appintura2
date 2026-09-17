import { LayoutGrid, List } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { AbasModulo } from '@/components/layout/abas-modulo'

const ABAS = [
  { to: '/app/ordens-servico/kanban', label: 'Kanban', icon: LayoutGrid },
  { to: '/app/ordens-servico/lista', label: 'Lista', icon: List },
]

export function ProducaoLayout() {
  return (
    <>
      <AbasModulo rotulo="Ordens de serviço" abas={ABAS} />
      <Outlet />
    </>
  )
}

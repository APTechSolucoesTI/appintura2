import { Boxes, ArrowLeftRight } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { AbasModulo } from '@/components/layout/abas-modulo'

const ABAS = [
  { to: '/app/estoque/posicao', label: 'Posição', icon: Boxes },
  { to: '/app/estoque/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
]

export function EstoqueLayout() {
  return (
    <>
      <AbasModulo rotulo="Estoque de insumos" abas={ABAS} />
      <Outlet />
    </>
  )
}

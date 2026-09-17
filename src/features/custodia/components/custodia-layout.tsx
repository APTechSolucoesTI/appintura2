import { ArrowDownToLine, ArrowUpFromLine, Scale } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { AbasModulo } from '@/components/layout/abas-modulo'

const ABAS = [
  { to: '/app/recebimento/custodia', label: 'Saldo de custódia', icon: Scale },
  { to: '/app/recebimento/recebimentos', label: 'Recebimentos', icon: ArrowDownToLine },
  { to: '/app/recebimento/devolucoes', label: 'Devoluções', icon: ArrowUpFromLine },
]

export function CustodiaLayout() {
  return (
    <>
      <AbasModulo rotulo="Recebimento e devolução" abas={ABAS} />
      <Outlet />
    </>
  )
}

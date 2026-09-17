import { BarChart3, ClipboardCheck, ShieldAlert } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { AbasModulo } from '@/components/layout/abas-modulo'

const ABAS = [
  { to: '/app/qualidade/inspecoes', label: 'Inspeções', icon: ClipboardCheck },
  { to: '/app/qualidade/nao-conformidades', label: 'Não conformidades', icon: ShieldAlert },
  { to: '/app/qualidade/indicadores', label: 'Indicadores', icon: BarChart3 },
]

export function QualidadeLayout() {
  return (
    <>
      <AbasModulo rotulo="Controle de qualidade" abas={ABAS} />
      <Outlet />
    </>
  )
}

import { Boxes, Palette, Tags, Truck, Users } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { AbasModulo } from '@/components/layout/abas-modulo'

const ABAS = [
  { to: '/app/cadastros/clientes', label: 'Clientes', icon: Users },
  { to: '/app/cadastros/tabelas-preco', label: 'Tabelas de preço', icon: Tags },
  { to: '/app/cadastros/cores', label: 'Cores e tintas', icon: Palette },
  { to: '/app/cadastros/insumos', label: 'Insumos químicos', icon: Boxes },
  { to: '/app/cadastros/transportadoras', label: 'Transportadoras', icon: Truck },
]

export function CadastrosLayout() {
  return (
    <>
      <AbasModulo rotulo="Cadastros" abas={ABAS} />
      <Outlet />
    </>
  )
}

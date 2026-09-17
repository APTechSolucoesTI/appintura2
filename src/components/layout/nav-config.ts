import {
  Boxes,
  ClipboardList,
  FileText,
  LayoutDashboard,
  PackageCheck,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import type { Modulo } from '@/features/auth/permissions'

export interface NavItem {
  modulo: Modulo
  label: string
  to: string
  icon: LucideIcon
}

export interface NavGrupo {
  titulo: string
  itens: NavItem[]
}

export const NAV_GRUPOS: NavGrupo[] = [
  {
    titulo: 'Comercial',
    itens: [
      {
        modulo: 'orcamentos',
        label: 'Orçamentos',
        to: '/app/orcamentos',
        icon: FileText,
      },
    ],
  },
  {
    titulo: 'Operação',
    itens: [
      {
        modulo: 'dashboard',
        label: 'Painel',
        to: '/app',
        icon: LayoutDashboard,
      },
      {
        modulo: 'recebimento',
        label: 'Recebimento e devolução',
        to: '/app/recebimento',
        icon: PackageCheck,
      },
      {
        modulo: 'ordens_servico',
        label: 'Ordens de serviço',
        to: '/app/ordens-servico',
        icon: ClipboardList,
      },
      {
        modulo: 'qualidade',
        label: 'Qualidade',
        to: '/app/qualidade',
        icon: ShieldCheck,
      },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      {
        modulo: 'cadastros',
        label: 'Cadastros',
        to: '/app/cadastros',
        icon: Users,
      },
      {
        modulo: 'estoque',
        label: 'Estoque de insumos',
        to: '/app/estoque',
        icon: Boxes,
      },
      {
        modulo: 'financeiro',
        label: 'Financeiro',
        to: '/app/financeiro',
        icon: Wallet,
      },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [
      {
        modulo: 'configuracoes',
        label: 'Configurações',
        to: '/app/configuracoes/equipe',
        icon: Settings,
      },
    ],
  },
]

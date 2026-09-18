import {
  Boxes,
  ClipboardList,
  FileText,
  TrendingUp,
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
    // Comercial vem DEPOIS de Operação para o Painel continuar sendo o primeiro
    // item da barra: ele é a tela pós-login, e empurrá-lo para baixo fazia o
    // usuário procurar o que deveria estar na frente.
    titulo: 'Comercial',
    itens: [
      {
        modulo: 'orcamentos',
        label: 'Orçamentos',
        to: '/app/orcamentos',
        icon: FileText,
      },
      {
        modulo: 'orcamentos',
        label: 'Funil comercial',
        to: '/app/orcamentos/funil',
        icon: TrendingUp,
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

/**
 * O item deve casar a rota de forma EXATA?
 *
 * Sim quando o caminho dele é prefixo do de outro item — `/app/orcamentos` é
 * prefixo de `/app/orcamentos/funil`. Sem isto o `NavLink` marca os dois como
 * ativos ao mesmo tempo e a barra fica com duas pílulas brancas acesas.
 *
 * Calculado a partir da própria lista, e não por uma flag manual, para um item
 * novo com sub-rota não reintroduzir o bug em silêncio.
 */
const TODOS_OS_CAMINHOS = NAV_GRUPOS.flatMap((grupo) => grupo.itens.map((item) => item.to))

export function exigeRotaExata(to: string): boolean {
  return TODOS_OS_CAMINHOS.some((outro) => outro !== to && outro.startsWith(`${to}/`))
}

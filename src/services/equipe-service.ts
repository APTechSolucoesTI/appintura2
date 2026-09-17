import { CONVITES_PENDENTES, USER_ROLES, USERS } from '@/mocks/seed'
import type { Role, VinculoStatus } from '@/types/domain'

export interface Membro {
  id: string
  nome: string | null
  email: string
  role: Role
  status: VinculoStatus
  created_at: string
}

export class EquipeError extends Error {}

/**
 * Convites criados durante a sessão. Ao conectar o Supabase, isto vira INSERT em
 * `user_roles` com status 'pendente' + invoke da Edge Function `convidar-membro`.
 */
const convitesDaSessao: Membro[] = []

const LATENCIA_MS = 300

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCIA_MS))
}

export async function listarMembros(tenantId: string): Promise<Membro[]> {
  await delay()

  const ativos: Membro[] = USER_ROLES.filter(
    (vinculo) => vinculo.tenant_id === tenantId,
  ).flatMap((vinculo) => {
    const user = USERS.find((candidato) => candidato.id === vinculo.user_id)

    if (!user) return []

    return [
      {
        id: vinculo.id,
        nome: user.nome,
        email: user.email,
        role: vinculo.role,
        status: vinculo.status,
        created_at: vinculo.created_at,
      },
    ]
  })

  const pendentes: Membro[] = CONVITES_PENDENTES.filter(
    (convite) => convite.tenant_id === tenantId,
  ).map((convite) => ({
    id: convite.id,
    nome: null,
    email: convite.email,
    role: convite.role,
    status: convite.status,
    created_at: convite.created_at,
  }))

  const daSessao = convitesDaSessao.filter((membro) =>
    membro.id.startsWith(`${tenantId}:`),
  )

  return [...ativos, ...pendentes, ...daSessao].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )
}

export async function convidarMembro(
  tenantId: string,
  email: string,
  role: Role,
): Promise<Membro> {
  await delay()

  const normalizado = email.trim().toLowerCase()
  const existentes = await listarMembros(tenantId)

  if (existentes.some((membro) => membro.email.toLowerCase() === normalizado)) {
    throw new EquipeError('Este e-mail já tem acesso ou convite aberto nesta empresa.')
  }

  const convite: Membro = {
    id: `${tenantId}:${normalizado}`,
    nome: null,
    email: normalizado,
    role,
    status: 'pendente',
    created_at: new Date().toISOString(),
  }

  convitesDaSessao.push(convite)

  // Stub do disparo de e-mail. Com o Supabase conectado, vira:
  // await supabase.functions.invoke('convidar-membro', { body: { tenantId, email, role } })
  console.info('[stub] Edge Function convidar-membro', { tenantId, email: normalizado, role })

  return convite
}

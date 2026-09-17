import { CHAVE_ANON_PUBLICA, supabase, tokenArmazenado, urlFuncao } from '@/lib/supabase'
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
 * Equipe de um tenant.
 *
 * A lista sai de `user_roles` com o usuário embutido — inclui os convites
 * pendentes, que são linhas com `status='pendente'`, não uma lista à parte.
 * `usuarios` só devolve quem divide empresa com você (policy da Fase 0), então
 * isto nunca vira um diretório de todos os usuários do produto.
 */
export async function listarMembros(tenantId: string): Promise<Membro[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('id, role, status, created_at, usuario:usuarios(nome, email)')
    .eq('tenant_id', tenantId)

  if (error) throw new EquipeError('Não foi possível carregar a equipe.')

  type Linha = {
    id: string
    role: Role
    status: VinculoStatus
    created_at: string
    usuario: { nome: string; email: string } | null
  }

  return ((data ?? []) as unknown as Linha[])
    .map((linha) => ({
      id: linha.id,
      nome: linha.usuario?.nome ?? null,
      email: linha.usuario?.email ?? '',
      role: linha.role,
      status: linha.status,
      created_at: linha.created_at,
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/**
 * Convida alguém para a empresa.
 *
 * Passa pela Edge Function porque criar o usuário exige service_role — o
 * convidado ainda não existe, e o client não pode ter esse poder. A função
 * revalida que quem chama é admin DAQUELE tenant antes de escrever.
 *
 * ATENÇÃO: o e-mail de convite ainda não é enviado (TODO na Edge Function). O
 * usuário é criado com senha aleatória que ninguém conhece, então ele aparece
 * na lista como pendente mas NÃO consegue entrar até que alguém defina a senha.
 */
export async function convidarMembro(
  tenantId: string,
  email: string,
  role: Role,
  nome: string,
): Promise<Membro> {
  const normalizado = email.trim().toLowerCase()
  const token = tokenArmazenado()

  if (!token) throw new EquipeError('Sessão expirada. Entre novamente.')

  let resposta: Response

  try {
    resposta = await fetch(urlFuncao('convidar-membro'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CHAVE_ANON_PUBLICA,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tenant_id: tenantId, email: normalizado, role, nome }),
    })
  } catch {
    throw new EquipeError('Não foi possível falar com o servidor.')
  }

  const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null

  if (!resposta.ok) {
    throw new EquipeError(corpo?.erro ?? 'Não foi possível enviar o convite.')
  }

  // Relê da lista para pegar o id real do vínculo e o created_at do banco.
  const membros = await listarMembros(tenantId)
  const criado = membros.find((membro) => membro.email === normalizado)

  if (!criado) throw new EquipeError('Convite criado, mas não foi possível carregá-lo.')

  return criado
}

/** Muda o papel de alguém. A policy só deixa admin daquele tenant fazer isso. */
export async function alterarPapel(
  tenantId: string,
  vinculoId: string,
  role: Role,
): Promise<void> {
  const { error } = await supabase
    .from('user_roles')
    .update({ role })
    .eq('id', vinculoId)
    .eq('tenant_id', tenantId)

  if (error) throw new EquipeError('Não foi possível alterar o papel.')
}

/**
 * Remove o acesso de alguém à empresa.
 *
 * A policy da Fase 0 impede remover o próprio vínculo — é o que evita uma
 * empresa ficar sem nenhum admin. O erro vem do banco, não daqui.
 */
export async function removerMembro(tenantId: string, vinculoId: string): Promise<void> {
  const { data, error } = await supabase
    .from('user_roles')
    .delete()
    .eq('id', vinculoId)
    .eq('tenant_id', tenantId)
    .select('id')
    .maybeSingle()

  if (error) throw new EquipeError('Não foi possível remover o acesso.')
  if (!data) {
    throw new EquipeError(
      'Não foi possível remover. Você não pode remover o seu próprio acesso.',
    )
  }
}

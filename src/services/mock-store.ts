/**
 * Repositório em memória usado enquanto o Supabase não está conectado.
 *
 * Reproduz de propósito o contrato que as tabelas terão sob RLS: toda operação
 * exige `tenantId` e nunca enxerga linha de outro tenant. Quando o backend
 * entrar, cada serviço troca estas chamadas por `supabase.from(...)` — a
 * assinatura das funções não muda.
 */

export interface RegistroTenant {
  id: string
  tenant_id: string
  created_at: string
}

export class RegistroNaoEncontradoError extends Error {
  constructor() {
    super('Registro não encontrado nesta empresa.')
  }
}

const LATENCIA_MS = 250

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCIA_MS))
}

export interface MockStore<T extends RegistroTenant> {
  listar: (tenantId: string) => Promise<T[]>
  obter: (tenantId: string, id: string) => Promise<T>
  criar: (tenantId: string, valores: Omit<T, keyof RegistroTenant>) => Promise<T>
  atualizar: (
    tenantId: string,
    id: string,
    valores: Partial<Omit<T, keyof RegistroTenant>>,
  ) => Promise<T>
  /** Equivale a `update ... where id in (...)`: uma operação, não N. */
  atualizarVarios: (
    tenantId: string,
    ids: string[],
    valores: Partial<Omit<T, keyof RegistroTenant>>,
  ) => Promise<T[]>
  remover: (tenantId: string, id: string) => Promise<void>
}

export function criarStore<T extends RegistroTenant>(
  inicial: T[],
  ordenar?: (a: T, b: T) => number,
): MockStore<T> {
  let registros = [...inicial]

  function doTenant(tenantId: string): T[] {
    const filtrados = registros.filter((item) => item.tenant_id === tenantId)

    return ordenar ? [...filtrados].sort(ordenar) : filtrados
  }

  function exigir(tenantId: string, id: string): T {
    const registro = registros.find(
      (item) => item.id === id && item.tenant_id === tenantId,
    )

    if (!registro) throw new RegistroNaoEncontradoError()

    return registro
  }

  return {
    async listar(tenantId) {
      await delay()

      return doTenant(tenantId)
    },

    async obter(tenantId, id) {
      await delay()

      return exigir(tenantId, id)
    },

    async criar(tenantId, valores) {
      await delay()

      const novo = {
        ...valores,
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
      } as T

      registros = [...registros, novo]

      return novo
    },

    async atualizar(tenantId, id, valores) {
      await delay()

      const atual = exigir(tenantId, id)
      // id, tenant_id e created_at nunca vêm do formulário.
      const atualizado = { ...atual, ...valores } as T

      registros = registros.map((item) => (item.id === id ? atualizado : item))

      return atualizado
    },

    async atualizarVarios(tenantId, ids, valores) {
      await delay()

      const alvos = new Set(ids)

      registros = registros.map((item) =>
        alvos.has(item.id) && item.tenant_id === tenantId
          ? ({ ...item, ...valores } as T)
          : item,
      )

      return doTenant(tenantId).filter((item) => alvos.has(item.id))
    },

    async remover(tenantId, id) {
      await delay()

      exigir(tenantId, id)
      registros = registros.filter((item) => item.id !== id)
    },
  }
}

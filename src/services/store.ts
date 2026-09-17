/**
 * Contrato de repositório por tenant.
 *
 * Nasceu como interface de um mock em memória e sobreviveu à troca pelo
 * Supabase sem mudar uma assinatura — é por isso que a lógica de negócio dos
 * serviços não precisou ser reescrita. A implementação viva está em
 * `supabase-store.ts`.
 *
 * Toda operação exige `tenantId`. O RLS já filtra por empresa, mas o usuário
 * multi-CNPJ enxerga mais de uma: o RLS é o piso de segurança, e o `tenantId` é
 * a seleção de qual empresa está na tela.
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

export interface Store<T extends RegistroTenant> {
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

import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * Preparo do ambiente de teste de interface.
 *
 * As variáveis do Supabase entram aqui porque `src/lib/supabase.ts` lança na
 * carga do módulo quando elas faltam — comportamento deliberado em produção,
 * que no teste impediria importar qualquer coisa que toque no client.
 */
vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.exemplo.test')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chave-de-teste')

// jsdom não implementa estes dois, e o Radix (base do shadcn) usa os dois.
globalThis.ResizeObserver =
  globalThis.ResizeObserver ??
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

if (!globalThis.matchMedia) {
  globalThis.matchMedia = ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia
}

afterEach(() => {
  cleanup()
})

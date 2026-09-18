import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Configuração dos testes de interface.
 *
 * Separada de `vite.config.ts` porque o build de produção não deve carregar
 * plugin nem alias de teste — e porque a suíte de banco (`supabase/tests/`)
 * roda por fora, no psql.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testes/setup.ts'],
    // Só o que está sob `src/testes`: nada de varrer `supabase/tests`, que é
    // SQL e não roda aqui.
    include: ['src/testes/**/*.test.{ts,tsx}'],
  },
})

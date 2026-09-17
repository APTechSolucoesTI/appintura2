import { z } from 'zod'

/**
 * Campos numéricos vivem como texto no formulário e só viram número no submit.
 *
 * Motivo: input vazio com `valueAsNumber` produz NaN, e `z.coerce.number()`
 * transforma string vazia em 0 silenciosamente — o usuário apagaria o estoque
 * sem perceber. Aqui o vazio é erro explícito.
 *
 * Aceita vírgula como separador decimal, que é como se digita em pt-BR.
 */

export function paraNumero(valor: string): number {
  return Number(valor.replace(/\./g, '').replace(',', '.'))
}

function ehNumeroValido(valor: string): boolean {
  return Number.isFinite(paraNumero(valor))
}

export function numeroNaoNegativo(obrigatorio: string) {
  return z
    .string()
    .min(1, obrigatorio)
    .refine(ehNumeroValido, 'Informe um número válido.')
    .refine((valor) => paraNumero(valor) >= 0, 'Não pode ser negativo.')
}

export function numeroPositivo(obrigatorio: string) {
  return z
    .string()
    .min(1, obrigatorio)
    .refine(ehNumeroValido, 'Informe um número válido.')
    .refine((valor) => paraNumero(valor) > 0, 'Precisa ser maior que zero.')
}

/** Data no formato do input[type=date]. */
export const dataObrigatoria = (obrigatorio: string) =>
  z
    .string()
    .min(1, obrigatorio)
    .refine(
      (valor) => !Number.isNaN(new Date(valor).getTime()),
      'Informe uma data válida.',
    )

/** Formata número para preencher o input na edição, com vírgula decimal. */
export function paraCampo(valor: number): string {
  return String(valor).replace('.', ',')
}

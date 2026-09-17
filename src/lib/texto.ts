/**
 * Normaliza texto para busca: minúsculo, sem acento e sem espaço nas pontas.
 * Faz "Portões" casar com "portoes", que é como as pessoas digitam com pressa.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Remove tudo que não é dígito — usado para buscar por CNPJ com ou sem máscara. */
export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

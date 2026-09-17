/**
 * Validação e formatação de CPF/CNPJ.
 *
 * O cliente de uma pintura eletrostática pode ser pessoa jurídica (o caso comum)
 * ou pessoa física (serralheiro, montador), então o mesmo campo aceita os dois.
 */

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

function calcularDigito(digitos: string, pesos: number[]): number {
  const soma = pesos.reduce(
    (total, peso, indice) => total + Number(digitos[indice]) * peso,
    0,
  )
  const resto = soma % 11

  return resto < 2 ? 0 : 11 - resto
}

export function validarCpf(valor: string): boolean {
  const digitos = apenasDigitos(valor)

  if (digitos.length !== 11) return false
  // Sequências repetidas (111.111.111-11) passam no cálculo, mas não existem.
  if (/^(\d)\1{10}$/.test(digitos)) return false

  const primeiro = calcularDigito(digitos, [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const segundo = calcularDigito(digitos, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])

  return primeiro === Number(digitos[9]) && segundo === Number(digitos[10])
}

export function validarCnpj(valor: string): boolean {
  const digitos = apenasDigitos(valor)

  if (digitos.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digitos)) return false

  const primeiro = calcularDigito(digitos, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const segundo = calcularDigito(digitos, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])

  return primeiro === Number(digitos[12]) && segundo === Number(digitos[13])
}

export function validarCpfCnpj(valor: string): boolean {
  const digitos = apenasDigitos(valor)

  if (digitos.length === 11) return validarCpf(digitos)
  if (digitos.length === 14) return validarCnpj(digitos)

  return false
}

/** 11 dígitos -> CPF, 14 -> CNPJ. Qualquer outro tamanho volta como veio. */
export function formatDocumento(valor: string): string {
  const digitos = apenasDigitos(valor)

  if (digitos.length === 11) {
    return digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }

  if (digitos.length === 14) {
    return digitos.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    )
  }

  return valor
}

/** Máscara progressiva para uso durante a digitação. */
export function mascararDocumento(valor: string): string {
  const digitos = apenasDigitos(valor).slice(0, 14)

  if (digitos.length <= 11) {
    return digitos
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }

  return digitos
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
}

export function mascararTelefone(valor: string): string {
  const digitos = apenasDigitos(valor).slice(0, 11)

  if (digitos.length <= 10) {
    return digitos
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/^\((\d{2})\) (\d{4})(\d)/, '($1) $2-$3')
  }

  return digitos
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/^\((\d{2})\) (\d{5})(\d)/, '($1) $2-$3')
}

export function mascararCep(valor: string): string {
  return apenasDigitos(valor).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

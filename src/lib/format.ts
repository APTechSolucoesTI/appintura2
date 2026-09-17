/** Formatação pt-BR centralizada — nunca formatar valor solto no componente. */

const CURRENCY = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const DATE = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * `new Date('2026-09-14')` é interpretado como meia-noite UTC e, em fuso negativo
 * (BRT = UTC-3), volta como 13/09 na formatação local. Datas sem hora — validade,
 * vencimento, previsão de entrega — precisam ser construídas no fuso local.
 */
export function parseData(value: string | Date): Date {
  if (value instanceof Date) return value

  const partes = SO_DATA.exec(value)

  if (!partes) return new Date(value)

  return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]))
}

export function formatCurrency(valor: number): string {
  return CURRENCY.format(valor)
}

export function formatDate(value: string | Date): string {
  return DATE.format(parseData(value))
}

export function formatDateTime(value: string | Date): string {
  return DATE_TIME.format(parseData(value))
}

/** 12345678000199 -> 12.345.678/0001-99 */
export function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '').padStart(14, '0')

  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5',
  )
}

/** Valor para `input[type=datetime-local]`, no fuso local. */
export function paraDatetimeLocal(value: string | Date = new Date()): string {
  const data = value instanceof Date ? value : new Date(value)
  const doisDigitos = (numero: number) => String(numero).padStart(2, '0')

  return (
    `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}` +
    `T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
  )
}

/** Converte o valor do `datetime-local` (hora local) para ISO em UTC. */
export function deDatetimeLocal(valor: string): string {
  return new Date(valor).toISOString()
}

/** Iniciais para avatar: "Marina Alves Costa" -> "MC" */
export function initials(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  const primeira = partes.at(0)?.charAt(0) ?? ''
  const ultima = partes.length > 1 ? (partes.at(-1)?.charAt(0) ?? '') : ''

  return (primeira + ultima).toUpperCase()
}

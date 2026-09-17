/**
 * Formatadores de eixo dos gráficos.
 *
 * Fora do módulo do tooltip para não misturar componente e função no mesmo
 * arquivo — isso quebra o Fast Refresh do Vite.
 */

/** Valores em milhares: "R$ 12.400" consome metade da largura útil de um eixo. */
export function eixoMoeda(valor: number): string {
  if (Math.abs(valor) >= 1000) return `${Math.round(valor / 1000)}k`

  return String(valor)
}

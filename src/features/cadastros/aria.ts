/**
 * Monta o `aria-describedby` de um campo a partir do que está visível: a
 * mensagem de erro tem prioridade sobre a dica, porque é ela que o leitor de
 * tela precisa anunciar quando o envio falha.
 *
 * Vive fora de `components/campo.tsx` para não misturar componente e função no
 * mesmo módulo — isso quebra o Fast Refresh do Vite.
 */
export function descricaoDoCampo(id: string, erro?: string, dica?: string) {
  if (erro) return `${id}-erro`
  if (dica) return `${id}-dica`

  return undefined
}

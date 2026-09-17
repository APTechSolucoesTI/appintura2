import { Check, X } from 'lucide-react'

import { registroAprovado, type QualidadeRegistro } from '@/types/qualidade'

/**
 * Resultado consolidado da inspeção: reprova se a aderência falhou OU se a
 * espessura saiu da faixa exigida pela OS. Ícone + texto, nunca cor sozinha.
 */
export function BadgeResultado({ registro }: { registro: QualidadeRegistro }) {
  const aprovado = registroAprovado(registro)

  return (
    <span
      className={`selo ${
        aprovado
          ? 'bg-status-success-soft text-status-success-strong'
          : 'bg-status-danger-soft text-status-danger-strong'
      }`}
    >
      {aprovado ? (
        <Check className="size-3" aria-hidden />
      ) : (
        <X className="size-3" aria-hidden />
      )}
      {aprovado ? 'Aprovado' : 'Reprovado'}
    </span>
  )
}

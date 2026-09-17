interface BadgeInadimplenciaProps {
  dias: number
  ativo: boolean
}

/**
 * Situação comercial do cliente. Cliente inativo se sobrepõe à inadimplência —
 * não adianta cobrar quem já foi bloqueado.
 */
export function BadgeInadimplencia({ dias, ativo }: BadgeInadimplenciaProps) {
  if (!ativo) {
    return (
      <span className="selo bg-status-neutral-soft text-status-neutral-strong">
        Inativo
      </span>
    )
  }

  if (dias <= 0) {
    return (
      <span className="selo bg-status-success-soft text-status-success-strong">
        Em dia
      </span>
    )
  }

  const critico = dias > 30

  return (
    <span
      className={
        critico
          ? 'selo bg-status-danger-soft text-status-danger-strong'
          : 'selo bg-status-warning-soft text-status-warning-strong'
      }
    >
      {dias}d em atraso
    </span>
  )
}

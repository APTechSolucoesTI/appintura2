interface PageHeaderProps {
  /** Rótulo em versalete acima do título, com ponto cyan à esquerda. */
  sobretitulo?: string
  titulo: string
  descricao?: string
  /**
   * Ações principais. Ficam ABAIXO do texto, em botões largos lado a lado —
   * é o padrão do protótipo e o que funciona em tablet, onde um botão no canto
   * superior direito fica longe do polegar.
   */
  acoes?: React.ReactNode
}

export function PageHeader({
  sobretitulo,
  titulo,
  descricao,
  acoes,
}: PageHeaderProps) {
  return (
    <header className="mb-6">
      {sobretitulo && (
        <p className="eyebrow mb-2 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-brand-accent" aria-hidden />
          {sobretitulo}
        </p>
      )}

      <h1 className="text-3xl text-brand-dark lg:text-4xl">{titulo}</h1>

      {descricao && (
        <p className="mt-2 max-w-3xl text-sm text-brand-muted">{descricao}</p>
      )}

      {acoes && (
        <div className="mt-5 flex max-w-2xl flex-col gap-3 sm:flex-row [&>*]:flex-1">
          {acoes}
        </div>
      )}
    </header>
  )
}

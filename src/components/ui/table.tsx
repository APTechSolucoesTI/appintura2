"use client"

// ATENÇÃO: 'npx shadcn add' sobrescreve este arquivo — reaplicar após rodar.
// O que é nosso aqui: a cópia do rótulo do cabeçalho para cada célula, que o
// modo empilhado (index.css) usa em celular e tablet.

import * as React from "react"
import { cn } from "cn"

/** Texto plano de um nó, para reaproveitar o cabeçalho como rótulo no cartão. */
function textoDe(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textoDe).join("")

  if (React.isValidElement(node)) {
    return textoDe((node.props as { children?: React.ReactNode }).children)
  }

  return ""
}

function rotulosDoCabecalho(children: React.ReactNode): string[] {
  const rotulos: string[] = []

  const visitar = (node: React.ReactNode) => {
    React.Children.forEach(node, (filho) => {
      if (!React.isValidElement(filho)) return

      const props = filho.props as { children?: React.ReactNode }

      if (filho.type === TableHead) {
        rotulos.push(textoDe(props.children).trim())
        return
      }

      visitar(props.children)
    })
  }

  visitar(children)

  return rotulos
}

/**
 * Copia o texto de cada `<th>` para o `<td>` da mesma posição. Em tela estreita
 * o cabeçalho some e o rótulo reaparece dentro do cartão via CSS, sem que cada
 * página precise repetir o nome da coluna.
 */
function comRotulos(
  children: React.ReactNode,
  rotulos: string[]
): React.ReactNode {
  const celulas = (linha: React.ReactNode) => {
    let indice = 0

    return React.Children.map(linha, (celula) => {
      if (!React.isValidElement(celula) || celula.type !== TableCell) {
        return celula
      }

      const props = celula.props as React.ComponentProps<"td"> & {
        "data-rotulo"?: string
      }
      const rotulo = rotulos[indice]

      indice += props.colSpan ?? 1

      // Célula que atravessa colunas é subtítulo de grupo, não campo.
      if (!rotulo || props.colSpan || props["data-rotulo"] !== undefined) {
        return celula
      }

      return React.cloneElement(celula, { "data-rotulo": rotulo } as Record<
        string,
        string
      >)
    })
  }

  const linhas = (corpo: React.ReactNode) =>
    React.Children.map(corpo, (linha) => {
      if (!React.isValidElement(linha) || linha.type !== TableRow) return linha

      const props = linha.props as { children?: React.ReactNode }

      return React.cloneElement(linha, undefined, celulas(props.children))
    })

  return React.Children.map(children, (filho) => {
    if (!React.isValidElement(filho) || filho.type !== TableBody) return filho

    const props = filho.props as { children?: React.ReactNode }

    return React.cloneElement(filho, undefined, linhas(props.children))
  })
}

function Table({ className, children, ...props }: React.ComponentProps<"table">) {
  const rotulos = React.useMemo(() => rotulosDoCabecalho(children), [children])

  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      >
        {comRotulos(children, rotulos)}
      </table>
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

/**
 * Montagem do PDF de romaneio — fonte ÚNICA do documento.
 *
 * Este arquivo é usado dos dois lados:
 *   - Edge Function (Deno), que importa `npm:pdf-lib`
 *   - Navegador, que importa `pdf-lib` pelo Vite
 *
 * Por isso ele não importa nada: a biblioteca entra por parâmetro. Duplicar o
 * layout nos dois runtimes garantiria que um dia o PDF gerado pelo servidor
 * ficaria diferente do baixado pela tela.
 */

export type BibliotecaPdf = typeof import('pdf-lib')

export interface ItemRomaneioPdf {
  descricao: string
  quantidade: number
  unidade: string
  /** Só no recebimento. */
  peso_kg?: number | null
  condicao: string
  /** Só na devolução: quanto havia entrado deste item. */
  recebido?: number
  justificativa?: string
}

export interface DadosRomaneioPdf {
  tipo: 'recebimento' | 'devolucao'
  numero: number
  data_hora: string
  empresa: { razao_social: string; cnpj: string }
  cliente: string
  /** Pares rótulo/valor do bloco de cabeçalho, variam por tipo. */
  detalhes: Array<{ rotulo: string; valor: string }>
  itens: ItemRomaneioPdf[]
  observacao: string
  assinatura: { nome: string; rotulo: string; imagemPng?: Uint8Array | null }
  /** URL que o QR code aponta — consulta pública do romaneio. */
  urlPublica: string
  /** Matriz do QR já calculada pelo chamador (cada lado tem seu gerador). */
  qr: boolean[][]
  rodape: string
}

const A4 = { largura: 595.28, altura: 841.89 }
const MARGEM = 48

function formatarCnpj(cnpj: string): string {
  const digitos = cnpj.replace(/\D/g, '')

  if (digitos.length !== 14) return cnpj

  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatarDataHora(iso: string): string {
  const data = new Date(iso)
  const dois = (valor: number) => String(valor).padStart(2, '0')

  return (
    `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()} ` +
    `${dois(data.getHours())}:${dois(data.getMinutes())}`
  )
}

function formatarNumero(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

/**
 * pdf-lib só embute WinAnsi nas fontes padrão. Caracteres fora dessa tabela
 * derrubam a geração — e "Portões" derrubaria o romaneio inteiro.
 */
function sanitizar(texto: string): string {
  return texto
    .normalize('NFC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^ -ÿ]/g, '?')
}

export async function montarPdfRomaneio(
  lib: BibliotecaPdf,
  dados: DadosRomaneioPdf,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = lib

  const doc = await PDFDocument.create()
  doc.setTitle(
    `Romaneio de ${dados.tipo === 'recebimento' ? 'recebimento' : 'devolucao'} ${dados.numero}`,
  )

  const pagina = doc.addPage([A4.largura, A4.altura])
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold)
  const mono = await doc.embedFont(StandardFonts.Courier)

  const tintaEscura = rgb(0.05, 0.17, 0.37)
  const tinta = rgb(0.1, 0.1, 0.18)
  const suave = rgb(0.29, 0.33, 0.41)
  const linha = rgb(0.84, 0.88, 0.92)

  let y = A4.altura - MARGEM

  const escrever = (
    texto: string,
    x: number,
    tamanho: number,
    fonte = regular,
    cor = tinta,
  ) => {
    pagina.drawText(sanitizar(texto), { x, y, size: tamanho, font: fonte, color: cor })
  }

  // --- cabeçalho -----------------------------------------------------------
  escrever(dados.empresa.razao_social, MARGEM, 13, negrito, tintaEscura)
  y -= 14
  escrever(`CNPJ ${formatarCnpj(dados.empresa.cnpj)}`, MARGEM, 9, mono, suave)

  y -= 26
  escrever(
    dados.tipo === 'recebimento'
      ? 'ROMANEIO DE RECEBIMENTO'
      : 'ROMANEIO DE DEVOLUCAO',
    MARGEM,
    16,
    negrito,
    tintaEscura,
  )
  y -= 18
  escrever(
    `No ${String(dados.numero).padStart(4, '0')}  ·  ${formatarDataHora(dados.data_hora)}`,
    MARGEM,
    10,
    mono,
    suave,
  )

  // --- QR code (canto superior direito) ------------------------------------
  const ladoQr = 96
  const xQr = A4.largura - MARGEM - ladoQr
  const yQr = A4.altura - MARGEM - ladoQr + 10
  const modulos = dados.qr.length

  if (modulos > 0) {
    const passo = ladoQr / modulos

    for (let linhaQr = 0; linhaQr < modulos; linhaQr += 1) {
      for (let coluna = 0; coluna < modulos; coluna += 1) {
        if (!dados.qr[linhaQr][coluna]) continue

        pagina.drawRectangle({
          x: xQr + coluna * passo,
          y: yQr + (modulos - 1 - linhaQr) * passo,
          width: passo,
          height: passo,
          color: rgb(0, 0, 0),
        })
      }
    }

    pagina.drawText(sanitizar('Consulta publica'), {
      x: xQr,
      y: yQr - 12,
      size: 7,
      font: regular,
      color: suave,
    })
  }

  // --- bloco de dados ------------------------------------------------------
  y -= 30
  pagina.drawLine({
    start: { x: MARGEM, y },
    end: { x: A4.largura - MARGEM, y },
    thickness: 1,
    color: linha,
  })

  y -= 20
  escrever('CLIENTE', MARGEM, 7, negrito, suave)
  y -= 12
  escrever(dados.cliente, MARGEM, 11, negrito, tintaEscura)

  y -= 20

  for (let indice = 0; indice < dados.detalhes.length; indice += 2) {
    const esquerda = dados.detalhes[indice]
    const direita = dados.detalhes[indice + 1]
    const meio = MARGEM + 260

    escrever(esquerda.rotulo.toUpperCase(), MARGEM, 7, negrito, suave)
    if (direita) escrever(direita.rotulo.toUpperCase(), meio, 7, negrito, suave)

    y -= 11
    escrever(esquerda.valor || '-', MARGEM, 10)
    if (direita) escrever(direita.valor || '-', meio, 10)

    y -= 18
  }

  // --- itens ---------------------------------------------------------------
  y -= 6
  escrever(`ITENS (${dados.itens.length})`, MARGEM, 8, negrito, suave)
  y -= 14

  const colunas =
    dados.tipo === 'recebimento'
      ? [
          { rotulo: 'Descricao', x: MARGEM, largura: 250 },
          { rotulo: 'Qtd.', x: MARGEM + 258, largura: 60 },
          { rotulo: 'Peso', x: MARGEM + 330, largura: 60 },
          { rotulo: 'Condicao', x: MARGEM + 400, largura: 100 },
        ]
      : [
          { rotulo: 'Descricao', x: MARGEM, largura: 230 },
          { rotulo: 'Recebido', x: MARGEM + 238, largura: 60 },
          { rotulo: 'Devolvido', x: MARGEM + 310, largura: 60 },
          { rotulo: 'Condicao', x: MARGEM + 390, largura: 110 },
        ]

  for (const coluna of colunas) {
    pagina.drawText(sanitizar(coluna.rotulo), {
      x: coluna.x,
      y,
      size: 8,
      font: negrito,
      color: suave,
    })
  }

  y -= 6
  pagina.drawLine({
    start: { x: MARGEM, y },
    end: { x: A4.largura - MARGEM, y },
    thickness: 0.5,
    color: linha,
  })
  y -= 14

  for (const item of dados.itens) {
    const descricao =
      item.descricao.length > 42 ? `${item.descricao.slice(0, 41)}...` : item.descricao

    pagina.drawText(sanitizar(descricao), {
      x: colunas[0].x,
      y,
      size: 9,
      font: regular,
      color: tinta,
    })

    const celulas =
      dados.tipo === 'recebimento'
        ? [
            `${formatarNumero(item.quantidade)} ${item.unidade}`,
            item.peso_kg ? `${formatarNumero(item.peso_kg)} kg` : '-',
            item.condicao,
          ]
        : [
            item.recebido === undefined ? '-' : formatarNumero(item.recebido),
            formatarNumero(item.quantidade),
            item.condicao,
          ]

    celulas.forEach((valor, indice) => {
      pagina.drawText(sanitizar(valor), {
        x: colunas[indice + 1].x,
        y,
        size: 9,
        font: regular,
        color: tinta,
      })
    })

    y -= 14

    if (item.justificativa) {
      pagina.drawText(sanitizar(`Justificativa: ${item.justificativa}`), {
        x: colunas[0].x + 8,
        y,
        size: 8,
        font: regular,
        color: suave,
      })
      y -= 13
    }

    // Quebra de página simples: o romaneio raramente passa de uma folha, mas
    // estourar o rodapé silenciosamente seria pior do que cortar aqui.
    if (y < 200) break
  }

  // --- observações ---------------------------------------------------------
  if (dados.observacao) {
    y -= 10
    escrever('OBSERVACOES', MARGEM, 7, negrito, suave)
    y -= 12

    const palavras = dados.observacao.split(' ')
    let atual = ''

    for (const palavra of palavras) {
      if ((atual + palavra).length > 95) {
        escrever(atual, MARGEM, 9)
        y -= 12
        atual = ''
      }

      atual += `${palavra} `
    }

    if (atual.trim()) {
      escrever(atual.trim(), MARGEM, 9)
      y -= 12
    }
  }

  // --- assinatura ----------------------------------------------------------
  const yAssinatura = 130

  if (dados.assinatura.imagemPng) {
    try {
      const imagem = await doc.embedPng(dados.assinatura.imagemPng)
      const escala = Math.min(200 / imagem.width, 56 / imagem.height)

      pagina.drawImage(imagem, {
        x: MARGEM,
        y: yAssinatura + 6,
        width: imagem.width * escala,
        height: imagem.height * escala,
      })
    } catch {
      // Assinatura ilegível não pode impedir a emissão do romaneio.
    }
  }

  pagina.drawLine({
    start: { x: MARGEM, y: yAssinatura },
    end: { x: MARGEM + 230, y: yAssinatura },
    thickness: 0.8,
    color: suave,
  })

  pagina.drawText(sanitizar(dados.assinatura.nome || '-'), {
    x: MARGEM,
    y: yAssinatura - 13,
    size: 9,
    font: negrito,
    color: tinta,
  })

  pagina.drawText(sanitizar(dados.assinatura.rotulo), {
    x: MARGEM,
    y: yAssinatura - 25,
    size: 8,
    font: regular,
    color: suave,
  })

  // --- rodapé --------------------------------------------------------------
  pagina.drawLine({
    start: { x: MARGEM, y: 76 },
    end: { x: A4.largura - MARGEM, y: 76 },
    thickness: 0.5,
    color: linha,
  })

  pagina.drawText(sanitizar(dados.rodape), {
    x: MARGEM,
    y: 62,
    size: 8,
    font: regular,
    color: suave,
  })

  pagina.drawText(sanitizar(dados.urlPublica), {
    x: MARGEM,
    y: 50,
    size: 7,
    font: mono,
    color: suave,
  })

  return doc.save()
}

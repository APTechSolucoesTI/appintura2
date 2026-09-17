import * as pdfLib from 'pdf-lib'
import qrcode from 'qrcode-generator'

import {
  montarPdfRomaneio,
  type DadosRomaneioPdf,
} from '../../supabase/functions/_appintura2-shared/romaneio-pdf'
import { formatDocumento, mascararTelefone } from '@/lib/documento'
import { formatDateTime } from '@/lib/format'
import { CONDICAO_LABEL, UNIDADE_ITEM_LABEL } from '@/types/custodia'
import type { Tenant } from '@/types/domain'

import { clientesStore, transportadorasStore } from './cadastros-service'
import { devolucoesStore, recebimentosStore } from './custodia-service'

/**
 * Geração do PDF de romaneio.
 *
 * Hoje o documento é montado NO NAVEGADOR, usando exatamente o mesmo builder da
 * Edge Function `gerar-pdf-romaneio` (importado de `supabase/functions/_appintura2-shared`).
 * Assim o botão funciona sem backend e, quando o Supabase entrar, basta trocar o
 * corpo destas funções por `supabase.functions.invoke(...)` — o PDF sai idêntico
 * porque o layout é o mesmo arquivo.
 */

function matrizQr(url: string): boolean[][] {
  // Tipo 0 = versão automática pelo tamanho do dado; correção 'M' aguenta
  // etiqueta suja de pó sem perder a leitura.
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()

  const modulos = qr.getModuleCount()

  return Array.from({ length: modulos }, (_, linha) =>
    Array.from({ length: modulos }, (_, coluna) => qr.isDark(linha, coluna)),
  )
}

/**
 * pdf-lib embute PNG e JPG. As assinaturas capturadas em tela são PNG; os
 * placeholders do seed são SVG e simplesmente não entram no documento.
 */
function pngDeDataUrl(dataUrl: string | null): Uint8Array | null {
  if (!dataUrl?.startsWith('data:image/png;base64,')) return null

  const base64 = dataUrl.slice('data:image/png;base64,'.length)
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)

  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice)
  }

  return bytes
}

function urlPublica(tipo: 'recebimento' | 'devolucao', id: string): string {
  return `${window.location.origin}/romaneio/${tipo}/${id}`
}

export async function gerarPdfRecebimento(
  tenant: Tenant,
  romaneioId: string,
): Promise<Blob> {
  const [romaneio, clientes, transportadoras] = await Promise.all([
    recebimentosStore.obter(tenant.id, romaneioId),
    clientesStore.listar(tenant.id),
    transportadorasStore.listar(tenant.id),
  ])

  const cliente = clientes.find((item) => item.id === romaneio.cliente_id)
  const transportadora = transportadoras.find(
    (item) => item.id === romaneio.transportadora_id,
  )

  const url = urlPublica('recebimento', romaneio.id)

  const dados: DadosRomaneioPdf = {
    tipo: 'recebimento',
    numero: romaneio.numero,
    data_hora: romaneio.data_hora,
    empresa: { razao_social: tenant.razao_social, cnpj: tenant.cnpj },
    cliente: cliente?.razao_social ?? 'Cliente removido',
    detalhes: [
      {
        rotulo: 'Documento do cliente',
        valor: `${romaneio.documento_numero}/${romaneio.documento_serie}`,
      },
      { rotulo: 'Transportadora', valor: transportadora?.nome ?? 'Veiculo do cliente' },
      { rotulo: 'Conferente', valor: romaneio.conferente_nome },
      {
        rotulo: 'CNPJ/CPF do cliente',
        valor: cliente ? formatDocumento(cliente.cnpj_cpf) : '-',
      },
      {
        rotulo: 'Contato',
        valor: cliente
          ? `${cliente.contato_nome} ${mascararTelefone(cliente.contato_telefone)}`
          : '-',
      },
      { rotulo: 'Chave de acesso', valor: romaneio.documento_chave || '-' },
    ],
    itens: romaneio.itens.map((item) => ({
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: UNIDADE_ITEM_LABEL[item.unidade],
      peso_kg: item.peso_kg,
      condicao: CONDICAO_LABEL[item.condicao_chegada],
      justificativa: item.observacao || undefined,
    })),
    observacao: romaneio.observacao,
    assinatura: {
      nome: romaneio.assinatura_nome,
      rotulo: 'Assinatura de quem entregou a mercadoria',
      imagemPng: pngDeDataUrl(romaneio.assinatura_url),
    },
    urlPublica: url,
    qr: matrizQr(url),
    rodape: `Emitido em ${formatDateTime(new Date())} pelo APPintura. Documento de custodia de mercadoria de terceiros.`,
  }

  const bytes = await montarPdfRomaneio(pdfLib, dados)

  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export async function gerarPdfDevolucao(
  tenant: Tenant,
  devolucaoId: string,
): Promise<Blob> {
  const [devolucao, recebimentos, clientes, transportadoras] = await Promise.all([
    devolucoesStore.obter(tenant.id, devolucaoId),
    recebimentosStore.listar(tenant.id),
    clientesStore.listar(tenant.id),
    transportadorasStore.listar(tenant.id),
  ])

  const cliente = clientes.find((item) => item.id === devolucao.cliente_id)
  const transportadora = transportadoras.find(
    (item) => item.id === devolucao.transportadora_id,
  )

  // Quantidade original de cada item, para o comparativo impresso.
  const recebidoPorItem = new Map<string, number>()

  for (const romaneio of recebimentos) {
    for (const item of romaneio.itens) {
      recebidoPorItem.set(item.id, item.quantidade)
    }
  }

  const numerosOrigem = devolucao.recebimento_ids
    .map((id) => recebimentos.find((item) => item.id === id))
    .filter((item) => item !== undefined)
    .map((item) => `#${String(item.numero).padStart(4, '0')}`)
    .join(', ')

  const url = urlPublica('devolucao', devolucao.id)

  const dados: DadosRomaneioPdf = {
    tipo: 'devolucao',
    numero: devolucao.numero,
    data_hora: devolucao.data_hora,
    empresa: { razao_social: tenant.razao_social, cnpj: tenant.cnpj },
    cliente: cliente?.razao_social ?? 'Cliente removido',
    detalhes: [
      { rotulo: 'Romaneios de entrada', valor: numerosOrigem || '-' },
      { rotulo: 'Retirado por', valor: devolucao.retirado_por_nome },
      {
        rotulo: 'Documento de quem retirou',
        valor: devolucao.retirado_por_documento
          ? formatDocumento(devolucao.retirado_por_documento)
          : '-',
      },
      { rotulo: 'Transportadora', valor: transportadora?.nome ?? 'Veiculo do cliente' },
      { rotulo: 'Placa', valor: devolucao.placa || '-' },
      { rotulo: 'Responsavel na empresa', valor: devolucao.responsavel_nome },
    ],
    itens: devolucao.itens.map((item) => ({
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: UNIDADE_ITEM_LABEL[item.unidade],
      recebido: recebidoPorItem.get(item.recebimento_item_id),
      condicao: CONDICAO_LABEL[item.condicao_saida],
      justificativa: item.justificativa || undefined,
    })),
    observacao: '',
    assinatura: {
      nome: devolucao.retirado_por_nome,
      rotulo: 'Assinatura de quem retirou a mercadoria',
      imagemPng: pngDeDataUrl(devolucao.assinatura_url),
    },
    urlPublica: url,
    qr: matrizQr(url),
    rodape: `Emitido em ${formatDateTime(new Date())} pelo APPintura. Comprovante de devolucao de mercadoria em custodia.`,
  }

  const bytes = await montarPdfRomaneio(pdfLib, dados)

  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** Dispara o download no navegador. */
export function baixarPdf(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = nomeArquivo
  document.body.append(link)
  link.click()
  link.remove()

  // Sem o revoke, cada geração segura o blob na memória até o reload.
  URL.revokeObjectURL(url)
}

/**
 * Edge Function: gerar-pdf-romaneio (Fase 7)
 *
 * Recebe `{ tipo, romaneio_id }`, busca os dados server-side respeitando RLS e
 * devolve o PDF como download.
 *
 * Bibliotecas escolhidas por serem JS puro, sem nenhuma API exclusiva de Node:
 *   - pdf-lib: monta o documento
 *   - qrcode-generator: devolve a matriz do QR; os quadrados são desenhados
 *     como retângulos no próprio PDF, então não há canvas nem DOM envolvidos.
 *
 * O layout NÃO vive aqui: vem de `_shared/romaneio-pdf.ts`, o mesmo arquivo que
 * o navegador usa. Duplicar o desenho garantiria que um dia o PDF do servidor
 * ficaria diferente do baixado pela tela.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as pdfLib from 'npm:pdf-lib@1.17.1'
import qrcode from 'npm:qrcode-generator@2.0.4'

import {
  montarPdfRomaneio,
  type DadosRomaneioPdf,
  type ItemRomaneioPdf,
} from '../_shared/romaneio-pdf.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CONDICAO_LABEL: Record<string, string> = {
  integra: 'Integra',
  avariada: 'Avariada',
  com_observacao: 'Com observacao',
}

const UNIDADE_LABEL: Record<string, string> = {
  peca: 'peca(s)',
  kg: 'kg',
  m2: 'm2',
  conjunto: 'conjunto(s)',
}

function erro(mensagem: string, status: number): Response {
  return new Response(JSON.stringify({ erro: mensagem }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function matrizQr(url: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()

  const modulos = qr.getModuleCount()

  return Array.from({ length: modulos }, (_, linha) =>
    Array.from({ length: modulos }, (_, coluna) => qr.isDark(linha, coluna)),
  )
}

/** Baixa a assinatura do bucket privado. PNG entra no PDF; o resto é ignorado. */
async function baixarAssinatura(
  supabase: ReturnType<typeof createClient>,
  caminho: string | null,
): Promise<Uint8Array | null> {
  if (!caminho || !caminho.toLowerCase().endsWith('.png')) return null

  const { data, error } = await supabase.storage
    .from('romaneios-fotos')
    .download(caminho)

  if (error || !data) return null

  return new Uint8Array(await data.arrayBuffer())
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return erro('Método não permitido.', 405)

  const authorization = req.headers.get('Authorization')

  if (!authorization) return erro('Não autenticado.', 401)

  const corpo = (await req.json().catch(() => null)) as {
    tipo?: string
    romaneio_id?: string
  } | null

  if (
    !corpo?.romaneio_id ||
    (corpo.tipo !== 'recebimento' && corpo.tipo !== 'devolucao')
  ) {
    return erro('Informe tipo (recebimento|devolucao) e romaneio_id.', 400)
  }

  // Cliente com o JWT do chamador: a RLS dos romaneios decide o que ele enxerga.
  // Usar service_role aqui deixaria qualquer usuário baixar o romaneio de
  // qualquer empresa só trocando o id na chamada.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  )

  const publicUrl = Deno.env.get('APP_PUBLIC_URL') ?? ''
  const url = `${publicUrl}/romaneio/${corpo.tipo}/${corpo.romaneio_id}`

  let dados: DadosRomaneioPdf

  if (corpo.tipo === 'recebimento') {
    const { data, error } = await supabase
      .from('romaneios_recebimento')
      .select(
        `numero, data_hora, documento_numero, documento_serie, documento_chave,
         observacao, assinatura_nome, assinatura_path,
         tenants ( razao_social, cnpj ),
         clientes ( razao_social, cnpj_cpf, contato_nome, contato_telefone ),
         transportadoras ( nome ),
         romaneio_recebimento_itens ( descricao, quantidade, unidade, peso_kg,
                                      condicao_chegada, observacao )`,
      )
      .eq('id', corpo.romaneio_id)
      .maybeSingle()

    if (error) return erro('Falha ao carregar o romaneio.', 500)
    if (!data) return erro('Romaneio não encontrado.', 404)

    const registro = data as Record<string, never> & {
      numero: number
      data_hora: string
      documento_numero: string
      documento_serie: string
      documento_chave: string
      observacao: string
      assinatura_nome: string
      assinatura_path: string | null
      tenants: { razao_social: string; cnpj: string }
      clientes: {
        razao_social: string
        cnpj_cpf: string
        contato_nome: string
        contato_telefone: string
      }
      transportadoras: { nome: string } | null
      romaneio_recebimento_itens: Array<{
        descricao: string
        quantidade: number
        unidade: string
        peso_kg: number | null
        condicao_chegada: string
        observacao: string
      }>
    }

    const itens: ItemRomaneioPdf[] = registro.romaneio_recebimento_itens.map((item) => ({
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: UNIDADE_LABEL[item.unidade] ?? item.unidade,
      peso_kg: item.peso_kg,
      condicao: CONDICAO_LABEL[item.condicao_chegada] ?? item.condicao_chegada,
      justificativa: item.observacao || undefined,
    }))

    dados = {
      tipo: 'recebimento',
      numero: registro.numero,
      data_hora: registro.data_hora,
      empresa: registro.tenants,
      cliente: registro.clientes.razao_social,
      detalhes: [
        {
          rotulo: 'Documento do cliente',
          valor: `${registro.documento_numero}/${registro.documento_serie}`,
        },
        {
          rotulo: 'Transportadora',
          valor: registro.transportadoras?.nome ?? 'Veiculo do cliente',
        },
        { rotulo: 'CNPJ/CPF do cliente', valor: registro.clientes.cnpj_cpf },
        {
          rotulo: 'Contato',
          valor: `${registro.clientes.contato_nome} ${registro.clientes.contato_telefone}`,
        },
        { rotulo: 'Chave de acesso', valor: registro.documento_chave || '-' },
      ],
      itens,
      observacao: registro.observacao,
      assinatura: {
        nome: registro.assinatura_nome,
        rotulo: 'Assinatura de quem entregou a mercadoria',
        imagemPng: await baixarAssinatura(supabase, registro.assinatura_path),
      },
      urlPublica: url,
      qr: matrizQr(url),
      rodape:
        'Emitido pelo APPintura. Documento de custodia de mercadoria de terceiros.',
    }
  } else {
    const { data, error } = await supabase
      .from('romaneios_devolucao')
      .select(
        `numero, data_hora, retirado_por_nome, retirado_por_documento, placa,
         assinatura_path,
         tenants ( razao_social, cnpj ),
         clientes ( razao_social ),
         transportadoras ( nome ),
         romaneio_devolucao_itens ( quantidade, condicao_saida, justificativa,
           romaneio_recebimento_itens ( descricao, quantidade, unidade ) )`,
      )
      .eq('id', corpo.romaneio_id)
      .maybeSingle()

    if (error) return erro('Falha ao carregar o romaneio.', 500)
    if (!data) return erro('Romaneio não encontrado.', 404)

    const registro = data as Record<string, never> & {
      numero: number
      data_hora: string
      retirado_por_nome: string
      retirado_por_documento: string
      placa: string
      assinatura_path: string | null
      tenants: { razao_social: string; cnpj: string }
      clientes: { razao_social: string }
      transportadoras: { nome: string } | null
      romaneio_devolucao_itens: Array<{
        quantidade: number
        condicao_saida: string
        justificativa: string
        romaneio_recebimento_itens: {
          descricao: string
          quantidade: number
          unidade: string
        }
      }>
    }

    const itens: ItemRomaneioPdf[] = registro.romaneio_devolucao_itens.map((item) => ({
      descricao: item.romaneio_recebimento_itens.descricao,
      quantidade: item.quantidade,
      unidade:
        UNIDADE_LABEL[item.romaneio_recebimento_itens.unidade] ??
        item.romaneio_recebimento_itens.unidade,
      recebido: item.romaneio_recebimento_itens.quantidade,
      condicao: CONDICAO_LABEL[item.condicao_saida] ?? item.condicao_saida,
      justificativa: item.justificativa || undefined,
    }))

    dados = {
      tipo: 'devolucao',
      numero: registro.numero,
      data_hora: registro.data_hora,
      empresa: registro.tenants,
      cliente: registro.clientes.razao_social,
      detalhes: [
        { rotulo: 'Retirado por', valor: registro.retirado_por_nome },
        {
          rotulo: 'Documento de quem retirou',
          valor: registro.retirado_por_documento || '-',
        },
        {
          rotulo: 'Transportadora',
          valor: registro.transportadoras?.nome ?? 'Veiculo do cliente',
        },
        { rotulo: 'Placa', valor: registro.placa || '-' },
      ],
      itens,
      observacao: '',
      assinatura: {
        nome: registro.retirado_por_nome,
        rotulo: 'Assinatura de quem retirou a mercadoria',
        imagemPng: await baixarAssinatura(supabase, registro.assinatura_path),
      },
      urlPublica: url,
      qr: matrizQr(url),
      rodape:
        'Emitido pelo APPintura. Comprovante de devolucao de mercadoria em custodia.',
    }
  }

  const pdf = await montarPdfRomaneio(pdfLib, dados)
  const nome = `romaneio-${corpo.tipo}-${String(dados.numero).padStart(4, '0')}.pdf`

  /*
   * Stream de download direto. A alternativa — salvar no Storage e devolver
   * signed URL — só compensa quando o mesmo PDF é baixado várias vezes; aqui o
   * documento é gerado no ato da conferência e impresso na hora, então guardar
   * arquivo só acumularia lixo no bucket.
   */
  return new Response(pdf, {
    headers: {
      ...CORS,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nome}"`,
    },
  })
})

import { supabase } from './supabase'

/**
 * Upload das provas de custódia (fotos de conferência e assinatura).
 *
 * As telas capturam em canvas e produzem data URL. O banco guarda CAMINHO no
 * bucket, não a imagem — uma foto de 800 KB em base64 dentro de uma coluna de
 * texto incharia cada listagem de romaneio em megabytes.
 *
 * O caminho é `{tenant_id}/{romaneio_id}/{arquivo}` porque a policy de Storage
 * da Fase 2 compara exatamente a primeira pasta com os tenants do usuário. Por
 * isso o `tenantId` aqui NUNCA pode vir do formulário.
 */

export const BUCKET_ROMANEIOS = 'appintura2-romaneios-fotos'

export class UploadError extends Error {}

/** Data URL -> Blob, sem passar por fetch() (que falha em alguns WebViews de tablet). */
function blobDeDataUrl(dataUrl: string): { blob: Blob; extensao: string } {
  const casa = /^data:(image\/(png|jpeg|webp));base64,(.*)$/s.exec(dataUrl)

  if (!casa) throw new UploadError('Formato de imagem não suportado.')

  const [, mime, tipo, base64] = casa
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)

  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)

  return { blob: new Blob([bytes], { type: mime }), extensao: tipo === 'jpeg' ? 'jpg' : tipo }
}

/**
 * Sobe uma imagem e devolve o caminho gravado.
 *
 * `upsert: false` de propósito: nome de arquivo colidindo deve dar erro, não
 * sobrescrever em silêncio a foto de outra conferência.
 */
export async function subirImagem(
  tenantId: string,
  romaneioId: string,
  dataUrl: string,
  prefixo: string,
): Promise<string> {
  const { blob, extensao } = blobDeDataUrl(dataUrl)
  const caminho = `${tenantId}/${romaneioId}/${prefixo}-${crypto.randomUUID()}.${extensao}`

  const { error } = await supabase.storage
    .from(BUCKET_ROMANEIOS)
    .upload(caminho, blob, { contentType: blob.type, upsert: false })

  if (error) throw new UploadError(`Não foi possível enviar a imagem: ${error.message}`)

  return caminho
}

/**
 * URL temporária para exibir uma imagem privada.
 *
 * O bucket não é público: sem isto o `<img>` receberia 400. A validade curta é
 * o ponto — o link some do lado do cliente antes de poder ser repassado.
 */
export async function urlAssinada(caminho: string, segundos = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_ROMANEIOS)
    .createSignedUrl(caminho, segundos)

  if (error) return null

  return data.signedUrl
}

/** Sobe várias de uma vez, preservando a ordem em que foram capturadas. */
export async function subirImagens(
  tenantId: string,
  romaneioId: string,
  dataUrls: string[],
  prefixo: string,
): Promise<string[]> {
  return await Promise.all(
    dataUrls.map((dataUrl) => subirImagem(tenantId, romaneioId, dataUrl, prefixo)),
  )
}

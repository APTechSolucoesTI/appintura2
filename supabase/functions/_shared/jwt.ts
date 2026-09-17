/**
 * JWT HS256 — assinatura e verificação.
 *
 * O APPintura não usa o GoTrue (ver cabeçalho da migration da Fase 0), então o
 * token de sessão é emitido aqui. O formato NÃO é livre: precisa ser aceito
 * pelo PostgREST, que valida assinatura e `exp` com o segredo do Supabase antes
 * de deixar a requisição chegar no banco.
 *
 * Dois claims são obrigatórios:
 *   role = 'authenticated'  -> é por ele que o PostgREST troca de papel; sem
 *                              isso a requisição roda como `anon` e as policies
 *                              barram tudo.
 *   sub  = usuarios.id      -> é o que `appintura2.usuario_atual()` lê.
 *
 * O segredo é o MESMO do resto do Supabase. Não há como usar outro: quem
 * confere a assinatura é o PostgREST, não nós.
 */

const encoder = new TextEncoder()

export interface ClaimsSessao {
  sub: string
  email: string
  nome: string
  role: 'authenticated'
  iat: number
  exp: number
}

function base64url(bytes: Uint8Array): string {
  let bruto = ''
  for (const byte of bytes) bruto += String.fromCharCode(byte)
  return btoa(bruto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlTexto(texto: string): string {
  return base64url(encoder.encode(texto))
}

function decodificarBase64url(valor: string): Uint8Array {
  const preenchido = valor.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(valor.length + ((4 - (valor.length % 4)) % 4), '=')
  const bruto = atob(preenchido)
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0))
}

async function chave(segredo: string, uso: 'sign' | 'verify'): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [uso],
  )
}

export async function assinarToken(
  dados: { sub: string; email: string; nome: string },
  segredo: string,
  duracaoSegundos: number,
): Promise<{ token: string; expiraEm: number }> {
  const agora = Math.floor(Date.now() / 1000)
  const claims: ClaimsSessao = {
    sub: dados.sub,
    email: dados.email,
    nome: dados.nome,
    role: 'authenticated',
    iat: agora,
    exp: agora + duracaoSegundos,
  }

  const cabecalho = base64urlTexto(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const corpo = base64urlTexto(JSON.stringify(claims))
  const conteudo = `${cabecalho}.${corpo}`

  const assinatura = await crypto.subtle.sign(
    'HMAC',
    await chave(segredo, 'sign'),
    encoder.encode(conteudo),
  )

  return {
    token: `${conteudo}.${base64url(new Uint8Array(assinatura))}`,
    expiraEm: claims.exp,
  }
}

/**
 * Devolve os claims ou `null`. Nunca lança: entrada malformada é caso comum
 * (token truncado, header ausente), não excepcional.
 *
 * `crypto.subtle.verify` compara em tempo constante — é o motivo de não fazer
 * a conferência na mão com `===`.
 */
export async function verificarToken(
  token: string,
  segredo: string,
): Promise<ClaimsSessao | null> {
  const partes = token.split('.')
  if (partes.length !== 3) return null

  const [cabecalho, corpo, assinatura] = partes

  try {
    const confere = await crypto.subtle.verify(
      'HMAC',
      await chave(segredo, 'verify'),
      decodificarBase64url(assinatura),
      encoder.encode(`${cabecalho}.${corpo}`),
    )
    if (!confere) return null

    const claims = JSON.parse(
      new TextDecoder().decode(decodificarBase64url(corpo)),
    ) as ClaimsSessao

    // A assinatura válida não diz nada sobre validade no tempo.
    if (typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000)) {
      return null
    }
    if (typeof claims.sub !== 'string' || claims.role !== 'authenticated') return null

    return claims
  } catch {
    return null
  }
}

/**
 * Lê o segredo do ambiente, falhando alto se não estiver configurado.
 *
 * `JWT_SECRET` já vem preenchido no edge-runtime do Supabase self-hosted — é o
 * mesmo segredo que o PostgREST usa para validar a assinatura, então não há
 * nada a configurar no servidor. As outras duas chaves existem para ambientes
 * onde ele não é injetado (Supabase Cloud, `supabase start` local).
 */
export function segredoJwt(): string {
  const segredo = Deno.env.get('JWT_SECRET') ??
    Deno.env.get('APPINTURA_JWT_SECRET') ??
    Deno.env.get('SUPABASE_JWT_SECRET')

  if (!segredo) {
    // Sem segredo não há login possível; degradar silenciosamente aqui viraria
    // um 500 obscuro lá na frente.
    throw new Error('APPINTURA_JWT_SECRET não configurado.')
  }

  return segredo
}

export function tokenDoHeader(authorization: string | null): string | null {
  if (!authorization) return null
  const [tipo, valor] = authorization.split(' ')
  if (tipo?.toLowerCase() !== 'bearer' || !valor) return null
  return valor
}

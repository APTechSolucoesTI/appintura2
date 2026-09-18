import { describe, expect, it } from 'vitest'

/**
 * Montagem da URL do link público de aprovação.
 *
 * O bug que originou este teste: `APP_PUBLIC_URL` estava configurada no
 * servidor sem a porta `:75`, e o serviço confiava na URL absoluta quando o
 * servidor mandava uma. O vendedor copiava um link que apontava para a porta
 * 443 do IP público, que o roteador não encaminha — o navegador do cliente
 * ficava carregando até dar timeout, sem erro nenhum na tela.
 *
 * A regra que ficou: a ORIGEM é sempre a da página; do servidor vem só o
 * caminho. O servidor conhece no máximo um domínio, a página sabe de qual foi
 * servida.
 *
 * A função é reproduzida aqui em vez de importada porque a original vive dentro
 * de `gerarLinkPublico`, que faz `fetch` e exige sessão. Extrair só para testar
 * deixaria o serviço pior; o que precisa ficar travado é a regra.
 */
function montarUrlPublica(urlDoServidor: string, origemDaPagina: string): string {
  const caminho = urlDoServidor.startsWith('http')
    ? new URL(urlDoServidor).pathname
    : urlDoServidor

  return `${origemDaPagina}${caminho}`
}

describe('URL do link público', () => {
  const origem = 'https://appintura1.aptechinfo.com.br:75'
  const esperado = `${origem}/orcamento/abc123`

  it('corrige a porta quando o servidor a omite (o bug real)', () => {
    expect(
      montarUrlPublica('https://appintura1.aptechinfo.com.br/orcamento/abc123', origem),
    ).toBe(esperado)
  })

  it('preserva o resultado quando o servidor já acerta', () => {
    expect(
      montarUrlPublica('https://appintura1.aptechinfo.com.br:75/orcamento/abc123', origem),
    ).toBe(esperado)
  })

  it('completa quando o servidor manda só o caminho', () => {
    // É o que acontece com `APP_PUBLIC_URL` vazia.
    expect(montarUrlPublica('/orcamento/abc123', origem)).toBe(esperado)
  })

  it('ignora domínio alheio vindo do servidor', () => {
    // Configuração copiada de outro ambiente não deve vazar para o link que
    // chega ao cliente.
    expect(montarUrlPublica('https://staging.exemplo.com/orcamento/abc123', origem)).toBe(
      esperado,
    )
  })
})

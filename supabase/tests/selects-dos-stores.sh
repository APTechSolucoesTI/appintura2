#!/usr/bin/env bash
#
# Exercita o SELECT de cada store contra o PostgREST real.
#
# Existe por causa de um bug que passou por tudo: o store de custódia pedia
# `fotos:romaneio_fotos(*)` no nível do romaneio, mas a FK vai para o ITEM. O
# PostgREST respondia 400 (PGRST200), a listagem morria, e o painel inicial
# ficava EM BRANCO — porque ele espera o saldo de custódia dentro de um
# `Promise.all`, e um rejeitado derruba os outros seis.
#
# Nem a suíte SQL nem os testes de interface pegariam isso: a primeira não fala
# PostgREST, e os segundos não fazem rede. É um erro que só existe na fronteira
# entre o select escrito no TypeScript e as FKs que existem no banco.
#
# Uso:
#   EMAIL=... SENHA=... bash supabase/tests/selects-dos-stores.sh
#
# Sai com 1 se qualquer select falhar — serve como gate de deploy.

set -uo pipefail

URL=${SUPABASE_URL:-https://supabase.aptechinfo.com.br:75}
ANON=${ANON_KEY:-$(grep -m1 '^ANON_KEY=' /opt/supabase/supabase-project/.env 2>/dev/null | cut -d= -f2)}
EMAIL=${EMAIL:?defina EMAIL}
SENHA=${SENHA:?defina SENHA}

TOKEN=$(curl -s -X POST "$URL/functions/v1/appintura2-sessao-login" \
  -H 'Content-Type: application/json' -H "apikey: $ANON" \
  -d "{\"email\":\"$EMAIL\",\"senha\":\"$SENHA\"}" |
  grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "FALHA: login nao devolveu token"
  exit 1
fi

H=(-H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H "Accept-Profile: appintura2")
falhas=0

# Cada linha é o `select` que está em `src/services/*.ts`. Ao mudar um select
# lá, mude aqui — é isso que mantém o teste honesto.
verifica() {
  local nome="$1" recurso="$2"
  local r code
  r=$(curl -s -w '|%{http_code}' "${H[@]}" "$URL/rest/v1/$recurso")
  code="${r##*|}"

  if [ "$code" = 200 ]; then
    printf "  PASS | %-22s\n" "$nome"
  else
    printf "  FAIL | %-22s HTTP %s\n         %s\n" "$nome" "$code" "$(echo "${r%|*}" | head -c 200)"
    falhas=$((falhas + 1))
  fi
}

echo "selects dos stores, contra o PostgREST real:"
verifica clientes        'clientes?select=*&limit=1'
verifica tabelasPreco    'tabelas_preco?select=*,itens:tabela_preco_itens(*)&limit=1'
verifica cores           'cores?select=*&limit=1'
verifica insumos         'insumos_quimicos?select=*&limit=1'
verifica transportadoras 'transportadoras?select=*&limit=1'
verifica recebimentos    'romaneios_recebimento?select=*,itens:romaneio_recebimento_itens(*,fotos:romaneio_fotos(*))&limit=1'
verifica devolucoes      'romaneios_devolucao?select=*,itens:romaneio_devolucao_itens(*,fotos:romaneio_fotos(*))&limit=1'
verifica ordensServico   'ordens_servico?select=*,itens:os_itens(*),historico:os_status_historico(*)&limit=1'
verifica movimentacoes   'estoque_movimentacoes?select=*&limit=1'
verifica qualidade       'qualidade_registros?select=*&limit=1'
verifica naoConformidade 'nao_conformidades?select=*&limit=1'
verifica centrosCusto    'centros_custo?select=*&limit=1'
verifica contasReceber   'contas_receber?select=*,pagamentos:contas_receber_pagamentos(*),cobrancas:contas_receber_cobranca_historico(*)&limit=1'
verifica contasPagar     'contas_pagar?select=*&limit=1'
verifica notificacoes    'notificacoes?select=*&limit=1'
verifica orcamentos      'orcamentos?select=*,itens:orcamento_itens(*),anexos:orcamento_anexos(*)&limit=1'
verifica orcamentoDetalhe 'orcamentos?select=*,itens:orcamento_itens(*),anexos:orcamento_anexos(*),eventos:orcamento_eventos(*)&limit=1'
verifica orcamentoLinks  'orcamento_links?select=id,orcamento_id,expira_em,usado_em,revogado,created_at&limit=1'
verifica equipe          'user_roles?select=id,role,status,created_at,usuario:usuarios(nome,email)&limit=1'
verifica vinculos        'user_roles?select=role,status,tenant:tenants(*)&limit=1'
verifica funil           'vw_funil_orcamentos?select=*&limit=1'
verifica motivosRecusa   'vw_motivos_recusa?select=*&limit=1'
verifica checklistDevol  'vw_checklist_devolucao?select=*&limit=1'
verifica saldoCustodia   'saldo_custodia?select=*&limit=1'
verifica contasSaldo     'vw_contas_receber_saldo?select=*&limit=1'
verifica inadimplencia   'vw_clientes_inadimplencia?select=*&limit=1'
verifica slaOs           'vw_sla_os?select=*&limit=1'
verifica osCabine        'vw_os_cabine?select=*&limit=1'

echo
echo "  falhas: $falhas"
[ "$falhas" -eq 0 ] || exit 1

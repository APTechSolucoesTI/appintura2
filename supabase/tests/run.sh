#!/usr/bin/env bash
#
# Roda a suíte de testes do APPintura2 e resume o resultado.
#
# Uso:
#   bash supabase/tests/run.sh                    # via psql local
#   PSQL="docker exec -i supabase-db psql -U postgres -d postgres" \
#     bash supabase/tests/run.sh                  # via container
#
# Sai com código 1 se qualquer asserção falhar — serve como gate de deploy.

set -uo pipefail

PSQL=${PSQL:-"psql -v ON_ERROR_STOP=1"}
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

total=0
falhas=0
erros=0

for arquivo in "$DIR"/*.sql; do
  nome=$(basename "$arquivo")
  echo ""
  echo "──────── $nome ────────"

  # `PGCLIENTENCODING` explícito: os testes têm acento, e o default do
  # container é C, o que corrompe as mensagens.
  saida=$(PGCLIENTENCODING=UTF8 $PSQL -f - < "$arquivo" 2>&1)

  echo "$saida" | grep -E "PASS|FAIL|INFO|ERROR" | sed 's/^NOTICE:  //' | sed 's/^ //'

  total=$(( total + $(echo "$saida" | grep -c -E "PASS|FAIL") ))
  falhas=$(( falhas + $(echo "$saida" | grep -c "FAIL") ))
  erros=$(( erros + $(echo "$saida" | grep -c "^psql.*ERROR") ))
done

echo ""
echo "════════════════════════════════════"
echo "  asserções: $total | falhas: $falhas | erros de execução: $erros"
echo "════════════════════════════════════"

# Um ERROR do Postgres aborta o arquivo no meio, então ele conta tanto quanto
# um FAIL: o resto daquele arquivo nem chegou a rodar.
if [ "$falhas" -gt 0 ] || [ "$erros" -gt 0 ]; then
  exit 1
fi

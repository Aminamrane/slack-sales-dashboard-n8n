#!/usr/bin/env bash
# Scan de secrets des commits apportés par un push ou une PR (audit sécurité du 18/10/2026).
# BASE : commit de départ (base de la PR ou état avant le push) ; HEAD_SHA : commit d'arrivée.
# BASE vide, nul (nouvelle branche) ou absent : départ = point de rencontre avec origin/main.
set -euo pipefail
GITLEAKS=${GITLEAKS:-gitleaks}
HEAD_SHA=${HEAD_SHA:-$(git rev-parse HEAD)}
BASE=${BASE:-}
if [ -z "$BASE" ] || [ "$BASE" = "0000000000000000000000000000000000000000" ] || ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
  BASE=$(git merge-base origin/main "$HEAD_SHA" 2>/dev/null || true)
fi
if [ -n "$BASE" ]; then BASE=$(git rev-parse "$BASE^{commit}"); fi
if [ -z "$BASE" ] || [ "$(git rev-list --count "$BASE..$HEAD_SHA")" = "0" ]; then
  echo "gitleaks : aucun nouveau commit à lire"
  exit 0
fi
echo "gitleaks : $(git rev-list --count "$BASE..$HEAD_SHA") commit(s) lus, ${BASE:0:7}..${HEAD_SHA:0:7}"
mkdir -p reports
"$GITLEAKS" git . --config .gitleaks.toml --redact --no-banner --log-opts="$BASE..$HEAD_SHA" \
  --report-format json --report-path reports/secrets-commits.json

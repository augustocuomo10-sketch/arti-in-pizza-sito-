#!/bin/sh
# Unisce worker/src/*.js in worker-completo.js, il file unico da incollare
# nell'editor Cloudflare. L'editor non gestisce i moduli, quindi qui togliamo
# import ed export: dentro un solo file le funzioni si vedono gia' fra loro.
#
# Uso:  sh worker/costruisci.sh
set -e
cd "$(dirname "$0")"

# "export default" resta: e' cosi' che il Worker dichiara il suo punto d'ingresso.
spoglia() {
  sed -E 's/^import .*$//; s/^export (const|function|class|async function)/\1/; s/^export \{.*\}.*$//' "$1"
}

{
  echo "// ============================================================================"
  echo "// API ordini Arti in Pizza — Worker unico, generato da worker/src/*.js"
  echo "// Non modificare qui: cambia i file in worker/src/ e rilancia costruisci.sh"
  echo "// ============================================================================"
  echo ""
  for f in src/catalogo.js src/verifiche.js src/zona.js src/push.js src/avvisi.js src/index.js; do
    echo "// ----------------------------------------------------------------- $f"
    spoglia "$f"
    echo ""
  done
} > worker-completo.js

# controllo di sicurezza: nel file unico non deve restare traccia di moduli
if grep -nE '^\s*import |^\s*export (const|function|class|async|\{)' worker-completo.js; then
  echo "ATTENZIONE: sono rimasti import/export nel file generato." >&2
  exit 1
fi

echo "worker-completo.js rigenerato: $(wc -l < worker-completo.js) righe"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "== tars help =="
node bin/install.mjs help | grep -q "TARS"

echo "== tars use --continue =="
node bin/install.mjs --use --continue --no-launch 2>/dev/null | grep -q "chief of staff"

echo "== tars doctor (json) =="
node bin/install.mjs doctor --json | grep -q '"score"'

echo "== tars demo =="
node bin/install.mjs demo | grep -q "ACME"

echo "== tars export --chatgpt =="
node bin/install.mjs export --chatgpt | grep -q "ChatGPT"

echo "== indexer query perf =="
FIX="$ROOT/tests/fixtures/work-corpus"
node skills/chief-of-staff/scripts/indexer.mjs build --root "$FIX" --json >/dev/null
MS=$(node skills/chief-of-staff/scripts/indexer.mjs query "ACME numbers" --root "$FIX" --json | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ms)})")
test "$MS" -lt 500

echo "== npm run package =="
npm run package --silent | grep -q "MANIFEST"

echo "All CLI tests passed."

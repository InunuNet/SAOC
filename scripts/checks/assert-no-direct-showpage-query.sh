#!/usr/bin/env bash
# assert-no-direct-showpage-query.sh — A16 (national-show-ia-alignment, M1).
#
# No file under app/ may contain the GROQ type literal for showPage. Every page
# template must read through lib/data/show-pages.ts's loadShowPage()/loadAllShowPages().
# This is a CI guard, not a type guarantee — a sufficiently different query shape (e.g.
# string-built at runtime) evades it. See provenance-gate.golden.md, limitation 2.
#
# Scans .js/.jsx too, not just .ts/.tsx — this project has none of the former today,
# but a guard that only fires on one file-extension family is not a guard (Codex's
# cross-model review, second pass).
set -euo pipefail

MATCHES=$(grep -rEln '_type\s*==\s*["'"'"']showPage["'"'"']' app/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' 2>/dev/null || true)

if [ -n "$MATCHES" ]; then
  echo "A16 FAIL: direct GROQ query against showPage found outside lib/data/show-pages.ts:" >&2
  echo "$MATCHES" >&2
  exit 1
fi

exit 0

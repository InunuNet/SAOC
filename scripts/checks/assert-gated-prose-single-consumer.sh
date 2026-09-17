#!/usr/bin/env bash
# assert-gated-prose-single-consumer.sh — grep-based CI guard, sibling to
# assert-no-direct-showpage-query.sh (A16). Enforces the showPage provenance gate's
# unwrap boundary as a second, independent layer alongside eslint.config.mjs's
# `no-restricted-imports` block — neither trusts the other.
#
# Only components/nos/ShowPageProse.tsx (renders a GatedProse value) and
# lib/data/show-pages.ts (constructs one, via the wrap side, never re-exported) may
# import components/nos/gated-prose-internal.ts. QA's cross-model review found the
# previous shape of this boundary — a plainly exported unwrap function — could be
# imported and called from any new file with no error at all; this guard, plus the
# eslint rule, is what makes that a real, fail-loud violation instead of an unenforced
# comment.
set -euo pipefail

ALLOWED_FILES="components/nos/ShowPageProse.tsx
lib/data/show-pages.ts"

# scripts/checks/fixtures/gated-prose-bypass-attempt.tsx.txt is a COMMITTED regression
# fixture (A47/G12) — a verbatim copy of QA's bypass probe, saved as .tsx.txt so it is
# never compiled as project source. It targets the pre-refactor export name
# (__unsafeUnwrapGatedProse from lib/data/show-pages), not this module, so it does not
# match this grep at all; nothing to exclude here. G12 checks it separately, by static
# inspection against the real module's current exports.
# scripts/checks/verify-show-page-m1.ts itself is excluded too — it discusses this
# boundary in prose (including this very rule's rationale) without importing it, same
# as it excludes itself from its own equivalent in-process scan (see
# VERIFIER_SELF_REL_PATH there).
MATCHES=$(grep -rl 'gated-prose-internal' app/ components/ lib/ scripts/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' 2>/dev/null \
  | grep -v -F "components/nos/gated-prose-internal.ts" \
  | grep -v -F "scripts/checks/verify-show-page-m1.ts" || true)

VIOLATIONS=""
while IFS= read -r match; do
  [ -z "$match" ] && continue
  if ! grep -qxF "$match" <<< "$ALLOWED_FILES"; then
    VIOLATIONS="${VIOLATIONS}${match}"$'\n'
  fi
done <<< "$MATCHES"

if [ -n "$VIOLATIONS" ]; then
  echo "FAIL: gated-prose-internal.ts imported outside its two allowed consumers:" >&2
  echo "$VIOLATIONS" >&2
  exit 1
fi

exit 0

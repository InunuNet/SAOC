#!/usr/bin/env bash
# verify_contract_naming_fixtures.sh — fixture-driven assertions for
# execution/checks/verify_contract_naming.py (contract-f1.yaml A2-A4).
#
# Usage: bash execution/checks/verify_contract_naming_fixtures.sh <case>
#   bad_name      -- a wrong-named contract file must be flagged (exit 1,
#                    filename named in output)
#   good_name     -- a correctly-named contract file must NOT be flagged
#                    (exit 0)
#   non_contract  -- a non-contract YAML file under specs/ must NOT be
#                    flagged, regardless of its filename (exit 0)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECKER="$REPO_ROOT/execution/checks/verify_contract_naming.py"
FIXTURES_DIR="$REPO_ROOT/.agent/memory/project/specs/architect-contract-naming-guardrail/goldens/fixtures"

case="${1:-}"

case "$case" in
  bad_name)
    set +e
    out="$(python3 "$CHECKER" "$FIXTURES_DIR/bad_name")"
    code=$?
    set -e
    echo "$out" | grep -q "contract.yaml"
    test "$code" -eq 1 || { echo "expected exit 1, got $code" >&2; exit 1; }
    ;;
  good_name)
    python3 "$CHECKER" "$FIXTURES_DIR/good_name"
    ;;
  non_contract)
    python3 "$CHECKER" "$FIXTURES_DIR/non_contract"
    ;;
  *)
    echo "usage: $0 {bad_name|good_name|non_contract}" >&2
    exit 2
    ;;
esac

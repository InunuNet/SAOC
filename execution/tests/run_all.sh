#!/usr/bin/env bash
# Athanor Factory Test Suite — 3-layer runner
# Usage: bash execution/tests/run_all.sh [layer1|layer2|layer3|all]
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

LAYER="${1:-all}"
TOTAL_PASS=0; TOTAL_FAIL=0
FAILED_TESTS=()

run_layer() {
  local name="$1" scripts_glob="$2"
  echo ""
  echo "========================================"
  echo "LAYER: $name"
  echo "========================================"
  local layer_pass=0 layer_fail=0
  for script in $scripts_glob; do
    [ -f "$script" ] || continue
    echo ""
    echo ">> $(basename "$script")"
    if bash "$script"; then
      ((layer_pass++))
    else
      ((layer_fail++))
      FAILED_TESTS+=("$(basename "$script")")
    fi
  done
  echo ""
  echo "Layer $name: $layer_pass passed, $layer_fail failed"
  ((TOTAL_PASS += layer_pass))
  ((TOTAL_FAIL += layer_fail))
  return $layer_fail
}

case "$LAYER" in
  layer1|all) run_layer "1-Static"   "execution/tests/layer1_static/test_*.sh" || true ;;
esac
case "$LAYER" in
  layer2|all) run_layer "2-Fixture"  "execution/tests/layer2_fixture/test_*.sh" || true ;;
esac
case "$LAYER" in
  layer3|all) run_layer "3-Behavioral" "execution/tests/layer3_behavioral/test_*.sh" || true ;;
esac

echo ""
echo "========================================"
echo "TOTAL: $TOTAL_PASS passed, $TOTAL_FAIL failed"
if [ "$TOTAL_FAIL" -gt 0 ]; then
  echo "FAILED TESTS:"
  for f in "${FAILED_TESTS[@]}"; do echo "  - $f"; done
  exit 1
fi
echo "ALL TESTS PASS"
exit 0

#!/usr/bin/env bash
# verify_fleet_pulse.sh — assertion helper for the fleet-pulse contract.
# Each check prints PASS/FAIL and contributes to the exit code.
# Usage: verify_fleet_pulse.sh <check-id>
#   target | phony | slugs | heartbeat | dryrun | all
# Env: MAKEFILE_PATH (default: Makefile) — file the grep checks read AND
#      the file passed to `make -f` for the dryrun check.
set -u

MAKEFILE="${MAKEFILE_PATH:-Makefile}"
RC=0

ok()   { echo "PASS: $1"; }
bad()  { echo "FAIL: $1"; RC=1; }

check_target() {
  if grep -qE '^fleet-install-pulse:' "$MAKEFILE"; then ok "fleet-install-pulse target exists"; else bad "fleet-install-pulse target missing"; fi
}

check_phony() {
  if grep -E '^\.PHONY:' "$MAKEFILE" | grep -qw 'fleet-install-pulse'; then ok "fleet-install-pulse in .PHONY"; else bad "fleet-install-pulse not in .PHONY"; fi
}

check_slugs() {
  local missing=""
  for s in saoc mumbl-ai mlilo-savant codex-harness; do
    grep -q "$s" "$MAKEFILE" || missing="$missing $s"
  done
  if [ -z "$missing" ]; then ok "all 4 fleet slugs present"; else bad "missing slugs:$missing"; fi
}

check_heartbeat() {
  if grep -q 'com.athanor.pulse.heartbeat.plist' "$MAKEFILE" && grep -qE '^fleet-install-pulse:' "$MAKEFILE"; then
    ok "heartbeat plist template referenced"
  else
    bad "heartbeat plist template not referenced"
  fi
}

check_dryrun() {
  # Parse + dry-run the target without executing recipes (-n). Exit 0 == valid syntax.
  # Use -f so the check honors MAKEFILE_PATH instead of the CWD default Makefile.
  if make -f "$MAKEFILE" -n fleet-install-pulse >/dev/null 2>&1; then ok "make -n fleet-install-pulse syntax valid"; else bad "make -n fleet-install-pulse failed"; fi
}

case "${1:-all}" in
  target)    check_target ;;
  phony)     check_phony ;;
  slugs)     check_slugs ;;
  heartbeat) check_heartbeat ;;
  dryrun)    check_dryrun ;;
  all)       check_target; check_phony; check_slugs; check_heartbeat; check_dryrun ;;
  *) echo "unknown check: $1"; exit 2 ;;
esac

exit $RC

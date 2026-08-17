#!/usr/bin/env bash
# verify_f4_catalog_audit_wiring.sh -- golden-file behavioral check for mission
# model-tier-repair F4: wire execution/checks/verify_free_model_catalog.py
# (F2's already-shipped, already-correct checker) into `make audit` so
# rules.md's "re-verify at each mission start" mandate is actually invoked
# by something, instead of being a checker that exists but that nothing
# calls.
#
# Precedent: this is the identical defect class, and identical fix shape, as
# mission alembic-fleet-distribution F5 wiring verify_skill_propagation.py +
# verify_skill_drift.py into `make audit` -- see
# execution/checks/test_audit_wiring.sh for the generic Makefile rc-capture
# mechanism (SKIP=exit 77 must not fail `make audit`, must be visibly
# printed, must not share PASS's exit code; a genuine FAIL must still
# propagate). That generic mechanism is NOT re-proven here (wiring_fail_*
# and wiring_skip_* below use throwaway fixture scripts, same as
# test_audit_wiring.sh's fail_propagates/skip_survives, purely to confirm
# the SAME rc-capture snippet is what F4's own audit lines use -- not to
# re-litigate whether Make itself behaves this way). What IS new here:
# proving verify_free_model_catalog.py specifically is wired into the REAL
# Makefile's audit: target, exactly once per case, additively, without
# swallowing exit codes.
#
# config_shape and vendor_distinct never touch the network (pure local JSON
# shape checks) -- wired as bare @python3 lines, same style as
# verify_skill_propagation.py. catalog_live is the network/SKIP-capable
# case (proxy down -> exit 77) -- wired with the rc-capture branch, same
# style as verify_skill_drift.py.
#
# Usage: verify_f4_catalog_audit_wiring.sh <case>
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CASE="${1:-}"

case "$CASE" in

  wiring_fail_propagates)
    # A genuine catalog_live FAIL (e.g. a dead id, real signal) must fail
    # `make audit`, using the exact rc-capture snippet F4's real wiring
    # uses (not a bare line -- catalog_live is SKIP-capable, so the wiring
    # must branch on 77, and this proves the branch's "else nonzero -> exit"
    # arm still propagates a real failure).
    fixture_dir="$(mktemp -d /tmp/f4-audit-fail.XXXXXX)"
    trap 'rm -rf "$fixture_dir"' EXIT
    cat > "$fixture_dir/catalog_live_stub.py" <<'PYEOF'
import sys
print("simulated genuine FAIL (e.g. a real dead free-tier id)", file=sys.stderr)
sys.exit(1)
PYEOF
    cat > "$fixture_dir/Makefile" <<EOF
audit:
	@echo "  [free-model-catalog-live, F4] checking..."
	@python3 $fixture_dir/catalog_live_stub.py; rc=\$\$?; \\
		if [ \$\$rc -eq 77 ]; then \\
			echo "  SKIP [free-model-catalog-live, F4]: not verified" ; \\
		elif [ \$\$rc -ne 0 ]; then \\
			exit \$\$rc ; \\
		fi
EOF
    if make -f "$fixture_dir/Makefile" -C "$fixture_dir" audit; then
      echo "FAIL: audit should have exited non-zero when the catalog_live wiring genuinely fails" >&2
      exit 1
    fi
    echo "PASS: wiring_fail_propagates -- a genuine catalog_live FAIL (exit 1) propagates through make audit"
    ;;

  wiring_skip_survives)
    # Proxy-unreachable (catalog_live exits 77) must NOT fail make audit,
    # and must be visibly printed -- silence and success must not look
    # identical.
    fixture_dir="$(mktemp -d /tmp/f4-audit-skip.XXXXXX)"
    out_file="$(mktemp /tmp/f4-audit-skip-out.XXXXXX)"
    trap 'rm -rf "$fixture_dir" "$out_file"' EXIT
    cat > "$fixture_dir/catalog_live_stub.py" <<'PYEOF'
import sys
print("simulated SKIP (Alembic proxy unreachable) -- exits 77, never 0 or 1")
sys.exit(77)
PYEOF
    cat > "$fixture_dir/Makefile" <<EOF
audit:
	@echo "  [free-model-catalog-live, F4] checking..."
	@python3 $fixture_dir/catalog_live_stub.py; rc=\$\$?; \\
		if [ \$\$rc -eq 77 ]; then \\
			echo "  SKIP [free-model-catalog-live, F4]: not verified" ; \\
		elif [ \$\$rc -ne 0 ]; then \\
			exit \$\$rc ; \\
		fi
EOF
    if ! make -f "$fixture_dir/Makefile" -C "$fixture_dir" audit > "$out_file" 2>&1; then
      echo "FAIL: a SKIP (exit 77) catalog_live wiring should not fail audit" >&2
      cat "$out_file" >&2
      exit 1
    fi
    if ! grep -q "SKIP \[free-model-catalog-live, F4\]" "$out_file"; then
      echo "FAIL: the SKIP must be visibly reported in audit output, not silently swallowed (silence and success must not look identical)" >&2
      cat "$out_file" >&2
      exit 1
    fi
    echo "PASS: wiring_skip_survives -- catalog_live SKIP (exit 77) does not fail audit, and is visibly reported"
    ;;

  wiring_pass_clean)
    # A clean catalog_live PASS (exit 0) must not fail audit and must not
    # print a spurious SKIP line -- confirms the branch's happy path is a
    # true no-op, not just "doesn't crash".
    fixture_dir="$(mktemp -d /tmp/f4-audit-pass.XXXXXX)"
    out_file="$(mktemp /tmp/f4-audit-pass-out.XXXXXX)"
    trap 'rm -rf "$fixture_dir" "$out_file"' EXIT
    cat > "$fixture_dir/catalog_live_stub.py" <<'PYEOF'
print("simulated PASS -- all configured ids live, free, tool-capable")
PYEOF
    cat > "$fixture_dir/Makefile" <<EOF
audit:
	@echo "  [free-model-catalog-live, F4] checking..."
	@python3 $fixture_dir/catalog_live_stub.py; rc=\$\$?; \\
		if [ \$\$rc -eq 77 ]; then \\
			echo "  SKIP [free-model-catalog-live, F4]: not verified" ; \\
		elif [ \$\$rc -ne 0 ]; then \\
			exit \$\$rc ; \\
		fi
EOF
    if ! make -f "$fixture_dir/Makefile" -C "$fixture_dir" audit > "$out_file" 2>&1; then
      echo "FAIL: a clean PASS (exit 0) catalog_live wiring should not fail audit" >&2
      cat "$out_file" >&2
      exit 1
    fi
    if grep -q "SKIP" "$out_file"; then
      echo "FAIL: a clean PASS run must not print a SKIP line" >&2
      cat "$out_file" >&2
      exit 1
    fi
    echo "PASS: wiring_pass_clean -- catalog_live PASS (exit 0) does not fail audit and prints no SKIP line"
    ;;

  real_makefile_wired)
    # Real-repo, read-only: `make -n audit` (dry-run, executes nothing) must
    # show config_shape and vendor_distinct wired exactly once each (bare
    # lines, no network), catalog_live wired exactly once with the rc-77
    # branch, every pre-existing audit line still present, and no wiring
    # line swallows its own exit code.
    dryrun_out="$(mktemp /tmp/f4-dryrun-out.XXXXXX)"
    trap 'rm -f "$dryrun_out"' EXIT
    ( cd "$SELF_DIR/../.." && make -n audit ) > "$dryrun_out" 2>&1 || true

    shape_count="$(grep -c "verify_free_model_catalog\.py config_shape" "$dryrun_out" || true)"
    vendor_count="$(grep -c "verify_free_model_catalog\.py vendor_distinct" "$dryrun_out" || true)"
    live_count="$(grep -c "verify_free_model_catalog\.py catalog_live" "$dryrun_out" || true)"
    if [ "$shape_count" != "1" ]; then
      echo "FAIL: expected exactly 1 wiring of 'verify_free_model_catalog.py config_shape' in \`make -n audit\`, found $shape_count" >&2
      exit 1
    fi
    if [ "$vendor_count" != "1" ]; then
      echo "FAIL: expected exactly 1 wiring of 'verify_free_model_catalog.py vendor_distinct' in \`make -n audit\`, found $vendor_count" >&2
      exit 1
    fi
    if [ "$live_count" != "1" ]; then
      echo "FAIL: expected exactly 1 wiring of 'verify_free_model_catalog.py catalog_live' in \`make -n audit\`, found $live_count" >&2
      exit 1
    fi
    for marker in "verify_agents.sh" "validate_manifest.sh" "audit_gates.py" "verify_version_fields_match.py" "verify_skill_propagation.py" "verify_skill_drift.py"; do
      if ! grep -q "$marker" "$dryrun_out"; then
        echo "FAIL: pre-existing audit check '$marker' is missing from \`make -n audit\` -- F4 must be additive, not destructive" >&2
        exit 1
      fi
    done
    if grep -E "verify_free_model_catalog\.py.*(\|\| true|\|\| :)" "$dryrun_out"; then
      echo "FAIL: a verify_free_model_catalog.py wiring line swallows its own exit code (|| true / || :) -- audit would never go red on real breakage" >&2
      exit 1
    fi
    live_line_for_rc="$(grep "verify_free_model_catalog\.py catalog_live" "$dryrun_out" || true)"
    if ! echo "$live_line_for_rc" | grep -q "rc -eq 77"; then
      echo "FAIL: the catalog_live wiring line does not branch on exit code 77 (SKIP) -- a bare invocation would fail \`make audit\` every time the Alembic proxy is down" >&2
      echo "  got: $live_line_for_rc" >&2
      exit 1
    fi
    echo "PASS: make -n audit wires config_shape/vendor_distinct/catalog_live exactly once each, additively, without swallowing exit codes, and catalog_live branches on the SKIP (exit 77) case"
    ;;

  real_lines_green)
    # Real-repo: extract the EXACT wired command lines out of `make -n
    # audit`'s dry-run output (not a re-derivation) and execute exactly
    # those, asserting all three exit 0 today. Deliberately does not
    # require the whole `make audit` target to exit 0 -- unrelated
    # pre-existing checks (e.g. manifest coverage) are out of scope here.
    repo_root="$(cd "$SELF_DIR/../.." && pwd)"
    dryrun_out="$(mktemp /tmp/f4-dryrun-lines.XXXXXX)"
    trap 'rm -f "$dryrun_out"' EXIT
    ( cd "$repo_root" && make -n audit ) > "$dryrun_out" 2>&1 || true

    shape_line="$(grep "verify_free_model_catalog\.py config_shape" "$dryrun_out" || true)"
    vendor_line="$(grep "verify_free_model_catalog\.py vendor_distinct" "$dryrun_out" || true)"
    live_line="$(grep "verify_free_model_catalog\.py catalog_live" "$dryrun_out" || true)"
    if [ -z "$shape_line" ] || [ -z "$vendor_line" ] || [ -z "$live_line" ]; then
      echo "FAIL: could not extract config_shape/vendor_distinct/catalog_live lines from make -n audit -- not wired yet" >&2
      exit 1
    fi
    if ! ( cd "$repo_root" && eval "$shape_line" ); then
      echo "FAIL: the exact wired config_shape command line failed against the real repo" >&2
      exit 1
    fi
    if ! ( cd "$repo_root" && eval "$vendor_line" ); then
      echo "FAIL: the exact wired vendor_distinct command line failed against the real repo" >&2
      exit 1
    fi
    if ! ( cd "$repo_root" && eval "$live_line" ); then
      echo "FAIL: the exact wired catalog_live command line failed against the real repo -- must exit 0 whether the proxy is up-and-live (PASS) or down/unusable (SKIP branch, exit 77 caught and neutralized to 0); only a genuine dead/priced/tool-less configured id (real FAIL, uncaught) should make this line fail" >&2
      exit 1
    fi
    rm -f "$repo_root/.agent/memory/scratch/.audit-skips.tmp" 2>/dev/null || true
    echo "PASS: the exact command lines make -n audit shows for config_shape/vendor_distinct/catalog_live all exit 0 against the real repo today"
    ;;

  fleet_no_devnull_swallow)
    # Shape check on the ONE automatic, unattended caller of `make audit`
    # in this repo (execution/fleet_update.sh:80, per team-lead finding
    # 2026-08-15): the audit-invocation line/block must not pipe combined
    # stdout+stderr to /dev/null. That redirect is exactly what would make
    # F4's own SKIP visibility (built for this) unobservable at the one
    # call site that fires automatically and unattended -- SKIP==PASS
    # reconstituted one layer out by a redirect. Extracts the block between
    # the "# 4. Audit" and "# 5. Boot Validation" markers (never touches
    # "# 3. Sync" / "# 2. Update Template" above it -- those are a
    # same-class, out-of-scope finding, reported separately, not fixed by
    # this feature). RED today (verified live 2026-08-15): line 80 is
    # `make audit > /dev/null 2>&1`.
    repo_root="$(cd "$SELF_DIR/../.." && pwd)"
    block="$(sed -n '/# 4\. Audit/,/# 5\. Boot Validation/p' "$repo_root/execution/fleet_update.sh" | sed '$d')"
    if [ -z "$block" ]; then
      echo "FAIL: could not locate the '# 4. Audit' .. '# 5. Boot Validation' block in execution/fleet_update.sh -- markers moved or renamed" >&2
      exit 1
    fi
    if echo "$block" | grep -qE '\bmake audit\b.*(>\s*/dev/null\s+2>&1|&>\s*/dev/null|>&\s*/dev/null)'; then
      echo "FAIL: the audit block in execution/fleet_update.sh still redirects make audit's combined output to /dev/null -- a SKIP occurring here (e.g. Alembic proxy down during a fleet run) is unobservable, indistinguishable from a clean pass" >&2
      echo "--- block ---" >&2
      echo "$block" >&2
      exit 1
    fi
    if ! echo "$block" | grep -q 'make audit'; then
      echo "FAIL: the audit block in execution/fleet_update.sh no longer invokes make audit at all" >&2
      exit 1
    fi
    echo "PASS: execution/fleet_update.sh's audit block invokes make audit without swallowing its combined output to /dev/null"
    ;;

  fleet_skip_surfaces)
    # Behavioral check (load-bearing) -- extracts the EXACT audit block out
    # of the real execution/fleet_update.sh (not a re-derivation) and
    # executes it, unmodified, in a tmp sandbox whose stub `audit:` target
    # stands in for a real audit run that skipped a check (exit 0, per
    # make audit's own SKIP-neutralization design -- the block must not
    # rely on the SKIP case producing a non-zero exit, since it does not).
    # Asserts the stub's SKIP text is visible in the block's own stdout
    # when run (proves fleet_update.sh's fix actually surfaces it, not
    # just that the /dev/null literal is gone) AND that AUDIT_STATUS is
    # still set to 0 afterward (the report table's ✅/❌ column must keep
    # working -- this is a regression guard on the pre-existing
    # stat_emoji mechanism, not just a new-feature check). Asserts the
    # property (SKIP text observable), not a specific implementation
    # (capture-and-echo vs. dropping the redirect vs. a log file the same
    # block also reads -- any of these pass as long as the fix is
    # self-contained in this block, which is what "wired into
    # fleet_update.sh" means). RED today: /dev/null swallows the stub's
    # SKIP text entirely.
    repo_root="$(cd "$SELF_DIR/../.." && pwd)"
    block="$(sed -n '/# 4\. Audit/,/# 5\. Boot Validation/p' "$repo_root/execution/fleet_update.sh" | sed '$d')"
    if [ -z "$block" ]; then
      echo "FAIL: could not locate the '# 4. Audit' .. '# 5. Boot Validation' block in execution/fleet_update.sh -- markers moved or renamed" >&2
      exit 1
    fi
    sandbox="$(mktemp -d /tmp/f4-fleet-skip.XXXXXX)"
    out_file="$(mktemp /tmp/f4-fleet-skip-out.XXXXXX)"
    trap 'rm -rf "$sandbox" "$out_file"' EXIT
    cat > "$sandbox/Makefile" <<'EOF'
audit:
	@echo "  SKIP [free-model-catalog-live, F4]: not verified -- see message above; does not count as pass or fail"
	@echo "⚠️  1 check(s) skipped (not verified this run) -- see SKIP lines above"
EOF
    ( cd "$sandbox" && eval "$block"; echo "AUDIT_STATUS_RESULT=$AUDIT_STATUS" ) > "$out_file" 2>&1
    if ! grep -q "SKIP \[free-model-catalog-live, F4\]" "$out_file"; then
      echo "FAIL: the real execution/fleet_update.sh audit block did not surface the stub audit target's SKIP text -- a skip during a fleet run remains invisible" >&2
      cat "$out_file" >&2
      exit 1
    fi
    if ! grep -q "AUDIT_STATUS_RESULT=0" "$out_file"; then
      echo "FAIL: AUDIT_STATUS was not 0 after a clean-exit (SKIP-neutralized) make audit run -- this would break the report table's existing ✅/❌ column for AUDIT_STATUS, a regression on pre-existing behavior, not just a missing new feature" >&2
      cat "$out_file" >&2
      exit 1
    fi
    echo "PASS: execution/fleet_update.sh's real audit block surfaces a stub SKIP to its own stdout and still sets AUDIT_STATUS=0, matching make audit's SKIP-neutralization design"
    ;;

  all)
    "$SELF_DIR/verify_f4_catalog_audit_wiring.sh" wiring_fail_propagates
    "$SELF_DIR/verify_f4_catalog_audit_wiring.sh" wiring_skip_survives
    "$SELF_DIR/verify_f4_catalog_audit_wiring.sh" wiring_pass_clean
    "$SELF_DIR/verify_f4_catalog_audit_wiring.sh" real_makefile_wired
    "$SELF_DIR/verify_f4_catalog_audit_wiring.sh" real_lines_green
    "$SELF_DIR/verify_f4_catalog_audit_wiring.sh" fleet_no_devnull_swallow
    "$SELF_DIR/verify_f4_catalog_audit_wiring.sh" fleet_skip_surfaces
    ;;

  *)
    echo "usage: $0 {wiring_fail_propagates|wiring_skip_survives|wiring_pass_clean|real_makefile_wired|real_lines_green|fleet_no_devnull_swallow|fleet_skip_surfaces|all}" >&2
    exit 2
    ;;
esac

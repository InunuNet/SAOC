#!/usr/bin/env bash
# Fixture-based discrimination test for F5 (wiring F2/F3 into `make audit`).
# `make audit` itself can't be safely run against a broken fixture — it does
# real things (brain stats, manifest coverage, etc.) against THIS repo, and
# there's no safe way to make one of its lines "genuinely fail" without
# corrupting real state. So this proves the WIRING PATTERN generically,
# in a throwaway tmp Makefile that never touches the real repo: a recipe
# line written the same way the real audit: target's new lines must be
# written (bare `@python3 <script>`, no `-` ignore-error prefix, no
# `|| true` swallow) propagates a failing check's exit code to `make`,
# and does not fail when the check exits 0 (the F3 proxy-down SKIP case).
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${1:-all}" in
  fail_propagates)
    fixture_dir="$(mktemp -d /tmp/f5-audit-fail.XXXXXX)"
    trap 'rm -rf "$fixture_dir"' EXIT
    cat > "$fixture_dir/failing_check.py" <<'PYEOF'
import sys
print("simulated genuine failure (e.g. a real F2 propagation mismatch)", file=sys.stderr)
sys.exit(1)
PYEOF
    cat > "$fixture_dir/Makefile" <<EOF
audit:
	@echo "  [check] running..."
	@python3 $fixture_dir/failing_check.py
EOF
    if make -f "$fixture_dir/Makefile" -C "$fixture_dir" audit; then
      echo "FAIL: audit should have exited non-zero when a wired check genuinely fails" >&2
      exit 1
    fi
    echo "PASS: a failing check wired as a bare @python3 <script> line propagates non-zero exit through make audit"
    ;;
  skip_survives)
    # As of the 2026-08-16 amendment, SKIP is exit 77 (Athanor's reserved skip code, not 0) — PASS and SKIP must
    # never share an exit code. A bare `@python3 <script>` line would now fail
    # this fixture (make treats any non-zero recipe exit as a target failure),
    # so this proves the REQUIRED rc-capture branch: exit 77 -> print visibly,
    # continue; the target must still exit 0 overall, AND the skip must be
    # visible in the output (not silently indistinguishable from a plain pass).
    fixture_dir="$(mktemp -d /tmp/f5-audit-skip.XXXXXX)"
    out_file="$(mktemp /tmp/f5-audit-skip-out.XXXXXX)"
    trap 'rm -rf "$fixture_dir" "$out_file"' EXIT
    cat > "$fixture_dir/skip_check.py" <<'PYEOF'
import sys
print("simulated SKIP (proxy down) — exits 77, never 0 or 1")
sys.exit(77)
PYEOF
    cat > "$fixture_dir/Makefile" <<EOF
audit:
	@echo "  [check] running..."
	@python3 $fixture_dir/skip_check.py; rc=\$\$?; \\
		if [ \$\$rc -eq 77 ]; then \\
			echo "  SKIP [check]: not verified" ; \\
		elif [ \$\$rc -ne 0 ]; then \\
			exit \$\$rc ; \\
		fi
EOF
    if ! make -f "$fixture_dir/Makefile" -C "$fixture_dir" audit > "$out_file" 2>&1; then
      echo "FAIL: a SKIP (exit 77) check wired with the rc-capture branch should not fail audit" >&2
      cat "$out_file" >&2
      exit 1
    fi
    if ! grep -q "SKIP \[check\]" "$out_file"; then
      echo "FAIL: the SKIP must be visibly reported in audit output, not silently swallowed" >&2
      cat "$out_file" >&2
      exit 1
    fi
    echo "PASS: an exit-3 SKIP check wired with the rc-capture branch does not fail audit, and is visibly reported"
    ;;
  skip_pattern_still_fails_on_real_fail)
    # Same rc-capture branch pattern as skip_survives, but the check exits 1
    # (a real failure, not 3). Proves the branch that handles SKIP doesn't
    # accidentally widen to swallow genuine failures too.
    fixture_dir="$(mktemp -d /tmp/f5-audit-skipfail.XXXXXX)"
    trap 'rm -rf "$fixture_dir"' EXIT
    cat > "$fixture_dir/fail_check.py" <<'PYEOF'
import sys
print("simulated genuine failure", file=sys.stderr)
sys.exit(1)
PYEOF
    cat > "$fixture_dir/Makefile" <<EOF
audit:
	@echo "  [check] running..."
	@python3 $fixture_dir/fail_check.py; rc=\$\$?; \\
		if [ \$\$rc -eq 77 ]; then \\
			echo "  SKIP [check]: not verified" ; \\
		elif [ \$\$rc -ne 0 ]; then \\
			exit \$\$rc ; \\
		fi
EOF
    if make -f "$fixture_dir/Makefile" -C "$fixture_dir" audit; then
      echo "FAIL: the rc-capture branch pattern must still fail audit on a genuine (exit 1) failure" >&2
      exit 1
    fi
    echo "PASS: the rc-capture branch pattern still propagates a genuine failure (exit 1) as a target failure"
    ;;
  skip_summary_count)
    # Two skip-capable checks in one target, both SKIPping: the summary line
    # must report the correct count (2) and appear only because count > 0.
    # A separate all-PASS run of the same pattern must print no summary line.
    fixture_dir="$(mktemp -d /tmp/f5-audit-summary.XXXXXX)"
    skip_log="$fixture_dir/.skips.tmp"
    out_skip="$(mktemp /tmp/f5-audit-summary-skip-out.XXXXXX)"
    out_clean="$(mktemp /tmp/f5-audit-summary-clean-out.XXXXXX)"
    trap 'rm -rf "$fixture_dir" "$out_skip" "$out_clean"' EXIT
    cat > "$fixture_dir/skip_a.py" <<'PYEOF'
import sys
print("skip A")
sys.exit(77)
PYEOF
    cat > "$fixture_dir/skip_b.py" <<'PYEOF'
import sys
print("skip B")
sys.exit(77)
PYEOF
    cat > "$fixture_dir/pass_check.py" <<'PYEOF'
print("pass")
PYEOF
    cat > "$fixture_dir/Makefile" <<EOF
SKIP_LOG := $skip_log

audit:
	@rm -f \$(SKIP_LOG)
	@python3 $fixture_dir/skip_a.py; rc=\$\$?; \\
		if [ \$\$rc -eq 77 ]; then echo "  SKIP [a]"; echo a >> \$(SKIP_LOG); \\
		elif [ \$\$rc -ne 0 ]; then exit \$\$rc; fi
	@python3 $fixture_dir/skip_b.py; rc=\$\$?; \\
		if [ \$\$rc -eq 77 ]; then echo "  SKIP [b]"; echo b >> \$(SKIP_LOG); \\
		elif [ \$\$rc -ne 0 ]; then exit \$\$rc; fi
	@if [ -s \$(SKIP_LOG) ]; then n=\$\$(wc -l < \$(SKIP_LOG) | tr -d ' '); echo "SUMMARY: \$\$n check(s) skipped"; fi
	@rm -f \$(SKIP_LOG)

audit_clean:
	@rm -f \$(SKIP_LOG)
	@python3 $fixture_dir/pass_check.py; rc=\$\$?; \\
		if [ \$\$rc -eq 77 ]; then echo "  SKIP [pass_check]"; echo p >> \$(SKIP_LOG); \\
		elif [ \$\$rc -ne 0 ]; then exit \$\$rc; fi
	@if [ -s \$(SKIP_LOG) ]; then n=\$\$(wc -l < \$(SKIP_LOG) | tr -d ' '); echo "SUMMARY: \$\$n check(s) skipped"; fi
	@rm -f \$(SKIP_LOG)
EOF
    if ! make -f "$fixture_dir/Makefile" -C "$fixture_dir" audit > "$out_skip" 2>&1; then
      echo "FAIL: two-skip fixture should not fail the target" >&2
      cat "$out_skip" >&2
      exit 1
    fi
    if ! grep -q "SUMMARY: 2 check(s) skipped" "$out_skip"; then
      echo "FAIL: expected 'SUMMARY: 2 check(s) skipped', got:" >&2
      cat "$out_skip" >&2
      exit 1
    fi
    if ! make -f "$fixture_dir/Makefile" -C "$fixture_dir" audit_clean > "$out_clean" 2>&1; then
      echo "FAIL: all-pass fixture should not fail the target" >&2
      cat "$out_clean" >&2
      exit 1
    fi
    if grep -q "SUMMARY" "$out_clean"; then
      echo "FAIL: an all-pass run must print no summary line at all (silent on success), got:" >&2
      cat "$out_clean" >&2
      exit 1
    fi
    echo "PASS: skip-count summary reports the correct count when skips occur, and is silent when there are none"
    ;;
  real_makefile_wired)
    # Real-repo, read-only: `make -n audit` (dry-run print, executes nothing)
    # must show exactly one invocation of each of F2 and F3, each preceded
    # by a distinguishing label, and every existing audit line untouched.
    dryrun_out="$(mktemp /tmp/f5-dryrun-out.XXXXXX)"
    trap 'rm -f "$dryrun_out"' EXIT
    ( cd "$SELF_DIR/../.." && make -n audit ) > "$dryrun_out" 2>&1 || true

    prop_count="$(grep -c "execution/checks/verify_skill_propagation\.py" "$dryrun_out" || true)"
    drift_count="$(grep -c "execution/checks/verify_skill_drift\.py" "$dryrun_out" || true)"
    if [ "$prop_count" != "1" ]; then
      echo "FAIL: expected exactly 1 wiring of verify_skill_propagation.py in \`make -n audit\`, found $prop_count" >&2
      exit 1
    fi
    if [ "$drift_count" != "1" ]; then
      echo "FAIL: expected exactly 1 wiring of verify_skill_drift.py in \`make -n audit\`, found $drift_count" >&2
      exit 1
    fi
    for marker in "verify_agents.sh" "validate_manifest.sh" "audit_gates.py" "verify_version_fields_match.py"; do
      if ! grep -q "$marker" "$dryrun_out"; then
        echo "FAIL: pre-existing audit check '$marker' is missing from \`make -n audit\` — F5 must be additive, not destructive" >&2
        exit 1
      fi
    done
    if grep -E "(verify_skill_propagation\.py|verify_skill_drift\.py).*(\|\| true|\|\| :)" "$dryrun_out"; then
      echo "FAIL: F2/F3 wiring line swallows its own exit code (|| true / || :) — audit would never go red on real breakage" >&2
      exit 1
    fi
    drift_line_for_rc="$(grep "execution/checks/verify_skill_drift\.py" "$dryrun_out" || true)"
    if ! echo "$drift_line_for_rc" | grep -q "rc -eq 77"; then
      echo "FAIL: F3's wired line does not branch on exit code 77 (SKIP, Athanor's reserved skip code) — a bare invocation would now fail \`make audit\` every time the proxy is down, since SKIP no longer shares PASS's exit code" >&2
      echo "  got: $drift_line_for_rc" >&2
      exit 1
    fi
    echo "PASS: make -n audit wires F2 and F3 exactly once each, additively, without swallowing exit codes, and F3 branches on the SKIP (exit 77) case"
    ;;
  real_lines_green)
    # Real-repo: extract the EXACT wired command lines for F2/F3 out of
    # `make -n audit`'s dry-run output (not a re-derivation of the check
    # invocation) and execute exactly those, asserting both exit 0 today.
    # Deliberately does NOT require the whole `make audit` target to exit 0
    # — `make audit` can independently fail on unrelated, pre-existing
    # checks (e.g. a manifest-coverage gap) that are out of this mission's
    # scope and must not be conflated with F2/F3's own correctness.
    repo_root="$(cd "$SELF_DIR/../.." && pwd)"
    dryrun_out="$(mktemp /tmp/f5-dryrun-lines.XXXXXX)"
    trap 'rm -f "$dryrun_out"' EXIT
    ( cd "$repo_root" && make -n audit ) > "$dryrun_out" 2>&1 || true

    prop_line="$(grep "execution/checks/verify_skill_propagation\.py" "$dryrun_out" || true)"
    drift_line="$(grep "execution/checks/verify_skill_drift\.py" "$dryrun_out" || true)"
    if [ -z "$prop_line" ] || [ -z "$drift_line" ]; then
      echo "FAIL: could not extract F2/F3 lines from make -n audit — not wired yet" >&2
      exit 1
    fi
    if ! ( cd "$repo_root" && eval "$prop_line" ); then
      echo "FAIL: the exact wired F2 command line failed against the real repo" >&2
      exit 1
    fi
    if ! ( cd "$repo_root" && eval "$drift_line" ); then
      echo "FAIL: the exact wired F3 command line failed against the real repo — this must exit 0 whether the proxy is up-and-matching (PASS) or down/unusable (SKIP branch, exit 77 caught and neutralized to 0); only a genuine version mismatch (exit 1, uncaught) should make this line fail" >&2
      exit 1
    fi
    # Courtesy cleanup: eval'ing only the extracted F3 line (not the whole
    # target) skips the target's own reset/cleanup lines for the scratch
    # skip-log file. Remove it if the SKIP branch happened to create it.
    rm -f "$repo_root/.agent/memory/scratch/.audit-skips.tmp" 2>/dev/null || true
    echo "PASS: the exact command lines make -n audit shows for F2 and F3 both exit 0 against the real repo today"
    ;;
  all)
    "$SELF_DIR/test_audit_wiring.sh" fail_propagates
    "$SELF_DIR/test_audit_wiring.sh" skip_survives
    "$SELF_DIR/test_audit_wiring.sh" skip_pattern_still_fails_on_real_fail
    "$SELF_DIR/test_audit_wiring.sh" skip_summary_count
    "$SELF_DIR/test_audit_wiring.sh" real_makefile_wired
    "$SELF_DIR/test_audit_wiring.sh" real_lines_green
    ;;
  *)
    echo "usage: $0 {fail_propagates|skip_survives|skip_pattern_still_fails_on_real_fail|skip_summary_count|real_makefile_wired|real_lines_green|all}" >&2
    exit 2
    ;;
esac

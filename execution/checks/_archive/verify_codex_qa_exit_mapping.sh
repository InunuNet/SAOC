#!/usr/bin/env bash
# verify_codex_qa_exit_mapping.sh — smoke-tests execution/contract.py's `codex_qa`
# assertion kind (F2, cross-model-qa-codex mission).
#
# Confirms the wrapper's three exit paths map to three DISTINCT gate verdicts:
#   exit 0 (PASS)          -> verdict "pass"
#   exit 1 (FAIL, findings)-> verdict "fail"
#   exit 2 (usage/wrapper)  -> verdict "error"   (NOT "fail" -- must not read as
#                                                  an adversarial QA rejection)
#
# Does NOT call the real execution/codex_qa.sh or the codex binary -- no OpenAI
# quota spent, no network, runs in well under a second. Uses fake stand-in
# scripts via the codex_qa check's `script:` override field (default in
# production is execution/codex_qa.sh; this override exists specifically so
# this smoke test — and any future one — can substitute a fake wrapper).
set -u

fail() { echo "FAIL: $1" >&2; exit 1; }

tmpdir="$(mktemp -d)" || fail "could not create tmpdir"
trap 'rm -rf "$tmpdir"; rm -rf ".agent/memory/scratch/contract-results/codex-qa-exit-mapping-smoke"' EXIT

cat > "$tmpdir/fake_pass.sh" <<'EOF'
#!/usr/bin/env bash
echo "PASS"
exit 0
EOF

cat > "$tmpdir/fake_fail.sh" <<'EOF'
#!/usr/bin/env bash
echo "FAIL"
echo "FAIL: fake_target.py:1 fake finding for smoke test"
exit 1
EOF

cat > "$tmpdir/fake_error.sh" <<'EOF'
#!/usr/bin/env bash
echo "codex_qa.sh: fake wrapper error" >&2
exit 2
EOF

chmod +x "$tmpdir"/fake_pass.sh "$tmpdir"/fake_fail.sh "$tmpdir"/fake_error.sh

cat > "$tmpdir/contract.yaml" <<EOF
schema: athanor.contract/v1
slug: codex-qa-exit-mapping-smoke
goal: smoke test only -- not a real feature contract
created_at: '2026-08-18'
autonomy: high
assertions:
  phase: 4
  checks:
    - id: SPASS
      description: fake wrapper exit 0 must map to verdict pass
      type: codex_qa
      target: dummy-target
      script: ${tmpdir}/fake_pass.sh
    - id: SFAIL
      description: fake wrapper exit 1 must map to verdict fail
      type: codex_qa
      target: dummy-target
      script: ${tmpdir}/fake_fail.sh
    - id: SERROR
      description: fake wrapper exit 2 must map to verdict error, not fail
      type: codex_qa
      target: dummy-target
      script: ${tmpdir}/fake_error.sh
EOF

python3 execution/contract.py check "$tmpdir/contract.yaml" --assertion SPASS >/dev/null 2>&1
python3 execution/contract.py check "$tmpdir/contract.yaml" --assertion SFAIL >/dev/null 2>&1
python3 execution/contract.py check "$tmpdir/contract.yaml" --assertion SERROR >/dev/null 2>&1

results_dir=".agent/memory/scratch/contract-results/codex-qa-exit-mapping-smoke"

[ -f "$results_dir/SPASS.json" ] || fail "no result file for SPASS -- codex_qa kind not wired into check_cmd"
[ -f "$results_dir/SFAIL.json" ] || fail "no result file for SFAIL -- codex_qa kind not wired into check_cmd"
[ -f "$results_dir/SERROR.json" ] || fail "no result file for SERROR -- codex_qa kind not wired into check_cmd"

v_pass=$(python3 -c "import json;print(json.load(open('$results_dir/SPASS.json'))['verdict'])")
v_fail=$(python3 -c "import json;print(json.load(open('$results_dir/SFAIL.json'))['verdict'])")
v_error=$(python3 -c "import json;print(json.load(open('$results_dir/SERROR.json'))['verdict'])")

[ "$v_pass" = "pass" ] || fail "exit0 mapped to verdict='$v_pass', expected 'pass'"
[ "$v_fail" = "fail" ] || fail "exit1 mapped to verdict='$v_fail', expected 'fail'"
[ "$v_error" = "error" ] || fail "exit2 mapped to verdict='$v_error', expected 'error' (must NOT be 'fail' -- that would read a missing/broken codex binary as an adversarial QA rejection)"

echo "OK: codex_qa exit-code -> verdict mapping correct (0=pass, 1=fail, 2=error)"
exit 0

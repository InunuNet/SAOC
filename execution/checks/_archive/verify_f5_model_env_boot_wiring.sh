#!/usr/bin/env bash
# verify_f5_model_env_boot_wiring.sh -- golden-file behavioral check for mission
# model-tier-repair F5: a boot-time guard for #1332's residual risk (unset/invalid
# ANTHROPIC_DEFAULT_{HAIKU,SONNET,OPUS}_MODEL env overrides), wired into
# execution/hooks/full_boot.sh (the real SessionStart boot path, confirmed live-wired
# in .claude/settings.json -- see the golden for the grep evidence).
#
# Feature under test (dev-owned, does not exist yet -- this contract is RED):
#   execution/checks/verify_model_env_boot.py
#   execution/hooks/full_boot.sh (new wiring line calling it, || true, non-fatal)
#
# Three cases inside the feature script, config-vs-transient split per the golden:
#   literal_unexpanded  -- deterministic, no network (docs/openrouter.md's documented
#                          "$ANTHROPIC_DEFAULT_HAIKU_MODEL" literal-string bug)
#   empty_override      -- deterministic, no network (live env var set to "")
#   env_catalog_live    -- the ONLY network-dependent case; SKIP (77) if proxy down,
#                          FAIL if catalog fetched and id genuinely absent, trivial
#                          PASS with NO network attempt when nothing is configured to
#                          check (base_url not OpenRouter-shaped, or no override set)
#   boot_report         -- runs all three, always the thing wired into full_boot.sh
#
# Exit codes for THIS script (the assertion harness): 0 = PASS, 1 = FAIL.
# Exit codes for the FEATURE script under test: 0 pass, 1 fail, 2 invoked-wrong,
# 77 SKIP (execution/contract.py:302's reserved autotools signal).
#
# Usage: verify_f5_model_env_boot_wiring.sh <case>
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FEATURE_SCRIPT="$REPO_ROOT/execution/checks/verify_model_env_boot.py"
FULL_BOOT="$REPO_ROOT/execution/hooks/full_boot.sh"
CASE="${1:-}"

case "$CASE" in

  boot_wired)
    # Real-repo check: full_boot.sh must call the feature script's boot_report case,
    # and the call must be non-fatal (either "|| true" on the line, or piped so a
    # nonzero exit cannot propagate to the hook's own exit status).
    if [ ! -f "$FULL_BOOT" ]; then
      echo "FAIL: $FULL_BOOT does not exist" >&2
      exit 1
    fi
    LINE=$(grep -n "verify_model_env_boot.py" "$FULL_BOOT" | grep "boot_report" || true)
    if [ -z "$LINE" ]; then
      echo "FAIL: full_boot.sh does not call verify_model_env_boot.py boot_report -- not wired" >&2
      exit 1
    fi
    if ! echo "$LINE" | grep -qE '\|\|[[:space:]]*(true|echo)'; then
      echo "FAIL: wiring line does not appear non-fatal (no '|| true' / '|| echo' guard): $LINE" >&2
      exit 1
    fi
    echo "PASS: boot_wired -- full_boot.sh calls verify_model_env_boot.py boot_report non-fatally"
    echo "  $LINE"
    ;;

  literal_unexpanded_fail)
    fixture_dir="$(mktemp -d /tmp/f5-literal-fail.XXXXXX)"
    trap 'rm -rf "$fixture_dir"' EXIT
    cat > "$fixture_dir/settings.json" <<'EOF'
{"env": {"ANTHROPIC_DEFAULT_HAIKU_MODEL": "$ANTHROPIC_DEFAULT_HAIKU_MODEL"}}
EOF
    cat > "$fixture_dir/settings.local.json" <<'EOF'
{"env": {}}
EOF
    if [ ! -f "$FEATURE_SCRIPT" ]; then
      echo "FAIL: $FEATURE_SCRIPT does not exist yet" >&2
      exit 1
    fi
    python3 "$FEATURE_SCRIPT" literal_unexpanded \
      --settings "$fixture_dir/settings.json" \
      --settings-local "$fixture_dir/settings.local.json"
    rc=$?
    if [ "$rc" -ne 1 ]; then
      echo "FAIL: expected exit 1 on a literal unexpanded \$VAR fixture, got $rc" >&2
      exit 1
    fi
    echo "PASS: literal_unexpanded_fail -- exit 1 on the documented docs/openrouter.md bug shape"
    ;;

  literal_unexpanded_pass)
    fixture_dir="$(mktemp -d /tmp/f5-literal-pass.XXXXXX)"
    trap 'rm -rf "$fixture_dir"' EXIT
    cat > "$fixture_dir/settings.json" <<'EOF'
{"env": {"ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek/deepseek-chat-v3-0324:free"}}
EOF
    cat > "$fixture_dir/settings.local.json" <<'EOF'
{"env": {}}
EOF
    if [ ! -f "$FEATURE_SCRIPT" ]; then
      echo "FAIL: $FEATURE_SCRIPT does not exist yet" >&2
      exit 1
    fi
    python3 "$FEATURE_SCRIPT" literal_unexpanded \
      --settings "$fixture_dir/settings.json" \
      --settings-local "$fixture_dir/settings.local.json"
    rc=$?
    if [ "$rc" -ne 0 ]; then
      echo "FAIL: expected exit 0 on a correctly-resolved value fixture, got $rc" >&2
      exit 1
    fi
    echo "PASS: literal_unexpanded_pass -- exit 0 on a correctly-resolved env value"
    ;;

  empty_override_fail)
    if [ ! -f "$FEATURE_SCRIPT" ]; then
      echo "FAIL: $FEATURE_SCRIPT does not exist yet" >&2
      exit 1
    fi
    env -i PATH="$PATH" ANTHROPIC_DEFAULT_HAIKU_MODEL="" \
      python3 "$FEATURE_SCRIPT" empty_override
    rc=$?
    if [ "$rc" -ne 1 ]; then
      echo "FAIL: expected exit 1 when ANTHROPIC_DEFAULT_HAIKU_MODEL='' is exported, got $rc" >&2
      exit 1
    fi
    echo "PASS: empty_override_fail -- exit 1 on an exported-but-empty override"
    ;;

  empty_override_pass)
    if [ ! -f "$FEATURE_SCRIPT" ]; then
      echo "FAIL: $FEATURE_SCRIPT does not exist yet" >&2
      exit 1
    fi
    env -i PATH="$PATH" \
      python3 "$FEATURE_SCRIPT" empty_override
    rc=$?
    if [ "$rc" -ne 0 ]; then
      echo "FAIL: expected exit 0 when no ANTHROPIC_DEFAULT_*_MODEL vars are set, got $rc" >&2
      exit 1
    fi
    echo "PASS: empty_override_pass -- exit 0 when the vars are simply unset"
    ;;

  env_catalog_live_skip)
    if [ ! -f "$FEATURE_SCRIPT" ]; then
      echo "FAIL: $FEATURE_SCRIPT does not exist yet" >&2
      exit 1
    fi
    # Unreachable local port -- simulates Alembic/OpenRouter proxy down, must SKIP not FAIL.
    env -i PATH="$PATH" \
      ANTHROPIC_BASE_URL="https://openrouter.ai/api" \
      ANTHROPIC_DEFAULT_HAIKU_MODEL="deepseek/deepseek-chat-v3-0324:free" \
      python3 "$FEATURE_SCRIPT" env_catalog_live --endpoint "http://127.0.0.1:1/v1/models" --timeout 3
    rc=$?
    if [ "$rc" -ne 77 ]; then
      echo "FAIL: expected exit 77 (SKIP) when the catalog endpoint is unreachable, got $rc" >&2
      exit 1
    fi
    echo "PASS: env_catalog_live_skip -- exit 77 when the network path is genuinely down, never FAIL"
    ;;

  env_catalog_live_trivial_pass)
    if [ ! -f "$FEATURE_SCRIPT" ]; then
      echo "FAIL: $FEATURE_SCRIPT does not exist yet" >&2
      exit 1
    fi
    # ANTHROPIC_BASE_URL unset (native Anthropic) -- nothing to check, and the
    # network attempt must not even happen. Point --endpoint at a bogus host that
    # would hang/error if actually touched; require the call to return in well
    # under the configured timeout, proving the network branch was never entered.
    start=$(date +%s)
    env -i PATH="$PATH" \
      python3 "$FEATURE_SCRIPT" env_catalog_live --endpoint "http://10.255.255.1/v1/models" --timeout 8
    rc=$?
    elapsed=$(( $(date +%s) - start ))
    if [ "$rc" -ne 0 ]; then
      echo "FAIL: expected trivial exit 0 when ANTHROPIC_BASE_URL is not OpenRouter-shaped, got $rc" >&2
      exit 1
    fi
    if [ "$elapsed" -ge 5 ]; then
      echo "FAIL: took ${elapsed}s -- the network path must not be attempted at all in this branch (timeout was 8s)" >&2
      exit 1
    fi
    echo "PASS: env_catalog_live_trivial_pass -- exit 0 in ${elapsed}s, no network attempt made"
    ;;

  invoked_wrong_exit2)
    if [ ! -f "$FEATURE_SCRIPT" ]; then
      echo "FAIL: $FEATURE_SCRIPT does not exist yet" >&2
      exit 1
    fi
    python3 "$FEATURE_SCRIPT" not_a_real_case
    rc=$?
    if [ "$rc" -ne 2 ]; then
      echo "FAIL: expected exit 2 (invoked-wrong) for an unknown case name, got $rc" >&2
      exit 1
    fi
    echo "PASS: invoked_wrong_exit2 -- exit 2 on an unrecognized case, never remapped"
    ;;

  no_hardcoded_ids)
    if [ ! -f "$FEATURE_SCRIPT" ]; then
      echo "FAIL: $FEATURE_SCRIPT does not exist yet" >&2
      exit 1
    fi
    # Shape check: no OpenRouter-id-shaped literal (vendor/model-name:free) may
    # appear in the feature script's source, outside of comments quoting the
    # docs/openrouter.md example (those quote deepseek's id as prose evidence, so
    # exclude lines starting with '#' before matching).
    HITS=$(grep -vE '^\s*#' "$FEATURE_SCRIPT" | grep -E '[a-z0-9_-]+/[a-z0-9_.:-]+:free' || true)
    if [ -n "$HITS" ]; then
      echo "FAIL: hardcoded free-tier-id-shaped literal(s) found outside comments:" >&2
      echo "$HITS" >&2
      exit 1
    fi
    echo "PASS: no_hardcoded_ids -- no OpenRouter id literal in executable source"
    ;;

  boot_never_blocks)
    # Extract the real wiring line(s) out of full_boot.sh and execute them in
    # isolation against a stub feature script that exits 1 (simulating a genuine
    # config FAIL). The extracted snippet itself must not propagate that nonzero
    # exit -- full_boot.sh's own convention is "all steps non-fatal."
    if [ ! -f "$FULL_BOOT" ]; then
      echo "FAIL: $FULL_BOOT does not exist" >&2
      exit 1
    fi
    LINE=$(grep "verify_model_env_boot.py" "$FULL_BOOT" | grep "boot_report" || true)
    if [ -z "$LINE" ]; then
      echo "FAIL: no boot_report wiring line found in full_boot.sh to extract -- not wired yet" >&2
      exit 1
    fi
    fixture_dir="$(mktemp -d /tmp/f5-boot-noblock.XXXXXX)"
    trap 'rm -rf "$fixture_dir"' EXIT
    mkdir -p "$fixture_dir/execution/checks"
    cat > "$fixture_dir/execution/checks/verify_model_env_boot.py" <<'PYEOF'
#!/usr/bin/env python3
import sys
print("simulated genuine config FAIL", file=sys.stderr)
sys.exit(1)
PYEOF
    chmod +x "$fixture_dir/execution/checks/verify_model_env_boot.py"
    ( cd "$fixture_dir" && eval "$LINE" )
    rc=$?
    if [ "$rc" -ne 0 ]; then
      echo "FAIL: the extracted full_boot.sh wiring line propagated exit $rc from a stub FAIL -- must be non-fatal (|| true)" >&2
      exit 1
    fi
    echo "PASS: boot_never_blocks -- extracted wiring line stays exit 0 even when the feature script genuinely FAILs"
    ;;

  *)
    echo "usage: $0 <case>" >&2
    echo "cases: boot_wired literal_unexpanded_fail literal_unexpanded_pass empty_override_fail empty_override_pass env_catalog_live_skip env_catalog_live_trivial_pass invoked_wrong_exit2 no_hardcoded_ids boot_never_blocks" >&2
    exit 2
    ;;
esac

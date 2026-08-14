#!/usr/bin/env bash
# verify_f5_boot_no_autoapply.sh -- golden-file behavioral check for mission
# harness-integrity-hardening F5 (2026-07-28 adversarial review, Finding 3).
#
# Bug: execution/hooks/full_boot.sh, in its no-mission branch, ran
#   python3 execution/update_template.py --apply
# directly on every session boot -- unattended mutation of the harness with
# no confirmation, contradicting .claude/rules/behavior.md "Ask Before
# Destructive Actions". Fix: boot must DETECT an available update and print a
# banner naming `make update-template`, never invoke --apply itself, in
# either the mission-active or no-mission branch.
#
# Golden: .agent/memory/project/specs/harness-integrity-hardening/goldens/f5_boot_update_banner.md
# Contract: .agent/memory/project/specs/harness-integrity-hardening/contract-f5.yaml
#
# Usage: verify_f5_boot_no_autoapply.sh <mode>
#   static       -- source-level grep: no LIVE (command-position) invocation
#                    of `update_template.py --apply` anywhere in
#                    full_boot.sh; the two F1 advisory echo lines are allowed.
#   available    -- sandboxed boot run, updates available (CURRENT != LATEST):
#                    banner naming both versions + `make update-template`,
#                    --apply stub never invoked, tree byte-identical,
#                    BOOT COMPLETE + exit 0.
#   none         -- sandboxed boot run, no update available (CURRENT ==
#                    LATEST): no banner, no --apply, BOOT COMPLETE + exit 0.
#   check_fails  -- sandboxed boot run, stubbed `gh` exits non-zero with a
#                    stderr message: failure surfaced in output, no banner,
#                    no --apply, BOOT COMPLETE + exit 0.
#   gh_absent    -- sandboxed boot run, `gh` entirely missing from PATH:
#                    same fault-isolation contract as check_fails.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MODE="${1:-}"
TARGET_SRC="$REPO_ROOT/execution/hooks/full_boot.sh"

if [ ! -f "$TARGET_SRC" ]; then
  echo "FAIL: target script not found: $TARGET_SRC" >&2
  exit 1
fi

# --- static mode: no sandbox needed, just inspect the real source file. ---
if [ "$MODE" = "static" ]; then
  # Find any command-position occurrence of `update_template.py --apply`
  # that is NOT inside an echo/print string. Strategy: strip lines that are
  # `echo "..."` advisory lines first, then grep what remains.
  LIVE_HITS=$(grep -n "update_template.py" "$TARGET_SRC" | grep -v '^\s*[0-9]*:\s*echo ' || true)
  if [ -n "$LIVE_HITS" ]; then
    echo "FAIL: static -- found non-echo (potentially live) reference(s) to update_template.py:" >&2
    echo "$LIVE_HITS" >&2
    exit 1
  fi
  # Explicitly confirm no bare `python3 execution/update_template.py --apply`
  # command invocation (command position, not inside a quoted echo string).
  if grep -Ev '^\s*#|echo ' "$TARGET_SRC" | grep -q "update_template.py --apply"; then
    echo "FAIL: static -- a live invocation of update_template.py --apply appears outside an echo string" >&2
    exit 1
  fi
  echo "PASS: static -- no live invocation of update_template.py --apply; only advisory echo lines present"
  exit 0
fi

# --- sandboxed modes: available | none | check_fails | gh_absent ---
case "$MODE" in
  available|none|check_fails|gh_absent) ;;
  *)
    echo "FAIL: unknown mode '$MODE' (expected static|available|none|check_fails|gh_absent)" >&2
    exit 1
    ;;
esac

WS="$(mktemp -d)"
cleanup() { /bin/rm -rf "$WS" 2>/dev/null || true; }
trap cleanup EXIT

TARGET="$WS/execution/hooks/full_boot.sh"

# --- Minimal fixture project skeleton (same convention as
#     verify_f1_1311_boot_harness_incomplete.sh) so full_boot.sh's many
#     non-fatal steps no-op cleanly. ---
mkdir -p "$WS/.agent/memory/scratch" "$WS/.agent/memory/project" "$WS/.agent/providers" \
         "$WS/.agent/memory/project/missions" "$WS/execution/hooks" "$WS/bin"
printf 'GoldenFixtureProject-F5\n' > "$WS/WORKSPACE"
printf 'v1.0.0\n' > "$WS/.agent/version"
cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-F5", "template_version": "v1.0.0", "onboarding_complete": true, "autonomy": {"level": "medium"}, "identity": {"agent_name": "TestAgent", "project_role": "tester"}}
JSON
touch "$WS/.agent/memory/project/goals.md" "$WS/.agent/memory/project/learned.md"
cp "$TARGET_SRC" "$TARGET"

# STUB update_template.py -- boot invokes it (if it invokes it at all) via a
# cwd-relative path `execution/update_template.py`. Placing a marker-writing
# stub here means "was --apply invoked?" reduces to "does the marker exist
# after boot?" -- the real updater is never reached.
APPLY_MARKER="$WS/.agent/memory/scratch/.apply_was_called"
cat > "$WS/execution/update_template.py" <<PYEOF
#!/usr/bin/env python3
import sys
if "--apply" in sys.argv:
    open("$APPLY_MARKER", "w").close()
sys.exit(0)
PYEOF

# FAKE gh -- dispatches on \$* to fake the upstream-version lookup, and no-ops
# the later `gh auth status` / `gh api user` GITHUB AUTH boot section calls.
case "$MODE" in
  available)
    LATEST_VER_FIXTURE="v2.0.0"
    cat > "$WS/bin/gh" <<GHEOF
#!/usr/bin/env bash
case "\$*" in
  "api repos/InunuNet/Athanor/contents/.agent/version --jq .content")
    echo "$(printf '%s' "$LATEST_VER_FIXTURE" | base64)"
    exit 0
    ;;
  "auth status") exit 1 ;;
  "api user -q .login") echo "fixture-user"; exit 0 ;;
  *) exit 0 ;;
esac
GHEOF
    ;;
  none)
    cat > "$WS/bin/gh" <<GHEOF
#!/usr/bin/env bash
case "\$*" in
  "api repos/InunuNet/Athanor/contents/.agent/version --jq .content")
    echo "$(printf 'v1.0.0' | base64)"
    exit 0
    ;;
  "auth status") exit 1 ;;
  "api user -q .login") echo "fixture-user"; exit 0 ;;
  *) exit 0 ;;
esac
GHEOF
    ;;
  check_fails)
    cat > "$WS/bin/gh" <<'GHEOF'
#!/usr/bin/env bash
case "$*" in
  "api repos/InunuNet/Athanor/contents/.agent/version --jq .content")
    echo "simulated network failure: could not reach github.com" >&2
    exit 1
    ;;
  "auth status") exit 1 ;;
  "api user -q .login") echo "fixture-user"; exit 0 ;;
  *) exit 0 ;;
esac
GHEOF
    ;;
  gh_absent)
    # No gh stub at all -- $WS/bin stays empty of a gh binary, and we run
    # boot with a PATH that excludes any real gh too.
    :
    ;;
esac
[ "$MODE" != "gh_absent" ] && chmod +x "$WS/bin/gh"

# Snapshot the working tree before boot (excluding the boot report itself,
# which isn't written to disk) to prove byte-identical tree after boot.
snapshot() {
  ( cd "$WS" && find . -type f -not -path './.git/*' -exec shasum -a 256 {} \; | sort )
}
BEFORE="$(snapshot)"

run_boot() {
  if [ "$MODE" = "gh_absent" ]; then
    # Strip any real gh from PATH by only exposing a minimal, gh-free PATH
    # plus a handful of standard system dirs boot's other steps rely on
    # (python3, bash builtins, coreutils, base64, jq, git, curl, launchctl).
    ( cd "$WS" && env -i PATH="/usr/bin:/bin:/usr/sbin:/sbin" HOME="$HOME" bash "$TARGET" 2>&1 )
  else
    ( cd "$WS" && PATH="$WS/bin:$PATH" bash "$TARGET" 2>&1 )
  fi
}

OUT="$(run_boot)"
EXIT_CODE=$?
AFTER="$(snapshot)"

fail() {
  echo "FAIL: $MODE -- $1" >&2
  echo "--- boot output ---" >&2
  echo "$OUT" >&2
  exit 1
}

# --- Universal invariants across every scenario ---
if [ "$EXIT_CODE" -ne 0 ]; then
  fail "boot exited non-zero ($EXIT_CODE) -- update check must be fault-isolated, never fatal"
fi
if ! echo "$OUT" | grep -q "BOOT COMPLETE"; then
  fail "boot did not print BOOT COMPLETE"
fi
if [ -f "$APPLY_MARKER" ]; then
  fail "update_template.py --apply WAS invoked (marker file exists) -- boot must never auto-apply"
fi
if [ "$BEFORE" != "$AFTER" ]; then
  fail "working tree changed during boot -- boot must not write/move/delete files"
fi
if echo "$OUT" | grep -qiE "applying\.\.\.|Harness updated"; then
  fail "output contains apply-success/in-progress language ('applying...' / 'Harness updated')"
fi

case "$MODE" in
  available)
    if ! echo "$OUT" | grep -q "make update-template"; then
      fail "no banner naming 'make update-template'"
    fi
    if ! echo "$OUT" | grep -q "v1.0.0"; then
      fail "banner does not name the current version (v1.0.0)"
    fi
    if ! echo "$OUT" | grep -q "v2.0.0"; then
      fail "banner does not name the latest version (v2.0.0)"
    fi
    echo "PASS: available -- banner names both versions + make update-template; --apply never invoked; tree unchanged"
    ;;
  none)
    if echo "$OUT" | grep -q "make update-template"; then
      fail "update banner printed even though CURRENT_VER == LATEST_VER"
    fi
    echo "PASS: none -- no update banner when already up to date; boot completes normally"
    ;;
  check_fails)
    if echo "$OUT" | grep -q "make update-template"; then
      fail "update banner printed despite the version check itself failing"
    fi
    if ! echo "$OUT" | grep -qiE "update check failed|⚠️.*update"; then
      fail "the update check failure was not surfaced anywhere in boot output (still silently swallowed)"
    fi
    echo "PASS: check_fails -- failure surfaced, no banner, no --apply, boot still completes"
    ;;
  gh_absent)
    if echo "$OUT" | grep -q "make update-template"; then
      fail "update banner printed despite gh being entirely absent from PATH"
    fi
    if ! echo "$OUT" | grep -qiE "update check failed|⚠️.*update|gh: command not found|gh: No such file"; then
      fail "no diagnostic surfaced about the failed update check when gh is missing from PATH"
    fi
    echo "PASS: gh_absent -- failure surfaced, no banner, no --apply, boot still completes"
    ;;
esac

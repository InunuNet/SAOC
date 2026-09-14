#!/usr/bin/env bash
# verify_onboarding_flag_reset_1286.sh -- golden-file behavioral check for GitHub issue #1286.
#
# Bug: .agent/profile.json is tracked in git in the Athanor repo itself. Because Athanor is
# itself an onboarded project, that tracked file currently has onboarding_complete: true and
# Athanor's OWN stale identity (project_name: "Athanor", identity.agent_name: "gem"). When a
# brand-new downstream project is scaffolded by cloning the Athanor repo (e.g. via the
# athanor() shell wrapper or a manual git clone) BEFORE init.sh ever runs, the clone brings
# this already-onboarded_complete:true profile.json along. init.sh's write_profile()
# idempotency guard (around line 103-150) only checks `onboarding_complete == true` on the
# target file -- it has no way to tell "this is a genuinely re-onboarded project being
# re-scaffolded" apart from "this is just Athanor's own inherited state riding along in a
# fresh clone" -- so it silently `return 0`s and skips the reset-to-fresh-defaults write,
# leaving the new project stuck claiming onboarding_complete: true with Athanor's own stale
# identity, even though /onboard was never run for it.
#
# Fix contract (locked detection convention -- the dev implementation MUST match this exact
# logic or these goldens will not pass):
#   Two literal marker constants, both referring to ATHANOR'S OWN canonical onboarded
#   identity as currently committed in this repo's own .agent/profile.json:
#     ATHANOR_MARKER_PROJECT_NAME = "Athanor"
#     ATHANOR_MARKER_AGENT_NAME   = "gem"
#   Before honoring the existing `onboarding_complete == true` => skip-overwrite guard,
#   write_profile() must also compute:
#     inherited_clone = (target.project_name == "Athanor") AND
#                        (target.identity.agent_name == "gem")
#   The skip-overwrite (idempotency-preserving) branch fires ONLY when:
#     onboarding_complete == true AND NOT inherited_clone
#   In every other case (onboarding_complete == false, OR inherited_clone == true regardless
#   of onboarding_complete) write_profile() must proceed with the existing full
#   template-copy + field-write path exactly as it does today for a first-time write --
#   resetting onboarding_complete to false, project_name to the resolved $PROJECT_NAME for
#   this invocation, and identity to the existing fresh-write defaults.
#   BOTH markers must match for a profile to be treated as an inherited/unmodified copy of
#   Athanor's own state -- a profile matching only ONE of the two literal values (a
#   coincidental, unrelated match) must NOT be reset. This is deliberate: it is what keeps a
#   genuinely-onboarded downstream project safe even if it happens to share exactly one of
#   the two literal values with Athanor's own defaults.
#
# This script drives the REAL, unmodified execution/../init.sh (bash "$INIT" --path <fixture>
# --name <name>) against isolated tmp fixture directories so no real repo state is touched --
# same convention as execution/checks/verify_init_idempotent.sh.
#
# Usage: verify_onboarding_flag_reset_1286.sh <case>
#   inherited_clone_reset          - GOLDEN / the headline bug: a fresh scaffold's cloned
#                                    profile.json still has Athanor's own literal identity
#                                    (project_name="Athanor", agent_name="gem") and
#                                    onboarding_complete=true. Must be RESET to
#                                    onboarding_complete=false, project_name = the resolved
#                                    new project name, identity = fresh-write defaults.
#                                    Currently FAILS (today's guard only checks
#                                    onboarding_complete and skips) -- must PASS after the fix.
#   real_onboarded_preserved       - GOLDEN / regression guard: a genuinely-onboarded existing
#                                    project (project_name = its OWN real name, distinct from
#                                    "Athanor"; identity.agent_name = its OWN real onboarded
#                                    name, distinct from "gem"; onboarding_complete=true; plus
#                                    a custom marker field) re-running init.sh in place. Must
#                                    be preserved byte-for-byte -- this is the existing
#                                    idempotency behavior and must not regress. Already PASSES
#                                    today -- must continue to PASS after the fix.
#   no_profile_fresh_write         - GOLDEN: no .agent/profile.json exists at all yet (true
#                                    first-time scaffold). Normal first-time write path,
#                                    entirely unaffected by this fix. PASSES both before and
#                                    after.
#   not_onboarded_yet_overwritten  - Regression guard: an existing profile.json with
#                                    onboarding_complete=false (mid-onboarding, or never
#                                    finished) is always fully overwritten today regardless of
#                                    its project_name/identity values. Must remain fully
#                                    overwritten after the fix too (the new inherited_clone
#                                    check must only ever ADD a reset path, never subtract
#                                    one). PASSES both before and after.
#   trap_agent_name_coincidence    - TRAP: profile.json's identity.agent_name coincidentally
#                                    equals "gem" (a real downstream project's own
#                                    independently-chosen onboarded agent name), but
#                                    project_name is genuinely NOT "Athanor" (a real distinct
#                                    onboarded project name) and onboarding_complete=true.
#                                    Only ONE of the two markers matches -- must NOT be reset;
#                                    preserved byte-for-byte. PASSES both before and after (a
#                                    correct fix must never fire on a single coincidental
#                                    field match).
#   trap_project_name_coincidence  - TRAP: profile.json's project_name coincidentally equals
#                                    "Athanor" (a real downstream project that was genuinely,
#                                    honestly onboarded while keeping that literal name), but
#                                    identity.agent_name is genuinely NOT "gem" (its own real
#                                    onboarded agent identity) and onboarding_complete=true.
#                                    Only ONE of the two markers matches -- must NOT be reset;
#                                    preserved byte-for-byte. PASSES both before and after.
#   self_repo_preserved            - CRITICAL / QA-found bug #1: a fake stand-in "self repo"
#                                    (a copy of init.sh + template/ living together, i.e. the
#                                    exact directory topology of a genuine Athanor checkout)
#                                    has its OWN .agent/profile.json already seeded with
#                                    Athanor's real markers (project_name="Athanor",
#                                    identity.agent_name="gem") and onboarding_complete=true --
#                                    its genuine, correct, already-onboarded identity as itself.
#                                    init.sh is invoked IN PLACE from inside this directory with
#                                    no --path/--name override, so PROJECT_PATH resolves to the
#                                    exact same absolute path as SCRIPT_DIR -- reproducing
#                                    "running init.sh directly inside a real Athanor checkout".
#                                    Marker match + self-repo topology must NEVER be reset --
#                                    self-repo status overrides the inherited_clone marker check
#                                    entirely. Currently FAILS (today's inherited_clone check is
#                                    purely value-based and cannot tell "genuinely self" apart
#                                    from "inherited clone", so it wrongly resets) -- must PASS
#                                    after the fix. A disposable fake repo is used (never the
#                                    real $REPO_ROOT) so this check can never corrupt real state.
#   identity_null_preserved        - CRITICAL / QA-found bug #2: an existing, genuinely
#                                    onboarded profile.json has onboarding_complete=true and
#                                    identity: null (an explicit JSON null, not an absent key) --
#                                    e.g. a project that cleared its identity block for some
#                                    legitimate reason. Must NOT crash and must NOT be treated as
#                                    an inherited_clone; must be preserved byte-for-byte (the
#                                    conservative default for unconfirmable/malformed identity is
#                                    "don't reset", same direction as the missing-key case which
#                                    already works). Currently FAILS: today's guard does
#                                    p.get('identity', {}).get('agent_name'), and .get(key,
#                                    default) only applies the default when the KEY IS ABSENT,
#                                    not when its value is None -- so this raises AttributeError
#                                    on None, is swallowed by the broad except, and forces
#                                    already_onboarded=false unconditionally, causing a FULL
#                                    destructive overwrite of a real onboarded project (worse
#                                    than doing nothing). Must PASS after the fix.
#   symlink_self_repo_preserved    - CRITICAL / QA round-2-found bug #3: the same disposable
#                                    fake self-repo topology as self_repo_preserved, but init.sh
#                                    is invoked THROUGH A SYMLINK pointing at the fake repo's
#                                    init.sh, from a shell whose $PWD is the fake repo's real
#                                    physical path (not the symlink). SCRIPT_DIR is derived from
#                                    $0's directory (the symlink path) via plain `cd ... && pwd`
#                                    (logical, does not resolve symlinks), while PROJECT_PATH
#                                    defaults to $PWD (the real physical path already, since we
#                                    cd'd there directly). The two are the SAME directory on disk
#                                    but differ as strings, so self_repo == false even though this
#                                    is genuinely a self-repo invocation -- reproducing the exact
#                                    destructive self-reset this contract was built to prevent, in
#                                    a symlinked-checkout scenario (dotfile managers, synced
#                                    folders, etc). Must be preserved byte-for-byte. Currently
#                                    FAILS (today's SCRIPT_DIR/PROJECT_PATH computation uses
#                                    logical `cd && pwd`, not physical `cd -P && pwd`, so symlink
#                                    components are not canonicalized away) -- must PASS after the
#                                    fix (cd -P for both). A disposable fake repo + a disposable
#                                    symlink under $WS are used -- never the real $REPO_ROOT --
#                                    so this check can never corrupt real repo state.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INIT="$REPO_ROOT/init.sh"
CASE="${1:-}"

WS="$(mktemp -d)"
cleanup() { /bin/rm -rf "$WS" 2>/dev/null || true; }
trap cleanup EXIT

TARGET="$WS/.agent/profile.json"
NEW_NAME="Shri Savant"

# self_repo_preserved is handled entirely separately from the generic
# seed -> run(--path $WS) -> compare flow below: it needs init.sh invoked
# IN PLACE (no --path override) from inside a directory whose layout mirrors
# a real Athanor checkout (init.sh + template/ side by side), so that
# PROJECT_PATH (defaults to $PWD) resolves to the exact same absolute path
# as SCRIPT_DIR ($(dirname "$0")). A disposable fake repo under $WS is used
# so this can never touch the real $REPO_ROOT even while the bug is unfixed.
if [ "$CASE" = "self_repo_preserved" ]; then
  FAKE_REPO="$WS/fake_self_repo"
  mkdir -p "$FAKE_REPO/.agent" "$FAKE_REPO/.gemini/policies" "$FAKE_REPO/.claude/rules"
  cp "$INIT" "$FAKE_REPO/init.sh"
  cp -R "$REPO_ROOT/template" "$FAKE_REPO/template"
  # main()'s pipeline unconditionally calls "$SCRIPT_DIR/execution/manage_pulse.sh"
  # (no fallback/guard) at the very end, and several setup_* steps opportunistically
  # cp from $SCRIPT_DIR/.gemini, $SCRIPT_DIR/.claude, $SCRIPT_DIR/.agent/{agents,
  # skills,workflows,providers} and $SCRIPT_DIR/AGENTS.md (all guarded with
  # `|| true`, so optional, but copied here anyway for full end-to-end fidelity
  # with a real checkout so the run completes with rc=0 like it would for real).
  cp -R "$REPO_ROOT/execution" "$FAKE_REPO/execution"
  cp -R "$REPO_ROOT/.agent/agents" "$FAKE_REPO/.agent/agents" 2>/dev/null || true
  cp -R "$REPO_ROOT/.agent/skills" "$FAKE_REPO/.agent/skills" 2>/dev/null || true
  cp -R "$REPO_ROOT/.agent/workflows" "$FAKE_REPO/.agent/workflows" 2>/dev/null || true
  cp -R "$REPO_ROOT/.agent/providers" "$FAKE_REPO/.agent/providers" 2>/dev/null || true
  cp "$REPO_ROOT/.agent/version" "$FAKE_REPO/.agent/version" 2>/dev/null || true
  cp "$REPO_ROOT/.agent/handoffs.yaml" "$FAKE_REPO/.agent/handoffs.yaml" 2>/dev/null || true
  cp "$REPO_ROOT/.agent/update-manifest.yaml" "$FAKE_REPO/.agent/update-manifest.yaml" 2>/dev/null || true
  cp "$REPO_ROOT/.gemini/settings.json" "$FAKE_REPO/.gemini/settings.json" 2>/dev/null || true
  cp "$REPO_ROOT/.gemini/policies/autonomy.toml" "$FAKE_REPO/.gemini/policies/autonomy.toml" 2>/dev/null || true
  cp -R "$REPO_ROOT/.claude/rules/"*.md "$FAKE_REPO/.claude/rules/" 2>/dev/null || true
  cp "$REPO_ROOT/.claude/settings.json" "$FAKE_REPO/.claude/settings.json" 2>/dev/null || true
  cp "$REPO_ROOT/AGENTS.md" "$FAKE_REPO/AGENTS.md" 2>/dev/null || true

  FAKE_TARGET="$FAKE_REPO/.agent/profile.json"
  python3 -c "
import json
data = {
    'project_name': 'Athanor',
    'project_type': 'saas',
    'soul_type': 'engineer',
    'status': 'active',
    'onboarding_complete': True,
    'primary_platform': 'macos',
    'tech_stack': ['python'],
    'identity': {'agent_name': 'gem', 'project_role': 'Real Athanor Role'},
    'template_version': '0.0.0',
    'autonomy': {'level': 'high'},
    'custom_marker': 'REAL-SELF-REPO-DO-NOT-TOUCH',
}
json.dump(data, open('$FAKE_TARGET', 'w'), indent=2)
"
  BEFORE_JSON="$(cat "$FAKE_TARGET")"

  OUT="$(cd "$FAKE_REPO" && bash ./init.sh 2>&1)"
  RC=$?

  if [ "$RC" -ne 0 ]; then
    echo "FAIL: init.sh exited $RC for case 'self_repo_preserved'" >&2
    echo "$OUT" >&2
    exit 1
  fi

  if [ ! -f "$FAKE_TARGET" ]; then
    echo "FAIL: $FAKE_TARGET does not exist after init.sh ran for case 'self_repo_preserved'" >&2
    exit 1
  fi

  AFTER_JSON="$(cat "$FAKE_TARGET")"
  if [ "$AFTER_JSON" != "$BEFORE_JSON" ]; then
    echo "FAIL: self_repo_preserved case -- profile.json was modified even though PROJECT_PATH == SCRIPT_DIR (init.sh run in place inside its own repo); a repo's own onboarded identity must never be reset by the inherited_clone marker check" >&2
    echo "--- before ---" >&2; echo "$BEFORE_JSON" >&2
    echo "--- after ---" >&2; echo "$AFTER_JSON" >&2
    exit 1
  fi
  echo "PASS: self_repo_preserved case -- init.sh run in place against its own repo (PROJECT_PATH == SCRIPT_DIR) left its own onboarded identity untouched"
  exit 0
fi

# symlink_self_repo_preserved is a variant of self_repo_preserved: same fake-repo topology
# and same seeded profile, but init.sh is invoked THROUGH A SYMLINK pointing at the fake
# repo's init.sh, from a shell whose $PWD is the fake repo's own real physical path (not the
# symlink path). This reproduces QA round 2's live-reproduced symlink canonicalization gap:
# SCRIPT_DIR = dirname($0) = the symlink path (logical `cd && pwd` does not resolve the
# symlink), while PROJECT_PATH defaults to $PWD = the real physical path already. Same
# directory on disk, different strings -- self_repo wrongly evaluates to false.
if [ "$CASE" = "symlink_self_repo_preserved" ]; then
  FAKE_REPO="$WS/fake_self_repo_symlinked"
  mkdir -p "$FAKE_REPO/.agent" "$FAKE_REPO/.gemini/policies" "$FAKE_REPO/.claude/rules"
  cp "$INIT" "$FAKE_REPO/init.sh"
  cp -R "$REPO_ROOT/template" "$FAKE_REPO/template"
  cp -R "$REPO_ROOT/execution" "$FAKE_REPO/execution"
  cp -R "$REPO_ROOT/.agent/agents" "$FAKE_REPO/.agent/agents" 2>/dev/null || true
  cp -R "$REPO_ROOT/.agent/skills" "$FAKE_REPO/.agent/skills" 2>/dev/null || true
  cp -R "$REPO_ROOT/.agent/workflows" "$FAKE_REPO/.agent/workflows" 2>/dev/null || true
  cp -R "$REPO_ROOT/.agent/providers" "$FAKE_REPO/.agent/providers" 2>/dev/null || true
  cp "$REPO_ROOT/.agent/version" "$FAKE_REPO/.agent/version" 2>/dev/null || true
  cp "$REPO_ROOT/.agent/handoffs.yaml" "$FAKE_REPO/.agent/handoffs.yaml" 2>/dev/null || true
  cp "$REPO_ROOT/.agent/update-manifest.yaml" "$FAKE_REPO/.agent/update-manifest.yaml" 2>/dev/null || true
  cp "$REPO_ROOT/.gemini/settings.json" "$FAKE_REPO/.gemini/settings.json" 2>/dev/null || true
  cp "$REPO_ROOT/.gemini/policies/autonomy.toml" "$FAKE_REPO/.gemini/policies/autonomy.toml" 2>/dev/null || true
  cp -R "$REPO_ROOT/.claude/rules/"*.md "$FAKE_REPO/.claude/rules/" 2>/dev/null || true
  cp "$REPO_ROOT/.claude/settings.json" "$FAKE_REPO/.claude/settings.json" 2>/dev/null || true
  cp "$REPO_ROOT/AGENTS.md" "$FAKE_REPO/AGENTS.md" 2>/dev/null || true

  # The symlink itself lives OUTSIDE the fake repo's own directory tree, pointing at it --
  # mirroring a dotfile-manager/synced-folder setup where the checkout is symlinked in from
  # elsewhere. init.sh is invoked as "$SYMLINK/init.sh" while $PWD is the real physical
  # $FAKE_REPO (not the symlink), so PROJECT_PATH and SCRIPT_DIR are computed from two
  # different path strings for the identical on-disk directory.
  SYMLINK="$WS/symlink_to_fake_repo"
  ln -s "$FAKE_REPO" "$SYMLINK"

  FAKE_TARGET="$FAKE_REPO/.agent/profile.json"
  python3 -c "
import json
data = {
    'project_name': 'Athanor',
    'project_type': 'saas',
    'soul_type': 'engineer',
    'status': 'active',
    'onboarding_complete': True,
    'primary_platform': 'macos',
    'tech_stack': ['python'],
    'identity': {'agent_name': 'gem', 'project_role': 'Real Athanor Role'},
    'template_version': '0.0.0',
    'autonomy': {'level': 'high'},
    'custom_marker': 'REAL-SYMLINKED-SELF-REPO-DO-NOT-TOUCH',
}
json.dump(data, open('$FAKE_TARGET', 'w'), indent=2)
"
  BEFORE_JSON="$(cat "$FAKE_TARGET")"

  OUT="$(cd "$FAKE_REPO" && bash "$SYMLINK/init.sh" 2>&1)"
  RC=$?

  if [ "$RC" -ne 0 ]; then
    echo "FAIL: init.sh exited $RC for case 'symlink_self_repo_preserved'" >&2
    echo "$OUT" >&2
    exit 1
  fi

  if [ ! -f "$FAKE_TARGET" ]; then
    echo "FAIL: $FAKE_TARGET does not exist after init.sh ran for case 'symlink_self_repo_preserved'" >&2
    exit 1
  fi

  AFTER_JSON="$(cat "$FAKE_TARGET")"
  if [ "$AFTER_JSON" != "$BEFORE_JSON" ]; then
    echo "FAIL: symlink_self_repo_preserved case -- profile.json was modified even though the invocation was genuinely self-repo (same physical directory on disk for SCRIPT_DIR and PROJECT_PATH); invoking init.sh through a symlink to its own repo must not defeat the self-repo detection" >&2
    echo "--- before ---" >&2; echo "$BEFORE_JSON" >&2
    echo "--- after ---" >&2; echo "$AFTER_JSON" >&2
    exit 1
  fi
  echo "PASS: symlink_self_repo_preserved case -- init.sh invoked via a symlink to its own repo (same physical directory, different path strings) left its own onboarded identity untouched"
  exit 0
fi

seed_profile() {
  # $1 = project_name, $2 = agent_name, $3 = onboarding_complete ("true"/"false")
  mkdir -p "$WS/.agent"
  python3 -c "
import json, sys
path, name, agent, onboarded = sys.argv[1:5]
data = {
    'project_name': name,
    'project_type': 'saas',
    'soul_type': 'engineer',
    'status': 'active',
    'onboarding_complete': onboarded == 'true',
    'primary_platform': 'macos',
    'tech_stack': ['python'],
    'identity': {'agent_name': agent, 'project_role': 'Real Onboarded Role'},
    'template_version': '0.0.0',
    'autonomy': {'level': 'high'},
    'custom_marker': 'REAL-ONBOARDED-DO-NOT-TOUCH',
}
json.dump(data, open(path, 'w'), indent=2)
" "$TARGET" "$1" "$2" "$3"
}

case "$CASE" in
  inherited_clone_reset)
    # Cloned copy of Athanor's own already-onboarded profile.json riding along BEFORE
    # /onboard ever ran for the new project.
    seed_profile "Athanor" "gem" "true"
    ;;
  real_onboarded_preserved)
    seed_profile "$NEW_NAME" "Nova" "true"
    ;;
  no_profile_fresh_write)
    : # no .agent/profile.json at all
    ;;
  not_onboarded_yet_overwritten)
    seed_profile "$NEW_NAME" "Nova" "false"
    ;;
  trap_agent_name_coincidence)
    seed_profile "$NEW_NAME" "gem" "true"
    ;;
  trap_project_name_coincidence)
    seed_profile "Athanor" "Nova" "true"
    ;;
  identity_null_preserved)
    # Genuinely onboarded project whose identity block is an explicit JSON
    # null (not an absent key). Bug #2: p.get('identity', {}).get(...) does
    # NOT apply the {} default here because the key IS present (its value is
    # just None) -- .get(key, default) only substitutes default when the key
    # is ABSENT. So this raises AttributeError on None.get(...), which the
    # broad except swallows, forcing already_onboarded=false and triggering
    # a full destructive overwrite of a real onboarded project.
    #
    # project_name is deliberately set to the literal "Athanor" marker value:
    # today's inherited/`and`-chained check is
    #   p.get('project_name') == 'Athanor' and p.get('identity', {}).get('agent_name') == 'gem'
    # Python short-circuits `and` on a False left side, so the
    # identity.get(...) call (and the crash) is only ever reached when
    # project_name == 'Athanor'. This is itself a real, legitimate scenario
    # (a project honestly named "Athanor" with a since-cleared identity
    # block) and is exactly the combination that reproduces QA's finding.
    mkdir -p "$WS/.agent"
    python3 -c "
import json
data = {
    'project_name': 'Athanor',
    'project_type': 'saas',
    'soul_type': 'engineer',
    'status': 'active',
    'onboarding_complete': True,
    'primary_platform': 'macos',
    'tech_stack': ['python'],
    'identity': None,
    'template_version': '0.0.0',
    'autonomy': {'level': 'high'},
    'custom_marker': 'REAL-ONBOARDED-NULL-IDENTITY-DO-NOT-TOUCH',
}
json.dump(data, open('$TARGET', 'w'), indent=2)
"
    ;;
  *)
    echo "FAIL: unknown case '$CASE' (expected inherited_clone_reset|real_onboarded_preserved|no_profile_fresh_write|not_onboarded_yet_overwritten|trap_agent_name_coincidence|trap_project_name_coincidence|self_repo_preserved|identity_null_preserved|symlink_self_repo_preserved)" >&2
    exit 1
    ;;
esac

BEFORE_JSON=""
[ -f "$TARGET" ] && BEFORE_JSON="$(cat "$TARGET")"

OUT="$(bash "$INIT" --path "$WS" --name "$NEW_NAME" 2>&1)"
RC=$?

if [ "$RC" -ne 0 ]; then
  echo "FAIL: init.sh exited $RC for case '$CASE'" >&2
  echo "$OUT" >&2
  exit 1
fi

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist after init.sh ran for case '$CASE'" >&2
  exit 1
fi

case "$CASE" in
  inherited_clone_reset)
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1]))
errs = []
if p.get('onboarding_complete') is not False:
    errs.append('onboarding_complete not reset to False: %r' % (p.get('onboarding_complete'),))
if p.get('project_name') != sys.argv[2]:
    errs.append('project_name not reset to %r: %r' % (sys.argv[2], p.get('project_name')))
if p.get('identity', {}).get('agent_name') == 'gem':
    errs.append('identity.agent_name still Athanor\\'s own stale value \"gem\" -- not reset')
if 'custom_marker' in p:
    errs.append('stale custom_marker survived the reset -- old file was not actually overwritten')
if errs:
    print('FAIL: ' + '; '.join(errs))
    sys.exit(1)
print('PASS: inherited_clone_reset case -- Athanor\\'s own inherited onboarded_complete=true profile was correctly reset to fresh defaults for the new project')
" "$TARGET" "$NEW_NAME" || exit 1
    ;;

  real_onboarded_preserved)
    AFTER_JSON="$(cat "$TARGET")"
    if [ "$AFTER_JSON" != "$BEFORE_JSON" ]; then
      echo "FAIL: real_onboarded_preserved case -- profile.json was modified, expected byte-for-byte preservation" >&2
      echo "--- before ---" >&2; echo "$BEFORE_JSON" >&2
      echo "--- after ---" >&2; echo "$AFTER_JSON" >&2
      exit 1
    fi
    echo "PASS: real_onboarded_preserved case -- genuinely onboarded project untouched by re-running init.sh"
    ;;

  no_profile_fresh_write)
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1]))
errs = []
if p.get('onboarding_complete') is not False:
    errs.append('onboarding_complete not False on first-time write: %r' % (p.get('onboarding_complete'),))
if p.get('project_name') != sys.argv[2]:
    errs.append('project_name not set to %r: %r' % (sys.argv[2], p.get('project_name')))
if errs:
    print('FAIL: ' + '; '.join(errs))
    sys.exit(1)
print('PASS: no_profile_fresh_write case -- normal first-time write path unaffected')
" "$TARGET" "$NEW_NAME" || exit 1
    ;;

  not_onboarded_yet_overwritten)
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1]))
errs = []
if p.get('onboarding_complete') is not False:
    errs.append('onboarding_complete not False: %r' % (p.get('onboarding_complete'),))
if p.get('project_name') != sys.argv[2]:
    errs.append('project_name not set to %r: %r' % (sys.argv[2], p.get('project_name')))
if 'custom_marker' in p:
    errs.append('stale custom_marker survived -- expected full overwrite since onboarding_complete was false')
if errs:
    print('FAIL: ' + '; '.join(errs))
    sys.exit(1)
print('PASS: not_onboarded_yet_overwritten case -- mid-onboarding profile still fully overwritten as before')
" "$TARGET" "$NEW_NAME" || exit 1
    ;;

  trap_agent_name_coincidence|trap_project_name_coincidence)
    AFTER_JSON="$(cat "$TARGET")"
    if [ "$AFTER_JSON" != "$BEFORE_JSON" ]; then
      echo "FAIL: $CASE case -- profile.json was modified even though only ONE of the two Athanor markers coincidentally matched; expected byte-for-byte preservation" >&2
      echo "--- before ---" >&2; echo "$BEFORE_JSON" >&2
      echo "--- after ---" >&2; echo "$AFTER_JSON" >&2
      exit 1
    fi
    echo "PASS: $CASE case -- single coincidental marker match did not trigger a false reset"
    ;;

  identity_null_preserved)
    AFTER_JSON="$(cat "$TARGET")"
    if [ "$AFTER_JSON" != "$BEFORE_JSON" ]; then
      echo "FAIL: identity_null_preserved case -- profile.json was modified (or crashed and got treated as not-onboarded) even though onboarding_complete=true; identity:null must not cause a destructive overwrite" >&2
      echo "--- before ---" >&2; echo "$BEFORE_JSON" >&2
      echo "--- after ---" >&2; echo "$AFTER_JSON" >&2
      exit 1
    fi
    echo "PASS: identity_null_preserved case -- explicit identity:null did not crash the guard or trigger a false destructive overwrite"
    ;;
esac

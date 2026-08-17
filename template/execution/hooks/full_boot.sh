#!/usr/bin/env bash
# full_boot.sh — SessionStart command hook
# Executes the full Athanor boot sequence and injects context into the session.
# Runs from project root. All steps are non-fatal (|| true).

WORKSPACE_FILE="WORKSPACE"
PROFILE_FILE=".agent/profile.json"

echo "✅ ATHANOR: $(cat WORKSPACE 2>/dev/null || basename "$PWD") | Athanor Harness v$(cat .agent/version 2>/dev/null || echo 'unknown')"
echo "════ BOOT CONTEXT (Athanor Harness) ════"
echo "Core Mandates: Specialized agents, Tiered memory, Autonomous self-improvement, Alembic (URL distilling)."
echo ""

# HARNESS-completeness check (issue #1311): a partially-propagated project can be
# missing the harness's own executables entirely. Detect that up front with a loud,
# actionable message instead of letting downstream steps misreport it (e.g. as a
# stale mission pointer). Non-fatal — boot must never abort on this.
_HARNESS_MISSING=""
for _critical_file in execution/mission.py execution/contract.py; do
  [ -f "$_critical_file" ] || _HARNESS_MISSING="$_HARNESS_MISSING $_critical_file"
done
if [ -n "$_HARNESS_MISSING" ]; then
  echo "⛔ HARNESS INCOMPLETE — missing:$_HARNESS_MISSING"
  echo "   Propagation failed. Run: python3 execution/update_template.py --apply"
  echo ""
fi
unset _HARNESS_MISSING _critical_file

# Auto-update check: compare local template_version to upstream
# Prefer .agent/.template_state (updater-owned, written on every fully
# successful --apply run) over profile.json, which can lag or never move if
# a prior run bailed early — falls back to profile.json when state file is
# missing or unparsable (issue #1295/#1312).
CURRENT_VER=$(python3 -c "import json; print(json.load(open('.agent/.template_state')).get('template_version','0'))" 2>/dev/null || python3 -c "import json; print(json.load(open('.agent/profile.json')).get('template_version','0'))" 2>/dev/null || echo "0")
_UPDATE_CHECK_ERR=$(mktemp)
_UPDATE_CHECK_OUT=$(mktemp)
# Bound the `gh api` call so a blackholed call can never hang boot. `timeout`/
# `gtimeout` (Homebrew coreutils) aren't present on stock macOS, so this must
# not hard-depend on either — falling back to `timeout` unconditionally would
# silently disable the update check (not just the bound) on any clean Mac.
# When neither binary is on PATH, background the call and poll-and-kill it
# ourselves: the check still actually runs, it's just bounded by hand.
# Resolved once, here, and reused (not re-derived) by the GITHUB AUTH section
# below (~line 380+) for the same reason — nothing unsets it in between.
_GH_TIMEOUT_BIN="$(command -v timeout 2>/dev/null || command -v gtimeout 2>/dev/null || echo "")"
if [ -n "$_GH_TIMEOUT_BIN" ]; then
  LATEST_VER=$("$_GH_TIMEOUT_BIN" 3 gh api repos/InunuNet/Athanor/contents/.agent/version --jq '.content' 2>"$_UPDATE_CHECK_ERR" | base64 -d 2>>"$_UPDATE_CHECK_ERR" | tr -d '\n' || echo "")
else
  gh api repos/InunuNet/Athanor/contents/.agent/version --jq '.content' >"$_UPDATE_CHECK_OUT" 2>"$_UPDATE_CHECK_ERR" &
  _GH_PID=$!
  _WAITED=0
  while kill -0 "$_GH_PID" 2>/dev/null && [ "$_WAITED" -lt 3 ]; do
    sleep 1
    _WAITED=$((_WAITED + 1))
  done
  if kill -0 "$_GH_PID" 2>/dev/null; then
    kill -9 "$_GH_PID" 2>/dev/null
    wait "$_GH_PID" 2>/dev/null
    echo "gh api timed out after ${_WAITED}s (no timeout/gtimeout on PATH — bounded via background poll-kill fallback)" >> "$_UPDATE_CHECK_ERR"
    LATEST_VER=""
  else
    wait "$_GH_PID" 2>/dev/null
    LATEST_VER=$(base64 -d <"$_UPDATE_CHECK_OUT" 2>>"$_UPDATE_CHECK_ERR" | tr -d '\n')
  fi
  unset _GH_PID _WAITED
fi
if [ -z "$LATEST_VER" ] && [ -s "$_UPDATE_CHECK_ERR" ]; then
  # Redact token-shaped substrings and cap length before echoing gh's raw
  # stderr into boot output — an unbounded/unredacted blob must never reach
  # session output verbatim.
  _ERR_MSG=$(tail -c 500 "$_UPDATE_CHECK_ERR" 2>/dev/null | tr -d '\n' | sed -E 's/[A-Za-z0-9_]{20,}/[redacted]/g' | cut -c1-100)
  echo "⚠️  update check failed: $_ERR_MSG"
  unset _ERR_MSG
fi
rm -f "$_UPDATE_CHECK_ERR" "$_UPDATE_CHECK_OUT"
unset _UPDATE_CHECK_ERR _UPDATE_CHECK_OUT _GH_TIMEOUT_BIN
ACTIVE_MISSION=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path('.agent/memory/project/missions/active.json').read_text()); print(d.get('mission') or '')" 2>/dev/null || echo "")
# Detect-and-prompt only — boot never applies template updates itself, in either
# the mission-active or no-mission case. See .claude/rules/behavior.md "Ask
# Before Destructive Actions" and mission harness-integrity-hardening F5.
if [[ -n "$LATEST_VER" && "$CURRENT_VER" != "$LATEST_VER" ]]; then
  echo "⬆️  HARNESS UPDATE AVAILABLE: template $CURRENT_VER → $LATEST_VER"
  echo "   Run 'make update-template' to review and apply it (boot never applies updates automatically)."
fi

python3 execution/checks/verify_model_env_boot.py boot_report || true  # Model-env boot guard (#1332), non-fatal

# Step 0.5: Quota-death warm restart — one-shot checkpoint left by quota_death_checkpoint.sh (StopFailure)
QUOTA_CP=".agent/memory/scratch/.quota_death_checkpoint.json"
if [ -f "$QUOTA_CP" ]; then
  echo "--- QUOTA RECOVERY ---"
  jq -r '.recovery_message // "⚡ QUOTA RECOVERY: prior session died — see .quota_death_checkpoint.json"' "$QUOTA_CP" 2>/dev/null || echo "⚡ QUOTA RECOVERY: prior session died"
  MISSION_NAME="$(jq -r '.active_mission // empty' "$QUOTA_CP" 2>/dev/null || true)"
  if [ -n "$MISSION_NAME" ] && [ "$MISSION_NAME" != "null" ]; then
    echo "   Active mission at death: $MISSION_NAME"
  fi
  rm -f "$QUOTA_CP" 2>/dev/null || true   # one-shot: consume so we never replay
  echo ""
fi

echo "--- ACTIVE MISSION ---"
# wrap_mission.sh's own clear step (post close-out) writes active.json as
# {"mission": null, ...} rather than unlinking it -- so gate on the "mission"
# field being non-null/non-empty, not merely on the file existing, or a
# freshly-closed mission misreports as a stale pointer here (issue: F3 QA).
ACTIVE_MISSION_SLUG=""
if [ -f .agent/memory/project/missions/active.json ]; then
  ACTIVE_MISSION_SLUG=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path('.agent/memory/project/missions/active.json').read_text()); print(d.get('mission') or '')" 2>/dev/null || echo "")
fi
if [ -n "$ACTIVE_MISSION_SLUG" ]; then
  if [ -f execution/mission.py ]; then
    python3 execution/mission.py status "$ACTIVE_MISSION_SLUG" 2>/dev/null || echo "(stale mission pointer — run: python3 execution/mission.py list)"
  else
    echo "⛔ HARNESS INCOMPLETE — missing: execution/mission.py"
    echo "   Propagation failed. Run: python3 execution/update_template.py --apply"
  fi
  MISSION_STATUS=""
  if [ -n "$ACTIVE_MISSION_SLUG" ]; then
    MISSION_FILE=$(find .agent/memory/project/missions -maxdepth 1 -name "${ACTIVE_MISSION_SLUG}" 2>/dev/null | head -1)
    if [ -n "$MISSION_FILE" ] && [ -f "$MISSION_FILE" ]; then
      MISSION_STATUS=$(grep -m1 '^status:' "$MISSION_FILE" 2>/dev/null | sed 's/^status:[[:space:]]*//' | tr -d ' ' || echo "")
    fi
  fi

  case "$MISSION_STATUS" in
    in_progress|pending)
      echo "⚡ PROCEED: Run 'python3 execution/mission.py resume' NOW and continue the chain immediately. Do not wait for confirmation."
      ;;
    blocked)
      echo "⛔ MISSION BLOCKED: resolve the blocker before proceeding."
      ;;
    close_out)
      echo "⚠️  CLOSE-OUT REQUIRED: dispatch @maintainer — mission awaiting wrap-up. Run: python3 execution/mission.py close-out <mission-file>"
      ;;
    *)
      echo "→ Run /mission resume to continue."
      ;;
  esac
else
  echo "No active mission. Pick a top item from the mission queue (.agent/memory/project/backlog.md) and run /mission new <slug> before starting substantive work. Trivial items may be handled directly per the workflow reminder below."
fi
echo ""

# Inject AUTONOMOUS MODE directive when level=loop
_BOOT_LEVEL=$(jq -r '.autonomy.level // "medium"' .agent/profile.json 2>/dev/null || echo "medium")
if [ "$_BOOT_LEVEL" = "loop" ]; then
  echo "--- AUTONOMOUS MODE ---"
  echo "AUTONOMOUS MODE ACTIVE — complete active mission, then pick next backlog item"
  echo "and start immediately. Do not stop or wait for user input between missions."
  echo "Loop continues until interrupted (make set-autonomy LEVEL=medium) or backlog empty."
  echo "---"
  echo ""
fi
unset _BOOT_LEVEL

# Autonomy mismatch check -- warn if any provider cannot honor current level
AUTONOMY_LEVEL=$(python3 -c "import json,pathlib; p=pathlib.Path('.agent/profile.json'); d=json.loads(p.read_text()) if p.exists() else {}; print(d.get('autonomy',{}).get('level','medium'))" 2>/dev/null || echo "medium")
case "$AUTONOMY_LEVEL" in
  off|low|medium)
    : ;;  # no warning needed for low autonomy levels
  high|loop)
    python3 - <<"MISMATCH_PYEOF" 2>/dev/null || true
import json, pathlib
LEVEL_ORDER = ['off', 'low', 'medium', 'high', 'loop']
def level_rank(l):
    try: return LEVEL_ORDER.index(l)
    except: return 2
profile = json.loads(pathlib.Path('.agent/profile.json').read_text())
current_level = profile.get('autonomy', {}).get('level', 'medium')
current_rank = level_rank(current_level)
mismatches = []
for mf in sorted(pathlib.Path('.agent/providers').glob('*.json')):
    try:
        data = json.loads(mf.read_text())
        max_level = data.get('autonomy', {}).get('max_honerable_level', 'medium')
        if current_rank > level_rank(max_level):
            mismatches.append((data.get('provider', mf.stem), max_level))
    except:
        pass
if mismatches:
    print('--- AUTONOMY MISMATCH ---')
    for provider, max_level in mismatches:
        print(f'⚠️  AUTONOMY MISMATCH: {provider} max_honerable_level={max_level}, current={current_level}')
    print('   These providers may still prompt for approval despite autonomy setting.')
    print('')
MISMATCH_PYEOF
    ;;
esac

COMMS_FILE=".agent/memory/project/comms.md"
COMMS_HASH_FILE=".agent/memory/scratch/.comms_last_hash"
if [ -f "$COMMS_FILE" ]; then
  LATEST_DIRECTIVE=""
  LAST_CODI_LINE=$(grep -n "^## \[CODI" "$COMMS_FILE" 2>/dev/null | tail -1 | cut -d: -f1)
  if [ -n "$LAST_CODI_LINE" ]; then
    LATEST_DIRECTIVE=$(awk -v startline="$LAST_CODI_LINE" 'NR > startline { if (/^## \[/) {exit} count++; if(count>=40){print "[truncated — read full comms.md]"; exit} print }' "$COMMS_FILE" 2>/dev/null)
  fi
  if [ -n "$LATEST_DIRECTIVE" ]; then
    NEW_COMMS_HASH=$(printf '%s' "$LATEST_DIRECTIVE" | shasum -a 256 | awk '{print $1}')
    CACHED_COMMS_HASH=$(cat "$COMMS_HASH_FILE" 2>/dev/null || echo "")
    if [ "$NEW_COMMS_HASH" != "$CACHED_COMMS_HASH" ]; then
      echo "--- LATEST DIRECTIVE (comms.md) ---"
      echo "$LATEST_DIRECTIVE"
      echo "---"
      echo ""
      printf '%s' "$NEW_COMMS_HASH" > "$COMMS_HASH_FILE"
    fi
  fi
fi

# Step 0: System Identity
echo "--- SYSTEM IDENTITY ---"
python3 -c "
import json
with open('.agent/profile.json') as f:
    p = json.load(f)
identity = p.get('identity', {})
name = identity.get('agent_name', 'Athanor Agent')
role = identity.get('project_role', 'project coordinator')
print(f'Identity: {name} | Role: {role} | Identity Status: Active')
" 2>/dev/null || echo "Identity: Athanor Agent | Identity Status: Active"
echo ""

# Step 0.5: Discovery & Capabilities
if [ -f "execution/discovery.sh" ]; then
  bash execution/discovery.sh
elif [ -f "discovery.sh" ]; then
  bash discovery.sh
fi

# Step 0+1: Workspace verification
echo "--- WORKSPACE ---"
if [ -f "$WORKSPACE_FILE" ]; then
  WORKSPACE_NAME=$(sed 's/[[:space:]]*$//' < "$WORKSPACE_FILE" | head -1)
  echo "✅ WORKSPACE: $WORKSPACE_NAME"
else
  echo "⛔ WORKSPACE file missing — run bash init.sh"
fi
if [ -f "$PROFILE_FILE" ]; then
  PROFILE_FILE="$PROFILE_FILE" python3 -c "
import os, json
p = json.load(open(os.environ['PROFILE_FILE']))
status = p.get('status', 'active')
icon = '✅' if status != 'archive' else '⚠️ ARCHIVED'
print(f\"{icon} Project: {p.get('project_name','?')} | Type: {p.get('project_type','?')} | Onboarded: {p.get('onboarding_complete', False)}\")
" 2>/dev/null || true
  # Detect unfilled identity placeholders / incomplete onboarding.
  # Non-fatal warning — boot continues regardless.
  if command -v jq >/dev/null 2>&1; then
    _PROJECT_NAME=$(jq -r '.project_name // ""' "$PROFILE_FILE" 2>/dev/null)
    _AGENT_NAME=$(jq -r '.identity.agent_name // ""' "$PROFILE_FILE" 2>/dev/null)
    _ONBOARDED=$(jq -r '.onboarding_complete // false' "$PROFILE_FILE" 2>/dev/null)

    if [ "$_PROJECT_NAME" = "Athanor" ]        || [[ "$_AGENT_NAME" == *"{{"* ]]        || [[ "$_AGENT_NAME" == *"["* ]]        || [ "$_ONBOARDED" = "false" ]; then
      echo ""
      echo "⚠️  IDENTITY NOT CONFIGURED — project=$_PROJECT_NAME agent=$_AGENT_NAME"
      echo "⚠️  Run /onboard NOW before any substantive work to configure this workspace."
      echo "⚠️  Until onboarding completes, all identity values should be treated as UNKNOWN."
      echo ""
    fi
    unset _PROJECT_NAME _AGENT_NAME _ONBOARDED
  fi
fi
echo ""

# Step 2: Last session recall
echo "--- LAST SESSION ---"
python3 execution/brain.py last-session --quiet 2>/dev/null || echo "(no brain data yet)"
echo ""

# Step 3: Project rules (override base rules — injected first so they take effect)
echo "--- PROJECT RULES ---"
if [ -f ".agent/memory/project/rules.md" ]; then
  RULES_LINES=$(wc -l < ".agent/memory/project/rules.md")
  if [ "$RULES_LINES" -gt 400 ]; then
    echo "[WARNING: rules.md has $RULES_LINES lines — grown past its intended size. Injecting in full below, but this file should be compacted.]"
  fi
  cat .agent/memory/project/rules.md
else
  echo "(no rules.md)"
fi
echo ""

# Step 4: Project context — reboot.md (fresh session summary) if present and non-empty,
# takes priority over the full goals/learned/backlog dump. Missing or zero-byte reboot.md
# falls back to exactly today's existing full-dump behavior, unchanged.
REBOOT_FILE=".agent/memory/project/reboot.md"
if [ -s "$REBOOT_FILE" ]; then
  echo "--- REBOOT CONTEXT ---"
  cat "$REBOOT_FILE"
  echo ""
  echo "Full goals/learned/backlog available on request — see .agent/memory/project/*.md"
  echo ""
else
  # Step 4: Project context — goals
  echo "--- GOALS ---"
  if [ -f ".agent/memory/project/goals.md" ]; then
    cat .agent/memory/project/goals.md
  else
    echo "(no goals.md)"
  fi
  echo ""

  # Step 4: Project context — learned (capped at last 20 lines to control token cost)
  echo "--- LEARNED (last 20 lines) ---"
  if [ -f ".agent/memory/project/learned.md" ]; then
    LEARNED_LINES=$(wc -l < ".agent/memory/project/learned.md")
    if [ "$LEARNED_LINES" -gt 20 ]; then
      echo "[Note: learned.md has $LEARNED_LINES lines — showing last 20. Run \`cat .agent/memory/project/learned.md\` for full history.]"
    fi
    tail -20 .agent/memory/project/learned.md
  else
    echo "(no learned.md)"
  fi
  echo ""

  # Step 4: Mission queue — skip if active mission (already shown above); cat clean file otherwise
  if [ -z "$ACTIVE_MISSION" ]; then
    echo "--- MISSION QUEUE ---"
    if [ -f ".agent/memory/project/backlog.md" ]; then
      awk '
        /^- \[x\]/        { next }
        /^## Closed/      { skip=1; next }
        /^## /            { skip=0 }
        skip              { next }
        /^$/ && prev_blank { next }
        { print; prev_blank=($0=="") }
      ' ".agent/memory/project/backlog.md"
      echo ""
      echo "(full backlog: .agent/memory/project/backlog.md)"
    else
      echo "(no backlog.md)"
    fi
    echo ""
  fi
fi

# Step 4.5: Inbox Processing
INBOX_DIR=".agent/memory/project/inbox"
# Check if there are any non-directory files in INBOX_DIR
if [ -d "$INBOX_DIR" ] && find "$INBOX_DIR" -maxdepth 1 -type f -not -name "archive" | grep -q .; then
    echo "--- INBOX PROCESSING ---"
    echo "Inbox contains unread items. Running make ingest-pulse..."
    make ingest-pulse
    echo ""
fi

# Step 5: Semantic recall — what we were working on
echo "--- RECENT WORK ---"
python3 execution/brain.py recall "$(head -3 .agent/memory/project/goals.md 2>/dev/null | tail -1 || echo 'project goals')" --n 2 2>/dev/null || true
echo ""

# Step 6: Recurring blockers (exits 1 when blockers found, 0 when none)
echo "--- BLOCKERS ---"
BLOCKER_OUTPUT=$(python3 execution/brain.py scan-blockers 2>&1)
echo "$BLOCKER_OUTPUT"
if ! echo "$BLOCKER_OUTPUT" | grep -q "No recurring blockers detected."; then
  echo "⚠️  Recurring blockers detected! Run /pain-point-monitor for root cause analysis."
fi
echo ""

# Step 7: Pulse Heartbeat Service Check
echo "--- PULSE HEARTBEAT ---"
if launchctl list com.athanor.pulse &>/dev/null; then
  echo "✅ Pulse Heartbeat: Active (Running)"
else
  echo "🔄 Pulse Heartbeat: Starting..."
  launchctl load -w ~/Library/LaunchAgents/com.athanor.pulse.plist 2>/dev/null || echo "⚠️ Could not load Pulse Heartbeat. Ensure 'make install-pulse' has been run."
fi
echo ""

# Step 7.5: Upstream Service Mapping
echo "--- UPSTREAM SERVICES ---"
if curl -s --max-time 1 http://localhost:7077/ >/dev/null; then
  echo "✅ Alembic Proxy: Active (localhost:7077)"
else
  echo "❌ Alembic Proxy: Down (localhost:7077)"
  echo "   Mandate: Use Alembic for all URL retrieval. (See .agent/skills/alembic.md)"
fi
echo ""

# Step 8: GitHub Auth
echo "--- GITHUB AUTH ---"
# `gh auth status` and `gh api user -q .login` are both network calls that
# must never be allowed to hang boot indefinitely. Bound each with the same
# timeout/gtimeout-or-poll-kill-fallback pattern as the update-check call
# above, reusing the already-resolved $_GH_TIMEOUT_BIN (nothing unsets it
# between there and here). A bare unconditional `timeout` would silently
# disable this check on stock macOS (no timeout/gtimeout on PATH) instead of
# merely bounding it, so the poll-kill fallback must actually run the call.
_gh_bounded_run() {
  # $1 = file to capture stdout into, remaining args = command to run.
  # Returns the command's exit code (124 if it had to be killed).
  local _out_file="$1"; shift
  if [ -n "$_GH_TIMEOUT_BIN" ]; then
    "$_GH_TIMEOUT_BIN" 3 "$@" >"$_out_file" 2>/dev/null
    return $?
  fi
  "$@" >"$_out_file" 2>/dev/null &
  local _pid=$!
  local _waited=0
  while kill -0 "$_pid" 2>/dev/null && [ "$_waited" -lt 3 ]; do
    sleep 1
    _waited=$((_waited + 1))
  done
  if kill -0 "$_pid" 2>/dev/null; then
    kill -9 "$_pid" 2>/dev/null
    wait "$_pid" 2>/dev/null
    return 124
  fi
  wait "$_pid" 2>/dev/null
}
if [ -f ./.env ] && grep -q "GITHUB_TOKEN" ./.env; then
    echo "✅ GitHub Auth: Active (Token found in .env)"
elif [ -n "$GITHUB_TOKEN" ]; then
    echo "✅ GitHub Auth: Active (Token found in environment)"
elif command -v gh &>/dev/null; then
    _gh_bounded_run /dev/null gh auth status
    if [ $? -eq 0 ]; then
        _GH_API_OUT=$(mktemp)
        _gh_bounded_run "$_GH_API_OUT" gh api user -q .login
        GH_USER=$(tr -d '\n' <"$_GH_API_OUT" 2>/dev/null)
        rm -f "$_GH_API_OUT"
        [ -z "$GH_USER" ] && GH_USER="authenticated"
        echo "✅ GitHub Auth: Active (gh logged in as $GH_USER via System CLI)"
        unset _GH_API_OUT
    else
        echo "❌ GitHub Auth: Inactive"
    fi
else
    echo "❌ GitHub Auth: Inactive"
fi
unset -f _gh_bounded_run
echo ""

# Step 9: Git remotes
echo "--- GIT REMOTES ---"
git remote -v 2>/dev/null || echo "(not a git repo)"
echo ""

echo "════ BOOT COMPLETE — all context loaded ════"

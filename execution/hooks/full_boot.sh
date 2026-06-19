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

# Auto-update check: compare local template_version to upstream
# SKIP if active mission in flight — overwriting hooks mid-session breaks everything
CURRENT_VER=$(python3 -c "import json; print(json.load(open('.agent/profile.json')).get('template_version','0'))" 2>/dev/null || echo "0")
LATEST_VER=$(gh api repos/InunuNet/Athanor/contents/.agent/version --jq '.content' 2>/dev/null | base64 -d 2>/dev/null | tr -d '\n' || echo "")
ACTIVE_MISSION=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path('.agent/memory/project/missions/active.json').read_text()); print(d.get('mission') or '')" 2>/dev/null || echo "")
if [[ -n "$LATEST_VER" && "$CURRENT_VER" != "$LATEST_VER" ]]; then
  if [[ -n "$ACTIVE_MISSION" ]]; then
    echo "⬆️  UPDATE AVAILABLE ($CURRENT_VER → $LATEST_VER) — skipped: mission '$ACTIVE_MISSION' in progress."
    echo "   Run 'make update-template' after mission completes."
  else
    echo "⬆️  HARNESS UPDATE: template $CURRENT_VER → $LATEST_VER — applying..."
    python3 execution/update_template.py --apply 2>/dev/null && \
      echo "✅ Harness updated to $LATEST_VER. New hooks and rules are now active." || \
      echo "⚠️  Auto-update failed — run: make update-template"
  fi
fi

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

# Step X: Platform Capabilities
echo "--- PLATFORM CAPABILITIES ---"
echo "Skills Available:"
echo "  - alembic (Access external web content via @search)"
echo "  - onboard (Athanor onboarding workflow)"
echo ""

# Step Y: Service Mapping
echo "--- SERVICE MAPPING ---"
echo "Alembic: https://github.com/AthanorProject/Alembic"
echo ""
echo "🛡️ Alembic Active: Use @search for web queries."
echo ""


echo "--- ACTIVE MISSION ---"
if [ -f .agent/memory/project/missions/active.json ]; then
  python3 execution/mission.py status "$(python3 -c 'import json; print(json.load(open(".agent/memory/project/missions/active.json"))["mission"])' 2>/dev/null)" 2>/dev/null || echo "(stale mission pointer — run: python3 execution/mission.py list)"
  ACTIVE_MISSION_SLUG=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path('.agent/memory/project/missions/active.json').read_text()); print(d.get('mission') or '')" 2>/dev/null || echo "")
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

COMMS_FILE=".agent/memory/project/comms.md"
if [ -f "$COMMS_FILE" ]; then
  LATEST_DIRECTIVE=$(awk '/^## \[CODI →/||/^## \[CODI ->/{if(found){exit} found=1; count=0; next} /^## \[/{if(found){exit}} found{print; count++; if(count>=40){print "[truncated — read full comms.md]"; exit}}' "$COMMS_FILE" 2>/dev/null)
  if [ -n "$LATEST_DIRECTIVE" ]; then
    echo "--- LATEST DIRECTIVE (comms.md) ---"
    echo "$LATEST_DIRECTIVE"
    echo "---"
    echo ""
  fi
fi

# Workflow Reminder — injected between mission state and identity so the
# chain is fresh in the agent's working memory at the start of every turn.
echo "--- WORKFLOW REMINDER (mandatory chain) ---"
echo "1. Active mission? → python3 execution/mission.py resume → follow it"
echo "2. New multi-session goal? → /mission new (locks autonomy=off)"
echo "3. 3+ files OR design decision? → /spec (locks autonomy=off)"
echo "4. Smaller substantive task? → @architect writes contract.yaml + golden files FIRST"
echo "5. Chain: contract → @dev → @qa (adversarial) → @docs → contract.py gate → @maintainer"
echo "6. DONE = contract gated green + docs verified + brain wrapped. Nothing less."
echo "NEVER skip to implementation. NEVER let @dev author the contract or the QA inputs."
echo ""

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
  cat .agent/memory/project/rules.md
else
  echo "(no rules.md)"
fi
echo ""

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
if [ -f ./.env ] && grep -q "GITHUB_TOKEN" ./.env; then
    echo "✅ GitHub Auth: Active (Token found in .env)"
elif [ -n "$GITHUB_TOKEN" ]; then
    echo "✅ GitHub Auth: Active (Token found in environment)"
elif command -v gh &>/dev/null && gh auth status &>/dev/null; then
    GH_USER=$(gh api user -q .login 2>/dev/null || echo "authenticated")
    echo "✅ GitHub Auth: Active (gh logged in as $GH_USER via System CLI)"
else
    echo "❌ GitHub Auth: Inactive"
fi
echo ""

# Step 9: Git remotes
echo "--- GIT REMOTES ---"
git remote -v 2>/dev/null || echo "(not a git repo)"
echo ""

echo "════ BOOT COMPLETE — all context loaded ════"

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

# Step X: Platform Capabilities
echo "--- PLATFORM CAPABILITIES ---"
echo "Skills Available:"
echo "  - alembic (Access external web content via @search)"
echo "  - onboard (Athanor onboarding workflow)"
echo ""
echo "Makefile Targets (Athanor Harness):"
echo "  - help: Display this help message"
echo "  - sync: Sync agents, skills, and rules to provider configs"
echo "  - sync-agents: Sync canonical agents"
echo "  - sync-skills: Sync canonical skills"
echo "  - sync-rules: Sync canonical rules"
echo "  - repo-slug: Get current GitHub repo (owner/name)"
echo "  - migrate-rules: Migrate rules to canonical .agent/rules/structure"
echo "  - brain-export: Export brain memories to JSON"
echo "  - brain-import: Import brain memories (FILE=path.json)"
echo "  - brain-stats: Show brain statistics"
echo "  - commit: Semantic commit (TYPE=feat MSG='...')"
echo "  - audit: Run workspace health check"
echo "  - test: Run validation suite"
echo "  - test-init: Run init.sh smoke test"
echo "  - update-template: Pull latest Athanor template updates"
echo "  - self-update: Force update Athanor template (for Athanor repo itself)"
echo "  - onboard: Start AI-guided project onboarding"
echo "  - check-feedback: Check GitHub for new issues + PRs"
echo "  - ingest-pulse: Process and archive inbox items to backlog.md"
echo "  - install-pulse: Install and load the Athanor Pulse launchd agent"
echo "  - pulse-status: Check Athanor Pulse service status"
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
  echo "→ Run /mission resume to continue."
else
  echo "No active mission. Pick a top item from the mission queue (.agent/memory/project/backlog.md) and run /mission new <slug> before starting substantive work. Trivial items may be handled directly per the workflow reminder below."
fi
echo ""

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
if [ -f "AGENTS.md" ]; then
  # Inject identity from profile.json into AGENTS.md on-the-fly
  python3 -c "
import json, os
with open('.agent/profile.json') as f:
    p = json.load(f)
identity = p.get('identity', {})
agent_name = identity.get('agent_name', 'Athanor Agent')
project_role = identity.get('project_role', 'project coordinator')
with open('AGENTS.md') as f:
    content = f.read()
content = content.replace('{{AGENT_NAME}}', agent_name)
content = content.replace('{{PROJECT_ROLE}}', project_role)
print(content)
" 2>/dev/null || cat AGENTS.md
else
  echo "⛔ AGENTS.md missing — run bash init.sh"
fi
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

# Step 4: Project context — learned (capped at last 80 lines to control token cost)
echo "--- LEARNED (last 80 lines) ---"
if [ -f ".agent/memory/project/learned.md" ]; then
  LEARNED_LINES=$(wc -l < ".agent/memory/project/learned.md")
  if [ "$LEARNED_LINES" -gt 80 ]; then
    echo "[Note: learned.md has $LEARNED_LINES lines — showing last 80. Run \`cat .agent/memory/project/learned.md\` for full history.]"
  fi
  tail -80 .agent/memory/project/learned.md
else
  echo "(no learned.md)"
fi
echo ""

# Step 4: Project context — mission queue (secondary to active mission, capped at 60 lines)
echo "--- MISSION QUEUE ---"
if [ -f ".agent/memory/project/backlog.md" ]; then
  BACKLOG_LINES=$(wc -l < ".agent/memory/project/backlog.md")
  head -60 .agent/memory/project/backlog.md
  if [ "$BACKLOG_LINES" -gt 60 ]; then
    echo "[truncated — $((BACKLOG_LINES - 60)) more lines hidden. Run \`cat .agent/memory/project/backlog.md\` for full backlog.]"
  fi
else
  echo "(no backlog.md)"
fi
echo ""

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

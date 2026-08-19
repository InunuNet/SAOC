#!/usr/bin/env bash
# Athanor init.sh — Project Scaffolding (v3.3.5)
#
# Pure infrastructure. Interactive onboarding is handled by /onboard workflow.
#
# Usage:
#   bash init.sh                     # scaffold with defaults
#   bash init.sh --name "MyProject"  # explicit project name
#
# Cross-platform: macOS, Linux, Windows (Git Bash / WSL)

set -euo pipefail

# ── Colors (skip if not a terminal) ──────────────────────────────────────────
if [ -t 1 ]; then
    GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
    DIM='\033[2m'; NC='\033[0m'
else
    GREEN=''; CYAN=''; YELLOW=''; DIM=''; NC=''
fi

# ── Detect platform ───────────────────────────────────────────────────────────
detect_platform() {
    case "$(uname -s 2>/dev/null)" in
        Darwin) echo "macos" ;;
        Linux)  echo "linux" ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *) echo "unknown" ;;
    esac
}

PLATFORM=$(detect_platform)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
# ── template/ — harness identity/config seed overlay ────────────────────────
# template/ is NOT what init.sh copies core harness scripts from. It seeds a
# small set of per-workspace identity/config defaults that only make sense
# pre-onboarding:
#   - template/.agent/profile.json        — profile seed (filled during /onboard)
#   - template/.agent/memory/project/*.md — default goals/learned/backlog/rules.md
#     (used as a fallback when this repo's own copies are missing)
#   - template/.agent/identity/           — default identity docs
#   - template/AGENTS.md                  — generic agent instructions fallback
#   - template/GITHUB.md                  — GitHub integration reference
#
# init.sh's actual executable scripts (brain.py, mission.py, execution/hooks/*.sh,
# etc.) are copied from $SCRIPT_DIR/execution — this repo's own LIVE execution/
# directory — NOT from template/execution/. See the `cp "$SCRIPT_DIR/execution/...`
# calls below. template/execution/ exists purely as the harness's own
# self-mirror: it is read ONLY by update_template.py (make update-template),
# never by init.sh. Keeping template/execution/ byte-identical to execution/ is
# enforced by execution/checks/verify_mirror_sync.py — init.sh plays no part in
# that sync and must not be assumed to.
#
# When to update template/:
#   - When changing a default identity/config seed that new workspaces should
#     start with pre-onboarding
#   - NOT for core harness script changes (those belong in execution/, and
#     must be mirrored to template/execution/ separately — see
#     verify_mirror_sync.py)
# ────────────────────────────────────────────────────────────────────────────
TEMPLATE_DIR="$SCRIPT_DIR/template"

# ── Parse flags ───────────────────────────────────────────────────────────────
PROJECT_PATH="$PWD" # Default to current directory if --path is not provided
PROJECT_NAME="$(basename "$PWD")" # Default project name

while [ $# -gt 0 ]; do
    case "$1" in
        --name=*) PROJECT_NAME="${1#*=}"; shift ;;
        --name)   PROJECT_NAME="$2"; shift 2 ;;
        --path=*) PROJECT_PATH="${1#*=}"; shift ;;
        --path)   PROJECT_PATH="$2"; shift 2 ;;
        *)        shift ;;
    esac
done

# Resolve absolute path for PROJECT_PATH and create it if it doesn't exist
mkdir -p "$PROJECT_PATH"
PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd -P)"

# Determine PROJECT_NAME
if [ -f "$PROJECT_PATH/WORKSPACE" ]; then
    PROJECT_NAME=$(head -n 1 "$PROJECT_PATH/WORKSPACE" | tr -d '\n\r')
    printf "${DIM}   Reading project name from WORKSPACE: %s${NC}\n" "$PROJECT_NAME"
else
    # If --name was not provided, use the directory name, otherwise use the provided name
    if [ "$PROJECT_NAME" = "$(basename "$PWD")" ] && [ -n "$PROJECT_PATH" ]; then
        PROJECT_NAME="$(basename "$PROJECT_PATH")"
    fi
    printf "${DIM}   Deriving project name from directory: %s${NC}\n" "$PROJECT_NAME"
    printf '%s\n' "$PROJECT_NAME" > "$PROJECT_PATH/WORKSPACE"
fi

# Sanitize project name
PROJECT_NAME="$(printf '%s' "$PROJECT_NAME" | tr -cd '[:alnum:]_. -' | head -c 128)"

# ── Preflight checks ──────────────────────────────────────────────────────────
preflight() {
    for cmd in python3 git; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            printf "${YELLOW}❌ Required tool '%s' not found in PATH. Install it and re-run.${NC}\n" "$cmd" >&2
            exit 1
        fi
    done
    if [ ! -f "$TEMPLATE_DIR/.agent/profile.json" ]; then
        printf "${YELLOW}❌ Template missing at %s/.agent/profile.json${NC}\n" "$TEMPLATE_DIR" >&2
        printf "   init.sh must be run from within the Athanor clone directory.\n" >&2
        exit 1
    fi
}

# ── Profile ───────────────────────────────────────────────────────────────────
write_profile() {
    printf "${CYAN}📋 Writing project profile...${NC}\n"
    local template_profile="$TEMPLATE_DIR/.agent/profile.json"
    local target="$PROJECT_PATH/.agent/profile.json"

    # Idempotency guard: skip the full template-seed write when the target
    # profile already exists and onboarding_complete == true. Re-running
    # init.sh against an onboarded workspace must not clobber project_name
    # or reset onboarding_complete to false.
    #
    # Exception (GitHub #1286): a fresh clone of the Athanor repo itself
    # carries Athanor's OWN already-onboarded profile.json along (this repo
    # is itself an onboarded project). That inherited copy must NOT be
    # mistaken for a genuine re-onboarded project, so we detect it via two
    # literal markers identifying Athanor's own canonical identity and, when
    # BOTH match, treat it as if onboarding_complete were false (proceed
    # with the normal reset-to-fresh-defaults path below).
    #
    # Self-repo exception (QA round 2): the marker check above is purely
    # value-based, so it cannot distinguish "a downstream clone that
    # inherited Athanor's profile.json" from "this IS Athanor's own real
    # checkout, legitimately onboarded as itself". Both SCRIPT_DIR and
    # PROJECT_PATH are already canonicalized (cd ... && pwd -P) earlier in this
    # script, so a plain string comparison tells us whether init.sh is being
    # run in place inside its own repo. When it is, self-repo status forces
    # preservation regardless of the marker match.
    local ATHANOR_MARKER_PROJECT_NAME="Athanor"
    local ATHANOR_MARKER_AGENT_NAME="gem"
    local self_repo="false"
    [ "$PROJECT_PATH" = "$SCRIPT_DIR" ] && self_repo="true"
    if [ -f "$target" ]; then
        local already_onboarded inherited_clone
        read -r already_onboarded inherited_clone <<< "$(python3 -c "
import json, sys
try:
    p = json.load(open('$target'))
    onboarded = p.get('onboarding_complete') is True
    inherited = (p.get('project_name') == '$ATHANOR_MARKER_PROJECT_NAME'
                 and (p.get('identity') or {}).get('agent_name') == '$ATHANOR_MARKER_AGENT_NAME')
    print('true' if onboarded else 'false', 'true' if inherited else 'false')
except Exception:
    print('false', 'false')
" 2>/dev/null)"
        if [ "$already_onboarded" = "true" ] && { [ "$self_repo" = "true" ] || [ "$inherited_clone" != "true" ]; }; then
            printf "${DIM}   Profile already onboarded — skipping overwrite.${NC}\n"
            return 0
        fi
    fi

    cp "$template_profile" "$target"

    local created_at
    created_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
    local template_version
    template_version=$(cat "$SCRIPT_DIR/.agent/version" 2>/dev/null || echo "unknown")

    python3 - <<PYEOF
import json
path = "$target"
with open(path) as f:
    p = json.load(f)
p['project_name']     = "$PROJECT_NAME"
p['primary_platform'] = "$PLATFORM"
p['created_at']       = "$created_at"
p['template_version'] = "$template_version"
p['onboarding_complete'] = False
p['identity'] = {
    'agent_name': 'Athanor Agent',
    'project_role': 'project coordinator'
}
with open(path, 'w') as f:
    json.dump(p, f, indent=2)
    f.write('\n')
PYEOF
}

# ── Core structure ────────────────────────────────────────────────────────────
scaffold_core() {
    printf "${CYAN}📂 Scaffolding core structure...${NC}\n"

    mkdir -p \
        "$PROJECT_PATH/.agent/agents" \
        "$PROJECT_PATH/.agent/identity" \
        "$PROJECT_PATH/.agent/memory/scratch" \
        "$PROJECT_PATH/.agent/memory/project" \
        "$PROJECT_PATH/.agent/rules/_core" \
        "$PROJECT_PATH/.agent/rules/claude" \
        "$PROJECT_PATH/.agent/rules/gemini" \
        "$PROJECT_PATH/.agent/skills" \
        "$PROJECT_PATH/.agent/workflows" \
        "$PROJECT_PATH/.agent/pulse/registry" \
        "$PROJECT_PATH/.agent/memory/project/inbox" \
        "$PROJECT_PATH/.agent/providers" \
        "$PROJECT_PATH/.claude/agents" \
        "$PROJECT_PATH/.claude/rules" \
        "$PROJECT_PATH/.claude/skills" \
        "$PROJECT_PATH/.gemini/agents" \
        "$PROJECT_PATH/.gemini/skills" \
        "$PROJECT_PATH/.gemini/rules" \
        "$PROJECT_PATH/.gemini/policies" \
        "$PROJECT_PATH/execution/hooks" \
        "$PROJECT_PATH/.tmp"

    touch "$PROJECT_PATH/.agent/memory/scratch/.keep"



    # ── Copy from template: clean slate (no Athanor state) ──────────────────

    # Fresh memory files
    cp "$TEMPLATE_DIR/.agent/memory/project/goals.md"       "$PROJECT_PATH/.agent/memory/project/goals.md"       2>/dev/null || cat > "$PROJECT_PATH/.agent/memory/project/goals.md" << 'EOF'
# Goals

## Mission

[Set during /onboard — describe your project goal here]

## Active Goals

1. Complete onboarding — run `/onboard` to begin
EOF

    cp "$TEMPLATE_DIR/.agent/memory/project/learned.md"     "$PROJECT_PATH/.agent/memory/project/learned.md"     2>/dev/null || cat > "$PROJECT_PATH/.agent/memory/project/learned.md" << 'EOF'
# Learned

## L1: GitHub-first Template Updates

Athanor projects update via 'make update-template'. This uses the 'gh' CLI to download the latest infrastructure from GitHub directly. No 'athanor-upstream' git remote is required.

Run 'gh auth status' to ensure you are logged in.
EOF


    cp "$TEMPLATE_DIR/.agent/memory/project/backlog.md"     "$PROJECT_PATH/.agent/memory/project/backlog.md"     2>/dev/null || cat > "$PROJECT_PATH/.agent/memory/project/backlog.md" << 'EOF'
# Backlog

## TODO

- [ ] Run `/onboard` to define project goal and tech stack
EOF

    cp "$TEMPLATE_DIR/.agent/memory/project/rules.md"       "$PROJECT_PATH/.agent/memory/project/rules.md"

    # Pulse registry from template
    if [ -d "$TEMPLATE_DIR/.agent/pulse/registry" ]; then
        mkdir -p "$PROJECT_PATH/.agent/pulse/registry"
        cp "$TEMPLATE_DIR/.agent/pulse/registry/"* "$PROJECT_PATH/.agent/pulse/registry/" 2>/dev/null || true
    fi

    cat > "$PROJECT_PATH/.agent/memory/project/session_log.md" << 'EOF'
# Session Log

Rolling log of work sessions. Most recent at top. Max 20 entries.

---

<!-- SESSIONS -->
EOF

    # Identity templates (filled in during /onboard)
    if [ -d "$TEMPLATE_DIR/.agent/identity" ]; then
        cp "$TEMPLATE_DIR/.agent/identity/"*.md "$PROJECT_PATH/.agent/identity/" 2>/dev/null || true
    else
        cat > "$PROJECT_PATH/.agent/identity/soul.md" << 'EOF'
# Soul: Project Assistant

**Name**: [Set during /onboard]
**Role**: Primary project coordinator and agent orchestrator

Your full persona is defined during /onboard.
EOF
        cat > "$PROJECT_PATH/.agent/identity/user.md" << 'EOF'
# User Profile

**Name**: [Set during /onboard]
**Role**: [Set during /onboard]

Preferences are defined during /onboard.
EOF
    fi

    # ── Copy hooks, provider configs, settings ────────────────────────────────
    # Hook scripts MUST be copied before settings.json — Claude Code fires hooks
    # immediately when settings.json is updated, so scripts must already exist.
    # Copying settings.json last prevents "No such file" errors on first
    # post-update session. (Fix for upstream issue #116.)

    cp "$SCRIPT_DIR/.gemini/settings.json"  "$PROJECT_PATH/.gemini/settings.json"  2>/dev/null || true
    cp "$SCRIPT_DIR/.gemini/policies/autonomy.toml" "$PROJECT_PATH/.gemini/policies/autonomy.toml" 2>/dev/null || true

    # Copy rules (canonical source → platform dirs)
    for f in "$SCRIPT_DIR/.claude/rules/"*.md; do
        [ -f "$f" ] && cp "$f" "$PROJECT_PATH/.claude/rules/" 2>/dev/null || true
    done

    # Copy hook scripts BEFORE settings.json so hooks exist when Claude Code loads settings
    if [ -d "$SCRIPT_DIR/execution/hooks" ]; then
        cp "$SCRIPT_DIR/execution/hooks/"*.sh "$PROJECT_PATH/"         2>/dev/null || true
        cp "$SCRIPT_DIR/execution/hooks/"*.sh "$PROJECT_PATH/execution/hooks/" 2>/dev/null || true
    fi

    # settings.json last — hooks must exist before Claude Code processes this file
    cp "$SCRIPT_DIR/.claude/settings.json"  "$PROJECT_PATH/.claude/settings.json"  2>/dev/null || true

    # Copy execution scripts
    for f in brain.py sync_agents.sh sync_skills.sh sync_rules.sh discovery.sh pulse_runner.sh ingest_pulse.sh get_pulse_status.sh manage_pulse.sh commit_helper.py ki_recall.py overlay_all.sh overlay_template.sh onboard_fill.py com.athanor.pulse.plist doc2md.py mission.py contract.py handoff_check.py handoffs.py; do
        [ -f "$SCRIPT_DIR/execution/$f" ] && cp "$SCRIPT_DIR/execution/$f" "$PROJECT_PATH/execution/$f" 2>/dev/null || true
    done

    # Copy .agent config files (handoff manifest, update manifest, protected-files list)
    [ -f "$SCRIPT_DIR/.agent/handoffs.yaml" ]        && cp "$SCRIPT_DIR/.agent/handoffs.yaml"        "$PROJECT_PATH/.agent/handoffs.yaml"        2>/dev/null || true
    [ -f "$SCRIPT_DIR/.agent/update-manifest.yaml" ] && cp "$SCRIPT_DIR/.agent/update-manifest.yaml" "$PROJECT_PATH/.agent/update-manifest.yaml" 2>/dev/null || true
    [ -f "$TEMPLATE_DIR/.agent/no-update" ]          && cp "$TEMPLATE_DIR/.agent/no-update"          "$PROJECT_PATH/.agent/no-update"          2>/dev/null || true

    # ── Copy canonical agents, skills, workflows from Athanor ───────────────
    for f in "$SCRIPT_DIR/.agent/agents/"*.md; do
        [ -f "$f" ] && cp "$f" "$PROJECT_PATH/.agent/agents/" 2>/dev/null || true
    done
    for f in "$SCRIPT_DIR/.agent/skills/"*.md; do
        [ -f "$f" ] && cp "$f" "$PROJECT_PATH/.agent/skills/" 2>/dev/null || true
    done
    for f in "$SCRIPT_DIR/.agent/workflows/"*.md; do
        [ -f "$f" ] && cp "$f" "$PROJECT_PATH/.agent/workflows/" 2>/dev/null || true
    done

    # Provider registry
    for f in "$SCRIPT_DIR/.agent/providers/"*.json; do
        [ -f "$f" ] && cp "$f" "$PROJECT_PATH/.agent/providers/" 2>/dev/null || true
    done
}

# ── AGENTS.md + symlinks ──────────────────────────────────────────────────────
setup_instructions() {
    printf "🔗 Setting up instruction symlinks...\n"

    # Use generic template AGENTS.md (not Athanor's project-specific one)
    local agents_src
    if [ -f "$TEMPLATE_DIR/AGENTS.md" ]; then
        agents_src="$TEMPLATE_DIR/AGENTS.md"
    else
        agents_src="$SCRIPT_DIR/AGENTS.md"
    fi

    cp "$agents_src" "$PROJECT_PATH/AGENTS.md" 2>/dev/null || true
    cp "$TEMPLATE_DIR/GITHUB.md" "$PROJECT_PATH/GITHUB.md" 2>/dev/null || true

    # Skip the rm+relink entirely when a file already correctly resolves to
    # AGENTS.md — pure churn reduction on re-init (issue #1313). Only fall
    # through to rm+relink (+ cp fallback) when missing, a real file, or a
    # symlink pointing somewhere else.
    for _f in CLAUDE.md GEMINI.md; do
        if [ -L "$PROJECT_PATH/$_f" ] && [ "$(readlink "$PROJECT_PATH/$_f")" = "AGENTS.md" ]; then
            continue
        fi
        rm -f "$PROJECT_PATH/$_f" 2>/dev/null || true
        ln -sf AGENTS.md "$PROJECT_PATH/$_f" 2>/dev/null || cp "$PROJECT_PATH/AGENTS.md" "$PROJECT_PATH/$_f" 2>/dev/null || true
    done
}

# ── Gitignore ─────────────────────────────────────────────────────────────────
setup_gitignore() {
    [ -f "$PROJECT_PATH/.gitignore" ] && return
    cat > "$PROJECT_PATH/.gitignore" << 'EOF'
# OS
.DS_Store
Thumbs.db

# Temp
.tmp/
node_modules/
__pycache__/
*.pyc

# Secrets
.env
.env.enc

# Agent scratch
.agent/memory/scratch/*
!.agent/memory/scratch/.keep

# Brain (local, large)
.agent/memory/brain/
EOF
}

# ── Env file ──────────────────────────────────────────────────────────────────
setup_env_file() {
    [ -f "$PROJECT_PATH/.env" ] && return
    cat > "$PROJECT_PATH/.env" << 'EOF'
# GitHub Token: Used by certain Athanor tools (e.g., 'make update-template').
# Create a Personal Access Token (PAT) with 'repo' scope at:
# https://github.com/settings/tokens?new_token=repo
# Save it here. For more details, see GITHUB.md.
#
# GITHUB_TOKEN=YOUR_PAT_HERE

# ── OpenRouter (optional) ─────────────────────────────────────────────────────
# Route fleet @dev/@qa subagents to free OpenRouter models instead of Claude quota.
# 1. Get an API key at https://openrouter.ai/keys (it starts with "sk-or-").
# 2. Uncomment and set OPENROUTER_API_KEY below.
# 3. Re-run `bash init.sh` — it writes .claude/settings.local.json (gitignored)
#    with ANTHROPIC_BASE_URL + model overrides. Leaving it unset changes nothing.
#
# OPENROUTER_API_KEY=sk-or-YOUR_KEY_HERE
EOF
}

# ── Secrets (optional) ────────────────────────────────────────────────────────
setup_secrets() {
    [ "$PLATFORM" = "windows" ] && return
    command -v sops >/dev/null 2>&1 && command -v age >/dev/null 2>&1 || return

    if [ ! -f "$PROJECT_PATH/.sops.yaml" ]; then
        mkdir -p "$HOME/.config/sops/age"
        [ -f "$HOME/.config/sops/age/keys.txt" ] || age-keygen -o "$HOME/.config/sops/age/keys.txt" 2>/dev/null
        PUB_KEY=$(grep "public key:" "$HOME/.config/sops/age/keys.txt" | awk '{print $4}')
        cat > "$PROJECT_PATH/.sops.yaml" << SOPSEOF
creation_rules:
  - path_regex: \.env$
    key_groups:
    - age:
      - $PUB_KEY
SOPSEOF
        printf "   🔐 sops + age configured\n"
    fi
}

# ── Git init ──────────────────────────────────────────────────────────────────
setup_git() {
    if [ ! -d "$PROJECT_PATH/.git" ]; then
        printf "🗂️  Initialising git repository...\n"
        git -C "$PROJECT_PATH" init -q
    fi

    if ! git -C "$PROJECT_PATH" remote get-url origin >/dev/null 2>&1; then
        printf "${YELLOW}   ⚠️  No 'origin' remote. Add it:${NC}\n"
        printf "      cd \"%s\" && git remote add origin \"https://github.com/InunuNet/%s.git\"\n" "$PROJECT_PATH" "$PROJECT_NAME"
    fi
}

# ── Sync agents + skills ──────────────────────────────────────────────────────
sync_all() {
    (
        cd "$PROJECT_PATH" || exit 1
        [ -f execution/sync_agents.sh ] && bash execution/sync_agents.sh
        [ -f execution/sync_skills.sh ] && bash execution/sync_skills.sh
        # sync_rules only if canonical source exists
        if [ -f execution/sync_rules.sh ] && [ -d .agent/rules/_core ]; then
            bash execution/sync_rules.sh 2>/dev/null || true
        fi
    )
}

# ── OpenRouter config (opt-in) ────────────────────────────────────────────────
setup_openrouter_config() {
    local key="${OPENROUTER_API_KEY:-}"
    [ -z "$key" ] && return 0

    local target="$PROJECT_PATH/.claude/settings.local.json"
    local new_keys
    new_keys=$(printf '%s' "$key" | python3 -c "
import json, sys
key = sys.stdin.read().strip()
d = {
    'env': {
        'ANTHROPIC_BASE_URL': 'https://openrouter.ai/api',
        'ANTHROPIC_AUTH_TOKEN': key,
        'ANTHROPIC_API_KEY': '',
    }
}
print(json.dumps(d, indent=2))
")

    local warning
    warning="   ${YELLOW}⚠️  ANTHROPIC_DEFAULT_{HAIKU,SONNET,OPUS}_MODEL were NOT written.${NC}\n   ${YELLOW}   These keys are SESSION-scoped, not agent-scoped -- setting them here\n   would repoint EVERY agent tier (orchestrator, @architect, @dev, @qa --\n   not just @dev-fast/@qa-fast) onto free OpenRouter models. Set model-tier\n   overrides manually per docs/openrouter.md if you want fast-tier agents\n   on OpenRouter without degrading every tier.${NC}\n"

    if command -v jq >/dev/null 2>&1 && [ -f "$target" ]; then
        local stale_keys
        stale_keys=$(jq -r '(.env // {}) | keys[] | select(test("^ANTHROPIC_DEFAULT_(HAIKU|SONNET|OPUS)_MODEL$"))' "$target" 2>/dev/null)
        local merged
        if merged=$(jq --argjson new "$(echo "$new_keys" | jq '.env')" \
            '.env = ((.env // {}) + $new | del(.ANTHROPIC_DEFAULT_HAIKU_MODEL, .ANTHROPIC_DEFAULT_SONNET_MODEL, .ANTHROPIC_DEFAULT_OPUS_MODEL))' "$target"); then
            printf '%s\n' "$merged" > "$target"
            printf "   🔓 OpenRouter transport config merged into .claude/settings.local.json\n"
            printf "$warning"
            if [ -n "$stale_keys" ]; then
                printf "   ${YELLOW}⚠️  Removed stale ANTHROPIC_DEFAULT_*_MODEL key(s) from .claude/settings.local.json: %s${NC}\n" "$(echo "$stale_keys" | tr '\n' ' ' | sed 's/ *$//')"
            fi
            return 0
        fi
    fi

    # Fallback (no jq, or jq merge above failed): strip stale model-tier keys
    # from an existing target in place -- surgical, only those three keys,
    # every other key (including user-set keys) survives untouched. This is
    # the branch that used to just `return 0` without even opening the file.
    if [ -f "$target" ]; then
        local removed
        removed=$(python3 - "$target" <<'PYEOF'
import json
import sys

target = sys.argv[1]
STALE = (
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
)
try:
    with open(target) as f:
        data = json.load(f)
except (OSError, json.JSONDecodeError):
    sys.exit(0)
if not isinstance(data, dict):
    sys.exit(0)
env = data.get("env")
if not isinstance(env, dict):
    sys.exit(0)
removed = [k for k in STALE if k in env]
if not removed:
    sys.exit(0)
for k in removed:
    del env[k]
with open(target, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print(" ".join(removed))
PYEOF
)
        if [ -n "$removed" ]; then
            printf "   ${YELLOW}⚠️  Removed stale ANTHROPIC_DEFAULT_*_MODEL key(s) from .claude/settings.local.json: %s${NC}\n" "$removed"
        fi
        return 0
    fi

    mkdir -p "$(dirname "$target")"
    printf '%s\n' "$new_keys" > "$target"
    printf "   🔓 OpenRouter config written to .claude/settings.local.json\n"
    printf "$warning"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    local version
    version=$(cat "$SCRIPT_DIR/.agent/version" 2>/dev/null || echo "?")

    printf "\n"
    printf "${CYAN}🏭 Athanor v%s — Project Bootstrap${NC}\n" "$version"
    printf "${DIM}   Platform: %s | Project: %s${NC}\n\n" "$PLATFORM" "$PROJECT_NAME"

    preflight
    scaffold_core
    write_profile
    setup_instructions
    setup_gitignore
    setup_env_file
    setup_openrouter_config
    setup_secrets
    setup_git
    sync_all

    bash "$SCRIPT_DIR/execution/manage_pulse.sh" register "$PROJECT_PATH"

    printf "\n${GREEN}✅ Workspace scaffolded: %s at %s${NC}\n\n" "$PROJECT_NAME" "$PROJECT_PATH"
    printf "   Next: Open in Claude Code or Gemini CLI and run ${CYAN}/onboard${NC}\n"
    printf "   Or:   ${CYAN}make help${NC}\n\n"
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi

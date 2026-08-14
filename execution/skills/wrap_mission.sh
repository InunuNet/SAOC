#!/usr/bin/env bash
# wrap_mission.sh — Complete a mission: brain wrap-up + secret-guarded commit + verified push.
# Usage: bash execution/skills/wrap_mission.sh "summary" "tag1,tag2"
# Called by Skill("wrap-mission") — reduces token cost of repeated wrap-up pattern.
#
# Hardened for GH #1290 — never stage/commit/push secret-looking files, only
# clear active.json when the mission it points to is actually done, and only
# push when the remote/branch state is verified safe.
#
# Optional env overrides (all safe-default, backward compatible):
#   WRAP_NO_PUSH=1                 skip the push step entirely
#   WRAP_REMOTE=<name>             push to this remote instead of "origin"
#   WRAP_EXPECTED_REMOTE=<substr>  skip push (warn) unless the remote URL contains this substring

set -euo pipefail
SUMMARY="${1:-mission complete}"
TAGS="${2:-mission,complete}"
ACTIVE_JSON=".agent/memory/project/missions/active.json"

PY=".venv/bin/python3"
[ -x "$PY" ] || PY="python3"

# normalize_remote — reduce a git remote URL (or WRAP_EXPECTED_REMOTE) to a
# bare "host/owner/repo" slug so comparisons are exact, not substring-based.
# Strips scheme (https://, http://, git://, ssh://), any "user@" prefix,
# converts scp-form "host:owner/repo" to "host/owner/repo", and strips a
# trailing "/" or ".git".
normalize_remote() {
    local url="$1"
    case "$url" in
        https://*) url="${url#https://}" ;;
        http://*) url="${url#http://}" ;;
        git://*) url="${url#git://}" ;;
        ssh://*) url="${url#ssh://}" ;;
    esac
    case "$url" in
        *@*) url="${url#*@}" ;;
    esac
    local before_slash="${url%%/*}"
    if [[ "$before_slash" == *:* ]]; then
        local host="${before_slash%%:*}"
        local rest="${url#*:}"
        url="$host/$rest"
    fi
    url="${url%/}"
    url="${url%.git}"
    printf '%s' "$url"
}

echo "[wrap-mission] Checking scope guard..."
# GH live incident 2026-07-30: an unscoped `git add -A` swept
# .anti/agents.json and .claude/settings.json -- other, concurrently-running
# sessions' shared/generated harness infra -- into a mission close-out
# commit. Refuse (before anything else, including the brain wrap-up) if any
# denylisted shared/generated file is dirty, unless the operator explicitly
# opts in via WRAP_ALLOW_OUT_OF_SCOPE=1.
DENYLIST=(.claude/settings.json .claude/settings.local.json .gemini/settings.json .anti/agents.json)
if [ "${WRAP_ALLOW_OUT_OF_SCOPE:-0}" != "1" ]; then
    OUT_OF_SCOPE="$(git status --porcelain -- "${DENYLIST[@]}" 2>/dev/null | awk '{print $2}')"
    if [ -n "$OUT_OF_SCOPE" ]; then
        echo "[wrap-mission] ABORT: out-of-scope shared/generated file(s) are dirty:" >&2
        echo "$OUT_OF_SCOPE" >&2
        echo "These belong to shared/generated harness infra, not this mission -- refusing to stage or commit them." >&2
        echo "Set WRAP_ALLOW_OUT_OF_SCOPE=1 to explicitly override and include them." >&2
        exit 1
    fi
fi

echo "[wrap-mission] Running brain wrap-up..."
python3 execution/brain.py wrap-up -s "$SUMMARY" -t "$TAGS"

echo "[wrap-mission] Staging..."
# .claude/worktrees/** holds OTHER agents' live git worktree checkouts --
# structurally present during nearly every concurrent multi-agent session
# and never legitimate commit content. Silently excluded, never blocking.
git add -A -- . ':!.claude/worktrees' 2>/dev/null || true

echo "[wrap-mission] Checking for secret-looking files..."
SECRETS="$(git diff --cached --name-only | "$PY" execution/skills/lib/secret_guard.py --stdin || true)"
if [ -n "$SECRETS" ]; then
    git reset -q HEAD --
    echo "[wrap-mission] ABORT: secret-looking files staged:" >&2
    echo "$SECRETS" >&2
    echo "Add them to .gitignore or remove before wrapping." >&2
    exit 1
fi

echo "[wrap-mission] Committing..."
SLUG=$("$PY" -c "
import json, os, pathlib
p = pathlib.Path('$ACTIVE_JSON')
if p.exists():
    d = json.loads(p.read_text())
    m = d.get('mission', '') or ''
    print(os.path.splitext(os.path.basename(m))[0])
else:
    print('mission')
" 2>/dev/null || echo "mission")
git commit -m "chore(auto): mission complete — $SLUG" 2>/dev/null || true

echo "[wrap-mission] Pushing..."
if [ "${WRAP_NO_PUSH:-0}" = "1" ]; then
    echo "[wrap-mission] WRAP_NO_PUSH=1 — skipping push."
else
    REMOTE="${WRAP_REMOTE:-origin}"
    BR="$(git symbolic-ref --quiet --short HEAD || true)"
    REMOTE_URL=""
    if [ -n "$BR" ]; then
        REMOTE_URL="$(git remote get-url "$REMOTE" 2>/dev/null || true)"
    fi

    if [ -z "$BR" ]; then
        echo "[wrap-mission] WARNING: detached HEAD — skipping push." >&2
    elif [ -z "$REMOTE_URL" ]; then
        echo "[wrap-mission] WARNING: remote '$REMOTE' not configured — skipping push." >&2
    elif [ -n "${WRAP_EXPECTED_REMOTE:-}" ]; then
        NORM_REMOTE="$(normalize_remote "$REMOTE_URL")"
        NORM_EXPECTED="$(normalize_remote "$WRAP_EXPECTED_REMOTE")"
        if [ "$NORM_REMOTE" = "$NORM_EXPECTED" ]; then
            echo "[wrap-mission] pushing to $REMOTE ($REMOTE_URL) branch $BR"
            git push "$REMOTE" "$BR"
        else
            echo "[wrap-mission] WARNING: remote '$REMOTE_URL' does not match" \
                "WRAP_EXPECTED_REMOTE='$WRAP_EXPECTED_REMOTE' — skipping push." >&2
        fi
    else
        echo "[wrap-mission] pushing to $REMOTE ($REMOTE_URL) branch $BR"
        git push "$REMOTE" "$BR"
    fi
fi

echo "[wrap-mission] Checking mission completion..."
MC_RC=0
"$PY" execution/skills/lib/mission_complete.py "$ACTIVE_JSON" >/dev/null 2>&1 || MC_RC=$?
if [ "$MC_RC" -eq 0 ]; then
    "$PY" -c "
import json, pathlib
p = pathlib.Path('$ACTIVE_JSON')
p.write_text(json.dumps({'mission': None, 'checkpoint': None, 'note': 'mission complete'}, indent=2))
"
    echo "[wrap-mission] active.json cleared."
elif [ "$MC_RC" -eq 2 ]; then
    echo "[wrap-mission] no active mission to clear"
else
    echo "[wrap-mission] mission not complete — leaving active.json intact"
fi

echo "[wrap-mission] Done."

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
# GH live incident 2026-07-30: an unscoped blanket stage-everything swept
# .anti/agents.json and .claude/settings.json -- other, concurrently-running
# sessions' shared/generated harness infra -- into a mission close-out
# commit. Refuse (before anything else, including the brain wrap-up) if any
# denylisted shared/generated file is dirty, unless the operator explicitly
# opts in via WRAP_ALLOW_OUT_OF_SCOPE=1.
DENYLIST=(.claude/settings.json .claude/settings.local.json .gemini/settings.json .anti/agents.json)

# Harness-written runtime artifacts (GH backlog 2026-08-16, Alembic feedback):
# telemetry/pulse files that legitimately churn mid-chain and must never trip
# the scope guard above or any future one. Exact paths only -- NOT a glob --
# so a real accidentally-added file still trips the guard. Dynamically-named
# per-task files (e.g. .agent/pulse/queue/pt-*.json, dispatcher/dedupe/*.json,
# registry/completed/*.json) are deliberately NOT covered here: an exact-path
# list cannot follow a dynamic name without degenerating into a wildcard, so
# those directories must never be added to DENYLIST or any scope-guard check
# in the first place -- excluding them here would be a false sense of safety.
RUNTIME_ARTIFACT_EXCLUDES=(
    .agent/memory/project/telemetry/session_usage.jsonl
    .agent/memory/project/telemetry/session_usage.jsonl.lock
    .agent/pulse/last_github_id
    .agent/pulse/registry/needs_resume.flag
    .agent/pulse/comms-watch.log
)
if [ "${WRAP_ALLOW_OUT_OF_SCOPE:-0}" != "1" ]; then
    OUT_OF_SCOPE="$(git status --porcelain -- "${DENYLIST[@]}" 2>/dev/null | awk '{print $2}' \
        | grep -F -x -v -f <(printf '%s\n' "${RUNTIME_ARTIFACT_EXCLUDES[@]}") || true)"
    if [ -n "$OUT_OF_SCOPE" ]; then
        echo "[wrap-mission] ABORT: out-of-scope shared/generated file(s) are dirty:" >&2
        echo "$OUT_OF_SCOPE" >&2
        echo "These belong to shared/generated harness infra, not this mission -- refusing to stage or commit them." >&2
        echo "Set WRAP_ALLOW_OUT_OF_SCOPE=1 to explicitly override and include them." >&2
        exit 1
    fi
fi

echo "[wrap-mission] Checking backlog hygiene..."
BACKLOG_FILE=".agent/memory/project/backlog.md"
if [ -f ".agent/memory/project/backlog.md" ]; then
    if ! bash execution/backlog_audit.sh; then
        echo "[wrap-mission] ABORT: backlog-audit found stale items (see above) — fix $BACKLOG_FILE before closing out." >&2
        exit 1
    fi
    if ! python3 execution/backlog_trim.py; then
        echo "[wrap-mission] ABORT: backlog_trim.py failed." >&2
        exit 1
    fi
fi

echo "[wrap-mission] Running brain wrap-up..."
python3 execution/brain.py wrap-up -s "$SUMMARY" -t "$TAGS"

echo "[wrap-mission] Staging..."
# Scoped staging (GH incident 2026-08-18, commit 59e70a11): an unscoped
# blanket stage-everything swept 17 unrelated dirty files -- backlog.md,
# active.json, reboot.md among them -- into a mission close-out commit.
# Stage only the closing mission's own ledger-owned + always-owned paths
# via scoped_stage.py, never everything in the working tree.
MISSION_PATH="$("$PY" -c "
import json, pathlib
p = pathlib.Path('$ACTIVE_JSON')
if p.exists():
    d = json.loads(p.read_text())
    print(d.get('mission', '') or '')
" 2>/dev/null || echo "")"
if [ -n "$MISSION_PATH" ]; then
    STAGE_RC=0
    STAGE_ERR="$("$PY" execution/skills/lib/scoped_stage.py --mission "$MISSION_PATH" 2>&1 1>/dev/null)" || STAGE_RC=$?
    if [ "$STAGE_RC" -ne 0 ]; then
        echo "[wrap-mission] ABORT: scoped_stage.py failed (rc=$STAGE_RC), nothing was staged:" >&2
        echo "$STAGE_ERR" >&2
        echo "Refusing to proceed with commit/push against an unknown staging state." >&2
        exit 1
    fi
else
    echo "[wrap-mission] WARNING: no active mission path in active.json -- nothing to stage." >&2
fi

echo "[wrap-mission] Staging backlog hygiene changes..."
git add -- .agent/memory/project/backlog.md .agent/memory/project/data/ 2>/dev/null || true

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

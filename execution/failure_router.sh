#!/usr/bin/env bash
# Usage:
#   bash execution/failure_router.sh                  # process inbox loop_failure-*.json sidecars
#   bash execution/failure_router.sh --resolve <slug> # close open failure records for a GREEN suite
#
# Invariants:
#   - Does NOT modify backlog.md directly (ingest_pulse.sh owns that file)
#   - Idempotent: safe to re-run on the same inbox state
#   - Fingerprint: sha1(slug|first_failing_test|severity)[:12]
set -uo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

INBOX_DIR="$PROJECT_ROOT/.agent/memory/project/inbox"
BACKLOG_FILE="$PROJECT_ROOT/.agent/memory/project/backlog.md"
FAILURES_DIR="$PROJECT_ROOT/.agent/memory/project/failures"
MISSIONS_DIR="$PROJECT_ROOT/.agent/memory/project/missions"

mkdir -p "$FAILURES_DIR" "$MISSIONS_DIR"

# ─── helpers ─────────────────────────────────────────────────────────────────

compute_fingerprint() {
  local slug="$1" first_failing="$2" severity="$3"
  printf '%s|%s|%s' "$slug" "$first_failing" "$severity" | sha1sum | cut -c1-12
}

get_json_field() {
  local file="$1" field="$2" default="${3:-}"
  python3 -c "
import json, sys
try:
  d = json.load(open('$file'))
  v = d.get('$field')
  print(v if v is not None else '$default')
except Exception:
  print('$default')
" 2>/dev/null || echo "$default"
}

get_json_int() {
  local file="$1" field="$2" default="${3:-0}"
  python3 -c "
import json
try:
  d = json.load(open('$file'))
  print(int(d.get('$field', $default)))
except Exception:
  print($default)
" 2>/dev/null || echo "$default"
}

update_occurrence_count() {
  local json_file="$1" new_last_seen="$2"
  python3 -c "
import json
d = json.load(open('$json_file'))
d['occurrences'] = d.get('occurrences', 1) + 1
d['last_seen'] = '$new_last_seen'
with open('$json_file', 'w') as f:
  json.dump(d, f, indent=2)
print(d['occurrences'])
" 2>/dev/null || echo "?"
}

get_latest_failure_json() {
  local slug="$1"
  local dir="$FAILURES_DIR/$slug"
  [[ -d "$dir" ]] || return 1
  ls "$dir"/*.json 2>/dev/null | sort | tail -n1
}

priority_prefix() {
  local severity="$1" occurrences="$2"
  case "$severity" in
    ERROR)    echo "[P0]" ;;
    CRITICAL) echo "[P1]" ;;
    DEGRADED)
      if [[ "$occurrences" -ge 3 ]]; then
        echo "[P2]"
      else
        echo "[P3]"
      fi
      ;;
    *) echo "[P3]" ;;
  esac
}

create_mission_file() {
  local slug="$1" severity="$2" first_failing="$3" fp="$4" json_file="$5"
  local today
  today=$(date -u +%Y-%m-%d)
  local mission_file="$MISSIONS_DIR/${today}-fix-ghost-${slug}.md"

  # Mission dedup: if a mission already exists for this slug, append recurrence note
  local existing
  existing=$(ls "$MISSIONS_DIR"/*-fix-ghost-"${slug}".md 2>/dev/null | head -n1 || echo "")
  if [[ -n "$existing" ]]; then
    local run_id
    run_id=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    echo "" >> "$existing"
    echo "## Recurrence noted at $run_id" >> "$existing"
    echo "- Severity: $severity" >> "$existing"
    echo "- First failing: $first_failing" >> "$existing"
    echo "- Fingerprint: fp:sha1:$fp" >> "$existing"
    echo "[router] Appended recurrence to existing mission: $(basename "$existing")"
    return 0
  fi

  cat > "$mission_file" <<MISSIONEOF
---
schema: athanor.mission/v1
slug: fix-ghost-${slug}
goal: 'Fix failing ghost project ${slug}: ${severity} — first failure: ${first_failing}'
created_at: '${today}T00:00:00Z'
status: active
autonomy: high
features:
  - id: F1
    name: Fix failing tests in ghost-${slug}
    status: todo
milestones:
  - id: M1
    title: All ghost-${slug} tests pass GREEN
    features: [F1]
---

# Mission: Fix ghost-${slug}

## Context

Ghost suite **${slug}** is failing with severity **${severity}**.

- First failing test: ${first_failing}
- Fingerprint: fp:sha1:${fp}
- Suite path: execution/tests/ghost-project/${slug}/tests/run_tests.sh

## Gate

The next improvement loop run showing GREEN for ${slug} closes this mission automatically.
MISSIONEOF

  echo "[router] Created mission: $(basename "$mission_file")"

  # Update JSON sidecar with linked mission slug
  python3 -c "
import json
d = json.load(open('$json_file'))
d['linked_mission_slug'] = 'fix-ghost-$slug'
with open('$json_file', 'w') as f:
  json.dump(d, f, indent=2)
" 2>/dev/null || true
}

should_escalate() {
  local severity="$1" occurrences="$2"
  # Escalation conditions (brief-f2 §2.2):
  # 1. severity == ERROR
  # 2. severity == CRITICAL and occurrences >= 2
  # 3. occurrences >= 5 regardless of severity
  if [[ "$severity" == "ERROR" ]]; then return 0; fi
  if [[ "$severity" == "CRITICAL" && "$occurrences" -ge 2 ]]; then return 0; fi
  if [[ "$occurrences" -ge 5 ]]; then return 0; fi
  return 1
}

# ─── no-arg mode: process inbox loop_failure-*.json sidecars ─────────────────

process_inbox() {
  local run_id
  run_id=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Find all JSON sidecars in the inbox
  local json_files=()
  while IFS= read -r f; do
    json_files+=("$f")
  done < <(find "$INBOX_DIR" -maxdepth 1 -type f -name 'loop_failure-*.json' 2>/dev/null | sort)

  if [[ ${#json_files[@]} -eq 0 ]]; then
    echo "[router] No loop_failure-*.json sidecars in inbox"
    return 0
  fi

  for json_file in "${json_files[@]}"; do
    local fname
    fname=$(basename "$json_file")
    echo "[router] Processing: $fname"

    # Extract fields
    local slug severity passed total exit_code first_failing fp_in_json
    slug=$(get_json_field "$json_file" "suite_slug" "unknown")
    severity=$(get_json_field "$json_file" "severity" "ERROR")
    passed=$(get_json_int "$json_file" "passed" 0)
    total=$(get_json_int "$json_file" "total" 0)
    exit_code=$(get_json_int "$json_file" "exit_code" 1)
    first_failing=$(get_json_field "$json_file" "first_failing_test" "unknown")
    fp_in_json=$(get_json_field "$json_file" "fingerprint" "")

    # Compute/verify fingerprint
    local fp
    fp=$(compute_fingerprint "$slug" "$first_failing" "$severity")
    # If JSON had a fingerprint, trust the first 12 chars (strip sha1: prefix)
    local fp_clean="${fp_in_json#sha1:}"
    if [[ -n "$fp_clean" && "${fp_clean:0:12}" != "$fp" ]]; then
      echo "[router] WARN: fingerprint mismatch for $slug — recomputed $fp, JSON had $fp_clean"
      # Use recomputed value
    fi

    # Dedup check: if fingerprint already in backlog, update occurrence count and skip
    if [[ -f "$BACKLOG_FILE" ]] && grep -qF "fp:sha1:$fp" "$BACKLOG_FILE" 2>/dev/null; then
      echo "[router] Fingerprint fp:sha1:$fp already in backlog — incrementing occurrences"
      # Find latest failure JSON in failures/ dir (not inbox) to update
      local latest_json
      latest_json=$(get_latest_failure_json "$slug" 2>/dev/null || echo "")
      if [[ -n "$latest_json" && -f "$latest_json" ]]; then
        local new_count
        new_count=$(update_occurrence_count "$latest_json" "$run_id")
        echo "[router] Updated occurrences to $new_count in $(basename "$latest_json")"
      fi
      # Move the JSON sidecar to failures dir (not inbox anymore)
      mkdir -p "$FAILURES_DIR/$slug"
      local ts_part
      ts_part=$(echo "$fname" | sed 's/loop_failure-//; s/-.*//')
      mv "$json_file" "$FAILURES_DIR/$slug/${ts_part}.json" 2>/dev/null || true
      # Remove corresponding .txt if still in inbox (no new backlog entry needed)
      local txt_file="${json_file%.json}.txt"
      if [[ -f "$txt_file" ]]; then
        rm -f "$txt_file"
        echo "[router] Removed duplicate .txt (dedup'd)"
      fi
      continue
    fi

    # New failure — not yet in backlog. Write inbox .txt with fingerprint on first line.
    local occurrences
    occurrences=$(get_json_int "$json_file" "occurrences" 1)

    local priority
    priority=$(priority_prefix "$severity" "$occurrences")

    local txt_file="${json_file%.json}.txt"
    local log_path=".agent/memory/scratch/improvement_loop/$slug.log"
    local suite_path="execution/tests/ghost-project/$slug/tests/run_tests.sh"
    local first_line
    first_line="$priority ghost-$slug $severity — $passed/$total tests passed <!-- fp:sha1:$fp -->"

    {
      echo "$first_line"
      echo "suite: $suite_path"
      echo "log:   $log_path"
      echo "run_id: $run_id"
      echo "exit_code: $exit_code"
      echo ""
      echo "--- last 40 lines of log ---"
      if [[ -f "$PROJECT_ROOT/$log_path" ]]; then
        tail -n 40 "$PROJECT_ROOT/$log_path"
      else
        echo "(log not found at $log_path)"
      fi
    } > "$txt_file"
    echo "[router] Wrote inbox .txt with fp:sha1:$fp and priority $priority"

    # Escalation: create mission if conditions met
    if should_escalate "$severity" "$occurrences"; then
      echo "[router] Escalation triggered for $slug ($severity occurrences=$occurrences)"
      create_mission_file "$slug" "$severity" "$first_failing" "$fp" "$json_file"
    fi

    # Move JSON sidecar from inbox to failures DB
    mkdir -p "$FAILURES_DIR/$slug"
    local ts_part
    ts_part=$(echo "$fname" | sed 's/loop_failure-//; s/-.*//')
    local dest_json="$FAILURES_DIR/$slug/${ts_part}.json"
    mv "$json_file" "$dest_json"
    echo "[router] Moved JSON to failures/$slug/$(basename "$dest_json")"

    # Brain entry
    python3 "$PROJECT_ROOT/execution/brain.py" remember \
      --summary "$slug $severity — $first_failing" \
      --tags "loop,failure,ghost-$slug,$severity" 2>/dev/null || true
  done
}

# ─── --resolve mode: close open failure records for a GREEN suite ────────────

resolve_slug() {
  local slug="$1"
  local slug_dir="$FAILURES_DIR/$slug"
  local resolved_dir="$slug_dir/resolved"

  if [[ ! -d "$slug_dir" ]]; then
    echo "[router] No failure records for $slug — nothing to resolve"
    return 0
  fi

  local json_files=()
  while IFS= read -r f; do
    json_files+=("$f")
  done < <(find "$slug_dir" -maxdepth 1 -type f -name '*.json' 2>/dev/null | sort)

  if [[ ${#json_files[@]} -eq 0 ]]; then
    echo "[router] No open failure records for $slug"
    return 0
  fi

  mkdir -p "$resolved_dir"
  local run_id
  run_id=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  local resolved_date
  resolved_date=$(date -u +%Y-%m-%d)

  for json_file in "${json_files[@]}"; do
    local status
    status=$(get_json_field "$json_file" "status" "open")
    if [[ "$status" == "resolved" ]]; then
      continue
    fi

    local fp_raw
    fp_raw=$(get_json_field "$json_file" "fingerprint" "")
    local fp="${fp_raw#sha1:}"

    echo "[router] Resolving $(basename "$json_file") for $slug (fp:sha1:$fp)"

    # 1. Tick matching backlog line: - [ ] → - [x] _(resolved ... by loop)_
    if [[ -n "$fp" && -f "$BACKLOG_FILE" ]]; then
      # Use python3 for reliable in-place line edit
      python3 -c "
import re
fp = '$fp'
resolved_note = '_(resolved $resolved_date by loop)_'
lines = open('$BACKLOG_FILE').readlines()
updated = []
for line in lines:
    if f'fp:sha1:{fp}' in line and '- [ ]' in line:
        line = line.replace('- [ ]', '- [x]', 1).rstrip('\n') + ' ' + resolved_note + '\n'
    updated.append(line)
with open('$BACKLOG_FILE', 'w') as f:
    f.writelines(updated)
" 2>/dev/null || echo "[router] WARN: could not tick backlog line for fp:sha1:$fp"
    fi

    # 2. Set status: resolved in JSON, move to resolved/
    python3 -c "
import json
d = json.load(open('$json_file'))
d['status'] = 'resolved'
d['last_seen'] = '$run_id'
with open('$json_file', 'w') as f:
  json.dump(d, f, indent=2)
" 2>/dev/null || true
    mv "$json_file" "$resolved_dir/"
    echo "[router] Moved to resolved/"

    # 3. Update mission frontmatter if a mission exists for this slug
    local existing_mission
    existing_mission=$(ls "$MISSIONS_DIR"/*-fix-ghost-"${slug}".md 2>/dev/null | head -n1 || echo "")
    if [[ -n "$existing_mission" ]]; then
      python3 -c "
content = open('$existing_mission').read()
content = content.replace(\"status: active\", \"status: completed\", 1)
with open('$existing_mission', 'w') as f:
  f.write(content)
" 2>/dev/null || true
      echo "" >> "$existing_mission"
      echo "## Resolved by loop at $run_id" >> "$existing_mission"
      echo "[router] Updated mission status to completed"
    fi
  done

  # 4. Brain entry
  python3 "$PROJECT_ROOT/execution/brain.py" remember \
    --summary "$slug resolved — all tests GREEN" \
    --tags "loop,resolved,ghost-$slug" 2>/dev/null || true
  echo "[router] Resolution sweep complete for $slug"
}

# ─── entrypoint ──────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--resolve" ]]; then
  if [[ -z "${2:-}" ]]; then
    echo "[router] ERROR: --resolve requires a slug argument" >&2
    exit 1
  fi
  resolve_slug "$2"
else
  process_inbox
fi

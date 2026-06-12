#!/usr/bin/env bash
# Usage: bash execution/improvement_loop.sh [--max-iters N] [--once]
#   --max-iters N  Hard ceiling on iterations (default: 10). Loop exits even if not converged.
#   --once         Run a single iteration and exit (for cron/Pulse use).
#
# NOTE: set -uo pipefail, NOT -e. A failing ghost test returns non-zero and must
# not abort the loop. Ghost test failures are data, not fatal errors.
set -uo pipefail

# Prepend common paths for CLI tools
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
MAX_ITERS=10
ONCE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-iters)
      MAX_ITERS="$2"
      shift 2
      ;;
    --once)
      ONCE=true
      MAX_ITERS=1
      shift
      ;;
    *)
      echo "[loop] Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

LOOP_SLEEP="${LOOP_SLEEP:-0}"
CONVERGENCE_THRESHOLD="${ATHANOR_CONVERGENCE_THRESHOLD:-3}"

SCRATCH_DIR="$PROJECT_ROOT/.agent/memory/scratch/improvement_loop"
INBOX_DIR="$PROJECT_ROOT/.agent/memory/project/inbox"
mkdir -p "$SCRATCH_DIR" "$INBOX_DIR"

# ─── helpers ─────────────────────────────────────────────────────────────────

lookup_tsv() {
  local tsv="$1" slug="$2" field="$3"
  # fields: 1=slug 2=exit_code 3=started 4=ended 5=log 6=passed 7=total
  local idx
  case "$field" in
    exit_code) idx=2 ;;
    started)   idx=3 ;;
    ended)     idx=4 ;;
    log)       idx=5 ;;
    passed)    idx=6 ;;
    total)     idx=7 ;;
    *) echo ""; return 1 ;;
  esac
  grep "^${slug}|" "$tsv" | tail -n1 | cut -d'|' -f"$idx"
}

get_severity() {
  local tsv="$1" slug="$2"
  local exit_code passed total log_path parsed_kind
  exit_code=$(lookup_tsv "$tsv" "$slug" exit_code)
  passed=$(lookup_tsv "$tsv" "$slug" passed)
  total=$(lookup_tsv "$tsv" "$slug" total)
  log_path=$(lookup_tsv "$tsv" "$slug" log)
  parsed_kind=$(parse_summary "$log_path" | cut -d'|' -f1)
  triage "$exit_code" "$parsed_kind" "$passed" "$total"
}

discover_suites() {
  find "$PROJECT_ROOT/execution/tests/ghost-project" -mindepth 3 -maxdepth 3 \
    -type f -name run_tests.sh -print | sort
}

run_suite() {
  local script="$1"
  local slug
  slug=$(basename "$(dirname "$(dirname "$script")")")  # e.g. prism2
  local log="$SCRATCH_DIR/$slug.log"
  mkdir -p "$(dirname "$log")"
  local started
  started=$(date -u +%s)
  # Use gtimeout (coreutils/macOS) or timeout (Linux), fall back to bare bash
  if command -v gtimeout >/dev/null 2>&1; then
    gtimeout 120 bash "$script" >"$log" 2>&1
  elif command -v timeout >/dev/null 2>&1; then
    timeout 120 bash "$script" >"$log" 2>&1
  else
    bash "$script" >"$log" 2>&1
  fi
  local exit_code=$?
  local ended
  ended=$(date -u +%s)
  echo "$slug|$exit_code|$started|$ended|$log"
}

parse_summary() {
  local log="$1"
  local last
  last=$(tail -n 5 "$log" | grep -E '^(PASS|FAIL) [0-9]+/[0-9]+' | tail -n 1)
  if [[ -z "$last" ]]; then
    echo "ERROR|0|0"
    return
  fi
  local kind="${last%% *}"           # PASS | FAIL
  local frac="${last#* }"; frac="${frac%% *}"  # N/M
  local passed="${frac%/*}"
  local total="${frac#*/}"
  echo "$kind|$passed|$total"
}

triage() {
  local exit_code="$1" parsed_kind="$2" passed="$3" total="$4"
  if [[ "$parsed_kind" == "ERROR" ]]; then
    echo "ERROR"
  elif [[ "$exit_code" -eq 0 && "$passed" -eq "$total" ]]; then
    echo "GREEN"
  elif [[ "$exit_code" -eq 1 && "$passed" -gt 0 ]]; then
    echo "DEGRADED"
  elif [[ "$exit_code" -eq 1 && "$passed" -eq 0 ]]; then
    echo "CRITICAL"
  else
    echo "ERROR"
  fi
}

emit_failure_inbox() {
  local ts="$1" slug="$2" severity="$3" passed="$4" total="$5" exit_code="$6" log="$7"
  local run_id
  run_id=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Extract first failing test name — handle both "FAIL: testname" and "FAIL N/M" formats
  local first_failing
  first_failing=$(grep -m1 -E '^FAIL:' "$log" 2>/dev/null | sed 's/^FAIL: //' | head -c 200 || echo "")
  [[ -z "$first_failing" ]] && first_failing=$(grep -m1 -E '^FAIL [0-9]' "$log" 2>/dev/null | head -c 200 || echo "")
  [[ -z "$first_failing" ]] && first_failing=$(grep -m1 -iE 'FAILED|AssertionError|Error:' "$log" 2>/dev/null | head -c 200 || echo "unknown")
  [[ -z "$first_failing" ]] && first_failing="unknown"

  local txt_file="$INBOX_DIR/loop_failure-${ts}-${slug}.txt"
  local json_file="$INBOX_DIR/loop_failure-${ts}-${slug}.json"

  # Write plaintext inbox file (ingest_pulse.sh reads this)
  {
    echo "ghost-$slug $severity — $passed/$total tests passed"
    echo "suite: execution/tests/ghost-project/$slug/tests/run_tests.sh"
    echo "log:   .agent/memory/scratch/improvement_loop/$slug.log"
    echo "run_id: $run_id"
    echo "exit_code: $exit_code"
    echo ""
    echo "--- last 40 lines of log ---"
    tail -n 40 "$log" 2>/dev/null || echo "(log not found)"
  } > "$txt_file"

  # Write JSON sidecar (failure_router.sh reads this)
  local suite_path="execution/tests/ghost-project/$slug/tests/run_tests.sh"
  # Compute fingerprint: sha1(slug|first_failing|severity)[:12]
  local fp
  fp=$(printf '%s|%s|%s' "$slug" "$first_failing" "$severity" | (sha1sum 2>/dev/null || shasum -a 1) | cut -c1-12)

  # Determine first_seen: check if existing failure record has one
  local first_seen="$run_id"
  local occurrences=1
  local existing_json
  existing_json=$(ls "$PROJECT_ROOT/.agent/memory/project/failures/$slug/"*.json 2>/dev/null | sort | tail -n1 || echo "")
  if [[ -n "$existing_json" && -f "$existing_json" ]]; then
    local existing_fp
    existing_fp=$(python3 -c "import json,sys; d=json.load(open('$existing_json')); print(d.get('fingerprint','').replace('sha1:',''))" 2>/dev/null || echo "")
    if [[ "$existing_fp" == "$fp" ]]; then
      first_seen=$(python3 -c "import json,sys; d=json.load(open('$existing_json')); print(d.get('first_seen','$run_id'))" 2>/dev/null || echo "$run_id")
      occurrences=$(python3 -c "import json,sys; d=json.load(open('$existing_json')); print(d.get('occurrences',0)+1)" 2>/dev/null || echo "1")
    fi
  fi

  python3 -c "
import json, sys
d = {
  'schema': 'athanor.loop.failure/v1',
  'run_id': '$run_id',
  'suite_slug': '$slug',
  'suite_path': '$suite_path',
  'severity': '$severity',
  'passed': $passed,
  'total': $total,
  'exit_code': $exit_code,
  'log_excerpt_path': '.agent/memory/scratch/improvement_loop/$slug.log',
  'first_failing_test': $(python3 -c "import json; print(json.dumps('$first_failing'.replace(\"'\", \"'\")))" 2>/dev/null || echo "\"unknown\""),
  'fingerprint': 'sha1:$fp',
  'first_seen': '$first_seen',
  'last_seen': '$run_id',
  'occurrences': $occurrences,
  'linked_backlog_line': None,
  'linked_mission_slug': None,
  'linked_github_issue': None,
  'status': 'open'
}
print(json.dumps(d, indent=2))
" > "$json_file" 2>/dev/null || {
    # Fallback: write JSON without python3 quoting tricks
    cat > "$json_file" <<JSONEOF
{
  "schema": "athanor.loop.failure/v1",
  "run_id": "$run_id",
  "suite_slug": "$slug",
  "suite_path": "$suite_path",
  "severity": "$severity",
  "passed": $passed,
  "total": $total,
  "exit_code": $exit_code,
  "log_excerpt_path": ".agent/memory/scratch/improvement_loop/$slug.log",
  "first_failing_test": "$first_failing",
  "fingerprint": "sha1:$fp",
  "first_seen": "$first_seen",
  "last_seen": "$run_id",
  "occurrences": $occurrences,
  "linked_backlog_line": null,
  "linked_mission_slug": null,
  "linked_github_issue": null,
  "status": "open"
}
JSONEOF
  }

  echo "[loop] Emitted inbox failure: loop_failure-${ts}-${slug}.txt (fp:sha1:$fp)"
}

gate_and_commit() {
  cd "$PROJECT_ROOT"
  # If nothing changed, nothing to push
  if git diff --quiet && git diff --cached --quiet; then
    echo "[loop] No changes staged or unstaged — skipping push"
    return 0
  fi
  # Hard gate: test suite must be green
  make test || { echo "[loop] make test red — refusing to push"; return 1; }
  # Contract gate for every active spec
  for spec in "$PROJECT_ROOT/.agent/memory/project/specs"/*/; do
    [ -f "${spec}contract.yaml" ] || continue
    local spec_slug
    spec_slug=$(basename "$spec")
    python3 "$PROJECT_ROOT/execution/contract.py" gate --phase all --run-checks "${spec}contract.yaml" \
      || { echo "[loop] contract gate red for $spec_slug — refusing to push"; return 1; }
  done
  local ts_commit
  ts_commit=$(date -u +%Y%m%dT%H%MZ)
  git add -A
  git commit -m "loop(${ts_commit}): autonomous improvement cycle"
  git push origin HEAD:main
}

generate_release_notes() {
  local conv_file="$SCRATCH_DIR/convergence.json"
  local closed_count=0
  if [[ -f "$conv_file" ]]; then
    closed_count=$(python3 -c "
import json, os, glob
d = json.load(open('$conv_file'))
streak = d.get('clean_streak', 0)
print(f'Clean streak: {streak} iteration(s) with all suites GREEN')
" 2>/dev/null || echo "")
  fi
  echo "## Autonomous improvement cycle"
  echo ""
  git log --oneline -5 2>/dev/null || true
  echo ""
  echo "$closed_count"
}

notify_downstreams() {
  cd "$PROJECT_ROOT"
  local current_version next_tag
  current_version=$(cat .agent/version 2>/dev/null || echo "0.0.0")
  next_tag="v${current_version}+loop.$(date -u +%Y%m%dT%H%MZ)"

  # Bail if the last release already points at this commit
  local last_release_sha
  last_release_sha=$(gh release list --limit 1 --json tagName,targetCommitish \
    --jq '.[0].targetCommitish' 2>/dev/null || echo "")
  local head_sha
  head_sha=$(git rev-parse HEAD 2>/dev/null || echo "")
  if [[ -n "$last_release_sha" && "$last_release_sha" = "$head_sha" ]]; then
    echo "[loop] HEAD already released as $last_release_sha — skipping release"
    return 0
  fi

  local notes
  notes=$(generate_release_notes)
  gh release create "$next_tag" \
    --title "Autonomous improvement cycle $(date -u +%Y-%m-%d)" \
    --notes "$notes" \
    --target main 2>/dev/null || {
      echo "[loop] gh release create failed (not fatal — may not be GitHub-backed)"
    }
}

read_convergence() {
  local conv_file="$SCRATCH_DIR/convergence.json"
  if [[ -f "$conv_file" ]]; then
    python3 -c "import json,sys; d=json.load(open('$conv_file')); print(d.get('clean_streak',0), d.get('suite_count',0), d.get('last_status','UNKNOWN'))" 2>/dev/null || echo "0 0 UNKNOWN"
  else
    echo "0 0 UNKNOWN"
  fi
}

write_convergence() {
  local streak="$1" suite_count="$2" status="$3" run_id="$4" passed="$5" failed="$6"
  local conv_file="$SCRATCH_DIR/convergence.json"

  # Read existing history
  local history="[]"
  if [[ -f "$conv_file" ]]; then
    history=$(python3 -c "import json; d=json.load(open('$conv_file')); print(json.dumps(d.get('history',[])))" 2>/dev/null || echo "[]")
  fi

  # Append current run to history (keep last 20)
  history=$(python3 -c "
import json
h = $history
h.append({'run_id': '$run_id', 'status': '$status', 'suite_count': $suite_count, 'passed': $passed, 'failed': $failed})
h = h[-20:]
print(json.dumps(h))
" 2>/dev/null || echo "[]")

  python3 -c "
import json
d = {
  'clean_streak': $streak,
  'threshold': $CONVERGENCE_THRESHOLD,
  'suite_count': $suite_count,
  'last_run_id': '$run_id',
  'last_status': '$status',
  'history': $history
}
print(json.dumps(d, indent=2))
" > "$conv_file"
}

update_convergence() {
  local total_suites="$1" non_green_count="$2" ts="$3"
  local run_id
  run_id=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  local prev_streak prev_suite_count prev_status
  read -r prev_streak prev_suite_count prev_status < <(read_convergence)

  local new_streak new_status
  local passed_count=$(( total_suites - non_green_count ))

  if [[ "$non_green_count" -eq 0 ]]; then
    # All green — check if suite count changed
    if [[ "$prev_suite_count" -ne 0 && "$prev_suite_count" -ne "$total_suites" ]]; then
      # Suite count changed — reset streak
      new_streak=0
      new_status="GREEN_RESET"
      echo "[loop] Streak reset: suite count changed ($prev_suite_count -> $total_suites)"
    else
      new_streak=$(( prev_streak + 1 ))
      new_status="GREEN"
    fi
  else
    new_streak=0
    new_status="DEGRADED"
  fi

  write_convergence "$new_streak" "$total_suites" "$new_status" "$run_id" "$passed_count" "$non_green_count"

  # Brain entry on state transitions
  if [[ "$new_status" != "$prev_status" || "$new_streak" -eq 0 && "$prev_streak" -gt 0 ]]; then
    python3 "$PROJECT_ROOT/execution/brain.py" remember \
      --summary "Convergence state: $prev_status -> $new_status streak=$new_streak/$CONVERGENCE_THRESHOLD ($total_suites suites)" \
      --tags "loop,convergence,ghost-battery" 2>/dev/null || true
  fi

  # Convergence milestone
  if [[ "$new_streak" -ge "$CONVERGENCE_THRESHOLD" ]]; then
    local conv_ts
    conv_ts=$(date -u +%Y%m%d%H%M%S)
    local milestone_file="$INBOX_DIR/loop_converged-${conv_ts}.txt"
    # Only emit if we just hit the threshold (don't re-emit every iteration)
    if [[ "$prev_streak" -lt "$CONVERGENCE_THRESHOLD" ]]; then
      {
        echo "Athanor (Milestone): Loop converged — ${new_streak}-clean streak"
        echo "suite_count: $total_suites"
        echo "threshold: $CONVERGENCE_THRESHOLD"
        echo "achieved_at: $run_id"
      } > "$milestone_file"
      echo "[loop] CONVERGED: ${new_streak}-clean streak. Emitted $milestone_file"
      python3 "$PROJECT_ROOT/execution/brain.py" remember \
        --summary "Loop converged at ${new_streak}-clean streak ($total_suites suites green)" \
        --tags "convergence,milestone,loop" 2>/dev/null || true
      # Update convergence.json to mark converged status
      write_convergence "$new_streak" "$total_suites" "converged" "$run_id" "$passed_count" "$non_green_count"
    fi
  fi

  echo "[loop] Convergence: streak=$new_streak/$CONVERGENCE_THRESHOLD status=$new_status suites=$total_suites"
}

# ─── main loop ───────────────────────────────────────────────────────────────

echo "[loop] Starting improvement loop (max_iters=$MAX_ITERS once=$ONCE)"
cd "$PROJECT_ROOT"

iter=0
while [[ $iter -lt $MAX_ITERS ]]; do
  iter=$(( iter + 1 ))
  ts=$(date -u +%Y%m%d%H%M%S)
  run_id=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  echo "[loop] ── Iteration $iter / $MAX_ITERS (ts=$ts) ──"
  _MISSION_ADVANCED=false

  # Mission-first: if an active mission is in_progress or pending, advance it and skip ghost tests
  _ACTIVE_PATH=$(python3 -c "
import json, pathlib
p = pathlib.Path('.agent/memory/project/missions/active.json')
if p.exists():
    d = json.loads(p.read_text())
    print(d.get('mission') or 'null')
else:
    print('null')
" 2>/dev/null || echo "null")
  if [[ "$_ACTIVE_PATH" != "null" && -n "$_ACTIVE_PATH" ]]; then
    _MISSION_STATUS=$(python3 execution/mission.py status "$_ACTIVE_PATH" --json 2>/dev/null \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null \
      || echo "unknown")
    if [[ "$_MISSION_STATUS" == "in_progress" || "$_MISSION_STATUS" == "pending" ]]; then
      CLAUDE_LOOP_PROMPT="Run: python3 execution/mission.py resume $_ACTIVE_PATH"
      echo "[loop] Active mission ${_MISSION_STATUS} — advancing one turn via claude-loop.sh (skipping ghost tests)..."
      CLAUDE_LOOP_PROMPT="$CLAUDE_LOOP_PROMPT" bash "$SCRIPT_DIR"/claude-loop.sh --max 1 2>&1 | tail -30 || true
      _MISSION_ADVANCED=true
      continue
    fi
  fi

  # Queue scan: if no active mission was advanced, check mission_queue.txt
  if [[ "$_MISSION_ADVANCED" == "false" && -f "$PROJECT_ROOT/.agent/mission_queue.txt" ]]; then
    while IFS='|' read -r _Q_SLUG _Q_DESC || [[ -n "$_Q_SLUG" ]]; do
      [[ -z "$_Q_SLUG" ]] && continue
      # Resolve slug to mission file: try exact match, then date-prefixed glob
      _Q_PATH=""
      if [[ -f "$PROJECT_ROOT/.agent/memory/project/missions/${_Q_SLUG}.md" ]]; then
        _Q_PATH="$PROJECT_ROOT/.agent/memory/project/missions/${_Q_SLUG}.md"
      else
        _Q_PATH=$(ls "$PROJECT_ROOT/.agent/memory/project/missions/"*"${_Q_SLUG}.md" 2>/dev/null | head -n1 || echo "")
      fi
      if [[ -z "$_Q_PATH" ]]; then
        echo "[loop] Queue: no mission file for slug '${_Q_SLUG}' — skipping"
        continue
      fi
      _Q_STATUS=$(python3 execution/mission.py status "$_Q_PATH" --json 2>/dev/null \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null \
        || echo "unknown")
      if [[ "$_Q_STATUS" == "done" || "$_Q_STATUS" == "completed" || "$_Q_STATUS" == "paused" || "$_Q_STATUS" == "abandoned" ]]; then
        echo "[loop] Queue: '${_Q_SLUG}' is ${_Q_STATUS} — skipping"
        continue
      fi
      CLAUDE_LOOP_PROMPT="Run: python3 execution/mission.py resume $_Q_PATH"
      echo "[loop] Queue mission '${_Q_SLUG}' (${_Q_STATUS}) — advancing one turn via claude-loop.sh..."
      CLAUDE_LOOP_PROMPT="$CLAUDE_LOOP_PROMPT" bash "$SCRIPT_DIR"/claude-loop.sh --max 1 2>&1 | tail -30 || true
      _MISSION_ADVANCED=true
      break
    done < "$PROJECT_ROOT/.agent/mission_queue.txt"
  fi

  if [[ "$_MISSION_ADVANCED" == "false" ]]; then

  # 1. Discover suites
  suites=()
  while IFS= read -r s; do
    suites+=("$s")
  done < <(discover_suites)
  total_suites=${#suites[@]}
  echo "[loop] Found $total_suites ghost suites"

  if [[ "$total_suites" -eq 0 ]]; then
    echo "[loop] No ghost suites found — nothing to do"
    break
  fi

  # 2. Run suites, collect results into TSV
  tsv_file="$SCRATCH_DIR/run-${ts}.tsv"
  non_green=()
  green=()

  for script in "${suites[@]}"; do
    raw=$(run_suite "$script")
    slug="${raw%%|*}"
    rest="${raw#*|}"
    exit_code="${rest%%|*}"; rest="${rest#*|}"
    started="${rest%%|*}"; rest="${rest#*|}"
    ended="${rest%%|*}"; rest="${rest#*|}"
    log="${rest}"

    # Parse PASS/FAIL summary
    parsed=$(parse_summary "$log")
    parsed_kind="${parsed%%|*}"; rest2="${parsed#*|}"; passed="${rest2%%|*}"; total="${rest2#*|}"

    severity=$(triage "$exit_code" "$parsed_kind" "$passed" "$total")

    echo "$slug|$exit_code|$started|$ended|$log|$passed|$total" >> "$tsv_file"
    echo "[loop]   $slug: $severity (exit=$exit_code pass=$passed/$total)"

    if [[ "$severity" == "GREEN" ]]; then
      green+=("$slug")
    else
      non_green+=("$slug")
    fi
  done

  echo "[loop] Results: ${#green[@]} GREEN, ${#non_green[@]} non-GREEN"

  # 3. Call failure_router.sh (no-arg mode) before emitting new inbox files
  #    This moves existing JSONs and deduplicates against backlog
  if [[ -f "$PROJECT_ROOT/execution/failure_router.sh" ]]; then
    bash "$PROJECT_ROOT/execution/failure_router.sh" 2>/dev/null || true
  fi

  # 4. Emit inbox reports for non-GREEN suites
  for slug in "${non_green[@]+"${non_green[@]}"}"; do
    _sev=$(get_severity "$tsv_file" "$slug")
    _passed=$(lookup_tsv "$tsv_file" "$slug" passed)
    _total=$(lookup_tsv "$tsv_file" "$slug" total)
    _exit=$(lookup_tsv "$tsv_file" "$slug" exit_code)
    _log=$(lookup_tsv "$tsv_file" "$slug" log)
    emit_failure_inbox "$ts" "$slug" "$_sev" "$_passed" "$_total" "$_exit" "$_log"
  done

  # 5. Call failure_router.sh again to process the new JSONs we just wrote
  if [[ -f "$PROJECT_ROOT/execution/failure_router.sh" ]]; then
    bash "$PROJECT_ROOT/execution/failure_router.sh" 2>/dev/null || true
  fi

  # 6. Resolve GREEN suites (close open failure records)
  for slug in "${green[@]+"${green[@]}"}"; do
    if [[ -f "$PROJECT_ROOT/execution/failure_router.sh" ]]; then
      bash "$PROJECT_ROOT/execution/failure_router.sh" --resolve "$slug" 2>/dev/null || true
    fi
  done

  # 7. Ingest pulse (fold inbox .txt files into backlog)
  make -C "$PROJECT_ROOT" ingest-pulse 2>/dev/null || true

  # 8. Gate and commit (if any fixes landed)
  push_succeeded=false
  gate_and_commit && push_succeeded=true || true

  # 9. Notify downstreams if push succeeded
  if [[ "$push_succeeded" == "true" ]]; then
    notify_downstreams || true
  fi

  # 10. Update convergence
  update_convergence "$total_suites" "${#non_green[@]}" "$ts"

  # Check convergence status — log but don't halt
  local_conv_status=$(python3 -c "import json; d=json.load(open('$SCRATCH_DIR/convergence.json')); print(d.get('last_status',''))" 2>/dev/null || echo "")
  if [[ "$local_conv_status" == "converged" ]]; then
    echo "[loop] Loop has converged. Continuing to monitor."
  fi

  fi # end: _MISSION_ADVANCED == false (ghost-test block)

  if [[ "$ONCE" == "true" || $iter -ge $MAX_ITERS ]]; then
    break
  fi

  if [[ "$LOOP_SLEEP" -gt 0 ]]; then
    echo "[loop] Sleeping ${LOOP_SLEEP}s..."
    sleep "$LOOP_SLEEP"
  fi
done

echo "[loop] Done after $iter iteration(s)."

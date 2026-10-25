#!/usr/bin/env bash
# validate_manifest.sh — verifies that every top-level workspace path (plus
# direct children of .agent/, .claude/, .gemini/) is classified in
# .agent/update-manifest.yaml, either explicitly or covered by an ancestor entry.
#
# Exit codes:
#   0 — all enumerated paths covered, no unknown categories, all MERGE entries
#       have a strategy.
#   1 — at least one path is uncovered, or schema problem detected.
#
# Why this exists:
#   update_template.py does EXACT-path matching (path.rstrip("/")) and lets
#   shutil.copytree handle recursion. So a manifest entry for ".agent/agents/"
#   transitively covers everything beneath it via copytree, but ONLY if that
#   directory entry exists. Drift happens when a new top-level path is added
#   to the workspace and nobody updates the manifest — this script catches
#   exactly that case.

set -euo pipefail

# --- Argument parsing ---
TARGET_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --target)
      shift
      TARGET_DIR="${1:-}"
      shift
      ;;
    --target=*)
      TARGET_DIR="${1#--target=}"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--target DIR]"
      echo "  --target DIR   also verify that required harness files exist in DIR"
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ -n "$TARGET_DIR" ] && [ ! -d "$TARGET_DIR" ]; then
  echo "ERROR: --target '$TARGET_DIR' is not a directory" >&2
  exit 1
fi

# Required harness files that must exist in any onboarded workspace.
REQUIRED_FILES=(
  "execution/handoff_check.py"
  "execution/mission.py"
  "execution/contract.py"
  ".agent/handoffs.yaml"
)

MANIFEST=".agent/update-manifest.yaml"
VALID_CATEGORIES=(HARNESS WORKSPACE DERIVED MERGE)
VALID_STRATEGIES=(line_union json_deep_merge)

# Paths that should NEVER appear in the manifest (gitignored or VCS noise).
EXCLUSIONS=(.git .DS_Store .tmp .env .env.enc pulse.log .cc-writes .pytest_cache)

# Container directories — themselves not classified; instead, every direct
# child is walked and checked individually.
CONTAINERS=(.agent .claude .gemini .grok)

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: $MANIFEST not found" >&2
  exit 1
fi

# --- 1. Parse manifest paths + categories with python3 (PyYAML available).
#       .agent/update-manifest.local.yaml is the project's own classification
#       (WORKSPACE/DERIVED only). The main manifest is HARNESS and self-syncs,
#       so a project that classified its source there had the updater refuse
#       the manifest (Alembic, 2026-10-20). A local entry may never be HARNESS
#       or MERGE, nor overlap a HARNESS entry: it classifies, it never takes
#       ownership. Problems print as "!ERR\t<message>".
PARSED="$(python3 - <<'PY'
import os, sys, yaml
LOCAL = ".agent/update-manifest.local.yaml"
LOCAL_CATEGORIES = ("WORKSPACE", "DERIVED")
with open(".agent/update-manifest.yaml") as f:
    m = yaml.safe_load(f) or {}
paths = m.get("paths") or []
harness = []
for e in paths:
    if not isinstance(e, dict):
        continue
    p = (e.get("path") or "").rstrip("/")
    if not p:
        continue
    cat = e.get("category", "")
    strat = e.get("strategy", "") or ""
    if cat == "HARNESS":
        harness.append(p)
    print(f"{p}\t{cat}\t{strat}")

def overlaps(a, b):
    return a == b or a.startswith(b + "/") or b.startswith(a + "/")

if os.path.exists(LOCAL):
    try:
        with open(LOCAL) as f:
            lm = yaml.safe_load(f) or {}
    except Exception as e:
        print(f"!ERR\t{LOCAL}: not valid YAML ({type(e).__name__})")
        sys.exit(0)
    lpaths = lm.get("paths") if isinstance(lm, dict) else None
    if not isinstance(lpaths, list):
        print(f"!ERR\t{LOCAL}: needs a 'paths:' list of {{path, category}} entries")
        sys.exit(0)
    for e in lpaths:
        raw = e.get("path") if isinstance(e, dict) else None
        p = raw.rstrip("/") if isinstance(raw, str) else ""
        if not p or any(c in p for c in "\t\n"):
            print(f"!ERR\t{LOCAL}: entry needs a one-line string path: {e!r}")
            continue
        cat = e.get("category", "")
        if cat not in LOCAL_CATEGORIES:
            print(f"!ERR\t{LOCAL}: {p} is '{cat}'; a local entry must be WORKSPACE or DERIVED")
            continue
        clash = [h for h in harness if overlaps(p, h)]
        if clash:
            print(f"!ERR\t{LOCAL}: {p} overlaps HARNESS {', '.join(clash)}; the harness owns it")
            continue
        print(f"{p}\t{cat}\t")
PY
)"

LOCAL_ERRORS="$(grep '^!ERR' <<< "$PARSED" | cut -f2- || true)"
PARSED="$(grep -v '^!ERR' <<< "$PARSED" || true)"

if [ -z "$PARSED" ]; then
  echo "ERROR: no paths parsed from $MANIFEST" >&2
  exit 1
fi

# --- 2. Schema checks.
SCHEMA_ERRORS=0
while IFS=$'\t' read -r mpath mcat mstrat; do
  ok_cat=0
  for c in "${VALID_CATEGORIES[@]}"; do
    [ "$c" = "$mcat" ] && ok_cat=1 && break
  done
  if [ "$ok_cat" -eq 0 ]; then
    echo "ERROR: $mpath has unknown or missing category: '$mcat'" >&2
    SCHEMA_ERRORS=$((SCHEMA_ERRORS + 1))
  fi
  if [ "$mcat" = "MERGE" ]; then
    ok_strat=0
    for s in "${VALID_STRATEGIES[@]}"; do
      [ "$s" = "$mstrat" ] && ok_strat=1 && break
    done
    if [ "$ok_strat" -eq 0 ]; then
      echo "ERROR: $mpath is MERGE but strategy '$mstrat' is not recognized" >&2
      SCHEMA_ERRORS=$((SCHEMA_ERRORS + 1))
    fi
  fi
done <<< "$PARSED"

MANIFEST_PATHS="$(awk -F'\t' '{print $1}' <<< "$PARSED" | sort -u)"

# --- 3. Enumerate paths that MUST be classified:
#       root level (excluding containers) + direct children of containers.
is_container() {
  local base="$1"
  for c in "${CONTAINERS[@]}"; do
    [ "$base" = "$c" ] && return 0
  done
  return 1
}

collect_root() {
  find . -maxdepth 1 -mindepth 1 2>/dev/null | sed 's|^\./||' | while read -r p; do
    if ! is_container "$p"; then
      echo "$p"
    fi
  done
}

collect_children() {
  local root="$1"
  if [ -d "$root" ]; then
    find "$root" -maxdepth 1 -mindepth 1 2>/dev/null | sed 's|^\./||'
  fi
}

EXPECTED="$(
  {
    collect_root
    for c in "${CONTAINERS[@]}"; do
      collect_children "$c"
    done
  } | sort -u
)"

# --- 4. Filter out exclusions.
is_excluded() {
  local candidate="$1"
  local base
  base="$(basename "$candidate")"
  for ex in "${EXCLUSIONS[@]}"; do
    if [ "$base" = "$ex" ] || [ "$candidate" = "$ex" ]; then
      return 0
    fi
  done
  return 1
}

# --- 5. Coverage check.
is_covered() {
  local p="${1%/}"
  if grep -Fxq "$p" <<< "$MANIFEST_PATHS"; then
    return 0
  fi
  local parent="$p"
  while [ "$parent" != "." ] && [ "$parent" != "/" ] && [[ "$parent" == */* ]]; do
    parent="${parent%/*}"
    if grep -Fxq "$parent" <<< "$MANIFEST_PATHS"; then
      return 0
    fi
  done
  return 1
}

UNCOVERED=()
while IFS= read -r path; do
  [ -z "$path" ] && continue
  if is_excluded "$path"; then
    continue
  fi
  if ! is_covered "$path"; then
    UNCOVERED+=("$path")
  fi
done <<< "$EXPECTED"

# A gitignored path (.venv, __pycache__, build output) is never shipped or
# updated, so it needs no classification. An ignored directory that still
# holds a tracked (force-added) file is kept: that file is project source.
if [ "${#UNCOVERED[@]}" -gt 0 ] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  IGNORED_PATHS="$(printf '%s\n' "${UNCOVERED[@]}" | git check-ignore --stdin 2>/dev/null || true)"
  if [ -n "$IGNORED_PATHS" ]; then
    KEPT=()
    for p in "${UNCOVERED[@]}"; do
      if grep -Fxq "$p" <<< "$IGNORED_PATHS" && [ -z "$(git ls-files -- "$p" 2>/dev/null | head -1)" ]; then
        continue
      fi
      KEPT+=("$p")
    done
    UNCOVERED=("${KEPT[@]+"${KEPT[@]}"}")
  fi
fi

# --- 6. Report.
if [ -n "$LOCAL_ERRORS" ]; then
  while IFS= read -r e; do
    echo "ERROR: $e" >&2
  done <<< "$LOCAL_ERRORS"
  exit 1
fi

if [ "${#UNCOVERED[@]}" -gt 0 ]; then
  echo "ERROR: $MANIFEST is missing classifications for the following paths:" >&2
  for p in "${UNCOVERED[@]}"; do
    echo "  - $p" >&2
  done
  echo "" >&2
  echo "Your own paths go in .agent/update-manifest.local.yaml (project-owned;" >&2
  echo "$MANIFEST is HARNESS and every update replaces it):" >&2
  echo "  paths:" >&2
  echo "    - {path: src/, category: WORKSPACE}" >&2
  echo "  category: WORKSPACE | DERIVED (generated, not committed)" >&2
  exit 1
fi

if [ "$SCHEMA_ERRORS" -gt 0 ]; then
  echo "ERROR: $SCHEMA_ERRORS schema issue(s) in $MANIFEST" >&2
  exit 1
fi

# --- 7. --target presence check (opt-in mode only).
if [ -n "$TARGET_DIR" ]; then
  MISSING_REQUIRED=()
  for f in "${REQUIRED_FILES[@]}"; do
    if [ ! -e "${TARGET_DIR}/${f}" ]; then
      MISSING_REQUIRED+=("$f")
    fi
  done
  if [ "${#MISSING_REQUIRED[@]}" -gt 0 ]; then
    echo "ERROR: $TARGET_DIR is missing required harness files:" >&2
    for f in "${MISSING_REQUIRED[@]}"; do
      echo "  - $f" >&2
    done
    echo "" >&2
    echo "Fix: run 'python3 execution/update_template.py --apply' inside the target workspace." >&2
    exit 1
  fi
  echo "OK: --target $TARGET_DIR has all ${#REQUIRED_FILES[@]} required harness files"
fi

echo "OK: all enumerated paths classified ($(wc -l <<< "$MANIFEST_PATHS" | tr -d ' ') manifest entries)"
exit 0

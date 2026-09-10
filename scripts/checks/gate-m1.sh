#!/usr/bin/env bash
# gate-m1.sh — run the M1 milestone gate for mission `national-show-ia-alignment`
# with the project-owned verification-triad baseline in scope.
#
# WHY THIS IS A WRAPPER AND NOT A SETTING
# ---------------------------------------
# TRIAD_BASELINE_FILE REPLACES the harness default; it does not union with it.
# Verified empirically on 2026-09-09: `contracts/c5-submit-event.yaml` is exempt
# under the default baseline and NOT exempt under ours.
#
# The harness default (execution/triad-baseline-exempt.txt) grandfathers 35 existing
# contracts. Exporting these two variables project-wide — in .claude/settings.json or a
# shell profile — would repoint every gate invocation in this project at our file, which
# lists exactly one contract, and silently arm triad enforcement across the entire
# existing suite. It would surface later as unrelated missions "suddenly regressing".
#
# So the scope is this wrapper: one mission, one milestone, zero blast radius.
# Do NOT copy these exports anywhere with a wider reach.
#
# WHY M1 IS EXEMPT AT ALL: see scripts/checks/triad-baseline-exempt.txt. Short version —
# M1 ships a component and a loader but no route renders either until M4, so there is no
# deployed surface for a browser check. M4 must carry the full triad and must never be
# added to that baseline.
#
# Usage:  scripts/checks/gate-m1.sh [extra args passed through]

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd -- "$REPO_ROOT"

MISSION=".agent/memory/project/missions/2026-09-09-national-show-ia-alignment.md"
CONTRACT=".agent/memory/project/specs/national-show-ia-alignment/contract-m1.yaml"
BASELINE="scripts/checks/triad-baseline-exempt.txt"
PINS="scripts/checks/triad-baseline-exempt.sha256"

for f in "$MISSION" "$CONTRACT" "$BASELINE" "$PINS"; do
  [ -f "$f" ] || { echo "gate-m1.sh: missing $f" >&2; exit 2; }
done

# Refuse any milestone but M1. Without this guard, `gate-m1.sh --milestone M4` would run
# M4 under M1's exemption — M4 is exactly the milestone that must NOT be exempt, because
# it builds real pages on a deployed origin.
for arg in "$@"; do
  case "$arg" in
    M[0-9]*)
      [ "$arg" = "M1" ] || {
        echo "gate-m1.sh: refusing milestone '$arg'." >&2
        echo "  This wrapper carries M1's triad exemption. Only M1 may use it." >&2
        echo "  Run any other milestone through mission.py directly, with the full triad." >&2
        exit 2
      } ;;
  esac
done

# A stale pin blocks the gate with a triad message that reads like a policy failure rather
# than a bookkeeping one. Say what actually happened, and exactly how to fix it.
LIVE="$(shasum -a 256 "$CONTRACT" | cut -d' ' -f1)"
if ! grep -q "^${LIVE}  " "$PINS"; then
  echo "gate-m1.sh: the triad content pin is stale." >&2
  echo "  $CONTRACT has changed since the baseline was pinned, so its exemption has" >&2
  echo "  correctly re-armed. This is the mechanism working, not a fault." >&2
  echo "  Fix — replace both digests in $PINS with:" >&2
  echo "    $LIVE" >&2
  exit 2
fi

export TRIAD_BASELINE_FILE="$REPO_ROOT/$BASELINE"
export TRIAD_BASELINE_HASH_FILE="$REPO_ROOT/$PINS"

echo "gate-m1.sh: triad baseline scoped to $BASELINE (1 contract, pin ${LIVE:0:12}…)"
exec python3 execution/mission.py gate "$MISSION" --milestone M1 "$@"

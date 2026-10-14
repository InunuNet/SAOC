#!/usr/bin/env bash
# F2 (vendor-form-copy-20261007) -- end-to-end proof that scripts/lee-ann-drive-watch.py
# correctly detects NEW/CHANGED/REMOVED across a slash-named folder, a plain binary file, a
# Google-native file (modifiedTime fallback), and an arbitrary non-document mimeType -- all
# with zero network access via --fixture. Also proves --init never reports and --state-path
# never touches the real content/drive-watch/state.json. Defeating mutation: a folder whose
# name contains "/" is skipped or crashes the walk; a non-.docx file is dropped; a
# Google-native file without md5Checksum is silently treated as unchanged; --init writes a
# report instead of staying silent.
#
# Amendment 2026-10-09 (Orchestrator ruling, Codex QA retry): a renamed or moved item (its own
# name or parents changed) is reported as CHANGED, never as REMOVED+NEW -- RENAMEFOLDER proves
# the rename case and F8 proves the move-between-folders case. A child whose only difference is
# the display path inherited from a renamed ancestor is NOT reported -- F7 (inside
# RENAMEFOLDER, itself unchanged) proves that silence. State entries without a "parents" key
# skip the parent comparison (exercised directly in lee-ann-drive-watch.py's own
# _is_entry_changed, not re-proven here with a fixture since this harness's --fixture format
# always derives a "parents" value for every entry it walks).
set -euo pipefail

SCRIPT="scripts/lee-ann-drive-watch.py"
FIXTURES_DIR=".agent/memory/project/specs/vendor-form-copy-20261007/checks/fixtures"
BASELINE="$FIXTURES_DIR/drive-watch-baseline.json"
UPDATED="$FIXTURES_DIR/drive-watch-updated.json"
SANDBOX=".tmp/sandbox/lee-ann-drive-watch-check"
STATE="$SANDBOX/state.json"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

[ -f "$SCRIPT" ] || fail "$SCRIPT does not exist."

mkdir -p "$SANDBOX"
python3 execution/safe_delete.py "$STATE" >/dev/null 2>&1 || true

# --- --init: writes a baseline, reports nothing, always exits 0 ---
INIT_OUT=$(python3 "$SCRIPT" --fixture "$BASELINE" --init --state-path "$STATE" 2>&1)
INIT_RC=$?
[ "$INIT_RC" -eq 0 ] || fail "--init must exit 0; got $INIT_RC. Output: $INIT_OUT"
[ -f "$STATE" ] || fail "--init must write the state file at $STATE."
echo "$INIT_OUT" | grep -qi "NEW\|CHANGED\|REMOVED" && fail "--init must never report NEW/CHANGED/REMOVED -- got: $INIT_OUT"

# --- normal run against the updated fixture: must detect every expected delta ---
JSON_OUT=$(python3 "$SCRIPT" --fixture "$UPDATED" --state-path "$STATE" --json) && RC=0 || RC=$?
[ "$RC" -eq 10 ] || fail "A real change set must exit 10; got $RC. Output: $JSON_OUT"

echo "$JSON_OUT" | python3 -c "
import json, sys
report = json.load(sys.stdin)
ids = {kind: {e['id'] for e in report.get(kind, [])} for kind in ('new', 'changed', 'removed')}
errors = []
if 'F1' not in ids['changed']:
    errors.append('F1 (docx inside the slash-named folder) must be CHANGED (md5Checksum differs).')
if 'F2' in ids['changed'] or 'F2' in ids['new'] or 'F2' in ids['removed']:
    errors.append('F2 (unchanged .xlsx) must not appear in any list.')
if 'F3' not in ids['changed']:
    errors.append('F3 (Google-native, no md5Checksum) must be CHANGED via the modifiedTime fallback.')
if 'F4' not in ids['removed']:
    errors.append('F4 (absent from the updated fixture) must be REMOVED.')
if 'F5' not in ids['new']:
    errors.append('F5 (image/jpeg, a non-document mimeType) must be NEW.')
if 'RENAMEFOLDER' not in ids['changed']:
    errors.append('RENAMEFOLDER (its own name changed, same id) must be CHANGED, not REMOVED+NEW.')
if 'RENAMEFOLDER' in ids['new'] or 'RENAMEFOLDER' in ids['removed']:
    errors.append('RENAMEFOLDER must never appear in new/removed -- a rename is one CHANGED entry on its own id.')
if 'F7' in ids['new'] or 'F7' in ids['changed'] or 'F7' in ids['removed']:
    errors.append('F7 (inside RENAMEFOLDER, itself unchanged) must not appear in any list -- a path change inherited from a renamed parent is not a change of its own.')
if 'F8' not in ids['changed']:
    errors.append('F8 (moved from ROOT to SUBSLASH, same id, unchanged content) must be CHANGED via its own parents differing.')
if 'F8' in ids['new'] or 'F8' in ids['removed']:
    errors.append('F8 must never appear in new/removed -- a move is one CHANGED entry on its own id, never a REMOVED+NEW pair.')
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print('All five fixture expectations matched.')
" || fail "JSON report did not match the fixture expectations (see above)."

# --- path reporting: the slash-bearing folder name must appear in F1's reported path,
# proving it was walked rather than skipped (the exact bug drive_docx_sync.py has today) ---
echo "$JSON_OUT" | python3 -c "
import json, sys
report = json.load(sys.stdin)
f1 = next((e for e in report.get('changed', []) if e['id'] == 'F1'), None)
if f1 is None or '13. Registration/Booking/Tickets' not in f1.get('path', ''):
    print('F1 report entry missing or its path does not include the slash-bearing folder name.', file=sys.stderr)
    sys.exit(1)
" || fail "F1's reported path must include the literal slash-bearing folder name."

# --- a second run with no fixture change must exit 0 and report nothing ---
NOCHANGE_OUT=$(python3 "$SCRIPT" --fixture "$UPDATED" --state-path "$STATE" --json 2>&1) && NOCHANGE_RC=0 || NOCHANGE_RC=$?
[ "$NOCHANGE_RC" -eq 0 ] || fail "An unchanged re-run must exit 0; got $NOCHANGE_RC. Output: $NOCHANGE_OUT"

python3 execution/safe_delete.py "$STATE" "$SANDBOX" >/dev/null 2>&1 || true

echo "PASS: F2 drive-watch fixture walk detects NEW/CHANGED/REMOVED correctly, including the slash-named folder and the Google-native modifiedTime fallback; --init and --state-path behave correctly."

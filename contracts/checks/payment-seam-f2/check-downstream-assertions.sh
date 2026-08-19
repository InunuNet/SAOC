#!/usr/bin/env bash
# A5 — EVERY assertion in EVERY contract that touches the rewired route still passes. DISCOVERED,
# NEVER ENUMERATED.
#
# WHY THIS REPLACED AN ENUMERATED LIST. A5's first form named four artefacts it happened to know
# about, and A3's named four .sha256 goldens. Both went green while OTHER assertions for the same
# file stayed red — ticketing-hardening A33 (a diff-form pin), payfast-itn-signature A5/A6 and
# payfast-m1 A17 (content greps for code the rewire moves). That is this project's dominant defect
# class in its purest form: a check satisfied by a proxy — the list I wrote — instead of by the
# property — every assertion for this file is current. Three separate instances of it in one
# contract. Enumeration cannot be the fix for a defect caused by enumeration, so discovery is
# derived from the contracts themselves via discover_route_pins.py, which parses assertion
# commands with a YAML parser rather than grepping (prose must not register as an assertion).
#
# WHAT MAKES THIS FAIL: any SHA256/DIFF/CONTENT assertion for the route failing; any pin-shaped
# command discovery cannot classify (UNKNOWN), so a novel idiom surfaces as a finding rather than a
# silent skip; discovery finding nothing at all, which would mean the target moved or discovery
# broke.
#
# Run as: bash contracts/checks/payment-seam-f2/check-downstream-assertions.sh
set -uo pipefail

TARGET=app/api/tickets/itn/route.ts
LEDGER=contracts/golden/payment-seam-f2/broken-by-rewire.ledger
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT
status=0

python3 contracts/checks/payment-seam-f2/discover_route_pins.py "$TARGET" > "$WORKDIR/pins.txt" || {
  echo "FAIL A5: discovery itself failed — no verdict is possible."
  exit 1
}

# Extract each assertion's command VERBATIM. Whitespace is load-bearing: `shasum -a 256 -c -`
# requires exactly two spaces between digest and path, and normalising the command string breaks
# assertions that are in fact green. (Learned the hard way while writing this check — a first
# attempt collapsed whitespace and reported four healthy pins as failures.)
python3 - "$TARGET" "$WORKDIR" <<'PY'
import glob, os, sys, yaml
target, workdir = sys.argv[1], sys.argv[2]
n = 0
with open(os.path.join(workdir, "index.txt"), "w") as index:
    for contract in sorted(glob.glob("contracts/*.yaml")):
        try:
            doc = yaml.safe_load(open(contract))
        except Exception:
            continue
        if not isinstance(doc, dict):
            continue
        assertions = doc.get("assertions")
        checks = assertions.get("checks") if isinstance(assertions, dict) else (assertions or [])
        for check in checks or []:
            if not isinstance(check, dict):
                continue
            command = str(check.get("command", ""))
            if target in command:
                n += 1
                with open(os.path.join(workdir, f"{n}.sh"), "w") as handle:
                    handle.write(command)
                index.write(f"{n}\t{os.path.basename(contract)}\t{check.get('id')}\n")
PY

total=0; failed=0; deferred=0
while IFS=$'\t' read -r n contract id <&3; do
  total=$((total+1))
  kind=$(grep -E "^[A-Z0-9]+\|$contract\|$id\|" "$WORKDIR/pins.txt" | head -1 | cut -d'|' -f1)

  case "$kind" in
    WORKTREE|GITHASH)
      # Red for the whole of any feature that touches the file; green on commit. Reported, never
      # silently passed — see the note printed at the end.
      deferred=$((deferred+1))
      printf "  DEFER   %-44s %-18s (%s — re-verify after commit)\n" "$contract" "$id" "$kind"
      continue
      ;;
    UNKNOWN)
      echo "FAIL A5: discovery could not classify $contract $id — teach the grammar or declare it."
      status=1
      continue
      ;;
  esac

  if bash "$WORKDIR/$n.sh" >/dev/null 2>&1 </dev/null; then
    printf "  ok      %-44s %-18s (%s)\n" "$contract" "$id" "$kind"
  else
    failed=$((failed+1)); status=1
    if grep -q "^$contract|$id|" "$LEDGER" 2>/dev/null; then
      note="DECLARED in the ledger — the repoint has not been done yet"
    else
      note="NOT DECLARED — an unenumerated breakage, exactly what this check exists to surface"
    fi
    printf "  FAIL    %-44s %-18s (%s) %s\n" "$contract" "$id" "$kind" "$note"
  fi
done 3< "$WORKDIR/index.txt"

if [ "$total" -eq 0 ]; then
  echo "FAIL A5: no assertion in any contract mentions $TARGET. Either the file moved or discovery"
  echo "         has stopped working. A green verdict here would be meaningless."
  exit 1
fi

echo
echo "  $total assertions discovered for $TARGET — $failed failing, $deferred deferred to post-commit."
if [ "$deferred" -gt 0 ]; then
  echo "  DEFERRED assertions are working-tree-clean guards. They are red for the whole of any"
  echo "  feature that touches this file and go green on commit. They are NOT proven by this run."
fi
[ "$status" -eq 0 ] && echo "PASS A5: every discovered pin and content assertion for the route passes."
exit "$status"

#!/usr/bin/env bash
# fixture_project.sh -- sourced helper for the legacy gate proofs. Builds a throwaway project
# (an .agent/ dir holding a copy of the real .agent/contract_kinds.json with every relative hook
# command rewritten to an absolute path under the repo) so the stock gate runs the real hooks
# from a project root that is not the repo. Requires REPO_ROOT to be set by the caller.

fixture_project_init() {
  local dir="$1"
  python3 "$REPO_ROOT/execution/safe_delete.py" "$dir" || return 1
  mkdir -p "$dir/.agent" || return 1
  python3 - "$REPO_ROOT" "$dir" <<'PY' || return 1
import json, os, sys
repo, dest = sys.argv[1], sys.argv[2]
registry = json.load(open(os.path.join(repo, ".agent", "contract_kinds.json")))
for hook in registry.get("gate_hooks", []):
    if not os.path.isabs(hook["command"][0]):
        hook["command"][0] = os.path.join(repo, hook["command"][0])
json.dump(registry, open(os.path.join(dest, ".agent", "contract_kinds.json"), "w"), indent=2)
PY
}

fixture_project_cleanup() {
  python3 "$REPO_ROOT/execution/safe_delete.py" "$1" > /dev/null
}

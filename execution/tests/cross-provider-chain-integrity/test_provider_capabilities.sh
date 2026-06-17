#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMPDIR="$(mktemp -d "${TMPDIR:-/tmp}/athanor-provider-capabilities.XXXXXX")"
trap 'rm -rf "$TMPDIR"' EXIT

cd "$ROOT"

python3 execution/provider_manifest.py validate >/dev/null

for provider in claude-code codex gemini-cli opencode antigravity; do
  case "$provider" in
    claude-code) supported=architect; unsupported=__none__ ;;
    codex) supported=dev; unsupported=designer ;;
    gemini-cli) supported=qa; unsupported=dev ;;
    opencode) supported=dev; unsupported=qa ;;
    antigravity) supported=architect; unsupported=__none__ ;;
  esac
  python3 execution/provider_capabilities.py check --provider "$provider" --role "$supported" | grep -q "PASS $provider role=$supported"
  if [ "$unsupported" != "__none__" ]; then
    if python3 execution/provider_capabilities.py check --provider "$provider" --role "$unsupported" >"$TMPDIR/$provider.out" 2>&1; then
      echo "expected unsupported role check to fail for $provider/$unsupported" >&2
      exit 1
    fi
    grep -q "FAIL $provider role=$unsupported" "$TMPDIR/$provider.out"
  fi
done

if python3 execution/provider_capabilities.py check --provider opencode --role qa >"$TMPDIR/opencode-qa.out" 2>&1; then
  echo "opencode qa must fail deterministically" >&2
  exit 1
fi
grep -q "OpenCode has no verified independent QA" "$TMPDIR/opencode-qa.out"

python3 - <<'PY'
from pathlib import Path
import json
import shutil
import sys
import tempfile

root = Path.cwd()
tmp = Path(tempfile.mkdtemp(prefix="athanor-missing-role-"))
try:
    (tmp / ".agent" / "providers").mkdir(parents=True)
    for src in (root / ".agent" / "providers").glob("*.json"):
        dst = tmp / ".agent" / "providers" / src.name
        shutil.copy2(src, dst)
    target = tmp / ".agent" / "providers" / "opencode.json"
    data = json.loads(target.read_text())
    data["role_capabilities"]["roles"].pop("qa")
    target.write_text(json.dumps(data, indent=2) + "\n")
    import subprocess
    result = subprocess.run(
        [sys.executable, str(root / "execution" / "provider_manifest.py"), "--project-root", str(tmp), "validate"],
        text=True,
        capture_output=True,
    )
    assert result.returncode != 0, result.stdout + result.stderr
    assert "missing roles for opencode: qa" in (result.stdout + result.stderr)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
PY

python3 - <<'PY'
from pathlib import Path
import sys

root = Path.cwd()
sys.path.insert(0, str(root))
from execution import pulse_dispatcher as pd

paths = pd.Paths.from_root(root)

ticket = {
    "schema": pd.TICKET_SCHEMA,
    "id": "role-route-1",
    "source": "test",
    "kind": "task",
    "project_path": str(root),
    "provider": "auto",
    "requires_model": True,
    "required_roles": ["qa"],
    "prompt": "noop",
    "dedupe_key": "role-route-1",
    "max_turns": 1,
    "max_tokens": 0,
    "created_at": pd.utc_now(),
    "updated_at": pd.utc_now(),
    "complexity": "standard",
}
assert pd.validate_ticket(ticket) is None
provider, blocked = pd.select_provider(ticket, paths)
assert provider != "opencode", provider
assert provider == "codex", provider
assert blocked is False

ticket["required_roles"] = ["designer"]
provider, blocked = pd.select_provider(ticket, paths)
assert provider == "claude-code", provider
assert blocked is False
PY

python3 - <<'PY'
from pathlib import Path
from unittest.mock import patch
import json
import sys
import tempfile
import shutil

root = Path.cwd()
sys.path.insert(0, str(root))
from execution import pulse_dispatcher as pd

tmp = Path(tempfile.mkdtemp(prefix="athanor-role-dispatch-"))
try:
    shutil.copytree(root / ".agent" / "providers", tmp / ".agent" / "providers")
    paths = pd.Paths.from_root(tmp)
    paths.queue.mkdir(parents=True, exist_ok=True)
    project = tmp / "project"
    project.mkdir()
    ticket = {
        "schema": pd.TICKET_SCHEMA,
        "id": "explicit-unsupported",
        "source": "test",
        "kind": "task",
        "project_path": str(project),
        "provider": "opencode",
        "requires_model": True,
        "required_roles": ["qa"],
        "prompt": "noop",
        "dedupe_key": "explicit-unsupported",
        "max_turns": 1,
        "max_tokens": 0,
        "created_at": pd.utc_now(),
        "updated_at": pd.utc_now(),
    }
    ticket_path = paths.queue / "explicit-unsupported.json"
    ticket_path.write_text(json.dumps(ticket), encoding="utf-8")

    def forbidden_launch(*args, **kwargs):
        raise AssertionError("provider launch must not happen for unsupported role")

    with patch.object(pd, "launch_provider", side_effect=forbidden_launch):
        launches, progressed = pd.dispatch_ticket(paths, ticket_path, max_launches=1, launches=0)

    assert launches == 0
    assert progressed is True
    archived = list(paths.archive.glob("*/*.unsupported-role.json"))
    assert archived, "unsupported-role archive missing"
    archived_ticket = json.loads(archived[0].read_text())
    assert archived_ticket["dispatch_status"] == "unsupported-role"
    assert "lacks required role support" in archived_ticket["dispatch_reason"]
    assert not ticket_path.exists()
finally:
    shutil.rmtree(tmp, ignore_errors=True)
PY

echo "cross-provider-chain-integrity provider capability tests PASS"

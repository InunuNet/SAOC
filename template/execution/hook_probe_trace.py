"""Diagnostic: show, per declared hook, the registration string and the raw
exit codes the probe gets for its deny and allow payloads.

Run from a workspace root:  python3 execution/hook_probe_trace.py
Read-only apart from the throwaway boxes hook_probe itself creates.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hook_probe as h  # noqa: E402

root = Path.cwd().resolve()
decls = h._load_declarations(root)
seen = set()
for event, command in h._registrations(root):
    if command in seen:
        continue
    seen.add(command)
    script = h._match_script(command, decls, root)
    decl = decls.get(script) if script else None
    if not decl:
        continue
    print("== %s  %s" % (event, script))
    print("   command: %r" % command)
    print("   want deny_rc=%r allow_rc=%r" % (decl.get("deny_rc"), decl.get("allow_rc")))
    for phase in ("deny", "allow"):
        try:
            rc = h._run_phase(root, command, decl, phase)
        except Exception as exc:  # report, never hide
            rc = "EXC %s: %s" % (type(exc).__name__, exc)
        print("   %s -> rc=%r" % (phase, rc))

#!/usr/bin/env python3
"""A10-A11: generator runs twice into the in-project sandbox with identical hashes, and nothing under branding/ is touched or written to."""
import hashlib, subprocess, sys
from pathlib import Path

GEN = "scripts/generate-saoc-media-kit.py"
SANDBOX = Path(".tmp/sandbox/media-kit-complete")

def snapshot(root):
    return {str(p): (p.stat().st_mtime_ns, p.stat().st_size) for p in sorted(Path(root).rglob("*")) if p.is_file()}

def tree_hash(root):
    root = Path(root)
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob("*")) if p.is_file()}

if not Path(GEN).is_file():
    print(f"FAIL: {GEN} missing"); sys.exit(1)
src = Path(GEN).read_text()
for line in src.splitlines():
    if "branding" in line and any(w in line for w in (".save(", "write_bytes", "write_text", "mkdir", "open(", "'wb'", '"wb"', "copy")) and "Image.open" not in line and "read" not in line:
        print(f"FAIL: possible write toward branding/: {line.strip()}"); sys.exit(1)

before = snapshot("branding")
runs = []
for n in (1, 2):
    out = SANDBOX / f"run{n}"
    r = subprocess.run([sys.executable, GEN, "--out", str(out)], capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-800:], r.stderr[-800:]); print(f"FAIL: generator run {n} exited {r.returncode}"); sys.exit(1)
    runs.append(tree_hash(out))
if not runs[0]:
    print("FAIL: generator wrote nothing"); sys.exit(1)
if runs[0] != runs[1]:
    diff = [k for k in runs[0] if runs[0][k] != runs[1].get(k)] + [k for k in runs[1] if k not in runs[0]]
    print("FAIL: non-deterministic:", diff[:10]); sys.exit(1)
if snapshot("branding") != before:
    print("FAIL: branding/ changed while the generator ran"); sys.exit(1)
subprocess.run([sys.executable, "execution/safe_delete.py", str(SANDBOX)], check=False)
print(f"OK: two runs produced {len(runs[0])} identical files; branding/ untouched")

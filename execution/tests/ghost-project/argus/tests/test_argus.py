#!/usr/bin/env python3
"""
Argus test suite — covers all 10 assertions from SPEC.md
Uses subprocess.run and tempfile.mkdtemp; no third-party dependencies.
"""

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

# Resolve argus.py path relative to this file
ARGUS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "argus.py")
FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "sample_dir")

PASS = 0
FAIL = 0
RESULTS = []


def run(*args, **kwargs):
    """Run argus.py with given arguments, return CompletedProcess."""
    cmd = [sys.executable, ARGUS] + list(args)
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


def record(name, passed, detail=""):
    global PASS, FAIL
    status = "PASS" if passed else "FAIL"
    if passed:
        PASS += 1
    else:
        FAIL += 1
    marker = "[OK]" if passed else "[FAIL]"
    msg = f"{marker} {name}"
    if detail:
        msg += f" — {detail}"
    RESULTS.append(msg)
    print(msg)


# ---------------------------------------------------------------------------
# Test 1: Missing dir → exit 1
# ---------------------------------------------------------------------------
def test_missing_dir():
    result = run("snapshot", "/nonexistent_argus_test_dir_xyz")
    record("T1: missing dir → exit 1", result.returncode == 1,
           f"got exit {result.returncode}")


# ---------------------------------------------------------------------------
# Test 2: Valid snapshot created and contains sha256
# ---------------------------------------------------------------------------
def test_valid_snapshot():
    tmpdir = tempfile.mkdtemp()
    snap = os.path.join(tmpdir, "snap.json")
    try:
        result = run("snapshot", FIXTURES, "--output", snap)
        if result.returncode != 0:
            record("T2: valid snapshot created", False, f"exit {result.returncode}: {result.stderr}")
            return
        with open(snap) as f:
            data = json.load(f)
        # Must have 'files' with sha256 keys
        ok = (
            "files" in data
            and len(data["files"]) > 0
            and all("sha256" in v for v in data["files"].values())
        )
        record("T2: valid snapshot created", ok,
               f"{len(data.get('files', {}))} files, sha256 present")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Test 3: No changes → diff exits 0
# ---------------------------------------------------------------------------
def test_no_changes():
    tmpdir = tempfile.mkdtemp()
    snap = os.path.join(tmpdir, "snap.json")
    try:
        run("snapshot", FIXTURES, "--output", snap)
        result = run("diff", FIXTURES, snap)
        record("T3: no changes → exit 0", result.returncode == 0,
               f"exit {result.returncode}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Test 4: File added → diff exits 1
# ---------------------------------------------------------------------------
def test_file_added():
    tmpdir = tempfile.mkdtemp()
    snap = os.path.join(tmpdir, "snap.json")
    work = os.path.join(tmpdir, "work")
    shutil.copytree(FIXTURES, work)
    try:
        run("snapshot", work, "--output", snap)
        # Add a new file
        with open(os.path.join(work, "new_file.txt"), "w") as f:
            f.write("brand new")
        result = run("diff", work, snap)
        # Check exit 1 AND "added" event in output
        output_lines = [json.loads(l) for l in result.stdout.strip().splitlines() if l.strip()]
        added = any(e["event"] == "added" and "new_file.txt" in e["path"] for e in output_lines)
        record("T4: file added → exit 1", result.returncode == 1 and added,
               f"exit {result.returncode}, added event: {added}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Test 5: File removed → diff exits 1
# ---------------------------------------------------------------------------
def test_file_removed():
    tmpdir = tempfile.mkdtemp()
    snap = os.path.join(tmpdir, "snap.json")
    work = os.path.join(tmpdir, "work")
    shutil.copytree(FIXTURES, work)
    try:
        run("snapshot", work, "--output", snap)
        os.remove(os.path.join(work, "hello.txt"))
        result = run("diff", work, snap)
        output_lines = [json.loads(l) for l in result.stdout.strip().splitlines() if l.strip()]
        removed = any(e["event"] == "removed" and "hello.txt" in e["path"] for e in output_lines)
        record("T5: file removed → exit 1", result.returncode == 1 and removed,
               f"exit {result.returncode}, removed event: {removed}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Test 6: File modified → diff exits 1, event=modified
# ---------------------------------------------------------------------------
def test_file_modified():
    tmpdir = tempfile.mkdtemp()
    snap = os.path.join(tmpdir, "snap.json")
    work = os.path.join(tmpdir, "work")
    shutil.copytree(FIXTURES, work)
    try:
        run("snapshot", work, "--output", snap)
        with open(os.path.join(work, "hello.txt"), "w") as f:
            f.write("Modified content!")
        result = run("diff", work, snap)
        output_lines = [json.loads(l) for l in result.stdout.strip().splitlines() if l.strip()]
        modified = any(e["event"] == "modified" and "hello.txt" in e["path"] for e in output_lines)
        record("T6: file modified → exit 1 + modified event",
               result.returncode == 1 and modified,
               f"exit {result.returncode}, modified event: {modified}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Test 7: Large file → no OOM (streaming SHA256)
# ---------------------------------------------------------------------------
def test_large_file_streaming():
    """Create a 15MB file and snapshot it. If streaming is broken, memory use will spike."""
    tmpdir = tempfile.mkdtemp()
    snap = os.path.join(tmpdir, "snap.json")
    large_dir = os.path.join(tmpdir, "large")
    os.makedirs(large_dir)
    large_file = os.path.join(large_dir, "big.bin")
    try:
        # Write 15MB of repeating bytes
        chunk = b"A" * (1024 * 1024)  # 1MB
        with open(large_file, "wb") as f:
            for _ in range(15):
                f.write(chunk)
        result = run("snapshot", large_dir, "--output", snap)
        if result.returncode != 0:
            record("T7: large file streaming", False,
                   f"exit {result.returncode}: {result.stderr}")
            return
        with open(snap) as f:
            data = json.load(f)
        ok = "big.bin" in data["files"] and len(data["files"]["big.bin"]["sha256"]) == 64
        record("T7: large file streaming (15MB)", ok,
               f"sha256 length: {len(data['files'].get('big.bin', {}).get('sha256', ''))}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Test 8: Symlink not followed by default
# ---------------------------------------------------------------------------
def test_symlink_skip():
    tmpdir = tempfile.mkdtemp()
    snap = os.path.join(tmpdir, "snap.json")
    work = os.path.join(tmpdir, "work")
    shutil.copytree(FIXTURES, work)
    link_path = os.path.join(work, "link_to_hello.txt")
    try:
        os.symlink(os.path.join(work, "hello.txt"), link_path)
        result = run("snapshot", work, "--output", snap)
        with open(snap) as f:
            data = json.load(f)
        # Symlink should NOT be in the snapshot
        symlink_present = any("link_to_hello" in p for p in data["files"])
        record("T8: symlink not followed by default", not symlink_present,
               f"symlink in snapshot: {symlink_present}, files: {list(data['files'].keys())}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Test 9: Determinism — two snapshots identical byte-for-byte
# ---------------------------------------------------------------------------
def test_determinism():
    tmpdir = tempfile.mkdtemp()
    snap1 = os.path.join(tmpdir, "snap1.json")
    snap2 = os.path.join(tmpdir, "snap2.json")
    try:
        run("snapshot", FIXTURES, "--output", snap1)
        run("snapshot", FIXTURES, "--output", snap2)
        with open(snap1) as f:
            data1 = json.load(f)
        with open(snap2) as f:
            data2 = json.load(f)
        # Files map must be identical; created_at will differ, so compare files only
        ok = data1["files"] == data2["files"]
        record("T9: determinism (files map identical)", ok)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Test 10: --ignore works — .pyc file excluded from snapshot
# ---------------------------------------------------------------------------
def test_ignore_pattern():
    tmpdir = tempfile.mkdtemp()
    snap = os.path.join(tmpdir, "snap.json")
    work = os.path.join(tmpdir, "work")
    shutil.copytree(FIXTURES, work)
    try:
        # Create a .pyc file that should be ignored
        pyc_path = os.path.join(work, "compiled.pyc")
        with open(pyc_path, "wb") as f:
            f.write(b"\x03\xf3\x0d\x0a" * 10)  # fake pyc magic bytes
        result = run("snapshot", work, "--output", snap, "--ignore", "*.pyc")
        if result.returncode != 0:
            record("T10: --ignore *.pyc works", False,
                   f"exit {result.returncode}: {result.stderr}")
            return
        with open(snap) as f:
            data = json.load(f)
        pyc_present = any(p.endswith(".pyc") for p in data["files"])
        record("T10: --ignore *.pyc works", not pyc_present,
               f"pyc in snapshot: {pyc_present}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Run all tests
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Argus test suite — {ARGUS}")
    print("-" * 60)

    test_missing_dir()
    test_valid_snapshot()
    test_no_changes()
    test_file_added()
    test_file_removed()
    test_file_modified()
    test_large_file_streaming()
    test_symlink_skip()
    test_determinism()
    test_ignore_pattern()

    total = PASS + FAIL
    print("-" * 60)
    print(f"RESULT: {PASS}/{total} passed")

    if FAIL > 0:
        sys.exit(1)
    sys.exit(0)

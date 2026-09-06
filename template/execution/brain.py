#!/usr/bin/env python3
"""Athanor Brain — Semantic memory for AI agents.

Stores session summaries as vector embeddings in a local Chroma database.
Enables semantic search over project history without loading everything into context.

Usage:
    python3 execution/brain.py remember --summary "Refactored auth to use OAuth2" --tags "auth,security"
    python3 execution/brain.py recall "authentication decisions"
    python3 execution/brain.py recall "what framework did we choose" --n 3
    python3 execution/brain.py list
    python3 execution/brain.py forget <memory_id>
    python3 execution/brain.py stats
    python3 execution/brain.py wrap-up --summary "Session: built brain.py for semantic memory"
    python3 execution/brain.py last-session              # Show most recent wrap-up
    python3 execution/brain.py last-session --quiet       # One-liner for hooks
    python3 execution/brain.py export > backup.json       # Export all memories
    python3 execution/brain.py import backup.json         # Import memories
    python3 execution/brain.py compact                    # Merge old memories
    python3 execution/brain.py remember --summary "Hit Tauri popup rendering bug again" --blockers "tauri-popup"
    python3 execution/brain.py wrap-up --summary "Session summary" --blockers "tauri-popup,webview-rendering"
    python3 execution/brain.py scan-blockers            # Detect recurring issues

Requires: pip install chromadb (installed in ~/.athanor-env)
Database: .agent/memory/brain/ (project-local, persistent)
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

VENV_PATH = os.path.expanduser("~/.athanor-env")

def _ensure_chromadb():
    """Auto-bootstrap: create shared venv + install chromadb if needed."""
    try:
        import chromadb
        return chromadb
    except ImportError:
        pass

    # Check if venv exists but we're not running inside it
    venv_python = os.path.join(VENV_PATH, "bin", "python3")
    if os.path.exists(venv_python):
        # Re-exec ourselves inside the venv
        os.execv(venv_python, [venv_python] + sys.argv)

    # Create venv + install chromadb
    import subprocess
    print("🧠 First run — setting up brain environment...", file=sys.stderr)
    subprocess.run([sys.executable, "-m", "venv", VENV_PATH], check=True)
    pip = os.path.join(VENV_PATH, "bin", "pip")
    subprocess.run([pip, "install", "-q", "chromadb"], check=True)
    print("✅ Brain environment ready.", file=sys.stderr)
    # Re-exec inside the new venv
    os.execv(venv_python, [venv_python] + sys.argv)

_ensure_chromadb()
import chromadb

BRAIN_DIR = ".agent/memory/brain"


def get_collection():
    """Get or create the project memory collection."""
    Path(BRAIN_DIR).mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=BRAIN_DIR)
    return client.get_or_create_collection(
        name="project_memory",
        metadata={"hnsw:space": "cosine"},
    )


def remember(summary: str, tags: str = "", source: str = "manual", blockers: str = ""):
    """Store a memory with automatic embedding."""
    collection = get_collection()
    mem_id = f"mem_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    metadata = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tags": tags,
        "source": source,
        "word_count": len(summary.split()),
    }
    if blockers:
        metadata["blockers"] = blockers
    collection.add(
        ids=[mem_id],
        documents=[summary],
        metadatas=[metadata],
    )
    print(f"✅ Stored: {mem_id} ({metadata['word_count']} words)")
    return mem_id


def recall(query: str, n_results: int = 5):
    """Semantic search over stored memories."""
    collection = get_collection()
    if collection.count() == 0:
        print("🧠 Brain is empty. Nothing to recall.")
        return []

    n = min(n_results, collection.count())
    results = collection.query(query_texts=[query], n_results=n)

    memories = []
    for i in range(len(results["ids"][0])):
        mem = {
            "id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "distance": round(results["distances"][0][i], 4),
            "metadata": results["metadatas"][0][i],
        }
        memories.append(mem)

    # Print formatted output
    for i, mem in enumerate(memories, 1):
        ts = mem["metadata"].get("timestamp", "?")[:10]
        tags = mem["metadata"].get("tags", "")
        dist = mem["distance"]
        relevance = "🟢" if dist < 0.3 else "🟡" if dist < 0.6 else "🔴"
        print(f"\n{relevance} [{i}] {mem['id']}  (dist={dist}, date={ts})")
        if tags:
            print(f"   Tags: {tags}")
        # Truncate long texts for display
        text = mem["text"]
        if len(text) > 300:
            text = text[:300] + "..."
        print(f"   {text}")

    return memories


def recall_raw(query: str, n_results: int = 5):
    """Return memories as JSON (for agent consumption)."""
    collection = get_collection()
    if collection.count() == 0:
        print("[]")
        return

    n = min(n_results, collection.count())
    results = collection.query(query_texts=[query], n_results=n)

    memories = []
    for i in range(len(results["ids"][0])):
        memories.append({
            "id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "distance": results["distances"][0][i],
            "metadata": results["metadatas"][0][i],
        })
    print(json.dumps(memories, indent=2))


def list_all():
    """List all stored memories."""
    collection = get_collection()
    count = collection.count()
    if count == 0:
        print("🧠 Brain is empty.")
        return

    all_data = collection.get()
    print(f"🧠 Brain contains {count} memories:\n")
    for i in range(count):
        mid = all_data["ids"][i]
        meta = all_data["metadatas"][i]
        doc = all_data["documents"][i]
        ts = meta.get("timestamp", "?")[:10]
        tags = meta.get("tags", "")
        words = meta.get("word_count", "?")
        preview = doc[:80] + "..." if len(doc) > 80 else doc
        tag_str = f"  [{tags}]" if tags else ""
        print(f"  {mid}  {ts}  {words}w{tag_str}")
        print(f"    {preview}")
        print()


def forget(memory_id: str):
    """Delete a specific memory."""
    collection = get_collection()
    try:
        collection.delete(ids=[memory_id])
        print(f"🗑️  Forgotten: {memory_id}")
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)


def stats():
    """Show brain statistics."""
    collection = get_collection()
    count = collection.count()
    brain_path = Path(BRAIN_DIR)
    size = sum(f.stat().st_size for f in brain_path.rglob("*") if f.is_file())
    size_mb = round(size / 1024 / 1024, 2)
    print(f"🧠 Brain Stats:")
    print(f"   Memories: {count}")
    print(f"   Size: {size_mb} MB")
    print(f"   Path: {brain_path.resolve()}")


# The exact two-line header write_reboot() stamps on every file it generates.
# Provenance is decided by matching this in full (not just the title line) —
# see contract-f2.yaml notes.design_decision_guard for why an mtime guard was
# rejected in favor of this.
REBOOT_AUTO_HEADER_RE = re.compile(
    r"\A# Reboot Context\n_Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z_\n"
)


def _write_never_clobber(target: Path, content: str) -> Path:
    """Write `content` to `target` without ever overwriting an existing file.

    If `target` already exists (two writes landing on the same intended name —
    e.g. a frozen clock producing the same timestamp twice, as under test), keep
    appending a numeric suffix (`<stem>-1<suffix>`, `-2`, ...) until a free name
    is found. Returns the path actually written to. Callers that want the
    filename itself to carry a timestamp compute one into `target` before
    calling this; this function's own fallback is deliberately plain so it
    never stacks a second timestamp onto an already-timestamped name.
    """
    candidate = target
    n = 1
    while candidate.exists():
        candidate = target.with_name(f"{target.stem}-{n}{target.suffix}")
        n += 1
    candidate.write_text(content)
    return candidate


def _reboot_utc_stamp() -> str:
    """Microsecond-precision UTC timestamp for sibling filenames — fine enough
    that two writes landing on the same one is rare even without the
    collision guard in _write_never_clobber, which handles it regardless."""
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f") + "Z"


def write_reboot(summary: str, next_items: list = None, facts: list = None, do_not_touch: list = None,
                  closure_candidates: list = None, path=None, force_reboot: bool = False):
    """Write a lightweight reboot.md so the next session has instant context (<20 lines).

    reboot.md is the file agents read first at context-compaction/boot time, so an
    unconditional overwrite risks destroying a hand-authored handoff (GH incident:
    Omarchy v3.7.148). Provenance is decided from the file's own bytes: only a file
    that carries write_reboot's own two-line header (or is absent) is safe to
    overwrite silently. Anything else — hand-authored content, a near-miss title
    without the stamp, or a present-but-empty file — is preserved untouched; the
    auto summary is instead written to reboot.auto.md, and a loud WARN is emitted.
    Pass force_reboot=True to opt into overwriting anyway; the prior content is
    copied to a timestamped reboot.preserved-<UTC>.md sibling first.
    """
    path = Path(path) if path else Path(".agent/memory/project/reboot.md")
    lines = [
        "# Reboot Context",
        f"_Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M')}Z_",
        "",
        "## What happened last session",
        summary,
        "",
    ]
    if next_items:
        lines += ["## Top priorities", *[f"- {item}" for item in next_items[:5]], ""]
    if facts:
        lines += ["## Critical facts", *[f"- {fact}" for fact in facts[:5]], ""]
    if do_not_touch:
        lines += ["## Do NOT touch", *[f"- {item}" for item in do_not_touch[:5]], ""]
    if closure_candidates:
        lines += ["## Closure candidates (needs sign-off)",
                   *[f"- {item}" for item in closure_candidates[:5]], ""]
    content = "\n".join(lines)
    path.parent.mkdir(parents=True, exist_ok=True)

    existing_text = path.read_text() if path.exists() else None
    is_provenanced = existing_text is not None and bool(REBOOT_AUTO_HEADER_RE.match(existing_text))

    if existing_text is not None and not is_provenanced and not force_reboot:
        # Absent (existing_text is None) is the only case exempt from this guard —
        # present-but-unrecognized (hand-authored, near-miss header, or empty) must
        # never be silently overwritten.
        #
        # The sidecar itself must never be clobbered either: nothing in the repo
        # reads reboot.auto.md automatically, so a second (or Nth) diverted wrap-up
        # silently overwriting it would destroy every summary between the first
        # divert and whenever someone notices — trading one-time data loss for
        # ongoing silent staleness, which is worse. The first divert writes
        # reboot.auto.md itself; every one after that lands on a fresh
        # reboot.auto-<UTC>.md sibling instead, so nothing already on disk is ever
        # replaced and the newest file sorts last by name.
        sidecar_base = path.parent / "reboot.auto.md"
        if sidecar_base.exists():
            sidecar = _write_never_clobber(
                path.parent / f"reboot.auto-{_reboot_utc_stamp()}.md", content)
        else:
            sidecar = _write_never_clobber(sidecar_base, content)
        print(
            f"⚠️  WARN: {path} does not carry write_reboot's provenance header — "
            f"it looks hand-authored, so it was left untouched. The auto-generated "
            f"session summary was written to {sidecar} instead. Run "
            f"`brain.py wrap-up --force-reboot` to overwrite {path} anyway (the "
            f"current content is preserved to a timestamped reboot.preserved-*.md "
            f"copy first)."
        )
        return

    if existing_text is not None and not is_provenanced and force_reboot:
        preserved = _write_never_clobber(
            path.parent / f"reboot.preserved-{_reboot_utc_stamp()}.md", existing_text)
        path.write_text(content)
        print(f"⚠️  WARN: --force-reboot overwrote {path}; prior content preserved to {preserved}")
        return

    # existing_text is None (absent), or the existing file already carries our own
    # provenance header (the everyday wrap-up-to-wrap-up path) — write in place,
    # exactly as before, with no sidecar and no WARN.
    path.write_text(content)
    print(f"📝 Reboot context written to {path}")


# Explicit filename allowlist for durable system state that other
# subsystems are designed to keep in .agent/memory/scratch/. Exempt from
# wrap_up()'s scratch purge unconditionally (including under --force).
# Fixed filename set only — never a substring/regex match.
SCRATCH_PURGE_EXEMPT = {"template_baselines.json", "compaction-hint.json", ".quota_status.json", ".last_activity.json"}


def _main_worktree_root(cwd: Path = None) -> Path:
    """Resolve the main git worktree root, even when cwd is inside a linked worktree
    (whose own active.json is a stale, branch-frozen snapshot — see golden doc F2).
    Falls back to cwd itself when git resolution is unavailable (not a repo, git
    missing, timeout, non-zero exit) — this preserves today's behavior for the
    common single-worktree case and never raises."""
    cwd = cwd or Path.cwd()
    try:
        result = subprocess.run(
            ["git", "-C", str(cwd), "rev-parse", "--path-format=absolute", "--git-common-dir"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return cwd
        return Path(result.stdout.strip()).parent
    except Exception:
        return cwd


def _should_skip_scratch_purge(cwd: Path = None) -> tuple:
    """Decide whether wrap_up() should skip the scratch purge. Returns (skip, reason).

    Reads active.json from the MAIN worktree root (see _main_worktree_root), and
    resolves the mission path it names relative to that same root — never relative to
    cwd, and never trusting a linked worktree's own (possibly stale) active.json copy.

    Fail-safe: any read/parse failure once active.json is known to exist returns
    skip=True (do NOT purge) rather than silently proceeding — ambiguous state must
    fail toward not destroying scratch, matching the fail-safe direction already
    established for clear_active()/GH #1333.
    """
    root = _main_worktree_root(cwd)
    active_path = root / ".agent/memory/project/missions/active.json"
    if not active_path.exists():
        return False, None
    try:
        active_data = json.loads(active_path.read_text())
        mission_rel = active_data.get("mission", "")
        if not mission_rel:
            return False, None
        mission_file = root / mission_rel
        if not mission_file.exists():
            return False, None
        mission_text = mission_file.read_text()
        m = re.search(r'^status:\s*(\S+)', mission_text, re.MULTILINE)
        if m and m.group(1) in ("in_progress", "pending"):
            return True, f"active mission in progress: {mission_rel}"
        return False, None
    except Exception as e:
        return True, f"could not verify active-mission state ({e}) — failing safe"


def wrap_up(summary: str, tags: str = "", blockers: str = "", force: bool = False,
            next_items: list = None, facts: list = None, do_not_touch: list = None,
            closure_candidates: list = None, force_reboot: bool = False):
    """End-of-session wrap-up: store summary + clear scratch."""
    # Write lightweight reboot context for next session
    write_reboot(summary, next_items=next_items, facts=facts, do_not_touch=do_not_touch,
                 closure_candidates=closure_candidates, force_reboot=force_reboot)
    # Store the session summary
    mem_id = remember(summary, tags=tags or "session,wrap-up", source="wrap-up", blockers=blockers)

    # Guard: skip scratch purge if an active in-progress mission exists
    if not force:
        skip, reason = _should_skip_scratch_purge()
        if skip:
            print(
                "Warning:  Active mission detected — skipping scratch purge. "
                f"({reason}) Run brain.py wrap-up after mission close-out."
            )
            return mem_id

    # Clear scratch files. SCRATCH_PURGE_EXEMPT is an explicit filename
    # allowlist for durable system state that legitimately lives in scratch
    # by another subsystem's design (e.g. the template-updater's baseline
    # store, docs/template-update.md:332). This exemption is unconditional —
    # it applies even under --force. It is a fixed filename set, never a
    # name/content pattern match.
    #
    # DURABLE SESSION HANDOFF NOTES (RESUME.md, relay drafts, etc.) DO NOT
    # LIVE IN SCRATCH. They are written directly to .agent/memory/project/handoff/,
    # which is a committed directory outside scratch entirely and therefore
    # untouched by this purge. See .agent/memory/project/handoff/ and
    # .agent/skills/write-handoff.md (Durable class) for the convention.
    scratch_dir = Path(".agent/memory/scratch")
    if scratch_dir.exists():
        cleared = 0
        for f in scratch_dir.iterdir():
            if f.name != ".keep" and f.name not in SCRATCH_PURGE_EXEMPT:
                if f.is_dir():
                    shutil.rmtree(f)
                else:
                    f.unlink()
                cleared += 1
        if cleared:
            print(f"🧹 Cleared {cleared} scratch files.")

    return mem_id


def latest_wrapup_timestamp() -> str | None:
    """Return the ISO timestamp of the most recent wrap-up memory, or None if none exist."""
    collection = get_collection()
    if collection.count() == 0:
        return None

    all_data = collection.get(
        where={"source": "wrap-up"},
    )
    if not all_data["ids"]:
        return None

    latest_ts = ""
    for meta in all_data["metadatas"]:
        ts = meta.get("timestamp", "")
        if ts > latest_ts:
            latest_ts = ts
    return latest_ts or None


def last_session(quiet: bool = False):
    """Show the most recent wrap-up memory."""
    collection = get_collection()
    if collection.count() == 0:
        if quiet:
            print("No prior sessions.")
        else:
            print("🧠 No sessions recorded yet.")
        return None

    latest_ts = latest_wrapup_timestamp()
    if latest_ts is None:
        if quiet:
            print("No prior sessions.")
        else:
            print("🧠 No wrap-up memories found.")
        return None

    # Get all wrap-up memories, find the one matching the latest timestamp
    all_data = collection.get(
        where={"source": "wrap-up"},
    )
    latest_idx = 0
    for i, meta in enumerate(all_data["metadatas"]):
        if meta.get("timestamp", "") == latest_ts:
            latest_idx = i
            break

    doc = all_data["documents"][latest_idx]
    meta = all_data["metadatas"][latest_idx]
    ts = meta.get("timestamp", "?")[:16]
    tags = meta.get("tags", "")

    if quiet:
        print(f"Last session ({ts}): {doc}")
    else:
        print(f"🧠 Last Session ({ts}):")
        print(f"   {doc}")
        if tags:
            print(f"   Tags: {tags}")

    return doc


def export_memories():
    """Export all memories to JSON (stdout)."""
    collection = get_collection()
    if collection.count() == 0:
        print("[]")
        return

    all_data = collection.get()
    memories = []
    for i in range(len(all_data["ids"])):
        memories.append({
            "id": all_data["ids"][i],
            "document": all_data["documents"][i],
            "metadata": all_data["metadatas"][i],
        })
    print(json.dumps(memories, indent=2))
    print(f"# Exported {len(memories)} memories", file=sys.stderr)


def import_memories(filepath: str):
    """Import memories from a JSON file."""
    with open(filepath) as f:
        memories = json.load(f)

    collection = get_collection()
    imported = 0
    skipped = 0
    existing_ids = set(collection.get()["ids"])

    for mem in memories:
        if mem["id"] in existing_ids:
            skipped += 1
            continue
        collection.add(
            ids=[mem["id"]],
            documents=[mem["document"]],
            metadatas=[mem["metadata"]],
        )
        imported += 1

    print(f"✅ Imported {imported} memories ({skipped} skipped as duplicates)")


def compact():
    """Merge old memories to reduce noise. Keeps recent, summarizes old."""
    collection = get_collection()
    count = collection.count()
    if count <= 10:
        print(f"🧠 Only {count} memories — too few to compact.")
        return

    all_data = collection.get()
    # Sort by timestamp, keep the 10 newest, flag rest for review
    entries = []
    for i in range(len(all_data["ids"])):
        entries.append({
            "id": all_data["ids"][i],
            "doc": all_data["documents"][i],
            "meta": all_data["metadatas"][i],
        })
    entries.sort(key=lambda e: e["meta"].get("timestamp", ""), reverse=True)

    recent = entries[:10]
    old = entries[10:]
    print(f"🧠 Brain has {count} memories.")
    print(f"   Recent (keeping): {len(recent)}")
    print(f"   Old (candidates for removal): {len(old)}")
    print(f"\nOld memories:")
    for e in old:
        ts = e["meta"].get("timestamp", "?")[:10]
        preview = e["doc"][:60] + "..." if len(e["doc"]) > 60 else e["doc"]
        print(f"   {e['id']}  {ts}  {preview}")
    print(f"\nTo remove old memories: python3 execution/brain.py forget <id>")


def _parse_blockers(raw: str) -> list:
    """Normalize a comma-separated blocker string into a list of lowercase tags."""
    return [b.strip().lower() for b in raw.split(",") if b.strip()]


def scan_blockers():
    """Scan brain for recurring blockers across sessions. Exit 1 if found."""
    collection = get_collection()
    if collection.count() == 0:
        print("No memories to scan.")
        return False

    # Only load memories that have blockers, skip document text
    try:
        all_data = collection.get(
            where={"blockers": {"$ne": ""}},
            include=["metadatas"],
        )
    except Exception:
        # Fallback for older Chroma versions or empty filter results
        all_data = collection.get(include=["metadatas"])

    if not all_data["ids"]:
        print("No recurring blockers detected.")
        return False

    blocker_sessions = {}  # blocker_tag -> list of (date, memory_id)

    for i in range(len(all_data["ids"])):
        meta = all_data["metadatas"][i]
        blockers_str = meta.get("blockers", "")
        if not blockers_str:
            continue
        ts = meta.get("timestamp", "")[:10]
        mem_id = all_data["ids"][i]
        for b in _parse_blockers(blockers_str):
            if b not in blocker_sessions:
                blocker_sessions[b] = []
            blocker_sessions[b].append({"date": ts, "id": mem_id})

    # Filter to recurring only (2+)
    recurring = {k: v for k, v in blocker_sessions.items() if len(v) >= 2}

    if not recurring:
        print("No recurring blockers detected.")
        return False

    print("⚠️  RECURRING BLOCKERS DETECTED:\n")
    for blocker, sessions in sorted(recurring.items(), key=lambda x: -len(x[1])):
        count = len(sessions)
        if count >= 3:
            level = "🔴 PIVOT"
            action = "Architect pivot recommendation needed"
        else:
            level = "🟡 RESEARCH"
            action = "Deep research into alternatives needed"

        dates = ", ".join(s["date"] for s in sessions)
        print(f"  {level} [{count}x] {blocker}")
        print(f"    Sessions: {dates}")
        print(f"    Action: {action}")
        print()

    return True


def resolve_blocker(blocker: str, resolution: str, fix_type: str = "learned"):
    """Mark a recurring blocker as resolved by storing a resolution memory."""
    mem_id = remember(
        summary=f"Resolved blocker '{blocker}': {resolution}",
        tags=f"pain-point,resolved,{blocker}",
        source="pain-point-resolution",
    )
    # Update metadata with extra fields by retrieving and upserting
    collection = get_collection()
    existing = collection.get(ids=[mem_id])
    if existing["ids"]:
        meta = existing["metadatas"][0]
        meta["blocker"] = blocker
        meta["fix_type"] = fix_type
        collection.update(ids=[mem_id], metadatas=[meta])
    print(f"✅ Blocker '{blocker}' marked resolved: {mem_id}")
    return mem_id


def main():
    parser = argparse.ArgumentParser(
        description="Athanor Brain — Semantic memory for AI agents.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="action", required=True)

    # remember
    p_rem = sub.add_parser("remember", help="Store a new memory")
    p_rem.add_argument("--summary", "-s", required=True, help="Memory content")
    p_rem.add_argument("--tags", "-t", default="", help="Comma-separated tags")
    p_rem.add_argument("--source", default="manual", help="Source identifier")
    p_rem.add_argument("--blockers", "-b", default="", help="Comma-separated blocker tags")

    # recall
    p_rec = sub.add_parser("recall", help="Semantic search over memories")
    p_rec.add_argument("query", help="Search query")
    p_rec.add_argument("--n", type=int, default=5, help="Number of results")
    p_rec.add_argument("--json", action="store_true", help="Output as JSON")

    # list
    sub.add_parser("list", help="List all memories")

    # forget
    p_fgt = sub.add_parser("forget", help="Delete a memory")
    p_fgt.add_argument("id", help="Memory ID to delete")

    # stats
    sub.add_parser("stats", help="Show brain statistics")

    # wrap-up
    p_wrap = sub.add_parser("wrap-up", help="Session wrap-up: store summary + clear scratch")
    p_wrap.add_argument("--summary", "-s", required=True, help="Session summary")
    p_wrap.add_argument("--tags", "-t", default="", help="Comma-separated tags")
    p_wrap.add_argument("--blockers", "-b", default="", help="Comma-separated blocker tags")
    p_wrap.add_argument("--force", action="store_true",
                        help="Bypass active-mission guard and purge scratch unconditionally")
    p_wrap.add_argument("--force-reboot", action="store_true", dest="force_reboot",
                        help="Overwrite reboot.md even if it looks hand-authored "
                             "(prior content is preserved to reboot.preserved-*.md first)")
    p_wrap.add_argument("--next", nargs="*", metavar="ITEM", dest="next_items",
                        help="Top priority items for next session (written to reboot.md)")
    p_wrap.add_argument("--facts", nargs="*", metavar="FACT",
                        help="Critical facts to preserve across compact")
    p_wrap.add_argument("--do-not-touch", nargs="*", metavar="PATH", dest="do_not_touch",
                        help="Files/dirs that must not be modified next session")
    p_wrap.add_argument("--closure-candidates", nargs="*", metavar="ITEM", dest="closure_candidates",
                        help="GitHub issue closure candidates for the user to sign off on (written to reboot.md)")

    # last-session
    p_last = sub.add_parser("last-session", help="Show the most recent wrap-up memory")
    p_last.add_argument("--quiet", "-q", action="store_true", help="One-line output for hooks")

    # export
    sub.add_parser("export", help="Export all memories to JSON (stdout)")

    # import
    p_imp = sub.add_parser("import", help="Import memories from JSON file")
    p_imp.add_argument("file", help="JSON file to import")

    # compact
    sub.add_parser("compact", help="Review and merge old memories")

    # scan-blockers
    sub.add_parser("scan-blockers", help="Detect recurring blockers across sessions")

    # resolve-blocker
    p_res = sub.add_parser("resolve-blocker", help="Mark a recurring blocker as resolved")
    p_res.add_argument("--blocker", "-b", required=True, help="Blocker tag to resolve")
    p_res.add_argument("--resolution", "-r", required=True, help="What was done to fix it")
    p_res.add_argument("--fix-type", "-f", default="learned", help="Fix type: learned or backlog")

    args = parser.parse_args()

    if args.action == "remember":
        remember(args.summary, args.tags, args.source, args.blockers)
    elif args.action == "recall":
        if args.json:
            recall_raw(args.query, args.n)
        else:
            recall(args.query, args.n)
    elif args.action == "list":
        list_all()
    elif args.action == "forget":
        forget(args.id)
    elif args.action == "stats":
        stats()
    elif args.action == "wrap-up":
        wrap_up(args.summary, args.tags, args.blockers, force=args.force,
                next_items=getattr(args, "next_items", None),
                facts=getattr(args, "facts", None),
                do_not_touch=getattr(args, "do_not_touch", None),
                closure_candidates=getattr(args, "closure_candidates", None),
                force_reboot=getattr(args, "force_reboot", False))
    elif args.action == "last-session":
        last_session(args.quiet)
    elif args.action == "export":
        export_memories()
    elif args.action == "import":
        import_memories(args.file)
    elif args.action == "compact":
        compact()
    elif args.action == "scan-blockers":
        found = scan_blockers()
        sys.exit(1 if found else 0)
    elif args.action == "resolve-blocker":
        resolve_blocker(args.blocker, args.resolution, args.fix_type)


if __name__ == "__main__":
    main()

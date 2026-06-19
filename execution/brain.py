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
import shutil
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


def wrap_up(summary: str, tags: str = "", blockers: str = ""):
    """End-of-session wrap-up: store summary + clear scratch."""
    # Store the session summary
    mem_id = remember(summary, tags=tags or "session,wrap-up", source="wrap-up", blockers=blockers)

    # Clear scratch files
    scratch_dir = Path(".agent/memory/scratch")
    if scratch_dir.exists():
        cleared = 0
        for f in scratch_dir.iterdir():
            if f.name != ".keep":
                if f.is_dir():
                    shutil.rmtree(f)
                else:
                    f.unlink()
                cleared += 1
        if cleared:
            print(f"🧹 Cleared {cleared} scratch files.")

    return mem_id


def last_session(quiet: bool = False):
    """Show the most recent wrap-up memory."""
    collection = get_collection()
    if collection.count() == 0:
        if quiet:
            print("No prior sessions.")
        else:
            print("🧠 No sessions recorded yet.")
        return None

    # Get all wrap-up memories, sorted by timestamp
    all_data = collection.get(
        where={"source": "wrap-up"},
    )
    if not all_data["ids"]:
        if quiet:
            print("No prior sessions.")
        else:
            print("🧠 No wrap-up memories found.")
        return None

    # Find the most recent by timestamp
    latest_idx = 0
    latest_ts = ""
    for i, meta in enumerate(all_data["metadatas"]):
        ts = meta.get("timestamp", "")
        if ts > latest_ts:
            latest_ts = ts
            latest_idx = i

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
        wrap_up(args.summary, args.tags, args.blockers)
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

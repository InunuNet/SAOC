#!/usr/bin/env python3
"""
KI Relevance Check — execution/ki_recall.py
Scans the Athanor KI store and returns KIs relevant to a query.
Uses simple word-overlap scoring (no external deps required).

Usage:
    python3 execution/ki_recall.py "user query" [--n 3] [--json] [--ki-dir /path/to/knowledge]
"""

import os
import sys
import json
import re
import argparse
from pathlib import Path

DEFAULT_KI_DIR = Path.home() / ".gemini" / "athanor" / "knowledge"
STOPWORDS = {
    "a", "an", "the", "is", "in", "on", "at", "to", "for", "of", "and",
    "or", "with", "as", "by", "from", "it", "this", "that", "are", "was",
    "be", "been", "has", "have", "had", "not", "but", "if", "we", "i",
    "you", "he", "she", "they", "our", "your", "its", "all", "any", "can",
    "will", "may", "also", "how", "what", "when", "which", "who", "use",
    "used", "using", "more", "no", "into", "up", "do", "so", "my", "new",
}


def tokenize(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z0-9_\-]+", text.lower())
    return {w for w in words if w not in STOPWORDS and len(w) > 2}


def score(query_tokens: set[str], doc_tokens: set[str]) -> float:
    if not query_tokens or not doc_tokens:
        return 0.0
    overlap = query_tokens & doc_tokens
    # Jaccard-ish: overlap / query length (recall-biased)
    return len(overlap) / len(query_tokens)


def load_kis(ki_dir: Path) -> list[dict]:
    results = []
    if not ki_dir.exists():
        return results
    for entry in sorted(ki_dir.iterdir()):
        if not entry.is_dir():
            continue
        meta_path = entry / "metadata.json"
        if not meta_path.exists():
            continue
        try:
            meta = json.loads(meta_path.read_text())
        except Exception:
            continue
        # Collect artifact paths
        artifacts_dir = entry / "artifacts"
        artifact_paths = []
        if artifacts_dir.exists():
            for f in sorted(artifacts_dir.rglob("*")):
                if f.is_file():
                    artifact_paths.append(str(f.relative_to(artifacts_dir)))
        results.append({
            "id": entry.name,
            "title": meta.get("title", entry.name),
            "summary": meta.get("summary", ""),
            "updated_at": meta.get("updatedAt", meta.get("createdAt", "")),
            "artifacts_dir": str(artifacts_dir),
            "artifact_paths": artifact_paths,
        })
    return results


def recall(query: str, n: int = 3, ki_dir: Path = DEFAULT_KI_DIR) -> list[dict]:
    query_tokens = tokenize(query)
    kis = load_kis(ki_dir)
    scored = []
    for ki in kis:
        doc_text = f"{ki['title']} {ki['summary']}"
        doc_tokens = tokenize(doc_text)
        s = score(query_tokens, doc_tokens)
        if s > 0:
            scored.append({**ki, "score": round(s, 4)})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:n]


def main():
    parser = argparse.ArgumentParser(description="KI relevance recall")
    parser.add_argument("query", nargs="?", default="", help="Search query")
    parser.add_argument("--n", type=int, default=3, help="Max results")
    parser.add_argument("--json", action="store_true", help="JSON output")
    parser.add_argument(
        "--ki-dir",
        type=Path,
        default=DEFAULT_KI_DIR,
        help="Path to KI knowledge directory",
    )
    args = parser.parse_args()

    if not args.query:
        # No query — list all KIs as a fallback
        results = load_kis(args.ki_dir)
        for ki in results:
            ki["score"] = None
    else:
        results = recall(args.query, n=args.n, ki_dir=args.ki_dir)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        if not results:
            print("No relevant KIs found.")
            return
        for ki in results:
            score_str = f" (score: {ki['score']})" if ki.get("score") else ""
            print(f"📚 {ki['title']}{score_str}")
            print(f"   {ki['summary'][:120]}...")
            if ki["artifact_paths"]:
                rel_base = Path(ki["artifacts_dir"]).relative_to(
                    Path.home() / ".gemini" / "athanor" / "knowledge" / ki["id"]
                )
                print(f"   Artifacts ({len(ki['artifact_paths'])}): {ki['artifacts_dir']}/")
            print()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
gh_closure_scan.py — Read-only GitHub issue closure-candidate scanner.

Cross-references this session's shipped commits and completed missions against
currently-open GitHub issues. NEVER closes issues — surfaces candidates only,
for the user to confirm.

Usage:
  python3 execution/gh_closure_scan.py [--since ISO8601] [--repo OWNER/REPO]
      [--missions-dir PATH] [--open-issues-json PATH] [--format json|lines]
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ISSUE_RE = re.compile(r"#(\d+)")


def _resolve_since(since: str | None) -> str | None:
    if since:
        return since
    sys.path.insert(0, str(REPO_ROOT / "execution"))
    import brain
    return brain.latest_wrapup_timestamp()


def _resolve_repo(repo: str | None) -> str:
    if repo:
        return repo
    result = subprocess.run(
        ["bash", str(REPO_ROOT / "execution" / "get_repo_info.sh")],
        capture_output=True, text=True, cwd=str(REPO_ROOT),
    )
    if result.returncode != 0 or not result.stdout.strip():
        print(f"ERROR: could not resolve --repo: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()


def _commit_evidence(since: str) -> dict:
    """Evidence A: issue numbers referenced in commit subjects since `since`."""
    evidence = {}
    result = subprocess.run(
        ["git", "log", f"--since={since}", "--pretty=format:%H%x1f%s"],
        capture_output=True, text=True, cwd=str(REPO_ROOT),
    )
    if result.returncode != 0:
        return evidence
    for line in result.stdout.splitlines():
        if "\x1f" not in line:
            continue
        sha, subject = line.split("\x1f", 1)
        for m in ISSUE_RE.finditer(subject):
            number = int(m.group(1))
            if number not in evidence:
                evidence[number] = {"source": f"commit {sha[:7]}", "evidence": subject}
    return evidence


def _mission_evidence(missions_dir: Path, since: str) -> dict:
    """Evidence B: issue numbers referenced in the goal of completed missions since `since`."""
    evidence = {}
    if not missions_dir.exists():
        return evidence
    sys.path.insert(0, str(REPO_ROOT / "execution"))
    import mission

    for path in sorted(missions_dir.glob("*.md")):
        try:
            fm, _ = mission.parse_mission_file(str(path))
        except SystemExit:
            continue
        if fm.get("status") != "done":
            continue
        last_active = fm.get("last_active_at") or ""
        if not last_active or last_active < since:
            continue
        goal = fm.get("goal", "")
        for m in ISSUE_RE.finditer(goal):
            number = int(m.group(1))
            if number not in evidence:
                evidence[number] = {"source": f"mission {path.name}", "evidence": goal}
    return evidence


def _open_issue_numbers(repo: str, open_issues_json: str | None) -> set:
    if open_issues_json:
        data = json.loads(Path(open_issues_json).read_text())
        return {item["number"] for item in data}
    result = subprocess.run(
        ["gh", "issue", "list", "--repo", repo, "--state", "open", "--json", "number"],
        capture_output=True, text=True, cwd=str(REPO_ROOT),
    )
    if result.returncode != 0:
        print(
            f"WARNING: gh issue list failed, treating open-issue set as empty: {result.stderr.strip()}",
            file=sys.stderr,
        )
        return set()
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        print(
            f"WARNING: could not parse gh issue list output, treating open-issue set as empty: {e}",
            file=sys.stderr,
        )
        return set()
    return {item["number"] for item in data}


def scan(since: str, repo: str, missions_dir: Path, open_issues_json: str | None) -> list:
    merged = _commit_evidence(since)
    for number, ev in _mission_evidence(missions_dir, since).items():
        merged.setdefault(number, ev)

    open_numbers = _open_issue_numbers(repo, open_issues_json)

    candidates = [
        {"number": number, "source": ev["source"], "evidence": ev["evidence"]}
        for number, ev in merged.items()
        if number in open_numbers
    ]
    candidates.sort(key=lambda c: c["number"])
    return candidates


def main():
    parser = argparse.ArgumentParser(
        description="Scan for GitHub issue closure candidates (read-only, never closes issues)."
    )
    parser.add_argument("--since", help="ISO8601 timestamp; default: brain.latest_wrapup_timestamp()")
    parser.add_argument("--repo", help="OWNER/REPO; default: execution/get_repo_info.sh output")
    parser.add_argument("--missions-dir", default=".agent/memory/project/missions")
    parser.add_argument("--open-issues-json", help="Path to JSON file of open issues (skips the gh call)")
    parser.add_argument("--format", choices=["json", "lines"], default="json")
    args = parser.parse_args()

    since = _resolve_since(args.since)
    if since is None:
        if args.format == "json":
            print("[]")
        sys.exit(0)

    repo = _resolve_repo(args.repo)
    missions_dir = Path(args.missions_dir)
    candidates = scan(since, repo, missions_dir, args.open_issues_json)

    if args.format == "lines":
        for c in candidates:
            print(f"GH #{c['number']} — {c['evidence']} ({c['source']})")
    else:
        print(json.dumps(candidates))

    sys.exit(0)


if __name__ == "__main__":
    main()

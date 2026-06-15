#!/usr/bin/env python3
"""Budget-gated provider dispatcher for queued Pulse tickets."""

from __future__ import annotations

import argparse
import json
import os
import shlex
import shutil
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


TICKET_SCHEMA = "athanor.pulse.ticket/v1"
VALID_PROVIDERS = ("claude-code", "codex", "gemini-cli", "antigravity", "opencode")
DEFAULT_MAX_LAUNCHES = 1

# Fix 2: consecutive-failure provider backoff constants.
CONSECUTIVE_FAILURE_THRESHOLD = 3
BACKOFF_SECONDS = 14400  # 4 hours


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def stable_name(value: str) -> str:
    import hashlib

    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:32]


def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default
    except json.JSONDecodeError:
        return default


def write_json_atomic(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass
class Paths:
    root: Path
    queue: Path
    archive: Path
    state: Path
    leases: Path
    dedupe: Path

    @classmethod
    def from_root(cls, root: Path) -> "Paths":
        pulse = root / ".agent" / "pulse"
        return cls(
            root=root,
            queue=pulse / "queue",
            archive=pulse / "archive" / "tickets",
            state=pulse / "dispatcher",
            leases=pulse / "leases",
            dedupe=pulse / "dispatcher" / "dedupe",
        )


@dataclass
class Lease:
    path: Path
    held: bool = False

    def release(self) -> None:
        if not self.held:
            return
        try:
            marker = self.path / "owner.json"
            if marker.exists():
                marker.unlink()
            self.path.rmdir()
        except OSError:
            pass
        self.held = False


def acquire_lease(path: Path, ttl_seconds: int) -> Lease | None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        path.mkdir()
    except FileExistsError:
        if ttl_seconds > 0:
            try:
                age = time.time() - path.stat().st_mtime
            except OSError:
                age = 0
            if age > ttl_seconds:
                shutil.rmtree(path, ignore_errors=True)
                try:
                    path.mkdir()
                except FileExistsError:
                    return None
            else:
                return None
        else:
            return None
    write_json_atomic(path / "owner.json", {"pid": os.getpid(), "acquired_at": utc_now()})
    return Lease(path=path, held=True)


def validate_ticket(ticket: dict[str, Any]) -> str | None:
    required = (
        "schema",
        "id",
        "source",
        "kind",
        "project_path",
        "provider",
        "requires_model",
        "prompt",
        "dedupe_key",
        "max_turns",
        "max_tokens",
        "created_at",
        "updated_at",
    )
    for key in required:
        if key not in ticket:
            return f"missing {key}"
    if ticket["schema"] != TICKET_SCHEMA:
        return f"unsupported schema {ticket['schema']!r}"
    if ticket["provider"] not in VALID_PROVIDERS:
        return f"unsupported provider {ticket['provider']!r}"
    return None


def queued_tickets(queue: Path) -> list[Path]:
    queue.mkdir(parents=True, exist_ok=True)
    return sorted(p for p in queue.glob("*.json") if p.is_file())


def archive_ticket(paths: Paths, ticket_path: Path, ticket: dict[str, Any], status: str, reason: str) -> Path:
    ticket["updated_at"] = utc_now()
    ticket["dispatch_status"] = status
    ticket["dispatch_reason"] = reason
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    archive_dir = paths.archive / stamp
    safe_id = "".join(ch if ch.isalnum() or ch in "._-" else "-" for ch in str(ticket.get("id", ticket_path.stem)))
    dest = archive_dir / f"{safe_id}.{status}.json"
    suffix = 1
    while dest.exists():
        dest = archive_dir / f"{safe_id}.{status}.{suffix}.json"
        suffix += 1
    write_json_atomic(dest, ticket)
    try:
        ticket_path.unlink()
    except FileNotFoundError:
        pass
    return dest


def dedupe_marker(paths: Paths, dedupe_key: str) -> Path:
    return paths.dedupe / f"{stable_name(dedupe_key)}.json"


def reserve_dedupe(paths: Paths, ticket: dict[str, Any]) -> bool:
    marker = dedupe_marker(paths, str(ticket["dedupe_key"]))
    marker.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "dedupe_key": ticket["dedupe_key"],
        "ticket_id": ticket["id"],
        "reserved_at": utc_now(),
    }
    try:
        fd = os.open(str(marker), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    except FileExistsError:
        return False
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, sort_keys=True)
        fh.write("\n")
    return True


def budget_state_path(paths: Paths) -> Path:
    return paths.state / "budget.json"


def load_budget(paths: Paths) -> dict[str, Any]:
    state = read_json(budget_state_path(paths), {})
    day = today_key()
    if state.get("date") != day:
        # Preserve backoff/failure state across day boundary — backoff is not day-scoped.
        preserved = {
            "provider_failures": state.get("provider_failures", {}),
            "provider_backoff": state.get("provider_backoff", {}),
        }
        state = {"date": day, "launches": 0, "tokens": 0, "last_launch_at": None,
                 "project_launches": {}}
        state.update(preserved)
    return state


def save_budget(paths: Paths, state: dict[str, Any]) -> None:
    write_json_atomic(budget_state_path(paths), state)


# --- Fix 2: consecutive-failure provider backoff ----------------------------

def _backoff_key(provider: str, project_path: str) -> str:
    return f"{provider}:{project_path}"


def check_provider_backoff(paths: Paths, provider: str, project_path: str) -> str | None:
    """Return a block reason if provider+project is in backoff, else None."""
    state = load_budget(paths)
    key = _backoff_key(provider, project_path)
    backoff_until = state.get("provider_backoff", {}).get(key)
    if not backoff_until:
        return None
    try:
        until = datetime.fromisoformat(str(backoff_until).replace("Z", "+00:00")).timestamp()
    except ValueError:
        until = 0
    if time.time() < until:
        remaining = int(until - time.time())
        return f"provider {provider} backing off for {remaining}s after repeated failures"
    # Backoff expired — clear both backoff and failure counter, persist.
    state.get("provider_backoff", {}).pop(key, None)
    state.get("provider_failures", {}).pop(key, None)
    save_budget(paths, state)
    return None


def record_failure(paths: Paths, provider: str, project_path: str) -> None:
    state = load_budget(paths)
    key = _backoff_key(provider, project_path)
    failures = state.setdefault("provider_failures", {})
    failures[key] = int(failures.get(key, 0)) + 1
    if failures[key] >= CONSECUTIVE_FAILURE_THRESHOLD:
        until = (datetime.now(timezone.utc) + timedelta(seconds=BACKOFF_SECONDS)).isoformat()
        state.setdefault("provider_backoff", {})[key] = until
    save_budget(paths, state)


def record_success(paths: Paths, provider: str, project_path: str) -> None:
    state = load_budget(paths)
    key = _backoff_key(provider, project_path)
    if state.get("provider_failures", {}).pop(key, None) is not None:
        state.get("provider_backoff", {}).pop(key, None)
        save_budget(paths, state)

# --- end Fix 2 ---------------------------------------------------------------


def budget_block_reason(paths: Paths, ticket: dict[str, Any]) -> str | None:
    state = load_budget(paths)
    cooldown = env_int("ATHANOR_PULSE_COOLDOWN_SECONDS", 300)
    # Fix 4: DAILY_MAX_LAUNCHES constant referenced for daily launch budget.
    DAILY_MAX_LAUNCHES = env_int("ATHANOR_PULSE_DAILY_MAX_LAUNCHES", 20)
    max_tokens = env_int("ATHANOR_PULSE_DAILY_MAX_TOKENS", 200000)
    per_project_max = env_int("ATHANOR_PULSE_PER_PROJECT_DAILY_MAX", 5)

    if cooldown > 0 and state.get("last_launch_at"):
        try:
            last = datetime.fromisoformat(str(state["last_launch_at"]).replace("Z", "+00:00")).timestamp()
        except ValueError:
            last = 0
        remaining = cooldown - int(time.time() - last)
        if remaining > 0:
            return f"cooldown active for {remaining}s"

    requested_tokens = int(ticket.get("max_tokens") or 0)
    if int(state.get("launches") or 0) >= DAILY_MAX_LAUNCHES:
        return "daily launch budget exhausted"
    if int(state.get("tokens") or 0) + requested_tokens > max_tokens:
        return "daily token budget exhausted"

    # Fix 4: per-project daily launch cap.
    project_path = str(ticket.get("project_path") or "")
    project_launches = state.get("project_launches", {})
    if project_path and int(project_launches.get(project_path, 0)) >= per_project_max:
        return f"per-project daily launch cap reached ({per_project_max}) for {project_path}"

    # Fix 2: provider backoff check.
    provider = str(ticket.get("provider") or "")
    if provider and project_path:
        backoff_reason = check_provider_backoff(paths, provider, project_path)
        if backoff_reason:
            return backoff_reason

    return None


def record_launch(paths: Paths, ticket: dict[str, Any]) -> None:
    state = load_budget(paths)
    state["launches"] = int(state.get("launches") or 0) + 1
    state["tokens"] = int(state.get("tokens") or 0) + int(ticket.get("max_tokens") or 0)
    state["last_launch_at"] = utc_now()
    # Fix 4: track per-project daily launches.
    project_path = str(ticket.get("project_path") or "")
    if project_path:
        project_launches = state.setdefault("project_launches", {})
        project_launches[project_path] = int(project_launches.get(project_path, 0)) + 1
    save_budget(paths, state)


def provider_command(ticket: dict[str, Any]) -> tuple[list[str] | None, str | None]:
    provider = str(ticket["provider"])
    prompt = str(ticket.get("prompt") or "")
    # Fix 4: resolve max_turns for turn-limit flag injection.
    max_turns = int(ticket.get("max_turns") or 1)
    overrides = {
        "claude-code": "ATHANOR_PULSE_PROVIDER_CLAUDE_CODE",
        "codex": "ATHANOR_PULSE_PROVIDER_CODEX",
        "gemini-cli": "ATHANOR_PULSE_PROVIDER_GEMINI_CLI",
        "antigravity": "ATHANOR_PULSE_PROVIDER_ANTIGRAVITY",
        "opencode": "ATHANOR_PULSE_PROVIDER_OPENCODE",
    }
    raw_override = os.environ.get(overrides.get(provider, ""))
    if raw_override:
        parts = shlex.split(raw_override)
        if "{prompt}" in parts:
            return [prompt if part == "{prompt}" else part for part in parts], None
        return parts + [prompt], None

    if provider == "claude-code":
        # Fix 4: pass --max-turns to claude CLI.
        return ["claude", "-p", prompt, "--max-turns", str(max_turns)], None
    if provider == "codex":
        return ["codex", "exec", prompt], None
    if provider == "gemini-cli":
        # Fix 4: pass --max-turns to gemini CLI.
        return ["gemini", "-p", prompt, "--max-turns", str(max_turns)], None
    if provider == "opencode":
        # Fix 4: opencode has no --max-turns flag; use `opencode run` headlessly.
        return ["opencode", "run", prompt], None
    if provider == "antigravity":
        return None, "antigravity has no configured non-interactive adapter"
    return None, f"unsupported provider {provider}"


def provider_ready(ticket: dict[str, Any]) -> tuple[list[str] | None, str | None]:
    cmd, reason = provider_command(ticket)
    if reason:
        return None, reason
    assert cmd is not None
    if not shutil.which(cmd[0]):
        return None, f"provider binary not found: {cmd[0]}"
    return cmd, None


def launch_provider(ticket: dict[str, Any], cmd: list[str]) -> tuple[bool, str]:
    timeout = max(60, int(ticket.get("max_turns") or 1) * 600)
    env = os.environ.copy()
    env["ATHANOR_PULSE_TICKET_ID"] = str(ticket["id"])
    env["ATHANOR_PULSE_DEDUPE_KEY"] = str(ticket["dedupe_key"])
    try:
        result = subprocess.run(cmd, cwd=str(ticket["project_path"]), env=env, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        return False, "provider timed out"
    if result.returncode != 0:
        return False, f"provider exited {result.returncode}"
    return True, "launched"


def not_before_block(ticket: dict[str, Any]) -> str | None:
    raw = ticket.get("not_before")
    if not raw:
        return None
    try:
        ts = datetime.fromisoformat(str(raw).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None
    if ts > time.time():
        return f"not_before {raw}"
    return None


def dispatch_ticket(paths: Paths, ticket_path: Path, max_launches: int, launches: int) -> tuple[int, bool]:
    ticket = read_json(ticket_path, None)
    if not isinstance(ticket, dict):
        archive_ticket(paths, ticket_path, {"id": ticket_path.stem}, "invalid", "invalid json")
        return launches, True

    invalid = validate_ticket(ticket)
    if invalid:
        archive_ticket(paths, ticket_path, ticket, "invalid", invalid)
        return launches, True

    delayed = not_before_block(ticket)
    if delayed:
        print(f"blocked {ticket['id']}: {delayed}")
        return launches, False

    if not bool(ticket["requires_model"]):
        archive_ticket(paths, ticket_path, ticket, "recorded", "requires_model false")
        print(f"recorded {ticket['id']}: requires_model false")
        return launches, True

    if os.environ.get("ATHANOR_PULSE_MODEL_DISABLE") == "1":
        print(f"blocked {ticket['id']}: ATHANOR_PULSE_MODEL_DISABLE=1")
        return launches, False

    if launches >= max_launches:
        return launches, False

    if dedupe_marker(paths, str(ticket["dedupe_key"])).exists():
        archive_ticket(paths, ticket_path, ticket, "duplicate", "dedupe_key already dispatched")
        print(f"duplicate {ticket['id']}: dedupe_key already dispatched")
        return launches, True

    budget_reason = budget_block_reason(paths, ticket)
    if budget_reason:
        print(f"blocked {ticket['id']}: {budget_reason}")
        return launches, False

    lease_ttl = env_int("ATHANOR_PULSE_LEASE_TTL_SECONDS", 3600)
    fleet_lease = acquire_lease(paths.leases / "fleet.lock", lease_ttl)
    if fleet_lease is None:
        print(f"blocked {ticket['id']}: fleet single-flight lease held")
        return launches, False

    project_key = stable_name(str(ticket["project_path"]))
    project_lease = acquire_lease(paths.leases / f"project-{project_key}.lock", lease_ttl)
    if project_lease is None:
        fleet_lease.release()
        print(f"blocked {ticket['id']}: project single-flight lease held")
        return launches, False

    try:
        cmd, ready_reason = provider_ready(ticket)
        if ready_reason:
            print(f"blocked {ticket['id']}: {ready_reason}")
            return launches, False

        if not reserve_dedupe(paths, ticket):
            archive_ticket(paths, ticket_path, ticket, "duplicate", "dedupe_key already dispatched")
            print(f"duplicate {ticket['id']}: dedupe_key already dispatched")
            return launches, True

        assert cmd is not None
        ok, reason = launch_provider(ticket, cmd)
        if not ok:
            # Fix 2: record failure for consecutive-failure backoff tracking.
            record_failure(paths, str(ticket["provider"]), str(ticket["project_path"]))
            print(f"blocked {ticket['id']}: {reason}")
            return launches, False

        # Fix 2: clear failure counter on successful launch.
        record_success(paths, str(ticket["provider"]), str(ticket["project_path"]))
        record_launch(paths, ticket)
        archive_ticket(paths, ticket_path, ticket, "launched", reason)
        print(f"launched {ticket['id']}: {ticket['provider']}")
        return launches + 1, True
    finally:
        project_lease.release()
        fleet_lease.release()


def run_once(paths: Paths, max_launches: int) -> int:
    launches = 0
    made_progress = False
    for ticket_path in queued_tickets(paths.queue):
        before = launches
        launches, progressed = dispatch_ticket(paths, ticket_path, max_launches, launches)
        made_progress = made_progress or progressed or launches != before
        if launches >= max_launches:
            break
    return 0 if launches or made_progress else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="process the queue once")
    parser.add_argument("--project-root", default=os.getcwd(), help="workspace root; defaults to cwd")
    parser.add_argument("--max-launches", type=int, default=DEFAULT_MAX_LAUNCHES)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = Path(args.project_root).expanduser().resolve()
    paths = Paths.from_root(root)
    max_launches = max(0, int(args.max_launches))
    if not args.once:
        return run_once(paths, max_launches)
    return run_once(paths, max_launches)


if __name__ == "__main__":
    raise SystemExit(main())

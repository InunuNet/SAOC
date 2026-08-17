#!/usr/bin/env python3
"""Budget-gated provider dispatcher for queued Pulse tickets."""

from __future__ import annotations

import argparse
import fcntl
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

try:
    from execution.provider_manifest import CANONICAL_ROLES
except ModuleNotFoundError:
    from provider_manifest import CANONICAL_ROLES


TICKET_SCHEMA = "athanor.pulse.ticket/v1"
VALID_PROVIDERS = ("claude-code", "codex", "gemini-cli", "antigravity", "opencode", "auto")
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


# --- F4: Cross-workspace concurrency limiter ---

def locks_dir() -> Path:
    override = os.environ.get("ATHANOR_LOCKS_DIR")
    base = Path(override).expanduser() if override else (Path.home() / ".athanor" / "locks")
    base.mkdir(parents=True, exist_ok=True)
    return base


@dataclass
class ConcurrencySlot:
    fd: int
    path: Path

    def release(self) -> None:
        try:
            fcntl.flock(self.fd, fcntl.LOCK_UN)
            os.close(self.fd)
        except OSError:
            pass


def max_concurrent_jobs() -> int:
    return env_int("ATHANOR_MAX_CONCURRENT_JOBS", 3)


def acquire_concurrency_slot(max_slots: int, base: "Path | None" = None) -> "ConcurrencySlot | None":
    base = base or locks_dir()
    for i in range(max(1, max_slots)):
        slot = base / f"slot-{i}.lock"
        fd = os.open(str(slot), os.O_WRONLY | os.O_CREAT, 0o644)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            os.close(fd)
            continue
        return ConcurrencySlot(fd=fd, path=slot)
    return None

# --- end F4 ------------------------------------------------------------------


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
    required_roles = ticket.get("required_roles", [])
    if required_roles is None:
        return None
    if not isinstance(required_roles, list):
        return "required_roles must be a list"
    invalid_roles = [
        role for role in required_roles
        if not isinstance(role, str) or role not in CANONICAL_ROLES
    ]
    if invalid_roles:
        return f"unsupported required role(s): {', '.join(map(str, invalid_roles))}"
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


# --- F2: TTL-aware dedupe ---

def dedupe_ttl_seconds() -> int:
    return env_int("ATHANOR_PULSE_DEDUPE_TTL_SECONDS", 86400)  # 24h default


def dedupe_active(paths: Paths, dedupe_key: str, ttl_seconds: int) -> bool:
    """True iff a dedupe marker exists AND its age < ttl_seconds."""
    marker = dedupe_marker(paths, dedupe_key)
    try:
        age = time.time() - marker.stat().st_mtime
    except OSError:
        return False
    return age < ttl_seconds


def reserve_dedupe(paths: Paths, ticket: dict[str, Any]) -> bool:
    key = str(ticket["dedupe_key"])
    marker = dedupe_marker(paths, key)
    marker.parent.mkdir(parents=True, exist_ok=True)
    ttl = dedupe_ttl_seconds()
    payload = {
        "dedupe_key": key,
        "ticket_id": ticket["id"],
        "reserved_at": utc_now(),
    }
    try:
        fd = os.open(str(marker), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    except FileExistsError:
        try:
            age = time.time() - marker.stat().st_mtime
        except OSError:
            age = 0
        if age < ttl:
            return False  # active marker — skip
        # stale → refresh and allow re-dispatch
        with open(marker, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, sort_keys=True)
            fh.write("\n")
        os.utime(marker, None)
        return True
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, sort_keys=True)
        fh.write("\n")
    return True

# --- end F2 ------------------------------------------------------------------


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


def load_manifest(provider_id: str, root: Path) -> dict:
    manifest_path = root / ".agent" / "providers" / f"{provider_id}.json"
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    except Exception:
        return {}


# --- F3: Per-job token budget + max-turn cap ---

def max_tokens_per_job() -> int:
    return env_int("ATHANOR_MAX_TOKENS_PER_JOB", None) or env_int("MAX_TOKENS_PER_JOB", 500000)


def max_turns_per_job() -> int:
    return env_int("ATHANOR_MAX_TURNS_PER_JOB", None) or env_int("MAX_TURNS_PER_JOB", 20)


def min_job_tokens() -> int:
    return env_int("ATHANOR_PULSE_MIN_JOB_TOKENS", 1000)


def token_cap_abort_reason(ticket: dict[str, Any]) -> "str | None":
    """Return an abort reason if the per-job token ceiling makes the job non-viable, else None."""
    cap = max_tokens_per_job()
    if cap < min_job_tokens():
        return f"per-job token ceiling {cap} below minimum viable {min_job_tokens()}"
    return None

# --- end F3 ------------------------------------------------------------------


def build_provider_cmd(provider: str, prompt: str, max_turns: int, max_tokens: int, root: Path) -> list[str]:
    manifest = load_manifest(provider, root)
    eff_turns = min(int(max_turns or 1), max_turns_per_job())
    eff_tokens = min(int(max_tokens or max_tokens_per_job()), max_tokens_per_job())
    if manifest.get("headless_command") and isinstance(manifest["headless_command"], list):
        cmd = [part.format(prompt=prompt) for part in manifest["headless_command"]]
        if manifest.get("supports_max_turns") and eff_turns:
            cmd += ["--max-turns", str(eff_turns)]
        if manifest.get("supports_max_tokens") and eff_tokens:
            cmd += ["--max-tokens", str(eff_tokens)]
        return cmd
    return [provider, prompt]


def required_roles(ticket: dict[str, Any]) -> list[str]:
    roles = ticket.get("required_roles") or []
    if not isinstance(roles, list):
        return []
    return [role for role in roles if isinstance(role, str)]


def provider_role_block_reason(provider: str, roles: list[str], root: Path) -> str | None:
    if not roles:
        return None
    manifest = load_manifest(provider, root)
    capabilities = manifest.get("role_capabilities")
    if not isinstance(capabilities, dict):
        return f"provider {provider} missing role_capabilities"
    role_map = capabilities.get("roles")
    if not isinstance(role_map, dict):
        return f"provider {provider} missing role_capabilities.roles"
    unsupported = []
    for role in roles:
        entry = role_map.get(role)
        if not isinstance(entry, dict):
            unsupported.append(f"{role} (missing)")
        elif entry.get("supported") is not True:
            reason = str(entry.get("reason") or "unsupported")
            unsupported.append(f"{role} ({reason})")
    if unsupported:
        return f"provider {provider} lacks required role support: {', '.join(unsupported)}"
    return None


def cascade_provider(
    original_provider: str,
    paths: Paths,
    project_path: str,
    roles: list[str] | None = None,
) -> str | None:
    """Return first eligible escalation provider from original's manifest escalation_order, or None."""
    manifest = load_manifest(original_provider, paths.root)
    escalation_order = manifest.get("routing_policy", {}).get("escalation_order", [])
    required = roles or []
    for provider_id in escalation_order:
        if provider_role_block_reason(provider_id, required, paths.root):
            continue
        if check_provider_backoff(paths, provider_id, project_path) is None:
            return provider_id
    return None


def select_provider(ticket: dict[str, Any], paths: Paths) -> tuple[str | None, bool]:
    """Return (provider_id, False) on success, (None, False) if no eligible provider,
    (None, True) if eligible providers exist but all are in backoff."""
    complexity = str(ticket.get("complexity") or "standard")
    project_path = str(ticket.get("project_path") or "")
    roles = required_roles(ticket)
    candidates = []
    for pid in VALID_PROVIDERS:
        if pid == "auto":
            continue
        manifest = load_manifest(pid, paths.root)
        policy = manifest.get("routing_policy", {})
        if not policy.get("auto_route"):
            continue
        if complexity not in (policy.get("complexity") or []):
            continue
        if provider_role_block_reason(pid, roles, paths.root):
            continue
        priority = int(policy.get("priority") or 99)
        candidates.append((priority, pid))
    candidates.sort(key=lambda x: x[0])
    any_backoff_blocked = False
    for _, pid in candidates:
        if check_provider_backoff(paths, pid, project_path) is None:
            return pid, False
        any_backoff_blocked = True
    return None, any_backoff_blocked


def provider_command(ticket: dict[str, Any], paths: Paths) -> tuple[list[str] | None, str | None]:
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

    cmd = build_provider_cmd(provider, prompt, max_turns, int(ticket.get("max_tokens") or 0), paths.root)
    return cmd, None


def provider_ready(ticket: dict[str, Any], paths: Paths) -> tuple[list[str] | None, str | None]:
    cmd, reason = provider_command(ticket, paths)
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
    env["ATHANOR_MAX_TOKENS_PER_JOB"] = str(max_tokens_per_job())
    env["ATHANOR_MAX_TURNS_PER_JOB"] = str(max_turns_per_job())
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

    if str(ticket.get("provider")) == "auto":
        resolved, backoff_blocked = select_provider(ticket, paths)
        if resolved is None:
            if backoff_blocked:
                print(f"blocked {ticket['id']}: auto-route deferred — all eligible providers in backoff")
                return launches, False  # keep ticket in queue
            complexity = str(ticket.get("complexity") or "standard")
            archive_ticket(paths, ticket_path, ticket, "no-route",
                           f"no eligible provider for complexity={complexity}")
            print(f"no-route {ticket['id']}: no eligible provider for complexity={complexity}")
            return launches, True
        ticket["provider"] = resolved
        ticket["_was_auto_routed"] = True
        print(f"auto-routed {ticket['id']}: {resolved} (complexity={ticket.get('complexity', 'standard')})")

    role_reason = provider_role_block_reason(str(ticket["provider"]), required_roles(ticket), paths.root)
    if role_reason:
        archive_ticket(paths, ticket_path, ticket, "unsupported-role", role_reason)
        print(f"unsupported-role {ticket['id']}: {role_reason}")
        return launches, True

    if os.environ.get("ATHANOR_PULSE_MODEL_DISABLE") == "1":
        print(f"blocked {ticket['id']}: ATHANOR_PULSE_MODEL_DISABLE=1")
        return launches, False

    if launches >= max_launches:
        return launches, False

    if dedupe_active(paths, str(ticket["dedupe_key"]), dedupe_ttl_seconds()):
        archive_ticket(paths, ticket_path, ticket, "duplicate", "dedupe_key active within TTL")
        print(f"duplicate {ticket['id']}: dedupe_key active within TTL")
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

    slot = None
    try:
        # F4: acquire cross-workspace concurrency slot
        slot = acquire_concurrency_slot(max_concurrent_jobs())
        if slot is None:
            print(f"blocked {ticket['id']}: concurrency cap reached ({max_concurrent_jobs()})")
            return launches, False

        cmd, ready_reason = provider_ready(ticket, paths)
        if ready_reason:
            print(f"blocked {ticket['id']}: {ready_reason}")
            return launches, False

        # F3: abort if per-job token ceiling makes job non-viable
        abort_reason = token_cap_abort_reason(ticket)
        if abort_reason:
            archive_ticket(paths, ticket_path, ticket, "aborted", abort_reason)
            print(f"aborted {ticket['id']}: {abort_reason}")
            return launches, True

        if not reserve_dedupe(paths, ticket):
            archive_ticket(paths, ticket_path, ticket, "duplicate", "dedupe_key already dispatched")
            print(f"duplicate {ticket['id']}: dedupe_key already dispatched")
            return launches, True

        assert cmd is not None
        ok, reason = launch_provider(ticket, cmd)
        if not ok:
            original = str(ticket["provider"])
            record_failure(paths, original, str(ticket["project_path"]))
            escalated = (
                cascade_provider(original, paths, str(ticket["project_path"]), required_roles(ticket))
                if ticket.get("_was_auto_routed")
                else None
            )
            if escalated:
                ticket["provider"] = escalated
                print(f"cascade {ticket['id']}: {original} -> {escalated} ({reason})")
                cmd2, ready2 = provider_ready(ticket, paths)
                if cmd2:
                    ok, reason = launch_provider(ticket, cmd2)
                    if ok:
                        record_success(paths, escalated, str(ticket["project_path"]))
                        record_launch(paths, ticket)
                        archive_ticket(paths, ticket_path, ticket, "launched", reason)
                        print(f"launched {ticket['id']}: {escalated} (cascade)")
                        return launches + 1, True
                    record_failure(paths, escalated, str(ticket["project_path"]))
                    print(f"blocked {ticket['id']}: cascade failed: {reason}")
                else:
                    print(f"blocked {ticket['id']}: cascade provider not ready: {ready2}")
            else:
                print(f"blocked {ticket['id']}: {reason}")
            return launches, False

        # Fix 2: clear failure counter on successful launch.
        record_success(paths, str(ticket["provider"]), str(ticket["project_path"]))
        record_launch(paths, ticket)
        archive_ticket(paths, ticket_path, ticket, "launched", reason)
        print(f"launched {ticket['id']}: {ticket['provider']}")
        return launches + 1, True
    finally:
        if slot is not None:
            slot.release()
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
    return 1 if (launches or made_progress) else 0


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

#!/usr/bin/env python3
"""Resume a checkpointed mission after a Claude Code quota reset, exactly once.

An opted-in project gets one per-project scheduled job that runs ``tick`` every
TICK_INTERVAL_SECONDS: a launchd agent (macOS), a systemd user timer (Linux) or a Task
Scheduler task via schtasks (Windows). ``execution/statusline.py`` records each
exhaustion in ``.agent/memory/scratch/quota_resume/exhausted.json``; the tick
starts one fresh headless ``claude -p`` session once that window has reset, and
only when every gate below passes.

    install     write the unit, load it, record the opt-in
    uninstall   unload it, delete the unit, record the opt-out
    status      what is installed, pending and last resumed (--json for tools)
    tick        one idempotent pass; always exits 0

Safety, in the order it matters:
  * the event is spent in the ledger BEFORE the spawn: a crash mid-run loses
    one resume and never repeats one;
  * the child never inherits an API key, auth token or provider switch: this
    spends the subscription or nothing;
  * one run at a time, behind a kernel lock (flock, msvcrt on Windows) with a
    pid-liveness check;
  * a run is killed at MAX_RUN_SECONDS (process group, or taskkill /T on Windows);
  * ATHANOR_QUOTA_RESUME_PLATFORM / ATHANOR_LAUNCHCTL / ATHANOR_SYSTEMCTL /
    ATHANOR_SCHTASKS / ATHANOR_LAUNCH_AGENTS_DIR / ATHANOR_SYSTEMD_USER_DIR /
    ATHANOR_CLAUDE_BIN let a test drive every path without a real scheduler or a
    paid session.

Design: .agent/memory/project/specs/quota-auto-resume/DECISIONS.md
"""
from __future__ import annotations

import argparse
try:
    import fcntl
except ImportError:  # Windows: no flock; the lock below uses msvcrt.locking
    fcntl = None
import hashlib
import json
import logging
import os
import plistlib
import re
import shutil
import signal
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

TICK_INTERVAL_SECONDS = 600
RESET_GRACE_SECONDS = 120
QUIET_SECONDS = 600
MAX_RUN_SECONDS = 18000
FALLBACK_WAIT_SECONDS = 18000
FUTURE_SKEW_SECONDS = 300
MAX_EVENT_AGE_SECONDS = 691200
LEDGER_MAX = 50
KILL_GRACE_SECONDS = 10
UNINSTALL_WAIT_SECONDS = 10
UNINSTALL_POLL_SECONDS = 0.1
NOTIFY_TIMEOUT_SECONDS = 10
BANNER_MAX_RUNS = 5
MS_EPOCH_THRESHOLD = 10 ** 12
SECONDS_PER_MINUTE = 60
TIMER_FIRST_FIRE = "1s"
WIN_LOCK_OFFSET = 1 << 30  # byte locked on Windows, far past the pid record so it stays readable
WIN_PROCESS_QUERY_LIMITED = 0x1000
WIN_STILL_ACTIVE = 259
LOCK_READ_BYTES = 4096
SCHTASKS_TR_MAX = 261
WIN_ACCESS_DENIED = 5

EXIT_USAGE = 2
ISO_UTC_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
LABEL_PREFIX = "com.athanor.quota-resume"
CONFIG_SCHEMA = "athanor.quota-auto-resume/v1"
SAFE_PATH = ("/usr/bin", "/bin", "/usr/sbin", "/sbin")
STRIPPED_ENV = ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK",
                "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY")
WINDOWS = ("five_hour", "seven_day")

ENV_AGENTS_DIR = "ATHANOR_LAUNCH_AGENTS_DIR"
ENV_LAUNCHCTL = "ATHANOR_LAUNCHCTL"
ENV_SYSTEMCTL = "ATHANOR_SYSTEMCTL"
ENV_SCHTASKS = "ATHANOR_SCHTASKS"
ENV_SYSTEMD_DIR = "ATHANOR_SYSTEMD_USER_DIR"
ENV_PLATFORM = "ATHANOR_QUOTA_RESUME_PLATFORM"
ENV_CLAUDE_BIN = "ATHANOR_CLAUDE_BIN"
ENV_MAX_RUN = "ATHANOR_QUOTA_RESUME_MAX_RUN_SECONDS"
ENV_NOTIFY = "ATHANOR_QUOTA_RESUME_NOTIFY"

CONFIG_REL = Path(".agent/memory/project/quota_auto_resume.json")
ACTIVE_REL = Path(".agent/memory/project/missions/active.json")
TELEMETRY_REL = Path(".agent/memory/project/telemetry/quota_resume.jsonl")
QR_REL = Path(".agent/memory/scratch/quota_resume")
UNATTENDED_REL = Path(".agent/memory/scratch/UNATTENDED")
BANNER_REL = Path(".agent/memory/scratch/.quota_death_checkpoint.json")

SCHEDULER_LAUNCHD = "launchd"
SCHEDULER_SYSTEMD = "systemd"
SCHEDULER_SCHTASKS = "schtasks"

log = logging.getLogger("quota_auto_resume")


# ── Small helpers ─────────────────────────────────────────────────────────────

def now_epoch() -> float:
    return datetime.now(timezone.utc).timestamp()


def iso(epoch: float) -> str:
    return datetime.fromtimestamp(int(epoch), timezone.utc).strftime(ISO_UTC_FORMAT)


def parse_iso(value) -> float | None:
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def read_json(path: Path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def write_json_atomic(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.{uuid.uuid4().hex[:8]}.tmp")
    tmp.write_text(json.dumps(data, indent=2))
    tmp.replace(path)


def pid_alive(pid) -> bool:
    if not isinstance(pid, int) or pid <= 0:
        return False
    if sys.platform == "win32":
        return win_pid_alive(pid)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def win_pid_alive(pid: int) -> bool:
    """OpenProcess + GetExitCodeProcess: os.kill(pid, 0) would terminate it on Windows."""
    import ctypes
    from ctypes import wintypes
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.restype = wintypes.HANDLE
    handle = kernel.OpenProcess(WIN_PROCESS_QUERY_LIMITED, False, pid)
    if not handle:
        return ctypes.get_last_error() == WIN_ACCESS_DENIED  # denied means it exists
    try:
        code = wintypes.DWORD()
        if not kernel.GetExitCodeProcess(handle, ctypes.byref(code)):
            return True
        return code.value == WIN_STILL_ACTIVE
    finally:
        kernel.CloseHandle(handle)


def label_for(root: Path) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", root.name.lower()).strip("-") or "project"
    digest = hashlib.sha256(str(root).encode()).hexdigest()[:8]
    return f"{LABEL_PREFIX}.{slug}.{digest}"


def agents_dir() -> Path:
    told = os.environ.get(ENV_AGENTS_DIR)
    return Path(told).expanduser() if told else Path.home() / "Library" / "LaunchAgents"


def launchctl_bin() -> str:
    return os.environ.get(ENV_LAUNCHCTL) or "launchctl"


def launchctl(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([launchctl_bin(), *args], capture_output=True, text=True)


def scheduler_for_platform() -> str | None:
    """ATHANOR_QUOTA_RESUME_PLATFORM (test hook), else sys.platform; None when unsupported."""
    platform = os.environ.get(ENV_PLATFORM) or sys.platform
    if platform == "darwin":
        return SCHEDULER_LAUNCHD
    if platform.startswith("linux"):
        return SCHEDULER_SYSTEMD
    if platform == "win32":
        return SCHEDULER_SCHTASKS
    return None


def systemd_dir() -> Path:
    told = os.environ.get(ENV_SYSTEMD_DIR)
    if told:
        return Path(told).expanduser()
    config_home = os.environ.get("XDG_CONFIG_HOME")
    base = Path(config_home).expanduser() if config_home else Path.home() / ".config"
    return base / "systemd" / "user"


def run_tool(binary: str, *args: str) -> str | None:
    """Run a scheduler tool; None on success, else one line describing the failure."""
    name = Path(binary).name
    try:
        done = subprocess.run([binary, *args], capture_output=True, text=True)
    except OSError as exc:
        return f"{name} failed: {exc}"
    if done.returncode != 0:
        return f"{name} rc={done.returncode}: {(done.stderr or done.stdout).strip()}"
    return None


def systemctl(*args: str) -> str | None:
    return run_tool(os.environ.get(ENV_SYSTEMCTL) or "systemctl", "--user", *args)


def schtasks(*args: str) -> str | None:
    return run_tool(os.environ.get(ENV_SCHTASKS) or "schtasks", *args)


def executable(path) -> bool:
    return bool(path) and os.path.isfile(path) and os.access(path, os.X_OK)


def resolve_claude(config: dict | None) -> str | None:
    """ATHANOR_CLAUDE_BIN, then the recorded path, then the current PATH. Nothing else."""
    told = os.environ.get(ENV_CLAUDE_BIN)
    if executable(told):
        return told
    recorded = (config or {}).get("claude_bin")
    if executable(recorded):
        return recorded
    found = shutil.which("claude")
    return os.path.abspath(found) if found else None


# ── Per-project state ─────────────────────────────────────────────────────────

class Project:
    def __init__(self, root: Path):
        self.root = root
        self.qr = root / QR_REL
        self.label = label_for(root)

    @property
    def config(self) -> dict | None:
        data = read_json(self.root / CONFIG_REL)
        return data if isinstance(data, dict) else None

    def plist_path(self, config: dict | None = None) -> Path:
        recorded = (config or {}).get("plist_path")
        return Path(recorded) if recorded else agents_dir() / f"{self.label}.plist"

    def unit_paths(self, config: dict | None = None) -> list[Path]:
        """Files the recorded (else current) scheduler owns for this project."""
        scheduler = (config or {}).get("scheduler") or scheduler_for_platform()
        recorded = (config or {}).get("unit_paths")
        if isinstance(recorded, list) and recorded:
            return [Path(p) for p in recorded]
        if scheduler == SCHEDULER_SYSTEMD:
            return [systemd_dir() / f"{self.label}.service",
                    systemd_dir() / f"{self.label}.timer"]
        if scheduler == SCHEDULER_LAUNCHD:
            return [self.plist_path(config)]
        return []

    def opted_in(self, config: dict | None) -> bool:
        return bool(config and config.get("enabled") is True
                    and config.get("project_root") == str(self.root))

    def record(self) -> dict | None:
        """The exhaustion record, only when it is complete and parseable."""
        data = read_json(self.qr / "exhausted.json")
        if not isinstance(data, dict) or not data.get("event_id"):
            return None
        if parse_iso(data.get("resets_at")) is None:
            return None
        return data

    def ledger(self) -> list[dict]:
        data = read_json(self.qr / "consumed.json")
        entries = data.get("entries") if isinstance(data, dict) else None
        return entries if isinstance(entries, list) else []

    def spent(self, event_id: str) -> bool:
        return any(e.get("event_id") == event_id for e in self.ledger()
                   if isinstance(e, dict))

    def spend(self, event_id: str, outcome: str) -> None:
        entries = self.ledger() + [{"event_id": event_id, "outcome": outcome,
                                    "at": iso(now_epoch())}]
        write_json_atomic(self.qr / "consumed.json", {"entries": entries[-LEDGER_MAX:]})

    def events(self) -> list[dict]:
        try:
            lines = (self.root / TELEMETRY_REL).read_text().splitlines()
        except OSError:
            return []
        out = []
        for line in lines:
            try:
                item = json.loads(line)
            except ValueError:
                continue
            if isinstance(item, dict):
                out.append(item)
        return out

    def log_event(self, event: str, event_id: str | None = None, **fields) -> None:
        path = self.root / TELEMETRY_REL
        path.parent.mkdir(parents=True, exist_ok=True)
        line = {"ts": iso(now_epoch()), "event": event, "event_id": event_id,
                "project_root": str(self.root), **fields}
        with open(path, "a") as handle:
            handle.write(json.dumps(line) + "\n")

    def log_error_once(self, event_id: str | None, reason: str) -> None:
        seen = any(e.get("event") == "error" and e.get("event_id") == event_id
                   and e.get("reason") == reason for e in self.events())
        if not seen:
            self.log_event("error", event_id, reason=reason)

    def active_mission(self) -> Path | None:
        active = read_json(self.root / ACTIVE_REL)
        rel = active.get("mission") if isinstance(active, dict) else None
        if not rel:
            return None
        path = self.root / str(rel)
        return path if path.is_file() else None

    def last_activity(self) -> float | None:
        """Latest operator signal: the heartbeat, or any seen session's transcript mtime.

        A transcript is appended the moment a prompt is submitted, before any
        statusline fingerprint field moves, so its mtime is the earlier signal.
        """
        beat = read_json(self.qr / "heartbeat.json")
        if not isinstance(beat, dict):
            return None
        seen = [parse_iso(beat.get("activity_at"))]
        sessions = beat.get("sessions")
        for entry in (sessions.values() if isinstance(sessions, dict) else ()):
            path = entry.get("transcript_path") if isinstance(entry, dict) else None
            try:
                seen.append(os.stat(path).st_mtime if path else None)
            except OSError:
                continue
        times = [x for x in seen if x is not None]
        return max(times) if times else None


def mission_slug(mission_file: Path) -> str:
    try:
        text = mission_file.read_text()
    except OSError:
        return mission_file.stem
    found = re.search(r"^slug:\s*(\S+)\s*$", text, re.M)
    return found.group(1).strip("'\"") if found else mission_file.stem


# ── install / uninstall / status ──────────────────────────────────────────────

def path_dirs(claude_bin: str) -> list[str]:
    dirs = []
    for entry in (os.path.dirname(claude_bin), os.path.dirname(sys.executable), *SAFE_PATH):
        if entry and entry not in dirs:
            dirs.append(entry)
    return dirs


def script_path(project: Project) -> str:
    return str(project.root / "execution" / "quota_auto_resume.py")


def build_plist(project: Project, claude_bin: str) -> dict:
    return {
        "Label": project.label,
        "ProgramArguments": [sys.executable, script_path(project),
                             "tick", "--project", str(project.root)],
        "WorkingDirectory": str(project.root),
        "StartInterval": TICK_INTERVAL_SECONDS,
        "RunAtLoad": True,
        "EnvironmentVariables": {"PATH": ":".join(path_dirs(claude_bin))},
        "StandardOutPath": str(project.qr / "launchd.log"),
        "StandardErrorPath": str(project.qr / "launchd.log"),
    }


def systemd_escape(value: str, expand_env: bool = False) -> str:
    """Escape %spec (every setting) and $VAR (ExecStart words only) for a unit file."""
    value = value.replace("%", "%%")
    return value.replace("$", "$$") if expand_env else value


def systemd_quote(value: str, expand_env: bool = False) -> str:
    """Escape, then double-quote a word holding whitespace, quotes or backslashes."""
    value = systemd_escape(value, expand_env)
    if not re.search(r'[\s"\\]', value):
        return value
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def build_service(project: Project, claude_bin: str) -> str:
    exec_start = " ".join(systemd_quote(a, expand_env=True) for a in (
        sys.executable, script_path(project), "tick", "--project", str(project.root)))
    path = systemd_quote("PATH=" + ":".join(path_dirs(claude_bin)))
    log_file = systemd_escape(str(project.qr / "launchd.log"))
    return "\n".join([
        "[Unit]", f"Description=Athanor quota auto-resume tick "
        f"({systemd_escape(project.root.name)})", "",
        "[Service]", "Type=oneshot", f"ExecStart={exec_start}",
        f"WorkingDirectory={systemd_escape(str(project.root))}", f"Environment={path}",
        f"StandardOutput=append:{log_file}", f"StandardError=append:{log_file}", ""])


def build_timer(project: Project) -> str:
    return "\n".join([
        "[Unit]", f"Description=Athanor quota auto-resume timer "
        f"({systemd_escape(project.root.name)})", "",
        "[Timer]", f"OnActiveSec={TIMER_FIRST_FIRE}",
        f"OnUnitActiveSec={TICK_INTERVAL_SECONDS}", f"Unit={project.label}.service", "",
        "[Install]", "WantedBy=timers.target", ""])


def install_launchd(project: Project, claude_bin: str) -> tuple[dict, str | None]:
    plist = project.plist_path()
    plist.parent.mkdir(parents=True, exist_ok=True)
    plist.write_bytes(plistlib.dumps(build_plist(project, claude_bin)))
    domain = f"gui/{os.getuid()}"
    try:
        launchctl("bootout", f"{domain}/{project.label}")
        loaded = launchctl("bootstrap", domain, str(plist))
    except OSError as exc:
        return {}, f"launchctl failed: {exc}"
    if loaded.returncode != 0:
        return {}, f"launchctl bootstrap rc={loaded.returncode}: {loaded.stderr.strip()}"
    return {"plist_path": str(plist), "unit_paths": [str(plist)]}, None


def install_systemd(project: Project, claude_bin: str) -> tuple[dict, str | None]:
    service, timer = project.unit_paths({"scheduler": SCHEDULER_SYSTEMD})
    service.parent.mkdir(parents=True, exist_ok=True)
    service.write_text(build_service(project, claude_bin))
    timer.write_text(build_timer(project))
    failure = systemctl("daemon-reload") or systemctl("enable", "--now", timer.name)
    if failure:
        systemctl("disable", "--now", timer.name)  # a partial enable must not stay armed
        service.unlink(missing_ok=True)
        timer.unlink(missing_ok=True)
        systemctl("daemon-reload")
        return {}, failure
    return {"unit_paths": [str(service), str(timer)]}, None


def windows_wrapper_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA")
    root = Path(base) if base else Path.home() / "AppData" / "Local"
    return root / "Athanor" / "quota-resume"


def windows_wrapper_path(project: Project) -> Path:
    return windows_wrapper_dir() / f"{project.label}.cmd"


def install_schtasks(project: Project, claude_bin: str) -> tuple[dict, str | None]:
    command = f'"{sys.executable}" "{script_path(project)}" tick --project "{project.root}"'
    unit_paths = []
    wrapper = windows_wrapper_path(project)
    if len(command) > SCHTASKS_TR_MAX:
        wrapper.parent.mkdir(parents=True, exist_ok=True)
        # cmd expands %VAR% inside a .cmd file: a literal % must be doubled
        wrapper.write_text(f"@echo off\r\n{command.replace('%', '%%')}\r\n")
        command, unit_paths = f'"{wrapper}"', [str(wrapper)]
    else:
        wrapper.unlink(missing_ok=True)  # a stale wrapper from an earlier, deeper install
    failure = schtasks("/Create", "/TN", project.label, "/SC", "MINUTE", "/MO",
                       str(TICK_INTERVAL_SECONDS // SECONDS_PER_MINUTE), "/TR", command, "/F")
    if failure:
        for path in unit_paths:
            Path(path).unlink(missing_ok=True)
        return {}, failure
    return {"unit_paths": unit_paths}, None


INSTALLERS = {SCHEDULER_LAUNCHD: install_launchd, SCHEDULER_SYSTEMD: install_systemd,
              SCHEDULER_SCHTASKS: install_schtasks}


def rollback_install(project: Project, scheduler: str, recorded: dict) -> None:
    """Undo an enabled job whose opt-in could not be recorded."""
    unload_scheduler(project, scheduler)
    for path in recorded.get("unit_paths", []):
        Path(path).unlink(missing_ok=True)
    if scheduler == SCHEDULER_SCHTASKS:
        windows_wrapper_path(project).unlink(missing_ok=True)
    if scheduler == SCHEDULER_SYSTEMD:
        systemctl("daemon-reload")


def cmd_install(project: Project) -> int:
    scheduler = scheduler_for_platform()
    if scheduler is None:
        print(f"quota_auto_resume: install does not support {sys.platform} (needs macOS "
              "launchd, Linux systemd or Windows Task Scheduler)", file=sys.stderr)
        return EXIT_USAGE
    claude_bin = resolve_claude(project.config)
    if not claude_bin:
        print("quota_auto_resume: claude not found (ATHANOR_CLAUDE_BIN or PATH); "
              "nothing installed", file=sys.stderr)
        return EXIT_USAGE
    project.qr.mkdir(parents=True, exist_ok=True)
    recorded, failure = INSTALLERS[scheduler](project, claude_bin)
    if failure:
        print(f"quota_auto_resume: {failure}", file=sys.stderr)
        previous = project.config
        if previous is not None:  # a failed (re)install must not keep an old opt-in
            write_json_atomic(project.root / CONFIG_REL, {**previous, "enabled": False})
        return 1
    try:
        write_json_atomic(project.root / CONFIG_REL, {
            "schema": CONFIG_SCHEMA, "enabled": True, "project_root": str(project.root),
            "label": project.label, "scheduler": scheduler, **recorded,
            "claude_bin": claude_bin, "python_bin": sys.executable,
            "installed_at": iso(now_epoch())})
    except OSError as exc:
        rollback_install(project, scheduler, recorded)
        print(f"quota_auto_resume: could not record the opt-in ({type(exc).__name__}: "
              f"{exc}); scheduler job rolled back", file=sys.stderr)
        return 1
    print(f"installed {project.label}")
    return 0


def unload_scheduler(project: Project, scheduler: str | None) -> str | None:
    """Stop the scheduled job; returns the failure line (also logged), never raises."""
    failure = None
    if scheduler == SCHEDULER_LAUNCHD:
        try:
            launchctl("bootout", f"gui/{os.getuid()}/{project.label}")
        except OSError as exc:
            failure = f"launchctl bootout failed: {exc}"
    elif scheduler == SCHEDULER_SYSTEMD:
        failure = systemctl("disable", "--now", f"{project.label}.timer")
    elif scheduler == SCHEDULER_SCHTASKS:
        failure = schtasks("/Delete", "/TN", project.label, "/F")
    if failure:
        log.warning("%s", failure)
    return failure


def disable(project: Project) -> str | None:
    """Opt out and remove the unit files; returns the scheduler failure, if any."""
    config = project.config
    scheduler = (config or {}).get("scheduler") or (
        SCHEDULER_LAUNCHD if config else scheduler_for_platform())
    # No config means nothing was ever installed: there is no job to remove.
    removal_failure = unload_scheduler(project, scheduler) if config else None
    for path in project.unit_paths({**(config or {}), "scheduler": scheduler}):
        path.unlink(missing_ok=True)
    if scheduler == SCHEDULER_SCHTASKS:
        windows_wrapper_path(project).unlink(missing_ok=True)  # deterministic, even if unlisted
    if scheduler == SCHEDULER_SYSTEMD and config:
        failure = systemctl("daemon-reload")
        if failure:
            log.warning("%s", failure)
    if config is not None:
        write_json_atomic(project.root / CONFIG_REL, {**config, "enabled": False})
    return removal_failure


def lock_record(project: Project) -> dict:
    data = read_json(project.qr / "run.lock")
    return data if isinstance(data, dict) else {}


def cmd_uninstall(project: Project) -> int:
    """Opt out, serialised with a tick's check-then-spawn window; never kills a run."""
    deadline = now_epoch() + UNINSTALL_WAIT_SECONDS
    failure = None
    while True:
        fd = acquire_flock(project)
        if fd is not None:
            try:
                failure = disable(project)
            finally:
                release_lock(project, fd)
            break
        child = lock_record(project).get("child_pid")
        if child:
            failure = disable(project)
            print(f"a resume run started before uninstall is still running (pid {child}); "
                  f"it finishes on its own, or stop it with: kill -TERM -{child}")
            break
        if now_epoch() >= deadline:
            failure = disable(project)
            print("uninstall: a tick held the lock for "
                  f"{UNINSTALL_WAIT_SECONDS}s; opted out anyway, a run may have started")
            break
        time.sleep(UNINSTALL_POLL_SECONDS)
    if failure:
        print(f"quota_auto_resume: opted out, but the scheduler still holds the job: "
              f"{failure}", file=sys.stderr)
        return 1
    print(f"uninstalled {project.label}")
    return 0


def last_resume(project: Project) -> dict | None:
    events = project.events()
    finished = [e for e in events if e.get("event") == "resume_finished"]
    if not finished:
        return None
    last = finished[-1]
    started = next((e for e in events if e.get("event") == "resume_started"
                    and e.get("session_id") == last.get("session_id")), {})
    return {"session_id": last.get("session_id"), "event_id": last.get("event_id"),
            "started_at": started.get("ts"), "finished_at": last.get("ts"),
            "exit_code": last.get("exit_code"), "timed_out": last.get("timed_out")}


def unit_present(project: Project, scheduler: str | None, units: list[Path]) -> bool:
    if scheduler == SCHEDULER_SCHTASKS:
        return schtasks("/Query", "/TN", project.label) is None
    return bool(units) and all(path.is_file() for path in units)


def status_of(project: Project) -> dict:
    config = project.config
    claude_bin = resolve_claude(config)
    record = project.record()
    pending = record if record and not project.spent(record["event_id"]) else None
    resets = parse_iso(pending["resets_at"]) if pending else None
    scheduler = (config or {}).get("scheduler") or (
        SCHEDULER_LAUNCHD if config else scheduler_for_platform())
    units = project.unit_paths({**(config or {}), "scheduler": scheduler})
    return {
        "opted_in": project.opted_in(config),
        "label": project.label,
        "scheduler": scheduler,
        "unit_path": str(units[-1]) if units else None,
        "unit_present": unit_present(project, scheduler, units),
        "plist_path": str(project.plist_path(config)),
        "plist_present": project.plist_path(config).is_file(),
        "claude_bin": claude_bin,
        "claude_ok": claude_bin is not None,
        "pending_event": pending,
        "next_resume_at": iso(resets + RESET_GRACE_SECONDS) if resets is not None else None,
        "last_resume": last_resume(project),
        "check_interval_seconds": TICK_INTERVAL_SECONDS,
    }


def cmd_status(project: Project, as_json: bool) -> int:
    info = status_of(project)
    if as_json:
        print(json.dumps(info, indent=2))
    else:
        for key, value in info.items():
            print(f"{key}: {json.dumps(value) if isinstance(value, (dict, list)) else value}")
    return 0


# ── tick ──────────────────────────────────────────────────────────────────────

def notify(message: str) -> None:
    """Best-effort notification (osascript on macOS, notify-send on Linux); never raises."""
    if os.environ.get(ENV_NOTIFY) == "0":
        return
    scheduler = scheduler_for_platform()
    if scheduler == SCHEDULER_LAUNCHD and shutil.which("osascript"):
        script = ["-e", "on run argv", "-e",
                  'display notification (item 1 of argv) with title "Athanor quota resume"',
                  "-e", "end run"]
        argv = ["osascript", *script, message]
    elif scheduler == SCHEDULER_SYSTEMD and shutil.which("notify-send"):
        argv = ["notify-send", "Athanor quota resume", message]
    else:
        return
    try:
        subprocess.run(argv, capture_output=True, timeout=NOTIFY_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError):
        return


def msvcrt_lock_byte(fd: int, mode: int) -> None:
    """Lock or unlock the one byte at WIN_LOCK_OFFSET, restoring the file position."""
    import msvcrt
    pos = os.lseek(fd, 0, os.SEEK_CUR)
    try:
        os.lseek(fd, WIN_LOCK_OFFSET, os.SEEK_SET)
        msvcrt.locking(fd, mode, 1)
    finally:
        os.lseek(fd, pos, os.SEEK_SET)


def acquire_msvcrt(path: Path) -> int | None:
    """Windows: LK_NBLCK on a byte past the pid record, so the record stays readable."""
    import msvcrt
    fd = os.open(path, os.O_CREAT | os.O_RDWR | getattr(os, "O_BINARY", 0))
    try:
        msvcrt_lock_byte(fd, msvcrt.LK_NBLCK)
    except OSError:
        os.close(fd)
        return None
    return fd


def acquire_flock(project: Project) -> int | None:
    """flock(LOCK_EX|LOCK_NB) run.lock (msvcrt byte lock on Windows), else None when held."""
    project.qr.mkdir(parents=True, exist_ok=True)
    path = project.qr / "run.lock"
    if fcntl is None:
        return acquire_msvcrt(path)
    for _ in range(2):
        fd = os.open(path, os.O_CREAT | os.O_RDWR)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            os.close(fd)
            return None
        try:
            same = os.fstat(fd).st_ino == os.stat(path).st_ino
        except OSError:
            same = False
        if same:
            return fd
        os.close(fd)  # the previous holder unlinked it between our open and flock
    return None


def take_lock(project: Project) -> int | None:
    """acquire_flock, held for the whole run, with this tick's pid written in.

    The kernel drops the lock when the holder dies, so there is no stale-lock
    cleanup. The pid in the file is information only, with one read-only
    exception: a live foreign pid written within one run's maximum span means
    another writer holds the run, so this tick stands down. Nothing is ever
    renamed or deleted on suspicion.
    """
    fd = acquire_flock(project)
    if fd is None:
        return None
    if foreign_run_recorded(fd):
        os.close(fd)
        return None
    os.ftruncate(fd, 0)
    os.lseek(fd, 0, os.SEEK_SET)
    os.write(fd, json.dumps({"pid": os.getpid(), "started_at": iso(now_epoch())}).encode())
    return fd


def foreign_run_recorded(fd: int) -> bool:
    try:
        os.lseek(fd, 0, os.SEEK_SET)  # no os.pread on Windows
        data = json.loads(os.read(fd, LOCK_READ_BYTES) or b"{}")
    except ValueError:
        return False
    if not isinstance(data, dict):
        return False
    pid, started = data.get("pid"), parse_iso(data.get("started_at"))
    return (pid_alive(pid) and pid != os.getpid() and started is not None
            and now_epoch() - started < MAX_RUN_SECONDS + KILL_GRACE_SECONDS)


def release_lock(project: Project, fd: int) -> None:
    """POSIX: unlink while still holding it; acquirers re-check the inode after flock.

    Windows cannot unlink an open file: unlock, close, then unlink, tolerating a
    racing acquirer that already holds it open.
    """
    path = project.qr / "run.lock"
    if fcntl is not None:
        path.unlink(missing_ok=True)
        os.close(fd)
        return
    import msvcrt
    try:
        msvcrt_lock_byte(fd, msvcrt.LK_UNLCK)
    except OSError as exc:
        log.warning("run.lock unlock failed: %s", exc)
    os.close(fd)
    try:
        path.unlink(missing_ok=True)
    except PermissionError:
        pass


def gate(project: Project, record: dict, now: float) -> tuple[str, str | None]:
    """('go'|'wait'|'spend'|'error', detail) for an unspent, parseable record."""
    resets = parse_iso(record["resets_at"])
    recorded = parse_iso(record.get("recorded_at"))
    if recorded is not None and recorded > now + FUTURE_SKEW_SECONDS:
        return "error", "recorded_at_in_future"
    if now < resets + RESET_GRACE_SECONDS:
        return "wait", None
    if now > resets + MAX_EVENT_AGE_SECONDS:
        return "spend", "expired"
    activity = project.last_activity()
    if activity is not None and activity > resets:
        return "spend", "superseded"
    if activity is not None and activity > now - QUIET_SECONDS:
        return "wait", None
    if project.active_mission() is None:
        return "spend", "no_mission"
    return "go", None


def build_prompt(slug: str, record: dict) -> str:
    return (
        f"This is an unattended run started by execution/quota_auto_resume.py after the "
        f"{record['window']} quota reset at {record['resets_at']}, not by the operator. "
        f"Run `python3 execution/mission.py resume` and continue the active mission "
        f"`{slug}` from its checkpoint. Do not start a new mission, do not claim operator "
        f"approval, and take no action that needs it. If you are blocked, record the "
        f"blocker in the mission and stop. Commit and push follow the project's own rules.")


def child_env() -> dict:
    return {k: v for k, v in os.environ.items() if k not in STRIPPED_ENV}


def max_run_seconds() -> int:
    try:
        return max(1, int(os.environ.get(ENV_MAX_RUN, MAX_RUN_SECONDS)))
    except ValueError:
        return MAX_RUN_SECONDS


def record_child_pid(project: Project, pid: int) -> None:
    """Mark run.lock (still held by this tick) so uninstall can tell a run began."""
    path = project.qr / "run.lock"
    write_lock_json = {**lock_record(project), "child_pid": pid}
    with open(path, "r+") as handle:
        handle.truncate(0)
        handle.write(json.dumps(write_lock_json))


def run_child(project: Project, argv: list[str], log_path: Path) -> tuple[int, bool]:
    """Run the child in its own process group (tree on Windows), killing it at the cap."""
    timed_out = False
    if sys.platform == "win32":
        group = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    else:
        group = {"start_new_session": True}
    with open(log_path, "wb") as sink:
        proc = subprocess.Popen(argv, cwd=project.root, env=child_env(), stdout=sink,
                                stderr=subprocess.STDOUT, **group)
        record_child_pid(project, proc.pid)
        try:
            code = proc.wait(timeout=max_run_seconds())
        except subprocess.TimeoutExpired:
            timed_out = True
            kill_run(proc)
            code = proc.wait()
    return code, timed_out


def kill_run(proc: subprocess.Popen) -> None:
    """Kill the run and everything it spawned: killpg on POSIX, taskkill /T on Windows."""
    if sys.platform == "win32":
        taskkill = ["taskkill", "/PID", str(proc.pid), "/T", "/F"]
        try:
            subprocess.run(taskkill, capture_output=True, timeout=KILL_GRACE_SECONDS)
        except (OSError, subprocess.SubprocessError) as exc:
            log.warning("taskkill failed: %s", exc)
        proc.kill()
        return
    os.killpg(proc.pid, signal.SIGTERM)
    try:
        proc.wait(timeout=KILL_GRACE_SECONDS)
    except subprocess.TimeoutExpired:
        pass
    # The parent may exit on SIGTERM while its children linger: the
    # group is killed regardless, so nothing outlives the cap.
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def rejected_reset(log_path: Path, now: float) -> tuple[str, float] | None:
    """The latest (window, resets_at) among `rejected` rate_limit_events in the stream."""
    best = None
    try:
        lines = log_path.read_text(errors="replace").splitlines()
    except OSError:
        return None
    for line in lines:
        try:
            item = json.loads(line)
        except ValueError:
            continue
        info = item.get("rate_limit_info") if isinstance(item, dict) else None
        if (not isinstance(item, dict) or item.get("type") != "rate_limit_event"
                or not isinstance(info, dict) or info.get("status") != "rejected"):
            continue
        resets = info.get("resetsAt")
        if isinstance(resets, bool) or not isinstance(resets, (int, float)):
            resets = now + FALLBACK_WAIT_SECONDS
        elif resets > MS_EPOCH_THRESHOLD:
            resets = resets / 1000
        window = "seven_day" if "seven" in str(info.get("rateLimitType", "")) else "five_hour"
        if best is None or resets > best[1]:
            best = (window, float(resets))
    return best


def record_reexhaustion(project: Project, found: tuple[str, float]) -> None:
    window, resets = found
    resets_iso = iso(resets)
    write_json_atomic(project.qr / "exhausted.json", {
        "schema": "athanor.quota-exhaustion/v1", "event_id": f"{window}@{resets_iso}",
        "window": window, "resets_at": resets_iso, "used_pct": 100.0,
        "recorded_at": iso(now_epoch()), "source": "resume_stream"})


def write_banner(project: Project) -> None:
    activity = project.last_activity()
    runs = [e for e in project.events() if e.get("event") == "resume_finished"
            and (activity is None or (parse_iso(e.get("ts")) or 0) > activity)]
    lines = ["QUOTA AUTO-RESUME: unattended session(s) ran after a quota reset:"]
    for run in runs[-BANNER_MAX_RUNS:]:
        lines.append(f"  session {run.get('session_id')} exit={run.get('exit_code')} "
                     f"log={run.get('run_log')} -- continue: claude -r {run.get('session_id')}")
    write_json_atomic(project.root / BANNER_REL, {
        "timestamp": iso(now_epoch()), "stop_reason": "quota_auto_resume",
        "recovery_message": "\n".join(lines)})


def resume(project: Project, record: dict, claude_bin: str) -> None:
    """Spend the event, then run one bounded headless session. Caller holds the lock."""
    event_id = record["event_id"]
    project.spend(event_id, "started")
    mission = project.active_mission()
    session_id = str(uuid.uuid4())
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    log_path = project.qr / f"run-{stamp}.log"
    argv = [claude_bin, "-p", build_prompt(mission_slug(mission), record),
            "--output-format", "stream-json", "--verbose", "--session-id", session_id,
            "-n", f"quota-auto-resume {event_id}", "--permission-prompts", "none"]
    unattended = project.root / UNATTENDED_REL
    created = not unattended.exists()
    if created:
        unattended.parent.mkdir(parents=True, exist_ok=True)
        unattended.touch()
    ident = {"session_id": session_id, "window": record["window"],
             "resets_at": record["resets_at"]}
    project.log_event("resume_started", event_id, **ident)
    started = now_epoch()
    code, timed_out = -1, False
    try:
        code, timed_out = run_child(project, argv, log_path)
    except OSError as exc:
        project.log_event("error", event_id, reason=f"spawn_failed:{type(exc).__name__}")
    finally:
        if created:
            unattended.unlink(missing_ok=True)
    project.log_event("resume_finished", event_id, **ident, exit_code=code,
                      timed_out=timed_out, duration_s=int(now_epoch() - started),
                      run_log=str(log_path))
    again = rejected_reset(log_path, now_epoch())
    if again:
        record_reexhaustion(project, again)
    write_banner(project)
    notify(f"Resumed mission after {record['window']} reset (exit {code}). "
           f"Continue with: claude -r {session_id}")


def tick_locked(project: Project) -> None:
    """Re-evaluate opt-in and every gate under the lock: earlier reads may be stale."""
    config = project.config
    if not project.opted_in(config):
        return
    record = project.record()
    if record is None or project.spent(record["event_id"]):
        return
    event_id = record["event_id"]
    verdict, detail = gate(project, record, now_epoch())
    if verdict == "error":
        project.log_error_once(event_id, detail)
    elif verdict == "spend":
        project.spend(event_id, detail)
        project.log_event("skipped", event_id, reason=detail)
    elif verdict == "go":
        claude_bin = resolve_claude(config)
        if claude_bin is None:
            project.log_error_once(event_id, "claude_not_found")
            notify("Quota reset reached but claude was not found; mission not resumed.")
            return
        resume(project, record, claude_bin)


def cmd_tick(project: Project) -> int:
    if not project.opted_in(project.config):
        return 0
    record = project.record()
    if record is None or project.spent(record["event_id"]):
        return 0
    fd = take_lock(project)
    if fd is None:
        return 0
    try:
        tick_locked(project)
    finally:
        release_lock(project, fd)
    return 0


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args(argv: list[str]) -> argparse.Namespace:
    default_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("install", "uninstall", "status", "tick"):
        cmd = sub.add_parser(name)
        cmd.add_argument("--project", default=str(default_root))
        if name == "status":
            cmd.add_argument("--json", action="store_true", dest="as_json")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, stream=sys.stderr,
                        format="%(name)s: %(levelname)s: %(message)s")
    args = parse_args(sys.argv[1:] if argv is None else argv)
    project = Project(Path(args.project).resolve())
    if args.command == "tick":
        try:
            return cmd_tick(project)
        except Exception:  # noqa: BLE001 -- a tick must never fail its launchd job
            log.exception("tick failed for %s", project.root)
            return 0
    if args.command == "install":
        return cmd_install(project)
    if args.command == "uninstall":
        return cmd_uninstall(project)
    return cmd_status(project, args.as_json)


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
post_update.py -- prune dead hooks from retired providers' settings files.

`update_template.py` calls `prune_retired_provider_hooks()` once per apply to
drop registrations in `.gemini/settings.json` and `.grok/settings.json` whose
`execution/hooks/` script no longer exists. The older gap fixes that lived here
(gitignore, autonomy and statusline wiring, profile stamp, pulse and retired-hook
deletion) were removed: run against a fresh scaffold after a real apply they
deleted live hooks and pulse scripts shipped that day and duplicated the
autonomy registrations, and update_template, repair_hooks.py and retired_paths
already cover them.
"""
import json
import os
import re
import tempfile
from pathlib import Path


HOOK_SCRIPT_RE = re.compile(r"execution/hooks/[^\s'\"`;|&()<>]+")
RETIRED_PROVIDER_SETTINGS = (".gemini/settings.json", ".grok/settings.json")
HOOK_REF_TRAILING_PUNCT = ".,:"


def _hook_is_dead(entry, root: Path) -> bool:
    """True only when EVERY execution/hooks/ script the command names is missing.

    `bash gone.sh || bash live.sh` still has a live branch, so it stays; a
    command that names no hook script is kept too.
    """
    if not isinstance(entry, dict):
        return False
    refs = [r.rstrip(HOOK_REF_TRAILING_PUNCT)
            for r in HOOK_SCRIPT_RE.findall(str(entry.get("command", "")))]
    return bool(refs) and all(not (root / ref).is_file() for ref in refs)


def _settings_is_safe(path: Path, root: Path) -> bool:
    """Never write through a symlinked provider dir or settings file, or one outside root."""
    if path.parent.is_symlink() or path.is_symlink():
        print(f"  warn {path} is a symlink, retired-provider hook prune skipped")
        return False
    if not path.resolve().is_relative_to(root.resolve()):
        print(f"  warn {path} resolves outside {root}, retired-provider hook prune skipped")
        return False
    return True


def _prune_dead_hooks(hooks: dict, root: Path) -> tuple:
    """Return (hooks_without_dead_entries, before_count, after_count)."""
    before = after = 0
    cleaned = {}
    for event, groups in hooks.items():
        if not isinstance(groups, list):
            cleaned[event] = groups
            continue
        kept_groups = []
        for group in groups:
            entries = group.get("hooks") if isinstance(group, dict) else None
            if not isinstance(entries, list):
                kept_groups.append(group)
                continue
            live = [h for h in entries if not _hook_is_dead(h, root)]
            before += len(entries)
            after += len(live)
            if live:
                kept_groups.append({**group, "hooks": live})
        if kept_groups:
            cleaned[event] = kept_groups
    return cleaned, before, after


def prune_retired_provider_hooks(root) -> None:
    """Drop hook registrations whose script is gone from retired providers' settings.

    Covers .gemini and .grok only; .claude has its own reconciler. A no-op
    when the file is absent or nothing is dead, and a second run changes nothing.
    """
    root = Path(root)
    for rel in RETIRED_PROVIDER_SETTINGS:
        path = root / rel
        if not path.is_file() or not _settings_is_safe(path, root):
            continue
        try:
            settings = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            print(f"  warn {path} unreadable, retired-provider hook prune skipped: {exc}")
            continue
        hooks = settings.get("hooks") if isinstance(settings, dict) else None
        if not isinstance(hooks, dict):
            continue
        cleaned, before, after = _prune_dead_hooks(hooks, root)
        if before == after:
            continue
        if cleaned:
            settings["hooks"] = cleaned
        else:
            del settings["hooks"]
        fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".settings.", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(json.dumps(settings, indent=2, ensure_ascii=False) + "\n")
            os.replace(tmp, path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
        print(f"  {rel}: hook registrations {before} -> {after} (dead scripts pruned)")

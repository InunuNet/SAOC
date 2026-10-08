#!/usr/bin/env python3
"""Per-session Drive change detector over Lee-Ann's document tree.

Project-owned script (F2, mission vendor-form-copy-20261007) that tells Brad what
changed in Lee-Ann's Drive folder tree since the last run, so a silent edit (like
the 2026-10-07 vendor-form change this mission's F1 is fixing) is never invisible
again. See the mission golden for the full design record:
.agent/memory/project/specs/vendor-form-copy-20261007/goldens/f2-lee-ann-drive-watch.md

This script never calls a Drive mutation verb -- it only ever lists files, the
same read-only posture execution/drive_docx_sync.py already documents for
itself.

It never writes Drive file content to disk (unlike drive_docx_sync.py) -- it
tracks metadata only (id, name, mimeType, modifiedTime, md5Checksum) in one flat
JSON state file keyed by Drive file id. A folder's "path" is only ever a
display string (folder names joined with " / "), never a filesystem path, so a
folder name containing a forward slash is structurally harmless here -- there is
no bug class to reintroduce from the HARNESS-owned execution/drive_docx_sync.py,
which writes real file content to disk and so cannot tolerate that character in
a folder name.

Usage:
    lee-ann-drive-watch.py [--init] [--json] [--fixture PATH] [--state-path PATH]

Exit codes:
    0  ran successfully; no changes versus the stored state (or --init, which
       never compares)
    10 ran successfully; at least one new/changed/removed item found
    1  error -- gws failed/produced non-JSON output, the fixture file is
       missing/malformed, or the state file exists but is not valid JSON
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

DEFAULT_ROOT_FOLDER_ID = '1O2Lbzsbt57i8-7ZLFdhrcHjaMQ--TkJH'
DEFAULT_STATE_PATH = 'content/drive-watch/state.json'
FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
DRIVE_LIST_PAGE_SIZE = 100

EXIT_SUCCESS = 0
EXIT_ERROR = 1
EXIT_CHANGES_FOUND = 10

DriveEntry = dict[str, Any]
DriveTree = dict[str, DriveEntry]
ChildLister = Callable[[str], list[DriveEntry]]


class DriveWatchError(Exception):
    """Raised for any error path this script cannot recover from."""


def _parse_json_stdout(stdout: str) -> Any:
    """Strips every leading line of `stdout` that does not start with '{' or
    '[' before parsing -- gws sometimes prints a plain "Using keyring
    backend" line before its JSON body on some machines/configs. This is a
    no-op, and therefore safe, on a machine where gws never prints that line.
    """
    lines = stdout.splitlines()
    start_index = None
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('{') or stripped.startswith('['):
            start_index = index
            break
    if start_index is None:
        raise DriveWatchError(f'gws produced no JSON output:\n{stdout}')
    json_text = '\n'.join(lines[start_index:])
    try:
        return json.loads(json_text)
    except json.JSONDecodeError as error:
        raise DriveWatchError(f'gws produced non-JSON output: {error}') from error


def _list_children_live(folder_id: str) -> list[DriveEntry]:
    """Lists the direct children of one Drive folder via the real gws CLI.
    Fixed literal argv, never a string-formatted shell command. No gws
    mutation verb is referenced anywhere in this module -- this is the only
    gws call site in live mode, and it only ever lists.
    """
    params = json.dumps({
        'q': f"'{folder_id}' in parents and trashed=false",
        'fields': 'files(id,name,mimeType,modifiedTime,md5Checksum,owners(emailAddress))',
        'pageSize': DRIVE_LIST_PAGE_SIZE,
    })
    argv = ['gws', 'drive', 'files', 'list', '--params', params, '--page-all']
    try:
        result = subprocess.run(argv, capture_output=True, text=True)
    except OSError as error:
        raise DriveWatchError(f'Failed to invoke gws: {error}') from error
    if result.returncode != 0:
        raise DriveWatchError(f'gws exited {result.returncode}: {result.stderr.strip()}')
    payload = _parse_json_stdout(result.stdout)
    if not isinstance(payload, dict) or 'files' not in payload:
        raise DriveWatchError(f'gws output is missing a "files" array: {payload!r}')
    return payload['files']


def _list_children_fixture(folder_id: str, folders: dict[str, list[DriveEntry]]) -> list[DriveEntry]:
    """A folder id with no key in `folders` is treated as empty (no
    children), matching how an empty real Drive folder behaves.
    """
    return folders.get(folder_id, [])


def walk_drive_tree(root_id: str, list_children: ChildLister) -> DriveTree:
    """Walks the Drive tree rooted at `root_id`, recursing into every child
    whose mimeType is the Drive folder type. Returns a flat dict keyed by
    Drive file id -- NOT a filesystem tree -- so a folder name containing a
    forward slash is only ever joined into a display-only "path" string,
    never used as a directory component.

    Tracks a `visited` set of folder ids already walked so a cycle
    (disallowed in a real Drive tree, but handled defensively per
    coding.md's "handle the error path") can never loop forever.
    """
    entries: DriveTree = {}
    visited_folders: set[str] = set()

    def recurse(folder_id: str, path_parts: list[str]) -> None:
        if folder_id in visited_folders:
            return
        visited_folders.add(folder_id)
        for child in list_children(folder_id):
            child_id = child['id']
            name = child.get('name', '')
            mime_type = child.get('mimeType', '')
            display_path = ' / '.join([*path_parts, name])
            entries[child_id] = {
                'id': child_id,
                'name': name,
                'mimeType': mime_type,
                'modifiedTime': child.get('modifiedTime'),
                'md5Checksum': child.get('md5Checksum'),
                'path': display_path,
            }
            if mime_type == FOLDER_MIME_TYPE:
                recurse(child_id, [*path_parts, name])

    recurse(root_id, [])
    return entries


def _has_checksum(entry: DriveEntry) -> bool:
    return bool(entry.get('md5Checksum'))


def diff_drive_trees(
    old_entries: DriveTree,
    new_entries: DriveTree,
) -> tuple[list[DriveEntry], list[DriveEntry], list[DriveEntry]]:
    """Compares a stored walk against a fresh one. Returns (new, changed,
    removed) lists, each sorted by Drive file id for stable output.

    A file id present now but absent from the stored state is NEW. A file id
    present in the stored state but absent now is REMOVED (a file moved
    between folders in the same run therefore appears as both REMOVED and
    NEW under the same id -- never coalesced into a "moved" case). A file id
    present in both compares md5Checksum when both sides have one, else
    falls back to comparing modifiedTime (Google-native Docs/Sheets/Slides
    never have an md5Checksum).
    """
    old_ids = set(old_entries)
    new_ids = set(new_entries)

    new_list = [new_entries[file_id] for file_id in sorted(new_ids - old_ids)]
    removed_list = [old_entries[file_id] for file_id in sorted(old_ids - new_ids)]

    changed_list = []
    for file_id in sorted(new_ids & old_ids):
        old_entry = old_entries[file_id]
        new_entry = new_entries[file_id]
        if _has_checksum(old_entry) and _has_checksum(new_entry):
            is_changed = old_entry['md5Checksum'] != new_entry['md5Checksum']
        else:
            is_changed = old_entry.get('modifiedTime') != new_entry.get('modifiedTime')
        if is_changed:
            changed_list.append(new_entry)

    return new_list, changed_list, removed_list


def _report_entry(entry: DriveEntry) -> dict[str, str]:
    return {
        'id': entry['id'],
        'name': entry['name'],
        'path': entry['path'],
        'mimeType': entry['mimeType'],
    }


def _print_human_report(
    new_list: list[DriveEntry],
    changed_list: list[DriveEntry],
    removed_list: list[DriveEntry],
) -> None:
    for kind, items in (('NEW', new_list), ('CHANGED', changed_list), ('REMOVED', removed_list)):
        for entry in items:
            print(f"{kind}  {entry['path']}  ({entry['mimeType']})")
    total = len(new_list) + len(changed_list) + len(removed_list)
    print(
        f'{total} change(s): {len(new_list)} new, {len(changed_list)} changed, '
        f'{len(removed_list)} removed.'
    )


def _print_json_report(
    new_list: list[DriveEntry],
    changed_list: list[DriveEntry],
    removed_list: list[DriveEntry],
) -> None:
    report = {
        'new': [_report_entry(entry) for entry in new_list],
        'changed': [_report_entry(entry) for entry in changed_list],
        'removed': [_report_entry(entry) for entry in removed_list],
    }
    print(json.dumps(report))


def _load_state(state_path: Path) -> DriveTree:
    if not state_path.exists():
        return {}
    try:
        return json.loads(state_path.read_text())
    except json.JSONDecodeError as error:
        raise DriveWatchError(
            f'Existing state file {state_path} is not valid JSON: {error}'
        ) from error


def _write_state(state_path: Path, entries: DriveTree) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(entries, indent=2, sort_keys=True))


def _resolve_child_lister(fixture_path: str | None) -> tuple[ChildLister, str]:
    """Returns (list_children, root_id). Live mode (no --fixture) uses the
    real gws CLI and the hardcoded real root folder id. --fixture mode reads
    a JSON tree from disk instead and may override the root id it walks.
    """
    if fixture_path is None:
        return _list_children_live, DEFAULT_ROOT_FOLDER_ID

    fixture_file = Path(fixture_path)
    if not fixture_file.exists():
        raise DriveWatchError(f'Fixture file not found: {fixture_path}')
    try:
        fixture = json.loads(fixture_file.read_text())
    except json.JSONDecodeError as error:
        raise DriveWatchError(f'Fixture file {fixture_path} is not valid JSON: {error}') from error
    if not isinstance(fixture, dict) or 'root_id' not in fixture or 'folders' not in fixture:
        raise DriveWatchError(
            f'Fixture file {fixture_path} must be an object with "root_id" and "folders".'
        )

    folders = fixture['folders']
    root_id = fixture['root_id']

    def list_children(folder_id: str) -> list[DriveEntry]:
        return _list_children_fixture(folder_id, folders)

    return list_children, root_id


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--init',
        action='store_true',
        help='Write the state file as a fresh baseline; never compares or reports.',
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Emit the report as one JSON object instead of human-readable lines.',
    )
    parser.add_argument(
        '--fixture',
        help='Read a JSON tree from this path instead of calling gws (zero network access).',
    )
    parser.add_argument(
        '--state-path',
        default=DEFAULT_STATE_PATH,
        help=f'Override the state file location (default: {DEFAULT_STATE_PATH}).',
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    try:
        list_children, root_id = _resolve_child_lister(args.fixture)
        new_entries = walk_drive_tree(root_id, list_children)
        state_path = Path(args.state_path)

        if args.init:
            _write_state(state_path, new_entries)
            return EXIT_SUCCESS

        old_entries = _load_state(state_path)
        new_list, changed_list, removed_list = diff_drive_trees(old_entries, new_entries)
        _write_state(state_path, new_entries)

        if args.json:
            _print_json_report(new_list, changed_list, removed_list)
        else:
            _print_human_report(new_list, changed_list, removed_list)

        has_changes = bool(new_list or changed_list or removed_list)
        return EXIT_CHANGES_FOUND if has_changes else EXIT_SUCCESS
    except DriveWatchError as error:
        print(f'Error: {error}', file=sys.stderr)
        return EXIT_ERROR


if __name__ == '__main__':
    sys.exit(main())

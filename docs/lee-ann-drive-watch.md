# Lee-Ann Drive Watch — scripts/lee-ann-drive-watch.py

**Feature:** F2 of mission `vendor-form-copy-20261007`. Tool:
`scripts/lee-ann-drive-watch.py`.

## Why this exists

Lee-Ann edits Drive documents without telling Brad. The 2026-10-07 vendor-form edit that this
same mission's F1 fixes (see [docs/vendor-form-copy-20261007.md](vendor-form-copy-20261007.md))
was found only because an agent happened to re-read the source doc — nothing was watching for the
change. This script runs every session and tells Brad what changed in Lee-Ann's Drive tree since
the last run.

The HARNESS-owned `execution/drive_docx_sync.py`
([docs/drive-docx-version-export.md](drive-docx-version-export.md)) already exists and solves a
related but different problem — mirroring real `.docx` content into a local versioned store — and
has two gaps already recorded in `.agent/memory/project/backlog.md` ("Harness —
drive_docx_sync.py gaps (found 2026-10-08, upstream to InunuNet/Athanor)"):

1. it **skips any Drive folder whose name contains `/`** — because it writes real file content to
   disk at `content/drive-source/<folder name>/<folder name>/.../source.docx`, so a `/` in a
   folder name would otherwise escape into the filesystem path. Lee-Ann's own
   `13. Registration/Booking/Tickets` folder (id `1-H3m-LHjtmjLw4E8OR0IIhv4gM3hn1cd`) is silently
   never synced.
2. it **ignores non-`.docx` files** — her `Copy of Vendor Listing.xlsx` never lands.

`execution/drive_docx_sync.py` is HARNESS-owned (`.claude/rules/athanor.md`: everything under
`execution/` is replaced wholesale on `make update-template`) — the fix is filed upstream, never
patched in place. `scripts/lee-ann-drive-watch.py` is a **separate, project-owned** script that
shares no code with it and is immune to the template overlay. It solves a narrower problem — not
"mirror every byte locally" but "tell Brad what changed, every session, with zero network calls
required for its own tests."

### Why the two bugs don't recur here

`lee-ann-drive-watch.py` never writes Drive content to disk at all — it only tracks **metadata**
(id, name, mimeType, modifiedTime, md5Checksum, parents) in one flat JSON file keyed by Drive file
id. A folder's "path" is only ever a **display string** (folder names joined with `" / "`, used
only in the printed/JSON report), never a filesystem path, so a `/` inside a folder name is
structurally harmless — there is no bug class to reintroduce. The non-`.docx` gap doesn't recur
because this script has no file-type filter at all: every child of every folder, of any
`mimeType`, is tracked.

## Usage

```
scripts/lee-ann-drive-watch.py [--init] [--json] [--fixture PATH] [--state-path PATH]
```

| Flag | Meaning |
|---|---|
| *(none)* | Live run — walks Drive folder `1O2Lbzsbt57i8-7ZLFdhrcHjaMQ--TkJH` recursively via the real `gws` CLI, loads the existing state file, prints a human-readable NEW/CHANGED/REMOVED report, writes the new state. |
| `--init` | Walks Drive (or the fixture) and writes the state file as a fresh baseline — **no comparison, no report.** Always exits `0` on success. Use this to create the very first baseline, or to deliberately re-baseline after confirming a change is expected. |
| `--json` | Same walk/compare, but the report is one JSON object, `{"new": [...], "changed": [...], "removed": [...]}` (each entry: `id`, `name`, `path`, `mimeType`), instead of human-readable lines. Combinable with everything else. |
| `--fixture PATH` | Reads a JSON tree from `PATH` instead of calling `gws` at all — see "Fixture format" below. This is what makes the script's own tests runnable with zero network access, per `sandbox.md`. |
| `--state-path PATH` | Overrides the state file location (default `content/drive-watch/state.json`). Always pass this in a test/script context so the real state file is never touched. |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Ran successfully; no changes versus the stored state (or `--init`, which never compares). |
| `10` | Ran successfully; at least one NEW/CHANGED/REMOVED item found. |
| `1` | Error — `gws` failed or produced non-JSON output, the fixture file is missing/malformed, or the state file exists but isn't valid JSON. |

## State file

Default location: `content/drive-watch/state.json`, gitignored (`.gitignore`) the same way
`content/drive-source/` already is — it is per-session metadata only, re-derived on every run, and
never committed. Pass `--state-path` to point at a different location (every test does this).

The file is a flat JSON object keyed by Drive file id, each entry carrying `id`, `name`,
`mimeType`, `modifiedTime`, `md5Checksum`, `parents` (sorted list of parent folder ids), and
`path` (the display string). It is written atomically — a temp file in the same directory,
then `os.replace()` — so an interrupted run never leaves a truncated state file that the next run
would reject as invalid JSON.

## Change detection

- A file id present in the fresh walk but absent from the stored state → **NEW**.
- A file id present in the stored state but absent from the fresh walk → **REMOVED**. Drive
  file/folder ids are stable across both a rename and a move between parents, so this bucket is
  reserved for genuine deletion/unshare from the watched tree — it is never a move's other half.
- A file id present in both is **CHANGED** when any of the following differ:
  - **content** — `md5Checksum` when both sides have one; falls back to `modifiedTime` when
    either side lacks one (Google-native Docs/Sheets/Slides never have an `md5Checksum`).
  - **its own name**.
  - **its own `parents`** — compared only when the *stored* entry has a `parents` key at all. A
    state entry written before this field was tracked skips that comparison for itself, rather
    than reporting every pre-existing entry as moved the first time the field appears.

## Rename/move semantics

A renamed or moved item is always reported as **one CHANGED entry on its own id** — never a
REMOVED+NEW pair. Because the state map is keyed by file id, not by filesystem path, a rename and
a move are both just "this id's own `name` or `parents` field changed" — the same comparison that
catches a content change.

The display `path` string (the `" / "`-joined ancestor-name chain, recomputed fresh on every walk)
is never itself a comparison input. A child whose *only* difference from stored state is a `path`
recomputed because an ancestor folder was renamed or moved is therefore silent by construction —
only the renamed/moved ancestor's own entry shows CHANGED. This is what keeps a single rename high
in a large tree from flooding the report with every file beneath it.

## Fixture format (`--fixture PATH`)

```json
{
  "root_id": "ROOT",
  "folders": {
    "ROOT": [ { "id": "...", "name": "...", "mimeType": "...", "modifiedTime": "...",
                "md5Checksum": "..." }, ... ],
    "<any discovered subfolder id>": [ ... ]
  }
}
```

`root_id` overrides the real hardcoded root for the run; a folder id with no key in `folders` is
treated as empty, matching how an empty real Drive folder behaves. `parents` may be omitted per
entry — the walk fills it in as the id of the folder bucket the entry is listed under, which is
exactly what makes "move a file between folders" expressible in a fixture: list the same `id`
under a different folder key between two fixtures and its derived `parents` differs automatically.

Two checked-in fixtures (`checks/fixtures/drive-watch-baseline.json` and
`checks/fixtures/drive-watch-updated.json`, under this mission's contract directory) exercise
every code path without network, including a docx nested inside a folder named
`13. Registration/Booking/Tickets` (the exact slash-bearing name from the real tree), a
Google-native file with no `md5Checksum`, a renamed folder, and a file moved between folders.

## `gws` invocation (live mode only)

One fixed-literal-argv subcommand shape, mirroring `execution/drive_docx_sync.py`'s own
`gws drive files list` convention — never a string-formatted shell command:

```python
argv = ["gws", "drive", "files", "list", "--params", json.dumps({
    "q": f"'{folder_id}' in parents and trashed=false",
    "fields": "files(id,name,mimeType,modifiedTime,md5Checksum,parents,owners(emailAddress))",
    "pageSize": 100,
}), "--page-all"]
```

`gws` sometimes prints a plain `Using keyring backend: keyring` line before its JSON body; the
script strips every leading line of stdout that doesn't start with `{` or `[` before parsing —
a no-op, and therefore safe, on a machine where `gws` never prints that line. No `gws` mutation
verb (`create`/`update`/`delete`/`copy`/`trash`) is referenced anywhere in the source — the same
read-only posture `execution/drive_docx_sync.py` documents for itself.

## What this does NOT do

- Does not download or store any file's content — metadata only.
  `execution/drive_docx_sync.py` already owns content sync, separately, for `.docx` under
  `content/drive-source/`; this script is purely a change-detector.
- Does not call any Drive mutation verb.
- Does not fix `execution/drive_docx_sync.py` itself — that stays filed upstream per the
  2026-10-08 backlog entry.

## Related

- [docs/vendor-form-copy-20261007.md](vendor-form-copy-20261007.md) — F1 of the same mission, the
  vendor-form edit this tool would have surfaced automatically.
- [docs/drive-docx-version-export.md](drive-docx-version-export.md) — the HARNESS-owned sibling
  tool, its folder-name and extension-filter limitations, and the backlog entry recording them.

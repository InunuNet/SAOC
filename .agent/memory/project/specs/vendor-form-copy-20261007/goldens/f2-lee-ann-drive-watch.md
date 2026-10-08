# F2: Lee-Ann Drive Watch — scripts/lee-ann-drive-watch.py

**Feature:** F2 of mission `vendor-form-copy-20261007`. Brad: Lee-Ann edits Drive documents
without telling him (the 2026-10-07 vendor-form edit, F1 of this same mission, was found only
because an agent happened to re-read the doc). The HARNESS-owned
`execution/drive_docx_sync.py` already exists but has two gaps Brad named and a backlog entry
already records (`.agent/memory/project/backlog.md`, "Harness — drive_docx_sync.py gaps
(found 2026-10-08, upstream to InunuNet/Athanor)"):

1. it **skips any Drive folder whose name contains `/`** — Lee-Ann's own
   `13. Registration/Booking/Tickets` folder (id `1-H3m-LHjtmjLw4E8OR0IIhv4gM3hn1cd`) is
   silently never synced;
2. it **ignores non-`.docx` files** — her `Copy of Vendor Listing.xlsx` never lands.

`execution/drive_docx_sync.py` is HARNESS-owned (`.claude/rules/athanor.md`: everything
under `execution/` is replaced wholesale on `make update-template`) — it is filed upstream,
never patched in place. This feature is a **separate, project-owned** script,
`scripts/lee-ann-drive-watch.py`, that does not share its code and is immune to the template
overlay. It solves a narrower problem than the sync tool: not "mirror every byte locally" but
"tell Brad what changed, every session, with zero network calls in CI."

## Why the two bugs don't recur here

`drive_docx_sync.py`'s folder-name bug exists because it writes real file **content** to
disk at `content/drive-source/<folder name>/<folder name>/.../source.docx` — a folder name
becomes a literal filesystem path component, so a `/` inside one is unsafe
(`UnsafePathComponentError`, by design, in that script). `lee-ann-drive-watch.py` never
writes Drive content to disk at all — it only tracks **metadata** (id, name, mimeType,
modifiedTime, md5Checksum, owners) in one flat JSON file keyed by Drive file id. A folder's
"path" is only ever a **display string** (folder names joined with `" / "`, purely for the
printed report), never a filesystem path. A `/` inside a folder name is therefore
structurally harmless here — there is no bug class to reintroduce.

The non-`.docx` gap doesn't recur because this script has no file-type filter at all: every
child of every folder, of any `mimeType` (including `application/vnd.google-apps.folder`
itself, which it recurses into rather than records as a change), is tracked.

## CLI contract

```
scripts/lee-ann-drive-watch.py [--init] [--json] [--fixture PATH] [--state-path PATH]
```

- **Default (no flags):** live run — walks Drive folder
  `1O2Lbzsbt57i8-7ZLFdhrcHjaMQ--TkJH` recursively via the real `gws` CLI, loads the existing
  state file, prints a human-readable report of NEW / CHANGED / REMOVED items (each with its
  folder path and mimeType), writes the new state, and exits per the table below.
- **`--init`**: walks Drive (or the fixture) and writes the state file as a fresh baseline —
  **no comparison, no NEW/CHANGED/REMOVED report**. Always exits `0` (barring a genuine
  error, which is `1`). This is how the very first baseline gets created, and how Brad can
  deliberately re-baseline after confirming a change is expected.
- **`--json`**: same walk/compare, but the report is one JSON object
  `{"new": [...], "changed": [...], "removed": [...]}` (each entry: `id`, `name`, `path`,
  `mimeType`) instead of human-readable lines. Combinable with everything else.
- **`--fixture PATH`**: read a JSON tree from `PATH` instead of calling `gws` at all — see
  "Fixture format" below. This is what makes the contract's assertions runnable with **zero
  network access**, per `sandbox.md`'s requirement that a shipped assertion command never
  prompts or reaches outside the project.
- **`--state-path PATH`**: override the state file location (default
  `content/drive-watch/state.json`, gitignored the same way `content/drive-source/` already
  is — add this path to `.gitignore` in this feature). Required so the contract's own
  assertions never touch the real state file; tests always pass their own `--state-path`
  under `.tmp/sandbox/`.

## Exit codes

| code | meaning |
|---|---|
| `0` | ran successfully; no changes versus the stored state (or `--init`, which never compares) |
| `10` | ran successfully; at least one NEW/CHANGED/REMOVED item found |
| `1` | error — `gws` failed/produced non-JSON output, the fixture file is missing/malformed, or the state file exists but isn't valid JSON |

## `gws` invocation (live mode only)

One subcommand shape, mirroring `execution/drive_docx_sync.py`'s own
`gws drive files list` convention (fixed literal argv, not a string-formatted shell
command):

```python
argv = ["gws", "drive", "files", "list", "--params", json.dumps({
    "q": f"'{folder_id}' in parents and trashed=false",
    "fields": "files(id,name,mimeType,modifiedTime,md5Checksum,owners(emailAddress))",
    "pageSize": 100,
}), "--page-all"]
result = subprocess.run(argv, capture_output=True, text=True)
```

`gws` prints `Using keyring backend: keyring` as a plain line **before** the JSON on some
machines/configs. Before `json.loads()`, strip every leading line of `result.stdout` that
does not start with `{` or `[` (do this unconditionally — it is a no-op, and therefore safe,
on a machine where `gws` never prints that line). Recurse into every child whose `mimeType`
is `application/vnd.google-apps.folder`; track a `visited` set of folder ids walked so a
(disallowed, but handle the error path per `coding.md`) cycle can never loop forever.

## Change detection

- A file id present in the fresh walk but absent from the stored state → **NEW**.
- A file id present in the stored state but absent from the fresh walk → **REMOVED**. (A
  file removed from one folder and simultaneously added to another appears as both REMOVED
  and NEW under this rule — same id, different id-keyed bucket, never coalesced into a
  "moved" case. Simpler and more honest than guessing intent; Brad reads both lines.)
- A file id present in both: compare `md5Checksum` when **both** the stored and fresh entries
  have one (ordinary binary files — docx, xlsx, images, PDFs, …). When **either** side lacks
  `md5Checksum` (Google-native Docs/Sheets/Slides never have one), fall back to comparing
  `modifiedTime` instead. Either comparison differing → **CHANGED**.
- A folder being renamed or moved (its own entry's `name`/parent changing) is tracked the
  same way as any other item for NEW/CHANGED/REMOVED purposes, but a folder rename that only
  changes its *descendants'* display `path` string, with no descendant's own
  `md5Checksum`/`modifiedTime` touched, is **not** itself reported as a change on those
  descendants — only the folder's own entry shows CHANGED. (Avoids a single rename at the top
  of a large tree flooding the report with every file beneath it.)

## Fixture format (`--fixture PATH`)

```json
{
  "root_id": "ROOT",
  "folders": {
    "ROOT": [ { "id": "...", "name": "...", "mimeType": "...", "modifiedTime": "...",
                "md5Checksum": "...", "owners": [{"emailAddress": "..."}] }, ... ],
    "<any discovered subfolder id>": [ ... ]
  }
}
```

`root_id` overrides the real hardcoded root (`1O2Lbzsbt57i8-7ZLFdhrcHjaMQ--TkJH`) for the
run — the walk starts there and recurses using `folders[<id>]` lookups instead of `gws`
calls; a folder id with no key in `folders` is treated as empty (no children), matching how
an empty real Drive folder behaves.

Two checked-in fixtures exercise every code path without network:
`checks/fixtures/drive-watch-baseline.json` and `checks/fixtures/drive-watch-updated.json`
(same tree, `--init` against the first then a normal run against the second must report):
- `F1` (the vendor-form docx, nested inside `SUBSLASH` — a folder named
  `13. Registration/Booking/Tickets`, the exact slash-bearing name from the real tree) →
  **CHANGED** (md5Checksum differs) — proves the slash-named-folder walk works and a
  `.docx` is covered.
- `F2` (`Copy of Vendor Listing.xlsx`) → unchanged, must **not** appear in either list —
  proves a non-`.docx` file is tracked (present in state) without false-positiving.
- `F3` (a Google-native Doc, no `md5Checksum` in either fixture) → **CHANGED** via the
  `modifiedTime` fallback — proves Google-native coverage.
- `F4` (`Old Draft.docx`, in `baseline` only) → **REMOVED**.
- `F5` (`New Photo.jpg`, in `updated` only) → **NEW** — proves an arbitrary non-document
  mimeType is covered, not just spreadsheets/docs.

## Human-readable report format (default, no `--json`)

One line per item: `<KIND>  <path>  (<mimeType>)`, e.g.:
```
CHANGED  13. Registration/Booking/Tickets / 13.2 Vendor Form - SAOC National Show Vendor Registration Form.docx  (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
```
followed by a one-line summary count. `path` is the display join described above — folder
names joined with `" / "`, root excluded, never written to disk as a directory.

## What this feature does NOT do

- Does not download or store any file's content — metadata only. (`drive_docx_sync.py`
  already owns content sync, separately, for `.docx` under `content/drive-source/`; this
  script is purely a change-detector, run every session, that tells Brad *what* to go look
  at.)
- Does not call any Drive mutation verb — same read-only posture as every existing `gws`
  caller in this project (`drive_docx_sync.py`'s own file header states this guarantee for
  itself; this script makes the identical claim for its own two `gws` call sites).
- Does not fix `execution/drive_docx_sync.py` itself — that stays filed upstream per the
  backlog entry already recorded 2026-10-08.

## Verification path for @dev

No `pnpm` gates apply (pure Python, stdlib only, no Node dependency). Run
`python3 scripts/lee-ann-drive-watch.py --fixture <baseline> --init --state-path <tmp>` then
`python3 scripts/lee-ann-drive-watch.py --fixture <updated> --state-path <tmp> --json` and
confirm the exit code and JSON body match the five fixture expectations above — the
contract's own `check-f2-fixture-walk.sh` does exactly this and is the gate.

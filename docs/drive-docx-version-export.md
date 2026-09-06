# Drive .docx Version Export

Mission `drive-docx-version-export`, M1/F1. Tool: `execution/drive_docx_sync.py`.

## Why this exists

Lee-Ann maintains the site's real source content as `.docx` files in a shared Google Drive
folder, "Docs for Brad" (id `1rZJVrYwrWM92vqmPw2c9E_HABQKEQoGa`). Her folder structure *is* the
shape the website's content follows — the tree isn't just a document dump, it's the information
architecture. Every time she edits one of those files, we need a local copy we can parse
(`execution/doc2md.py`) into the site, without hand-copying content or losing the history of what
changed and when.

`drive_docx_sync.py` walks that folder read-only via the `gws` CLI, downloads every `.docx` file
under it, and maintains a local versioned store (`content/drive-source/`) — one version directory
per real content change, never overwritten, never deleted, even after a file vanishes from Drive.

Design record, all eight original design answers plus a nine-item post-QA hardening addendum:
`.agent/memory/project/specs/drive-docx-version-export/goldens/README.md`. This doc summarizes
behaviour; treat the goldens file as the source of truth for edge cases.

**The Drive folder is being hand-reorganised by Lee-Ann as of this writing (2026-09-05).**
Everything below describes the structure as *observed*, not as fixed — folder names, depth, and
gaps in numbering will keep changing on her side, and the tool is built to tolerate that (see
Rename/move semantics below), not to assume a frozen tree.

## Running it

```bash
python3 execution/drive_docx_sync.py [--store-root PATH] [--drive-root-id ID] [--major FILE_ID ...]
```

| Flag | Default | Meaning |
|---|---|---|
| `--store-root` | `content/drive-source` | Local versioned store root |
| `--drive-root-id` | `1rZJVrYwrWM92vqmPw2c9E_HABQKEQoGa` ("Docs for Brad") | Drive folder id to walk |
| `--major FILE_ID` | (none) | Force a MAJOR bump for this Drive file id on this run only. Repeatable. Never inferred — see Version semantics. |

There is no scheduler wiring — see "What this does not do" below. Run it on demand whenever you
need the local store to reflect the current state of Lee-Ann's Drive folder.

## Version semantics

- **First time a Drive file id is seen: `v1.0`.**
- **MINOR bumps are automatic, and are the only automatic bump.** Each sync run compares the
  file's Drive `md5Checksum` against the last value recorded for that file id. If it differs,
  that's a real content change: `v1.0 -> v1.1 -> v1.2 -> ...`.
- **MAJOR bumps are manual-only**, via `--major <fileId>` on the run where you want it (`vX.0 ->
  v(X+1).0`, minor resets to 0). It is never inferred from diff size, word count, or any other
  heuristic — "this is a big enough change to call a major version" is a judgment call for
  whoever runs the tool, made deliberately, not guessed at by the script.

**`md5Checksum`, never `modifiedTime`, is the change signal — and this distinction is
load-bearing, not cosmetic.** `md5Checksum` is Drive's content hash: it changes if and only if the
file's bytes changed. `modifiedTime` changes on *any* touch to the file — opening and re-saving
with no edits, a rename, a move to a different folder, a comment, even a permission change. If
`modifiedTime` were the trigger, any of those metadata-only events would mint a spurious version
with no actual content behind it. `modifiedTime` is still recorded in the index as provenance (so
you can see when a touch was last observed) — it is just never what decides whether a new version
gets minted.

## Duplicate filenames in one folder

Drive allows two different files to share the same name in the same folder. This is handled, not
skipped: both files keep independent version histories.

- The file that already owns a given `path/basename` location keeps that plain, human-readable
  path untouched — it is never relocated because a second file later collides with it.
- The *new* file colliding with an already-established owner is disambiguated to
  `<path>/<basename>-<10-hex-char sha256 of its own Drive file id>`. The suffix is derived purely
  from the file's own id, so it's stable across every future run regardless of what happens to
  the other file (rename, deletion) — never a positional counter that could land differently
  depending on discovery order.
- This is logged to stderr for visibility, but it is **not a failure**: the run exits 0. A
  same-name collision that both files survive independently is the tool working correctly, not an
  error condition.

The same disambiguate-not-skip behaviour applies when a file is renamed/moved away from a
path+name and a *different*, brand-new file later takes over the vacated slot — the freed-slot
case is a cross-run version of the same rule.

## Untrusted Drive names — rejected, not sanitized

Drive names come from a folder that is shared and hand-edited outside this tool's control, and
Drive permits almost any string as a name — including values that would escape the local store if
joined naively into a filesystem path. Names are rejected at the boundary, not silently rewritten:

- Rejected: a name that is empty, `.`, `..`, contains a NUL byte, or contains a path separator
  (`/` or `\`).
- A rejected **folder** name skips that entire subtree (nothing under it can be discovered at
  all); a rejected **file** name skips just that one file.
- Every rejection is printed to stderr, naming the file/folder id and its location, and the run
  still exits **non-zero** overall — a path-traversal attempt anywhere in the tree is a real
  finding, even though every other file in the run keeps syncing normally.
- As defence in depth beyond the per-component name check, every resolved storage path is
  independently asserted to still resolve inside `store_root` (guards against unusual
  normalization or a future path-building change elsewhere, not just today's known bad inputs).

**Unusual-but-legitimate names are explicitly not rejected and must keep working.** The real Drive
tree contains a folder literally named `SAOC ` (with a trailing space) — that is handled as-is,
not treated as suspicious or renamed, and continues to sync normally alongside the rejection
behaviour above. Unicode, emoji, and very long names are all legitimate Drive names too.

## Renamed/moved files

If a file's Drive `name` and/or parent folder path changes while its `md5Checksum` stays the
same, no new version is minted — nothing about the content changed. Instead:

- The index's `name`/`path_in_tree` for that file update to the new values.
- An entry is **appended** (never overwritten) to that file's `path_history`, recording
  `old_name`, `old_path`, `new_name`, `new_path`, and `detected_at` — so the rename is visible,
  auditable history rather than a silent metadata overwrite.
- The on-disk version directory chosen at that file's **first** sync never moves. A rename must
  never touch history already written to disk.

## Deletions

If a previously-seen Drive file id no longer appears anywhere in the live listing under the root,
**nothing is deleted locally, ever.** Every existing version directory and manifest for that file
stays on disk byte-for-byte. The index entry flips to `status: "missing"` with `missing_since` set
to the detection timestamp. If the file later reappears in Drive, it's reactivated on the next
sync that sees it again.

## Storage layout

```
content/drive-source/
├── index.json
└── <path-in-tree>/<basename-no-ext>/
    ├── v1.0/
    │   ├── source.docx      # gitignored — raw downloaded bytes
    │   ├── content.md       # tracked — extracted text (execution/doc2md.py)
    │   └── manifest.json    # tracked
    ├── v1.1/
    │   └── ...
    └── v2.0/
        └── ...
```

`<path-in-tree>` is the "/"-joined chain of ancestor Drive folder names, exactly as Drive reports
them — no renumbering, no gap-filling, no trimming. If Lee-Ann's Show subfolders have numbering
gaps or an out-of-place file number, that's preserved verbatim; the Drive tree's own structure is
the source of truth this tool mirrors, not something it silently corrects.

**`manifest.json`** (one per version directory), all fields required non-null: `drive_file_id`,
`name`, `path_in_tree`, `modified_time`, `md5_checksum`, `version`, `exported_at` (local export
timestamp, ISO-8601), `source_docx_relpath`, `content_md_relpath`.

**`index.json`** (one per store, current state only — not history): a map keyed by
`drive_file_id`, each entry carrying `name`, `path_in_tree`, `status` (`active` | `missing`),
`current_version`, `md5_checksum`, `modified_time`, `missing_since` (null unless missing),
`path_history` (append-only array), and `storage_relpath` (the on-disk location, frozen at first
sync). Written atomically (build in a temp file, `os.replace()` over the real path) and persisted
after every single file in a run, not just once at the end — so if a later file in the same run
fails, everything that already synced above it keeps its index entry.

## What's tracked in git vs. gitignored

- **Gitignored:** `content/drive-source/**/source.docx` — the raw downloaded bytes. Regenerable
  from Drive on demand, bulky, and a binary blob produces a useless diff in review.
- **Tracked:** `content.md`, `manifest.json` (both per-version), and the top-level `index.json`.
  These are the actual artefacts with review/audit value — the parsed text is what downstream
  code reads, and the manifests/index are small, diffable provenance.

The `.gitignore` pattern is verified against the real `git check-ignore` mechanism (not a text
grep) in `execution/checks/verify_drive_docx_sync_gitignore.py`, against representative nested
paths, so a pattern that's present but wrongly anchored or scoped can't pass silently.

## Non-.docx files

Only real `.docx` Office files are in scope. Anything else under the Drive tree (PDFs,
spreadsheets, native Google Docs, images, etc.) is skipped — silently to the index, but not
silently overall: every run counts the skips and reports the total to stderr once the walk
finishes, so a large unexpected drop is visible rather than swallowed. This is a real limitation,
not just an implementation detail — if Lee-Ann later adds PDFs, spreadsheets, or native Google
Docs to this folder, none of that content will sync until the tool is extended.

## Read-only guarantee

The script is structurally guarded to be read-only against Drive, mirroring the same approach
used for `execution/gws_inbox_check.sh` (see [`docs/verification-triad-gate.md`](verification-triad-gate.md)):
its source references exactly two `gws` subcommand shapes — `drive files list` and `drive files
get` — both fixed literal argv lists with only opaque values (a folder id, a file id, a JSON
params blob, an output path) passed in. There is no `eval(...)` and no subprocess argv built by
string-formatting a value pulled from Drive-returned content, so calling a Drive write verb isn't
just avoided in the paths this script happens to exercise — it isn't reachable from this source at
all. Verified structurally, not just behaviourally, by
`execution/checks/verify_drive_docx_sync_readonly.py`, which also resolves each
`subprocess.run/call/Popen(...)` call's actual argv-building expression and flags `.format()`,
`%`-formatting, string concatenation, or an environment/config-sourced value feeding the argv.

## Exit codes

| Exit | Meaning |
|---|---|
| `0` | Every file synced (or was correctly recognised as unchanged/missing/disambiguated). A resolved same-name collision alone never causes non-zero — that's the tool working as designed. |
| `1` | Either a `DriveSyncError` (a failed `gws` call, a missing/empty download, extracted text that's empty/placeholder, or a corrupt `index.json` that can't be parsed) stopped the run with a clean message — never a raw traceback — or at least one file/folder was skipped this run due to an unsafe/traversal path name. Either way, check stderr for which file/folder and why. |

A same-name storage-path collision is explicitly **not** an exit-1 condition (see Duplicate
filenames above) — it's resolved automatically and reported for visibility only.

## Verification

`execution/checks/verify_drive_docx_sync_discriminator.py` drives the real script through 13
scripted Drive-world runs (RED-verified against a from-scratch HEAD, GREEN against the shipped
implementation) against a fake `gws` stub (`goldens/fake_gws_stub.py`) that reads fixture JSON —
no real Drive API call is ever made. It covers: first-sync minting, idempotency on an unchanged
world, the modifiedTime-without-md5-change non-bump, a real content-change minor bump,
`--major`, rename/move with `path_history`, deletion-preserves-history, same-run and
cross-run filename collisions, byte-stability of untouched version directories across runs,
`modified_time` provenance on metadata-only touches, partial-failure index survival, corrupt-index
handling, `--page-all` pagination correctness, and path-traversal rejection (including the
negative control that the real `SAOC ` trailing-space folder keeps working). The independent stub
also refuses (exit 9) any `gws` subcommand outside `list`/`get` as defense in depth during the
discriminator run itself.

`execution/checks/verify_drive_docx_sync_readonly.py` and
`execution/checks/verify_drive_docx_sync_gitignore.py` cover the read-only guarantee and the
tracked/gitignored split described above.

## What this does not do

- **No scheduler.** This ships as a standalone, on-demand script (`python3
  execution/drive_docx_sync.py`), invoked manually. Whether it should run on a cron/scheduled
  agent, or be triggered some other way, is a distinct decision this tool does not make — it's an
  open question for Brad, not assumed here.
- **Non-.docx content is not synced at all.** PDFs, spreadsheets, native Google Docs, images —
  anything under the Drive root that isn't a `.docx` file — is counted and skipped, never
  downloaded or versioned.
- **Folder-level renames and moves are not covered by fixtures.** The discriminator suite proves
  a *file's* rename/move updates `path_history` correctly. A folder itself being renamed, moved,
  or deleted has no dedicated fixture and is unverified behaviour — the simulated Drive-world
  fixtures model a two-level nested tree deep enough to exercise real recursive
  list-then-list-then-get traversal, but shallower than the real tree's full depth might
  eventually reach.
- **The local store is a mirror, not a backup.** It preserves every version it has ever seen and
  never deletes on a Drive-side deletion, but it is not a substitute for Drive's own revision
  history or an independent backup system — it only knows what a sync run has actually observed.
- **Two files sharing the same `md5Checksum` in different folders** (e.g. Lee-Ann duplicating a
  document across folders) is undefined behaviour, not tested.
- **Drive API pagination beyond the fixture's shape.** `--page-all` correctness is proven against
  a 5-file, `PAGE_SIZE=2` fixture; nothing proves behaviour at larger real-world page counts
  beyond that it uses the flag at all.

See the goldens README's "Open questions for Brad" section for the standing decisions
(recurrence, numbering-gap handling, retention-after-deletion, and major-bump scope) that are
deliberately left to Brad rather than guessed at in this tool.

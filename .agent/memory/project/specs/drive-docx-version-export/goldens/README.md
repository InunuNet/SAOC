# drive-docx-version-export -- golden spec (M1/F1)

## The requirement (recap)

Lee-Ann maintains the site's source content as `.docx` files in a Drive folder
("Docs for Brad", id `1rZJVrYwrWM92vqmPw2c9E_HABQKEQoGa`). Each time she edits one,
we want it exported to a local versioned copy (v1.0, v1.1, v1.2, ...) so it can be
parsed. The Drive tree's structure is the shape the website content follows.

Every file under that root is a real **.docx Office file**, not a native Google
Doc (`gws docs documents get` returns HTTP 400 on these -- confirmed by whoever
indexed the tree on 2026-09-05). `gws drive files get --params '{"fileId":...,
"alt":"media"}' -o <path>` is the correct download call for an Office file stored
in Drive (`files.export` is for native Google Docs/Sheets/Slides only, per the
Drive API's own docs -- not applicable here). This spec is built against that.

## What @dev implements against these goldens

1. `execution/drive_docx_sync.py` -- the sync tool itself.
   - CLI: `--store-root PATH` (default `content/drive-source`), `--drive-root-id ID`
     (default the real Drive root id above), `--major FILE_ID` (optional, see
     version semantics below).
   - Walks the Drive tree read-only via `gws drive files list --params
     '{"q":"'"'"'<parentId>'"'"' in parents and trashed=false", ...}'` recursively
     from the root, and downloads changed/new files via `gws drive files get
     --params '{"fileId":...,"alt":"media"}' -o <tmp path>`.
   - For each file, extracts text via `execution/doc2md.py` (already in this repo,
     wraps `markitdown`, already handles .docx) into a `content.md` sidecar.
   - Writes/updates `<store-root>/index.json` (single top-level provenance index).
2. Two `elif kind == ...`-style additions are NOT needed here -- this is a
   standalone tool, not a new `contract.py` assertion kind. It ships as a script,
   invoked directly (`python3 execution/drive_docx_sync.py`), and later by a cron/
   scheduled agent if Brad wants it recurring (out of scope for this contract --
   flagged as an open question below).
3. A `.gitignore` entry so raw `.docx` bytes never enter the repo (see decision
   below), leaving `content.md` / `manifest.json` / `index.json` tracked.

Discriminator checks (`execution/checks/verify_drive_docx_sync_*.py`) are
**RED-verified** against current `HEAD` (2026-09-05) -- confirmed by running them
before this README was written; each fails with "does not exist yet", not a bug
in the harness itself. Once @dev implements the script per this spec, the SAME
unmodified checks must go GREEN -- that is the actual proof of correctness, not
"the script exists" or "exit code 0".

## Design answers (why each decision, and what a wrong implementation looks like)

### 1. Change signal: `md5Checksum`, never `modifiedTime`

`md5Checksum` is Drive's content hash -- it changes if and only if the file's
bytes changed. `modifiedTime` changes on **any** touch: opening and re-saving
with no edits, a rename, a move between folders, a comment, a permission change.
Using `modifiedTime` as the version-bump trigger would silently mint spurious
versions on non-content events -- exactly the kind of vacuous "did something
happen" signal this project's own audited defect class warns against (see
`.agent/memory/project/learned.md`'s "Venue Prose Residue" and "text-matching
cannot discriminate" entries: a signal that correlates with the real event but
also fires on unrelated events is not proof of the real event).

`goldens/fixtures/drive_world_run3_metadata_only_touch.json` isolates exactly
this: `modifiedTime` advances, `md5Checksum` is identical to run1. The
discriminator (`verify_drive_docx_sync_discriminator.py`, run3 assertion) fails
any implementation that bumps a version here. `run4_content_changed.json` is the
positive control: `md5Checksum` differs, and a bump into `v1.1` is required.

`modifiedTime` is still recorded (provenance requirement) and updated in the
index on every observed touch -- it's just never the trigger.

### 2. Version semantics: MINOR is automatic, MAJOR is manual-only

- First time any Drive `fileId` is seen: `v1.0`.
- Any subsequent sync where `md5Checksum` differs from the last recorded value
  for that `fileId`: automatic **MINOR** bump (`v1.0` -> `v1.1` -> `v1.2` -> ...).
- **MAJOR** bump (`vX.0` -> `v(X+1).0`, minor resets to 0) happens **only** via
  an explicit `--major <fileId>` flag on that run -- never inferred from diff
  size, word count, or any other heuristic. An undefined automatic-major rule is
  itself a defect per this mission's brief; making it manual-only removes the
  ambiguity rather than guessing at one.
- `run4` (content changed, no `--major`) must land as `v1.1`, never `v2.0` --
  proving the "big changes don't auto-major" rule.
- `run5` (`--major fileA`, content otherwise unchanged from run4) must land as
  `v2.0` -- proving the flag is honored and doesn't require a concurrent content
  change to work.

This means "what counts as a major revision" (e.g. "this is the version we built
the site against") is a judgment call for whoever runs the tool (Brad or an
agent, deliberately, not automatically) -- consistent with the mission brief's
instruction to state the rule plainly rather than leave it assumed.

### 3. Provenance: one `manifest.json` per version, one `index.json` per store

Every version directory
(`<store-root>/<path-in-tree>/<basename>/vX.Y/`) contains:
- `source.docx` -- the raw downloaded bytes (gitignored, see decision 5)
- `content.md` -- extracted text via `execution/doc2md.py` (tracked)
- `manifest.json` -- tracked, required non-null fields: `drive_file_id`, `name`,
  `path_in_tree`, `modified_time`, `md5_checksum`, `version`, `exported_at`
  (local export timestamp, ISO-8601), `source_docx_relpath`, `content_md_relpath`.

`<store-root>/index.json` is a single map keyed by `drive_file_id`, current state
only (not history): `name`, `path_in_tree`, `status` (`active`|`missing`),
`current_version`, `md5_checksum`, `modified_time`, `missing_since` (null unless
missing), `path_history` (array, append-only, see decision 4).

`verify_drive_docx_sync_discriminator.py`'s `A_provenance` assertion checks every
required manifest field is present and non-null for the run1 version -- a wrong
implementation that writes a manifest but drops a field (e.g. no `exported_at`)
passes "a manifest exists" but fails this.

### 4. Renamed/moved files must not silently vanish

Same `drive_file_id`, but Drive now reports a different `name` and/or a
different parent path, with `md5Checksum` **unchanged**:
- Content did not change -> **no new version is minted.**
- `index.json`'s `name`/`path_in_tree` for that file update to the new values.
- A `path_history` entry is **appended** (never overwritten) recording
  `old_name`, `old_path`, `new_name`, `new_path`, `detected_at` -- so the rename
  is visible, auditable history, not a silent metadata overwrite.

`run6_renamed_moved.json` isolates this: `fileA` keeps `md5Checksum` from run4/5,
gets a new `name` ("Vendor Pricing (Updated).docx") and moves from
"National Show/4. South African Exhibitors" into "SAOC " (note: the real Drive
folder name really does have a trailing space -- per the mission brief, this is
handled as-is, not renamed). A wrong implementation that (a) silently overwrites
`name`/`path_in_tree` with no history entry, or (b) treats the rename itself as
a content change and mints a spurious version, both fail the discriminator.

### 5. Deleted-from-Drive files: never deleted locally

If a previously-seen `drive_file_id` no longer appears anywhere in the live
Drive listing under the root: **all local version directories and manifests for
that file stay on disk, byte-for-byte, forever** (append-only local history is
the whole point of versioning -- Drive's own revision history is not something
we control access to, and this project has already been burned once by trusting
that "the source system still has it" -- see `learned.md`'s repeated "don't
assume state, verify" pattern). `index.json`'s entry for that file flips
`status: "missing"` and sets `missing_since` to the detection timestamp. Nothing
is deleted, nothing is silently left `active` forever either.

`run7_deleted.json` isolates this: `fileA` is removed from both folders. The
discriminator confirms the manifest byte-content is unchanged and the index
correctly reflects `missing`.

### 6. Parseable output is asserted by content, not by file existence

Per the mission brief's explicit anti-vacuous requirement, "a `content.md` file
exists" is not sufficient -- a wrong implementation could write an empty file or
a placeholder string and pass a bare existence check. `goldens/fixtures/
sample_v1.docx` / `sample_v2.docx` are minimal, hand-built, valid `.docx` files
(plain zip + WordprocessingML, no external dependency needed to build them) each
containing a distinct, known sentence. Confirmed both parse correctly via
`execution/doc2md.py`'s existing `markitdown` backend before this spec was
written:
```
sample_v1.docx => "Initial exhibitor pricing draft. Standard stand fee is R3800 per bay."
sample_v2.docx => "...R3800 per bay. Updated: late-registration surcharge is R500."
```
The discriminator asserts `content.md` contains the specific fixture phrase for
the version it corresponds to (`"R3800"` for v1.0, `"R500"` for v1.1) -- a wrong
implementation writing empty/placeholder/wrong-version content fails this
directly, not just "file is non-empty".

### 7. Read-only guarantee (structural, not just behavioural)

Modeled directly on `execution/gws_inbox_check.sh`'s own structural guard
(re-read before writing this spec, per the mission brief's instruction):
`execution/drive_docx_sync.py`'s source may reference exactly two gws
subcommand shapes -- `drive files list` and `drive files get` -- and must
contain **no token** for any Drive write verb (`files create/update/delete/copy/
emptyTrash`, `permissions create/update/delete`, `revisions delete/update`,
`comments`/`replies` create/update/delete), and no `eval(...)` or f-string-built
subprocess argv that could let untrusted Drive-returned content choose which
gws subcommand runs. `verify_drive_docx_sync_readonly.py` greps for this
structurally (deliberately broader than "have I seen it call something bad" --
it checks "is calling something bad possible at all from this source"), and the
test harness's fake `gws` stub (`goldens/fake_gws_stub.py`) independently
refuses (exit 9, `FAKE_GWS_REFUSED_WRITE`) any subcommand outside
`list`/`get` as defense in depth during the discriminator run.

### 8. Committed vs gitignored: parsed text is tracked, raw `.docx` bytes are not

**Decision:** `content/drive-source/**/source.docx` is gitignored.
`content.md`, `manifest.json`, and the top-level `index.json` are tracked.

**Reasoning:** the actual point of this tool is the parsed text -- that's what
downstream code will read. A `.docx` binary blob:
- produces useless diffs in review (binary, opaque, git can't show what changed)
- duplicates data Drive already stores durably (Lee-Ann's Drive is the source of
  truth; this tool's job is to make it parseable locally, not to become a second
  permanent archive of her raw files)
- grows the repo unboundedly as she keeps editing, with zero read benefit once
  `content.md` exists
- is trivially regenerable on demand by re-running the sync tool against the
  same `drive_file_id` (Drive is always reachable read-only)

The parsed `.md` + `manifest.json` + `index.json`, by contrast, are exactly the
artefacts with real review/audit value and cost little to store. This mirrors
the existing `docs/leeann-source/` convention in this repo (hand-parsed Drive
content, tracked as `.md`), just automated and versioned.
`verify_drive_docx_sync_gitignore.py` proves this with real `git check-ignore`
calls against representative nested paths, not a grep-for-text-somewhere check
(a pattern that's syntactically present but wrongly anchored, e.g. missing a
leading `/` or wrong glob depth, would pass a naive grep but still let binaries
through -- caught here because the check uses the real mechanism).

## Simplification made explicit (read before treating "Drive tree walk" as solved)

The Drive-tree simulation in `goldens/fixtures/drive_world_*.json` models a
**two-level nested folder tree** (root -> "National Show"/"SAOC " -> one
subfolder -> files), matching the real tree's shape closely enough to exercise
real recursive `list`-then-`list`-then-`get` traversal logic, but it does **not**
exercise:
- arbitrary/deeper nesting depth than the real tree's 13 numbered Show
  subfolders might eventually reach
- a **folder itself** being renamed, moved, or deleted (only a **file's**
  rename/move/deletion is covered)
- two files in different folders sharing the same `md5Checksum` (e.g. Lee-Ann
  duplicates a doc across folders) -- undefined behaviour, not tested
- Drive API pagination (`nextPageToken`) on a folder with more children than one
  page -- the real `gws drive files list` call supports `--page-all`; nothing
  here proves @dev's implementation uses it correctly for a large folder

These are flagged, not silently assumed solved. If any of them matter before
this ships, they need their own fixture + assertion added to this contract, not
inferred as "probably fine since the small case works."

## Open questions for Brad (please answer before/with implementation, not guessed)

1. **Recurrence.** The brief says "each time she updates a .docx" -- does that
   mean this tool runs on a schedule (a cron/scheduled agent), on-demand only
   when someone remembers to run it, or triggered by something else (a Drive
   push notification/webhook)? This contract deliberately ships the sync tool
   itself as a standalone script; wiring it to a scheduler is a distinct,
   separate decision this contract does not make for you.
2. **Numbering gaps and the out-of-place `1.1` file.** The brief notes Show
   subfolder numbering has gaps (8, 9, 10, 14, 16) and `4. South African
   Exhibitors` contains a file numbered `1.1`. This tool preserves whatever
   structure/naming Drive reports verbatim (no renumbering, no gap-filling) --
   confirming that's the right call, since "the Drive folder's structure IS the
   format the website will follow" per your own framing, and Lee-Ann's naming
   is himself/her call to fix upstream, not this tool's to silently correct.
3. **What happens to a stale local copy once a file is confirmed genuinely
   deleted (not just missing this run)?** This spec keeps it forever, flagged
   `missing`. If you'd rather it archive/prune after some retention window,
   that's a follow-up decision, not assumed here.
4. **Should `--major` be file-scoped only, or is there a "bump everything to the
   next major together" use case (e.g. "this whole tree is what we built site
   v2027 against")?** Spec'd here as strictly file-scoped (`--major <fileId>`,
   one file at a time) since that's the minimum that resolves the ambiguity the
   brief calls out; a batch/whole-tree major bump is a separate feature if
   wanted.

## Hardening addendum (post-QA gaps, same mission)

@qa proved the original 7-run discriminator + readonly guard stayed green
while real defects existed. This addendum closes those gaps; the checks
below are the same files (`verify_drive_docx_sync_discriminator.py`,
`verify_drive_docx_sync_readonly.py`), extended, not replaced.

1. **Storage-path collision (runs 8a/8b, `drive_world_run8{a,b}_collision_*.json`).**
   Two different `fileId`s, same name, same folder. **Ruling, final** (this
   item went through two drafts -- see history below): both files survive
   independently at DISTINCT on-disk locations, each manifest carries its
   own checksum, nothing is lost. Disambiguation is via a deterministic
   suffix derived from the `fileId`, applied only to the file that collides
   with an ALREADY-established owner -- the existing owner (`fileX`) keeps
   its plain human-readable path untouched (path stability for the common,
   non-colliding case), the new file (`fileY`) is minted at the suffixed
   location, an entirely UNRELATED file in the same run (`fileZ`, a
   different folder) still syncs and persists, and the run exits **0** (a
   successfully-resolved collision is not a failure). Confirmed green
   against the shipped `_disambiguated_relpath()` (hash-suffixes only the
   new file's `storage_relpath`, leaves an existing owner's path alone).
   A wrong implementation that keys the on-disk path by name+path alone
   (ignoring `fileId`) silently overwrites one file with the other -- the
   original HIGH-severity defect @qa found -- fails the distinct-manifest
   assertion; one that renames the FIRST file instead of the new one fails
   the byte-identity assertion; one that aborts the whole run instead of
   disambiguating fails the `fileZ`-still-synced assertion.

   **History, for anyone reading this later and wondering why it moved
   twice:** drafted as "both survive" -> a mid-review ruling changed it to
   "skip-and-continue" (reasoning: a disambiguating suffix keyed to
   something that could shift between runs would be worse than the bug) ->
   reversed back to "both survive" once it was pointed out that
   skip-and-continue means Lee-Ann's second file silently gets NO history
   at all until a human reads a stderr line and renames something in
   Drive -- exactly the silent-drop failure mode this project has been
   burned by before. @dev's fileId-derived suffix answers the original
   path-stability objection without reintroducing the silent drop: the
   suffix is deterministic and never shifts on a later run, even if the
   other file is later deleted.

2. **Freed-slot reuse (runs 9a/9b/9c,
   `drive_world_run9{a,b,c}_freed_slot_*.json`).** A file is renamed/moved
   away, then a NEW file (`fileB`) takes over the name+path it vacated.
   Same final ruling as run8: `fileB` is disambiguated and indexed/minted
   (not skipped) at a location distinct from `fileA`'s frozen plain path,
   `fileA`'s original manifest stays byte-identical, an unrelated `fileC`
   (added to run9c) elsewhere in the same run still syncs, and the run
   exits 0. Distinct from run8: this is a cross-run collision (the vacated
   slot is only reused in a later sync), not a same-run one.

3. **Content stability, not just path stability (runs 2 and 3 extended).**
   `snapshot_version_bytes()` / `assert_bytes_unchanged()` byte-compare
   every file inside existing version directories across a run, not just
   the SET of manifest paths. A wrong implementation that re-mints into the
   same version label on every run (re-downloading bytes, rewriting
   `exported_at`) would pass the old path-only comparison but fails this.

4. **`modified_time` provenance on a metadata-only touch (run3 extended).**
   Explicitly asserts `index.json`'s `fileA.modified_time` advances to the
   new Drive `modifiedTime` even though no version is minted. A wrong
   implementation that only updates `modified_time` alongside a version
   bump would pass "no spurious version" while silently losing provenance
   of when a rename/comment/permission touch was actually observed.

5. **Partial failure (new run10, `drive_world_run10_partial_failure.json`).**
   Two files; the first mints cleanly, the second's `gws get` fails
   (`fake_gws_stub.py`'s new `fail_get` world-node flag). Asserts the first
   file's index entry survives the run and the run's own failure is a clean
   message, not a raw traceback. A wrong implementation that only calls
   `save_index()` once at the end of the whole run loses every
   already-successful file's provenance the moment a later file fails.

6. **Corrupt index (new run11, reuses `drive_world_run1_initial.json`).**
   `index.json` is truncated on disk mid-run, then the tool is re-run.
   Asserts a non-zero exit with a clean, actionable stderr message and no
   raw `Traceback (most recent call last)` / `json.JSONDecodeError` leak. A
   wrong implementation that lets `json.load()` raise straight out of
   `main()` would technically "fail" but hands an operator a stack trace
   instead of a diagnosis.

7. **Readonly guard widened (`verify_drive_docx_sync_readonly.py`).** The
   original guard only matched a write verb spelled out as a literal
   substring. `check_argv_construction()` now resolves each
   `subprocess.run/call/Popen(...)` call's actual argv-building expression
   (inline list literal, or the nearest prior assignment) and separately
   flags: `.format()`, old-style `%` formatting, string concatenation, or
   an `os.environ`/config-sourced value feeding the argv; and requires
   every argv element in subcommand position (before the first
   `-`-prefixed flag literal) to itself be a string literal, never an
   identifier. Verified against 6 hand-built mutants (`.format()`-built
   verb, `%`-built verb, `+`-concatenated verb, bare-variable verb,
   `os.environ`-sourced params, and the current script's own legitimate
   style) -- the 5 unsafe ones are all caught, the legitimate one stays
   clean. The current script is clean against this widened check too; this
   closes a latent hole in the guard's own coverage, it does not report a
   live defect.

8. **Pagination (new run12, `drive_world_run12_pagination.json`, and
   `fake_gws_stub.py`'s new `--page-all` handling).** The stub now pages
   folder listings at `PAGE_SIZE = 2` unless `--page-all` is present in the
   argv, mirroring what the real flag promises. A 5-file folder proves the
   product code's `--page-all` usage is load-bearing, not decorative -- a
   wrong implementation that dropped the flag, or only read the first
   `nextPageToken`-bearing page, would silently miss files in any real
   Drive folder larger than one page.

9. **Path traversal (new run13, `drive_world_run13_path_traversal.json`).**
   Added after Codex found that Drive-controlled folder/file names are
   used directly as filesystem path components at
   `drive_docx_sync.py:273`, so a folder named `..`, or a name containing a
   path separator, could escape `store_root` on join -- Drive permits both
   in a name and this folder is shared and hand-edited by Lee-Ann, so it is
   untrusted input. Same skip-and-continue shape as runs 8/9: a folder
   named `..` and a file named `Evil/Name.docx` must both be rejected (no
   index entry, no manifest, no literal `..` path component ever written
   under `store_root`, no new sibling entry appearing alongside
   `store_root` itself), the run must continue and exit non-zero, and --
   the negative control that matters most here -- the legitimate `SAOC `
   folder (the real tree's actual trailing-space name) must keep syncing
   normally. An over-eager sanitiser that rejects any unusual-but-valid
   name would break Lee-Ann's real tree silently; only a fixture asserting
   the legitimate name still works catches that. Confirmed green against
   the shipped `UnsafePathComponentError` rejection (`. `, `..`, path
   separators, and NUL are rejected at the boundary; everything else,
   including the trailing-space folder name, passes through unchanged).

For each of the 9 items above: the paired "what a wrong implementation
would still pass" is stated inline in the check's own `fail()`/finding
message, per this project's standing rule that a discriminator assertion
isn't finished until you can name the implementation it would otherwise
let through.

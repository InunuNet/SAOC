# Golden — where recovered Drive content lands (M1)

## The problem

Four council documents exist only in the session sandbox
`.tmp/sandbox/nos-ia/`, because `execution/drive_docx_sync.py` could not produce them:

| sandbox file | spec page | why the sync tool skipped or failed |
|---|---|---|
| `13.1-ticketing.md` | 13 Booking / Tickets | Drive folder name is `13. Registration/Booking/Tickets` — the embedded `/` makes it an unsafe name, and the sync tool rejects names containing a path separator at the boundary (CLAUDE.md, drive-docx-version-export) |
| `13.2-vendor-form.md` | 13 (vendor form) | same folder |
| `6-symposium-theme.md` | 6 SAOC Symposium | same collection pass |
| `17.1-faq-RECOVERED.md` | 17 FAQ | the `.docx` in Drive is itself truncated — its zip central directory is missing. Our download is byte-perfect against Drive's md5 `27f4911dc51dfada43b242104b627c0e`, so this is Lee-Ann's file that is broken, not our copy. Text was salvaged by hand from the intact local zip headers. |

`.tmp/` is gitignored. On the next clean checkout all four are gone, and page 13's real
ticket structure, the show theme and the only two FAQ answers in existence go with them.

## The decision

Land them in a new committed tree, **`content/drive-recovered/`**, a sibling of
`content/drive-source/` that the sync tool never writes to.

```
content/drive-recovered/
  13-booking-tickets/
    ticketing/           content.md   recovery.json
    vendor-form/         content.md   recovery.json
  06-saoc-symposium/
    theme/               content.md   recovery.json
  17-faq/
    faq/                 content.md   recovery.json
```

**Why a sibling tree and not `content/drive-source/`.** `drive_docx_sync.py` owns
`content/drive-source/` outright: it version-bumps on Drive's `md5Checksum`, rewrites
`content.md`, `manifest.json` and `index.json`, and flips entries to `status: missing`
when a file leaves Drive. Hand-salvaged text placed in that tree is either overwritten by
the next sync or — worse for the FAQ — permanently re-broken, because the sync will keep
re-deriving `content.md` from a `.docx` that cannot be unzipped and will keep writing its
error string there. A sibling tree needs zero changes to the sync tool, and
`execution/` is harness-owned and must not be edited anyway (`.claude/rules/athanor.md`).

**Why not just fix the names in Drive.** That is the right long-term fix and it belongs to
Lee-Ann, not to us — renaming a folder in someone else's Drive is an outward-facing change
we have no mandate for. M5 raises it with her. Until then the recovery tree is what keeps
the content alive.

## `recovery.json` — required, one per recovered document

```
{
  "specPage": 13,
  "sourceDrivePath": "National Show/13. Registration/Booking/Tickets/13.1 .../source.docx",
  "sourceMd5": "27f4911dc51dfada43b242104b627c0e",
  "method": "manual-salvage-from-zip-headers",
  "recoveredAt": "2026-09-09",
  "recoveredBy": "athanor:national-show-ia-alignment",
  "supersededBy": null,
  "note": "Drive .docx is truncated; central directory missing. Verified byte-perfect against Drive md5, so the breakage is upstream."
}
```

`method` is one of `manual-salvage-from-zip-headers`, `manual-docx-extract`,
`unsafe-drive-path-workaround`. `sourceMd5` is the load-bearing field: it is the md5 of
the Drive `.docx` this text was salvaged from.

## Interaction with a future `drive_docx_sync.py` run

Three rules, none of which require touching the sync tool:

1. **The sync tool never reads or writes `content/drive-recovered/`.** Provable today by
   grep (assertion A11) — the string does not appear in `execution/drive_docx_sync.py`.
   If a future harness update adds it, that assertion fails and we find out.
2. **A recovery entry is superseded, never silently shadowed.** When a later sync produces
   real content for the same Drive file, its `manifest.json` will carry an md5 that differs
   from the recovery entry's `sourceMd5`. `scripts/checks/verify-drive-recovery.mjs`
   reports every recovery entry whose `sourceMd5` no longer matches the corresponding
   `content/drive-source/` manifest, so a stale hand-salvage cannot quietly outlive the
   real file. Resolving a superseded entry — repointing `sourcePath` at the real
   `drive-source` path and setting `supersededBy` — is a deliberate human step, not an
   automatic overwrite.
3. **Precedence when both exist.** `content/drive-source/` wins. A seed source may name a
   `drive-recovered` path only while no `drive-source` equivalent exists.

## Raw bytes

The `.docx` originals stay out of git, matching how `drive-source` already treats
`source.docx`. `.gitignore` gains `content/drive-recovered/**/*.docx`. The `content.md`
and `recovery.json` files are tracked — they are the durable artefact.

Copying the four `.docx` files from the sandbox into the recovery tree is optional and
they will be ignored; the salvaged text is what matters. **The sandbox files themselves
are never deleted** (`.claude/rules/sandbox.md`).

## What lands where — exact mapping for @dev

| from `.tmp/sandbox/nos-ia/` | to `content/drive-recovered/` | specPage | method |
|---|---|---|---|
| `13.1-ticketing.md` | `13-booking-tickets/ticketing/content.md` | 13 | `unsafe-drive-path-workaround` |
| `13.2-vendor-form.md` | `13-booking-tickets/vendor-form/content.md` | 13 | `unsafe-drive-path-workaround` |
| `6-symposium-theme.md` | `06-saoc-symposium/theme/content.md` | 6 | `unsafe-drive-path-workaround` |
| `17.1-faq-RECOVERED.md` | `17-faq/faq/content.md` | 17 | `manual-salvage-from-zip-headers` |

Copy the text **verbatim**, including the salvage header comment at the top of the FAQ
file and its embedded WordprocessingML noise. Do not clean it up: the noise is evidence
that the source is broken, and cleaning it would make a truncated file look whole.
`.claude/rules/behavior.md` — do not modify user content.

## Two facts that must survive intact

Both come from these recovered files and must be preserved verbatim wherever they are
reused:

- **Venue:** Stellenbosch Flying Club, R44 northbound to Stellenbosch. (`17-faq`, Q2 — the
  only council-written statement of the venue we hold.)
- **Theme:** "From Wild Origins to Cultivated Excellence: The Future of Orchids"
  (`06-saoc-symposium/theme`, and repeated in the page-2 About copy already in
  `content/drive-source/`.)

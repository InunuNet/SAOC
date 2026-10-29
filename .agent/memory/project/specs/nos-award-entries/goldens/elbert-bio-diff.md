# Elbert Wijaya bio: Drive re-sync result (2026-10-28, read-only)

Run: `python3 execution/drive_docx_sync.py` in the worktree (needed the python 3.14 interpreter that has markitdown: `/opt/homebrew/opt/python@3.14/bin/python3.14 execution/drive_docx_sync.py`; the default `python3` fails with "markitdown not installed" and nothing is installed here). The sync also prints "skipping folder" for Drive folders whose names contain "/" ("Privacy/Terms", "13. Registration/Booking/Tickets") and exits 1; the Elbert file was fetched.

Source: `National Show/6. SAOC Symposium/Speakers/Elbert Wijaya/Biographical Information Elbert Wijaya.docx` (Drive id 19HtwoCBF21KaZx1ZiLbPAPwNMz0F3d10).

| | old (primary checkout store, exported 2026-10-25) | new (this sync) |
|---|---|---|
| Drive modifiedTime | 2026-10-24T18:36:57Z | 2026-10-25T17:19:39Z |
| md5Checksum | 2b761d9184d96021c1206dd6e89e92bb | 16b719178846b404e67f90d5a8d7976b |

Only paragraph 9 differs. Old:

> Among his interests are blue-flowered *Dendrobium* species and *Papilionanthe tricuspidata*, a species once thought to be extinct.

New (verbatim, including the missing space):

> Among his interests are *Dendrobium* azureumand *Papilionanthe tricuspidata*, a species once thought to be extinct.

The corrected plant name is "Dendrobium azureum"; the source text has the typo "azureumand" (no space before "and"). Do not silently fix it: Lee-Ann's text is quoted as she wrote it; raise it with her.

Where the site renders it: Sanity document `conferencePresenter-elbert-wijaya` (field `bio`), shown on the NOS symposium and international-guests pages via `lib/view-models/load-presenters.ts` / `presenter-order.ts`. The captured replay fixture (2026-10-26) still holds the old sentence. So it is Sanity-held and SAOC's to update (NOS Site never writes Sanity).

Committing the synced files: `content/drive-source/` is gitignored on origin/main (.gitignore:147), so nothing was committed. CLAUDE.md says `content.md`, `manifest.json` and `index.json` are tracked; that no longer matches the ignore rule, which is a discrepancy for the lead to rule on.

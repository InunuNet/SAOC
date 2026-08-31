# Lee-Ann Source Document Mirror

Lee-Ann's source documents live in her Google Drive, not in this repo. Drive files can be
renamed, replaced, or superseded silently — there is no local trail of what an agent actually
read when a feature was built, and no way to `git diff` her content over time. That gap caused
real confusion on 2026-08-25: the live vendor registration form was built against an older Drive
doc, and a *different*, much more detailed doc had since been added to a different Drive folder.
Nobody had a local record of either version to compare against.

**Convention, effective 2026-08-25:** whenever an agent reads one of Lee-Ann's source documents
(Drive Docs/Sheets/Word files) to inform a build task, save a full-text snapshot here, dated by
the day it was pulled, so future changes are diffable through normal git history.

## How to add a snapshot

1. Fetch the file via the `gws` CLI (Drive binary files need `drive files get --params
   '{"fileId":"<id>","alt":"media"}' --output <path>`; native Google Docs can be read directly
   with `gws docs get`). Convert non-text formats (`.docx` etc.) to plain text/markdown — never
   commit a binary copy, it has to be diffable.
2. Save it as `docs/leeann-source/<slug>_<YYYY-MM-DD>.md`, where `<slug>` is a short
   kebab-case name for the document and the date is the day it was pulled (not the file's
   Drive-reported modified date — record both, see header format below).
3. Give the snapshot a header with: the exact source Drive filename, its Drive file ID, its
   `webViewLink`, its Drive-reported `modifiedTime`, and the date this snapshot was pulled.
4. Do not delete superseded snapshots. If a document changes, add a new dated snapshot — the
   git history of this directory plus each file's own timestamp is the change record.

## Snapshot header format

```markdown
---
source_filename: <exact Drive filename>
source_file_id: <Drive file ID>
source_link: <webViewLink>
source_modified_time: <Drive-reported modifiedTime, ISO 8601>
snapshot_pulled: <YYYY-MM-DD>
---
```

## Index

| Snapshot | Source Drive filename | Source Drive folder | Source modified | Pulled |
|---|---|---|---|---|
| [`south-african-exhibitors_2026-08-25.md`](south-african-exhibitors_2026-08-25.md) | `South African Exhibitors.docx` | `2027 Information to be added to website` | 2026-07-11 | 2026-08-25 |
| [`2027-vendor-registration-form_2026-08-25.md`](2027-vendor-registration-form_2026-08-25.md) **SUPERSEDED** | `2027_SAOC_National_Show_Vendor_Registration_Form.docx` | `Docs for Brad` | 2026-08-10 | 2026-08-25 |
| [`2027-vendor-registration-form_2026-08-26.md`](2027-vendor-registration-form_2026-08-26.md) **CANONICAL** | `2027_SAOC_National_Show_Vendor_Registration_Form.docx` | `Docs for Brad` | 2026-08-26 | 2026-08-26 |

**Note on these two:** `south-african-exhibitors_2026-08-25.md` and the vendor registration form
are two genuinely separate Drive files (different file IDs, different parent folders). The live
`/national-show/vendors/register` form (31 fields) matches the embedded 31-item form inside
`South African Exhibitors.docx` (the older, July file) almost verbatim.

**Same file, revised in place, 2026-08-26:** unlike the note above, the two vendor-registration-
form snapshots share ONE Drive file ID (`1tbA4GNbplWkW-4Pv3LPsdV5RT_ZdViBe`) — Lee-Ann replaced
the content of the same document rather than creating a new one. The 26 Aug snapshot is now the
canonical build reference; the 25 Aug snapshot is retained for history per this directory's
"never delete a superseded snapshot" rule but must not be used for new work. See the 26 Aug
snapshot's own header for the verified section-by-section delta between the two.

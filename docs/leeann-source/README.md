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
| [`about-page_2026-09-06.md`](about-page_2026-09-06.md) | `About page - South African Orchid Council.docx` | `Docs for Brad/SAOC /2. About` | 2026-09-03 | 2026-09-06 |
| [`website-development-specification-v3_2026-09-06.md`](website-development-specification-v3_2026-09-06.md) | `1. Website Development SpecificationV3.docx` | `Docs for Brad/National Show` | 2026-09-03 | 2026-09-06 |
| [`about-national-show_2026-09-09.md`](about-national-show_2026-09-09.md) | `2.1 About - 2027 National Show.docx` | `Docs for Brad/National Show/2. About` | 2026-09-04 | 2026-09-09 |
| [`what-to-expect_2026-09-09.md`](what-to-expect_2026-09-09.md) | `3.1 Info - What to Expect.docx` | `Docs for Brad/National Show/3. What to expect` | 2026-09-04 | 2026-09-09 |
| [`symposium-theme_2026-09-09.md`](symposium-theme_2026-09-09.md) | `Symposium Theme ` | `Docs for Brad/National Show/6. SAOC Symposium` | 2026-09-04 | 2026-09-09 |
| [`ticketing-system-details_2026-09-09.md`](ticketing-system-details_2026-09-09.md) | `13.1 Ticketing system details.docx` | `Docs for Brad/National Show/13. Registration/Booking/Tickets` | 2026-09-03 | 2026-09-09 |
| [`show-contact-information_2026-09-09.md`](show-contact-information_2026-09-09.md) | `2027 Show Contact information.docx` | `Docs for Brad/National Show/18. Contact` | 2026-09-03 | 2026-09-09 |
| **BLOCKED** — `17.1 Frequently asked questions.docx` | `Docs for Brad/National Show/17. Frequently Asked Questions` | unknown | 2026-09-09 (attempted) |

**FAQ doc is truncated in Drive itself, confirmed unrecoverable on our side —
not a guess:** `17.1 Frequently asked questions.docx`
(`1soLx8vKPs1jQBnYFTu88_LWxjzRFTHsf`) is 23,731 bytes. Our downloaded copy's md5
matches Drive's own reported `md5Checksum` (`27f4911dc51dfada43b242104b627c0e`)
byte-for-byte, so the transfer is not the problem. The file has a valid
`PK\x03\x04` local-file-header magic number and 16 readable local file headers —
but the **End-of-Central-Directory (EOCD) record is absent**: the zip stream
ends mid central-directory, so no reader can extract it, no matter which tool is
used. This is consistent with every tool tried across five independent read
attempts failing the same way (`textutil`, Python `zipfile` —
`BadZipFile: File is not a zip file` — and `unzip`, across three separate
downloads on 2026-08-xx and 2026-09-09). Per `docs/rules/no-invention.md` and
this mission's brief: do not reconstruct or paraphrase its contents from
anything. The file is an incomplete write on Lee-Ann's end, not a local tooling
or re-download problem — she needs to re-save/re-export it, or supply it as a
native Google Doc instead of an uploaded `.docx` (see `f1-coverage-map.json`'s
`nos-17-faq` entry, openQuestion q5).

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

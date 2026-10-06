# p2-upstream-athanor-drive-docx-sync-py-s

**P2 — upstream (Athanor): `drive_docx_sync.py` silently loses a whole content folder to an
  unsafe Drive name.** On 2026-09-09 the sync skipped `13. Registration/Booking/Tickets` — the `/`
  in Lee-Ann's folder name is (correctly) rejected as a path component, so the folder *and both
  documents under it* were skipped: `13.1 Ticketing system details.docx` (the full booking model,
  ticket categories and prices) and `13.2 Vendor Form`. It also skipped `Symposium Theme`, a real
  `.docx` whose *name* simply lacks the extension, because the scope filter tests the name rather
  than the mimeType (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
  The containment check is right; losing the content is not. Proposed fix upstream: sanitise the
  folder name into a safe component (retaining the original in `manifest.json`) rather than
  skipping the subtree, and select `.docx` by mimeType with the name as fallback. We cannot rename
  the Drive folder — it is the client's. Recovered manually into `.tmp/sandbox/nos-ia/` for mission
  `national-show-ia-alignment`; that sandbox copy is **not** a durable source of truth.
  File against `InunuNet/Athanor`. Do NOT patch `execution/drive_docx_sync.py` in place (harness).

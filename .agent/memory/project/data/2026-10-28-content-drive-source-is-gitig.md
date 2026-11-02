# 2026-10-28-content-drive-source-is-gitig

2026-10-28 content/drive-source/ is gitignored on main (.gitignore:147) but CLAUDE.md says content.md/manifest.json/index.json are tracked — reconcile (decide which is true; fix the other). Also drive_docx_sync.py needs the python3.14 interpreter for markitdown and exits 1 on Drive folders with '/' in the name ("Privacy/Terms", "13. Registration/Booking/Tickets") — upstream harness bug filed earlier.

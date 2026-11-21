# 2026-11-13-ticket-pdf-copy-check-a8-in-s

(2026-11-13) ticket-pdf copy check (A8 in specs/xix-to-19th; `copy` in specs/ticket-pdf) fails on main: pdftotext splits the diagonal "Testing only, not live" watermark into single letters (t e s i n g o l y v), which the allowed-strings baseline flags. This is a fault in the check, not in the PDF. Fix: filter watermark tokens, or extract with the watermark layer excluded. — 2026-11-14: fixed in PR #186 (fix/pdf-watermark-check, d77fac90, Codex PASS; per-page budgeted filter of watermark letters), awaiting merge.

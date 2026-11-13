# Expected rendered strings (Brad: "Change XIX to 19th for now")
- lib/data/ticket-presentation.ts, Symposium and WOSA stubs: `numeral: '19th'` (was 'XIX')
- lib/ticket-pdf.ts: `const STUB_NUMERAL = '19th';`; comments at the stub block and STUB_DATE_ROOM say "19th", not "XIX"
- Caption "National Orchid Show" unchanged. Existing 19th labels (home band, hero, nav card) unchanged.
- No other rendered XIX in app/ components/ lib/ emails/. Design handoff, docs, specs untouched.

# PDF layout note (measured with Fraunces-Light at 44pt)
- XIX = 25.6mm, 19th = 27.6mm (+2.0mm). Mark is right-aligned at 102.3mm (PERFORATION_X 108.3 - 6), so its left edge moves 76.7 -> 74.7mm.
- Date column spans 22.9mm to 68.9mm (STUB_TEXT_X + STUB_DATE_ROOM). Gap 5.8mm, so no change to geometry is needed; keep STUB_DATE_ROOM at 46.
- If the font renders "19th" with a different measure, check_stub_geometry.mts fails below 3mm gap: then reduce STUB_DATE_ROOM, not the numeral size.
- Possible knock-on: contracts/checks/ticket-pdf `copy` check compares PDF words to allowed-strings.txt; "19th" may need adding there with provenance "Brad 2026-11-13 verbatim".

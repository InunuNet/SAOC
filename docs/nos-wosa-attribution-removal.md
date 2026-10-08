# NOS — WOSA attribution paragraph removed (2026-10-08)

`/national-show/about` and `/national-show/what-to-expect` each carried a bordered paragraph:
"SAOC focuses on orchids in cultivation. For wild orchid identification, habitat and
conservation, visit our partner organisation Wild Orchids of Southern Africa (WOSA)." It
linked to wildorchids.co.za.

That text is not in Lee-Ann's Drive copy (`content/drive-source/National Show/`). Under
[docs/rules/no-invention.md](rules/no-invention.md) and Brad's rule ("if its not in Lee-Anns
copy its not on the site"), it is removed, together with the JSX comment above it.

Kept unchanged: Lee-Ann's own WOSA sentences on both pages ("An important feature of the 2027
programme will be the participation of Wild Orchids of Southern Africa (WOSA)…" and
"Integrated throughout the symposium, presentations by Wild Orchids of Southern Africa
(WOSA)…").

Not touched: the footer WOSA link and nav (`components/chrome/**`, SAOC lead's lane), the home
page partner blocks, `/national-show/wosa-conference`.

Spec: `.agent/memory/project/specs/nos-wosa-attribution-removal/`.

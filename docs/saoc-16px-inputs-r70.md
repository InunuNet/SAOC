# SAOC — 16px text inputs (r70, 2026-10-22)

iOS Safari zooms the page when it focuses a text field whose font is smaller than 16px. Two SAOC fields
were below that (Codi P2, via saoc-82). r55 fixed the NOS forms inside `.nos-theme`; these two sit outside it.

| field | before | after | box |
|---|---|---|---|
| `/societies` search (`app/(marketing)/societies/SocietiesClient.tsx`) | 15px | 16px | 46.8px tall at 390 and 1280 |
| SAOC footer newsletter email (`components/chrome/Footer.tsx`) | 13px | 16px | 44px tall, unchanged |

The footer field keeps its visual size: its `min-h-11` (44px) already exceeds the 16px line plus its 8px
vertical padding, so the box does not grow and no padding change is needed. `/contact` was already 16px.
Measured with a production build in Chrome at 390 and 1280 (computed `font-size` and bounding-box height).

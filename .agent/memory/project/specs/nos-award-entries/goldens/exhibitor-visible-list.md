# Visible "exhibitor" list for NOS Design sign-off (NOS host, after the change)

Source of truth: `exhibitor-visible-list.json` (the gate reads it). Expectation: every remaining visible use is a stand-booker context; plant-entrant uses are gone, except the Sanity-held rows SAOC will change.

| fragment | where / what | status | ref |
|---|---|---|---|
| `display exhibitor` | Brad's Display Exhibitors term (also 'Display Exhibitor setup' in the setup answer) | stand | - |
| `retail vendor` | Brad's Retail Vendors term | stand | - |
| `exhibitors and vendors` | /vendors title, header leaf and show index label, sponsors card; unchanged until Lee-Ann answers AE-1 (a)(c) | stand | D4 |
| `international guests and exhibitors` | International guests page title and menu (stand and display exhibitors from abroad) | stand | - |
| `exhibitors, vendors and sponsors` | FAQ category title (Lee-Ann's stand questions) | stand | - |
| `south african exhibitors` | Pavilion name in Lee-Ann's /vendors copy | stand | - |
| `commercial exhibitors` | Lee-Ann's /vendors intro | stand | - |
| `exhibitors will present stunning displays` | Lee-Ann's /vendors paragraph (mentions national awards) | stand | D6 |
| `list of exhibitors and vendors` | Vendor empty state | stand | - |
| `growers, exhibitors, vendors and enthusiasts` | FAQ q1 general description (Sanity) | stand | - |
| `international exhibitors and vendors` | FAQ q8 (Sanity) | stand | - |
| `guests and exhibitors, including international orchid vendors` | FAQ q8 answer (Sanity) | stand | - |
| `guests and exhibitors.` | FAQ q32 answer (Sanity) | stand | - |
| `as an exhibitor, participating` | International presenter bio (Sanity) | stand | - |
| `exhibitors took part` | Archive year statistic; unknown which kind (D7); archive withheld in public | decision | D7 |
| `exhibitors` | Archive fact label 'Exhibitors' (D7) | decision | D7 |
| `outstanding orchids and exhibitors` | FAQ q25 answer in Sanity; SAOC to apply S1 (new text: "recognising outstanding orchids.") | pendingSaoc | S1 |
| `when can exhibitors set up` | FAQ q28 question in Sanity; SAOC to apply S2 | pendingSaoc | S2 |
| `specific exhibitor setup` | FAQ q28 answer in Sanity; SAOC to apply S2 | pendingSaoc | S2 |
| `exhibitor stages` | ticketsPage.ticketIncludesNote in Sanity; SAOC to rule (D9) | pendingSaoc | S7 |
| `speakers, judges, exhibitors and researchers` | /international-guests intro: "Profiles of international speakers, judges, exhibitors and researchers attending the Show." (class b, stand) | stand | - |
| `award-winning exhibitors` | /vendors, Lee-Ann's copy (vendors/page.tsx:36): stand-bookers who have won awards (class b, stand). Also raised to Lee-Ann under vvvvv. | stand | vvvvv |

Removed from the NOS host by this change (plant entrants): page title/h1/breadcrumb/menu/footer "Plant Entry/Registration", "More for exhibitors" (aria-label), "recognising outstanding orchids and exhibitors" (page copy), and the SAOC-host home band CTA "Exhibitor info".

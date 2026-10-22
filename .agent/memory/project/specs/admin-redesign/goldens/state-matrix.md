# State matrix (golden) — every page has empty, loading, error (ruling b)

Loading: Next `loading.tsx` per route under app/admin/(shell)/ rendering a skeleton (bone blocks, no spinner-only), `aria-busy="true"`. Error: `error.tsx` per route (client) with role="alert", plain message, "Try again" button calling reset(). Empty: in-component message with the next step. Copy: reuse existing strings where they exist; otherwise NO new strings beyond those quoted in the ruling, so use neutral reuse: empty text "No <items> yet." is NOT in the ruling — dev must reuse existing empty-state strings from the current tables (grep "No " in components/admin/*Table.tsx) and, where none exists, report the gap to team-lead rather than invent.

| route | loading.tsx | error.tsx | empty |
|---|---|---|---|
| /admin | yes (stat-card + panel skeleton) | yes | per-panel: "Needs attention" empty reuses nothing new — render the panel heading with no rows |
| /admin/tickets | yes (toolbar + 8 skeleton rows) | yes | existing TicketsTable empty text |
| /admin/door | yes | yes | n/a (scanner); camera-denied state keeps existing DoorScannerClient copy |
| /admin/vendors | yes | yes | existing VendorReviewTable empty text |
| /admin/vendors/applications | yes | yes | existing VendorApplicationReviewTable empty text |
| /admin/settings | yes | yes | n/a |
| /admin/login | n/a | n/a | n/a |

Filtered-to-zero (search/filter matches nothing) is a distinct state: reuse the table's existing empty text.
Sidebar pending badge: hidden when 0; if the count query fails, hide the badge (never block the shell).

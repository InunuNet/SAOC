# Event row golden (EV-4)

Source of truth: `design/design_handoff_saoc/src/pages-show-events-contact.jsx`, `EventsPage`, the `.event-row` block (lines 383-407), styled by `design/design_handoff_saoc/src/styles.css` `.event-row*` (lines 924-1003). Ruling: `nos-design-ruling-ev.md` EV-4. Governing rule: `docs/rules/no-invention.md` (no new copy, no new tokens).

| golden element | handoff | /events row (ruling) |
|---|---|---|
| grid | `110px 1fr auto auto`, gap 28, padding 22px 0, bottom rule | same columns; whole row is ONE `<Link>` to `/events/[slug]` when a detail page exists, `min-height: 44px` |
| date block | `event-row__d` day (serif 36), `__m` MON (mono 11, uppercase), `__y` year (mono 10.5), `border-left: 2px accent` | `eventDateBlock()` (lib/events-list.ts): d = day or `23–26` range, m = `NOV`, y = year; SAST calendar. The 2px left accent is the date block's border (rest state) |
| eyebrow | `event-row__kind` = `kind · province` (mono 10.5, accent) | same, `kind · province`; omit the middle dot and the missing half when one is absent |
| title | `event-row__title` serif 22 / 600 | serif title; underline on `group-hover` and `group-focus-visible` |
| venue | `event-row__venue` 13.5 muted | same |
| host | `event-row__host` mono 11, right-aligned, max 200 | `hostSociety.name`, `text-right`; plain text inside the link |
| arrow | `→` | `→`, decorative (`aria-hidden`) |
| hover | handoff pads + bg tint | **Ruling overrides the handoff here:** title underline + a 2px left accent bar. No box, no ring, no background tint (NAV-1 family). |

Month label: a real `<h2>`, serif, `text-[24px]`, weight 400 (`font-normal`), not the 12px mono label (ruling EV-4).

A row without a slug, and every AI placeholder row, renders unlinked (existing EventCard behaviour) with the existing `PlaceholderMarker` label; preview only.

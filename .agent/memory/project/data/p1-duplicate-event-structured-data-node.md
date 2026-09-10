# p1-duplicate-event-structured-data-node

**[P1] Duplicate `Event` structured-data node for the 2027 National Show.**
  `/events/19th-south-african-national-orchid-show` emits a second schema.org `Event` for the
  SAME real-world show as `/national-show` — identical name, dates and venue, different URL.
  Duplicate-entity cannibalisation in search. Origin is the generic society-event route driven
  by a Sanity `societyEvent` document. Found 2026-09-08 by the NOS design session during its SEO
  work and filed as InunuNet/SAOC#2 with three candidate directions. **Do NOT delete the Sanity
  document without first checking what else reads it** — the events calendar and .ics feeds may
  depend on it. Our tree (`app/(marketing)/events/**`), not the NOS session's.

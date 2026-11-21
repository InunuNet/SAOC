# p2-2026-11-08-nos-design-at-1-final-comp

P2 (2026-11-08, NOS Design AT-1, final) components/tickets/CartAttendeeFields.tsx:55-80: each attendee row becomes a fieldset whose legend is the existing "Attendee {n} — {type}" line (same styling); row 0 keeps name/email autocomplete, rows 1+ autoComplete="off". Queued after the LT-3 header branch (one build at a time). — 2026-11-08 built: fix/a11y-attendees-mobile-menu 040b8bd1 (3 fieldsets named "Attendee n — <type>", rows 1+ autocomplete off, legend box identical to the old p, 360px AA diff at 390).

# Polish wave F6: submit an event

## Change
- The free-text "Host society ID (optional - Sanity document ID)" field is now a "Host society (optional)" select. Options are
  the listed societies by name (`societyListQuery`, already ordered by name); the option value is the society id, so the
  submitted `hostSocietyId` field and POST /api/events are unchanged. No label or option mentions an id or the CMS.
- `components/events/SubmitEventPageBody.tsx` renders `PageHero` plus the form on the /contact pattern: mono labels,
  44px controls, `--muted` field boundary, shared `TicketFieldAlert` errors, and the same accent-token submit as /contact at 44px.
- The "Members only" prompt is untouched.

## Fixture route
The page needs a Firebase session, so rendered checks use `app/events-fixtures/submit/page.tsx`: force-dynamic, 404 unless
`EVENT_SUBMIT_FIXTURES=1` at request time, three static societies, no auth bypass. The flag is set by the check only and
is in no deploy or example env file.

## Limits
The authenticated page itself, and the real society list, are covered by the static check only.

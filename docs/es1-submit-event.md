# ES-1 — /events/submit Members-only gate

NOS Design ruling ES-1 asked for `/events/submit` to move off stock Tailwind grey onto the
ContactForm field and gold CTA classes.

## What was already on-system

Read against base `823e6b09`, most of the ruling was already done:

- `components/events/SubmitEventForm.tsx`: the label and submit classes equal ContactForm's, the
  input class is ContactForm's plus `min-h-11`.
- The host society field is a `<select name="hostSocietyId">` labelled "Host society (optional)".
  Options carry the society id as `value` and the name as text, fed by `societyListQuery`.
  The POST goes to `/api/events/submit` and the payload field `hostSocietyId` carries the id.
- The authenticated body is `PageHero` plus the form (`SubmitEventPageBody`).

## What changed

`LoginPrompt` in `app/(marketing)/events/submit/page.tsx` was the only off-system surface, and
it is what every visitor without a session sees. It is now a `PageHero`:

- image `/images/orchid-purple.jpg` and eyebrow "Events", as `SubmitEventPageBody` uses
- heading "Members only"
- lede "Event submission is available to SAOC members."
- one action, a `Link` to `/contact` reading "Contact us about membership", with ContactForm's
  submit button classes plus `mt-8`

All strings are the ones the page already had. The h1 comes from `PageHero`. The authenticated
branch, `isAuthenticated`, the society query and `metadata` are unchanged.

## Frozen

`SubmitEventForm.tsx`, `SubmitEventPageBody.tsx`, the fixture route, `lib/fixture-route-guard.ts`
and `app/api/events/**` are byte-identical to the base (`es1-frozen.mjs`).

## Gate

Checks live in `contracts/checks/es1-submit-event/`. The rendered check measures the
unauthenticated LoginPrompt on the real `/events/submit`, and the authenticated body on the
fixture route `/events-fixtures/submit` (enabled by `EVENT_SUBMIT_FIXTURES=1`, hosted-runtime
guarded, 404 without the flag).

## Limits

The POST needs a Firebase session, so the network call is not exercised; the rendered check
confirms `FormData` carries `hostSocietyId=<id>`. Computed-style equality is measured at rest.

# ES-1 — /events/submit off-system styling (NOS Design ruling ES-1, P2 with a P1 inside)

## What the tree actually contains (read at base 823e6b09, PR #98 stack)
The ruling describes stock Tailwind grey on both files. Most of that was fixed earlier in the stack:
- components/events/SubmitEventForm.tsx: LABEL_CLASS and SUBMIT_CLASS are byte-equal to ContactForm's labelClass and submit button className, INPUT_CLASS is ContactForm's inputClass plus `min-h-11` (wave 1 F6, commits ebd9b545, 9bf36b69).
- The P1 is already fixed: the field is `<select id="hostSocietyId" name="hostSocietyId">`, label "Host society (optional)", options `value=s.id` text `s.name`, fed by `societyListQuery` (sanity/queries.ts:11, `listed != false`, name order, the same query /societies uses).
- The authenticated body is PageHero (serif h1) plus the form (SubmitEventPageBody.tsx). Wave 2 F7 (95c99620) restyled the success panel.
- NOT fixed, and live at /events/submit for every visitor without a session: `LoginPrompt` in app/(marketing)/events/submit/page.tsx
  (`<h1 className="text-2xl font-semibold mb-3">`, `text-gray-600`, `text-gray-900`, bare underlined `<a>`). This is the only off-system surface left, and the only page most people see.

So ES-1 reduces to: bring LoginPrompt onto the same anatomy as the authenticated page, and add the gate the ruling asks for around both states.

## Specification (what @dev implements)
Edit `app/(marketing)/events/submit/page.tsx` only (optionally extract LoginPrompt to components/events/SubmitEventLoginPrompt.tsx, allowed in scope.json).
LoginPrompt returns:
```
<PageHero
  image="/images/orchid-purple.jpg"          // same image SubmitEventPageBody uses
  eyebrow="Events"                           // same eyebrow SubmitEventPageBody uses
  heading="Members only"                     // existing copy
  lede="Event submission is available to SAOC members."   // existing copy, byte for byte
  actions={<Link href="/contact" className="mt-8 <ContactForm submit button classes>">Contact us about membership</Link>}  // existing copy
/>
```
- The h1 therefore comes from PageHero (Crimson Pro 300, the serif token, identical to /contact and to the authenticated page). Do not hand-write an h1.
- Precedent for a gold CTA in hero `actions`: app/(marketing)/sponsors/page.tsx:60. The class string is NOT that one; it is ContactForm's submit button className (components/contact/ContactForm.tsx, the `<button type="submit"` className) verbatim, with `mt-8` prepended as the one layout token. The ruling says "same field and gold CTA classes" as ContactForm.
- Use next/link `Link` for the internal route (the current bare `<a>` is also acceptable to the check, which accepts a or Link).
- No new copy. The three strings above are the existing LoginPrompt strings; the eyebrow "Events" is the one SubmitEventPageBody already renders. No other text, no icon, no heading, no invented colour.
- Delete every `gray-*`, `text-2xl`, `font-semibold` from the file. Do not touch the authenticated branch, `isAuthenticated`, the societies query, or `metadata`.

## Frozen (checked byte-identical to the base by es1-frozen.mjs)
components/events/SubmitEventForm.tsx (includes the F7 success panel and the payload), components/events/SubmitEventPageBody.tsx, app/events-fixtures/submit/page.tsx, lib/fixture-route-guard.ts, app/api/events/**.
The POST path is `/api/events/submit` (the ruling wrote /api/events; the tree is `app/api/events/submit`), payload field `hostSocietyId` carries the society id.

## Gate (ruling) and where it is checked
| ruling gate | check |
|---|---|
| no "Sanity" string in the rendered page | es1-rendered.mjs sweep: visible text, labels, options, placeholders, aria-label/title, both states |
| submit button classes equal ContactForm's | es1-static.mjs (token-set equality of SUBMIT_CLASS and of the LoginPrompt CTA) and es1-rendered.mjs (computed-style equality with /contact's submit) |
| no horizontal scroll at 390 | es1-rendered.mjs: max(documentElement, body).scrollWidth - innerWidth <= 0 at 390@3 and 1280@1, both states |
| labels visible and associated | es1-rendered.mjs: every control in the form has `control.labels[0]` text, every label visible, label family/size/tracking/transform equal /contact's |
| serif h1 | es1-rendered.mjs: h1 family and weight equal /contact's and match /Crimson/ |

## Rendered surfaces
- Authenticated body: the existing fixture `/events-fixtures/submit` (EVENT_SUBMIT_FIXTURES=1, hosted-runtime guarded). The fixture already holds three static societies, so it needs NO extension and stays frozen.
- LoginPrompt: the real `/events/submit` on a flagless server. With no session cookie `isAuthenticated()` returns false before any firebase-admin or Sanity call, so it needs no fixture and no stub.

## Limits
- The POST needs a Firebase session, so "the select posts the id" is gated as: static payload assignment unchanged, plus the rendered form's `FormData` carries `hostSocietyId=<id>` after choosing a name. The network call itself is not exercised.
- The society list on the deployed page is live Sanity data; the fixture proves the mapping, not the live list.
- Computed-style equality is measured at rest (no hover/focus).

## Docs
docs/es1-submit-event.md: names ES-1, records the stale-ruling finding (what was already on-system and why), the LoginPrompt change, and the fixture-route gate.

# F6 — /events/submit (SF-1, SF-2). Same dev as F1: SubmitEventForm.tsx is shared.

The authenticated page cannot be reached without a Firebase session (the page shows only a login prompt otherwise), so rendered gating uses
an env-gated fixture route, following the existing precedent app/admin-fixtures/[route]/page.tsx (force-dynamic, 404 unless a request-time env
flag is set, flag never in apphosting.yaml or .env.local.example, no auth bypass anywhere).

## Specification
1. components/events/SubmitEventPageBody.tsx (new, server component): `({ societies }: { societies: ReadonlyArray<{ id: string; name: string }> })`
   renders `<PageHero image="/images/orchid-yellow.jpg" eyebrow="Events" heading="Submit an event" lede="Your submission will be reviewed by the council before it appears on the site." />`
   and then a `saoc-container` section holding `<SubmitEventForm societies={societies} />`. Every string is already on the page today or is the
   existing nav word "Events" (no new copy). Image: the same one /events uses for its hero; read app/(marketing)/events/page.tsx and reuse its path
   if it differs. Do not touch the "Members only" LoginPrompt branch.
2. app/(marketing)/events/submit/page.tsx: after the isAuthenticated() check, load societies with the existing `societyListQuery`
   (sanity/queries.ts:11, already ordered by name; map `{ id: _id, name }`; tags ['societies', 'sanity']) and render `<SubmitEventPageBody societies={...} />`.
   Remove the gray Tailwind-default markup (`text-2xl font-semibold`, `text-gray-*`).
3. SF-1. In SubmitEventForm.tsx replace the free-text hostSocietyId input and its label "Host society ID (optional — Sanity document ID)" with
   `<label htmlFor="hostSocietyId">Host society <span>(optional)</span></label>` and a `<select id="hostSocietyId" name="hostSocietyId">`: first option
   `value=""` and the text "Select society…" (the same pattern as the Event type select's "Select type…"; microcopy that restates the field, not content),
   then `societies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)`.
   The submitted field name stays `hostSocietyId`, so POST /api/events is unchanged. No label, option or helper text may mention an id, Sanity or a document.
4. SF-2. Bring the form to the /contact pattern (components/contact/ContactForm.tsx:112-114, 285-290): labels use the same `labelClass`
   (font-mono 11px tracking-[0.16em] text-muted), fields the same input class (44px: py-2.5 and a line height that reaches >=44px, or min-h-11),
   the select and textarea included (replace the fixed `h-[39px]`), errors via the shared TicketFieldAlert as ContactForm does if that import is
   already used there, and the submit is `inline-flex min-h-11 ... bg-accent text-ink` with the same focus ring as ContactForm
   (focus-visible:ring-primary). "Primary token button": the SAOC primary CTA ("Join a society", components/chrome/Header.tsx:183) and ContactForm both use `bg-accent text-ink` (sand). This contract
   pins --accent for the submit (lead ruling 2026-10-25; ContactForm is unchanged). Keep every existing field, name, validation rule and message.
5. app/events-fixtures/submit/page.tsx (new): `export const dynamic = 'force-dynamic'`; `if (process.env.EVENT_SUBMIT_FIXTURES !== '1') notFound();` then
   `<SubmitEventPageBody societies={[three static fixture societies with id-shaped ids, e.g. { id: 'soc-7f3a2c', name: 'Fixture Orchid Society A' }, ...]} />`.
   Do not add the flag anywhere else.
6. This feature does not add method="post" or the hydration guard to SubmitEventForm; F1 does (same file, same dev, both land).
7. Docs: docs/polish-wave-f6-submit-event.md.

## Checks
f6-submit-static.mjs (prop, select, options, page and fixture wiring, flag absent from apphosting.yaml and .env.local.example, no gray styling) and
f6-submit-rendered.mjs (flagless server: fixture 404; flagged: at 4 viewports h1 family/weight equal /contact's Crimson Pro 300, page hero, labels match
/contact, every control >=44px, select options id-valued and sorted by name, no "Sanity"/"document ID" text, submit bg == --primary and >=44px, no overflow).

# ticket-design-studio: implementation spec (golden)

Base branch: `preview/local` (the per-type email code, `lib/ticket-email-copy.ts`,
`lib/ticket-type-email.ts`, `emails/TicketTypeConfirmation.tsx`, `scripts/generate-ticket-email-samples.ts`
are NOT on `main` or `chore/memory-wrap-2026-11-02`). Work in a worktree off `preview/local`.

## Real render path (one renderer)
- Email: `lib/ticket-type-email.ts buildTicketTypeEmail()` -> `emails/TicketTypeConfirmation.tsx` -> `emails/_shared/EmailShell.tsx` (reads module constant NOS_THEME), HTML via `render()` from `@react-email/components`. Used by `lib/confirmation-email.ts` (live send) and `scripts/generate-ticket-email-samples.ts`.
- Ticket PDF: `lib/ticket-pdf.ts buildTicketPdf()` (pdf-lib, explicit coordinates, constants at lines ~96-168). Used by `/api/tickets/pdf`, the email attachment and the sample generator.

## Design object
`lib/ticket-design/` (new):
- `tokens.ts`: name -> hex map. ONLY the hexes in goldens/token-allowlist.json. Step tables: typeStep sm/md/lg -> email body px 14/16/18 (`--body-sm/md/lg` in design/design_handoff_saoc/colors_and_type.css) and PDF scale 0.875/1/1.125; density compact/standard/relaxed -> multiplier 0.75/1/1.25 over the existing spacing constants (handoff `--space-*` steps).
- `schema.ts`: `ShippedDesign` type + `validateDesign(unknown)`; closed enums exactly as goldens/design-schema.json; throws on any other key or value.
- `settings/<slug>.json`: one committed file per ticket type, shape as goldens/vip.default.json. `index.ts` exports `DEFAULT_DESIGN` (the values that reproduce today's look) and `loadShippedDesign(slug)` (static imports, validated at module load).
- `buildTicketTypeEmail({ ..., design? })` and `buildTicketPdf(input, design?)`: omitted design = `loadShippedDesign(slug)`; the defaults must reproduce today's output byte-for-byte (checks/parity.mts). EmailShell takes a `theme` prop (its own comment says to reintroduce a prop, not context) derived from the design.

## Controls (all closed enums; nothing free-form)
Shared: accent (royal, purple-700, olive-700), headerGround (royal, purple-700), typeStep, density, footerMark.
Email only: outerGround, cardGround, headerAlign (left, centre of the existing lockup PNG), qrPx (160/200/240), cardPosition (after-intro, top).
PDF only: stubGround, ruleColour (olive, royal), qrMm (50/55/60).
Studio shows the WCAG contrast of accent on ground and refuses a combination under 4.5:1 (all current enum values pass).
Copy is READ-ONLY in the studio. A "Note for Lee-Ann" box per type is exported into the sample cover page; it never changes shipped copy.

## Studio surface
- Page `app/admin/(shell)/studio/page.tsx`: session gate via `getAdminSession()` (layout already redirects; page re-checks), `export const metadata = { robots: { index: false, follow: false } }`, 404 unless `process.env.TICKET_STUDIO_ENABLED === '1'` (never set in production apphosting.yaml).
- API under `app/api/admin/studio/`: `preview-email` (POST draft design -> HTML string, same builder, `render()`), `preview-pdf` (POST draft design -> application/pdf), `save` (POST -> validate, write `lib/ticket-design/settings/<slug>.json`; refuses when NODE_ENV is production), `export` (POST -> runs the sample generator for one type, writes into `samples/ticket-emails/`). Every handler: admin session, studio flag, `X-Robots-Tag: noindex`, `Cache-Control: private, no-store`.
- Preview: email in `<iframe srcdoc sandbox>`, PDF in `<object type="application/pdf">` from a blob URL, re-rendered 400 ms after the last change (debounced, latest request wins via AbortController). Sample data: the existing `scripts/ticket-email-sample-fixtures.ts` (import it; do not copy or edit it).
- Nothing in the studio sends mail or imports `lib/email.ts`, Resend or `sendConfirmationEmail`. `TICKET_TYPE_EMAILS_LIVE` stays false.

## Persistence rationale
Committed JSON: reviewable diff, one PR atomically carries Brad's settings and the template that reads them, no runtime store to drift, no Firestore read at send time. Dev (dev.saoc.co.za) is the only place the save button works.

## Out of scope
Fonts, new colours, new layouts, copy edits, prod availability, any send.

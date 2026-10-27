# NOS contact page

Mission `nos-contact`, M1/F1 (NOS Design rulings CT1 to CT6; Brad: "its own page, its own branding"). The National Orchid Show serves its own `/contact` on the NOS host. SAOC `/contact` (`app/(marketing)/contact/page.tsx`) is unchanged.

## Route and links

- `proxy.ts` no longer lists `/contact` in `SAOC_ONLY_EXACT`, so the NOS host rewrites `/contact` to the internal `app/(nos)/national-show/contact/page.tsx`, like every other NOS inner page. The SAOC host still redirects `/national-show/**` to the NOS origin.
- `NOS_CONTACT_PATH` (`lib/nos-paths.ts`) is the internal route. `NosFrame` passes `contactHref={nosPath(NOS_CONTACT_PATH)}` (`/contact`) to `NosHeader`, which renders `<Link>` in the desktop row and the mobile drawer. `NosFooter` adds Contact as the last item of the Explore column, after FAQ.
- The "Ask the council" buttons (`saocUrl('/contact')` on faq, archive, exhibitors, plan-your-visit, vendors/payment and `ShowHoldingNote`) are the SAOC council by design and are unchanged. A relative `/contact` link inside a host-neutral component now resolves to the NOS page on the NOS host; that is accepted.

## Page

`NosHero` (route with no `HERO_PHOTOS` entry, so the typographic hero) and one `NosSection`. Two columns from 1024px (form column capped at 640px, aside right), one column below, form first in the DOM. The page sets `dynamic = 'force-dynamic'` because gap markers depend on `withholdPlaceholderProse()`, which reads env.

PageHero dependency: the split studio-panel hero (NH2), the S1b crop (NH3) and the FQ7 hero-to-body rhythm are not in `origin/main`; they live in the unmerged PageHero PR (`wip/split-hero-batch`). The page uses `NosHero` and `NosSection` only and inherits them when that PR lands. No hero variant, photo or `HERO_PHOTOS` entry is added here.

## Form

`ContactForm` gains `site?: 'saoc' | 'nos'` and `markPlaceholders?: boolean`. Labels, ids, placeholders, validation and the `TicketFieldAlert` errors are unchanged. It posts `{ name, email, subject, message }` only, never a site. The success heading now takes focus (both sites). There is no topic select. The NOS success body is a copy gap (G2).

## Aside

`components/contact/NosContactAside.tsx`: "Looking for something else?" and four rows (FAQ, Plan your visit, Exhibitor entry guide, Show sponsors) read from `NOS_NAV` leaves by id; hrefs `/faq`, `/plan-your-visit`, `/exhibitors`, `/sponsors#enquire`. Rows reuse the `.nos-index-group` rules; one scoped rule in `nos-structure.css` gives the arrow a 1px ring in `var(--accent)`.

## Site tag and senders

`POST /api/contact` derives `site` from the request host (`siteForHost`), never from the body. `lib/contact-submission.ts` builds the stored document (now carrying `site`) and sends the acknowledgement:

- SAOC: unchanged (`FORMS_FROM_ADDRESS`, `ContactConfirmation`, Reply-To `info@saoc.co.za`).
- NOS: `NOS_FORMS_FROM_ADDRESS`, `site: 'nos'` (Reply-To `show@saoc.co.za`), `emails/NosContactConfirmation.tsx`, the SAOC acknowledgement's copy verbatim with the entity and origin substituted and the response-time sentence dropped.
- The admin notice stays on the SAOC sender for both sites. For `nos` the subject is `New contact message — The National Orchid Show` and the email gains a `Site:` row. It reaches every `ADMIN_EMAIL_ALLOWLIST` recipient; adding Lee-Ann's mailbox there is the operator action OD1 of admin-form-notices.

## Copy gaps

Per `docs/rules/no-invention.md`, visible on the beta preview, omitted in public.

- G1 hero lede: bracketed stand-in with a marker on the preview; omitted in public (`lib/nos-contact-copy.ts`).
- G2 NOS success body ("reached the SAOC secretariat" is a SAOC claim): stand-in with a marker on the preview; the heading alone in public.
- G3 NOS contact topics: not rendered (no select).
- G4 show inbox response time: the SAOC "2 business days" sentence is dropped from the NOS acknowledgement, not replaced. Being asked of Lee-Ann.
- G5 (CT5) show email, phone and venue: omitted with no block and no marker.

## Stale guards updated

`e2e/nos-header-brand-and-cta.spec.ts`, `e2e/mobile-nav-reaches-every-section.spec.ts`, `scripts/checks/nos-split-http.mjs` (now expects `/contact` served on NOS), and the `NEVER_CREATE_SLUGS` lists in `scripts/checks/verify-show-page-m4.ts` and `scripts/checks/verify-nos-m4-local-render.ts`. New: `e2e/nos-contact.spec.ts`.

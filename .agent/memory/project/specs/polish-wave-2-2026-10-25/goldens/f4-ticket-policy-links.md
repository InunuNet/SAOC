# F4 — policy links beside Buy (PL-1, PL-2, PL-3)

Visitors paying R300-R1,500 cannot reach the refund or privacy policy from the buy screen. Both pages exist (app/(shared)/refunds, app/(shared)/privacy,
served on both hosts: proxy.ts SHARED_EXACT, footer links the same hrefs).

## Specification
1. components/tickets/TicketPurchaseForm.tsx: `import Link from 'next/link';` and, as the LAST child of the `<form>` (after the Buy hint `<p id={BUY_HINT_ID}>`), exactly:
   `<p className="nk-policy"><Link href="/refunds">Refund &amp; Cancellation Policy</Link><Link href="/privacy">Privacy and Personal Information Policy</Link></p>`
   Labels are the pages' own H1 titles (refunds/page.tsx heading; content/legal/privacy.ts `title`). No lead-in sentence, no separator text, no aria-label
   (nothing new to say). Do not change anything else in the form (wave 1 adds method="post" and the hydration guard in the same file; stay out of those lines).
2. app/(nos)/national-show/nos-structure.css, next to `.nk-hint` (~L2089), two rules built only from tokens already used there:
   `.nos-theme .nk-policy { margin: 0; display: flex; flex-wrap: wrap; gap: 0 20px; font-family: var(--sans); font-size: 14px; color: var(--primary-800); }`
   `.nos-theme .nk-policy a { display: inline-flex; align-items: center; min-height: 44px; color: inherit; text-decoration: underline; text-underline-offset: 4px; }`
   (the underline offset is the one the crumbs hover rule already uses). No literal colour. Hover/focus: the NOS `:focus-visible` outline already applies.
3. PL-3 fixture: app/ticket-fixtures/buy/page.tsx (new, server component): `export const dynamic = 'force-dynamic'`; `if (process.env.TICKET_FIXTURES !== '1') notFound();`
   then `<NosThemeScope><TicketPurchaseForm ticketTypes={[{ slug: 'fixture-ticket', name: 'Fixture ticket', price: 100, regularPrice: null, description: '',
   soldOut: false, provisional: false, requiresDaySelection: false }]} showDays={[]} /></NosThemeScope>` inside a `<div data-nos-wrap className="py-12"><div className="max-w-[560px]">`.
   The flag is set by the rendered check only and is in no deploy or example env file. No auth is touched.
4. Docs: docs/polish-wave-2-f4-policy-links.md naming PL-1..PL-3, the label choice (README design question 2) and the fixture-route limits.

## Checks
f4-links-static.mjs (links, hrefs, labels read from the pages' sources, nothing else in the paragraph, CSS tokens, fixture wiring, flag absent from env files) and
f4-links-rendered.mjs (flagless 404; flagged: two links in order, both >=44px, within 160px below Buy, no overflow, at 4 viewports).
Order dependency: do F3 first (same CSS file, different rules; F3 also edits the ticket page this form is rendered on).

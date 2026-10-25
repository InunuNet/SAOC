# F4 — policy links beside Buy (PL-1, PL-2, PL-3)

RULED by NOS Design 2026-10-25 (final), goldens/nos-design-rulings-2026-10-25.md: labels "Refunds" and "Privacy", one line "Refunds · Privacy" directly under Buy, each link underlined, contrast >=4.5:1 on the card ground, hit target >=24px. This replaces the earlier H1-title labels.

Visitors paying R300-R1,500 cannot reach the refund or privacy policy from the buy screen. Both pages exist (app/(shared)/refunds, app/(shared)/privacy,
served on both hosts: proxy.ts SHARED_EXACT, footer links the same hrefs).

## Specification
1. components/tickets/TicketPurchaseForm.tsx: `import Link from 'next/link';` and, as the child of the `<form>` directly after the `.nk-checkout-total` CTA row and BEFORE the Buy hint `<p id={BUY_HINT_ID}>` (NOS Design round 2: the hint moves after the links; the first link must start 12-16px below the "Continue to payment" button's bottom edge, Gestalt proximity; the hint keeps role=status and its own spacing below), exactly:
   `<p className="nk-policy"><Link href="/refunds">Refunds</Link><span aria-hidden="true">·</span><Link href="/privacy">Privacy</Link></p>`
   Labels are the NOS footer's own labels (components/nos-chrome/nos-footer-data.ts: Refunds, Privacy), the same name site-wide (critique H4). The only other node is the aria-hidden
   dot; no lead-in sentence, no aria-label (nothing new to say). H1s stay on the destination pages. Do not change anything else in the form (wave 1 adds method="post" and the hydration guard in the same file; stay out of those lines).
2. app/(nos)/national-show/nos-structure.css, next to `.nk-hint` (~L2089), two rules built only from tokens already used there:
   `.nos-theme .nk-policy { margin: 0; display: flex; align-items: center; gap: 0 10px; font-family: var(--sans); font-size: 14px; color: var(--primary-800); }`
   `.nos-theme .nk-policy a { display: inline-flex; align-items: center; min-height: 44px; /* ruling floor is 24px */ color: inherit; text-decoration: underline; text-underline-offset: 4px; }`
   (the underline offset is the one the crumbs hover rule already uses). No literal colour; --primary-800 on the card ground is the .nk-hint pairing, and the rendered check measures >=4.5:1 on the real ground. Hover/focus: the NOS `:focus-visible` outline already applies.
3. PL-3 fixture: app/ticket-fixtures/buy/page.tsx (new, server component): `export const dynamic = 'force-dynamic'`; `if (process.env.TICKET_FIXTURES !== '1') notFound();`
   then `<NosThemeScope><TicketPurchaseForm ticketTypes={[{ slug: 'fixture-ticket', name: 'Fixture ticket', price: 100, regularPrice: null, description: '',
   soldOut: false, provisional: false, requiresDaySelection: false }]} showDays={[]} /></NosThemeScope>` inside a `<div data-nos-wrap className="py-12"><div className="max-w-[560px]">`.
   The flag is set by the rendered check only and is in no deploy or example env file. No auth is touched.
4. Docs: docs/polish-wave-2-f4-policy-links.md naming PL-1..PL-3, the ruled labels and the fixture-route limits.

## Round 2 (NOS Design)
Gap gate: first link top minus CTA bottom is 12-16px (replaces the 160px bound) at 4 viewports. The 390 fixture's missing gutter was a suspected fixture artefact: the fixture wraps the form in `[data-nos-wrap]`, which supplies the inline gutter, so the rendered check now also asserts the form starts >=16px from the viewport edge at 390; if that fails it is a fixture bug, fix the fixture.

## Checks
f4-links-static.mjs (links, hrefs, labels read from the NOS footer source, only the dot span besides the links, CSS tokens, fixture wiring, flag absent from env files) and
f4-links-rendered.mjs (flagless 404; flagged: "Refunds · Privacy" on one line, underlined, both >=24px, contrast >=4.5:1 on the ground, within 160px below Buy, no overflow, at 4 viewports).
Order dependency: do F3 first (same CSS file, different rules; F3 also edits the ticket page this form is rendered on).

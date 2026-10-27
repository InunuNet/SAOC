# SAOC status tokens (NOS Design 2026-10-28)

On the SAOC base (app/globals.css :root): --status-error #8f2834, --status-success #2f5d3a, --status-warning #7a5a12. Text plus icon only, never colour alone. Error summaries: same token as a 2px border (`border-2 border-[var(--status-error)]`), no tint.
Today --status-error is referenced by components/vendors/* and defined only in app/(nos)/national-show/nos-theme.css; on the SAOC base it resolves to nothing.

Note for the dev: the vendor forms render only on the NOS host (SAOC host 308-redirects /national-show/vendors/apply to nos.localhost), so the SAOC-host guarantee is the token itself plus the static summary check.

# One focus ring (F1a)
Reference ring = hero CTA ring in components/home/Hero.tsx:33: `outline 2px solid, offset 3px`, colour ivory on the dark hero. Same geometry (2px solid, 3px offset) on hero CTAs, Menu, Join and footer links, colour taken from existing tokens so it reaches 3:1 on its own ground (ivory on dark grounds, --primary on parchment). check-focus-ring.mjs measures geometry and ring-vs-ground contrast.

# Newsletter contrast (F1a)
Measured on main: footer ground #22281f, field fill ivory/10, placeholder ivory/40 = 3.00:1 (need 4.5), border ivory/20 = 1.85:1 (need 3). Existing tokens reach it without a new colour: --ivory (#f4f3ec) or --primary-100 (#e8e6dc) at higher alpha/solid for the placeholder, --accent-soft (#c2b393) or --ivory for the border. No gap to report; dev picks among existing tokens and the check measures.

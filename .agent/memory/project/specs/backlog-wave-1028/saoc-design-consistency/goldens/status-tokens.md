# SAOC status tokens (NOS Design 2026-10-28)

On the SAOC base (app/globals.css :root): --status-error #8f2834, --status-success #2f5d3a, --status-warning #7a5a12. Text plus icon only, never colour alone. Error summaries: same token as a 2px border (`border-2 border-[var(--status-error)]`), no tint.
Today --status-error is referenced by components/vendors/* and defined only in app/(nos)/national-show/nos-theme.css; on the SAOC base it resolves to nothing.

Note for the dev: the vendor forms render only on the NOS host (SAOC host 308-redirects /national-show/vendors/apply to nos.localhost), so the SAOC-host guarantee is the token itself plus the static summary check.

# One focus ring (F1a)
SCOPE (ruled): ALL standalone actions take the one ring (outline 2px solid, offset 3px, no ring-* utilities, no outline-none): buttons, links, CTAs, the logo, drawer close/search/Join, admin header actions, submit buttons, the equipment tables' add/remove row buttons, and programmatic focus targets such as error-summary wrappers with tabIndex -1. EXCLUDED, with reasons, one allowlist entry per component in goldens/focus-classes.json (never a glob): (1) NAV-1 underline focus, the nav links in Header and the MobileMenu nav rows (the nav design's own ruling, F1b owns the nav); (2) form-control field focus: text inputs, selects, checkboxes, radios and the equipment-table cell inputs (outside the one-ring scope the golden names: hero CTAs, Menu, Join, footer links). Gate: A4 (runtime probes plus check-focus-classes-static.mjs, which enumerates every className and fails on an unlisted hit or a stale entry).
Reference ring = hero CTA ring in components/home/Hero.tsx:33: `outline 2px solid, offset 3px`, colour ivory on the dark hero. Same geometry (2px solid, 3px offset) on hero CTAs, Menu, Join and footer links, colour taken from existing tokens so it reaches 3:1 on its own ground (ivory on dark grounds, --primary on parchment). check-focus-ring.mjs measures geometry and ring-vs-ground contrast.

# Newsletter contrast (F1a)
Measured on main: footer ground #22281f, field fill ivory/10, placeholder ivory/40 = 3.00:1 (need 4.5), border ivory/20 = 1.85:1 (need 3). Existing tokens reach it without a new colour: --ivory (#f4f3ec) or --primary-100 (#e8e6dc) at higher alpha/solid for the placeholder, --accent-soft (#c2b393) or --ivory for the border. No gap to report; dev picks among existing tokens and the check measures.

# Golden: per-site chrome, menus and cross-links (nos-site-split F3)

SOURCE OF TRUTH FOR VISUALS/STRUCTURE: `.agent/memory/project/specs/nos-site-split/design-rulings.md` (NOS Design R0-R6). The dev implements it verbatim; this golden only adds routing/wiring facts and the lead overrides.

Wiring facts:
- Chrome is chosen by route group (see host-routing golden), never by client segment. `(shared)` layout chooses by `siteForHost(headers().get('x-forwarded-host') ?? host)`.
- NOS header (R1): top row Visit, Programme, Exhibit & trade (disclosure panels), Show sponsors, Past shows (withheld in public until content, as today), Contact (-> saocUrl('/contact')); Tickets CTA -> `/tickets`. Hrefs have no `/national-show` prefix. No SAOC utility bar on NOS. Mobile panel ends with the SAOC credit text link to saocUrl('/').
- NOS footer (R2): columns per R2.1-R2.4; legal row Privacy, Terms, Refunds (mirrored on NOS), Media kit (-> `/media-kit` on NOS), Constitution (-> saocUrl('/constitution')). Credit block: SAOC mark + FOOTER_ORG_NAME + FOOTER_REG as ONE link to saocUrl('/'), 44px target. COPY GAP (lead ruling b): the credit LABEL line ("Organised by") is OMITTED until Brad supplies wording; nothing is invented.
- SAOC header (R3.1-R3.3): the National Show mega becomes a plain "National Show" link to `nosUrl('/')` in its existing slot; lead block/columns/Tickets rail deleted from NAV. Utility-bar pill, footer FOOTER_NAV, home hero CTA, "Four ways into SAOC" card and next-show band CTAs -> `nosUrl('/')`. Cross-site links are plain `<a>`, same tab, no arrow (R0.2). SAOC search (R3.6): drop show-tree results and keep the single "National Show" entry -> nosUrl('/').
- `footer-data.ts` split into SAOC and NOS link lists + one shared file (layout, rhythm, bulletin, REG, copyright) (R3.7).
- Admin chrome unchanged (R5.1). AdminPill mounted in (marketing), (nos), (shared) layouts.
- No SAOC link on NOS may be a relative or NOS-origin URL; no `/national-show` href may remain in SAOC chrome/home (assertions A17-A19, A26).
- e2e: update the specs listed in research (nav-links-200, nav-property1-http-gate, nav-rendered-reachability, nav-keyboard-operable, mega-menu-f8/layout4, mobile-nav-reaches-every-section, no-fabricated-content, sold-out-and-empty-states, fixtures/tickets-fixtures) to request show URLs with Host `nos.localhost:<port>` using clean paths, and to assert SAOC->NOS links by href instead of following them. Specs that test the removed SAOC show mega are rewritten for the plain link.

## Logo lockup rule (Brad, 2026-10-23; checked by eye by NOS Design, no assertion)
- The header uses the full-colour logo lockup on both sites (NOS: /images/nos/nos-full-colour-horizontal-1200.png per R1.1; SAOC: its full-colour lockup).
- Footer, tickets and other sections may use brand variations from branding/ where contrast works.
- Never place a white or light logo on a white or light ground.

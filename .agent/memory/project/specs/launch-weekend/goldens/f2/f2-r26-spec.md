# launch-weekend F2 - R26 Tickets CTA on the SAOC chrome (golden spec)

Base: origin/main 61b0157e (golden header-baseline.json captured from a clean build of that SHA).

## Decisions and evidence
- Pill vs CTA: UtilityBar pill links /national-show (components/chrome/UtilityBar.tsx), the CTA links
  /national-show/tickets. Different destinations, so the pill STAYS. A1 fails if the two ever share an href.
- Label and href come from nav-config only. The Tickets leaf already exists (mega lead.theShow.links, id 'tickets',
  label 'Tickets'). Add two exports to nav-config.ts: TICKETS_CTA (resolved from that leaf, throwing at load if absent)
  and CONTACT_LINK ({id 'contact', label 'Contact', href '/contact'}, the literal today hardcoded in Header and MobileMenu).
- Do NOT add Contact to the NAV array. The NOS chrome (wt-nos-chrome NosHeader) maps NAV and appends its own Contact,
  so a NAV entry would render Contact twice there. Header and MobileMenu render CONTACT_LINK after the NAV items.
- CTA slot: the action-zone Link keeps Contact's classes verbatim, including `hidden sm:inline-block`. Below 640px the
  Tickets path is the hamburger menu (already lists the mega's Tickets leaf), unchanged. No second button.
- Desktop nav at 1280 gains Contact as the last item and the action zone swaps Contact for Tickets, so net width grows
  about 45px. The nav must still not wrap at 1240-1279 (A1 checks 1280) - drop nothing, adjust gaps only if forced and tell the architect.
- aria-current="page" on the MegaMenu trigger button of the National Show item when pathname starts with its href.
  No other item gains aria-current.
- MobileMenu: replace the hardcoded Contact literal with CONTACT_LINK; nothing else changes.

## Collisions
- NOS branch (feat/nos-own-brand-chrome) edits components/chrome/Footer.tsx and footer-data.ts: F2 must not touch them.
- NosHeader hardcodes its own TICKETS_HREF and CONTACT_HREF constants, so nav-config additions do not affect it.
- Once the NOS chrome owns /national-show/*, the SAOC header no longer renders there; A3 reports those routes as SKIP.

## Known neighbours
- e2e/nav-keyboard-operable.spec.ts mentions Contact as the "next header control"; re-run the e2e nav specs.

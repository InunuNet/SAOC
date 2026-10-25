# Existing checks edited by leeann-content-build M1

Each entry is a pre-existing check that pinned copy or a type shape this milestone replaced.

- `contracts/checks/policy-pages/check-legal-draft-notice.mjs`: asserted the AI-drafted "Draft pending legal review" notice is visible on /privacy and /terms. The notice was removed on the approved decision (her text replaces it), so the check now asserts the notice is absent.
- `contracts/checks/policy-pages/check-terms-ticket-conditions.mjs`: two regexes widened to her wording ("restricted to persons aged 18 and older"; heading "Tickets, bookings and admission"). The Sunset Cocktails and limited-capacity assertions are unchanged.
- `contracts/checks/email-shell/fixtures.mts`: the OrderConfirmation fixture gains `parking: null` because `OrderConfirmationVisit.parking` is now a required field (type-only change, rendering unchanged).

# Outside the M2 allow-list, edited with the lead's ruling (M2)

- `scripts/generate-nos-route-manifest.ts`: the `/national-show/sa-exhibitors` entry is removed, because the route was retired (merged into `/national-show/vendors`) and regenerating `content/national-show-routes.json` would otherwise re-add it. Not a check, but outside the allow-list.

# Superseded, not edited (M2)

- `contracts/checks/launch-weekend/f14/check-i-copy.mjs` (line 31) still pins "21 societies" and "56 accredited judges" on the home page. Her H1 answer ("You can leave this information out for now") removes the unsourced stats, so those pins are superseded by `leeann-content/ff.mts stats`. The check was already unable to run (it throws in `page.evaluate`), so it is left unedited.

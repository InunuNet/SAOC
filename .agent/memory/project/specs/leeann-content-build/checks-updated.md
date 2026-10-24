# Existing checks edited by leeann-content-build M1

Each entry is a pre-existing check that pinned copy or a type shape this milestone replaced.

- `contracts/checks/policy-pages/check-legal-draft-notice.mjs`: asserted the AI-drafted "Draft pending legal review" notice is visible on /privacy and /terms. The notice was removed on the approved decision (her text replaces it), so the check now asserts the notice is absent.
- `contracts/checks/policy-pages/check-terms-ticket-conditions.mjs`: two regexes widened to her wording ("restricted to persons aged 18 and older"; heading "Tickets, bookings and admission"). The Sunset Cocktails and limited-capacity assertions are unchanged.
- `contracts/checks/email-shell/fixtures.mts`: the OrderConfirmation fixture gains `parking: null` because `OrderConfirmationVisit.parking` is now a required field (type-only change, rendering unchanged).

# Outside the M2 allow-list, edited with the lead's ruling (M2)

- `scripts/generate-nos-route-manifest.ts`: the `/national-show/sa-exhibitors` entry is removed, because the route was retired (merged into `/national-show/vendors`) and regenerating `content/national-show-routes.json` would otherwise re-add it. Not a check, but outside the allow-list.

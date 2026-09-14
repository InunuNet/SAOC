# p2-semantic-feedback-colours-do-not-exis

**[P2] Semantic feedback colours do not exist in the brand.** `app/globals.css` has
  primary / accent / parchment / ivory / bone / ink / muted / rule only — no success green, no
  error red, nothing that reads as bright at a door in daylight. Brad's door check-in spec
  requires "bright green" and "bright red", which the current palette cannot satisfy. Either he
  adds two semantic tokens, or he decides explicitly to use primary/accent (muted, arguably fails
  the requirement). Do not invent colours. **Update 2026-08-24:** the door check-in
  success/failure banner shipped anyway (`door-checkin-success-feedback` mission) by reusing
  existing tokens (bg-primary/text-ivory success, bg-bone/border-primary-800/text-primary-800
  failure) rather than waiting — so this no longer *blocks* that feature, but the underlying gap
  (no bright semantic green/red) is still open and Brad's original "bright" requirement is still
  arguably unmet.

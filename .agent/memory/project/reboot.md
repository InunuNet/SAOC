# Reboot Context
_Generated: 2026-08-24T12:16Z_

## What happened last session
venue-never-changed-copy-fix: Remove all 'venue has changed' / 'previous venue no longer applies' narrative from the National Show visitor-info content. The venue never changed — CTICC was an incorrect early placeholder that got corrected to the real venue (The Hangar, Stellenbosch Flying Club). Rewrite affected content (scripts/seed-show-visitor-info.ts and the live Sanity showVisitorInfo doc it seeds) to state the venue plainly, as if it was always the Hangar, while preserving genuinely-still-true content (travel/parking/accommodation guidance not yet worked out is fine to say, just not framed as a consequence of a change). Given this repo's history on this exact topic (contracts/golden/venue-prose-residue/), route through @architect for a proper contract before @dev touches it.

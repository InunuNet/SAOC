# venue-never-changed-copy-fix — what this contract is and is not

## The defect

Brad, 2026-08-24, from a live screenshot of `/national-show/plan-your-visit`: "The
show's venue never changed. We just had the wrong venue in the beginning. We must
take any reference to the venue changing off the website, please." CTICC was never
a real, committed venue — an early incorrect placeholder — and the site currently
narrates it as something that "changed away from" ("the show venue has changed to
the Stellenbosch Flying Club", "the previous guidance... no longer applies",
"researched... against the working venue", "for the new venue"). This must read as
if the venue was simply always The Hangar.

## Verified scope — every "changed"-framing instance found, three artifacts checked independently

Checked directly (2026-08-24), not inherited from the mission brief unverified:

1. **`scripts/seed-show-visitor-info.ts`** — read in full. Confirmed the four
   locations named in the mission brief (comments above `AIRPORT_ROUTES` and
   `CONFIRMATIONS`, `researchLabel`, `gettingThereIntro`) plus two more the brief's
   line numbers didn't call out: `planIntro` ("against the working venue"),
   `parking` ("for the new venue"), `accommodationIntro` ("the previous list..."),
   `accessibility` ("for the new venue"). Six live prose fields total, not four.
   AMENDED 2026-08-24: the `AIRPORT_ROUTES` comment turned out to be
   `venue-prose-residue`'s A10-protected negative control (verbatim "city-centre
   convention centre" text) — see "What this contract does NOT do" below. Only
   the `CONFIRMATIONS` comment is actually rewritten by this contract.
2. **The live Sanity `showVisitorInfo` document** (`_id: "showVisitorInfo"`,
   project `26yfbug4`, dataset `production`) — queried directly via a read-only GET
   against the Sanity Query API (`_updatedAt: 2026-08-22`, i.e. re-seeded/patched
   since the venue correction). All six fields hold byte-identical text to the seed
   script — **no live/seed drift on this occasion**, unlike the divergence this
   project's `venue-prose-residue/README.md` "Finding 3" found on the adjacent
   defect. Confirmed independently, not assumed from that precedent.
3. **`contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json`** — also
   byte-identical to the seed script for these six fields (verified with a
   field-by-field script, not eyeballed).
4. **Live `showFaq-*` documents** (all 14, queried directly) — clean. None contain
   "changed"/"working venue"/"new venue"/"previous" framing. Already fixed by an
   earlier pass; listed as negative controls (A9) so a regression is caught.
5. **`docs/show-visitor-info-for-editors.md`** and **`docs/show-visitor-info.md`** —
   read in full. Found one stale quote (the editors doc's example tag text, line
   ~63, verbatim-quotes the old `researchLabel`) that must move in lockstep with the
   `researchLabel` fix or the doc becomes wrong. Everything else matching "chang"/
   "venue" in these two docs is a legitimate, forward-looking description of the
   Studio single-source mechanism ("when the committee confirms the real venue, you
   change it once..."; "...if it ever changes again in 2030") — not a claim that the
   2027 show's venue itself changed. These are explicit negative controls (A10, A11)
   so this fix cannot accidentally strip the actual editor-facing documentation of
   the venue-single-source guarantee.

## Coordination with `venue-prose-residue` — same file, non-overlapping phrase lists, no fight

`venue-prose-residue`'s A12 already asserts against several of the exact same
fields this contract touches (`parking`, `accessibility`, `gettingThereIntro`,
`accommodationIntro` in both the seed script and the golden JSON) — but for a
**completely different denylist**: CTICC-identifying phrases ("convention centre",
"MyCiTi", "V&A Waterfront", drive-time claims, etc — see
`contracts/golden/venue-prose-residue/phrase-denylist.golden.md`). This contract's
denylist is the "change" narrative itself ("has changed to", "no longer applies",
"previous guidance"/"previous list", "working venue", "for the new venue") — words
that never triggered `venue-prose-residue`'s CTICC-specific phrases because they
are generic, not CTICC-identifying. Neither contract's assertions reference the
other's phrase list; the corrected text in `corrected-fields.golden.md` contains
zero CTICC-identifying phrases, so applying this fix cannot regress
`venue-prose-residue`'s A12. Both contracts may be gated independently; there is no
ordering dependency, but if both are ever red at once, fix `venue-prose-residue`'s
findings and this contract's findings as separate patches to the same fields rather
than one combined rewrite, so each contract's own diff stays attributable.

## Explicitly out of scope — `nationalShowVenuePatch.venue.directionsNote`

The golden JSON's `nationalShowVenuePatch.venue.directionsNote` currently reads:
"This note described the original research venue and predates the venue change to
The Hangar, Stellenbosch Flying Club. Directions for the current venue have not
been confirmed." — which is exactly this contract's defect class (change framing).
**This contract does not touch it.** Reasons, both independently sufficient:

1. It sits inside `nationalShowVenuePatch.venue`, the object
   `venue-prose-residue/README.md`'s "Finding 1" ruling declares a frozen
   historical record of the original CTICC research, protected by that contract's
   own A13 ("stays untouched"). This contract has no authority to edit a field
   another contract's assertion explicitly protects.
2. `venue-prose-residue/README.md`'s "v3" section separately documents this exact
   field (among others) as *already known RED against that contract's own stated
   goal* — the ruling elsewhere in the same document calls `directionsNote`
   "in scope, must match the corrected script" (which leaves it unset entirely),
   creating an internal contradiction in that contract's own text that predates
   this mission. That contradiction is `venue-prose-residue`'s to resolve, not a
   gap this contract should paper over by picking a side unilaterally.
3. Operationally inert either way: the live `nationalShow.venue` document (verified
   by direct query) already holds a completely different, correct, change-free
   `directionsNote` ("The show is held at the hangar at Stellenbosch Flying
   Club..."), set by a later mission. `nationalShowVenuePatch` uses
   `setIfMissing`, which no-ops once any value exists — this golden's copy of
   `directionsNote` is not reproducible onto the live document by re-running the
   seed script and was not found live anywhere. Zero visitor-facing exposure.

Flagged here for the orchestrator to route to `venue-prose-residue`'s owners as a
follow-up, not silently absorbed into this contract's scope.

## What this contract does NOT do

- Does not invent new venue facts (accommodation names, drive times, parking
  capacity) — same rule 5 discipline as `venue-prose-residue`. The corrected text
  in `corrected-fields.golden.md` removes the "changed" framing and keeps every
  genuinely-true "not yet confirmed" statement, simply without "because the venue
  changed" as the stated reason.
- Does not touch `venue-prose-residue`'s CTICC-phrase denylist checks, golden
  files, or checker scripts.
- Does not mutate the live Sanity dataset via any contract assertion — every
  dataset-facing check (A6) is a read-only GET, per this repo's own
  `dataset-mutation-safety.golden.md` incident record (a mutating "cleanup"
  check left sentinel residue live on the deployed site for 3 days). The actual
  live-document fix is a one-off idempotent `.patch().set()` script the
  orchestrator runs once, outside the contract gate — see
  `corrected-fields.golden.md` "The live-document patch" and
  `scripts/fix-visitor-info-dates-confirmed.ts` for the exact pattern to copy.
- Does not touch `nationalShowVenuePatch.venue.directionsNote` — see above.
- Does not touch any `showFaq-*` document — already clean (negative control A9).
- Does not touch the comment above `const AIRPORT_ROUTES` in
  `scripts/seed-show-visitor-info.ts` (currently lines ~163-168, the one that
  names "city-centre convention centre"). `contract-venue-prose-residue.yaml`'s
  A10 is a NEGATIVE CONTROL that pins this exact comment verbatim, unchanged, as
  a dated historical record of the CTICC research phase — the same standing as
  the other protected files in `venue-prose-residue/phrase-denylist.golden.md`'s
  "Out of scope" list. It is a `//` code comment, never rendered on the live
  site, so Brad's instruction ("take any reference to the venue changing off
  the website") never actually reached it. AMENDED 2026-08-24: an earlier pass
  of this contract rewrote this comment to remove its "venue changed" framing,
  which put A1 (this contract) and A10 (`venue-prose-residue`) in direct
  conflict over the same lines. Resolved by reverting the comment to its
  original A10-protected text and scoping A1's denylist scan
  (`contracts/checks/venue-never-changed-copy-fix-f1/check-seed-script.sh`) to
  exclude that exact block before scanning, rather than re-litigating which
  contract wins — A1 still scans everything else in the file, including the
  *other*, unprotected comment above `const CONFIRMATIONS` (~lines 207-211),
  which this contract does rewrite.

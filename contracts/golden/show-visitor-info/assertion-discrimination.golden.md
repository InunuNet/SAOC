> **SUPERSEDED — historical research record, not current content.**
> This file documented: The discriminating-assertion property, illustrated with CTICC-era examples.
> The venue changed to **The Hangar, Stellenbosch Flying Club** on 2026-08-12.
> Correction commits: `427fbaf` (corrected live content) and `32e01cf` (purged CTICC residue
> from seed sources, goldens, and docs).
> See `docs/venue-prose-residue.md` for the current state and the reasoning for keeping this
> record intact. The content below is preserved as-authored and must not be edited to match
> the current venue.

---

# Discriminating assertions

> An assertion that sources its expected value from the same place as the actual value cannot
> fail. Round 1 of this mission scored 57/59 and shipped two broken overriding rules, because
> three of its assertions were of exactly that shape.

This golden defines the property every assertion in `contract-show-visitor-info.yaml` must have,
and the three ways round 1 lost it. It is the primary reference for anyone adding a check here.

---

## The property

**An assertion is _discriminating_ if there exists a realistic state of the system in which it
fails.** Not a theoretical one — a state a person could produce in Studio in under a minute, or
that a developer could produce with a plausible edit.

Before adding a check, name that state. If you cannot name it, the check is decoration. If you
can name it, produce it: run the check against the broken tree and watch it go red. A check that
has never been observed failing has never been tested.

---

## Failure mode 1 — the tautological needle

**Round 1, A43.** The check fetched `showVisitorInfo.pendingLabel` from Sanity and searched the
rendered page for it. The page renders `pendingLabel` from Sanity. Expected and actual came from
one source, so the two could only ever agree.

The failure was not subtle in effect. @qa cleared `pendingLabel` — one unvalidated string field,
two seconds in Studio — and **all 23 pending markers vanished from the site** while every
`confirmations` value was still `pending`. A43 stayed green: an empty field makes an empty
needle, and `textContains()` short-circuits on `target.length > 0`.

### The rules that follow

1. **A needle read from the dataset is INPUT, and input is validated at the boundary.** Use
   `assertUsableNeedle()` from `contracts/checks/show-visitor-info/_mutation-guard.mjs`. An
   unusable needle is a hard failure of the check, never a silently skipped assertion.
2. **Prefer a structural observable to a textual one.** The claim "an unconfirmed block is
   visibly marked" is about the marker's *existence*, not its wording. Count
   `[data-confirmation-badge]` elements — a hook derived from neither the dataset nor the copy —
   and the assertion survives any rewording, any language, any empty field.
3. **Where the claim really is textual, get the expected value from a third place.** The check
   invents the value, writes it, and reads it back (see failure mode 2). Now expected and actual
   have genuinely different origins.

---

## Failure mode 2 — asserting in the wrong layer

**Round 1, A54.** The check grepped `app/(marketing)/national-show/page.tsx` for the string
`Cape Town International Convention Centre`. It passed. Meanwhile the stale venue was reaching
the page from `nationalShow.location` — the *legacy CMS field* — so `/national-show` rendered the
old venue in the hero and the new city in the CTA sentence one screen below it. Two venues, one
viewport. The literal was never in the code, and a source grep is structurally incapable of
seeing that.

### The rule that follows

**Assert a claim in the layer where the claim is true.** "No venue literal in this file" is a
source-level claim and a grep settles it. "Changing the venue in Studio changes it everywhere" is
a *rendered, causal* claim, and only a perturbation settles it:

> change the value in the dataset → wait for propagation → assert every surface shows the new
> value → assert no surface shows any token of the old one → restore and verify.

Source greps remain useful as a fast fence — they run in milliseconds and catch the obvious
regression before the slow check does. They are never the whole assertion for a causal claim.

---

## Failure mode 3 — the literal denylist

**Round 1, A53.** The check forbade the exact string `"18–21 Sep 2027"`. The code said
`"Sep 18–21 2027"`. Same fact, different word order, assertion green — while five fabricated,
committee-unapproved dates rendered on the live page with no pending marker.

### The rules that follow

1. **Deny the shape, not the spelling.** A month token within ten non-letter characters of a
   `20xx` year, in either order. An ordinal followed by `National`/`Show`. An ISO date literal.
   These catch the reworded variant the enumerated list misses.
2. **A denylist is a fence, not a proof.** The proof that dates are single-sourced is the
   perturbation sweep, which moves the show to 2033 and requires that no surface still says
   otherwise. The regex is there to fail fast and to make the intent legible in the contract.

---

## The negative control, mandatory

Every assertion added or rewritten in this contract carries a recorded **pre-fix state**: the
result of running it against the tree *before* the corresponding fix exists. Round 2's are in
`.agent/memory/scratch/visitor-brief-2.md`.

For the two rewritten assertions specifically, the negative control is not "it fails somehow" but
"it fails **in the exact scenario that previously passed**":

| Assertion | Scenario that previously passed | Must now fail |
|---|---|---|
| A43 / A60 | `pendingLabel` cleared in the dataset, statuses still `pending` | marker count drops → red |
| A54 / A61 | stale venue in Sanity (`location`), not in code | old venue token on a rendered surface → red |

---

## Cost, acknowledged

Perturbation checks are slow. Propagation is bounded by the Sanity CDN, not by `/api/revalidate`
— `sanity/lib/fetch.ts` sets `useCdn: true`, so `revalidateTag` purges the Next cache and the
refetch then reads a CDN copy that can still be stale. Measured: 64 s, 72 s, ~96 s. Budget
240 s per perturbation, and expect the mutating assertions to dominate gate runtime.

That is the price of an assertion that can fail. Round 1 ran fast and proved nothing about the
two rules the mission was written to enforce.

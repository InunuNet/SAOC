# Golden — the approved 17-page tree, the navigation carve-out, and the route manifest (M4)

**Revision 2 — 2026-09-10.** Brad approved a FINAL page structure that differs from revision 1
and from `goldens/m1/route-map.golden.md`'s route table. This file is now authoritative on
**which NOS pages exist**, on **navigation**, and on **the route manifest artifact**.
`goldens/m1/route-map.golden.md`'s route table (its rows for specs 8, 9, 10, 18 and its
sixteen-new-pages arithmetic) is **superseded** and must not be used to drive M4.

Source of the tree: Brad's instruction to this lane, 2026-09-10. Source of the rulings behind
it: `.agent/memory/project/rules.md` § "NOS structure — agreed by all three sessions 2026-09-10"
**as amended by that instruction** — see "Discrepancies" at the foot of this file.

---

## 1. The tree — 17 listed pages, exact slugs, nothing else

All under `app/(marketing)/national-show/`. `C` = create, `E` = exists (reconcile only),
`U` = exists and is **untouchable** (another lane owns it; link to it, never edit it).

### Hub

| slug | label | archetype | status |
|---|---|---|---|
| `/national-show` | National Show | `hub` | **E** — restructure into the four groups below as its four sections |

### Group `visit` — "Visit"

| slug | label | archetype | status | pageKey | note |
|---|---|---|---|---|---|
| `/national-show/about` | About the Show | `prose` | **E** | `02-about-the-national-show` | **DEPLOYED** (`9fa4067e`), and guarded by another mission's live contract. Reconcile only — §11 |
| `/national-show/what-to-expect` | What to Expect | `prose` | **E** | `03-what-to-expect` | reconcile onto its showPage document; do not move |
| `/national-show/plan-your-visit` | Plan Your Visit | `prose` | **E** | `16-plan-your-visit` | Sanity-driven (`showVisitorInfo`); reconcile only |
| `/national-show/faq` | Questions | `prose` | **E** | `17-faq` | copy is **BLOCKED** — her `.docx` is truncated in Drive. Reconcile only; do not write answers |

### Group `programme` — "Programme"

| slug | label | archetype | status | pageKey | note |
|---|---|---|---|---|---|
| `/national-show/programme` | Programme | `schedule` | **C** | `11-programme` | placeholder copy under an R11 disclosure |
| `/national-show/workshops` | Workshops | `schedule` | **E** | `12-workshops` | exists, no council copy; reconcile only |
| `/national-show/symposium` | SAOC Symposium | `prose` | **C** | `06-saoc-symposium` | **one sentence** of real source exists; everything else is placeholder under an R11 disclosure |
| `/national-show/wosa` | WOSA Conference | `prose` | **C** | `07-wosa-conference` | placeholder + a link **out** to WOSA. **Generate NO wild-orchid content** — §4 below |
| `/national-show/conferences` | Conference Registration | `transactional` | **U** | — | owned by `saoc-eb`. Link to it; never edit it |

### Group `exhibit-trade` — "Exhibit & Trade"

| slug | label | archetype | status | pageKey | note |
|---|---|---|---|---|---|
| `/national-show/sa-exhibitors` | South African Exhibitors | `listing` | **C** | `04-south-african-exhibitors` | **public nursery directory**. Renders a REAL EMPTY LISTING — see §5 |
| `/national-show/international-guests` | International Guests | `listing` | **C** | `05-international-guests-and-exhibitors` | placeholder prose + a REAL EMPTY LISTING |
| `/national-show/exhibitors` | Exhibitor Entry Guide | `prose` | **U** | — (`showExhibitorInfo`-driven) | **the GROWER ENTRY GUIDE.** Do not rename, repoint, or touch — §3 |
| `/national-show/vendors` | Trade Vendors | `transactional` | **U** | — | plus `/apply`, `/register`, `/payment`. Do not touch |

### Group `the-show` — "The Show"

| slug | label | archetype | status | pageKey | note |
|---|---|---|---|---|---|
| `/national-show/tickets` | Tickets | `transactional` | **U** | `13-booking-tickets` (seed only) | owned by `saoc-eb`. Link to it; never edit the route |
| `/national-show/sponsors` | Show Sponsors | `listing` | **C** | `15-sponsors` | **reinstated by Brad.** Its own data scope — §6 |
| `/national-show/archive` | Past Shows | `archive` | **U** | — | plus `/archive/[year]`. Do not touch |

**Counts, which the verifier pins:** 17 listed pages · **6 created** (`programme`, `symposium`,
`wosa`, `sa-exhibitors`, `international-guests`, `sponsors`) · **5 reconciled** (`about`,
`what-to-expect`, `plan-your-visit`, `faq`, `workshops`) · 1 hub restructured · 5 untouchable
(`conferences`, `exhibitors`, `vendors`, `tickets`, `archive`).

**Corrected 2026-09-10 after merge `42437ed2`.** Revision 2 of this golden had `/about` as a
CREATE, on a stale working tree. It exists, it is deployed, and creating a second one would
overwrite live work. See §11.

### Unlisted sub-routes

These exist on disk and therefore appear in the manifest with `listed: false`, so the
manifest's both-directions check stays total. They are **not** header entries.

`/national-show/vendors/apply` · `/national-show/vendors/register` ·
`/national-show/vendors/payment` · `/national-show/archive/[year]` (`dynamic: true`)

**21 manifest rows total: 17 listed + 4 unlisted.**

---

## 2. Deleted, and never created

### `/national-show/upcoming` — delete the route, **no redirect**

It is currently a 308 `permanentRedirect` to `/national-show`
(`app/(marketing)/national-show/upcoming/page.tsx`). Brad's ruling: **delete the directory.
No redirect stands in for it.** The site is early alpha — no real users, no bookmarks, no
live payments — so there is nothing to preserve and preserving a bad structure for
migration-safety reasons is the wrong instinct here.

Verification is a **404, and a 3xx fails** (local check `L5`). A redirect left in place would
satisfy "the page is gone" while leaving exactly the artefact the ruling removes.

`app/sitemap.ts` already excludes `upcoming` deliberately; that exclusion needs no change.

### Never create

`/national-show/plant-exhibition` · `/national-show/plant-sales` ·
`/national-show/judging-and-awards` · `/national-show/contact`

Each must 404 locally (`L6`). The rulings: the sales area is described inside the SA
Exhibitors document, the competitive display is What to Expect plus `/judging`, and a
NOS-level judging, sponsors-duplicate or contact page splits a real relationship or creates
an unwatched inbox. (Sponsors is the one Brad reinstated — see §6, and it is a *different
list*, not a duplicate of the site-level one.)

Their four seed files are retired explicitly, never left to rot — see
`goldens/m4/retired-seeds.golden.md`.

---

## 3. `exhibitors` is not `sa-exhibitors`, and an assertion must keep it that way

This confusion has already been made once in this mission and corrected once. It is cheap to
re-make because the Drive filename ("1.1 SA Exhibitors") points the wrong way.

| route | audience | data source | content |
|---|---|---|---|
| `/national-show/exhibitors` | **growers entering plants** | `showExhibitorInfo` / `showExhibitorStep` (Sanity) | entryProcess, fees, classes, judging, eligibility, display, sales, practicalities, permits |
| `/national-show/sa-exhibitors` | **the visiting public** | `vendorNursery` (Sanity) + `04-south-african-exhibitors` prose | per-nursery: logo, country, owner, short history, specialisation, plants they will bring, website, socials |

`/national-show/exhibitors/page.tsx:15` imports `showExhibitorInfoQuery` — it is not a
`showPage` consumer at all, so its manifest row carries `pageKey: null`.

**The guard is two-part**, because a one-part guard is satisfiable by the wrong half:

1. `git diff --name-only` shows nothing under `app/(marketing)/national-show/exhibitors/`
   (`X1`) — it is untouchable, full stop, including a "helpful" cross-link.
2. The manifest rows differ *in a field that states the distinction*: `exhibitors.purpose`
   contains `entry`, `sa-exhibitors.purpose` contains `directory`, the two `purpose` strings
   are non-empty and unequal, and `04-south-african-exhibitors` resolves to `sa-exhibitors`
   and to no other row (`X2`).

Part 1 alone would pass if a future session pointed `sa-exhibitors` at `showExhibitorInfo`.
Part 2 alone would pass if someone edited the entry guide while leaving the labels correct.

---

## 4. `/national-show/wosa` generates no wild-orchid content

Standing scope boundary: `CLAUDE.md` § "Critical scope boundary",
`docs/rules/no-invention.md` § "Scope boundary", and spec §4.7 (declined). SAOC is orchids
**in cultivation**. Wild orchid identification, habitat, and conservation belong to **WOSA**,
a separate organisation with its own site.

| in scope for `/national-show/wosa` | out of scope — link out to WOSA |
|---|---|
| what the conference is and who it is for | wild orchid identification |
| that it runs alongside the show | habitat description or protection |
| a link to WOSA's own site and registration | conservation status, threats, policy |
| — | field guides, distribution, species accounts |

Everything on the page beyond the one-line "what it is" is **placeholder under an R11
disclosure**, because no source document for it exists. `goldens/m3/wosa-content-boundary.golden.md`
holds the term list the verifier tests against; it is unchanged and still binding.

---

## 5. Real empty listings — `sa-exhibitors`, `international-guests`, `sponsors`

**No nursery and no show sponsor is named yet.** All three pages render an empty listing on
day one, and that is the correct output, not a defect.

An **invented nursery or sponsor is an invented commercial relationship with a real
business.** That is the most serious content failure available on this site and it is not
mitigated by a disclosure.

The empty state is a *page*, not a shrug:

- the page's own heading and intro render;
- the **shape of the card that is coming** is visible — the field labels the directory will
  carry (nursery, country, specialisation, what they will bring), rendered as structure;
- the absence is **stated in words**: what will appear here, and when it is expected;
- the string `no results` (case-insensitive) appears nowhere. Neither does `coming soon`
  as the *only* statement — it names nothing and dates nothing.

Any proper noun in these pages' prose must already be in
`content/show-pages/_name-allowlist.json`. That file's own comment states the rule: the fix
for a false positive is to **add the real name**, never to reword the sentence — and never to
add a name that is not a real organisation.

---

## 6. `/national-show/sponsors` has its own data scope

Brad reinstated this page and ruled it explicitly: **the Show's sponsors are a different list
from SAOC's site-level `/sponsors`, and the two must be able to diverge.**

**Decision: a new document type `showSponsor`, not a `scope` field on the existing
`sponsor`.**

| | new `showSponsor` type | a filter/view over `sponsor` |
|---|---|---|
| the two lists can diverge | yes, structurally | no — one document, two readers |
| a rename or deactivate on the SAOC side | cannot reach the show's list | silently mutates the show's list |
| touches a type the `saoc-eb` lane consumes | no | **yes** — `/sponsors` is theirs |
| cost | one schema file, ~20 lines | one field |

The second column is the option Brad ruled out by name, and it also breaches the lane
boundary, so the decision is not close. The cost is one small schema file.

Assertions: `showSponsor` exists and is registered (`SP1`); nothing under
`app/(marketing)/national-show/sponsors/` references `_type == "sponsor"`, `sponsorsQuery`
or `allSponsorsQuery` (`SP2`); `app/(marketing)/sponsors/` is unmodified (`SP3`); the empty
state satisfies §5 (`SP4`).

---

## 7. Reachability is hub-based, never header-based

**No M4 assertion may depend on a header entry existing.** The approved design handoff
(`design/design_handoff_saoc/src/chrome.jsx`) specifies a **flat six-item nav** — `National
Show` points at the hub and there is no dropdown. `components/chrome/MegaMenu.tsx` predates
that handoff. Designing reachability around a header entry that may not survive would make
our pages unreachable through no fault of ours.

The property is unchanged and still the one that matters: **a 200 that nothing links to has
not been delivered.** `ShowSectionNav.tsx`'s own header comment records that
`/national-show/archive` returned 200 for months with nothing linking to it.

Every one of the 17 listed pages must be reachable by clicking from **both** surfaces we own:

| surface | why it is ours |
|---|---|
| the `/national-show` hub, in its four group sections | see `goldens/m4/hub-groups.golden.md` |
| `components/show/ShowSectionNav.tsx` — `SECTION_LINKS` | ours, and it exists precisely because of the archive incident |

"Both", not "at least one" — that is a deliberate tightening against revision 1. With no
header dropdown, these two surfaces are the *entire* navigation for the subsection, and a
page present on only one of them is one edit away from being unreachable.

The `/societies` link (spec entry 14, which gets no page of its own) lives on one of these two
surfaces (`R4`).

---

## 8. Lane boundaries — rewritten at revision 4

The other lane's constraint on its routes is **identity, not ownership**. Cross-cutting change
to the components they render is *expected*; what may not change is **what a visitor sees**.
So these are proved by **rendered-output snapshots**, never by a path check on `page.tsx`.

| what | how it is proved |
|---|---|
| `/national-show/tickets`, `/conferences`, `/exhibitors`, `/vendors` (+3 sub), `/archive` (+`[year]`), and site-level `/sponsors`, `/judging`, `/contact`, `/societies`, `/media-kit`, `/about` | **`S1`** — normalised rendered output identical to a pre-M4 baseline |
| `/national-show/exhibitors` is still the grower entry guide at its own slug | **`S2`** — identity stated positively |
| the baseline was captured before M4, not regenerated from the current tree | **`S3`** |
| no baseline was regenerated to hide a collision | **`S4`** |
| `components/chrome/**`, `next.config.ts` | **`D42`** — a path diff, because *file ownership* is genuinely the property here |

**Why the rewrite.** A path check on `exhibitors/page.tsx` passes while a shared component
underneath changes what that route renders — the assertion is satisfiable without the property
it claims to prove. That is this repo's audited defect class, arriving in a new variant, and it
was found by M4's own sweep of `components/show/`.

**`components/show/**` is NO LONGER a boundary.** The other lane handed it over: all of it
renders under `/national-show`, and splitting it by route would be a fiction.

**Base ref and delivery.** `D42` diffs against the **PR base**, not `HEAD`. Delivery is
`nos-site` → **pull request** → the other lane reviews the diff against the six briefed routes,
runs it locally, puts independent Codex on it, CI green, *then* merge. **Nothing in this
contract assumes a direct merge to `main`**, and a `HEAD` baseline would report clean whatever
had already been committed.

## 9. The route manifest artifact

The `saoc-eb` lane wires its header from this file **without reading our code**, so a
manifest that has drifted from reality is worse than none — they build from it and never find
out. Schema and both-directions rules: `goldens/m4/route-manifest-schema.golden.md`.

**Path:** `content/national-show-routes.json` — tracked, adjacent to `content/show-pages/`,
deliberately outside `app/` so it cannot pull M4 into a different triad classification.

---

## 10. `app/sitemap.ts` — authorised, and scoped to the NOS block only

**Authorised by the `saoc-eb` lane.** `NATIONAL_SHOW_CHILD_ROUTES` derives from
`content/national-show-routes.json`.

**Scope: the `/national-show/*` block ONLY.** The SAOC static routes and the Sanity
society/event blocks stay untouched — they are the other lane's and they are not what drifts.

This is not hypothetical drift. That file **today**:

- lists `/national-show/upcoming`, a route M4 deletes;
- omits `what-to-expect`, `plan-your-visit`, `faq`, `workshops`, `exhibitors`, `vendors` and
  `tickets` entirely.

**The `upcoming` row needs no separate deletion.** Deriving from the manifest means a route
that is not in the manifest stops existing in the sitemap. Which gives the cheapest possible
test of whether the derivation is real: **`RM3` asserts the derived block emits no `upcoming`
row.** A derived block that still emits it is a hand-kept list wearing a generated one's
clothes.

`RM2` cross-checks `indexable: true` ↔ present and `indexable: false` ↔ absent, both
directions. `RM3` additionally pins the SAOC static and Sanity blocks byte-unchanged.

## 11. `/national-show/about` — deployed, cross-owned, and its seed is broken

Two things the merge exposed, both of which would have caused real damage if @dev had worked
from revision 2.

### It is another mission's page, and M4 must not repoint it

`app/(marketing)/national-show/about/page.tsx` came in with `9fa4067e`, serves live, and
renders Lee-Ann's copy verbatim from `docs/leeann-source/about-national-show_2026-09-09.md`.
Four assertions in `specs/site-content-alignment/contract-f3.yaml` are live against it —
`A2` (three canary phrases under the route dir), `A4` (the outbound `wildorchids.co.za` link),
`A11` and `A12` (the literal `href` entries, see `hub-groups.golden.md`).

It is **hardcoded JSX**, not a `loadShowPage` consumer. "Reconcile onto its showPage document"
would mean rewriting a deployed, correct, canary-guarded page onto a data path — a change with
**no benefit to this milestone and real risk to another mission's green gate**. M4 does not do
it. `D69` pins their canary phrases and their WOSA link as a regression guard on our side.

### Its seed is an incomplete extraction, and the linkage check cannot see it

| | chars |
|---|---|
| `content/drive-source/.../2.1 About - 2027 National Show/v1.0/content.md` | 2,587 |
| `docs/leeann-source/about-national-show_2026-09-09.md` | 2,911 |
| the deployed page | renders both in full |
| **seed `content/show-pages/02-about-the-national-show.json`** | **1,372** |

All six of the seed's sentences occur on the page — the seed is a **strict subset**. Missing
from it, and present in *both* source documents and on the live page: the
vendors-and-sponsors paragraph ("leading national and international orchid vendors… deeply
grateful to its headline sponsors") and the closing paragraph ("Whether you are an experienced
orchid grower…").

**Had M4 repointed `/about` onto `loadShowPage`, roughly half of Lee-Ann's About copy would
have vanished from a live page, and every existing check would have stayed green.** The
content-linkage check is one-directional by construction: it proves that what *is* in the body
occurs in the source. Nothing proved that what is in the source made it into the body.

`D65` (`CL5`) closes that direction across the whole corpus. **The resolution is always to
complete the seed from the source, never to trim the page to match the seed.**

This is the same defect class the project has audited before — an assertion satisfiable by
something that is not the real property — arriving from the opposite direction.

---

## Discrepancies found while writing this file — for Brad and the lead

These are stated rather than encoded as guesses.

1. **`.agent/memory/project/rules.md` has NOT been updated.** The brief says the approved
   rulings were "just appended" there. Lines 82–100 still carry the **16-page** version:
   `/sponsors` is listed as link-out-only, `/wosa` is inside Programme with `conferences`,
   and there is no mention of `/upcoming` being deleted or of `/sa-exhibitors` and
   `/international-guests` being real empty listings from a `vendorNursery` scope. This
   golden encodes **the brief**, which is Brad's direct instruction and therefore
   authoritative under `docs/rules/no-invention.md`. `rules.md` should be brought into line
   so the two do not disagree in the record.
2. **R11, R12 and R13 are not in the design-rulings mirror.**
   `.agent/memory/project/design/nos-design-rulings.md` carries R1–R10 only. The mirror's own
   header says it is read-only and replaced by text Codi sends. M4 encodes R11–R13 from the
   brief; **Codi should send the mirror text** so a contract can cite a ruling by number
   against a record that contains it.
3. **`docs/rules/no-invention.md` currently contains unresolved merge-conflict markers**
   (`<<<<<<< HEAD` at line 56, `>>>>>>> origin/main` at line 67). Not ours to resolve
   mid-task, and not blocking, but a binding rules file in a conflicted state should not
   stay that way.

## What this golden does not settle

- **Whether the `saoc-eb` lane actually consumes the manifest.** We assert it is correct;
  nothing here asserts they read it. That is a cross-lane integration risk owned by the lead.
- **Label wording.** `label` is what their header displays. Ours are taken from the page
  titles; different labels are a conversation, not a defect.
- **The FAQ copy.** Blocked upstream on a truncated Drive `.docx`. M4 reconciles the page and
  does not write answers.

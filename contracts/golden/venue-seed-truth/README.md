# venue-seed-truth — what this contract is and is not

## The chain of events

1. The web team invented "Cape Town International Convention Centre" (CTICC) as a
   working-venue placeholder for the 2027 National Show, before any venue was booked.
   It was researched honestly and marked `research`/`pending` throughout, never
   presented as confirmed.
2. On 2026-08-12 the client (Lee-Ann) confirmed via WhatsApp that the real venue is
   **The Hangar, Stellenbosch Flying Club**, Stellenbosch Airfield, R44, Stellenbosch
   7600, Western Cape (~-33.9794, 18.8196).
3. The orchestrator corrected the **live Sanity dataset** (content-only, committed as
   427fbaf + a follow-up flipping `showVisitorInfo.confirmations.venue` to
   `confirmed`) by sweeping the dataset for venue **name-identity** strings (CTICC,
   Cape Town International Convention, Foreshore-as-address, the old coordinates) —
   this sweep was name-anchored only. It did not, and could not, catch venue
   **characteristic** prose that described the old venue's physical traits without
   naming it ("a modern convention centre with step-free access", "several parking
   garages", "half an hour from Cape Town International"). Three FAQ documents
   carrying exactly that kind of prose were missed and are fixed by
   `contracts/contract-venue-prose-residue.yaml` — see
   `contracts/golden/venue-prose-residue/README.md` for the full defect class.
4. **What is NOT fixed**: the repo's seed sources still carry the CTICC placeholder.
   Every seed write in this project is `createIfNotExists` / `setIfMissing`, so today
   these stale sources are inert — they cannot clobber the corrected dataset. But if
   the dataset is ever rebuilt from empty (new environment, disaster recovery, a fresh
   preview dataset), the site regresses straight back to CTICC. That regression path
   is the entire scope of this contract.

## What this contract does NOT do

- It does not touch the live Sanity dataset. Every dataset-facing assertion is
  read-only (`GET /data/query/...`). If you find yourself wanting to write a fix
  verification that mutates the dataset, stop — assert on the seed source instead.
- It does not invent new venue detail (transport routes, accommodation, opening
  hours) for the Hangar. The orchestrator deliberately **cleared** those sections in
  the dataset rather than fabricate airfield-specific content, and the seed sources
  must reproduce that same cleared shape — not reintroduce invented CTICC content,
  and not invent new Hangar content either. "Not confirmed" is the correct state for
  travel/accommodation detail until the show committee supplies it.

## A miss the original brief did not catch

`scripts/seed-show-visitor-info.ts:124` seeds `phone: '+27 21 410 5000'` — the CTICC
switchboard number. It matches none of the specified CTICC-anchored strings (no
"CTICC", no "Cape Town International Convention", etc.), so a naive denylist grep is
structurally blind to it. The live dataset's `nationalShow.venue.phone` is now `null`
(no confirmed number for the new venue yet). A11 in the contract catches this
specifically — it is the reason `expected-venue.json` carries an explicit
`"phone": null` and why this contract does not rely on the denylist alone.

## The negative-control roster (must NOT change)

These are legitimate, different venues for past shows and society meetings. A naive
find-and-replace on "Cape Town" or "Civic Centre" would corrupt them, which is why
neither string is on the denylist — only venue-specific phrases are
("Cape Town International Convention", "Civic Centre station", "Foreshore", "MyCiTi",
"Convention Square", "Lower Long Street", "CTICC").

| File | Venue | Why it must survive |
|---|---|---|
| `lib/data/shows.ts` | Durban ICC, Walter Sisulu NBG, Cape Town City Hall, NMBay Boardwalk, Bloemfontein Showgrounds | Past national show venues (editions 14–18) |
| `lib/data/events.ts` | Kirstenbosch Hall Cape Town, Bloemfontein Civic Centre, Stellenbosch University(+BG), Walter Sisulu NBG Roodepoort, Durban Botanic Gardens, etc. | Society meeting/show venues, several genuinely in Cape Town or genuinely a "Civic Centre" |
| `lib/data/societies.ts` | Witbank Civic Centre, Stellenbosch University Botanical Garden | Society meeting venues |

See `legitimate-other-venues.golden.md` for the exact strings the contract checks.

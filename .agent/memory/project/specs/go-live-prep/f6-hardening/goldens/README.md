# F6 hardening bundle -- goldens (go-live-prep, M3/F6)

Brad's order 2026-11-02: security and technical strength only, no copy changes.
Base: origin/main d7838cae. Contract: `../contract.yaml`. Checks: `contracts/checks/go-live-f6/`.

## Bundle membership

| Item | In bundle | Why |
|---|---|---|
| H12 door-seed live guard + fixture slug + reserved expiresAt | yes | open on main |
| /members noindex | yes | open on main |
| Ticket hub / JSON-LD wrong-show filter | DROPPED | already on main: `sanity/queries.ts` activeTicketTypesByCategoryQuery selects `show`; `lib/data/ticket-hub-source.ts` buildHubCards filters with `ticketTypeMatchesActiveShow` and takes `activeShowId`; `lib/data/national-show-offers.ts` buildShowOffers passes it through; `contracts/checks/onsale-followups/check-hub-show-filter.mts` exists |
| Vacuous ticket-onsale-predicate A7 | DROPPED | already on main: A7 is now `python3 contracts/checks/onsale-followups/check-national-show-not-prerendered-admin.py .` (no sed/`$p`), pinned by `check-a7-rewired.sh` |
| /members in a sitemap | no change | not present in `lib/saoc-sitemap-routes.ts` or `app/sitemap.ts` (polish-wave-2026-10-25 F3 removed it); kept as a regression guard inside the members check |
| /tickets/cancelled, /recover, /confirmation noindex | no change | all three already carry `robots: index false, follow false`; guarded in the members check |

## H12 design decisions

1. Live project is the literal `saoc-webapp` (`.firebaserc` default). There is only one Firebase project in this repo's config, so on this machine `seed` is now unrunnable by design. That is the intended outcome; a separate fixture project or the emulator is the only target.
2. Guard input is the merged view of `FIREBASE_ADMIN_PROJECT_ID` (process env first, local dotenv fallback, exactly the existing `admin()` order). Refuse when: the id is unset or blank (fail closed); the id, case-folded and trimmed, equals the live id; or `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT` is the live id; or the service-account email contains the live id. A mismatched pair (benign admin id, live service account) is the realistic way to hit live by accident, hence the extra tests.
3. No bypass: no flag, no env var, no second argv. `door-seed-static.mjs` greps for the vocabulary; `door-seed-cli-refusal.mjs` proves `--force`, `--allow-live` and an allow-live env var change nothing.
4. The guard runs inside the exported `seedFixtureDoc` (before `db()`), not only in `main()`, so a script that imports it is still blocked. `teardown` is deliberately NOT gated: it deletes only the three exact bookingRefs and is the route to clean any earlier residue from the live project.
5. Required exports from `scripts/seed-door-test-tickets.ts` (the checks import them): `LIVE_PROJECT_ID`, `FIXTURE_TICKET_TYPE`, `assertSeedTargetAllowed(env) -> string` (throws `Error` whose message starts `door-seed refused:`), `buildFixtureFields(fixture, now: Timestamp) -> Record` (pure; no `undefined` own property), plus the existing `FIXTURES`, `seedFixtureDoc`, `generateOutput`, `teardown`, `SEEDED_BOOKING_REFS`.
6. ASSUMPTION (flag for review): "its own fixture slug" is read as the ticketType slug, `door-qr-fixture`, not the showId. `lib/checkin.ts:88` returns wrong-show for any showId other than `nationalShow` before it inspects status, so moving ADMIT and UNPAID to another showId would make the admit and unpaid door outcomes unreachable. The ticketType slug matches no Sanity product, so the fixtures cannot be counted into the exhibitor or any real product ledger. The showId-level protection is the live refusal. WRONGSHOW keeps its own showId `door-qr-check-wrong-show`.
7. Reserved fixture: `expiresAt` = seed time minus 60 seconds (born expired, never a live hold). All other fixtures carry `expiresAt: null` so the field set is uniform.
8. Retired: former A2-A5 of `contracts/contract-door-test-qr-seeder.yaml` and their five scripts (`_shared.mjs` and four checks). Their only possible target was the live project. A7 is rewired to call `generateOutput()` offline. `docs/door-test-qr-seeder.md` (the "A5 RED" note, the exhibitor wording) is for @docs.

## Failure modes the checks name

| Check | Fails when |
|---|---|
| A1 guard.mts | the guard allows `saoc-webapp` in any spelling; allows an unset, empty or blank id; allows a live service account, public client id or GOOGLE_CLOUD_PROJECT behind a benign admin id; honours a bypass-looking key; blocks a genuinely non-live id (blanket block); `seedFixtureDoc` can run without the guard; a fixture still has ticketType `exhibitor`; fixture fields drift from `fixtures.golden.json`; a field is `undefined`; a reserved fixture has no `expiresAt` or one in the future; a non-reserved fixture has a non-null `expiresAt` |
| A2 cli-refusal | the real `seed` entry point reaches credential parsing with a live, unset or blank id; a flag or env var changes the outcome; the refusal message is missing; the non-live control is refused |
| A3 static | the script reads argv beyond the command or names a bypass flag/env var; the guard is missing or comes after `db()`; teardown stops using exact `bookingRef ==` matching, sweeps by prefix, suffix or email, reads the whole collection, or becomes gated; SEEDED_BOOKING_REFS stops tracking `seededInFirestore`; fixtures keep the exhibitor slug; the residue-scanner exemption disappears |
| A4 members | `noIndex: true` is absent; a hand-rolled `robots` block is used; title, description, path or lede differ from `members-metadata.json` (copy change); `/members` enters a sitemap; cancelled, recover or confirmation lose noindex |
| A5 legacy A7 | the QR sheet or manifest drifts from `fixtures.golden.json`, or the ADMIT QR no longer decodes to the bare bookingRef |
| A6 contract validity | the legacy door contract no longer validates |

## Merge note (do not edit the other branch)

Unmerged branch `fix/sec-abuse-controls` carries a retired-slug guard (its assertion A26) that exempts the exact `exhibitor` lines in `scripts/seed-door-test-tickets.ts`. After F6 those lines no longer exist (ticketType becomes `door-qr-fixture`), so the exemption will be dead or the guard will see the new strings. Whoever merges that branch second must drop or re-point the A26 exemption for this file. Nothing here touches that branch.

## What the checks cannot prove

- That the guard blocks a `.firebaserc` default or application-default credentials: the seeder only ever reads the three explicit variables, so ADC is out of its reach; a future change adding ADC would need its own test.
- That Firestore-level behaviour (idempotent reseed, teardown scoping against a real control document) still holds: the live checks that proved it were retired because they could only run against the live project. Re-prove against an emulator or a separate project if that path is ever revived.

# Societies content (mission societies-content, M1/F1)

The site lists the 21 affiliated societies in Lee-Ann's Drive documents, and only those. Her text
is reproduced exactly (see [rules/no-invention.md](rules/no-invention.md)). Nothing is deleted.

## Sources and precedence

| Doc | Drive modified | md5 | Societies |
|---|---|---|---|
| (a) `All Society data and history` | 2026-10-21 | `ccc3d825...` | 12, field-detailed |
| (b) `Society Contact list - Word` | 2026-08-12 | `21926d75...` | 21, one table cell |

Both live under `content/drive-source/SAOC /3. Societies/` (note the trailing space in `SAOC `),
refreshed by `execution/drive_docx_sync.py`. (a) wins field by field; (b) only fills a field (a)
left empty (no fills were needed). Final: **21 listed, 16 hidden (`listed: false`), 37 society
documents.**

## Code

- `lib/societies/drive-parse.ts` — pure parsers, `mergeSocieties`, `CONTACT_LIST_ALIASES`,
  `toDocFields`, `DRIVE_SOURCE_TAGS`.
- `lib/societies/drive-sync-plan.ts` — planner (CREATE / PATCH / HIDE / NOOP) and `DocStore`.
- `lib/societies/drive-sync-store.ts` — fixture and Sanity stores.
- `scripts/sync-societies-from-drive.ts` — CLI, `pnpm sync:societies`.
- `components/societies/SocietyCommittee.tsx`, plus additions to `SocietyFacts` / `SocietyAbout`.

## Field mapping (doc label to Sanity field)

| Doc label | Field |
|---|---|
| `# Name` | `name`, `slug.current` |
| Public contact email / telephone | `contactEmail`, `contactPhone` |
| Meeting day + time | `meets` = `"<day>, <time>"` (`10:00:00 AM` becomes `10:00 AM`) |
| Meeting venue | `venue` |
| Chair/President, Secretary, Treasurer, Liaison | `committee[]` (`societyCommitteeMember {role, name}`) |
| Additional committee information / comments | `committeeNote` (internal, never projected or rendered) |
| Society website / Facebook / Instagram | `website`, `facebookUrl`, `instagramUrl` (http(s) kept; `www.` gets `https://`; `@handle` becomes an Instagram URL; anything else is null with a WARN) |
| Annual show | `annualShow` |
| History paragraphs | `description` |
| n/a | `listed` (default true), `driveSource` (document versions and md5s) |

`Not supplied` and the history sentinel become null. `founded` and `memberCount` are cleared on
every synced document (they were our own estimates); their placeholder flags are false. Province
and region of an existing document are left alone and nothing is inferred for new ones.

## Disposition

PATCH 5 existing documents (Cape, Eastern Province, Natal, East Rand, Border), CREATE 16 (`_id =
society-<slug>`), HIDE 16 (`listed: false`, nothing else changed): Transvaal and Northern Transvaal
(renamed Witwatersrand and Northern Gauteng per the 21 Oct doc), Lowveld Orchid Society and South
Cape Orchid Society (superseded near matches), and 12 societies in no Drive doc. The ids are in the
CLI. `/societies/<hidden>` now returns 404; no redirects were specified.

Queries (`societyListQuery`, `societyBySlugQuery`, `societySlugsQuery`, and the llms refresh) filter
`listed != false`, so the sitemap and static params follow. The hardcoded `lib/data/societies.ts`
fallback applies only when the Sanity client is not configured. `scripts/seed-sanity.ts` no longer
seeds societies.

## Alias table and CONFLICT list

Aliases (same body by venue and people; flagged for Lee-Ann): `Die Vlakte Orchid Society` is
`Vlakte Orgideevereniging`; `Pietermaritzburg Orchid Society` is `Pietermaritzberg Orchid Society`.
The detailed doc's spelling is kept. The merge throws on any unmatched society.

CONFLICT (detailed wins, printed by the dry-run): Vlakte (`ronel.eksteen29@` vs
`ronel.eksteenza@`), Tygerberg (`tygerbergorchidgroup@` vs `tygerorchidgroup@`), Northern Gauteng
(`info@northerngautengorchidsociety.com` vs `ngos@saoc.co.za`), Pietermaritzberg (`carolcook588@`
vs `YoungA@ukzn.ac.za`), Gonubie (`annettebrown100@` vs `gonubieorchidos@`).

Four WARNs: Zululand website, Facebook and Instagram are the literal text "Zululand Orchid
Society"; Pietermaritzberg website is "Do not have a website". Stored as null.

## Re-sync procedure

1. `python3 execution/drive_docx_sync.py` to refresh `content/drive-source/`.
2. `pnpm sync:societies` (dry-run, the default). Read WARN, CONFLICT and the plan.
3. Operator only: `pnpm sync:societies --apply`. It backs up every society document (published and
   drafts) to `.tmp/sandbox/societies-content/backup/<ISO>.json`, verifies the count, then patches
   each document locked to its revision (`ifRevisionID`). A second run is a no-op (`noop=37`). Any
   unknown society document prints `UNLISTED <id>` and exits 3 before any write.

## Open questions

1. Province and region are missing for 16 listed societies (neither doc has a province column).
   They show under All only until Lee-Ann supplies them.
2. Confirm the two alias pairs and the two superseded near matches (Lowveld Society/Group, South
   Cape/Orchid Society of the Southern Cape) are the same bodies.
3. Which email is right where the docs conflict (five societies above).
4. Tygerberg's secretary asks for a vice president (Byron Gopper) and AGM-elected members to be
   added. A request to the webmaster, not publishable copy: kept in `committeeNote`, not shown.
5. Which spelling is right: "Pietermaritzberg" (21 Oct) or "Pietermaritzburg" (12 Aug); "Vlakte
   Orgideevereniging" or "Die Vlakte Orchid Society".
6. Contact-list-only societies have no committee, history or links; Plantae has no venue or meeting.
7. DECISION NEEDED (Brad), later: delete or keep the 16 hidden documents. Recommendation: keep
   hidden until Lee-Ann confirms the list.

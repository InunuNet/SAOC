# societies-content (M1-F1) — design and dev brief (amended 2026-10-23 per orchestrator decision)

Contract: `contract-f1.yaml` in this folder (17 assertions, validates --strict). Goldens: `goldens/`. Pinned checks (architect-authored, @dev must not edit): `checks/`.

## Decision (orchestrator, 2026-10-23)
The site lists every society that exists in Lee-Ann's docs, and only those: the 21 in "Society Contact list - Word". Precedence: (a) "All Society data and history" (21 Oct, md5 ccc3d825, 12 societies) beats (b) "Society Contact list - Word" (12 Aug, md5 21926d75, 21 societies) field by field. Final: **21 listed, 16 hidden (`listed:false`), 37 society docs, nothing deleted.** Deletion of the 16 stays Brad's later call.

## Binding rules
- `docs/rules/no-invention.md`: no copy beyond Lee-Ann's docs. Visual: `design/design_handoff_saoc/` tokens and existing component classes only.
- CLAUDE.md: TS strict, no `any`; builders coalesce optionals to `null` (A1 asserts no `undefined` own-properties).
- Back up before any Sanity edit; `ifRevisionID` on every patch; never delete a document.
- Sources (note the trailing space in `SAOC `): `content/drive-source/SAOC /3. Societies/All Society data and history/v1.0/content.md` and `.../Society Contact list - Word/v1.0/content.md`; md5s in the sibling manifest.json files.

## Verified before finalising (mismatch report)
- The contact list parses to exactly 21 entries (A1 asserts it).
- Every one of the 12 detailed societies matches exactly one contact-list entry: 10 by exact name, 2 by an explicit alias table (below). 9 contact-list entries have no detailed record. 12 + 9 = 21, so the listed set equals the contact list. No (a) society is absent from (b).
- **Alias table `CONTACT_LIST_ALIASES`** (contact-list name -> detailed-doc name), the only non-exact matches, same body by venue/people, flagged for Lee-Ann to confirm: `Die Vlakte Orchid Society` -> `Vlakte Orgideevereniging` (same NG church, Bela-Bela, same secretary email stem); `Pietermaritzburg Orchid Society` -> `Pietermaritzberg Orchid Society`. The detailed doc's spelling is kept (Lee-Ann's newer, field-detailed doc; "Pietermaritzberg" is as she wrote it). The merge throws on any unmatched society, so a future doc change cannot silently drop one.
- Spelling variance within the 21 Oct doc ("Pietermaritzberg") against the 12 Aug list ("Pietermaritzburg") is a Lee-Ann question, not ours to fix.
- Email conflicts (detailed wins, printed as `CONFLICT` in dry-run, pinned in `goldens/merge-report.json`): Vlakte (`ronel.eksteen29@` vs `ronel.eksteenza@`), Tygerberg (`tygerbergorchidgroup@` vs `tygerorchidgroup@`), Northern Gauteng (`info@northerngautengorchidsociety.com` vs `ngos@saoc.co.za`), Pietermaritzberg (`carolcook588@` vs `YoungA@ukzn.ac.za`), Gonubie (`annettebrown100@` vs `gonubieorchidos@`). Venue and meeting wording also differs between the docs for most of the 12; (a) wins; no fills were needed (a has every email, venue and meeting).

## Provenance of the 21 existing Sanity docs
All came from the hardcoded array in `lib/data/societies.ts` (commit b3e71b12, 2026-04-21; copied in 6451883f), pushed by `scripts/seed-sanity.ts` `mapSocieties()` (729becc9, 2026-06-08, `createOrReplace`). Both files say the array is "our own estimate"; founded years and member counts are flagged placeholders, meet/venue were left empty. `pnpm seed` would overwrite the patched docs and resurrect the hidden ones, so society seeding is removed (A8).

## Disposition (`goldens/disposition.json`)
- PATCH 5 existing docs (keep `_id`, slug, province, region): Cape, Eastern Province (detailed + list), Natal, East Rand, Border (list only). Their `founded`/`memberCount` are unset, placeholder flags false. Province/region kept because each is consistent with Lee-Ann's venue (Cape: Newlands, Cape Town / WC; Eastern Province: Newton Park, Gqeberha / EC; Natal: Durban North / KZN; East Rand: Edenvale, Gauteng / GP; Border: East London / EC). Nothing new is inferred.
- CREATE 16 (`_id = society-<slug>`, no province/region): the 10 detailed societies not already in Sanity (Zululand, Highway, Vlakte, Walker Bay, Tygerberg, Northern Gauteng, Pietermaritzberg, Witwatersrand, Orchid Society of the Southern Cape, Gonubie) and the 6 contact-list-only (Alfred County, Lowveld Orchid Group, Phalaborwa, Plantae Orchid Group, Rustenburg, Wolkberg).
- HIDE 16 (`listed:false`, nothing else changed): 2 renamed bodies (Transvaal -> Witwatersrand, Northern Transvaal -> Northern Gauteng, per the 21 Oct doc's own history text); 2 superseded near matches that I flag for Lee-Ann to confirm are the same bodies (Lowveld Orchid Society -> Lowveld Orchid Group, South Cape Orchid Society -> Orchid Society of the Southern Cape); 12 in no Drive doc (West Rand, Highveld, Free State, Garden Route, Overberg, Winelands, Midlands, North Coast, Kalahari, Limpopo, North West, Vaal Triangle). The reason per doc is in disposition.json. Old URLs of hidden societies now 404; no redirects were specified (Brad's call).
Founded: Cape's 21 Oct prose says "Founded in 1957" but that is prose, not a mapped field, so `founded` stays empty.

## Parsers and mapping
Module `lib/societies/drive-parse.ts` (pure, no I/O). Exports: `parseSocietiesMarkdown(md) -> {societies, warnings}` (a), `parseContactListMarkdown(md) -> {entries}` (b), `mergeSocieties(detailed, contacts, aliases = CONTACT_LIST_ALIASES) -> {societies, report}`, `toDocFields(merged, DRIVE_SOURCE_TAGS)`, `DRIVE_SOURCE_TAGS {detailed, contactList}` (`<file name>@v<version>#<md5>`, from the manifests). Shapes pinned by `parsed-societies.json`, `parsed-contact-list.json`, `merge-report.json`, `sanity-docs.json`.

(a) mapping:
| Doc label | Sanity field |
|---|---|
| `# Name` | `name`, `slug.current` (slugify: lowercase, NFKD, strip diacritics, non-alnum to `-`, as seed-sanity) |
| Public contact email / telephone | `contactEmail`, `contactPhone` (new strings, verbatim) |
| Meeting day + time | `meets` = `"<day>, <time>"`; `H:MM:00 AM/PM` becomes `H:MM AM/PM` (spreadsheet artifact) |
| Meeting venue | `venue` |
| Chair/President, Secretary, Treasurer, Liaison for communication | `committee[]` of new object type `societyCommitteeMember {role, name}`, `_key` chair-president/secretary/treasurer/liaison, roles labelled as in the doc, null roles omitted |
| Additional committee information / comments | `committeeNote` (internal; stored, never projected or rendered) |
| Society website | `website` (url): http(s) as-is; `www.` gets `https://`; else null + WARN |
| Facebook page | `facebookUrl` (url): http(s) only, else null + WARN |
| Instagram page | `instagramUrl` (url): http(s); `@handle` becomes `https://www.instagram.com/handle/`; else null + WARN |
| Annual show | `annualShow` (new string) |
| Unlabelled history paragraphs | `description` |
| — | `listed` (boolean, initialValue true), `driveSource` (provenance: both tags joined by ` + ` when merged, the contact-list tag alone otherwise) |

(b) parser: the table is one cell. Strip the leading `| ` and trailing ` |`, NBSP to space, split on `**Name**`, collapse whitespace, drop a trailing ` |` (Natal's cell break). Per entry: trailing `x@y` token is `email`; `Venue: ... Meeting: ...` (Plantae has neither; Rustenburg has no Time); `| Time: <t> <note>` gives `time` with `NNHNN` or `NNhNN` rewritten `NN:NN` (punctuation only; `09:30` unchanged) and any trailing text kept as `timeNote` (Zululand "(except December)"). "Please email to confirm ..." text is Lee-Ann's wording and is kept verbatim as `venue` / `meeting`, no interpretation. The list's closing sentence is ignored. An entry body that fits no known shape throws. For a contact-list-only society: `contactEmail` = email, `meets` = `"<meeting>, <time> <note>"` (or just meeting/none), `venue` = venue, everything else null, so Plantae is name + email only with the "to be confirmed" markers (`meetPlaceholder`/`venuePlaceholder` true when null).
Merge: (a) value wins; (b) fills only a field (a) left null. Output order: the 12 detailed in doc order, then the 9 contact-list-only in list order.
Absent values: `Not supplied`, `A society history or profile was not supplied in the form.`, empty sections -> `null`. Markdown escapes (`\_`) undone; text never edited ("Ronald O’Donoghu", lowercase "presbyterian Church" stay). Unknown section/label, duplicate slug, a detailed society with no contact-list match: throw.
Every synced doc: `foundedPlaceholder` and `memberCountPlaceholder` false, `founded`/`memberCount` empty.
Four WARNs pinned: Zululand website/facebook/instagram are the literal text "Zululand Orchid Society" (source.docx has no hyperlink relationships, so nothing was lost in export); Pietermaritzberg website is "Do not have a website".

## Sync script `scripts/sync-societies-from-drive.ts`
Pattern: `scripts/unpublish-invented-events.ts` (env parsed straight from `.env.local`, no dotenv, token never printed). Planner `lib/societies/drive-sync-plan.ts`; `DocStore` interface with Sanity and fixture implementations. Exit 0 ok / 2 usage / 3 unexpected state. Flags: `--apply` (default dry-run), `--fixture-docs <json>`, `--fixture-out <json>` (with --apply and fixtures; honours and bumps `_rev`), `--backup-dir <dir>` (default `.tmp/sandbox/societies-content/backup`). Add npm script `sync:societies`.
1. Read published `_type == "society"` docs with `_rev`; match the 21 merged societies by exact name. Match: PATCH (set changed fields, unset `founded`/`memberCount`; slug, province, region untouched). No match: CREATE via createIfNotExists, `_id = society-<slug>`; an existing doc at that `_id` under another name aborts (exit 3).
2. The 16 ids in `disposition.json` (hardcoded in the script) get HIDE (`listed:false`, ifRevisionID, nothing else). Any other society doc outside the 21 and the 16 prints `UNLISTED <id>` and exits 3 before any write.
3. `--apply`: back up all society docs (published and drafts) to `<backup-dir>/<ISO>.json`, re-read and verify the count, then each patch is a transaction locked to its fetched `ifRevisionID`; a stale revision fails and stops. Warn if a draft exists for a touched id.
4. Null equals absent in comparison, so a second run is `noop=37`. Output is `goldens/dry-run-output.txt` exactly (header with both sources and md5s, parsed counts, WARN, CONFLICT, CREATE/PATCH, HIDE, SUMMARY, closing line). Nothing deletes or unpublishes.

## Rendering
- `sanity/queries.ts`: list, by-slug and slugs queries add `&& listed != false`; list and by-slug add `contactEmail, contactPhone, committee[]{role,name}, facebookUrl, instagramUrl, annualShow`; never `committeeNote`. `scripts/refresh-llms.ts` filters too. Sitemap and `generateStaticParams` follow via `societySlugsQuery`.
- `SanitySociety` gains the new nullable fields. The `staticSocieties` fallback applies only when the Sanity client is not configured (`client === null`, `sanity/lib/client`); with Sanity configured and a null result `/societies/<hidden>` 404s. Remove `mapSocieties()` from the seed run; delete `lib/data/societies.ts` only if nothing imports it afterwards.
- Detail page: `SocietyFacts` adds public email (mailto), telephone (tel), annual show beside Meets/Venue, same dl markup. New `SocietyCommittee` (exported from `components/societies/index.ts`, after `SocietyAbout`): role/name rows as stored, nothing when no committee. `SocietyAbout` adds Facebook and Instagram links beside the website link and prints `description`. Every row is omitted when null: no empty labels, no "Not supplied", no placeholder marker for these fields. Contact email/phone exist only where a Lee-Ann doc supplies them (contact-list emails come from a list headed "contact the society closest to you", so treated as public).
- Cards and listing unchanged. The 16 new societies have no province, so they appear under All only. Static copy not in the docs (the "21 societies" lede, generic About paragraph) is untouched and stays flagged. The site-wide "21" now matches the 21 listed.
- Docs: `docs/societies-content.md` (A16): mapping, disposition, CONFLICT list, open questions, re-sync procedure (`drive_docx_sync.py`, then the script).

## Lee-Ann doc gaps and open questions
1. **Province/region missing for 16 listed societies** (all but Cape, Eastern Province, Natal, East Rand, Border): neither doc has a province column. For the orchestrator to put to Lee-Ann. Until then they show under All; the chips filter them out.
2. Confirm the two alias pairs and the two superseded near matches (Lowveld Society/Group, South Cape/OSSC) are the same bodies.
3. Which email is right where the docs conflict (5 societies above).
4. Tygerberg's secretary asks for a vice president (Byron Gopper) and AGM-elected members to be added. A request to the webmaster, not publishable copy: stored in `committeeNote`, not shown. Needs her say-so.
5. Which spelling is right: "Pietermaritzberg" (21 Oct) or "Pietermaritzburg" (12 Aug); "Vlakte Orgideevereniging" or "Die Vlakte Orchid Society".
6. Contact-list-only societies have no committee, history or links; Plantae has no venue or meeting at all.
7. DECISION NEEDED (Brad), later: delete or keep the 16 hidden docs.

## Risks
- Hidden societies' old URLs 404 until redirects are decided.
- `revalidate = 60` plus CDN: a hide shows within about a minute; run A15 after that or on a fresh build.
- A14/A15 need the operator-authorised live `--apply` (read-only checks afterwards); A1-A13 and A17 do not.

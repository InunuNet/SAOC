# F6 — Page Singleton Documents: Assessment & Remediation Plan

Mission: `studio-next16-upgrade`, M3/F6. Assessment only — no documents created, no code
changed. Dataset queried read-only (`production`, 94 docs, pre-production placeholder
content).

---

## 1. What singleton schemas exist

Defined in `sanity/schemas/index.ts:1-33`, six document types are commented `// Singletons`:

| Schema (`name`) | File | Fields | Required? |
|---|---|---|---|
| `homePage` | `sanity/schemas/documents/homePage.ts` | `title` (string), `heroImages` (image[]), `missionText` (text), `countdownDate` (datetime) | none marked required — all `defineField` calls have no `validation` |
| `aboutPage` | `documents/aboutPage.ts` | `title`, `pillars` (portableText), `timelineNodes` (portableText), `boardIntroText` (text) | none required |
| `nationalShow` | `documents/nationalShow.ts` | `title`, `showDate` (datetime), `location`, `hero` (image), `countdownDate` (datetime), `exhibitorStages` (portableText) | none required |
| `contactPage` | `documents/contactPage.ts` | `title`, `directContacts` (array of {name, role, email}), `formRecipients` (array of string) | none required |
| `judgingPage` | `documents/judgingPage.ts` | `title`, `intro` (portableText), `howItWorks` (portableText), `stats` (array of {label, value}), `becomingAJudge` (portableText), `judges` (array of reference→`judge`), `showPublicDirectory` (boolean) | none required |
| `membersPage` | `documents/membersPage.ts` | `title`, `intro` (portableText), `resources` (array of {title, file, description, membersOnly}) | none required |

**None of these schemas declare any field as required** — `validation: (Rule) => Rule.required()` does not appear in any of the six files. This is consistent with "should be able to publish an incomplete page and let front-end fallbacks fill gaps," but it also means Studio will happily let an editor publish an empty document.

### Studio exposure — none of these are true singletons

`sanity.config.ts:1-30` uses stock `structureTool()` with **no custom desk structure** and **no `__experimental_actions` restriction** on any of the six schemas. Consequences:

- Each appears in the Studio sidebar as an ordinary **list type**, not a pinned single-document editor. A secretary clicking "Home Page" sees a list (currently empty) with a "+ Create new" button, not an already-open document.
- Nothing stops creating **multiple** `homePage` (or any other singleton-type) documents. The front-end queries all use `[0]` (e.g. `sanity/queries.ts:4`, `:31`, `:69`, `:133`, `:150`) — the first match in an *unordered* GROQ result. If a secretary or future editor accidentally creates a second `homePage` doc, the site will silently start rendering whichever one Sanity's `[0]` happens to resolve to, with no error and no warning.
- Delete is unrestricted too — nothing prevents deleting the sole instance and reverting the whole page to hardcoded fallback with no visible signal in the Studio that anything broke.

This is a **schema-exists-but-not-Studio-enforced** situation, distinct from "empty and unreachable." The fields are all editable if a document is created; the gap is the lack of a structure builder pinning each type to exactly one document (the standard Sanity singleton pattern: `S.listItem().id(id).schemaType(type).child(S.document().schemaType(type).documentId(id))`).

---

## 2. What the front end actually does today

| Singleton | Query | Consuming page | Fallback when query returns null |
|---|---|---|---|
| `homePage` | `homePageQuery` (`sanity/queries.ts:3-10`) | `app/(marketing)/page.tsx:58-64` | `Hero` falls back to `lib/data/heroImages.ts` static array (`components/home/Hero.tsx:24-29`, gated on `images && images.length > 0`). `MissionBlock` renders nothing extra when `missionText` is empty/whitespace — gated by `hasCms` check (`components/home/MissionBlock.tsx:13`); no static replacement mission copy exists, so an empty CMS field means **no mission text renders at all**, not a fallback string. `title`/`countdownDate` unused directly by Hero/MissionBlock — countdown comes from `nationalShow`, not `homePage`. |
| `aboutPage` | `aboutPageQuery` (`:68-75`) | `app/(marketing)/about/page.tsx` | Full per-field hardcoded fallback text for `pillars` (line 78-83) and `timelineNodes` (line 95-99); `boardIntroText` fallback is simply omitted (no `<p>` rendered) when null (line 107-111). |
| `nationalShow` | `nationalShowQuery` (`:30-39`) | Only `countdownDate` is consumed, on the home page (`app/(marketing)/page.tsx:63`, `ShowBand` component) — the `national-show/*` route group (`page.tsx`, `upcoming/page.tsx`, `archive/page.tsx`, etc.) does **not** import `nationalShowQuery` at all (confirmed via grep). So even if this singleton were populated, only the home-page countdown band would reflect it; the National Show section pages are entirely out of scope for this schema today (and out of scope for F6 per the scope freeze). |
| `contactPage` | `contactPageQuery` (`:149-158`) | `app/(marketing)/contact/page.tsx` | `directContacts` falls back to a hardcoded `FALLBACK_CONTACTS` array (`page.tsx:22-24`, single entry: `info@saoc.co.za`). Note: `contactPage` schema also has a `formRecipients` field (array of strings) that **no query selects and no code consumes** — it exists in Studio but has zero effect on where the contact form actually submits. |
| `judgingPage` | `judgingPageQuery` (`:132-147`) | `app/(marketing)/judging/page.tsx` | Full per-field hardcoded fallback text for `intro` (line 56-61) and `becomingAJudge` (line 112-117); `stats` section renders nothing when empty (line 82-93, correctly conditional); `judges` directory falls back to an empty array, and `showPublicDirectory` defaults to `false` when absent (line 34-35) — meaning **the judges directory is hidden by default** until a secretary explicitly ticks the box, even if `judge` documents exist. |
| `membersPage` | **none exists** | **no page consumes it** | N/A — this schema is entirely orphaned. Grepped every `.ts`/`.tsx` file for `membersPageQuery` and `membersPage` usage outside the schema registration itself; there is no query in `sanity/queries.ts` and no `app/(marketing)/members/` route. The schema is registered in Studio (so an editor *could* create and edit a "Members Page" document) but it would have **zero effect on the live site** — there's no members page to render it. |

**CMS-driven quantification per page:**

- **Home** (`/`): ~20% CMS-driven. Hero images + mission text can come from Sanity; nav cards, yearbook strip, and the overall page shell are static. Countdown depends on the separate `nationalShow` singleton, not `homePage`.
- **About** (`/about`): ~60% CMS-driven if populated (pillars, timeline, board intro all wired), but the WOSA partnership note and page hero copy (`eyebrow`/`heading`/`lede` in `PageHero`, `about/page.tsx:61-66`) are hardcoded with no CMS field at all.
- **Contact** (`/contact`): ~40% CMS-driven — direct contacts list is wired, but the page hero copy and the contact form's destination logic (see `formRecipients` orphan field above) are not.
- **Judging** (`/judging`): ~70% CMS-driven — best-covered page, most sections have real fallback/CMS pairs. Awards grid is explicitly "always static" (comment at `judging/page.tsx:95`).
- **National Show** (`/national-show/*`): 0% — the singleton isn't queried by any route in that section; only the home-page countdown band reads one field from it.
- **Members**: N/A — no page exists.

Every one of these fallbacks is currently exercised in production-equivalent state, because **all six singletons have zero documents in the dataset** — confirmed by the mission's dataset audit (94 docs total: society 21, societyEvent 18, showClass 10, province 9, award/boardMember/show/sponsor 6 each — no page-singleton types present at all).

---

## 3. The gap the secretary would hit

`docs/secretary-cms-guide.md` promises capabilities that do not currently exist as described:

| Guide claim | Reality | Section |
|---|---|---|
| "You will land on the Studio dashboard showing all content types in the left sidebar" and lists **Home Page**, **About Page**, **Contact Page**, **Judging Page**, **National Show** as if each is a single manageable document | True that they appear in the sidebar, but as **list types with a Create button**, not pre-existing singleton documents. First-time use requires creating the document from scratch — the guide never explains this step for any of the six. | §2, §7, §12 |
| §7 "Managing the National Show Page" step 2: *"There should be one document — click it to open"* | **False today** — there are zero. The secretary would see an empty list and have no instruction for what to do next (the guide has no "if there isn't one yet, click New document" branch). | §7 |
| §12 "Updating the Home Page" step 1: *"Click Home Page — there is one document"* | Same false premise — zero `homePage` documents exist. | §12 |
| §12 step 4: *"Countdown Target Date: must match the National Show countdown date"* | This implies a manual sync between two separate singleton documents (`homePage.countdownDate` and `nationalShow.countdownDate`) with no validation enforcing agreement, and in the current code `homePage.countdownDate` isn't even consumed anywhere (§2 above) — only `nationalShow.countdownDate` drives the visible countdown. The guide's instruction to sync them is currently pointless because one side has no effect on the site. | §12 |
| §3 "Adding an Event" — Host Society field described as optional, no mention of the consequence of leaving it blank | Technically accurate (it *is* optional in the schema), but doesn't warn that leaving it blank means no host label shows on the event row at all (`components/ui/EventRow.tsx:48-52`, conditional render) — not a bug, just an undocumented UX consequence worth a one-line callout. | §3 |
| No mention anywhere of **Members Page** in the sidebar table (§2) despite the schema existing in Studio | Consistent with reality (the guide doesn't promise it), but if a secretary explores the sidebar beyond the documented list, they'll find a "Members Page" type they have no instructions for and that has no effect on the live site if they fill it in. Worth either documenting or removing from the schema registry until wired. | §2 (omission, not a false claim) |
| §14 "Publish vs Draft" and §15 "Troubleshooting" | Both accurate in general Sanity behavior — no gap found here. | §14, §15 |

**Bottom line:** the guide is not wrong about *how Sanity works*; it is wrong about *the current state of the dataset*. It was written assuming the seed/setup step (creating one document per singleton) had already happened. It hasn't. Every singleton-related section (§7, §12, implicitly §2) will fail a literal first-time read-through at the "click it to open" step.

---

## 4. `hostSociety` gap

Confirmed via the mission's dataset audit: 0 of 18 `societyEvent` documents have `hostSociety` populated. Schema field: `sanity/schemas/documents/event.ts:15-20` — a `reference` to `society`, optional (no validation rule). Front-end code is correct and already handles it:

- `sanity/queries.ts:53` and `:172` — both event queries dereference `hostSociety->{ _id, name, "slug": slug.current }`.
- `components/home/EventsStrip.tsx:33` — maps `e.hostSociety?.name ?? ''`.
- `components/ui/EventRow.tsx:48-52` — conditionally renders the host label only `{event.host && ...}`, so a missing host just hides the label rather than showing "undefined" or breaking layout.

So this is purely a **content gap**, not a code gap (matches the mission note that the code half was fixed in a prior session).

**Can it be inferred automatically?** Partially, and not reliably enough to auto-populate without review:

- Several event titles in the static fallback data (`lib/data/events.ts`) embed a society-ish name fragment, e.g. `"Cape Orchid Society Autumn Show"`, `"Transvaal Spring Orchid Show"`, `"Natal Winter Orchid Show"` — these *look* matchable to `society.name` via fuzzy string matching.
- But this is the **static fallback file**, not the actual 18 `societyEvent` Sanity documents — I did not find equivalent title text for the real Sanity events in this assessment (out of scope to dump the dataset here; would need a targeted read pass). Titles like `"SAOC Council AGM 2026"` or `"Judging Workshop — Paphiopedilum"` don't map to any single society at all (national/council events legitimately have no host society).
- Fuzzy title-matching would misfire on ambiguous names (e.g. "Transvaal" vs "Northern Transvaal" vs "East Rand" societies are all distinct `society` records with overlapping substrings) and cannot distinguish "no host" (a legitimate state for council/AGM events) from "host omitted by mistake."

**Recommendation:** this needs a human pass — likely the secretary or Brad, cross-referencing each event against the 21 `society` records — not a scripted backfill. Effort: ~15–20 minutes for 18 events once someone with domain knowledge is looking at the list (trivial per-item, just needs a human decision per row).

---

## 5. Remediation plan, sequenced

Ordered by dependency; "content-owner decision" items are flagged explicitly.

### Step 0 — Decide before building (content-owner decisions)

1. **Confirm scope of `membersPage`.** Is a Members page actually planned? If yes, it needs a route (`app/(marketing)/members/page.tsx`), a query, and design — that's new-page work, explicitly out of scope for F6 per the scope freeze. If no, the schema should be removed from `sanity/schemas/index.ts` (or clearly marked "reserved, not yet wired") so it doesn't mislead editors. **Decision owner: Brad.** Effort: 5 min decision + (if removing) 10 min code change; (if keeping) deferred to a future mission.
2. **Decide `homePage.countdownDate` vs `nationalShow.countdownDate`.** The guide instructs syncing two fields, but only one is consumed by code. Either wire `homePage.countdownDate` into something, or remove the field/instruction and rely solely on `nationalShow.countdownDate`. **Decision owner: Brad** (this is the same fork noted in existing memory about National Show brand architecture — worth resolving together). Effort: trivial once decided.
3. **Decide fate of `contactPage.formRecipients`.** Either wire it into the contact form's submission target (`app/api/contact/`) or remove the field — right now it's editable in Studio but silently ignored. **Decision owner: Brad.** Effort: ~30 min if wiring it into the API route; 5 min if removing.

### Step 1 — Studio structure hardening (engineering, no content needed)

4. Add a custom desk structure in `sanity.config.ts` pinning each of the (surviving, per step 0.1) five/six singletons to a single fixed document ID, removing "Create new" / "Delete" for those types. Standard Sanity pattern (`structureTool({ structure: (S) => ... })`). This closes the "secretary could accidentally create two homePages" risk from §1 and makes the Studio UI match what the guide already describes ("there is one document"). Effort: ~1–2 hours including testing all six types.

### Step 2 — Seed the singleton documents (content, mixed ownership)

5. **Create the six (or five) singleton documents once each**, via Studio, populated with the *current hardcoded copy* migrated in — not new copy, just moving what's already live into CMS fields so nothing changes visually on day one:
   - `homePage`: migrate hero image references + write a mission text paragraph matching current site tone. **Owner: Brad drafts, secretary can review.**
   - `aboutPage`: migrate the existing hardcoded pillar/timeline/board-intro text verbatim from `about/page.tsx:79-83`, `:96-99` into portableText blocks.
   - `nationalShow`: needs real, current show data (date, location, hero, countdown target) — this is time-sensitive content only Brad/the committee has. **Owner: Brad / National Show committee** (ties to the existing open question about National Show brand architecture — resolve that first if it affects what goes in `title`/`hero`).
   - `contactPage`: migrate the existing `FALLBACK_CONTACTS` entry, then let the secretary add real role-based contacts.
   - `judgingPage`: migrate existing hardcoded intro/becomingAJudge text; secretary/judging committee supplies `stats` and decides `showPublicDirectory`.
   - `membersPage`: only if step 0.1 confirms it's in scope.

   Effort: ~2–3 hours of content migration (mechanical copy-paste into Studio) + open-ended time for whoever supplies genuinely new copy (national show details, judging stats).

6. **Populate `hostSociety` on the 18 existing `societyEvent` documents** — human review pass per §4 above. **Owner: secretary** (has the domain knowledge of which society hosts which recurring event) or Brad as a one-time bootstrap. Effort: ~15–20 minutes.

### Step 3 — Documentation fix (engineering + docs, cheap, do independent of the above)

7. Update `docs/secretary-cms-guide.md` §7 and §12 to add a "first time only" branch: *"If the list is empty, click New document instead of clicking an existing one, then follow the same field instructions."* This makes the guide correct **today**, independent of whether/when steps 2 and 5 happen. Effort: ~15 minutes, no engineering risk, should probably happen regardless of sequencing above.

### Not required

- No code changes are needed for the *fallback* behavior — it already works correctly and gracefully (§2). The gap is entirely "no documents exist yet," not "the code can't handle CMS content."

---

## Summary for the parent task

**The gap:** all six page-singleton schemas exist and are correctly wired end-to-end in code (queries + graceful per-field fallbacks), but **zero documents exist in the dataset**, so the site currently renders 100% hardcoded content dressed up as "CMS-driven." `docs/secretary-cms-guide.md` describes a state ("there is one document — click it to open") that is false for all six types today. Additionally: `membersPage` has no consuming route at all (orphaned schema), `homePage.countdownDate` and `contactPage.formRecipients` are editable but functionally inert, and Studio exposes all six as unrestricted list types rather than locked singletons, so nothing prevents an editor from accidentally creating duplicates.

**Top 3 things needed to close it:**
1. Seed one document per singleton with the existing hardcoded copy (mechanical migration, ~2-3 hrs) — makes the guide's core promise true without changing anything visible on the live site.
2. Pin each singleton in the Studio desk structure so exactly one document can exist per type (~1-2 hrs engineering) — prevents the duplicate-document failure mode the current setup allows.
3. Human review pass to populate `hostSociety` on the 18 event documents (~15-20 min, needs a person with domain knowledge, not scriptable).

Everything else (National Show real content, Members page decision, `formRecipients` wiring) needs a content-owner decision from Brad before engineering time is spent.

Report written to `docs/f6-page-singletons.md`.

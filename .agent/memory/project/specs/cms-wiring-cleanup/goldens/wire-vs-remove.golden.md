# Golden: wire-vs-remove decision record

The governing rule for this batch: **an editable field or type that does nothing is worse
than one that does not exist**, because it teaches the client that publishing has no
effect. So every item below is either wired or removed. Nothing is left inert.

The removal rule: removing a Sanity schema type or field is content-destructive in
principle. The dataset is pre-production so removal is permitted, but only after a live
query confirms it holds no data. Every removal below was confirmed empty by a live query
on **2026-08-11**, and `check-dead-fields-removed.mjs` **re-confirms emptiness at grading
time** — if someone types a value in before the gate runs, the removal fails and must be
re-decided.

## Decisions

| Item | Live state, 2026-08-11 | Decision | Reasoning |
|---|---|---|---|
| `award` type | **Already wired.** `awardsQuery` exists; `/judging` fetches it and passes it to `AwardsGrid awards={awards}`. 6 documents. | **No action** | The backlog entry is stale — it describes `AwardsGrid` reading `lib/data/awards`, which it no longer does. |
| `province` type | 9 documents, read by nothing. `society.province` is a free-text code. | **WIRE** | 9 documents ≠ empty, so removal is barred by the rule above. Wired narrowly: the `/societies` filter chips, hardcoded in `lib/data/provinces.ts` today, are sourced from the documents instead. |
| `society.province` → reference | free-text codes, matching `province.code` exactly | **NOT DONE** | Converting 21 society documents to references is a data migration, not a wiring fix. It puts every society document at risk to close a P2 and is not needed to make the type non-inert. Flagged, not done. |
| `aboutPage.title` | `null`. Fetched at `about/page.tsx:19-20`, declared in `AboutPageData`, **never rendered** — the hero heading is a literal. | **WIRE** | The canonical false-green on this project. The hero heading is copy the client should own. Wiring costs one JSX change; removing would keep the heading permanently hardcoded. |
| `aboutPage.boardIntroText` | **Already rendered** (`about/page.tsx:112-114`) | **No action** | Backlog entry is stale. |
| `judgingPage.stats` | **Already rendered** (the conditional stats strip) | **No action** | Backlog entry is stale. |
| `homePage.countdownDate` | `null`. Projected by `homePageQuery`, declared in `HomePageData`, never passed anywhere. | **REMOVE** | A duplicate. The countdown is driven by `nationalShow.countdownDate` (`page.tsx:77` passes `show?.countdownDate`). Two fields with the same name, one inert, is precisely what produced the backlog's "the countdown field does not drive the countdown" confusion. Deleting the dead one ends it. Confirmed empty. |
| `contactPage.formRecipients` | `null`. In the schema, editable, consumed by nothing. `/api/contact` mails the submitter via `lib/email.ts`; the `from` address comes from `RESEND_FROM_ADDRESS`. | **REMOVE** | Enquiry routing is delivery configuration, not content. Wiring it would let anyone with Studio access redirect where site enquiries are delivered — a real change in blast radius for a field nobody asked for. It belongs in env, where it already effectively lives. Confirmed empty. |
| `judge` type | dereferenced via `judgingPageQuery`'s `judges[]->` | **Out of scope** | Explicitly not orphaned; brief says leave alone. |
| `membersPage` | unread placeholder | **Out of scope** | Deliberate placeholder; brief says leave alone. |

## Removal emptiness evidence

Live GROQ, 2026-08-11, against `26yfbug4` / `production`:

```
*[_type=="homePage"][0].countdownDate      -> null
*[_type=="contactPage"][0].formRecipients  -> null
count(*[_type=="province"])                -> 9      (why province is wired, not removed)
count(*[_type=="award"])                   -> 6      (already wired; no removal considered)
```

## What "wired" has to mean

For every wired field, all three must hold, and the assertions enforce all three:

1. The field is **queried** in `sanity/queries.ts`.
2. The field is **interpolated into JSX** — not merely destructured, typed, or mentioned.
   A substring grep for the field name is not evidence; that is the exact false green
   that let `aboutPage.title` sit broken.
3. Any hardcoded fallback is in `(sanityValue ?? 'fallback')` order, **never** the
   reverse. Reversed precedence lets a literal silently mask a published edit — same
   symptom as an unrendered field, different cause.

## What "removed" has to mean

The field goes from the schema **and** from the GROQ projection **and** from the page's
TypeScript interface **and** from any seed-script reference (including comments). A field
dropped from the schema but left in the query is a silently-null projection: tidy-looking
and meaningless.

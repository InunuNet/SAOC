# Golden — `content/national-show-routes.json`, the artifact the other lane consumes

@dev emits this file. The `saoc-eb` lane reads it to build the site header **without reading
our code**. It is a contract with another team, so it is specified exactly and cross-checked
in both directions.

**Path:** `content/national-show-routes.json` — tracked in git, adjacent to
`content/show-pages/`, deliberately outside `app/`.

**It is generated, not hand-written.** @dev writes a generator
(`scripts/generate-nos-route-manifest.ts`) that walks
`app/(marketing)/national-show/` for `page.tsx` files and joins them against the tree in
`goldens/m4/route-manifest.golden.md`. A hand-maintained manifest drifts; the drift is
invisible to us and fatal to them.

---

## Schema — `saoc.nos-route-manifest/v1`

```json
{
  "schema": "saoc.nos-route-manifest/v1",
  "generatedFor": "national-show-ia-alignment M4",
  "generatedAt": "2026-09-10",
  "groups": [
    { "id": "visit",         "label": "Visit",           "order": 1 },
    { "id": "programme",     "label": "Programme",       "order": 2 },
    { "id": "exhibit-trade", "label": "Exhibit & Trade", "order": 3 },
    { "id": "the-show",      "label": "The Show",        "order": 4 }
  ],
  "routes": [
    {
      "slug": "/national-show/sa-exhibitors",
      "label": "South African Exhibitors",
      "group": "exhibit-trade",
      "parent": "/national-show",
      "order": 1,
      "listed": true,
      "dynamic": false,
      "indexable": true,
      "status": "created",
      "owner": "nos-design",
      "archetype": "listing",
      "purpose": "Public directory of South African nurseries exhibiting at the show.",
      "pageKey": "04-south-african-exhibitors",
      "specNumber": 4
    }
  ]
}
```

### Top level

| key | type | rule |
|---|---|---|
| `schema` | string | exactly `saoc.nos-route-manifest/v1` |
| `generatedFor` | string | non-empty |
| `generatedAt` | string | `YYYY-MM-DD` |
| `groups` | array | exactly the four below, in this `order`, `id` values exactly as spelled |
| `routes` | array | exactly 21 rows — 17 `listed: true`, 4 `listed: false` |

The four group ids are fixed: `visit`, `programme`, `exhibit-trade`, `the-show`. Their labels
are fixed: `Visit`, `Programme`, `Exhibit & Trade`, `The Show`.

### Route row

| key | type | required | rule |
|---|---|---|---|
| `slug` | string | yes | absolute path, starts `/national-show`, unique across rows |
| `label` | string | yes | non-empty, unique among `listed: true` rows — it is what their header displays |
| `group` | string \| null | yes | one of the four group ids; `null` **only** for the hub row |
| `parent` | string \| null | yes | `/national-show` for every child; `null` for the hub |
| `order` | integer | yes | ≥ 1, unique within `(group, listed)` — the display order inside a group |
| `listed` | boolean | yes | `true` = a navigation entry; `false` = exists on disk but is not a header entry |
| `dynamic` | boolean | yes | `true` only for `/national-show/archive/[year]` |
| `indexable` | boolean | yes | `false` for the token-gated `vendors/register` and `vendors/payment`; `true` otherwise. `app/sitemap.ts` filters on this |
| `status` | enum | yes | `created` \| `reconciled` \| `restructured` \| `untouched` |
| `owner` | enum | yes | `nos-design` \| `saoc-eb` — tells the consuming lane which rows are theirs |
| `archetype` | enum | yes | `hub` \| `prose` \| `schedule` \| `listing` \| `transactional` \| `archive` — the five layout archetypes from `rules.md`, plus `archive` |
| `purpose` | string | yes | one line, non-empty. **Load-bearing** — it is what keeps `exhibitors` and `sa-exhibitors` from being re-merged |
| `pageKey` | string \| null | yes | a `content/show-pages/*.json` `pageKey`, or `null` for a route with no showPage document. Never a retired pageKey |
| `specNumber` | integer \| null | yes | the spec sitemap entry, or `null` |

`null` is written explicitly. A **missing key is a failure**, not a `null` — an absent field
and a deliberate `null` must not be indistinguishable, which is the same fail-loud rule the
provenance triad already follows.

---

## The 21 rows

`listed: true` — 17, in group order then `order`:

| group | order | slug | status | owner | archetype | pageKey |
|---|---|---|---|---|---|---|
| — | 1 | `/national-show` | `restructured` | `nos-design` | `hub` | `01-national-show-landing` |
| `visit` | 1 | `/national-show/about` | `reconciled` | `nos-design` | `prose` | `02-about-the-national-show` |
| `visit` | 2 | `/national-show/what-to-expect` | `reconciled` | `nos-design` | `prose` | `03-what-to-expect` |
| `visit` | 3 | `/national-show/plan-your-visit` | `reconciled` | `nos-design` | `prose` | `16-plan-your-visit` |
| `visit` | 4 | `/national-show/faq` | `reconciled` | `nos-design` | `prose` | `17-faq` |
| `programme` | 1 | `/national-show/programme` | `created` | `nos-design` | `schedule` | `11-programme` |
| `programme` | 2 | `/national-show/workshops` | `reconciled` | `nos-design` | `schedule` | `12-workshops` |
| `programme` | 3 | `/national-show/symposium` | `created` | `nos-design` | `prose` | `06-saoc-symposium` |
| `programme` | 4 | `/national-show/wosa` | `created` | `nos-design` | `prose` | `07-wosa-conference` |
| `programme` | 5 | `/national-show/conferences` | `untouched` | `saoc-eb` | `transactional` | `null` |
| `exhibit-trade` | 1 | `/national-show/sa-exhibitors` | `created` | `nos-design` | `listing` | `04-south-african-exhibitors` |
| `exhibit-trade` | 2 | `/national-show/international-guests` | `created` | `nos-design` | `listing` | `05-international-guests-and-exhibitors` |
| `exhibit-trade` | 3 | `/national-show/exhibitors` | `untouched` | `saoc-eb` | `prose` | `null` |
| `exhibit-trade` | 4 | `/national-show/vendors` | `untouched` | `saoc-eb` | `transactional` | `null` |
| `the-show` | 1 | `/national-show/tickets` | `untouched` | `saoc-eb` | `transactional` | `null` |
| `the-show` | 2 | `/national-show/sponsors` | `created` | `nos-design` | `listing` | `15-sponsors` |
| `the-show` | 3 | `/national-show/archive` | `untouched` | `saoc-eb` | `archive` | `null` |

`listed: false` — 4:

| slug | group | dynamic | indexable | owner |
|---|---|---|---|---|
| `/national-show/vendors/apply` | `exhibit-trade` | false | true | `saoc-eb` |
| `/national-show/vendors/register` | `exhibit-trade` | false | **false** | `saoc-eb` |
| `/national-show/vendors/payment` | `exhibit-trade` | false | **false** | `saoc-eb` |
| `/national-show/archive/[year]` | `the-show` | **true** | true | `saoc-eb` |

`/national-show/tickets` keeps `pageKey: null` even though seed `13-booking-tickets` exists:
the seed is a document the `saoc-eb` lane may consume, and this manifest states what **our**
routes render. Claiming a pageKey we do not render would be a drift of exactly the kind this
file exists to prevent.

Spec entry 14 (`/societies`) is **never a row** — it has no page under `/national-show`. It is
a link target only (`R4`).

---

## The both-directions check (`RM1`)

One-directional checking catches a dead link but not a silently dropped page. Both directions,
both fatal:

1. **Disk → manifest.** Every `page.tsx` under `app/(marketing)/national-show/` has exactly
   one row whose `slug` matches its route. A page with no row is a page the other lane's
   header will never show.
2. **Manifest → disk.** Every row's `slug` resolves to a `page.tsx` on disk. A row with no
   page is a dead link they will ship.
3. **Manifest → this golden.** The 21 rows equal the tables above, field for field, on
   `slug`, `label`, `group`, `parent`, `listed`, `dynamic`, `indexable`, `status`, `owner`,
   `archetype`, `pageKey`, `specNumber`.
4. **`pageKey` resolves.** Every non-null `pageKey` names a file in `content/show-pages/`
   (top level, not `retired/`) whose own `pageKey` field matches.
5. **No retired pageKey appears.** The four retired keys (`08-…`, `09-…`, `10-…`, `18-…`)
   appear in no row.
6. **Every required key is present on every row**, including the ones whose value is `null`.

`RM1` fails on any one of the six. The driver prints which.

## What this artifact does not promise

- **That the labels are the ones the other lane wants.** They are ours to propose; theirs to
  disagree with.
- **That the manifest is regenerated automatically on every route change.** It is generated,
  but by a script someone runs. `RM1` catches drift at the gate — not at the moment it is
  introduced.

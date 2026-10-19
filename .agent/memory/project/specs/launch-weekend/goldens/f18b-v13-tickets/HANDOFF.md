# NOS 2027 ticket cards: build handoff

Design mock: `index.html` (open `_preview.html` locally). Status: **proposal for Brad's approval; nothing here is built.**
Design authority: Codi (SAOC NOS Design). Build lane: SAOC lead session (data, pricing, pool, checkout, counters).

Concept: every product is a keepsake admission ticket. A die-cut stub carries the date numeral over the product's own orchid
(or its own colour field), the Disa emblem and "Admit one"; a perforation and two half-moon notches divide stub from body.

Rulings that bind: R2 (pill only for chips), R7 (no invented copy), R8 (status colour), R9 (focus), R11 (disclosure),
R13 (grid count), R14 (Fraunces + Karla), R16 (one photo per product), R18 (dated promise), R20 to R23 (supplied logo only,
emblem never beside typeset name).

## 1. Tokens

Existing names are from `app/(marketing)/national-show/nos-theme.css`. NEW = not in that file yet.

| Role | Value | nos-theme.css name |
|---|---|---|
| Ink / royal purple | `#211A57` | `--ink`, `--primary` |
| Royal 900 (stub band) | `#1A1445` | `--primary-800` |
| Royal 700 | `#33296F` | `--primary-700` |
| Pale gold (default ticket ground) | `#F3F2D6` | `--bone` |
| Gold 100 (page ground) | `#FBFAF0` | `--ivory`, `--parchment` |
| Gold 300 (foil hairline, on-dark sub) | `#E8E6C2` | `--rule-soft` |
| Green 1 (accent rule, tag border) | `#A7A841` | `--olive` (decorative only, never text) |
| Green 2 | `#7F7D33` | `--olive-deep` |
| Violet | `#7E3F97` | `--accent`, `--ring-focus-on-light` |
| Muted text | `#6A6780` | `--muted` |
| Rule | `#DAD7C8` | `--rule` |
| Low-stock ink, light ground | `#714a1e` | `--status-warning-on-light` |
| Low-stock ink, royal ground | `#d6a164` | `--status-warning-on-dark` |
| Focus ring on dark | `#FBFAF0` | `--ring-focus-on-dark` |
| Ticket radius | 10px | NEW `--radius-ticket` (theme has `--radius-card: 0px`; R17 controls 10px) |
| Stub field colours | VIP `#0B0A14`, Sunset `#7E3F97`, Weekend `#211A57`, Day `#7F7D33`, Symposium `#4A3D8C`, WOSA `#6A6829`, Workshops `#33296F` | NEW `--ticket-field-<slug>` (or a Sanity field) |
| Purple 600 | `#4A3D8C` | NEW (sampled in the brand canvas, not in theme) |
| Olive 700 | `#6A6829` | NEW (sampled, not in theme) |
| Stub scrim | `linear-gradient(0deg, rgba(11,10,20,.78) 0%, rgba(11,10,20,.36) 46%, transparent 78%)` | NEW `--ticket-scrim` (R15 near-black) |
| Ticket shadow | `drop-shadow(0 2px 3px rgba(33,26,87,.08)) drop-shadow(0 14px 22px rgba(33,26,87,.13))` | NEW; must be `filter`, not `box-shadow` (the mask clips box-shadow) |
| Ease | `cubic-bezier(0.16,1,0.3,1)` | `--ease-nos` |
| Fonts | Fraunces (display, opsz axis), Karla (body) | `--font-serif` / `--font-sans` currently map to Cormorant/Jost: the R14 swap is still owed |


## 2. Data interface (LOCKED, SAOC lead 2026-10-07)

The cards render from these view models only. Field names and enum values below are exact.

```ts
type TicketCardState = 'pricePending' | 'soldOut' | 'earlyBirdSoldOut' | 'low' | 'available';
const LOW_STOCK_THRESHOLD_PERCENT = 10;
interface ScarcityLine { remaining: number; total: number; label: string; } // remaining is never null
interface TicketCardViewModel {
  slug: string; state: TicketCardState; price: number | null;
  regularPrice: number | null; // non-null only on the early-bird SKUs
  scarcity: ScarcityLine | null;
  days: Array<{ day: string; state: TicketCardState; remaining: number; total: number }> | null; // Day Pass only
}
interface PresenterCardViewModel { id: string; name: string; role: string | null; bioExcerpt: string | null; photoUrl: string | null; event: 'saoc-symposium' | 'wosa-conference'; order: number; }
interface WorkshopSessionViewModel { id: string; title: string; description: string | null; presenterId: string | null; timeSlot: string | null; ticketCard: TicketCardViewModel | null; }
```

### Pass SKUs (contract answer, 2026-10-07)

Early-bird and regular passes are separate SKUs. While the shared pool of 500 lasts, the card renders the early-bird SKU; at
0 the early-bird SKUs go `earlyBirdSoldOut` and the page renders the regular SKU in the same slot.

| slug | `price` | `regularPrice` | `scarcity` | `days` |
|---|---|---|---|---|
| `weekend-pass-early-bird` | 360 | 380 | shared pool, "N of 500 early-bird left" | null |
| `weekend-pass` | 380 | null | own ceiling, "N of 300 places left" (300 provisional, awaiting Brad), or null if Brad rules no cap | null |
| `early-bird` | 120 | 150 | shared pool, "N of 500 early-bird left" | per day, of 1000 |
| `day-visitor` | 150 | null | null | per day, of 1000 |

Price line: `regularPrice` non-null gives "Early-bird R360, then R380" under the price; null gives the price alone.

### Precedence

`pricePending` > `soldOut` > `earlyBirdSoldOut` > `low` > `available`. The state the server sends is final; the card never
re-derives it. The visual rule that follows is that **a higher state masks every slot a lower one would show**:

| `state` | price slot | `scarcity` slot | stepper + CTA | stub |
|---|---|---|---|---|
| `pricePending` | "Price to follow" + chip "To be confirmed" + note (R11). `price` is null. | hidden | none | normal |
| `soldOut` | `price` in muted ink + "This ticket has sold out." | hidden | none | "Sold out" stamp |
| `earlyBirdSoldOut` (early-bird SKU only) | `price` muted + "~~Early-bird price~~ Early bird sold out" + "The <pass name> is now R`regularPrice`." | hidden | none (the regular SKU sells) | normal; day cells closed, "Early bird ended" |
| `low` | `price` | shown, number in `--status-warning-*` 700 + tag "Few left" | shown | normal |
| `available` | `price` (early-bird SKUs add "Early-bird R`price`, then R`regularPrice`") | shown | shown | normal |

Greyscale check: each state differs by words, tag, stamp or the absence of the CTA, never by colour alone.

### `scarcity` slot (not a state)

| value | renders |
|---|---|
| `{ remaining, total, label }` | "`remaining` of `total` `label`" on every product, VIP included: "146 of 200 places left", "10 of 10 places left" (workshops). |
| early-bird SKUs (`weekend-pass-early-bird`, `early-bird`) | the shared pool: "312 of 500 early-bird left" + "Shared with the Day Pass" / "Shared with the Weekend Pass". The Day Pass card shows this one line AND the `days[]` selector (per day, of 1000). |
| regular `weekend-pass` | its own ceiling: "214 of 300 places left"; no "Shared with" line. |
| `null` | `day-visitor` (carries `days[]` alone), and `weekend-pass` only if Brad rules no cap. Nothing renders in the slot. |

`label` is printed verbatim and is server-supplied. Early-bird SKUs add a static line under it, "Shared with the Day Pass" /
"Shared with the Weekend Pass", keyed by `slug`; it is copy, not a field. `low` is decided server-side at `remaining / total <= 10%`.

### `days` (Day Pass only: `early-bird` and `day-visitor`)

One card, a three-day selector, one cell per `days[]` entry in array order. Cell label from `day` (ISO): `2027-09-24` reads "Fri 24".

| day `state` | cell |
|---|---|
| `available` | "Fri 24" + "`remaining` of `total`". Selectable. |
| `low` | same + count in warning ink 700 + "Few left". Selectable. |
| `earlyBirdSoldOut` | early-bird SKU only: visible, "Early bird ended", `disabled`. Not selectable. |
| `soldOut` | visible, struck "Sat 25", "Sold out", 62% opacity, `disabled` radio. Not selectable. |
| `pricePending` | visible, "Price to follow", `disabled`. Not selectable. |

The card-level `state` and `scarcity` describe the product as a whole (the shared pool). Default selection is the first
selectable day; the stub numeral and caption follow the chosen day ("25 Saturday"). If every day is `soldOut` the server
sends card `state: 'soldOut'`. Specimen: "available (mixed days[])": Fri low, Sat soldOut, Sun available (Fri 58, Sat 0, Sun 905 of 1000).

### Fields the design wants that the interface does not carry (flagged, not assumed)

- **Waitlist.** Not in the interface. Shown only in the specimens, labelled "Proposed". Not built.
- Static per-slug presentation (name, date line, time line, theme, stub numeral/caption, stub field colour, photo) comes
  from content or code, not from the view model:

| slug | when line | stub | field (no photo) | photo (R16, one each) |
|---|---|---|---|---|
| `vip` | Thursday 23 September, 16h00 to 19h00 | 23 Thursday | `#0B0A14` | orchid-dark |
| `sunset-cocktails-single` | Thursday 23 September, 18h00 to 21h00 | 23 Thursday | `#7E3F97` | orchid-yellow |
| `weekend-pass-early-bird` / `weekend-pass` | Friday 24 to Sunday 26 September | 24 to 26 Sept | `#211A57` | orchid-purple |
| `early-bird` / `day-visitor` | Friday, Saturday or Sunday | chosen day | `#7F7D33` | orchid-pink |
| `saoc-symposium` | Dates to follow + theme "From Wild Origins to Cultivated Excellence" | XIX 19th Show | `#4A3D8C` | none |
| `wosa-conference` | Dates to follow + "With Wild Orchids of Southern Africa" | XIX 19th Show | `#6A6829` | none |
| `workshops` | Schedule to follow, "10 places in each session" | 10 places a session | `#33296F` | orchid-violet |

## 3. Components

### 3.1 TicketCard (renders one `TicketCardViewModel`)

Anatomy, vertical (container < 470px):

| Slot | Spec |
|---|---|
| Stub | height 168px (150px for session cards). Rows: face (1fr) + band (50px). `aria-hidden`. |
| Face | photo `object-fit: cover` + scrim, or flat field colour. Numeral Fraunces 300, 58px, opsz 120, `#FBFAF0`; caption Karla 700 13px `#F3F2D6`. Padding 14px 18px 12px. |
| Band | `#1A1445`, inset top hairline `rgba(232,230,194,.32)`. Emblem (supplied `Disa graminifolia.svg`) 30px high, 12px gap (clear space, a quarter of emblem width), then "Admit one" ("One place" on sessions) in Fraunces italic 16px. Never the show name beside the emblem (R23). |
| Perforation | dots 2.2px radius every 11px, coloured with the ground behind the card, inset notch + 6px from each edge. |
| Notches | CSS mask, two radial cut-outs of 11px radius at the stub/body seam. |
| Body | padding 24px (16px compact), +4px top. Flex column, gap 10px. |
| When | Karla 700 14px, ink. |
| Name | Fraunces 400 29px, line-height 1.08, opsz 40. h3. |
| Theme (programme) | Fraunces 17px, sub ink. |
| Meta | Karla 15px, sub ink. |
| `scarcity` | Karla 600 15px, tabular figures. |
| Buy row | `margin-top: auto` (aligns across a row), 16px top padding, 1.5px top rule in accent. Price left, stepper right, CTA full width below. |
| `price` | Fraunces 300 46px, "R" at 0.56em raised, integer rand, no decimals ("R2000"). "each" on workshops. |
| CTA | `.btn` 50px, full width, "Add to booking" + arrow. Royal fill, gold-100 text. The `workshops` product card says "Choose a session" and links to the session list. |

Wide (container >= 470px): stub moves to the right end, full height, min 300px; perforation runs vertically. Use a
container query, not a viewport query, so the same card works in 1, 2 or 3 columns.

### 3.2 Day selector (`days`)

`fieldset` + `legend` "Choose a day", radio cards in a 3-column grid, gap 8px, min-height 58px, radius 8px. Checked: 2px
ink border, 16% accent tint, check mark. Disabled cells stay in the grid at full size so the row never reflows.

### 3.3 Quantity stepper

`role="group"` labelled "<name> quantity". Two 44x44 buttons ("One fewer" / "One more") around an `<output aria-live="polite">`.
Min 1, max `min(10, scarcity.remaining)` when known, else 10. Presentational; the cart owns the real limit.

### 3.4 Early-bird pool banner

Royal panel, radius 16, above the two pass cards, reading the same pool value as both pass cards' `scarcity`. Numeral
Fraunces 300 68px gold + "of 500"; "Early-bird tickets left"; "One pool of 500 early-bird tickets is shared by the Weekend Pass
and the Day Pass. The early bird ends when the pool sells out." A bracket joins it to both cards at >= 960px. When the
pool is 0 it reads "Early bird sold out" and "All 500 early-bird tickets, shared by the Weekend
Pass and the Day Pass, have sold. Both passes are now at their normal price."

### 3.5 Brochure tile (Symposium, WOSA)

Two columns 5fr / 7fr, white, radius 16, `--shadow-md`. Left: colour field (Symposium `#4A3D8C`, WOSA `#6A6829`), no emblem
(the field and the type carry it), content aligned to the foot: programme name (Karla 700 14px gold) and display title (Fraunces 300 44px). Right: h3, council copy, theme tags
(8px radius), an R18 "to follow" panel, CTA "Book the Symposium" / "Book the Conference", WOSA adds "Visit WOSA". WOSA copy
is `placeholder-ai`, so it carries the R11 disclosure. Single column below 960px.

### 3.6 PresenterCard (renders one `PresenterCardViewModel`)

Primary design is `photoUrl: null`, the case for every presenter today.

| Slot | Spec | Field |
|---|---|---|
| Face | 16:10 field in the event colour (`event: 'saoc-symposium'` `#4A3D8C`, `'wosa-conference'` `#6A6829`). Centred roundel 40% wide: 1.5px gold-300 ring plus a soft second ring; initials (first letters of the first two words of `name`) in Fraunces 300 italic, 48 to 72px, gold-100. Event name bottom-left, Karla 700 14px gold. `aria-hidden`. | `photoUrl: null`, `name`, `event` |
| Face with photo | `photoUrl` as a 16:10 `object-fit: cover` image, `alt=""` (the name follows as text). | `photoUrl` |
| Name | Fraunces 25px, h4. | `name` |
| Role | Karla 700 15px. Omitted, with no gap left, when null. | `role` |
| Bio | Karla 15px, 1.55. Omitted when null. | `bioExcerpt` |
| Link | "Book the Symposium" / "Book the Conference", pinned to the card foot so cards in a row align. | `event` |

Order cards by `order`. 3 columns at 1280, 2 at 768, 1 at 390. When the list for an event is empty, render one panel
instead of the grid: "Presenters will be announced here" + "Names and biographies follow once the Council confirms the
programme." (R18; never a placeholder person.)

### 3.7 WorkshopSessionCard (renders one `WorkshopSessionViewModel`)

A TicketCard with stub 150px. Null handling:

| Field | Present | null |
|---|---|---|
| `timeSlot` | printed verbatim as the date line | "Time to be announced" |
| `title` | h3 | (never null) |
| `description` | Karla 15px under the title | omitted |
| `presenterId` | "With <presenter `name`>" in Fraunces 17px, resolved from PresenterCardViewModel | omitted |
| `ticketCard` | price, `scarcity`, stepper and CTA by its `state`, as 3.1; stub numeral = `scarcity.total` + "places" | no price, no CTA: "Booking for this session is not open yet."; stub caption "Workshop" |

## 4. Responsive

| Width | Layout |
|---|---|
| 1280 | Container 1080. Thursday 2 columns (horizontal tickets), passes 2 columns + pool bracket, programme 3 columns (vertical tickets). Specimens: VIP and Symposium 2 columns (4 states each), Weekend Pass and Day Pass 3 (6 each); presenters 3, sessions 2. Specimen labels are the exact enum names, plus the SKU slug on passes. |
| 768 | Ticket groups 1 column; tickets go horizontal again (container >= 470). Pool bracket hidden. Brochure single column. Presenters 2 columns. |
| 390 | 1 column, vertical tickets, 16px gutters, hero fan scaled to 196px tickets and bled to the edges. No horizontal scroll. |

## 5. Accessibility

- Card is an `<article aria-label="<name>">`; name is an h3 under the group h2.
- Stub is `aria-hidden` (decorative; the date is in the body text). Photos have `alt=""`.
- Update the `scarcity` text node in place inside `aria-live="polite"`; re-mounting the node loses the announcement. Throttle to one announcement per 30 s.
- Day selector: native radios, so arrow keys move between selectable days; disabled days are skipped and still read out ("Sat 25, Sold out, dimmed").
- Targets: CTA 50px, stepper 44px, day cells 58px.
- Focus: R9 outline 2px, offset 3px, violet on light, `#FBFAF0` on royal.
- Contrast on the composited mock: ink on `#F3F2D6` 13.7:1; muted `#6A6780` on `#F3F2D6` 4.8:1; warning `#714a1e` on `#F3F2D6` 6.8:1; warning-on-dark `#d6a164` on royal 6.8:1; gold-100 on the Day Pass olive stub `#7F7D33` 4.1:1 (58px display numeral only, passes 3:1).

## 6. Motion

- Hover (pointer devices): ticket lifts 5px and the shadow deepens, 360ms `--ease-nos`.
- Masthead: the three hero tickets fan out once on load (1.1s). That is the page's one authored moment.
- Button press: scale 0.98.
- All of it sits inside `prefers-reduced-motion: no-preference`; reduced motion shows the final state with no movement.

## 7. Design-review drawer: NOT part of the build

The "Tweak design" button and drawer exist only so Brad can adjust the mock and save his choices. Do not port them.
Saved settings live in the artifact database at `tweaks/current` (fallback: this browser's localStorage key `nos-tickets-tweaks`).
The drawer edits simulated server inputs; the page turns them into the exact view models above and renders only from those.

| Control | Changes | Build equivalent |
|---|---|---|
| Card ground (pale gold / white / royal) | `--t-bg`, `--t-ink`, `--t-sub`, `--t-muted`, `--t-btn-*`, `--t-warn` | ticket ground token (`--bone` default) |
| Accent (green 1 / green 2 / violet) | `--acc` (buy-row rule, tag border, pool bracket, day tint) | `--olive` / `--olive-deep` / `--accent` |
| Corner radius (10 / 16) | `--rt` | NEW `--radius-ticket` |
| Ticket stub and perforation | `data-stub`: removes mask, perforation, band | structural; keep on |
| Photo on cards | `data-photo`: stub uses the field colour | static per-slug photo |
| Emblem on stub | `data-emblem` | band content |
| Type scale 90 to 115% | `--ts` multiplier on ticket type | ticket type sizes |
| Card density | `--pad` 24 / 16px | body padding |
| Layout grid / stacked | `data-layout`: groups to 1 column, max 760px | page layout |
| Shared early-bird pool 0 to 500 | early-bird SKU `scarcity.remaining`; at 0 the main cards switch to the regular SKUs (`weekend-pass`, `day-visitor`); specimens show the early-bird SKUs at `earlyBirdSoldOut` | pool counter |
| Low stock at or below (default 10%) | `low` derivation | `LOW_STOCK_THRESHOLD_PERCENT` |
| Day Pass remaining per day | `days[].remaining`; 0 gives that day `soldOut` | `days[].remaining` |
| Day Pass state per day | `days[].state`: the 5 enums, or "Derive from counts" | `days[].state` |
| Per card: state | `state`: the 5 enums (`earlyBirdSoldOut` on passes only), or "Derive from counts" by precedence | `state` |
| Per card: price (empty = null) | `price`; null gives `pricePending` | `price` |
| Per pass: regular price / early bird | regular SKU `price` and early-bird SKU `regularPrice` / early-bird SKU `price` | `price`, `regularPrice` |
| Weekend Pass: regular remaining of 300, ceiling on/off | regular `weekend-pass` `scarcity.remaining` / `scarcity` object or null | `scarcity` |
| Per card: remaining | `scarcity.remaining` | `scarcity.remaining` |
| Set every card's state to | bulk `state` | none |
| Save / Copy JSON / Reset | persistence only | none |

# nos-critique-r13

## F1 - page titles follow their h1 wording (Codi R64)

r12 F4 recased the NOS titles to their h1. Codi's R64, with the lead's ruling of 2026-10-18,
goes one step further: a page title's head takes the rendered h1's wording, not just its casing.
The suffix still comes from the existing templates: " — National Orchid Show | SAOC" for NOS inner
pages, and " | South African Orchid Council" everywhere else. No copy is new: every head below is
the page's own rendered h1.

Five pages change only their `title` line, plus their og image line where they have one.

| route | was | now |
|---|---|---|
| /national-show/international-guests | International Guests | International Guests and Exhibitors |
| /national-show/vendors/payment/status | Vendor Stand Payment Status | Vendor Stand Payment |
| /about | About SAOC | About the South African Orchid Council |
| /judging | Judging | Judging at SAOC |
| /contact | Contact | Contact SAOC |

- /national-show/vendors/payment/status is noindex. It now shares its title with
  /national-show/vendors/payment, whose h1 is the same.
- /judging and /contact take their h1 from Sanity (`data?.title ?? fallback`). Their title is a
  static literal copied from the rendered h1. If an editor changes the h1, f1-rendered fails and
  names the route, so the two never drift apart silently.
- The F24 golden `launch-weekend/goldens/f24/titles.json` is superseded for /about and /contact
  (recorded in `nos-critique-r13/goldens/supersession.json`), and both now carry the new titles.
- Nav labels ('International Guests' in the route manifest generator, 'Contact' in the menu) are
  labels, not titles, so they are unchanged.

### Exceptions: titles kept as they are

- / and /societies keep their short titles, because their h1 is a sentence rather than a name.
  This is the lead's exception, and both are listed for Codi. F24 T2 also fixes the home title.
- /national-show/about, /national-show/symposium and /national-show/archive keep their titles
  because of F24 T3: an NOS inner head never repeats "National Show". With the h1 wording,
  "National Orchid Show Symposium — National Orchid Show | SAOC" would fail F24-A2. R64 and T3 are
  both Codi rulings, so the conflict goes back to Codi (DECISION NEEDED in `goldens/f1-spec.md`).

# NOS critique round 1 (F1)

Closes items (b)#3, #9 and #12 of the round 1 critique report.

## What changed

- **Sponsors empty state (#3).** `/national-show/sponsors` no longer uses `RealEmptyListing`. When there are no Show sponsors it renders a page-local G2 block in a NOS `Card`: the heading "Become a sponsor", an R11 pending chip ("To be confirmed by the show committee"), one line ("No Show sponsors have been confirmed for 2027 yet."), and a `mailto:info@saoc.co.za` button labelled "Talk to us about sponsorship". The unsourced second sentence of the old absence statement and the "Each entry will show" scaffold are gone.
- **Prose measure (#9).** Sponsors, symposium and wosa-conference wrap `ShowContentState` in a `contents` div that caps every `<p>` and `<li>` in the content region at 60ch (bar B3). `contents` adds no box, so layout is unchanged.
- **Presenters focus ring (#12).** The ring stays the theme's R9/3 ring: 2px solid, 2px offset, violet `#7E3F97` on light grounds and pale gold `#fbfaf0` on dark grounds. In `presenters.css` the dead presenters outline (`--pc-violet`, 3px offset) was removed because `.nos-theme :focus-visible` already wins, so the render is unchanged; only `border-radius: 4px` remains on that rule. `.pc-role` and `.pc-more` keep `--pc-violet`. Codi corrected the earlier ruling: "R9/3 stands ... 'Royal on light' in my bar D3 and in my presenters ruling was my error." Presenter bios stay at 68ch, per the approved presenters handoff.

## Sourced strings

| string | source |
|---|---|
| "Become a sponsor" | `app/(marketing)/sponsors/page.tsx:109` |
| "Talk to us about sponsorship" | `app/(marketing)/sponsors/page.tsx:119` |
| mailto address | Brad: all contact goes to info@saoc.co.za |
| "To be confirmed by the show committee" | Codi's bar G1; `contracts/golden/show-visitor-info/confirmation-status-model.golden.md:28` |
| "No Show sponsors have been confirmed for 2027 yet." | first sentence of the page's previous absence statement; no council source, disclosed by the R11 chip |

## Known gaps

The R11 chip anatomy (G1) and the hub measure live in files outside this change and are not addressed here.

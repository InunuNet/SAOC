# Golden — the M3 verifier's contract

## The commissioned script

`scripts/checks/verify-show-page-m3.ts`, run as
`node_modules/.bin/tsx scripts/checks/verify-show-page-m3.ts`.

**`scripts/checks/`, never `execution/`** — `.agent/update-manifest.yaml:12` classifies
`execution/` as HARNESS wholesale, so a verifier written there is deleted by the next
`make update-template`, taking its gate with it.

Exit **0** every check passed · **1** a check failed · **2** the verifier itself could not run
(never collapsed into 1). Writes `.tmp/sandbox/nos-ia/m3-results.txt`, one line per check,
two tokens: `C2 PASS`. Colon-free so each assertion is an unquoted one-line grep. Every id
below appears on every run, PASS or FAIL; the verifier writes the full id list first and
exits 2 if any is still unwritten, so a check that silently fails to emit cannot be mistaken
for a defect.

Every check reads the committed corpus with **no Sanity token and no network**, which is what
makes M3 gate-runnable at all.

## Scope: "generated sections"

Every check below applies to sections whose `provenance` is `placeholder-ai` or `research` —
copy **we** wrote. `council-supplied` sections are exempt throughout.

This is the same scoping as P6 and W1/W2, and for the same reason: **we police our own words,
not the client's.** It is what stopped P6 making the council's own venue sentence
unpublishable, and it is why C2 can safely forbid dates that her documents legitimately
contain.

## Check ids

| id | check | dry-run |
|---|---|---|
| C1 | No section named in the M3 plan carries `council-supplied`. If we wrote it, they did not. | — |
| C2 | **No facts of record** in a generated section: no time-of-day, no calendar date, no email address, no phone number, no "over/about/nearly N" count. | **17/17 both directions.** Catches `09:00`, `9am to 5pm`, `24 September`, `Sept 25`, `enquiries@saoc.co.za`, `+27 21 555 0199`, `over 200 growers`, `Dr Naledi Mokoena`. Does not catch `The 2027 National Show`, `R44 northbound`, `Opening times will be confirmed closer to the show.`, `Ticket prices are being finalised`. |
| C3 | **Proper-noun allowlist.** A capitalised multi-word name in a generated section must appear in `content/show-pages/_name-allowlist.json` (SAOC, WOSA, National Orchid Show, Stellenbosch Flying Club, Western Cape, South African Orchid Council, …). | see limits below |
| C4 | **Credential scan** over `content/show-pages/**` and `content/drive-recovered/**`. | **12/12 both directions.** Catches `Email password: …`, `password = …`, `App Password: …`, `api_key: …`, `Access Token = …`, `pwd: …`. Does not catch `Members will need a password to access the journal`, `password-protected`, `Registration tokens are single-use`. |
| C5 | All 15 pages have at least one generated section with a non-empty body. No page ships blank. |  |
| C6 | Spec entry 14 still has no seed source and no `14-` pageKey — regression guard on M1's decision. |  |
| C7 | Entry 7 carries no honorific (`Dr`/`Prof`/`Mr`/`Mrs`/`Ms` + a capitalised name) and no quoted attributed speech. Catches a fabricated abstract under a real researcher's name, which is the specific harm on that page. |  |
| C8 | The venue and theme sentences appear **verbatim** wherever reused. |  |
| C9 | **Per-page sectionKey sets match `per-page-copy.golden.md` exactly** — no missing sections and, more to the point, no extra ones. This is what stops a prose sponsor listing appearing on entry 15 or a prose results table on entry 8, where the honest shape is a real listing from `sponsor`/`award`/`judge`. |  |
| P6 | **No prices in generated copy**, reusing M1's price-vs-route discriminator verbatim (a decimal is decisive; a route keyword within 30 characters, or a known SA route designation, is not a price). Emitted into **this** verifier's `m3-results.txt`, never read from M1's manifest — M1's file does not exist during an M3 gate run, and a grep against a missing file fails in a way indistinguishable from a real defect. |
| W1 | Habitat / distribution / conservation-status vocabulary — `wosa-content-boundary.golden.md`. |  |
| W2 | South African orchid genera. |  |

C4 deliberately does **not** scan `content/drive-source/**`. That tree holds the known
credential exposure Brad is remediating; asserting over it would fail M3's gate on a
pre-existing condition belonging to someone else. Extending C4 to cover it is the correct
follow-up **the moment that remediation lands** — recorded here so it is a scheduled step
rather than a forgotten one.

## C3's known limits, and the right lever

The allowlist **will** produce false positives — a legitimate place name, a correctly-used
organisation. **The fix is to add the name to `_name-allowlist.json`, never to reword the
sentence.** Same lever as P6's route allowlist, written here for the same reason: the next
person will hit it, and the wrong instinct is to edit the prose.

It is also weak in the other direction: it catches a capitalised name, not a lower-case
invented claim. "the venue is a short walk from the station" is false, actionable, matches no
pattern, and only a human reading it will catch it.

## What the M3 verifier does not prove

- **That the copy is any good.** Every check here is a prohibition. Nothing measures whether
  a section reads as a plausible draft of the page Lee-Ann asked for — that is a judgement,
  and it belongs to a person reading it before launch.
- **That no invented claim survives.** C2/C3/C7 are pattern and allowlist checks over the
  shapes invention usually takes. Prose invention that avoids every shape passes.
- **Anything about rendering.** M3 is the corpus. Whether a page displays its notice is M4's
  N1–N10, measured in a browser.

# SAOC "Website Information Form" — society intake (source capture)

**Captured:** 2026-09-01, from screenshots Brad supplied of the live form.
**Source:** https://docs.google.com/forms/d/e/1FAIpQLSc_Wh63oPJDoNQ9PCK7Tzz0a1C-NDf41QxX0RMVWx9iYqJTRw/viewform
**Author:** Lee-Ann McCleland, Secretary (SAOC).
**Stated deadline on the form:** 14 August 2026 (already past as of capture).

## Provenance and its limits

This is a **transcription from screenshots**, not a machine export. The form is sign-in gated
and its public URL carries only the response id, not the form id, so neither Alembic nor
`gws forms forms get` can read it. If the form id is ever shared with Brad's account, re-pull
it with `gws forms forms get <formId>` and supersede this file rather than editing it in place
— same discipline as the two dated vendor-registration captures alongside it.

Question *wording* below is verbatim, including Lee-Ann's own typos and grammar ("Your
societies email address"). Do not silently correct her wording when building against it.

## What this form actually is — read before scoping anything from it

It is **not a society registration or affiliation application.** It is an intake form asking
the *already-affiliated* societies to supply the content for their own pages on the new SAOC
website: committee names and head-and-shoulders photos, logo, history, public contact details,
meeting day/time/venue, and social links. Every question is about publishing an existing
society, not admitting a new one. Nothing in it asks about affiliation status, constitution,
membership numbers, fees, or council approval — the things a genuine registration flow needs.

Brad's backlog request ("Register Society") is therefore **broader than this form.** Treat this
capture as the authoritative field set for the *society profile* content model, and treat the
registration/approval half as still unspecified — see the backlog item.

## Preamble (verbatim intent, condensed)

New comprehensive website for SAOC, public-facing. Asks each society to have ready, before
starting:

1. **Photographs of your management committee** — head and shoulders, neutral background.
   **"We will only have place on the website for 4 management committee members at the
   moment. If you have more than four please indicate this on the form and we will see what
   is possible from our side."**
2. **Logo** — highest possible resolution.
3. **History** — typed in Word, spellchecked, then pasted in.
4. **Contact details.**
5. **Meeting day, time and venue.**

Google account name, email and photo are recorded on upload/submit.

## Question set, in form order

`*` = required on the form. Only the first three are required; everything else is optional.

| # | Question (verbatim) | Type | Notes |
|---|---|---|---|
| 1 | Your Society/Group Name in full * | short text | required |
| 2 | Your societies email address that is used when the public want to contact you. * | short text | required; public-facing address |
| 3 | Cellphone number that the public would use if they want to get hold of you. * | short text | required; public-facing number |
| 4 | Meeting day | short text | free text, not a weekday picker |
| 5 | Meeting time | **time picker** | native HH:MM control |
| 6 | Venue | short text | |
| 7 | Name: Chair/President | short text | |
| 8 | Please attach photo | file upload | 1 file, max 1 GB |
| 9 | Name: Secretary | short text | |
| 10 | Please attach photo | file upload | 1 file, **max 10 MB** |
| 11 | Name: Treasurer | short text | |
| 12 | Please attach photo | file upload | 1 file, max 1 GB |
| 13 | Name: Liaison for communication | short text | |
| 14 | Please attach photo | file upload | 1 file, max 1 GB |
| 15 | Please attach your logo here | file upload | 1 file, max 1 GB |
| 16 | Your website address | short text | |
| 17 | Your Facebook page link | short text | |
| 18 | Your Instagram page link | short text | |
| 19 | History of your society - Please provide as much information as possible | long text | |
| 20 | Comments | long text | |

## Observations worth carrying into any implementation

- **Exactly four committee roles are enumerated**, matching the "place for 4" note: Chair/
  President, Secretary, Treasurer, Liaison for communication. Each is a name field immediately
  followed by its own single-photo upload. The form offers no way to add a fifth — the
  preamble asks societies to raise it in Comments instead. A real implementation should decide
  deliberately whether four is a display cap or a data cap; the form conflates them.
- **The 10 MB cap on the Secretary photo (Q10) is almost certainly a mistake** — the other
  three committee photos and the logo all allow 1 GB. Do not replicate the inconsistency. Our
  own upload path should impose one sane image cap across all five uploads, and validate MIME
  type, exactly as `planProofOfPaymentUpload()`/`planMarketingAssetUpload()` do in the vendor
  flow. A 1 GB image upload is not a limit any of our routes should accept.
- **No province, city, or slug field**, all of which our `Society` type in `types/index.ts`
  requires. The form assumes SAOC already knows which society is answering; a public form
  cannot. Whoever scopes the build must resolve this rather than guessing.
- **Only three fields are required**, so most submissions will arrive sparse. Any page rendering
  this data needs a genuine empty state per field, not a placeholder that implies missing
  content is a bug.
- **Socials cover Facebook and Instagram only** — no TikTok, YouTube or X, unlike the vendor
  registration form's five-platform Online Presence set.
- The form records the submitter's Google identity. Our equivalent will not have that, so
  attribution — which society, verified how — is an open question, not a detail.

# p2-register-society-society-profile-inta

**[P2] Register Society — society profile intake + registration flow** (added 2026-09-01,
  Brad). **Field set captured 2026-09-01** from Lee-Ann's Google Form, transcribed from
  screenshots Brad supplied, at `docs/leeann-source/society-website-information-form_2026-09-01.md`.
  Read that file first; it is the source of truth for the profile half and records every
  observation below with detail.
  **The form is narrower than the ask.** It is Lee-Ann's "Website Information Form" — an intake
  asking *already-affiliated* societies for the content of their own website pages (society name,
  public email and cellphone, meeting day/time/venue, four committee members each with a
  head-and-shoulders photo, logo, website, Facebook, Instagram, history, comments). It contains
  nothing about affiliation, constitution, membership, fees or council approval. So the profile
  content model is specified; **the registration/approval half is not, and must not be inferred
  from the form.** Ask Lee-Ann what a society actually has to submit to affiliate, before any
  architect pass on that half.
  Open questions the form itself cannot answer, all flagged in the capture: no province/city/slug
  field though our `Society` type requires all three; exactly four committee roles enumerated
  (Chair/President, Secretary, Treasurer, Liaison for communication) with no path to a fifth
  beyond a Comments note; only 3 of 20 questions required, so submissions will be sparse and every
  field needs a real empty state; socials are Facebook + Instagram only, unlike the vendor form's
  five platforms; and the form leans on Google identity for attribution, which ours will not have.
  Do not replicate the form's upload limits — it allows 1 GB per image (and inconsistently 10 MB
  for the Secretary photo alone). Impose one sane image cap with MIME validation, mirroring
  `planProofOfPaymentUpload()`/`planMarketingAssetUpload()` in the vendor flow.
  Likely shape: public form -> Firestore collection -> committee review under `/admin`, i.e. the
  pipeline already built and proven for vendors (`vendorApplications` -> approval -> gated full
  registration). Reuse that architecture rather than inventing a second one; the vendor mission's
  goldens are the pattern.

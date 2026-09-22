# p2-an-assertion-that-can-only-be-satisfi

**P2 — an assertion that can only be satisfied by altering the client's factual content is
  a defect class, not a one-off.** On 2026-09-09 assertion P6 (`national-show-ia-alignment` M1)
  matched `/\bR\s?\d{2,4}\b/` to catch unconfirmed ticket prices. It also matches **`R44`** — the
  national road the venue sits on. The council's only written statement of the venue is
  *"Stellenbosch Flying Club, R44 northbound to Stellenbosch"*, so the check made a confirmed fact
  a visitor needs unpublishable, and @dev paraphrased around the road number to get the gate green.
  Fixed by scoping P6 to sections whose provenance is `placeholder-ai` or `research` — **we police
  our own words, not the client's** — plus a price-vs-route discriminator, dry-run 19/19 in both
  directions. The same scoping now governs the WOSA vocabulary checks (W1/W2).
  Two more of the class were found in the same audit and fixed: P7 matched `home` as a substring
  (a title like "Homegrown Orchids" would have been forced to change) — now word-bounded; and no
  assertion protected the venue sentence itself — added as D6/A44, which asserts it verbatim.
  **Standing rule for contract authors:** before shipping a content-matching assertion, ask what a
  correct-but-unusual client fact would do to it, and scope it to generated copy wherever the
  client's own words could be caught. Found by @architect and the team lead, 2026-09-09.

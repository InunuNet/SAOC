# Golden: "biennial" is wrong, the source says triennial

Governing rule: docs/rules/no-invention.md. Copy traces to Lee-Ann's Drive documents, and these two
say the cadence (saved at .tmp/sandbox/leeann-answers/, gitignored; the quotes are the evidence):

- about-2027.txt line 5: "...the South African Orchid Council's premier triennial event..."
- what-to-expect.txt line 5: "...takes please every three years. The Show moves between provinces on this cycle..."

Defect: components/societies/SocietyExpect.tsx:16 renders on all 21 /societies/[slug] pages:

  "Most societies hold at least one annual show, judged under SAOC’s national standards, and many exhibit at the biennial National Show alongside societies from across the country."

Required result: the single word "biennial" becomes "triennial". Nothing else in the sentence changes.
`grep -rniI biennial app components lib content sanity docs` returns no match afterwards (at baseline
SocietyExpect.tsx is the only hit). Do not add "every three years" or any other new cadence wording.

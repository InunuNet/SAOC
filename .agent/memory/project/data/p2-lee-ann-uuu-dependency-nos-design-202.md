# p2-lee-ann-uuu-dependency-nos-design-202

**[P2] Lee-Ann uuu dependency (NOS Design, 2026-10-25):** when Lee-Ann sends the Exhibitors intro (doc item uuu) and the Sanity intro changes, the same change must remove the `firstSentence` trim at app/(nos)/national-show/exhibitors/page.tsx:191 so public renders her copy in full. Same rule for any field trimmed by withholdPlaceholderProse(): the trim goes when its copy is confirmed.

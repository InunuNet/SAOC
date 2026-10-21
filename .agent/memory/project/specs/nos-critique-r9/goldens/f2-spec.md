# nos-critique-r9 F2 - research chip ruling (Codi FINAL)

BASE = r8 tip 812dbaa2 (restacked on main 81490e7a; was 6bffbe7c). Footprint: goldens/f2-footprint.json (StatusMarker.tsx, ShowStatusLine.tsx, VisitDisclosure.tsx, ConfirmationBadge.tsx) + docs/nos-critique-r9.md.

RULING: a research chip shows the visible text "Not yet confirmed" at EVERY width. The full research wording (Sanity researchLabel) goes in the disclosure's foot and in the group's aria-label.

Design (architect):
- "Not yet confirmed" is StatusMarker's existing FALLBACK_RESEARCH_LABEL. Reuse it; type it nowhere else (static S2). No new copy.
- StatusMarker gains an opt-in prop `shortResearch`. With it, a research marker renders exactly ONE label span, FALLBACK_RESEARCH_LABEL, for both kinds. Without it (every SAOC caller, a bare marker with no disclosure to hold the foot) the chip keeps the full wording, so no information is lost. ConfirmationBadge forwards the prop. Pending behaviour (full label plus the short tag under shortOnNarrow) is unchanged.
- Disclosures that hold a chip pass it, and when the chip is research they set the group's aria-label to researchLabel (falling back to the existing label when researchLabel is empty) and draw researchLabel as a ShowStatusFoot inside the group: ShowStatusLine (items present only), VisitGettingThere, VisitAttractions, VisitEmergency (after the on-site note, which stays). With no researchLabel the chip is "Not yet confirmed" and there is no foot.
- A group with any pending item keeps the pending chip and the existing label (pending beats research), exactly as today.
- No live route renders a research chip today (every live status is pending), so the proof is the props-only fixture (f2-fixture) plus the static wiring check; the pending-state cases in the fixture guard against regression.

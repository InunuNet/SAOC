# Codex QA prompt, nos-archive-back-arrow F1

Review the whole diff on this branch, taken three-dot against the merge base (`git diff origin/main...HEAD`; main has moved since the branch point, so never two-dot against main's tip), against .agent/memory/project/specs/nos-archive-back-arrow/spec.md and goldens/rulings.md (NOS Design rulings are final; do not question the design) and goldens/values.json. Be adversarial. Report PASS/FAIL with file:line.

Attack surface, in priority order:
1. Any U+2190 (or &larr;, &#8592;, &#x2190;, ←) left anywhere under app/(nos), components/nos, components/nos-chrome, components/tickets, or rendered on a NOS-host page.
2. The arrow must be the keepsake ArrowIcon from components/tickets/keepsake/parts (unchanged), never components/ui/ArrowIcon; a second arrow system, an inline duplicate svg, or an edit to parts.tsx or to the base .nk-icon rule is a FAIL.
3. Mirror and spacing: scaleX(-1) on the icon only, leading the label with no literal space; margin-inline-end 8px (the .nk-visit a gap, not the 10px .nk-btn gap); size left to .nk-icon 1.1em (about 15.4px at 14px), never overridden. Check logical properties and RTL do not break the layout.
4. Hover: translateX(-3px) combined with the mirror (not +3px, not a lost mirror), transition var(--dur-slow) var(--ease-nos) declared only under prefers-reduced-motion: no-preference; no nudge or transition under reduce. Check the Earlier link nudges on link hover (the group), not only on the label.
5. Labels move to the Caps tuple (Karla 700, 14px, 0.12em, uppercase) on both links, by computed value; no token that does not exist on main (--w-caps).
6. No regression: focus ring, tab order and tab-stop count, 44px target floor (nos-structure.css back-link rule), the Earlier link's two-line column layout, the "Later" link (its markup and typography must be byte-identical to main: 12px, semibold, tracking 0.18em; any restyle of it is a FAIL), the hero and breadcrumb, mobile 390 overflow.
7. Scope: nothing outside the archive/[year] page and the NOS stylesheet changed, except this branch's own spec directory .agent/memory/project/specs/nos-archive-back-arrow/** (exempt: it is the contract and gate, not product code); no SAOC-host file touched; no invented copy, colour or font (docs/rules/no-invention.md).
8. The gate itself: checks/ must stay on Sanity fixture replay with zero live Sanity requests, kill only the recorded PID, and not weaken an assertion to pass.
9. The contract filename contract.yaml is an accepted repo convention (25 tracked specs use it and the gate accepts it); do not flag it.

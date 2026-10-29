Adversarially review the working-tree diff (git diff HEAD plus untracked files) for NAV-1 (branch fix/nav-focus-underline).
Spec: .agent/memory/project/specs/nav-focus-underline/goldens/README.md and aria-current-fixtures.json. NOS Design ruling NAV-1 is final;
do not flag the decision to drop the focus ring from nav/footer links, the aria-current="true" on disclosure triggers, or the
decision to keep rings on buttons, fields and the brand lockup link. Hunt for: keyboard focus becoming invisible anywhere
(WCAG 2.4.7), including forced-colors mode and the active+focused state; focus indicator below 3:1 (1.4.11); a ring or outline
still drawn on a nav/footer link; a ring lost from a button, field, brand link or the NOS CTA/burger; the skip link changed;
route-change focus: focus left on the clicked link (desktop header, SAOC mobile menu, NOS drawer), focus stolen from an
autofocused field or a hash navigation, a scroll jump from focus() without preventScroll, an outline drawn on the h1 or <main>,
focus moved on the first render or on a query-only change, the RouteFocus effect racing the SAOC MobileMenu focus-trap return
(hamburger regaining focus after the h1); aria-current wrong: "page" on a cross-site link, a string-prefix match (/eventsfoo
marking /events), a missing parent on a child route, aria-current="false" rendered, the NOS hub marked current on every route;
active visual not driven by [aria-current]; bare hex colours in the new focus/active rules; changes outside the allowed file set.
First line of output must be PASS or FAIL, then findings.

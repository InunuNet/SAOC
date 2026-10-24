Adversarially review the working-tree diff (git diff HEAD plus untracked files) for HD-1 (F2) and HD-1b (F3) on branch fix/nav-focus-underline.
Spec: .agent/memory/project/specs/nav-focus-underline/goldens/hd1-header-parity.md, header-geometry.json and README.md. NOS Design HD-1 is final;
do not flag removing the utility bar, moving "Join a society" into the header, removing the show pill, or the 1260 breakpoint. Hunt for: the two headers
differing in height, lockup ink box, nav item size/weight/line-height/tracking, CTA box or right edge, bar gap or padding at any of 2056/1440/1280/1024/390;
SAOC nav wrapping to two lines or the page overflowing sideways (the full-name lockup is wide: a quiet shrink of the lockup, nav or CTA to make it fit is a FAIL);
the lockup cropped, recoloured or filtered; hover or focus fills on menu items (only the aria-expanded trigger keeps a fill); the bar slot not -8px or the active
bar not 2px; a hover/focus underline missing on one host; the SAOC search moving the CTA's right edge, or unreachable below 1260; the MENU button icon-only or
under 44px; a leftover reference to UtilityBar, the show pill, or the 1240 breakpoint; info@saoc.co.za missing or misplaced in the footer brand column, or a
Footer.tsx merge that drops fix/saoc-societies-footer's three-column change; the ticketing preview banner mounting on SAOC or its NOS offset changing;
NAV-1 regressions (rings back on links, aria-current lost, route focus broken); the container token changed per page instead of through the token, a public SAOC
page still on the 1216 box, a bare hex colour in new rules; changes outside the allowed file set. First line of output must be PASS or FAIL, then findings.

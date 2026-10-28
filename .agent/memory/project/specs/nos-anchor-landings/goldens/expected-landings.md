# Expected landings (the gate's target table)

Every /faq, /plan-your-visit and /sponsors hash target, rendered, `next start` on a replay build: gap = target top minus the bottom of the pinned chrome, 24 +/-2.

| width | header (pinned?) | doc index | pinned-chrome bottom | doc h2 lands at (viewport top) | gap |
|---|---|---|---|---|---|
| 390 | 146.8, scrolls away | 48px sticky bar at top 0 | 48 | 72 | 24 |
| 767 | 154.9, scrolls away | 48px sticky bar at top 0 | 48 | 72 | 24 |
| 768 | 97 sticky | 48px bar at top 97 | 145 | 169 | 24 |
| 779 | 97 sticky | 48px bar at top 97 | 145 | 169 | 24 |
| 780 | 97 sticky | 48px bar at top 97 | 145 | 169 | 24 |
| 1023 (probe) | 97 sticky | 48px bar at top 97 | 145 | 169 | 24 |
| 1024 | 97 sticky | side card, no bar | 97 | 121 | 24 |
| 1440 | 97 sticky | side card | 97 | 121 | 24 |
| 2056 | 97 sticky | side card | 97 | 121 | 24 |

Non-doc targets (`.nos-theme [id]`, `[data-nos-group]`, e.g. #pyv-emergency-h): 24 under 768 (nothing pinned), 121 from 768.
The sponsors card (#enquire) is SAOC's rule and is asserted too: 24 under 768, 121 from 768; it passes only once SAOC's card fix is on main.
Page-end targets that cannot scroll that far are reported SHORT by the survey and exempt.

Red on main d52d3eb6 (golden evidence): `red-main-a13-8w.txt` (176 of 176 asserted landings fail) and `red-main-probe-chrome.txt`.
Headline numbers on main: doc headings at >=1024 land at 112, gap 15; at 768-779 the doc index bar sticks at top 0 UNDER the 97px header and the heading
lands at 64, gap -33 (hidden behind the header); at 780-1023 the heading lands at 161, 64 below the header (16 below the bar); at 390/767 it lands at 64, gap 16 below the bar.

# nos-critique-r8 F3 - define --green-1 and --green-2 (P3; Codi FINAL)

BASE = main 81490e7a (re-based from 8e1d31d7). Footprint: goldens/f3-footprint.json (nos-theme.css, ShowHoldingNote.tsx).

In nos-theme.css, in the rule that holds --ink-700 / --gold, add `--green-1: #A7A841;` and `--green-2: #7F7D33;` with a comment naming --green and citing nos-v4 index.html l.19-20. Remove the inline fallback in ShowHoldingNote.tsx (`decoration-[var(--green-1,#a7a841)]` becomes `decoration-[var(--green-1)]`), so --green-1 leaves the grandfathered PREEXISTING_FALLBACK set (r8's undefined-var scan grandfathers only --nos-hero-pos) and the scan covers it. ShowHoldingNote is used only on what-to-expect (NOS), so the token is always in scope. --green-2 is defined for the golden's parity; nothing needs to use it yet. nos-chrome.css and presenters.css keep their own prefixed --nc-green-* / --pc-green-* tokens untouched.

Rendered: .nos-theme resolves --green-1 to #a7a841 and --green-2 to #7f7d33 (literal), and the holding-note underline, where the note renders, computes rgb(167, 168, 65).

# saoc-mono-floor: spec for @dev (NOS Design ruling P2, final; queue split-f3-notes.md "NOS Design overnight live sweep")

Worktree `.tmp/sandbox/mono-floor`, branch fix/saoc-mono-12px-floor at origin/main. Ruling: every SAOC mono label is at least 12px; tracking and case unchanged; NOS already passes and must not change. Worst today: home stat labels 10px, "EST. 1968" 10.5px.
No invention; no copy change; CSS only in `app/globals.css`.

## 1. Findings (measured on origin/main)

The ruling's "one token change" is not enough on its own. The SAOC mono sizes come from two places:
1. Tokens in `app/globals.css`: `--mono-md: 12px` (line 68, already fine), `--mono-sm: 11px` (69, used by `.eyebrow`, line 282), `--mono-xs: 10.5px` (70, used by `.mono-label`, line 294). `--mono-tracking: 0.18em` (71) and `.mono-label`'s 0.2em stay.
2. Tailwind literals that bypass the token: 105 `text-[Npx]` classes outside the NOS and admin-only trees, 105 of them on elements that also carry `font-mono`: 20 at `text-[10.5px]`, 16 at `text-[10px]`, 69 at `text-[11px]` (components/home/*, components/ui/PageHero.tsx, components/societies/*, app/(marketing)/*, app/(shared)/*, vendors, media-kit, and 15 in admin). The home stat labels and "EST. 1968" are among them.
3. One hard-coded mono rule: `app/globals.css:507-508` (the QR-scanner pill, `font-family: var(--mono); font-size: 11px`).
4. NOS precedent: `.nos-theme .font-mono { font-size: .75rem }` and an unlayered `.nos-theme :is([class*='text-[9px]'], ... )` rule (nos-theme.css ~455-462) already floor the same literals inside NOS. NOS is therefore unchanged by an identical-value SAOC rule.

## 2. Decisions (exactly what changes, all in app/globals.css)

D1 `--mono-sm: 11px` -> `12px` (line 69) and `--mono-xs: 10.5px` -> `12px` (line 70). Update the trailing comments only if they state the old value.
D2 Line 508 `font-size: 11px` -> `12px`.
D3 Add ONE unlayered rule near the `.mono-label` block, so it beats the Tailwind utility layer exactly as the NOS rule does:
`.font-mono:is([class*='text-[9px]'], [class*='text-[10px]'], [class*='text-[10.5px]'], [class*='text-[11px]']) { font-size: 0.75rem; }`
Set nothing else in it: no letter-spacing, no text-transform, no line-height. Any other sub-12px literal that check-static finds on a `font-mono` line must be added to the selector list.
D4 The rule is site-wide, so the 15 admin `font-mono` labels also reach 12px (a 0 to 2px increase). Accepted: one rule, no admin file edits, admin is outside the probe. If the lead wants admin excluded, that is a one-line `:not(...)` change and a new contract.
D5 No `.tsx`, no NOS file, no token rename. Do not touch tracking or case.

## 3. Procedure for @dev

Step 0, BEFORE any edit: build (A6 command) then `node .agent/memory/project/specs/saoc-mono-floor/checks/gate-mono.mjs record-nos`. It writes `checks/nos-baseline.json` and refuses on a modified tree. Commit the baseline with the change. Then make D1-D3, rebuild, run the gates.

## 4. What the gates prove

- static: tokens >= 12px, tracking and case rules intact, the floor rule exists and covers every sub-12px `font-mono` literal in the source, no NOS file changed.
- saoc probe: every visible text element whose computed font-family is the SAOC mono face is >= 12px on /, /about, /societies, /judging, /events, /sponsors, /contact, /privacy, /terms, /refunds, /constitution at 1280 and 390.
- nos probe: for /, /faq, /plan-your-visit the size, tracking and case of every mono-role element (`.font-mono`, `.mono`, `.mono-label`, `.eyebrow`) equals the baseline recorded on pristine origin/main.

## 5. Gaps

None blocking. Note the line-height of mono labels is not part of the ruling and is left as authored; if a 12px label wraps differently at 390 that is reviewed by eye (NOS Design).

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

## 3b. QA amendments (Codex FAIL on #71, 2026-10-24)

1. The NOS parity probe compares the computed font-size, letter-spacing and text-transform of EVERY text-bearing element on /, /faq and /plan-your-visit at 1280 and 390 (not only mono-role classes, which matched nothing on NOS and made the first baseline vacuous). The baseline must be non-empty: at least 20 elements per route and viewport, enforced when recording and when comparing, and at least 80% of baseline elements must be matched on comparison.
2. The runtime probe also visits /admin/login (public, `font-mono text-[11px]`), since D4 put admin in scope.
3. The static check no longer needs `font-mono` and the literal on one line: a sub-12px `text-[..]` literal counts when `font-mono` is within 400 characters in the same file. Runtime coverage (gate-mono.mjs) is the authority; the static check only has to make the floor selector complete.
Dev must re-record the baseline from pristine origin/main (step 0) with the amended script.

## 3c. Lockup tagline exemption (NOS Design ruling on #71, 2026-10-24)

The SaocLockup tagline (`components/chrome/SaocLockup.tsx`, both sites: `font-mono ... text-[11px]`, tracking 0.22em) is part of the logo and Brad's rule is never to alter lockups, so it stays 11px / 0.22em. Mechanism: a `data-lockup-tagline` attribute on both tagline spans plus a one-line comment at each stating the exemption, and `:not([data-lockup-tagline])` appended to the floor selector in `app/globals.css`. Nothing else in SaocLockup.tsx changes (A2 checks the diff is comments and the attribute only). The runtime probe skips these elements for the 12px floor but asserts they compute to exactly 11px at 0.22em (2.42px) on every SAOC route that renders the lockup.

## 4. What the gates prove

- static: tokens >= 12px, tracking and case rules intact, the floor rule exists and covers every sub-12px `font-mono` literal in the source, no NOS file changed.
- saoc probe: every visible text element whose computed font-family is the SAOC mono face is >= 12px on /, /about, /societies, /judging, /events, /sponsors, /contact, /privacy, /terms, /refunds, /constitution at 1280 and 390.
- nos probe: for /, /faq, /plan-your-visit the size, tracking and case of every mono-role element (`.font-mono`, `.mono`, `.mono-label`, `.eyebrow`) equals the baseline recorded on pristine origin/main.

## 5. Gaps

None blocking. Note the line-height of mono labels is not part of the ruling and is left as authored; if a 12px label wraps differently at 390 that is reviewed by eye (NOS Design).

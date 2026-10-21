# RESUME — NOS critique rounds r19–r30 (2026-10-20)

This file was rebuilt after `brain.py wrap-up` purged `.agent/memory/scratch/`, which took the original `resume-20261020-restart.md` with it. Its source is the session summary plus the live state of this session.

## Standing orders
- Lead **saoc-82** speaks for Brad and relays Codi's FINAL rulings. Uncertain calls go to a 3-way vote: the lead, Codi and us.
- Chain: architect spec → dev → gate → Codex (`bash execution/codex_qa.sh <brief>`) → push a new branch, never force → send the SHA to the lead.
- **HOLD every build, push and dev step until the lead sends the DNS "go".** Spec-only work is allowed.
- Ports 3010–3019 only. Never pkill next-server.
- NO INVENTION: `docs/rules/no-invention.md`.
- Sanity edits belong to the lead.

## Rounds (merge in this order)

| round | branch @ head | state |
|---|---|---|
| r19 | fix/nos-critique-r19-restack | gate 5/0, Codex round 2 PASS. **Ready to push** on the go |
| r20 | fix/nos-critique-r20 @ 599c9c50 | spec only (sign-up, section gap, footer to the SAOC grid) |
| r21 | fix/nos-critique-r21 @ d47756c9 | spec only. The lead applies 9 Sanity edits after the gate |
| r22 | fix/nos-critique-r22 @ d0e42236 | spec only ("Show less" toggle) |
| r23 | fix/nos-critique-r23 @ 699107d2 | spec only (exhibitors page + status pills) |
| r24 | fix/nos-critique-r24 @ 9c66e6ee | spec only. Re-capture after r23 |
| r25 | fix/nos-critique-r25 @ b328cfc2 | spec only (brass radius, judging link min-h-11) |
| r26 | fix/nos-critique-r26 @ 21eaa9a8 | spec only. Re-pin after r25 |
| r27 | fix/nos-critique-r27 @ 14218649 | stacked on r26. Button disabled state. Baseline is .tmp/sandbox/r26-ref |
| r28 | fix/nos-critique-r28 @ **c521de30** | spec FINAL. Peek only, no NOS fade (H4). The row.scrollLeft effect is used, never scrollIntoView. The reference is .tmp/sandbox/r28-ref |
| r29 | fix/nos-critique-r29 @ a4807791 (clean) | **No spec written.** The architect failed with "Not logged in". See below |
| r30 | — | waits on Codi's format ruling |

On every round, A4/A5 (rendered checks and baselines) wait on DNS and headless Chromium. Re-pin the spec BASE after any rebase.

## r29: re-dispatch the spec (arrow only, approved by the lead)
- Copy `<span aria-hidden className="mt-4 text-muted">→</span>` verbatim from `components/societies/SocietyCard.tsx:99-101`.
- Make it the last child of the content column in `components/events/EventCard.tsx` (:47-81). Render it only when the card is linked.
- The date block stays byte-identical. The home EventsStrip/EventRow stays unchanged.
- A4 checks, at 390 and 1280: the arrow sits below the content, on the content edge, and is absent from the a11y tree.
- A5: no regression on /events, the featured list or the home EventsStrip.

## r30 (pending Codi's format ruling)
- Fix `formatShowDateRange` (`lib/show-identity.ts:22-40`). Today it renders month and year spans wrongly: "30–2 October 2027", "31–2 January 2028".
- Run a regression probe on every caller (Hero, NavCards, ShowBand, the national-show pages). Same-month output must stay byte-identical.
- Use one time zone for the formatter, EventCard and the `app/(marketing)/events/page.tsx:30-33` grouping. The formatter is on Africa/Johannesburg; the other two are on UTC. The lead suggests Johannesburg, to be confirmed by Codi or the architect.
- After that, the EventCard day-span display (day span over the short month). Codi decides the copy format.

## Other open items
- Main tree: Brad's restore is still pending; the classifier denied the rsync and he has the `!` command.
  - After it lands: commit chore(memory), fetch, rebase, run the zero-loss check, then push.
  - Do NOT commit the 3.8.31 harness.
  - The archive is .tmp/sandbox/archive-20261019/main-tree-move/. The backup branch is backup/main-tree-feat-nos-hero-lockup-20261019, with the stash "main-tree-move 20261019".
- Boot identity (rename vs copy of "SAOC NOS Site" vs "SAOC") is Brad's call.
- Post-launch: harness 3.8.40.
- **Pitfall:** `brain.py wrap-up` purges scratch. Keep resume notes in `.agent/memory/project/handoff/`.

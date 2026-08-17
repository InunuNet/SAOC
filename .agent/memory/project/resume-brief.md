# Resume Brief — ticketing-foundation

_Written 2026-08-17 22:52 SAST. Backs the 02:22 one-shot cron, which is session-only and
dies with the session — if that job never fired, start here instead._

## State at hand-off

- F1–F10 done, gated, committed. F7–F10 = commit `ab4237b`.
- Gates verified by the orchestrator, not just reported: F7 8/8, F8 9/9, F9 9/9, F10 9/9.
- Both ITN golden pins agree at `253c15c4dc56bdf32bb7391d610d75c4e2b9ab5f5531914bd640af20f096fd8b`.

## Next work, in order

1. **F11** — QR generation at email-send time; confirmation email carrying every position's
   QR plus the signed recovery link. Full chain: @architect (contract + goldens) → @dev →
   @qa → @docs → gate → commit. No contract.yaml and no golden files → no @dev dispatch.
2. **Fictional test show** — drive a ticket through checkout → payment → confirmation → door
   check-in end to end, as far as is possible without Brad in the loop. `arch-fictional-show`
   was briefed; check whether its contract landed on disk before re-dispatching.

## Blockers that must not be worked around silently

- `scripts/admin-migrate-roles.ts` has never run with `--apply` — zero accounts hold a
  `roles` claim.
- No production `ShowWindowLookup` (`lib/admin-auth.ts:199` defaults to `() => null`), so
  every per-show grant refuses.

Both block F13 and both need Brad. F12/F13/F14 are human-gated — do not fake them. Queue what
needs him in `needs-human.md` and keep working on what does not.

## Standing constraints

- Never delete any Firestore or Sanity document — deletion is Brad's call alone.
- `app/api/tickets/itn/route.ts` is sha256-pinned. F10 was the sole authorised reopening;
  treat it as pinned again now.
- Never print or log a credential value.
- `branding/`, `design spec/`, `design/Claude Design HTML/` are Brad's active workstream.
  Stage commits with explicit paths only — never `git add -A`.
- Never read or write outside this project directory.
- All URL fetching and search goes through Alembic at `localhost:7077`.
- Security is never surfaced as Brad's tradeoff.

## Method note

Verify every agent completion report against disk and against a gate you run yourself before
accepting it. Several reports this session were wrong.

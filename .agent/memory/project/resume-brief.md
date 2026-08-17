# Resume Brief — ACTIVE MISSION: vendor-registration

_Updated 2026-08-18 ~00:20 SAST._

## Read this first

The active mission is now **vendor-registration** (11 features, 3 milestones), not
ticketing-foundation. `mission.py resume` will point at it correctly.

**ticketing-foundation is finished as far as it can go autonomously: 11/14 done, M1 passed,
and F12/F13/F14 are marked `blocked` because they need Brad in person** — a real sandbox card
payment, a physical scanner at The Hangar, and `scripts/admin-migrate-roles.ts --apply`.
Brad has explicitly deferred those; do not attempt them and do not un-block them. The
step-by-step runbook is in `needs-human.md`.

## vendor-registration — where it stands

F1's naming decision is already made, by Brad's standing delegation: internal names are
`vendor*` (`vendorNursery`, `vendorSubmissions`, `/national-show/vendors`,
`/api/vendors/register`), while **public marketing copy keeps Lee-Ann's "Exhibitors" wording
verbatim**. The repo already ships an unrelated `exhibitor` feature for judged competition
entries — two meanings of that word in one repo is the trap being avoided. Do not re-open this.

Source of truth for the content is Lee-Ann's Google Doc, id
`1UKUdzZ9NAJHsqWHSV0mN9tnTrp6NE8I4`. **Read it with the `gws` CLI, never curl or Alembic** —
those mangle Drive content. Verify field lists against the document itself; the mission's
inline briefs were written from it but have not been re-checked.

In flight when this was written: `arch-vendor-f1f2` producing the contract and goldens for
F1+F2. Check whether `contracts/contract-vendor-f1f2-naming-and-nursery-schema.yaml` exists
before re-dispatching.

## Scope boundary — enforced on every feature

SAOC is orchids **in cultivation**: growing, showing, hybridising, judging, community. It is
**not** wild orchid conservation — that belongs to WOSA, a separate partner organisation.
Never produce wild-conservation content; link to WOSA instead.

---

# Reference — ticketing-foundation (completed portion)

## State

Mission is **11/14 features done, milestone M1 passed (8/8)**.

Commits this session:
- `ab4237b` — F7 check-in audit, F8 comp tickets, F9 demo ticket type, F10 ITN re-pin
- `69310d7` — re-based every stale ITN route pin onto F10's authorised content
- `ee59710` — repaired the pulse launchd PATH bug, gated the autonomous jobs
- `d7ca81b` — F11 QR confirmation email + the fictional test show

All gates verified by the orchestrator personally, not taken from agent reports: F7 8/8,
F8 9/9, F9 9/9, F10 9/9, F11 9/9, fictional-test-show 11/11, F1 9/9, M1 milestone 8/8.
Both @qa verdicts PASS.

## IN FLIGHT — uncommitted, check these first

Two @dev agents were still running when the session hit its limit. Their work is on disk but
**unverified and uncommitted**. Do not trust it until you run the gates yourself.

- `dev-checkout-orders` → `lib/checkout-reservation.ts` (new), `app/api/tickets/checkout/route.ts`,
  `.env.local.example`. Gate: `contracts/contract-ticketing-checkout-orders.yaml`
- `dev-show-window` → `lib/show-window-lookup.ts` (new), `app/api/admin/tickets/comp/route.ts`,
  `sanity/queries.ts`. Gate: `contracts/contract-ticketing-show-window-lookup.yaml`

Both contracts and goldens are complete and committed. Re-run each feature's phase-4 gate,
plus F2/F10 (for checkout-orders) and F4/F8 (for show-window) to prove nothing regressed.
If the work is incomplete, re-dispatch @dev against the existing goldens — do not re-architect.

## Next work, in order

1. **Land checkout→orders.** This is the P1. `app/api/tickets/checkout/route.ts` writes only to
   `tickets`; it never creates an `orders` document. So F10's `markOrderAndPositionPaidByPaymentId()`
   always resolves `order-not-found` on a real purchase, F11's confirmation email never fires,
   and every order's `recoveryToken` stays null. Nothing end-to-end works until this lands.
2. **Land ShowWindowLookup.** `hasCapability()` defaults `lookupShowWindow` to `() => null` and
   nothing passes a real one. Org-wide `roles['*']` grants resolve fine; every **per-show** grant
   is refused, always — which is exactly F13's case.
3. **Then F12 / F13 / F14**, which need Brad (see below).

## Needs Brad — cannot be done autonomously

- `scripts/admin-migrate-roles.ts --apply` has never been run. Zero accounts hold a `roles`
  claim. F13 cannot pass without it.
- The physical door-connectivity observation at The Hangar (F12).
- A real PayFast sandbox purchase on the deployed host (F12) and the lost-ticket recovery
  round trip (F14).
- Whether to trust the pulse daemon at all — see below.

## Pulse: repaired, deliberately gated

`pulse_runner.sh` had aborted every 300s since **2026-06-28** on "missing required dep(s): bun".
bun is installed at `~/.bun/bin`, but launchd runs with `PATH=/usr/bin:/bin:/usr/sbin:/sbin`.
Fixed. Repairing it revived 14 dormant jobs at once, so everything that writes, pushes, spawns
or applies is now `chmod -x`:

`mission_loop.sh` (would enqueue an autonomous "never pause" session against this same mission
every cycle), `qa_guard.sh` (`gh issue create`, `git push`), `fleet_improve.sh` (`--apply`),
`orchestrate.sh`, `shepherd.sh`, `auto_update.sh` (it overwrote `.agent/agents/architect.md`
and `qa.md` before being gated — **diff those before committing them**), `auto_fix_issues.sh`.

Re-enable any of them with `chmod +x`. Nine read-only watchers plus `scheduled_resume.sh`
remain live. Brad's standing view: pulse is experimental and needs proper QA before it is a
go-to. The resume mechanism should go through the normal contract chain before being trusted.

## Standing constraints — all still in force

- **Never delete any Firestore or Sanity document.** Deletion is Brad's call alone.
- `app/api/tickets/itn/route.ts` is sha256-pinned in four contracts and full-content-golden'd
  in a fifth. F10 was the sole authorised reopening and it is closed again. **All five guards
  must be re-based together** — a ceremony that updates only its own orphans the rest.
- Never print or log a credential value. A recovery token is a bearer credential.
- `branding/`, `design spec/`, `design/Claude Design HTML/` are Brad's active workstream.
  Stage commits with explicit paths only — **never `git add -A`**.
- Never read or write outside this project directory.
- All URL fetching and search via Alembic at `localhost:7077`.
- Security is never surfaced as Brad's tradeoff.

## Method

Verify every agent completion report against disk and against a gate you run yourself. Several
reports this session were wrong. Do not run a gate while @qa is mutation-testing — the gate
reads the deliberately-broken file and the result looks like a real failure.

## Known open, not blocking

- F11's default `siteUrl` fallback is executed by checks but its output is never asserted — a
  misspelled env var or wrong fallback host would ship green. Narrow gap, queued.
- `components/tickets/TicketPurchaseForm.tsx` is 155 lines against the project's own 150-line
  limit; fails `ticketing-m1-m2` A35. Pre-existing. Needs sub-component extraction plus
  BrowserAgent verification at 1440/375/320px.
- `/tickets` still has no show-scoping. TTL 180d and the R10 demo price remain placeholders.

## Orchestrator economy rules (Brad, 2026-08-18 00:10)

- Fable 5 is the orchestrator. Its weekly quota is the scarce resource — be SUPER lean.
- Orchestrator: dispatch, verify gates, commit. No long prose, no re-reading what agents
  already read, minimal status updates.
- Agent prompts: brief and pointed — name the contract/goldens and constraints, don't
  restate file contents. Agents read the repo themselves.
- Prefer one agent with a complete brief over several overlapping ones. No speculative
  dispatches.
- Keep verification cheap: grep/gate summaries, not full-file reads.

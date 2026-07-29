# F1 — `useCountdown` SSR/Client Hydration Fix

Mission `cms-activation-deploy`, feature F1. Gate: `contracts/f1-countdown-hydration.yaml`,
3/3 assertions pass. Companion to [`docs/next16-upgrade.md`](./next16-upgrade.md), which fixed
the identical bug in `components/show/ShowCountdown.tsx` (M2) and explicitly tracked this one as
an open P1 for a later mission — this is that mission.

---

## The defect

`lib/hooks/useCountdown.ts` is a shared hook, `useCountdown(targetDate: Date): CountdownParts`,
consumed by `components/home/ShowBand.tsx` on the home page (`/`). Before the fix it used a
`useState` lazy initializer:

```ts
const [state] = useState(() => compute(targetDate));
```

`compute()` reads `Date.now()`. React's lazy initializer runs once during the *server* render
(embedding a real, non-zero countdown into the SSR HTML) and once again independently during the
*client's* first render at hydration. Those two `Date.now()` calls land in different wall-clock
moments, so whenever the two differ by a whole second — which any real network/asset latency
guarantees — the server-rendered markup and the client's first-render markup disagree. React
detects the mismatch, throws a hydration error, and discards and re-renders the entire subtree:
a visible flash of the countdown numerals on the home page.

**Why it survived since 2026-06-01 without being noticed:** on a local machine, `pnpm dev`
typically serves and hydrates within the same wall-clock second, so `Date.now()` returns an
identical value both times and the bug is invisible. It only reproduces once real latency (even
a few hundred ms of asset loading) pushes the two reads across a one-second boundary — which is
also why it wasn't caught by the Next 16 upgrade's regression pass (M2): that pass touched
`ShowCountdown.tsx` because a new lint rule forced a rewrite there, but `useCountdown.ts` was
untouched code and the bug doesn't show up without deliberately simulated latency.

Pre-existing since 2026-06-01/06-12 (last touched then); confirmed **not** introduced or
worsened by the Next 16 upgrade.

## The fix

Same pattern as `ShowCountdown.tsx`: `useSyncExternalStore` with a frozen, all-zeros
`getServerSnapshot`. The server and the client's first paint both render `getServerSnapshot()`'s
value, so there is nothing for them to disagree about — hydration always matches. Once mounted,
the client subscribes to a small external store that owns a `setInterval` and hands out ticking
snapshots, and React re-renders with the real value on the next tick after mount.

```ts
function getServerSnapshot(): CountdownParts {
  return ZERO; // { days: '00', hours: '00', minutes: '00', seconds: '00' }
}

export function useCountdown(targetDate: Date): CountdownParts {
  const targetMs = targetDate.getTime();
  const { subscribe, getSnapshot } = useMemo(() => createCountdownStore(targetMs), [targetMs]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

`suppressHydrationWarning` was deliberately not used anywhere — it would have hidden the visible
symptom while leaving the two independent `Date.now()` reads in place, which the contract's goal
statement forbids and A2 checks for directly.

### Two adaptations from the `ShowCountdown` reference

`ShowCountdown.tsx` is the reference implementation for the *pattern*, not the API shape —
`useCountdown` differs in two ways the fix had to preserve (mandated by the contract, A3/A4):

1. **Parameterised target, not a hardcoded constant.** `ShowCountdown` bakes its own
   `TARGET_MS` in as a module-level constant and owns one store per mounted instance
   (`useState(createCountdownStore)`). `useCountdown` is a shared hook that takes
   `targetDate: Date` as an argument, so the store has to be keyed on the target instead of
   created unconditionally once. It's built with `useMemo(() => createCountdownStore(targetMs), [targetMs])`,
   keyed on `targetDate.getTime()` (the numeric timestamp) rather than the `Date` object's
   identity — so a caller that passes a fresh `new Date(...)` on every render (same value, new
   object identity, which is exactly what `ShowBand.tsx` does) doesn't tear down and rebuild the
   interval on every render. Only an actual change in the target time creates a new store.

2. **Zero-padded 2-digit strings, not raw numbers.** `useCountdown`'s public return type,
   `CountdownParts`, is `{ days, hours, minutes, seconds }` as strings like `'05'`, not numbers.
   `ShowCountdown` returns raw numbers and pads them in JSX at the call site. Padding is done
   inside `useCountdown`'s own `compute()`/`pad()` so the hook's contract stays the same as
   before the fix and `ShowBand.tsx` needs no changes at all (verified by A3 below).

## Verification

The primary assertion (A1) is a *behavioural* Playwright check under a ~3-second `_next/**`
throttle, not a source diff — a static grep can't prove a hydration mismatch is gone. It ran
against the actual bug and the actual fix, not synthetic reproductions:

- **Negative-controlled twice**, independently, by two different agents:
  - Pre-fix, by @architect (2026-07-29), against the live dev server on port 3333 with no code
    changes: `node contracts/checks/f1-countdown-hydration/no-hydration-error-throttled.mjs`
    FAILed with a real hydration error pointing straight at `ShowBand.tsx`'s countdown numerals
    (`+ 11 - 14` in the diff frame), confirming this check can actually detect the bug and that
    the bug was genuinely present before any fix.
  - Post-fix, by @qa, via a stash-and-restore of the fix (re-running the same check against the
    unfixed code a second time, independently of @architect's run) — confirming the fixed code
    is what makes the check pass, not an environment quirk.
- **Post-fix, A1 passes**: zero page errors and zero hydration-mismatch console errors under
  the same 3s throttle.
- **Real ticking confirmed, not just a frozen snapshot**: @qa observed the countdown reach
  real non-zero values after mount — 415 days remaining, with the seconds field advancing
  01 → 59 across consecutive ticks — ruling out a fix that merely freezes on the all-zeros
  `getServerSnapshot` value forever (which would also produce zero hydration errors, but for
  the wrong reason: nothing ever changes).
- **Interval cleanup verified live**: @qa confirmed unmounting `ShowBand` tears down the
  `setInterval` with no orphaned timer left running.
- **A2** (secondary, source grep): neither `useCountdown.ts` nor `ShowBand.tsx` contains
  `suppressHydrationWarning`. Also negative-controlled — PASS on the unfixed baseline (bug
  present, no suppression hack), FAIL when the flag is injected into either touched file —
  confirming A2 checks the one thing it exists to check and doesn't overlap with A1.
- **A3**: `useCountdown`'s exported signature and `CountdownParts` shape are byte-identical to
  before the fix (grep-verified), and `ShowBand.tsx` is confirmed the *only* consumer
  (`grep -rl useCountdown --include='*.ts' --include='*.tsx' .`), so no consumer changes were
  needed or made.
- **A4**: source confirms the mandated `useSyncExternalStore` + `getServerSnapshot` pattern is
  actually used, not a workaround (e.g. a mount-flag `useEffect`) that happens to avoid the
  symptom without the prescribed mechanism.

Re-run the gate:

```bash
python3 execution/contract.py gate contracts/f1-countdown-hydration.yaml --phase 4 --run-checks
```

## Open trade-off — not a bug

@qa raised one non-blocking note during review, recorded here rather than buried: `useMemo` in
React carries a spec-level allowance for React to discard and recreate the memoized value (e.g.
under future concurrent-rendering behavior), whereas `ShowCountdown`'s `useState(createCountdownStore)`
never discards its store once created. @qa could not get React to actually discard the memo in
practice, and reasoned that even if it did, the `setInterval` is only created inside `subscribe()`
at commit time (not inside the memo callback itself) — so a discarded-and-recreated memo would be
inert, not leaking. This is a hypothesis, not an observed defect.

The counter-argument for keeping `useMemo`: `useState(() => createCountdownStore(targetMs))`
would **not** rebuild the store when `targetMs` changes on a later render — `useState`'s lazy
initializer only runs once, ever, per component instance. Since `useCountdown` is a shared hook
that must support a caller changing its target date across renders (unlike `ShowCountdown`,
which hardcodes one constant target for the app's lifetime), `useMemo` keyed on `[targetMs]` is
the form that actually satisfies `useCountdown`'s contract. Presented here as an open trade-off
for a future session to weigh, not a pending fix.

## Related

- [`docs/next16-upgrade.md`](./next16-upgrade.md) — the M2 upgrade that fixed the identical bug
  in `ShowCountdown.tsx` and is the reference implementation for the pattern used here; also the
  source of the "P1: home page hydration mismatch" backlog item this feature closes.
- `contracts/f1-countdown-hydration.yaml` — the contract, including its negative-control header
  comment recording the pre-fix baseline failure.

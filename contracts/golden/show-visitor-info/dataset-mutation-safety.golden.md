# Dataset mutation safety

> On 2026-08-11 a contract check left the string `SVI-PARKING-SENTINEL-1786481132420` in the
> published Sanity dataset, where it rendered as the parking information on
> `/national-show/plan-your-visit`. The check that did it reported a clean cleanup.

Any check in this contract that writes to Sanity follows this document. The implementation is
`contracts/checks/show-visitor-info/_mutation-guard.mjs`; this is the reasoning behind it.

---

## What actually happened

Two runs of `check-cms-round-trip` overlapped:

```
run A: capture baseline = real parking text
run A: write sentinel_A                       20:45:32
run B: capture baseline = sentinel_A          ← poisoned
run B: write sentinel_B
run A: restore real text
run B: restore "baseline" = sentinel_A        20:47:36  ← residue, on the live page
```

Run B's baseline validation was `typeof baseline === 'string' && baseline.trim() !== ''`. A
sentinel satisfies that happily. So run B restored garbage and printed
`Cleanup verified`. Run A's two-sided assertion saw run B's writes and failed — **that** was the
intermittent A42 red, misread as slowness. Re-running A42 alone made it pass, because nothing
else was writing.

The lesson generalises past this one check: **cleanup verified against your own captured baseline
is not cleanup verified.** You have to know the baseline was real.

---

## The three defences

Each is defeatable alone. Together they cover the realistic writers.

### 1. Poisoned-baseline rejection — `assertUsableBaseline()`

Every sentinel this contract writes matches `/SVI-[A-Z0-9-]*-SENTINEL-\d+/`. A captured baseline
matching that pattern is a **hard refusal to start**, exit code 2, treated as a live content
incident — never a value to restore. Restoring it is what made the residue permanent.

This is the only defence that works when the colliding writer is a human editing in Studio, and
the only one that detects damage already done. It is therefore first.

**A check that invents its own sentinel shape defeats this defence for every other check.** Use
`makeSentinel(tag)`.

### 2. An exclusive lock — `withDatasetLock()`

Atomic `open(path, 'wx')` in the OS temp dir, held across the whole mutate → verify → restore
window, released in a `finally`, with stale takeover after 20 minutes and a hard failure (never
a skip) if it cannot be acquired within 10.

Serialises every mutating check in this contract against every other one, **including a second
copy of itself** — the actual 2026-08-11 collision.

### 3. Revision-guarded restore — `restoreGuarded()`

The restore patches with `ifRevisionID` set to the revision our own sentinel write produced. Any
write in between makes the restore **throw** instead of silently overwriting the other writer.

A revision-guard failure is not a retry condition. It means someone else's change is in the
document, and blind-restoring would destroy it. The check emits a RESIDUE ALERT with the baseline
printed for hand reconciliation.

---

## Separate targets

Two checks in this contract mutate `showVisitorInfo`. They must not share a field, so that a
lock bypass cannot make them fight over one value:

| Check | Document | Field | Why safe |
|---|---|---|---|
| `check-cms-round-trip` | `showVisitorInfo` | `parking` | rendered on one page, read by nothing else |
| `check-seed-idempotent` | `showVisitorInfo` | `cloakroom` | rendered on one page, read by nothing else |
| `check-marker-fail-closed` | `showVisitorInfo` | `pendingLabel` | the field under test |
| `check-show-identity-sweep` | `nationalShow` | `venue`, dates, `edition`, `hostRegion`, `countdownDate` | the fields under test |

`check-seed-idempotent` used to write `parking` — the same field as `check-cms-round-trip`. Two
assertions in one contract could collide with each other.

`check-show-identity-sweep` deliberately **does not** touch `nationalShow.location`. Leaving the
legacy field holding the old venue is the entire test: any surface that prefers it over
`venue.name` renders the stale value and is caught.

---

## Timeouts

Propagation is bounded by the **Sanity CDN**, not by `/api/revalidate`. `sanity/lib/fetch.ts`
sets `useCdn: true`, so `revalidateTag` purges the Next cache and the refetch then reads a CDN
copy that can still be stale. Measured across three mutations under load: **64 s, 72 s, ~96 s**.

`POLL_TIMEOUT_MS = 240_000` in every mutating check. 180 s was ~2× the worst observed, which is
not headroom.

> **Backlog, not this round.** Setting `useCdn: false` in `sanity/lib/fetch.ts` would make
> `revalidateTag` actually decisive and cut editor-visible latency from ~90 s to near zero. It
> also changes the read path for every page on the site and raises Sanity API request volume, so
> it is a deliberate architectural decision with its own measurement, not a side effect of a QA
> fix. Filed for a follow-up mission.

### CORRECTION 2026-08-12 — the ~90 s is mostly ISR, not the CDN

The attribution above is wrong, and it matters because it points the backlog item at the wrong
knob. @dev measured **Sanity CDN propagation itself at under 7 s**, and observed that after
`/api/revalidate` the first fetch of a surface serves one stale copy and every fetch after that is
correct — watched for 153 s without regressing.

Two independent observations here agree with the *duration* but not the cause: the permanent title
edit sat behind 12 consecutive stale reads over ~60 s before flipping, and A61's propagation gate
took 62 s (13 polls). Both land on ~60 s, which is `export const revalidate = 60`, not a CDN
number.

The reconciled model, which fits every measurement on both sides:

**remaining ISR window (0–60 s) + one stale read + CDN (<7 s).**

Next serves its cached copy until the route's 60 s window expires; the first request after that
still serves stale while regenerating in the background; the next one is correct and stays
correct. @dev's "one stale read" observation is that model sampled *after* the window had already
elapsed. The 64/72/96 s figures were measuring the window, not the CDN.

**Consequence for the backlog item:** `useCdn: false` would remove under 7 s of the ~90 s and is
therefore NOT the fix it was filed as. Lowering `revalidate`, or making `/api/revalidate` purge
the route so the window is cut short, is where the latency actually lives. Do not spend the
architectural change on the wrong 7 %.

**Consequence for the checks:** none. Poll-until-fresh is agnostic to which layer is stale, which
is the reason to prefer it over any fixed sleep tuned to a number in this document.

---

## Non-negotiables for any new mutating check

- Capture the baseline **before** any write, and pass it through `assertUsableBaseline()`.
- Wrap the whole window in `withDatasetLock()`.
- Restore in a `finally`. **Never call `process.exit()` inside the `try`** — it does not unwind
  the stack, so the `finally` never runs. This project has had that incident too.
- Restore through `restoreGuarded()`, then verify in the dataset **and** on the rendered page.
- Emit `residueAlert()` (exit 2) if either verification fails. Exit 2 means "a live content
  incident", distinct from exit 1 "the feature is not wired yet".

---

## Defence 4 — the check must be allowed to finish (added 2026-08-12)

The three defences above all assume the check's own code gets to run to the end. On 2026-08-11
that assumption was false, and it is the *root* cause of every dataset incident on this stream.

`execution/contract.py` runs each assertion through `subprocess.run(..., timeout=…)` and the
timeout defaults to **60 seconds** (`execution/contract.py:254`, `:550`, `:559`) unless the
assertion declares `timeout_seconds`. **This contract declared none.** Every mutating check here
needs minutes — the CDN propagation window alone is ~60–96 s — so the gate SIGKILLed them, on
every run, *after* the sentinel write and *before* the restore. That is not a flake that
occasionally leaves residue; it is a mechanism that reliably leaves residue and reports a timeout
failure indistinguishable from a real one. The sibling exhibitor stream has the identical hole in
its A36.

The `finally` that restores the dataset and releases the lock cannot save you here: a killed
process does not unwind. Hence:

**Every assertion whose command mutates the dataset, or polls for propagation, or drives a
browser, MUST declare `timeout_seconds` with real headroom over its measured worst case.** Guessing
is how you get 60. Measure, then leave room for a cold Next.js route compile, for CDN weather, and
for the lock wait if another check is already running. A timeout is a ceiling, not a budget: an
over-generous one costs nothing on a passing run.

### Measured 2026-08-12, every node assertion in this contract

| Assertion | Check | Measured | Declared | Why |
|---|---|---|---|---|
| A61 | `check-show-identity-sweep` | 184 s bare, **246 s / 248 s through `contract.py`** | **900** | Mutates the whole show identity, polls the CDN twice, settles seven surfaces, drives Playwright. Worst case ~400 s + lock wait. |
| A42 | `check-cms-round-trip` | 161 s | **600** | Mutates + polls the CDN, then a polled cleanup verification. |
| A60 | `check-marker-fail-closed` | 82 s bare, **165 s through `contract.py`** | **420** | Mutates + polls. |
| A24 | `check-seed-idempotent` | 13 s | **300** | Short, but it mutates — a mutating check must never be killed mid-window. |
| A39–A47, A56 | read-only HTTP / Playwright | 1–3 s warm | **180** | Warm numbers are not the worst case: a cold Next dev-server route compile dominates and can take tens of seconds per route. |

The three at the top **all exceed the 60 s default**, which is why they were being killed on every
gate run rather than occasionally. Note also that the same check measures 184 s run bare and 246 s
run through `contract.py` under load — a ceiling set at "measured × 1.5" would still have been too
tight. These are set at roughly 3–4× observed.

Every mutating ceiling includes room for `LOCK_WAIT_TIMEOUT_MS` (240 s), which is deliberately
bounded **below** every assertion's ceiling: if the lock wait could outlast the ceiling, a check
would be SIGKILLed while merely queuing, producing a false RED indistinguishable from a real one.

### The lock leak this produced, and its two halves

The lock is released in a `finally`, so a SIGKILLed check leaves it behind forever, holding a pid
that no longer exists. Every later run then waited the full 20-minute stale window — or failed.
Two stale locks were found tonight. `_mutation-guard.mjs` now closes both halves:

| Death | Catchable? | Defence |
|---|---|---|
| `SIGTERM` / `SIGINT` / `SIGHUP` (Ctrl-C, orderly kill) | yes | Handler releases the lock, then re-raises the signal so the exit status still reads "killed by signal" instead of laundering into a clean exit. |
| `SIGKILL` (the gate's timeout kill, `kill -9`) | **never** | Acquire-side reaping: a lock whose recorded pid is not alive (`process.kill(pid, 0)`) is taken over immediately instead of after 20 minutes. |

Releases are **token-guarded**: each acquisition stamps a unique token into the lock file and a
release only removes a lock still carrying that token. Without it, a process whose lock was
legitimately reaped would delete its successor's lock on the way out — handing the dataset to two
writers at once, which is the exact failure the lock exists to prevent.

An unreadable lock file (the microsecond between `openSync(…, 'wx')` and its `writeFileSync`) is
given a grace period rather than deleted on sight, for the same reason.

**What this does NOT fix:** a SIGKILLed check still cannot restore the dataset it mutated. Only
the timeout headroom prevents that, which is why defence 4 is a defence and not a nicety.

---

## Defence 5 — readers settle, and readers take the lock (added 2026-08-12)

Three consecutive gate runs each produced exactly ONE red, and a different one each time: A56,
then A41, then A39. Every one passed standalone. @dev traced the pattern: the rendered checks read
their needles from the dataset and then fetched the page **once**, so they were racing whatever
had just written. Two distinct causes hid behind that one symptom, and they need different fixes.

**Cause 1 — the page lags the dataset.** The dataset is authoritative the instant it commits; the
page serves its ISR copy until `revalidate = 60` expires, then serves one more stale copy while
regenerating. Fix: `settlePage()` in `_shared.mjs`. Poll until the page agrees with the dataset,
then assert on **that** response.

Two refinements that were not obvious and cost a debugging cycle each:

- **Poll on ALL the needles, not one.** The first version settled `/plan-your-visit` on
  `planIntro` while a concurrent round-trip check held a sentinel in `parking`. The page was fresh
  with respect to the needle polled and stale with respect to the value then asserted.
- **Re-read the needles every attempt, and rebind the caller's snapshot.** A fixed array is a
  snapshot taken before the loop, and a snapshot cannot converge against a live writer — the page
  moves toward the *current* dataset, not the one captured a minute ago. `settlePage()` therefore
  accepts a function, and each check's callback reassigns its own `info`/`show`/`venue` so the
  assertions afterwards use exactly what the loop settled on.

**Cause 2 — the dataset itself is deliberately invalid.** `check-show-identity-sweep` UNSETS
`countdownDate` for minutes at a time; that is the point of the S6 test. A reader that observes
the dataset in that window sees a state that is genuinely wrong, and **no amount of polling
converges on it** — A56 correctly reported "countdownDate is populated: FAIL" while the sweep had
it unset. Polling cannot fix this. Fix: the read-only checks take the same lock the mutators do,
with a shorter 240 s wait since a reader is cheap to retry.

So: `settlePage()` handles lag, the read lock handles invalidity, and neither substitutes for the
other.

**Cost, stated honestly.** Read-only checks now serialise against mutating ones. Inside a single
gate run this changes nothing — `contract.py` already runs assertions one at a time. It only bites
when two gate runs overlap, which is exactly the situation that was producing the false reds, and
a bounded wait is the right price for a trustworthy result. Every reader's `timeout_seconds` was
raised to cover the 240 s wait plus its runtime; see the invariant at `LOCK_WAIT_TIMEOUT_MS`.

**Rule for any new rendered check in this contract:** if a needle comes from the dataset, fetch
through `settlePage()` with a callback, and take the read lock. A bare `fetchOkPage()` in a
dataset-sourced check is the defect above, waiting to be rediscovered.

---

## Defence 6 — a blocked check is not a failed check (added 2026-08-12)

A check that could not acquire the lock has tested **nothing**. It did not reach an assertion. It
is not evidence for or against the code. Reporting it as an ordinary `FAIL` is worse than useless:
it is indistinguishable from a regression, and on 2026-08-12 it sent the team lead diagnosing a
non-problem after their gate run collided with another agent's in-flight check.

`contract.py` records only pass/fail, so the status channel available is the **exit code plus a
banner** — the same convention exit 2 already uses for residue:

| Exit | Meaning | What to do |
|---|---|---|
| 0 | passed | nothing |
| 1 | a real failure | look at the code |
| 2 | **RESIDUE ALERT** — check data may be rendering on the live site | treat as an incident, not a test result |
| 3 | **BLOCKED** — never ran, another check held the lock | re-run it; do **not** diagnose it |

Two implementation details that matter:

- The banner is printed **first, to both stdout and stderr**, because `contract.py` keeps only the
  first 500 characters of output as evidence. The lock-wait log was made sparse (every ~30s
  instead of every 3s) for the same reason — 140 lines of "waiting…" would have pushed the banner
  out of the evidence window.
- `PoisonedBaselineError` now exits **2**, not 1. This document had specified exit 2 for a poisoned
  baseline since it was written, but `runCheck` caught every error identically and exited 1 — so a
  live content incident was being filed as an ordinary red. Fixed in the same change.

**This does not make a blocked run acceptable**, it makes it legible. The fix for blocking is
still not to run two gates at once.

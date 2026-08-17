# Decoy fixture spec — `contracts/checks/payfast-m1/_fixtures/decoy-lock-holder.mjs`

Purpose: give F2 and F4's checks a safe, deliberate way to reproduce "process
killed after writing a fixture, before cleanup runs" without ever doing that
to a real suite script. This file is a fixture, not a production check — it
must never be listed in `contract-payfast-m1.yaml`'s own assertion commands
as anything other than a child process spawned BY another check's script.

Behaviour, in order, when run standalone (`pnpm exec tsx
contracts/checks/payfast-m1/_fixtures/decoy-lock-holder.mjs`):

1. Import `sentinelEmail`, `createTicketDoc`, `recordFixtureCreated` from
   `../../ticketing-hardening/_shared.mjs`.
2. Generate a doc ref, call `recordFixtureCreated('tickets', ref.id)`
   synchronously.
3. Write the ticket via `createTicketDoc` with a sentinel email (reuse
   `sentinelEmail('decoy-lock-holder-<runId>')` — must still carry the real
   sentinel domain so it is caught by any sentinel-based cleanup as a second
   line of defense if the kill test's own recovery step is somehow skipped).
4. Log a single line to stdout confirming the write completed (the parent
   process's harness waits for this line before sending SIGKILL, so the kill
   always lands after step 3, never racing it).
5. Sleep for a long fixed duration (e.g. 60s) — the parent kills it well
   before this returns; this script must never legitimately reach its own
   exit under normal test execution.

Never calls `withCleanup()`, `sweepSentinels()`, or `acquireSuiteLock()` —
the whole point is that it behaves like a process that got killed before any
of those had a chance to run. Its only cleanup responsibility is participating
correctly in `recordFixtureCreated()` so the manifest-based preflight sweep
(F2) can find and remove what it left behind.

Rename this fixture if its current name ends up misleading an implementation
decision (see README, "fixtures must not shape production behaviour") — the
name describes what it does (holds a lock-adjacent ticket write, then acts
like a killed process), not a specific test scenario, so it should not need
narrowing.

# Route runner harness

Runs this project's **real** Next.js App Router route handlers in-process, with only
infrastructure (admin session, Firestore, mailer, cookie jar) replaced by fixtures — so a
contract check can assert what a route *does*, not merely what its source *looks like*.

## How to invoke a check: `npx tsx`, never `node --import tsx/esm`

On this project's Node/tsx combination (Node v26.4.0, tsx 4.23.12), `node --import tsx/esm
<check>.mjs` fails to resolve the `@/*` tsconfig path alias whenever the import is nested more
than one level deep — a check imports a lib file which itself imports `@/lib/...`. It dies with
`Cannot find module '@/lib/...'`, and that failure reports as a FAILING check, not a check that
could not load, which reads as "this code is broken" when the real story is "this check never
ran." Running the identical file with `npx tsx <check>.mjs` instead resolves correctly.

This was patched ad hoc, per assertion, three separate times on one mission (`A21`, `A50`, and
a batch of individually-discovered cases) before anyone audited it systematically. The 2026-09-01
architect pass found 36 assertions across the repo still on the broken invocation and fixed them
in a single sweep — see `.agent/memory/project/specs/token-canonicality` era session notes /
`learned.md` for the full audit (8 of the 36 had never actually been executing; none had gone
PASS -> FAIL under the broken invocation, i.e. no real defect was hiding behind it).

**The rule, going forward: every new `command:` in a contract that runs a `.mjs` check invokes
it as `npx tsx <path>`, never `node --import tsx/esm <path>`.** There is no case where the
latter is required — `npx tsx` resolves everything the former does, plus nested `@/` imports.
Do not add a new `node --import tsx/esm` invocation, and if you touch an existing one for any
other reason, switch it while you're there.

This project deliberately did not centralize this into a wrapper script (e.g. a
`contracts/harness/run-check.sh`) — `contract.py`'s shell executor still needs a literally
runnable string either way, so a wrapper would add indirection without removing the failure
mode, and that kind of repo-convention change deserves its own decision rather than riding
along inside a bug fix. This README section is the convention until that decision is made.

## Why this exists

Several checks in `contracts/checks/vendor-gated-registration-flow*/` state, as a limitation,
that "exercising the real route needs a Firebase Admin credential and an authenticated admin
session cookie, neither available in this environment", and fall back to source-order
assertions instead. That fallback has a cost: on 2026-09-01, `A50`
(`check-approval-mints-code-atomically.mjs`) **passed** against a route carrying the exact
dead-end defect A50 was written to supersede A20 in order to catch. A source-order assertion
can only prove the shape it was written to look for; it cannot notice a precondition that moved
somewhere else.

The routes are runnable here. The premise was wrong, not the environment.

## The insight: tsx transpiles to CJS, so an ESM resolve hook never fires

The obvious approach — `module.register()` with a `resolve` hook redirecting `@/lib/admin-auth`
and friends to fixtures — **silently does nothing**. Under `tsx`, the route `.ts` files are
transpiled to CommonJS, so their imports go through `require()` and never reach the ESM resolve
hook chain. The hook registers, the deprecation warning fires, and not one specifier is ever
offered to it. (Running `node --import tsx/esm` instead surfaces the same fact as a hard error:
`Cannot find module '@/lib/admin-auth'`, thrown from `cjs/loader`.)

The working interception point is `Module._load` (see `preload.cjs`), loaded via
`NODE_OPTIONS="--require .../preload.cjs"` so it is installed before any route module resolves.

One consequence worth knowing: a harness script must load the fixtures through
`createRequire(import.meta.url)`, **not** a plain ESM `import`. An ESM import of the same file
produces a second, separate module instance under tsx's loader, and the harness then reads an
empty store while the route writes to another one.

## Files

| File | Role |
|---|---|
| `preload.cjs` | `Module._load` interceptor. Maps import specifiers to the fixtures below. |
| `store.mjs` | In-memory `vendorApplications` map, `FakeTimestamp`, the `FieldValue.increment` sentinel. Shared by every fixture. |
| `fixture-firestore.mjs` | `getFirestore` / `Timestamp` / `FieldValue`. Supports `.doc().get()/.update()`, `.where().where().get()`, and `runTransaction`. |
| `fixture-admin-auth.mjs` | `getAdminSession` / `hasCapability` — always an authorised reviewer. |
| `fixture-firebase-admin.mjs` | `initAdmin` no-op. |
| `fixture-show-window-lookup.mjs` | `resolveShowWindowLookup` no-op. |
| `fixture-approval-email.mjs` | Captures what `sendVendorApprovalConfirmationEmail` would have sent, into `sentEmails`. |
| `fixture-next-headers.mjs` | `cookies()` over an in-memory jar (`cookieJar`). |
| `demo-vendor-approval-preconditions.mjs` | The M4 redemption-precondition scenarios. See below. |

To cover a new route, add its infrastructure imports to `OVERRIDES` in `preload.cjs`. The
fixtures are deliberately minimal — extend them to the surface a route actually touches, and no
further.

## Running it

```sh
NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
  npx tsx contracts/harness/route-runner/demo-vendor-approval-preconditions.mjs
```

`LOADER_DEBUG=1` additionally prints each intercepted specifier — use it to confirm an override
is actually taking effect rather than assuming it is.

## `demo-vendor-approval-preconditions.mjs`

Six scenarios across the review, reissue-code and verify-code routes, proving that neither
approval nor reissue commits unless the vendor can actually redeem the resulting code:

- **A** — approve with `VENDOR_REGISTRATION_TOKEN_SECRET` unset → 503, application still `pending`, no code, no email.
- **B** — approve a business name normalising to an empty slug → 409, still `pending`.
- **C** — approve normally → 200, and the code from the *emailed* payload verifies at `POST /api/vendors/register/verify-code` → 200 with the session cookie set.
- **D** — reissue with the secret unset → 503, the application's existing code, lockout and generation untouched.
- **E** — reissue a business name normalising to an empty slug → 409, likewise untouched.
- **F** — reissue normally → 200 with a fresh code, lockout cleared, generation bumped; the new code verifies and the superseded code is refused.

**This is not wired into the contract.** Promoting these scenarios into assertions is
@architect's call.

## Importing a default-exported `.tsx` (e.g. an email component) from a check

On this project's Node/tsx combination (Node v26.4.0, tsx 4.23.12), a plain ESM
`import Component from './SomeComponent.tsx'` — under **either** `node --import tsx/esm` or
`npx tsx` — yields a double-wrapped `{ default: [Getter] }` instead of the component itself,
because tsx transpiles `.tsx` to CommonJS and the ESM import machinery re-wraps that module's
own `.default` a second time. A React render check that does `render(<Component />)` against
that value throws `Element type is invalid`. This is the same CJS-under-ESM mismatch documented
above for `preload.cjs` fixtures, just hitting a different import site — switching between
`node --import tsx/esm` and `npx tsx` does **not** fix it; both wrap identically.

**Convention: use `createRequire`, not a plain `import`, for any default-exported `.tsx`.**

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Component = require('../../../emails/VendorRegistrationConfirmation.tsx').default;
```

`require()` goes through tsx's CJS transform once, with no second ESM re-wrap, so
`mod.default` is the real component — no unwrap gymnastics needed. This is the same
`createRequire(import.meta.url)` pattern the route-runner fixtures already use (see "One
consequence worth knowing" above) — one mechanism, two call sites. Do not use the
`mod.default?.default ?? mod.default` fallback chain in new checks; it works but hides the
actual cause and has to be re-derived by whoever reads it next.

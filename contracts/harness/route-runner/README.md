# Route runner harness

Runs this project's **real** Next.js App Router route handlers in-process, with only
infrastructure (admin session, Firestore, mailer, cookie jar) replaced by fixtures — so a
contract check can assert what a route *does*, not merely what its source *looks like*.

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

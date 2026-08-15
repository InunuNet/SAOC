# Golden spec — `scripts/admin-grant.ts` squatter-shape warning (F4)

Extends F3's `scripts/admin-grant.ts` (`contracts/golden/admin-auth-f3-provisioning/
provisioning-scripts.golden.md` — read that first; this document only specifies the delta).

## Why this exists

F3's existing-account branch already refuses without `--existing` and prints provenance (uid,
`creationTime`, `providerData`, `emailVerified`). That is necessary but not sufficient: it treats
"a self-registered squatter with no federated provider, never verified" the same as any other
pre-existing account, requiring the operator to read `providerData: (none)` /
`emailVerified: false` and independently conclude what that means. This spec makes the script
say what that shape means, in the moment the operator is deciding, rather than relying on them
to draw the inference themselves.

## Required behaviour

On the existing-account, no-`--existing` refusal path (unchanged trigger condition from F3):

1. Continue printing the existing provenance block unchanged (uid, `creationTime`,
   `providerData`, `emailVerified`).
2. **When `providerData` contains no provider other than `'password'` AND `emailVerified` is
   `false`** — the shape a self-registered squatter necessarily has, since federated providers
   set `emailVerified: true` automatically and this project has no other provider that leaves it
   false — print an additional, clearly-marked warning naming this shape explicitly (e.g. a line
   containing the words "password" and "only" and "never verified" or equivalent — the check
   greps for this class of phrase, not one exact string) and instructing the operator to check
   whether the intended person has already signed in via a federated provider elsewhere (which
   would show up as an additional `providerData` entry) before deciding whether `--existing` is
   safe.
3. **When `providerData` contains any provider other than `'password'`** (i.e. some identity
   provider has already asserted control of this address), the additional warning does NOT
   print — this shape is not the dangerous one this spec targets, and printing the same warning
   regardless of shape would make it noise the operator learns to ignore.
4. The `--existing` grant path itself is UNCHANGED from F3 — still never sets `emailVerified`,
   still sets the claim. This spec only changes what is printed on the REFUSAL path, to make the
   human decision that follows better-informed; it does not change what the script does after
   that decision is made.

## What must NOT happen

- The new warning must not appear on the fresh-account-creation path (no pre-existing account at
  all) — there is nothing to warn about there.
- The new warning must not appear when the pre-existing account already has emailVerified:true
  regardless of provider shape — an already-verified account (however that happened) is not the
  "never verified by anyone" shape this spec is about; the existing "never sets emailVerified
  true on an account this script did not create" rule already governs that case unchanged.

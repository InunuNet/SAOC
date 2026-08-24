# Golden: `scripts/fix-vip-and-weekend-pass-pricing.ts`

Full rationale: `README.md` §6. Follows `scripts/fix-visitor-info-dates-confirmed.ts` byte-for-byte
in structure: same `.env.local` reader, same `@sanity/client` setup, same `--dry-run`/`--verify`
argv flags, same PASS/FAIL verify-report shape, same idempotent `.set()` calls.

## Required shape

```ts
import { EARLY_BIRD_CUTOFF } from '@/lib/provisional-figures';
// ... same readEnvLocal()/createClient() boilerplate as fix-visitor-info-dates-confirmed.ts

const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');

const VIP_ID = 'ticketType-vip';
const WEEKEND_PASS_ID = 'ticketType-weekend-pass';
const EARLY_BIRD_WEEKEND_PASS_ID = 'ticketType-early-bird-weekend-pass';

const VIP_PRICE = 480;
const WEEKEND_PASS_EARLY_BIRD_PRICE = 380;
const WEEKEND_PASS_REGULAR_PRICE = 400;
```

`runPatch()` performs exactly these three writes (order does not matter, but all three run in
one invocation — this is one release, not three staged patches):

```ts
await client.patch(VIP_ID).set({ price: VIP_PRICE }).commit({ autoGenerateArrayKeys: false });

await client
  .patch(WEEKEND_PASS_ID)
  .set({
    price: WEEKEND_PASS_EARLY_BIRD_PRICE,
    regularPrice: WEEKEND_PASS_REGULAR_PRICE,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
  })
  .unset(['releasedQuantity'])
  .commit({ autoGenerateArrayKeys: false });

await client
  .patch(EARLY_BIRD_WEEKEND_PASS_ID)
  .set({ active: false })
  .commit({ autoGenerateArrayKeys: false });
```

`runVerify()` re-fetches all three documents and asserts, printing PASS/FAIL per field
(same reporting shape as `fix-visitor-info-dates-confirmed.ts`'s `runVerify()`):

- `ticketType-vip`: `price === 480`
- `ticketType-weekend-pass`: `price === 380`, `regularPrice === 400`,
  `earlyBirdCutoff === EARLY_BIRD_CUTOFF` (or a Date-equivalent ISO value),
  `releasedQuantity` is `undefined`/absent
- `ticketType-early-bird-weekend-pass`: `active === false`

`--verify` exits non-zero (`process.exit(1)`) if any field fails, matching the existing script's
convention. `--dry-run` prints the would-be writes and performs none.

## Explicitly out of scope for this script

- Does not touch `ticketType-early-bird` (Exhibition) — see README §3, no change intended.
- Does not touch `ticketType-day-visitor` — unaffected by this feature.
- Does not delete any document — `.unset()` on a single field only, never `client.delete()`.

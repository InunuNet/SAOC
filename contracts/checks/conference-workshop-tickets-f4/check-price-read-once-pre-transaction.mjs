// F4 (conference-workshop-tickets, M2) — A10: for vip/weekend-pass/weekend-pass-
// early-bird/day-visitor/early-bird, the charged amount is the SAME value that gated
// transaction entry — no second, independent price computation exists for these five
// slugs. Proven two ways: (1) STRUCTURAL — resolveEffectivePrice( is called exactly
// ONCE in the checkout route (no second, independently-added price formula sits
// alongside it for these slugs); (2) FUNCTIONAL — calling the real, unmodified
// resolveEffectivePrice() (lib/checkout-reservation.ts) with each of these five
// products' post-F2 regularPrice/earlyBirdCutoff (both null) returns `price` unchanged
// regardless of `now` — proving there is no live, time-sensitive branch left for any of
// them to diverge through.
import { loadRepoModule, finish } from './_lib.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTE_REL_PATH = 'app/api/tickets/checkout/route.ts';

const failures = [];

let source;
try {
  source = readFileSync(path.join(__dirname, '../../../', ROUTE_REL_PATH), 'utf8');
} catch (error) {
  finish('check-price-read-once-pre-transaction.mjs', [`could not read ${ROUTE_REL_PATH}: ${error.message}`]);
}

// Strip `//`-style line comments first — a comment that merely MENTIONS the call (e.g.
// "See lib/checkout-reservation.ts's resolveEffectivePrice().") must not count as a
// second call site.
const sourceNoComments = source
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');
const callCount = (sourceNoComments.match(/resolveEffectivePrice\s*\(/g) ?? []).length;
if (callCount !== 1) {
  failures.push(
    `resolveEffectivePrice( appears ${callCount} time(s) in ${ROUTE_REL_PATH}, expected exactly 1 — a second call site would be a second, independent price computation`,
  );
}

const { ADMISSION_PRODUCTS, resolveEffectivePrice } = { ...(await loadRepoModule('lib/provisional-figures.ts')), ...(await loadRepoModule('lib/checkout-reservation.ts')) };

const SLUGS = ['vip', 'weekend-pass', 'weekend-pass-early-bird', 'day-visitor', 'early-bird'];
const PAST_NOW = new Date('2020-01-01T00:00:00Z');
const FUTURE_NOW = new Date('2030-01-01T00:00:00Z');

for (const slug of SLUGS) {
  const product = ADMISSION_PRODUCTS.find((p) => p.slug === slug);
  if (!product) {
    failures.push(`no '${slug}' product in ADMISSION_PRODUCTS`);
    continue;
  }
  if (product.regularPrice !== undefined && product.regularPrice !== null) {
    failures.push(`'${slug}': regularPrice is ${JSON.stringify(product.regularPrice)}, expected null/unset post-F2 (no per-slug date tier left)`);
    continue;
  }
  if (product.earlyBirdCutoff !== null) {
    failures.push(`'${slug}': earlyBirdCutoff is ${JSON.stringify(product.earlyBirdCutoff)}, expected null post-F2`);
    continue;
  }
  for (const now of [PAST_NOW, FUTURE_NOW]) {
    const effective = resolveEffectivePrice({
      price: product.price,
      regularPrice: product.regularPrice ?? null,
      earlyBirdCutoff: product.earlyBirdCutoff,
      now,
    });
    if (effective !== product.price) {
      failures.push(
        `'${slug}': resolveEffectivePrice() at now=${now.toISOString()} returned ${JSON.stringify(effective)}, expected the unconditional price ${JSON.stringify(product.price)}`,
      );
    }
  }
}

finish(
  'check-price-read-once-pre-transaction.mjs',
  failures,
  'resolveEffectivePrice() is called exactly once in route.ts and is a pass-through (price unchanged, any `now`) for all five slugs post-F2.',
);

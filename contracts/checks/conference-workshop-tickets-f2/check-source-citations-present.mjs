// F2 (conference-workshop-tickets, M1) — A10: every updated/new ADMISSION_PRODUCTS entry
// carries a non-null sourceCitation — vip, weekend-pass, weekend-pass-early-bird,
// day-visitor, early-bird. Provenance loss on these five would repeat the exact defect
// class ticketing-complete's F2 (sourceCitation itself) was introduced to close.
import { loadRepoModule, finish } from './_lib.mjs';

const { ADMISSION_PRODUCTS } = await loadRepoModule('lib/provisional-figures.ts');

const SLUGS = ['vip', 'weekend-pass', 'weekend-pass-early-bird', 'day-visitor', 'early-bird'];
const failures = [];

for (const slug of SLUGS) {
  const product = ADMISSION_PRODUCTS.find((p) => p.slug === slug);
  if (!product) {
    failures.push(`'${slug}': no such product in ADMISSION_PRODUCTS`);
    continue;
  }
  if (typeof product.sourceCitation !== 'string' || product.sourceCitation.length === 0) {
    failures.push(`'${slug}': sourceCitation is ${JSON.stringify(product.sourceCitation)}, expected a non-empty string`);
  }
}

finish(
  'check-source-citations-present.mjs',
  failures,
  'vip/weekend-pass/weekend-pass-early-bird/day-visitor/early-bird all carry a non-null sourceCitation.',
);

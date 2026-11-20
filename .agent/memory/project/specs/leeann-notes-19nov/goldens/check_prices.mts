// Compares lib/provisional-figures.ts with prices.golden.json. Run: tsx check_prices.mts (cwd = repo root, or CHECK_ROOT).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.CHECK_ROOT ?? process.cwd();
const golden = JSON.parse(readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'prices.golden.json'), 'utf8'));
const fig = await import(pathToFileURL(path.join(root, 'lib/provisional-figures.ts')).href);
const all = [...fig.ADMISSION_PRODUCTS, ...fig.CONFERENCE_PRODUCTS, ...fig.WORKSHOP_FIELD_TRIP_PRODUCTS];
const bad: string[] = [];
for (const [slug, want] of Object.entries<{ price: number; regularPrice: number | null; earlyBirdCutoff: boolean }>(golden.active)) {
  const p = all.find((x) => x.slug === slug);
  if (!p) { bad.push(`${slug}: missing`); continue; }
  if (p.price !== want.price) bad.push(`${slug}: price ${p.price} != ${want.price}`);
  if ((p.regularPrice ?? null) !== want.regularPrice) bad.push(`${slug}: regularPrice ${p.regularPrice} != ${want.regularPrice}`);
  const cutoff = p.earlyBirdCutoff ?? null;
  if (want.earlyBirdCutoff ? cutoff !== golden.earlyBirdCutoff : cutoff !== null) bad.push(`${slug}: earlyBirdCutoff ${cutoff}`);
}
if (all.some((p) => p.slug === 'weekend-pass-early-bird')) bad.push('weekend-pass-early-bird still in products');
if (fig.SPEAKERS_PARTNER_PRODUCT?.price !== golden.hidden['speakers-partner'].price) bad.push('speakers-partner price');
if (fig.WORKSHOP_SESSION_PRICE !== golden.workshopSessionPrice) bad.push('workshop session price');
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log('prices match golden');

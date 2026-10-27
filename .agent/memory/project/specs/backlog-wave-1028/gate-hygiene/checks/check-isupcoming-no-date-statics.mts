// gate-hygiene item 2: lib/sast-date.ts isUpcoming() must not call Date statics (Date.parse / Date.UTC / Date.now), because Next's
// prerender can replace the global Date with a wrapper that drops statics (Codex, PR #129). Two proofs:
//   S1 static: the comment-stripped body of isUpcoming has no `Date.<static>` call.
//   R1 runtime: with globalThis.Date replaced by a statics-less constructor, every row of goldens/sast-isupcoming-table.json still
//      returns its expected value (and does not throw).
//   R2 runtime: same table with the real Date (the behaviour is unchanged by the fix).
// Run as: pnpm exec tsx <this file> (from the checkout under test)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SPEC = '.agent/memory/project/specs/backlog-wave-1028/gate-hygiene/goldens/sast-isupcoming-table.json';
const failures: string[] = [];
const table = JSON.parse(readFileSync(SPEC, 'utf8')) as { rows: { id: string; now: string; event: { date: string; endDate?: string | null }; want: boolean }[] };

const src = readFileSync('lib/sast-date.ts', 'utf8');
const start = src.indexOf('export function isUpcoming');
const end = src.indexOf('\n}', start);
if (start < 0 || end < 0) failures.push('S1: could not locate isUpcoming in lib/sast-date.ts');
const body = src.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const hit = body.match(/\bDate\s*\.\s*[A-Za-z_]+/g);
if (hit) failures.push(`S1: isUpcoming calls Date statics: ${hit.join(', ')}`);

const { isUpcoming } = (await import(pathToFileURL(path.resolve('lib/sast-date.ts')).href)) as { isUpcoming: (e: { date: string; endDate?: string | null }, now: Date) => boolean };
const RealDate = Date;
const nows = new Map(table.rows.map((r) => [r.id, new RealDate(r.now)]));

const runTable = (label: string) => {
  for (const r of table.rows) {
    try {
      const got = isUpcoming(r.event, nows.get(r.id) as Date);
      if (got !== r.want) failures.push(`${label} ${r.id}: got ${got}, want ${r.want}`);
    } catch (error) {
      failures.push(`${label} ${r.id}: threw ${(error as Error).message}`);
    }
  }
};
runTable('R2 real-Date');

// A constructor that works as `new Date(...)` but carries no statics (no parse, UTC, now).
function StaticlessDate(this: unknown, ...args: unknown[]) {
  return new (RealDate as unknown as new (...a: unknown[]) => Date)(...args);
}
StaticlessDate.prototype = RealDate.prototype;
globalThis.Date = StaticlessDate as unknown as DateConstructor;
try {
  runTable('R1 statics-less-Date');
} finally {
  globalThis.Date = RealDate;
}

if (failures.length) { console.error('FAIL\n' + failures.join('\n')); process.exit(1); }
console.log(`PASS: isUpcoming is static-free and matches ${table.rows.length} table rows under real and statics-less Date`);

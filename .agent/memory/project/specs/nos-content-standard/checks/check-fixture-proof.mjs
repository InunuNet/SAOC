// A15: the three browser gates (A7 standard, A8 verbatim, A9 faq) each ran their `next start` WITH the fixture switch and saw zero Sanity API traffic.
// The proof file is written by _lib.mjs fixtureProof() just before a gate kills its server: it reads the logs the server process itself wrote
// (_started.log from lib/sanity-fixture.ts, _hits.log, _misses.log) and the network guard's (_net.log from block-sanity-net.cjs, _browser-net.log from the
// Playwright route guard). Run after A7-A9.
import { existsSync, readFileSync } from 'node:fs';

const BASE = Number(process.env.NOS_STD_PORT ?? 3091);
const GATES = [[1, 'A7 gate-standard'], [2, 'A8 gate-verbatim'], [3, 'A9 gate-faq']];
const failures = [];
for (const [offset, label] of GATES) {
  const f = `.tmp/sandbox/nos-content-standard-gate/fixture-logs-${BASE + offset}/_proof.json`;
  if (!existsSync(f)) { failures.push(`${label}: no ${f} (the gate did not run, or ran with NOS_STD_FIXTURE=live)`); continue; }
  const p = JSON.parse(readFileSync(f, 'utf8'));
  if (p.mode !== 'replay') failures.push(`${label}: server mode was ${p.mode}, not replay`);
  if (!p.started) failures.push(`${label}: the server never wrote _started.log, so it did not see SANITY_FIXTURE_DIR`);
  if (!(p.hits > 0)) failures.push(`${label}: ${p.hits} fixture hits (the server must have served at least one read from the fixture)`);
  if (p.misses !== 0) failures.push(`${label}: ${p.misses} fixture miss(es): ${(p.missSample ?? []).join(' | ')}`);
  if (p.net !== 0) failures.push(`${label}: ${p.net} blocked Sanity API request(s) from the server process`);
  if (p.browserNet !== 0) failures.push(`${label}: ${p.browserNet} Sanity API request(s) from the browser`);
  if (!p.ok) failures.push(`${label}: proof not ok`);
}
if (failures.length) { console.error(`A15 FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('A15 pass (A7, A8, A9 each ran with the fixture switch and zero requests to *.api.sanity.io / *.apicdn.sanity.io)');

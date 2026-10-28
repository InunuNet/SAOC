// Usage: node check-fixture-misses.mjs <fixture log dir>. Exits 1 on a net request or an unexpected fixture miss (build.sh and capture-main-baseline.sh); known misses are reported.
import { existsSync, readFileSync } from 'node:fs';
import { knownMissSummary, unknownMisses } from './_lib.mjs';

const dir = process.argv[2];
const lines = (f) => (existsSync(`${dir}/${f}`) ? readFileSync(`${dir}/${f}`, 'utf8').split('\n').filter(Boolean) : []);
const misses = lines('_misses.log');
const unknown = unknownMisses(misses);
const net = lines('_net.log');
console.log(`fixture log ${dir}: ${misses.length} miss(es), ${unknown.length} unexpected, ${net.length} Sanity API request(s)`);
if (misses.length > unknown.length) console.log(`known-pending, each closed by: ${knownMissSummary(misses).join(' | ')}`);
if (net.length || unknown.length) { console.error([...net, ...unknown.slice(0, 5)].join('\n')); process.exit(1); }

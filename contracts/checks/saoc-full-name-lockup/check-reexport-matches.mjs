#!/usr/bin/env node
// A7 — reproducibility: re-run the exporter into a sandbox dir and require
// the horizontal PNG's pixel dimensions to equal the committed one (+-2px).
// A fallback font, a wrong WM, or a changed es/ns/tsz/rs would change them.
// Needs network for the harness's web fonts, same as the original export.
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const OUT = '.tmp/sandbox/saoc-full-name-lockup';
mkdirSync(OUT, { recursive: true });
const r = spawnSync('node', ['scripts/export-saoc-lockup.mjs'], { env: { ...process.env, SAOC_LOCKUP_OUT_DIR: OUT }, encoding: 'utf8', timeout: 120000 });
if (r.status !== 0) { console.error('FAIL: exporter exited ' + r.status + '\n' + r.stderr); process.exit(1); }
const dims = (p) => { const b = readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const [cw, ch] = dims('public/images/saoc-lockup-horizontal-full-name.png');
const [rw, rh] = dims(`${OUT}/saoc-lockup-horizontal-full-name.png`);
if (Math.abs(cw - rw) > 2 || Math.abs(ch - rh) > 2) { console.error(`FAIL: committed ${cw}x${ch} != re-export ${rw}x${rh}`); process.exit(1); }
console.log(`OK: re-export reproduces the committed raster (${rw}x${rh})`);

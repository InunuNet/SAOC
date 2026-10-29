#!/usr/bin/env node
// A literal SAOC/NOS origin in app/, lib/ or components/ source (comments excepted) is something the
// launch would have to edit by hand. Origins come from lib/site-hosts.ts (env-driven).
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ORIGIN = /https?:\/\/(?:(?:beta|nos|www|dev)\.)?saoc\.co\.za/;
const ROOTS = ['app', 'lib', 'components'];
const hits = [];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) yield full;
  }
}

for (const root of ROOTS) {
  for (const file of walk(root)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (ORIGIN.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
}
if (hits.length) {
  console.error(`FAIL ${hits.length} hard-coded origin(s):\n  ` + hits.join('\n  '));
  process.exit(1);
}
console.log('ok: no hard-coded SAOC/NOS origin in app/, lib/, components/');

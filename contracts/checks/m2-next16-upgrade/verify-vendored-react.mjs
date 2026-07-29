#!/usr/bin/env node
// THE assertion that proves the mission's actual premise. Next.js App
// Router client components resolve `react` to Next's VENDORED copy at
// node_modules/next/dist/compiled/react, never node_modules/react — the
// root-cause finding that cost three prior sessions (see
// .agent/memory/project/learned.md / the mission file's root-cause
// section). Loading node_modules/react and checking typeof useEffectEvent
// proves nothing about what actually ships to the browser; this script
// loads the vendored copy specifically.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const path = 'node_modules/next/dist/compiled/react/cjs/react.development.js';
let mod;
try {
  mod = require(`${process.cwd()}/${path}`);
} catch (e) {
  console.error(`FAIL: could not require vendored react at ${path}: ${e.message}`);
  process.exit(1);
}

if (typeof mod.useEffectEvent !== 'function') {
  console.error(`FAIL: vendored react at ${path} does not export useEffectEvent as a function (got ${typeof mod.useEffectEvent})`);
  process.exit(1);
}

console.log(`PASS: vendored react at ${path} exports useEffectEvent as a function`);
process.exit(0);

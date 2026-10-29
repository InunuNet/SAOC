// F1e lever 1: Crimson Pro (and every other next/font declaration) names each font file ONCE. Today app/layout.tsx lists the same .woff2 once per
// weight (and per style), so a file is declared four times. A variable file needs one declaration with a weight range.
import { readFileSync } from 'node:fs';
import { check, finish } from './lib.mjs';
const src = readFileSync('app/layout.tsx', 'utf8'); const counts = new Map();
for (const m of src.matchAll(/path:\s*'([^']+\.woff2)'/g)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
check(counts.size > 0, 'no font file declarations found in app/layout.tsx');
for (const [p, n] of counts) check(n === 1, `${p} is declared ${n} times in app/layout.tsx, want exactly 1 (use one declaration with a weight range)`);
finish('fonts-static');

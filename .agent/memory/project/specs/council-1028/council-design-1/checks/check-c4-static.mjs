// council-design-1 C4 static gate: JetBrains Mono is gone from the site source. Zero `font-mono` in app/ and components/, no mono token or utility
// definitions, no JetBrains face declared, the Mono font file deleted, the SAOC lockup's Lora/Mono text no longer in the SAOC footer.
// `git grep` over tracked files; scripts/ (media-kit exporters) are build tools, not site UI, and are not scanned.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const fails = [];
const grep = (pattern, paths) => {
  const r = spawnSync('git', ['grep', '-n', '-E', '-e', pattern, '--', ...paths], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status > 1) { console.error(r.stderr); process.exit(2); }
  return (r.stdout || '').split('\n').filter(Boolean);
};
const none = (pattern, paths, why) => { for (const l of grep(pattern, paths)) fails.push(`${why}: ${l.slice(0, 180)}`); };

none('font-mono', ['app', 'components'], 'font-mono class/token still referenced (ruling: zero font-mono in app/ and components/)');
none('jetbrains|JetBrains', ['app', 'components', 'lib', 'next.config.ts', 'package.json'], 'JetBrains still referenced');
none('--mono|var\\(--font-mono', ['app', 'components'], 'mono token still referenced');
none('\\.mono-label|mono-label', ['app', 'components'], 'mono-label utility still referenced');
if (existsSync('app/fonts/jetbrains-mono')) fails.push('app/fonts/jetbrains-mono still exists (delete the font file and its OFL.txt)');
const footer = readFileSync('components/chrome/Footer.tsx', 'utf8');
if (/SaocLockup/.test(footer)) fails.push('components/chrome/Footer.tsx still imports or renders SaocLockup (C1: the footer lockup is the supplied image file)');
// F1e A1 invariant carried over: every font file named once in app/layout.tsx.
const layout = readFileSync('app/layout.tsx', 'utf8'); const counts = new Map();
for (const m of layout.matchAll(/path:\s*'([^']+\.woff2)'/g)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
if (counts.size !== 3) fails.push(`app/layout.tsx declares ${counts.size} font files, want exactly 3 (Crimson Pro normal and italic, Manrope): ${[...counts.keys()].join(', ')}`);
for (const f of ['CrimsonPro-latin-normal', 'CrimsonPro-latin-italic', 'Manrope-latin-normal']) if (!layout.includes(f)) fails.push(`app/layout.tsx no longer declares ${f}`);
if (/jetBrainsMono|font-mono-loaded/.test(layout)) fails.push('app/layout.tsx still declares the Mono family');
if (fails.length) { console.error(`FAIL c4-static: ${fails.length}`); for (const f of fails.slice(0, 80)) console.error('  - ' + f); if (fails.length > 80) console.error(`  ... ${fails.length - 80} more`); process.exit(1); }
console.log('PASS c4-static');

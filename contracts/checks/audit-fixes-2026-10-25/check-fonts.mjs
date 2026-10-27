#!/usr/bin/env node
// Preload only what first paint needs. Pins: JetBrains Mono and Lora (SAOC lockup wordmark) stop
// preloading; Crimson Pro and Manrope keep preloading; no font family, file or weight changes.
import { readFileSync } from 'node:fs';

const layout = readFileSync('app/layout.tsx', 'utf8');
const lockup = readFileSync('components/chrome/SaocLockup.tsx', 'utf8');
const problems = [];

/** The localFont({ ... }) call that declares `name`, as text. */
function declaration(source, name) {
  const start = source.indexOf(`const ${name} = localFont(`);
  if (start === -1) return '';
  const end = source.indexOf('\n});', start);
  return source.slice(start, end === -1 ? undefined : end);
}

const jetbrains = declaration(layout, 'jetBrainsMono');
const lora = declaration(lockup, 'lora');
const crimson = declaration(layout, 'crimsonPro');
const manrope = declaration(layout, 'manrope');

if (!/preload:\s*false/.test(jetbrains)) problems.push('jetBrainsMono must set preload: false');
if (!/preload:\s*false/.test(lora)) problems.push('lora must set preload: false');
if (/preload:\s*false/.test(crimson)) problems.push('crimsonPro must keep preloading (first-paint headings)');
if (/preload:\s*false/.test(manrope)) problems.push('manrope must keep preloading (first-paint body)');

for (const [label, decl, needles] of [
  ['crimsonPro', crimson, ['CrimsonPro-latin-normal.woff2', 'CrimsonPro-latin-italic.woff2', "'--font-serif-loaded'"]],
  ['manrope', manrope, ['Manrope-latin-normal.woff2', "'--font-sans-loaded'"]],
  ['jetBrainsMono', jetbrains, ['JetBrainsMono-latin-normal.woff2', "'--font-mono-loaded'"]],
  ['lora', lora, ['Lora-latin-normal.woff2', "weight: '500'"]],
]) {
  for (const needle of needles) if (!decl.includes(needle)) problems.push(`${label} lost ${needle}`);
}

if (problems.length) {
  console.error('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('ok: JetBrains Mono and Lora no longer preload; families and files unchanged');

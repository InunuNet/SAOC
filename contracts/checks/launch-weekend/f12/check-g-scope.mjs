#!/usr/bin/env node
// F12-A8 - footprint: every file differing from the base (F3's tip) is on the F12 allowlist; the mustBeUnchanged files and prefixes
// (SAOC routes, SAOC chrome, vendor apply/register/payment/photos, vendors/exhibitors/conferences/workshops/tickets pages, nav-config,
// content/show-pages, sanity, apphosting.yaml) have zero diff; no F12 CSS rule escapes the .nos-theme scope.
import { readFileSync } from 'node:fs';
import { GOLDEN_DIR, baseRef, gitLines } from './_lib.mjs';

const cfg = JSON.parse(readFileSync(`${GOLDEN_DIR}/scope-allowlist.json`, 'utf8'));
const base = baseRef();
const changed = new Set([...gitLines('diff', '--name-only', '--no-renames', base), ...gitLines('ls-files', '--others', '--exclude-standard')]);
const re = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
const allow = cfg.allowed.map(re);
const problems = [];
for (const f of changed) if (!allow.some((x) => x.test(f))) problems.push(`out-of-scope change: ${f}`);
for (const f of cfg.mustBeUnchanged) if (changed.has(f)) problems.push(`must be unchanged but differs from base: ${f}`);
for (const f of changed) for (const p of cfg.mustBeUnchangedPrefixes) if (f.startsWith(p) && !(cfg.allowedExceptionsToPrefixes ?? []).includes(f)) problems.push(`must be unchanged (${p}): ${f}`);

// every added selector line in the two NOS stylesheets stays under .nos-theme (SAOC routes cannot be reached)
for (const f of ['app/(marketing)/national-show/nos-theme.css', 'app/(marketing)/national-show/nos-structure.css']) {
  const added = gitLines('diff', '-U0', base, '--', f).filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  for (const l of added) if (/^\s*[^\s@/*{}][^{]*\{\s*$/.test(l) && !/\.nos-theme|^\s*(from|to|\d+%)/.test(l)) problems.push(`${f}: added selector outside .nos-theme: ${l.trim()}`);
}
if (problems.length) { console.error(`FAIL F12-A8 (${problems.length}) against base ${base.slice(0, 8)}:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS F12-A8 scope: ${changed.size} changed file(s) against ${base.slice(0, 8)}, all within the F12 allowlist`);

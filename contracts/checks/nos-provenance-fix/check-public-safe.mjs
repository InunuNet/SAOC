#!/usr/bin/env node
// nos-provenance-fix F3 — lead condition 1: the repo is PUBLIC, so every committed recovered
// file must carry no secret, no personal contact detail, and no text that is not already
// rendered verbatim on the public site.
//
// Usage: node contracts/checks/nos-provenance-fix/check-public-safe.mjs <worktree>
//
// Scans every file in the three recovery dirs for credential-shaped strings, e-mail addresses,
// phone numbers and URLs, and checks every content.md paragraph occurs (normalised, HTML
// entities decoded) in the public route source that renders it. Names need no separate scan:
// a paragraph that passes the rendered check carries only names the public page already shows.
// Prints file:line and the rule only — never the matched text. Exit 0 = pass, 1 = fail, 2 = could not run.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { RECOVERED, normalizeForLinkage } from './recovered-entries.mjs';

const wt = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!wt) { console.error('usage: check-public-safe.mjs <worktree>'); process.exit(2); }

const RULES = [
  // Stricter than verify-show-page-m3.ts C4, which needs "label: value" and missed the
  // spec doc that actually leaked (nos-provenance-fix spec §5 H2).
  { name: 'credential word', re: /pass\s*-?\s*w(or)?d|\bpwd\b|\bpasscode\b|\bsecret\b|\btoken\b|api[\s_-]?key|private[\s_-]?key|\bpin\s*[:=]/i },
  { name: 'e-mail address', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { name: 'phone number', re: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,}\d{3,4}/ },
  { name: 'URL', re: /https?:\/\/|\bwww\./i },
  { name: 'long digit run', re: /\d{6,}/ },
];
// recovery.json legitimately carries the Drive md5 and a date; scan only its note for prose rules.
const JSON_SKIP_KEYS = new Set(['sourceMd5', 'recoveredAt']);

const failures = [];
for (const e of RECOVERED) {
  const dir = path.join(wt, e.dir);
  if (!existsSync(dir)) { failures.push(`${e.dir}: missing`); continue; }
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    let text = readFileSync(file, 'utf8');
    if (name === 'recovery.json') {
      const obj = JSON.parse(text);
      text = Object.entries(obj).filter(([k]) => !JSON_SKIP_KEYS.has(k)).map(([, v]) => String(v)).join('\n');
    }
    text.split('\n').forEach((line, i) => {
      for (const r of RULES) if (r.re.test(line)) failures.push(`${e.dir}/${name}:${i + 1} — ${r.name}`);
    });
  }

  const extractPath = path.join(dir, 'content.md');
  if (!existsSync(extractPath)) continue;
  const rendered = normalizeForLinkage(
    e.renderedIn
      .map((f) => readFileSync(path.join(wt, f), 'utf8'))
      .join('\n')
      .replace(/&[a-zA-Z]+;|&#\d+;/g, ' '),
  );
  readFileSync(extractPath, 'utf8').replace(/\n$/, '').split('\n\n').forEach((p, i) => {
    if (!rendered.includes(normalizeForLinkage(p))) failures.push(`${e.dir}/content.md paragraph ${i + 1} — not rendered verbatim in ${e.renderedIn.join(', ')}`);
  });
}

if (failures.length) { failures.forEach((f) => console.log(`FAIL ${f}`)); process.exit(1); }
console.log(`PASS: ${RECOVERED.length} recovery dirs — no secret, e-mail, phone, URL or long digit run; every paragraph already rendered on the public site`);

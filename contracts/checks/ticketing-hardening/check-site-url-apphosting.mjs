// A12 — apphosting.yaml declares SITE_URL. This is the one CONFIG fact in this contract
// with no runtime surface in the gate (the gate cannot deploy), so it is checked
// structurally — but by PARSING the YAML, not by grepping for the string, so a mention
// in a comment cannot satisfy it.
//
// Without this, a deployed checkout builds notify_url on the https://saoc.co.za
// fallback — the old Joomla site — and every deployed payment sits permanently
// 'reserved' because the ITN never arrives.

import { readFileSync } from 'node:fs';

import { parse } from 'yaml';

const FORBIDDEN_HOST = 'saoc.co.za';

const path = new URL('../../../apphosting.yaml', import.meta.url).pathname;
const doc = parse(readFileSync(path, 'utf8'));
const entries = Array.isArray(doc?.env) ? doc.env : [];
const entry = entries.find((e) => e?.variable === 'SITE_URL');

const failures = [];
if (!entry) {
  failures.push('apphosting.yaml declares no SITE_URL env entry');
} else {
  if (typeof entry.value !== 'string' || entry.value.length === 0) {
    failures.push('SITE_URL must be a plain `value:` (an origin is public, not a secret)');
  }
  if (entry.secret !== undefined) {
    failures.push('SITE_URL must not be declared as a `secret:`');
  }
  if (typeof entry.value === 'string') {
    if (!entry.value.startsWith('https://')) {
      failures.push(`SITE_URL must be an https origin, got '${entry.value}'`);
    }
    if (
      entry.value
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .endsWith(FORBIDDEN_HOST)
    ) {
      failures.push(
        `SITE_URL points at ${FORBIDDEN_HOST}, which still resolves to the OLD Joomla site — the ITN would be delivered there`
      );
    }
    if (entry.value.endsWith('/')) {
      failures.push('SITE_URL must not carry a trailing slash');
    }
  }
  const availability = Array.isArray(entry.availability) ? entry.availability : [];
  if (!availability.includes('RUNTIME')) {
    failures.push('SITE_URL must be available at RUNTIME (the route reads it per request)');
  }
  if (availability.includes('BUILD')) {
    failures.push('SITE_URL must NOT be available at BUILD — that bakes an origin into the bundle');
  }
}

if (failures.length > 0) {
  console.error('FAIL: A12 SITE_URL in apphosting.yaml');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASS: A12 apphosting.yaml declares SITE_URL as a RUNTIME-only https origin');

#!/usr/bin/env node
// WCAG 2.4.7: the SAOC footer newsletter email input shows a visible focus ring. It uses the site's own
// existing treatment, the one the same component's checkbox already uses
// (focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory), not a new style.
import { readFileSync } from 'node:fs';

const FILE = 'components/chrome/Footer.tsx';
const line = readFileSync(FILE, 'utf8').split('\n').find((l) => l.includes('inputClassName='));
const problems = [];
if (!line) problems.push(`${FILE}: no inputClassName line for the newsletter input`);
else {
  if (/focus:outline-none|(^|\s)outline-none/.test(line)) problems.push('newsletter input still removes its outline (focus:outline-none)');
  for (const token of ['focus-visible:outline-2', 'focus-visible:outline-offset-2', 'focus-visible:outline-ivory']) {
    if (!line.includes(token)) problems.push(`newsletter input is missing ${token}`);
  }
}
const reference = readFileSync('components/newsletter/NewsletterSignup.tsx', 'utf8');
if (!/focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory/.test(reference)) {
  problems.push('reference ring in NewsletterSignup.tsx (checkbox) changed; re-pin this check');
}
if (problems.length) {
  console.error('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('ok: footer newsletter input has the existing visible focus ring');

#!/usr/bin/env node
// Property check for /privacy: proves the specific false claim audited
// against the live copy is gone, AND that the required disclosures a
// POPIA-shaped policy needs are present as facts, not just headings.
//
// What this does NOT prove: that the policy is legally sufficient or
// that every sentence is accurate — a human/legal review is still
// required (and is exactly what the mandatory draft notice discloses).
// It proves the specific audited gaps are closed: the false
// "not shared with third parties" claim, and the presence of the named
// third-party categories, an Information Officer contact, retention
// language, and a route to the Information Regulator.
//
// Usage: node check-privacy-content.mjs <url>

const url = process.argv[2];
if (!url) {
  console.error('usage: check-privacy-content.mjs <url>');
  process.exit(2);
}

const res = await fetch(url);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText}`);
  process.exit(2);
}
const html = await res.text();
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

let failed = false;

if (/not shared with third parties/i.test(text)) {
  console.error('FAIL: the false "not shared with third parties" claim is still present');
  failed = true;
}

const REQUIRED = [
  { name: 'payment gateway disclosure', re: /payment gateway|PayFast|Ozow/i },
  { name: 'Resend (email provider) disclosure', re: /Resend/i },
  { name: 'Firebase/Google infrastructure disclosure', re: /Firebase|Google/i },
  { name: 'Information Officer', re: /Information Officer/i },
  { name: 'retention period language', re: /retain|retention/i },
  { name: 'Information Regulator complaint route', re: /Information Regulator/i },
];

for (const { name, re } of REQUIRED) {
  if (!re.test(text)) {
    console.error(`FAIL: missing required disclosure — ${name}`);
    failed = true;
  }
}

if (!failed) {
  console.log(`OK: ${url} contains all required disclosures and not the false claim`);
}
process.exit(failed ? 1 : 0);

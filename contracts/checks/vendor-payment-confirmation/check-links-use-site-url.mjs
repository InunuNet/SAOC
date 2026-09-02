#!/usr/bin/env node
// vendor-payment-confirmation F1 -- A6: every link this feature's vendor-facing email builds
// is composed from a siteUrl/resolveSiteUrl() variable, never a hardcoded domain literal.
// Checked at BOTH the sender module (lib/vendor-payment-confirmation.ts, which must resolve
// siteUrl via deps.siteUrl ?? resolveSiteUrl() -- the same pattern lib/confirmation-email.ts,
// lib/vendor-stand-payment-notification.ts, and app/api/vendors/stand-payment/initiate/route.ts
// all already use, DEFAULT_SITE_URL = 'https://saoc.co.za' / process.env.SITE_URL) and the
// email template (emails/VendorPaymentConfirmation.tsx, which must receive its link as a PROP,
// never construct or hardcode one itself).
//
// ACCEPTED LIMITATION, stated up front rather than chased: this is a SOURCE-TEXT check. It
// proves a link is built FROM the siteUrl variable -- it cannot and does not prove SITE_URL
// itself holds the correct value at runtime. See the golden README's "What this contract does
// NOT prove" -- a hosted.app URL shipped in these emails once already (2026-09-01) because
// SITE_URL itself was wrong in the deployed environment, and every check of this shape stayed
// green throughout that incident, because the variable really was being used correctly; the
// value it held was wrong. Only reading a delivered email (or a runtime assertion against the
// actual resolved process.env.SITE_URL value) can catch that class of defect, and this check
// does not attempt to.
//
// Run as: node contracts/checks/vendor-payment-confirmation/check-links-use-site-url.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

// A hardcoded literal domain anywhere in either file is an automatic fail -- whether or not a
// siteUrl variable is ALSO present, since a fixed literal existing alongside a real variable is
// exactly how the 2026-09-01 hosted.app incident's sibling defects have looked in this project
// before (see docs/vendor-flow-notifications.md and the golden README's "hosted.app" note).
const HARDCODED_DOMAIN_PATTERN = /https?:\/\/[a-z0-9.-]+\.(saoc\.co\.za|web\.app|firebaseapp\.com|run\.app)/i;

const KNOWN_BAD_FIXTURE_HARDCODED_SENDER = `
export async function sendVendorPaymentConfirmationEmail(input, deps = {}) {
  const mailer = deps.mailer ?? { send: sendEmail };
  await mailer.send({
    to: input.contactEmail,
    subject: 'x',
    react: VendorPaymentConfirmation({ ...input, showDetailsUrl: 'https://saoc.co.za/national-show' }),
    from: FORMS_FROM_ADDRESS,
  });
}
`;

const KNOWN_GOOD_FIXTURE_SENDER = `
const DEFAULT_SITE_URL = 'https://saoc.co.za';
function resolveSiteUrl() {
  return process.env.SITE_URL ?? DEFAULT_SITE_URL;
}
export async function sendVendorPaymentConfirmationEmail(input, deps = {}) {
  const siteUrl = deps.siteUrl ?? resolveSiteUrl();
  const mailer = deps.mailer ?? { send: sendEmail };
  await mailer.send({
    to: input.contactEmail,
    subject: 'x',
    react: VendorPaymentConfirmation({ ...input, showDetailsUrl: \`\${siteUrl}/national-show\` }),
    from: FORMS_FROM_ADDRESS,
  });
}
`;

function checkSenderModule(source) {
  const failures = [];
  if (HARDCODED_DOMAIN_PATTERN.test(source)) {
    failures.push('lib/vendor-payment-confirmation.ts contains a hardcoded domain literal instead of building the link from a siteUrl/resolveSiteUrl() variable');
  }
  const resolvesSiteUrl = /resolveSiteUrl\s*\(\s*\)|deps\.siteUrl/.test(source);
  if (!resolvesSiteUrl) {
    failures.push('lib/vendor-payment-confirmation.ts never resolves a siteUrl (expected a resolveSiteUrl() helper or deps.siteUrl, matching lib/confirmation-email.ts\'s own pattern)');
  }
  return { clean: failures.length === 0, failures };
}

function checkEmailTemplate(source) {
  const failures = [];
  if (HARDCODED_DOMAIN_PATTERN.test(source)) {
    failures.push('emails/VendorPaymentConfirmation.tsx contains a hardcoded domain literal -- the link must be a prop, never constructed or hardcoded in the template');
  }
  return { clean: failures.length === 0, failures };
}

// Self-test on the sender-module discriminator: must reject the hardcoded fixture, must accept
// the known-good pattern.
const badSelfTest = checkSenderModule(KNOWN_BAD_FIXTURE_HARDCODED_SENDER);
if (badSelfTest.clean) {
  console.error('FAIL (self-test): discriminator accepted a KNOWN-BAD hardcoded-domain fixture -- the discriminator itself is broken.');
  process.exit(1);
}
const goodSelfTest = checkSenderModule(KNOWN_GOOD_FIXTURE_SENDER);
if (!goodSelfTest.clean) {
  console.error(`FAIL (self-test): discriminator rejected a KNOWN-GOOD fixture that correctly resolves siteUrl -- false positive. Failures: ${JSON.stringify(goodSelfTest.failures)}`);
  process.exit(1);
}

const failures = [];

const senderPath = path.join(REPO_ROOT, 'lib/vendor-payment-confirmation.ts');
if (!existsSync(senderPath)) {
  failures.push(`${senderPath} does not exist.`);
} else {
  const result = checkSenderModule(readFileSync(senderPath, 'utf8'));
  failures.push(...result.failures);
}

const templatePath = path.join(REPO_ROOT, 'emails/VendorPaymentConfirmation.tsx');
if (!existsSync(templatePath)) {
  failures.push(`${templatePath} does not exist.`);
} else {
  const result = checkEmailTemplate(readFileSync(templatePath, 'utf8'));
  failures.push(...result.failures);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: lib/vendor-payment-confirmation.ts resolves siteUrl via resolveSiteUrl()/deps.siteUrl ' +
    'with no hardcoded domain literal; emails/VendorPaymentConfirmation.tsx receives its link ' +
    'as a prop with no hardcoded domain literal. NOTE: this proves the link is built FROM the ' +
    'variable -- it cannot prove SITE_URL itself holds the correct value at runtime.',
);
process.exit(0);

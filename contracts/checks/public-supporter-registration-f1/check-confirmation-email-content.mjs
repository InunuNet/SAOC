#!/usr/bin/env node
// F1 (public-supporter-registration) — the confirmation email's REAL rendered output (not the
// source .tsx grepped for keywords) must contain: (a) an explicit no-share/no-sell promise,
// (b) the actual confirmUrl as a real clickable href, and (c) a mention that the link expires.
// See goldens/supporter-registration-data-model.md's "emails/SupporterRegistrationConfirmation.tsx"
// section. Same react-dom/server renderToStaticMarkup method as
// contracts/checks/vendor-f3-showcase-page/check-intro-prose-renders.mjs.
//
// This is Brad's literal ask ("we will not share or sell their information") made a property
// of the SHIPPED email, not just of the /privacy page copy — a caller cannot silently drop
// this sentence from the email component while README.md's promise remains true only on the
// policy page.
//
// Also checks the module source contains zero console.* call sites and never interpolates
// `input.to`/`input.firstName` into anything logged — same no-PII-in-logs posture as
// lib/vendor-registration-confirmation.ts (checked there by
// contracts/checks/vendor-f5-register-route/check-no-pii-in-logs.mjs).
//
// Run as: node --import tsx/esm contracts/checks/public-supporter-registration-f1/check-confirmation-email-content.mjs

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import SupporterRegistrationConfirmation from '../../../emails/SupporterRegistrationConfirmation.tsx';

const failures = [];
const CONFIRM_URL = 'https://saoc.co.za/api/supporters/confirm?token=abc.def123';

const normalize = (s) => s.replace(/\s+/g, ' ').trim();

let html;
try {
  html = renderToStaticMarkup(
    React.createElement(SupporterRegistrationConfirmation, { firstName: 'Jane', confirmUrl: CONFIRM_URL }),
  );
} catch (error) {
  failures.push(`SupporterRegistrationConfirmation threw when rendered: ${error.message}`);
}

if (html !== undefined) {
  const text = normalize(html.replace(/<[^>]*>/g, ' '));

  // (a) No-share/no-sell promise — checked for either verb, since "share" and "sell" are both
  // acceptable phrasings, but at least the negation + one of the two verbs must be present.
  const hasNoShareOrSell =
    /not\s+(?:share|sell)/i.test(text) || /(?:share|sell).{0,20}not/i.test(text) || /never\s+(?:share|sell)/i.test(text);
  if (!hasNoShareOrSell) {
    failures.push(`Rendered email text does not contain a "will not share/sell" style promise. Rendered text: "${text}"`);
  }

  // (b) The confirm URL must be a real href, not merely printed as visible text.
  if (!html.includes(`href="${CONFIRM_URL}"`)) {
    failures.push(`Rendered HTML does not contain the confirmUrl as a real href="${CONFIRM_URL}" link.`);
  }

  // (c) Expiry mention — "expire" or "valid for" style language.
  if (!/expir|valid for|link will/i.test(text)) {
    failures.push(`Rendered email text does not mention that the confirmation link expires. Rendered text: "${text}"`);
  }

  // (d) Personalisation — firstName rendered somewhere when provided.
  if (!text.includes('Jane')) {
    failures.push('Rendered email text does not include the provided firstName ("Jane") anywhere.');
  }
}

// Renders without throwing when firstName is null (optional field — see data model spec).
try {
  renderToStaticMarkup(React.createElement(SupporterRegistrationConfirmation, { firstName: null, confirmUrl: CONFIRM_URL }));
} catch (error) {
  failures.push(`SupporterRegistrationConfirmation threw when rendered with firstName: null: ${error.message}`);
}

// Static source check — no console.* call sites in either the email component or the sender.
const emailSource = readFileSync(new URL('../../../emails/SupporterRegistrationConfirmation.tsx', import.meta.url), 'utf8');
if (/console\s*\./.test(emailSource)) {
  failures.push('emails/SupporterRegistrationConfirmation.tsx contains a console.* call — must never log the registrant\'s data.');
}

const senderSource = readFileSync(new URL('../../../lib/supporter-registration-confirmation.ts', import.meta.url), 'utf8');
if (/console\s*\./.test(senderSource)) {
  failures.push('lib/supporter-registration-confirmation.ts contains a console.* call — must never log the registrant\'s email/name.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the confirmation email\'s real rendered output states SAOC will not share/sell the ' +
    'registrant\'s information, includes the confirm link as a real clickable href, mentions ' +
    'the link expires, personalises with firstName when given, renders cleanly with ' +
    'firstName: null, and neither the email component nor the sender module logs anything.',
);
process.exit(0);

#!/usr/bin/env node
// Every outbound Ozow field against Ozow's documented maximum (goldens/f4/ozow-field-caps.json),
// via the REAL Ozow adapter with realistic worst-case inputs: a vendor-stand reference, a ticket
// reference, and URLs built on a 60-char siteUrl. Also proves the adapter FAILS LOUDLY (throws,
// naming field + length, never the value) rather than posting an over-length field that Ozow
// silently rejects with pay.ozow.com/request-error, and that the golden table and the module
// table agree and cover every outbound field. No network, no Firestore.
//
// BASE a42694dc: FAILS (a 239-char SuccessUrl is accepted and posted).
//
// Run as: npx tsx contracts/checks/vendor-stand-return-url/check-ozow-field-limits.mjs

import { existsSync, readFileSync } from 'node:fs';

import { createOzowProvider } from '../../../lib/payments/ozow.ts';
import { OZOW_OUTBOUND_FIELD_ORDER } from '../../../lib/ozow.ts';

const golden = JSON.parse(readFileSync(new URL('../../../.agent/memory/project/specs/vendor-flow-fixes/goldens/f4/ozow-field-caps.json', import.meta.url), 'utf8'));
const CAPS = golden.caps;
const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };

const env = { OZOW_SANDBOX_SITE_CODE: 'INUNUNETCC87E4C79C5F', OZOW_SANDBOX_PRIVATE_KEY: 'k'.repeat(32), OZOW_SANDBOX_API_KEY: 'a'.repeat(32) };
const provider = createOzowProvider({ env });
const SITE = `https://${'a'.repeat(41)}.saoc.co.za`; // 60 chars
const STATUS_URL = `${SITE}/vsp?a=0123456789abcdef`;
const VSO_REF = 'VSO-aB3dEfGh1234567890ZZ::0123456789abcdef';
const TICKET_REF = 'SAOC-2027-ABCDEFGH1234';

// Coverage: the golden table must name every outbound field plus HashCheck.
for (const name of [...OZOW_OUTBOUND_FIELD_ORDER, 'HashCheck']) {
  expect(typeof CAPS[name] === 'number', `golden ozow-field-caps.json has no cap for outbound field ${name}.`);
}

function checkFields(label, fields) {
  for (const [name, value] of Object.entries(fields)) {
    const cap = CAPS[name];
    if (cap === undefined) { failures.push(`${label}: field ${name} has no documented cap in the golden.`); continue; }
    expect(String(value).length <= cap, `${label}: ${name} is ${String(value).length} chars (> documented ${cap}).`);
  }
}

const vso = await provider.initiate({ reference: VSO_REF, amountFormatted: '1500.00', itemName: 'x', returnUrl: STATUS_URL, cancelUrl: STATUS_URL, notifyUrl: `${SITE}/api/vendors/stand-payment/ozow-itn` }).then((r) => r, (e) => ({ ok: false, error: e.message }));
expect(vso.ok === true, `vendor-stand initiate with short return URLs must succeed: ${vso.error ?? ''}`);
if (vso.ok) checkFields('vendor-stand', vso.fields);

// Ticket flow (no regression): derive the REAL cancel/return URL templates from the checkout
// route source and expand them for production-shaped hosts. CancelUrl is enforced at 150 (live
// sandbox ticket purchases with a 63-68 char CancelUrl reached `paid`); the existing
// /tickets/cancelled?ref=<22 chars> template (63 on prod) must keep working, untouched.
const TICKET_ROUTE = 'app/api/tickets/checkout/route.ts';
const routeSrc = existsSync(TICKET_ROUTE) ? readFileSync(TICKET_ROUTE, 'utf8') : '';
const tmpl = (key) => new RegExp(`${key}:\\s*\`([^\`]*)\``).exec(routeSrc)?.[1];
const ticketReturnT = tmpl('returnUrl');
const ticketCancelT = tmpl('cancelUrl');
expect(Boolean(ticketReturnT && ticketCancelT), 'could not extract ticket checkout returnUrl/cancelUrl templates.');
if (ticketReturnT && ticketCancelT) {
  const expand = (t, host) => t.replace('${siteUrl}', host).replace('${reference}', TICKET_REF);
  for (const host of ['https://saoc.co.za', 'https://beta.saoc.co.za', SITE]) {
    const ticket = await provider.initiate({ reference: TICKET_REF, amountFormatted: '250.00', itemName: 'x', returnUrl: expand(ticketReturnT, host), cancelUrl: expand(ticketCancelT, host), notifyUrl: `${host}/api/tickets/ozow-itn` }).then((r) => r, (e) => ({ ok: false, error: e.message }));
    expect(ticket.ok === true, `ticket initiate on ${host} must succeed (cancelUrl ${expand(ticketCancelT, host).length} chars, cap 150): ${ticket.error ?? ''}`);
    if (ticket.ok) checkFields(`ticket@${host}`, ticket.fields);
  }
}

// Over-length must be refused loudly, per field, without echoing values.
const longToken = 'x'.repeat(186);
const legacy = `${SITE}/national-show/vendors/payment?token=${longToken}&paid=1`;
expect(legacy.length > 150, 'test setup: legacy URL must exceed 150.');
// CancelUrl boundary: 151 chars must throw (cancelUrl feeds CancelUrl AND ErrorUrl, both 150); 150
// passes; and 51-70 chars must NOT throw (guards against re-introducing the unverified 50 reading).
const pad = (n) => 'https://saoc.co.za/vsp?a=0123456789abcdef'.padEnd(n, 'x');
const initWith = (overrides) => provider.initiate({ reference: VSO_REF, amountFormatted: '1500.00', itemName: 'x', returnUrl: STATUS_URL, cancelUrl: STATUS_URL, notifyUrl: `${SITE}/api/vendors/stand-payment/ozow-itn`, ...overrides });
for (const n of [51, 63, 70, 150]) {
  const ok = await initWith({ cancelUrl: pad(n) }).then((r) => r.ok === true, () => false);
  expect(ok, `a ${n}-char cancelUrl is within the enforced 150 cap and must not throw.`);
}
let cancel151Threw = null;
try { await initWith({ cancelUrl: pad(151) }); } catch (error) { cancel151Threw = error; }
expect(cancel151Threw instanceof Error && /CancelUrl/.test(cancel151Threw.message) && /151/.test(cancel151Threw.message) && /150/.test(cancel151Threw.message), 'a 151-char cancelUrl must throw naming CancelUrl, 151 and the 150 cap.');
let success151Threw = null;
try { await initWith({ returnUrl: pad(151) }); } catch (error) { success151Threw = error; }
expect(success151Threw instanceof Error && /SuccessUrl/.test(success151Threw.message), 'a 151-char returnUrl must throw naming SuccessUrl.');

for (const [label, overrides] of [['SuccessUrl via returnUrl', { returnUrl: legacy }], ['CancelUrl/ErrorUrl via cancelUrl', { cancelUrl: legacy }], ['NotifyUrl', { notifyUrl: legacy }], ['TransactionReference', { reference: `VSO-${'z'.repeat(40)}::0123456789abcdef` }]]) {
  const logged = [];
  const origError = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  let threw = null;
  try {
    await provider.initiate({ reference: VSO_REF, amountFormatted: '1500.00', itemName: 'x', returnUrl: STATUS_URL, cancelUrl: STATUS_URL, notifyUrl: `${SITE}/api/vendors/stand-payment/ozow-itn`, ...overrides });
  } catch (error) { threw = error; } finally { console.error = origError; }
  expect(threw instanceof Error, `${label}: an over-length field must make initiate THROW (loud, logged 500), not post silently.`);
  if (threw) {
    expect(!threw.message.includes(longToken) && !logged.join(' ').includes(longToken), `${label}: error/log must not echo the field value (it may carry a token).`);
    expect(/\d+/.test(threw.message), `${label}: error should state the offending length(s).`);
  }
}

// Golden <-> module parity (reported last so a missing module still lets the behaviour checks speak).
try {
  const limits = await import('../../../lib/payments/gateway-field-limits.ts');
  expect(JSON.stringify(Object.entries(limits.OZOW_FIELD_MAX_LENGTH).sort()) === JSON.stringify(Object.entries(CAPS).sort()), 'OZOW_FIELD_MAX_LENGTH must equal the golden caps table exactly.');
  expect(limits.PAYFAST_FIELD_MAX_LENGTH?.item_name === golden.payfast.caps.item_name, 'PAYFAST_FIELD_MAX_LENGTH.item_name must be 100.');
  expect(typeof limits.findFieldLengthViolations === 'function' && typeof limits.clampToMaxLength === 'function', 'module must export findFieldLengthViolations and clampToMaxLength.');
  if (typeof limits.clampToMaxLength === 'function') {
    const clamp = limits.clampToMaxLength;
    expect(clamp('x'.repeat(300), 100).length === 100 && clamp('abc', 100) === 'abc', 'clampToMaxLength must truncate to the cap and leave short values untouched.');
    // Surrogate pair straddling the cut: 99 ASCII + U+1F33A (2 UTF-16 units) + tail. A cut at 100 would
    // split the pair; the whole code point must be dropped, never a lone surrogate, never > max.
    const straddle = clamp(`${'a'.repeat(99)}\u{1F33A}tail`, 100);
    expect(straddle === 'a'.repeat(99), `a surrogate pair straddling the cut must be dropped whole (got length ${straddle.length}).`);
    expect(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(straddle), 'clamp must never leave a lone surrogate.');
    const fits = clamp(`${'a'.repeat(98)}\u{1F33A}tail`, 100);
    expect(fits === `${'a'.repeat(98)}\u{1F33A}` && fits.length === 100, 'a pair that ends exactly at max must be kept.');
    for (const [v, m] of [['\u{1F33A}'.repeat(80), 100], ['\u{1F33A}'.repeat(3), 1], ['\u{1F33A}'.repeat(3), 2], ['é'.repeat(150), 100]]) {
      expect(clamp(v, m).length <= m, `clamp(${v.length}-unit value, ${m}) must never exceed max (got ${clamp(v, m).length}).`);
    }
  }
} catch (error) {
  failures.push(`lib/payments/gateway-field-limits.ts missing or unloadable: ${error.message}`);
}

console.log(`advisory: Ozow's main table prints CancelUrl as String (${golden.cancelUrlDocumentedAlternateCap}); enforced at ${golden.cancelUrlEnforcedCap} on live-sandbox evidence (see golden notes). The status URL is ${STATUS_URL.length} chars on a 60-char host.`);
if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log('PASS: every outbound Ozow field is within its documented cap for vendor-stand and ticket inputs; over-length fields throw without echoing values; golden and module tables agree.');

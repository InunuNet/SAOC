#!/usr/bin/env node
// A2 (REPAIRED 2026-11-22) — THE GATEWAY IS FAIL-CLOSED: NO ACTIVE GATEWAY CONFIGURED MEANS A 500,
// NEVER A SILENT PAYFAST DEFAULT, AND A CLIENT-SUPPLIED providerId CAN NEVER CHOOSE THE GATEWAY.
//
// Why this check changed: it originally proved that a missing/invalid CLIENT providerId returned
// 400. Mission gateway-picker-admin-only F1 deliberately removed that parameter: the route now
// resolves the gateway server-side from the admin-set Firestore doc (resolveActiveGateway) and
// ignores whatever the client sends. The old 400 assertions therefore failed for a good reason
// (the product changed on purpose; this is not a payment regression). The property they protected,
// "no silent default gateway; the client cannot pick one", is asserted here against the new shape.
//
// THE OFFLINE TRICK: with the Firebase admin credentials unset, resolveActiveGateway() cannot read
// the settings doc and returns null, so checkout must refuse with the gateway-not-configured 500.
// That refusal runs BEFORE the CMS guard, so every case below returns the same gateway 500 and
// never the later "CMS is not configured" 500 (which would mean the gate was skipped) and never a
// 2xx or a redirect to a gateway (which would mean a default was silently chosen).
//
// WHAT MAKES THIS FAIL: any providerId value (omitted, invalid, or a valid 'payfast'/'ozow') that
// gets anything other than the gateway-not-configured 500 while no gateway is configured; the
// route source reading `providerId` off the request body again (a client-chosen gateway).
//
// Run as: NEXT_PUBLIC_SANITY_PROJECT_ID= pnpm exec tsx contracts/checks/ozow-m1-f2/check-providerid-fail-closed.mjs

import { readFileSync } from 'node:fs';

import ts from 'typescript';

process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = '';
// Deliberately absent so ANY code path that reaches Firestore throws loudly rather than hanging
// or silently succeeding against a real project.
delete process.env.FIREBASE_ADMIN_PROJECT_ID;
delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;

const { POST } = await import('../../../app/api/tickets/checkout/route.ts');
const { NATIONAL_SHOW_ID } = await import('../../../lib/tickets-constants.ts');
const { CURRENT_TERMS_VERSIONS } = await import('../../../lib/checkout-terms.ts');

const failures = [];
const ok = (name, cond, detail = '') => {
  if (!cond) failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
};

const VALID_LINE_ITEMS = [
  { ticketType: 'day-visitor', attendeeName: 'Test Buyer', attendeeEmail: 'buyer@example.com' },
];

let idempotencyCounter = 0;
function nextIdempotencyKey() {
  idempotencyCounter += 1;
  return `00000000-0000-4000-8000-${String(idempotencyCounter).padStart(12, '0')}`;
}

async function callCheckout(bodyOverrides) {
  const body = {
    showId: NATIONAL_SHOW_ID,
    lineItems: VALID_LINE_ITEMS,
    termsAccepted: true,
    ...CURRENT_TERMS_VERSIONS,
    ...bodyOverrides,
  };
  const request = new Request('http://localhost/api/tickets/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': nextIdempotencyKey(),
      'Content-Length': String(Buffer.byteLength(JSON.stringify(body))),
    },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

// Every client-supplied providerId, valid or not, must hit the same fail-closed gateway 500 while
// no gateway is configured: the value is ignored, there is no default, and nothing proceeds.
const cases = [
  ['omitted', {}],
  ['empty string', { providerId: '' }],
  ['unrecognised string', { providerId: 'stripe' }],
  ['wrong case', { providerId: 'PayFast' }],
  ['null', { providerId: null }],
  ['non-string (number)', { providerId: 1 }],
  ['valid payfast', { providerId: 'payfast' }],
  ['valid ozow', { providerId: 'ozow' }],
];
for (const [label, overrides] of cases) {
  const { status, json } = await callCheckout(overrides);
  ok(`case (${label}): no active gateway returns the gateway-not-configured 500`,
    status === 500 && /Payment gateway is not configured/i.test(String(json?.error ?? '')),
    `actual status: ${status}, body: ${JSON.stringify(json)}`);
}

// The gateway must never be read off the request body: that would re-open a client-chosen gateway.
const routeSource = readFileSync(new URL('../../../app/api/tickets/checkout/route.ts', import.meta.url), 'utf8');
// Found by walking the syntax tree, so every spelling is caught: `body.providerId`,
// `body?.providerId`, `(body as X).providerId`, `body['providerId']`, and destructuring such as
// `const { providerId } = body as X`. The route has no legitimate read of a `providerId` member:
// the resolved gateway is the local `providerId` variable, which is a plain identifier.
// The key a destructuring element reads: `providerId`, `'providerId'` or the computed
// `['providerId']` (a computed key holding a plain string literal is the same read).
function destructuredKeyName(nameNode) {
  const keyNode = ts.isComputedPropertyName(nameNode) ? nameNode.expression : nameNode;
  return ts.isIdentifier(keyNode) || ts.isStringLiteralLike(keyNode) ? keyNode.text : null;
}

function findProviderIdReads(source) {
  const sourceFile = ts.createSourceFile('route.ts', source, ts.ScriptTarget.ES2022, true);
  const hits = [];
  const line = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'providerId') {
      hits.push(`line ${line(node)}: .providerId member access`);
    } else if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === 'providerId'
    ) {
      hits.push(`line ${line(node)}: ['providerId'] element access`);
    } else if (
      ts.isBindingElement(node) &&
      ts.isObjectBindingPattern(node.parent) &&
      destructuredKeyName(node.propertyName ?? node.name) === 'providerId'
    ) {
      hits.push(`line ${line(node)}: providerId destructured from an object`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return hits;
}
const providerIdReads = findProviderIdReads(routeSource);
ok('route does not read providerId from the request body (member, bracket, cast or destructuring)',
  providerIdReads.length === 0, providerIdReads.join('; '));
ok('route resolves the gateway server-side via resolveActiveGateway()',
  /await resolveActiveGateway\(\)/.test(routeSource));

if (failures.length > 0) {
  console.error(`FAIL — ${failures.length} case(s):\n\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log('PASS — the gateway is resolved server-side and fails closed (500) with no silent PayFast default.');

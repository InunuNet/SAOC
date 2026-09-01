#!/usr/bin/env node
// vendor-gated-registration-flow M3/F30 (A59) -- CLASS assertion (A42/A54-style), not an
// instance check. Static analysis of the REAL POST /api/vendors/stand-payment/initiate route
// source: the parsed request body's keys accessed anywhere in the file must be a subset of
// {token, boothSize} -- no body.amount/body.price/body.zar-shaped access may exist anywhere --
// AND every write to a vendorStandOrders document's `amount` field must be assigned FROM a
// value traced back to resolveVendorStandPrice(...)'s return (through at most one
// intermediate local variable), never a body-derived identifier. See
// contracts/golden/vendor-gated-registration-flow-m3/README.md "Initiate" -- this is the
// money-specific instance of the mission's "every amount must be server-derived" class; extend
// it (not duplicate it) if a second money-writing route is ever added to this mission.
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m3/check-initiate-amount-is-server-derived.mjs

import { readFileSync } from 'node:fs';

const ROUTE = 'app/api/vendors/stand-payment/initiate/route.ts';
const raw = readFileSync(new URL(`../../../${ROUTE}`, import.meta.url), 'utf8');

// Strip comments (preserving line offsets is not needed here) so a comment mentioning
// "body.amount" as prose cannot produce a false positive/negative.
const source = raw
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

const failures = [];

// --- 1. Every `body.<prop>` access is one of {token, boothSize} --------------------------------
const ALLOWED_BODY_KEYS = new Set(['token', 'boothSize']);
const bodyAccesses = [...source.matchAll(/\bbody\.(\w+)\b/g)].map((m) => m[1]);
if (bodyAccesses.length === 0) {
  failures.push('found zero `body.<prop>` accesses in the route -- the scan may be looking at the wrong file, or the route no longer reads a request body at all.');
}
for (const key of new Set(bodyAccesses)) {
  if (!ALLOWED_BODY_KEYS.has(key)) {
    failures.push(`found \`body.${key}\` access -- only {token, boothSize} may be read off the request body. A client-supplied "${key}" must never be trusted.`);
  }
}

// --- 2. Trace the `amount` value written into the vendorStandOrders document -------------------
// Find the variable resolveVendorStandPrice(...) is assigned into.
const priceResolutionMatch = source.match(/const\s+(\w+)\s*=\s*resolveVendorStandPrice\(/);
if (!priceResolutionMatch) {
  failures.push('no `const <ident> = resolveVendorStandPrice(...)` call found -- cannot trace the amount to its source.');
}
const priceResolutionVar = priceResolutionMatch?.[1];

// Find the variable assigned from `<priceResolutionVar>.amount`.
let amountVar = null;
if (priceResolutionVar) {
  const amountAssignMatch = source.match(new RegExp(`const\\s+(\\w+)\\s*=\\s*${priceResolutionVar}\\.amount\\s*;`));
  if (!amountAssignMatch) {
    failures.push(`no \`const <ident> = ${priceResolutionVar}.amount;\` assignment found -- the amount local variable could not be traced.`);
  }
  amountVar = amountAssignMatch?.[1] ?? null;
}

// Find the transaction.set(...) call and its object-literal argument.
const setCallIndex = source.indexOf('transaction.set(');
if (setCallIndex === -1) {
  failures.push('no `transaction.set(...)` call found in the route -- expected the order document to be written via transaction.set(), never .update() (see the golden README).');
} else {
  // Naive brace-matching from the object literal's opening `{` to its matching `}` -- the
  // route's own object literal is flat enough (no nested object values) for this to be safe.
  const openBraceIndex = source.indexOf('{', setCallIndex);
  let depth = 0;
  let closeBraceIndex = -1;
  for (let i = openBraceIndex; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        closeBraceIndex = i;
        break;
      }
    }
  }
  const setArgs = closeBraceIndex === -1 ? '' : source.slice(openBraceIndex, closeBraceIndex + 1);

  if (!amountVar) {
    failures.push('cannot verify the transaction.set() amount field without a traced amount variable (see above).');
  } else {
    // The amount field must appear as a BARE identifier reference to amountVar -- either
    // shorthand (`amount,`) or explicit (`amount: amount,`) -- never a different expression
    // (e.g. `amount: body.amount`, `amount: Number(body.price)`, a ternary, etc.).
    const shorthandPattern = new RegExp(`(^|[{,\\s])${amountVar}(\\s*[,}])`);
    const explicitPattern = new RegExp(`amount\\s*:\\s*${amountVar}\\s*[,}]`);
    if (!shorthandPattern.test(setArgs) && !explicitPattern.test(setArgs)) {
      failures.push(
        `the transaction.set() object literal does not write \`amount\` as a bare reference to ` +
          `"${amountVar}" (the value traced from resolveVendorStandPrice()) -- found: ${JSON.stringify(setArgs)}`,
      );
    }
    // Defensive: the object literal must not ALSO contain any body-derived amount expression.
    if (/amount\s*:\s*body\./.test(setArgs)) {
      failures.push('the transaction.set() object literal writes `amount` from a body-derived expression.');
    }
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: the initiate route reads only {token, boothSize} off the request body, and the ' +
    'vendorStandOrders `amount` field is written as a bare reference to the value traced from ' +
    'resolveVendorStandPrice()\'s return -- never a body-derived expression.',
);
process.exit(0);

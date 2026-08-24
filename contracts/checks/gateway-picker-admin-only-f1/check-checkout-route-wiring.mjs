// Structural check for app/api/tickets/checkout/route.ts (contracts/golden/
// gateway-picker-admin-only-f1/checkout-route-diff.golden.md). Proves by source position, not
// behaviour alone — same posture as ticketing-checkout-orders'
// check-fail-closed-secret-guard.sh.
import { readFileSync } from 'node:fs';

const path = 'app/api/tickets/checkout/route.ts';
const src = readFileSync(path, 'utf8');

function must(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// The picker-removal invariants: no client-supplied providerId is trusted anywhere.
must(!src.includes('body.providerId'), 'route must not read body.providerId');
must(!src.includes('isValidProviderId'), 'isValidProviderId must be deleted, not repurposed');
must(!src.includes('KNOWN_PROVIDER_IDS'), 'KNOWN_PROVIDER_IDS must be deleted');
must(!/providerId\s*:\s*unknown/.test(src), 'CheckoutRequestBody must not declare providerId');

// The server-side resolver must be wired in.
must(src.includes('resolveActiveGateway'), 'route must call resolveActiveGateway()');
must(
  src.includes("from '@/lib/payments/active-gateway'"),
  'route must import from @/lib/payments/active-gateway',
);

// Source-position: the resolveActiveGateway() call must appear before the reservation
// transaction call (reserveTicket() invocation) and before the sales-open/CMS guard removed
// nothing downstream — i.e. it must sit early, same position isValidProviderId used to occupy.
//
// Scoped to start at `export async function POST` — an unrelated helper, fetchSoldOutMessage(),
// is defined above POST and also contains the literal text `if (!client)` (its own, unrelated
// early-return), which a bare src.indexOf('if (!client)') would match first and falsely put
// ahead of resolveActiveGateway().
const postIdx = src.indexOf('export async function POST');
must(postIdx !== -1, 'export async function POST not found');
const resolveIdx = src.indexOf('resolveActiveGateway(', postIdx === -1 ? 0 : postIdx);
const clientGuardIdx = src.indexOf('if (!client)', postIdx === -1 ? 0 : postIdx);
const reserveCallIdx = src.lastIndexOf('outcome = await reserveTicket(');

must(resolveIdx !== -1, 'resolveActiveGateway() call not found');
must(clientGuardIdx !== -1, '!client CMS guard not found (inside POST)');
must(reserveCallIdx !== -1, 'reserveTicket() call not found');
must(
  resolveIdx !== -1 && clientGuardIdx !== -1 && resolveIdx < clientGuardIdx,
  'resolveActiveGateway() must run before the CMS (!client) guard',
);
must(
  resolveIdx !== -1 && reserveCallIdx !== -1 && resolveIdx < reserveCallIdx,
  'resolveActiveGateway() must run before the reservation transaction (no charge without a resolved gateway)',
);

// Downstream wiring must still exist, keyed off the resolved id, not a fresh client read.
must(src.includes('gateway: providerId'), 'reserveTicket() input must still set gateway: providerId');
must(
  src.includes('NOTIFY_PATH_BY_PROVIDER_ID[providerId]'),
  'notify path lookup must still key off the resolved providerId',
);

if (process.exitCode === 1) {
  process.exit(1);
}
console.log('PASS: checkout route wiring matches the gateway-picker-admin-only-f1 golden.');

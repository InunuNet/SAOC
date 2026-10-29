// Golden: with App Check ENFORCED, a payment notification with no App Check token is still
// accepted into verification (server-to-server webhooks must never require one). Drives the real
// handlers with a stub provider that rejects verification, which returns before any order is touched.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/itn-no-appcheck.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = process.env.SEC_GOLDEN_ROOT ?? path.resolve(__dirname, '../../../../../..');

async function main() {
  process.env.APP_CHECK_ENFORCE_CHECKOUT = 'true';
  const { NextRequest } = await import('next/server');
  const tickets = await import(path.join(ROOT, 'lib/tickets-notification.ts'));
  const vendors = await import(path.join(ROOT, 'lib/vendor-stand-payment-notification.ts'));

  for (const [name, handler] of [['tickets', tickets.POST], ['vendor stand', vendors.POST]] as const) {
    let verifications = 0;
    const provider = {
      id: 'stub',
      verifyNotification: async () => {
        verifications += 1;
        return { verified: false, reason: 'bad-signature', reference: null };
      },
    };
    const request = new NextRequest('http://localhost/api/notify', {
      method: 'POST',
      body: 'm_payment_id=abc&payment_status=COMPLETE',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    const response = await handler(provider, request);
    assert.equal(verifications, 1, `${name}: the notification reached verification without an App Check token`);
    assert.equal(response.status, 200, `${name}: a tokenless notification is acknowledged, not refused (403/413)`);
  }

  console.log('itn-no-appcheck golden: PASS');
}

main().catch((error) => {
  console.error('itn-no-appcheck golden: FAIL');
  console.error(error);
  process.exit(1);
});

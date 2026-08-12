// A13 — the behavioural half of the SITE_URL defect. A12 proves the deploy config
// declares the variable; this proves the RUNTIME path actually consumes it: a real
// checkout against the running server must return a PayFast payload whose notify_url,
// return_url and cancel_url are all built on SITE_URL, and never on the saoc.co.za
// fallback (the old Joomla site).

import {
  safeBody,
  assert,
  assertSalesOpen,
  postCheckout,
  runId,
  sentinelEmail,
  withCleanup,
} from './_shared.mjs';

const FORBIDDEN_HOST = 'saoc.co.za';

await withCleanup('A13 PayFast callback URLs are built on SITE_URL at request time', async () => {
  await assertSalesOpen();
  const siteUrl = process.env.SITE_URL?.trim().replace(/\/+$/, '');
  assert(
    !!siteUrl,
    'PRECONDITION: SITE_URL is unset in .env.local, so this check cannot distinguish a working runtime lookup from the fallback.'
  );

  const id = runId();
  const { status, body } = await postCheckout({ email: sentinelEmail(`notify-${id}`) });
  assert(status === 201, `checkout failed: HTTP ${status} ${safeBody(body)}`);

  const fields = body.fields ?? {};
  assert(
    fields.notify_url === `${siteUrl}/api/tickets/itn`,
    `notify_url must be '${siteUrl}/api/tickets/itn', got '${fields.notify_url}'`
  );
  assert(
    fields.return_url?.startsWith(`${siteUrl}/tickets/confirmation?ref=`),
    `return_url must be built on SITE_URL, got '${fields.return_url}'`
  );
  assert(
    fields.cancel_url?.startsWith(`${siteUrl}/tickets/cancelled?ref=`),
    `cancel_url must be built on SITE_URL, got '${fields.cancel_url}'`
  );

  for (const key of ['notify_url', 'return_url', 'cancel_url']) {
    assert(
      !new URL(fields[key]).host.endsWith(FORBIDDEN_HOST),
      `${key} points at ${FORBIDDEN_HOST} — the ITN would be delivered to the old Joomla site`
    );
  }
  assert(
    typeof fields.signature === 'string' && fields.signature.length === 32,
    'the returned payload carries no PayFast signature'
  );
});

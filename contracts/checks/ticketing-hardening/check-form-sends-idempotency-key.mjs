// A17 — the real buy form still works after the server starts requiring an
// Idempotency-Key. Drives /tickets in a real browser, submits the form, and inspects
// the OUTGOING request the page actually makes: it must carry a UUID Idempotency-Key
// and be accepted (201). Without this assertion, a server-side-only fix would make the
// site reject every genuine purchase with a 400 and no other check would notice.
//
// The PayFast redirect is blocked so nothing leaves for the sandbox gateway; the
// reservation the submit creates is swept like every other sentinel ticket.

import { chromium } from 'playwright';

import {
  assert,
  assertSalesOpen,
  BASE_URL,
  runId,
  sentinelEmail,
  withCleanup,
} from './_shared.mjs';

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const SUBMIT_TIMEOUT_MS = 20_000;

await withCleanup('A17 the /tickets form sends an Idempotency-Key and is accepted', async () => {
  await assertSalesOpen();
  const email = sentinelEmail(`form-${runId()}`);
  const browser = await chromium.launch();
  let captured = null;
  try {
    const page = await browser.newPage();
    await page.route('**/sandbox.payfast.co.za/**', (route) => route.abort());
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/tickets/checkout')) captured = req;
    });

    await page.goto(`${BASE_URL}/tickets`, { waitUntil: 'domcontentloaded' });
    // Target the purchase form's own inputs by id — the page footer carries a
    // newsletter field with the same accessible label, so a label lookup is ambiguous.
    await page.locator('#tp-name').fill('Harden Check');
    await page.locator('#tp-email').fill(email);
    await page.locator('#tp-email').locator('xpath=ancestor::form').getByRole('button').click();

    const deadline = Date.now() + SUBMIT_TIMEOUT_MS;
    while (!captured && Date.now() < deadline) {
      await page.waitForTimeout(250);
    }
    assert(
      captured != null,
      'the buy form never issued a POST to /api/tickets/checkout — the submit path itself is broken'
    );

    // Await the response BEFORE asserting: it settles the in-flight request so the
    // server's Firestore write lands before this check's cleanup sweep runs.
    const response = await captured.response();
    const key = (await captured.allHeaders())['idempotency-key'];
    assert(
      typeof key === 'string' && UUID.test(key),
      `the buy form sent no valid Idempotency-Key header (got ${key === undefined ? 'none' : `'${key}'`})`
    );
    assert(
      response?.status() === 201,
      `the real form submission was rejected with HTTP ${response?.status()} — the site cannot sell a ticket`
    );
  } finally {
    await browser.close();
  }
});

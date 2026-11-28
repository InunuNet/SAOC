// N11 — the hidden Speakers Partner ticket. Runs against the e2e dev server, whose
// SPEAKERS_PARTNER_PASSWORD is the throwaway in e2e/support/speakers-partner-dummy.ts.
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { CURRENT_TERMS_VERSIONS } from '@/lib/checkout-terms';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { hasSpeakersPartnerAccess, mintSpeakersPartnerSession } from '@/lib/speakers-partner';

import { E2E_SPEAKERS_PARTNER_PASSWORD } from './support/speakers-partner-dummy';
import { nosBase } from './utils/site-urls';

const CHECKOUT = '/api/tickets/checkout';
const AUTH = '/api/tickets/speakers-partner/auth';
const COOKIE = 'speakers_partner_access';
const ATTENDEE = { attendeeName: 'Test Partner', attendeeEmail: 'partner@example.com' };
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function partnerItem(extra: Record<string, unknown> = {}) {
  return { ticketType: 'speakers-partner', ...ATTENDEE, ...extra };
}

function checkoutOptions(lineItems: unknown[], cookie?: string) {
  return {
    headers: {
      'idempotency-key': randomUUID(),
      ...(cookie ? { cookie } : {}),
    },
    data: { showId: NATIONAL_SHOW_ID, lineItems, termsAccepted: true, ...CURRENT_TERMS_VERSIONS },
  };
}

function validCookie(): string {
  const session = mintSpeakersPartnerSession(E2E_SPEAKERS_PARTNER_PASSWORD, new Date());
  return `${COOKIE}=${session.token}`;
}

test.describe('speakers partner ticket', () => {
  test('checkout without the access cookie answers 400, like an unknown ticket', async ({
    request,
  }) => {
    const response = await request.post(CHECKOUT, checkoutOptions([partnerItem()]));
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Unknown ticketType.' });
  });

  test('a cookie signed with another password is refused', async ({ request }) => {
    const forged = mintSpeakersPartnerSession('some-other-password', new Date());
    const response = await request.post(
      CHECKOUT,
      checkoutOptions([partnerItem()], `${COOKIE}=${forged.token}`)
    );
    expect(response.status()).toBe(400);
  });

  test('two tickets in one order answer 400', async ({ request }) => {
    const response = await request.post(
      CHECKOUT,
      checkoutOptions([partnerItem(), partnerItem()], validCookie())
    );
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain('one ticket per order');
  });

  test('a line item that claims quantity 2 answers 400', async ({ request }) => {
    const response = await request.post(
      CHECKOUT,
      checkoutOptions([partnerItem({ quantity: 2 })], validCookie())
    );
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain('one ticket per order');
  });

  test('the partner ticket cannot ride along with another ticket', async ({ request }) => {
    const response = await request.post(
      CHECKOUT,
      checkoutOptions([partnerItem(), { ...ATTENDEE, ticketType: 'day-visitor' }], validCookie())
    );
    expect(response.status()).toBe(400);
  });

  test('an unset password fails closed: no session is ever valid', () => {
    const session = mintSpeakersPartnerSession(E2E_SPEAKERS_PARTNER_PASSWORD, new Date());
    expect(hasSpeakersPartnerAccess(session.token, {}, new Date())).toBe(false);
    expect(
      hasSpeakersPartnerAccess(session.token, { SPEAKERS_PARTNER_PASSWORD: '' }, new Date())
    ).toBe(false);
  });

  test('a wrong password is refused with 403 and sets no cookie', async ({ request }) => {
    const response = await request.post(AUTH, {
      headers: { 'x-forwarded-for': '198.51.100.10, 10.0.0.1, 10.0.0.2' },
      data: { password: 'definitely-wrong' },
    });
    expect(response.status()).toBe(403);
    expect(response.headers()['set-cookie'] ?? '').not.toContain(COOKIE);
  });

  test('the right password sets an httpOnly access cookie', async ({ request }) => {
    const response = await request.post(AUTH, {
      headers: { 'x-forwarded-for': '198.51.100.11, 10.0.0.1, 10.0.0.2' },
      data: { password: E2E_SPEAKERS_PARTNER_PASSWORD },
    });
    expect(response.status()).toBe(200);
    const setCookie = response.headers()['set-cookie'] ?? '';
    expect(setCookie).toContain(`${COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain('httponly');
  });

  test('a spoofed leading X-Forwarded-For entry does not dodge the rate limit', async ({
    request,
  }) => {
    // The platform appends client, proxy, proxy, so only the trailing hops are trusted.
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt += 1) {
      const response = await request.post(AUTH, {
        headers: { 'x-forwarded-for': `203.0.113.${attempt}, 198.51.100.77, 10.0.0.1, 10.0.0.2` },
        data: { password: 'wrong' },
      });
      statuses.push(response.status());
    }
    expect(statuses.slice(0, RATE_LIMIT_MAX_ATTEMPTS)).toEqual(
      Array(RATE_LIMIT_MAX_ATTEMPTS).fill(403)
    );
    expect(statuses[RATE_LIMIT_MAX_ATTEMPTS]).toBe(429);
  });

  test('the page is noindex, shows only the password gate, and is not in the sitemap or hub', async ({
    page,
    request,
    baseURL,
  }) => {
    const origin = nosBase(baseURL!);
    await page.goto(`${origin}/tickets/speakers-partner`);
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('noindex');
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByText('R950')).toHaveCount(0);

    const sitemap = await request.get(`${origin}/sitemap.xml`);
    expect(await sitemap.text()).not.toContain('speakers-partner');
    const hub = await request.get(`${origin}/tickets`);
    expect(await hub.text()).not.toContain('speakers-partner');
  });
});

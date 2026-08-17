#!/usr/bin/env node
// F11 (ticketing-foundation) — proves buildRecoveryUrl() (lib/recovery-url.ts), the pure
// function sendConfirmationEmail() uses to decide what recovery link (if any) reaches the
// email template, behaves correctly at every boundary the spec cares about: §8.2's deep-link
// shape, a null token producing NO link at all (rather than a broken "?token=null" URL), and
// trailing-slash/URL-encoding correctness.
//
// CREDENTIAL-SAFETY NOTE, load-bearing for this whole file: a recovery token is a bearer
// credential (spec §8.2 — "clients cannot forge or guess the token"). This check uses an
// OBVIOUSLY-FAKE fixture token value throughout (never a real minted one, no real secret is
// available offline anyway), but even so, NO case below prints the token or the built URL to
// console on failure — every failure message states WHAT property broke in the abstract
// (e.g. "did not start with the expected origin") without interpolating the token/URL value
// itself. This is deliberate, matching the same rule real recoveryToken values are held to.
//
// DEFEATING MUTATION this check kills: string-interpolating a possibly-null token directly
// (e.g. `${siteUrl}/tickets/recover?token=${recoveryToken}`) instead of branching on null first
// — that mutation would produce a literal "?token=null" or "?token=undefined" URL, which this
// check's null-token case catches by asserting the return value is `null`, not a string.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f11-qr-confirmation-email/check-recovery-link-presence.mjs

import { buildRecoveryUrl } from '../../../lib/recovery-url.ts';

const failures = [];

// A fixture value with the SHAPE of a real recovery-token.ts token (payload.signature) but
// never a real one — see the file-header credential-safety note.
const FIXTURE_TOKEN = 'ZmFrZS1wYXlsb2FkLXNlZ21lbnQ.deadbeefcafefeed0011223344556677889900aabbccddeeff';
const SITE_URL = 'https://saoc.co.za';

// (1) A real token produces a URL starting with the site origin and the documented path.
{
  const url = buildRecoveryUrl(FIXTURE_TOKEN, SITE_URL);
  if (typeof url !== 'string') {
    failures.push('(1) buildRecoveryUrl returned a non-string for a non-null token — expected a URL string.');
  } else {
    if (!url.startsWith(`${SITE_URL}/tickets/recover?token=`)) {
      failures.push('(1) the returned URL did not start with "<siteUrl>/tickets/recover?token=" — spec §8.2\'s documented deep-link shape.');
    }
    if (!url.includes(encodeURIComponent(FIXTURE_TOKEN))) {
      failures.push('(1) the returned URL did not contain the (URL-encoded) token value at all — the recovery link would not resolve to any order.');
    }
    // Every character of the token must survive the round trip — a truncating or
    // partial-encoding bug would still satisfy the two checks above.
    if (decodeURIComponent(url.split('token=')[1] ?? '') !== FIXTURE_TOKEN) {
      failures.push('(1) decoding the URL\'s token query parameter did not reproduce the exact original token value.');
    }
  }
}

// (2) A null token produces NO link at all — never a string, never "?token=null"/"?token=undefined".
{
  const url = buildRecoveryUrl(null, SITE_URL);
  if (url !== null) {
    failures.push('(2) buildRecoveryUrl(null, siteUrl) did not return null — a missing recoveryToken (the current real-world state, per contracts/golden/ticketing-f10-itn-repin/README.md "Judgement calls") must produce no recovery link, not a broken URL.');
  }
}

// (3) Trailing slash on siteUrl is normalised — a double slash in the path would be a cosmetic
// but real defect (some mail clients/link-preview bots mangle "//tickets").
{
  const url = buildRecoveryUrl(FIXTURE_TOKEN, `${SITE_URL}/`);
  if (typeof url === 'string' && url.includes('.za//tickets')) {
    failures.push('(3) a trailing slash on siteUrl produced a double slash before "/tickets/recover" — siteUrl must be normalised.');
  }
}

// (4) Two DIFFERENT tokens must produce two DIFFERENT URLs — a non-vacuous positive control
// proving the function isn't returning a constant string regardless of input.
{
  const otherToken = 'b3RoZXItZmFrZS1wYXlsb2Fk.0000111122223333444455556666777788889999aaaabbbb';
  const urlA = buildRecoveryUrl(FIXTURE_TOKEN, SITE_URL);
  const urlB = buildRecoveryUrl(otherToken, SITE_URL);
  if (urlA === urlB) {
    failures.push('(4) two different tokens produced the same URL — buildRecoveryUrl must not ignore its token argument.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: buildRecoveryUrl() produces the documented "<siteUrl>/tickets/recover?token=<token>" ' +
    'deep link with the exact token value round-tripping through URL encoding for a real token, ' +
    'returns null (never a broken URL) for a null token, normalises a trailing-slash siteUrl, ' +
    'and is non-vacuously sensitive to its token argument.'
);
process.exit(0);

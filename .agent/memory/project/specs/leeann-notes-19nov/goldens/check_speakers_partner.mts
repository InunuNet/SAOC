// Behavioural check of lib/speakers-partner.ts (fail-closed, constant-time shape, signed expiring session).
// Uses a throwaway test string as the password; never the real secret. Run via tsx with CHECK_ROOT.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.CHECK_ROOT ?? process.cwd();
const sp = await import(pathToFileURL(path.join(root, 'lib/speakers-partner.ts')).href);
const T = 'test-only-value-not-a-secret';
const now = new Date('2027-01-10T10:00:00Z');
const bad: string[] = [];
const expect = (name: string, ok: boolean) => { if (!ok) bad.push(name); };

expect('unset env is null', sp.speakersPartnerPassword({}) === null);
expect('blank env is null', sp.speakersPartnerPassword({ SPEAKERS_PARTNER_PASSWORD: '' }) === null);
expect('env var name', sp.SPEAKERS_PARTNER_PASSWORD_ENV === 'SPEAKERS_PARTNER_PASSWORD');
expect('unset password never matches empty guess', sp.isSpeakersPartnerPasswordCorrect('', null) === false);
expect('unset password never matches any guess', sp.isSpeakersPartnerPasswordCorrect(T, null) === false);
expect('wrong guess refused', sp.isSpeakersPartnerPasswordCorrect('nope', T) === false);
expect('non-string guess refused', sp.isSpeakersPartnerPasswordCorrect(undefined, T) === false);
expect('right guess accepted', sp.isSpeakersPartnerPasswordCorrect(T, T) === true);
const s = sp.mintSpeakersPartnerSession(T, now);
const env = { SPEAKERS_PARTNER_PASSWORD: T };
expect('fresh session valid', sp.hasSpeakersPartnerAccess(s.token, env, now) === true);
expect('session valid within ttl', sp.hasSpeakersPartnerAccess(s.token, env, new Date(now.getTime() + 59 * 60 * 1000)) === true);
expect('session expired after ttl', sp.hasSpeakersPartnerAccess(s.token, env, new Date(now.getTime() + 61 * 60 * 1000)) === false);
expect('session refused when env unset', sp.hasSpeakersPartnerAccess(s.token, {}, now) === false);
expect('session invalid after password rotation', sp.hasSpeakersPartnerAccess(s.token, { SPEAKERS_PARTNER_PASSWORD: T + 'x' }, now) === false);
const [exp, sig] = s.token.split('.');
expect('extended expiry refused', sp.hasSpeakersPartnerAccess(`${Number(exp) + 3600000}.${sig}`, env, now) === false);
expect('garbage refused', sp.hasSpeakersPartnerAccess('abc', env, now) === false);
expect('missing cookie refused', sp.hasSpeakersPartnerAccess(undefined, env, now) === false);
expect('restricted slug', sp.isRestrictedTicketSlug('speakers-partner') === true && sp.isRestrictedTicketSlug('vip') === false);
expect('one per order', sp.SPEAKERS_PARTNER_FIXED_QUANTITY === 1);
expect('rate limit 5 per 15 min', sp.SPEAKERS_PARTNER_RATE_LIMIT_MAX_ATTEMPTS === 5 && sp.SPEAKERS_PARTNER_RATE_LIMIT_WINDOW_MS === 900000);
if (bad.length) { console.error('FAIL: ' + bad.join('; ')); process.exit(1); }
console.log('speakers-partner behaviour ok');

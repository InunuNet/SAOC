// Checks for mission security-hardening. Usage: pnpm exec tsx contracts/checks/security-hardening/check.mts <mode>
// Exits 0 on pass, 1 on fail. No network, no live services. Fixtures are the authority:
// contracts/golden/security-hardening/fixtures/.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const GOLDEN = `${ROOT}contracts/golden/security-hardening/`;
const fails: string[] = [];
const fail = (message: string): number => fails.push(message);
const read = (path: string): string => readFileSync(`${ROOT}${path}`, 'utf8');
const fixture = <T,>(name: string): T => JSON.parse(readFileSync(`${GOLDEN}fixtures/${name}`, 'utf8')) as T;
const same = (label: string, actual: unknown, expected: unknown): void => {
  if (!Object.is(actual, expected)) fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

type Expand = string | number | null | Record<string, unknown> | unknown[];
function expand(value: Expand): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'repeat' in value) {
    return String(value.repeat).repeat(Number(value.times)) + String(value.suffix ?? '');
  }
  return value;
}
function patched(base: Record<string, unknown>, patch: Record<string, Expand>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === '__delete__') delete out[key];
    else out[key] = expand(value);
  }
  return out;
}
const hex = (value: string): Uint8Array => Uint8Array.from(Buffer.from(value, 'hex'));
const strip = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const mustMatch = (label: string, source: string, pattern: RegExp): void => {
  if (!pattern.test(source)) fail(`${label}: pattern ${pattern} not found`);
};
const mustNotMatch = (label: string, source: string, pattern: RegExp): void => {
  if (pattern.test(source)) fail(`${label}: pattern ${pattern} must not be present`);
};
const code = (path: string): string => strip(read(path));

const modes: Record<string, () => Promise<void> | void> = {
  // M2: helper with spoofed first hop
  async xff() {
    const { clientIpFromForwardedFor } = await import('../../../lib/client-ip.ts');
    for (const c of fixture<{ header: string | null; expected: string | null }[]>('xff-cases.json')) {
      same(`xff ${JSON.stringify(c.header)}`, clientIpFromForwardedFor(c.header), c.expected);
    }
  },
  // M2: no direct x-forwarded-for read in app/ and the four routes use the helper
  async xffwiring() {
    const routes = [
      'app/api/vendors/register/route.ts',
      'app/api/vendors/register/verify-code/route.ts',
      'app/api/vendors/[id]/proof-of-payment/route.ts',
      'app/api/vendors/[id]/marketing-asset/route.ts',
    ];
    for (const route of routes) {
      const source = code(route);
      mustMatch(`${route} uses helper`, source, /clientIpFromForwardedFor\(/);
      mustNotMatch(`${route} first-hop read`, source, /split\(','\)\[0\]/);
    }
    const listing = execFileSync('grep', ['-rniI', '--include=*.ts', '--include=*.tsx', 'x-forwarded-for', `${ROOT}app`], { encoding: 'utf8' }).split('\n');
    for (const line of listing.filter(Boolean)) {
      const text = line.slice(line.indexOf(':', line.indexOf(':') + 1) + 1);
      if (/^\s*(\*|\/\/|\/\*)/.test(text)) continue;
      if (!text.includes('clientIpFromForwardedFor')) fail(`direct x-forwarded-for read: ${line.trim()}`);
    }
  },
  // M1/M3: shared limiter constants and behaviour
  async limiter() {
    const limits = await import('../../../lib/public-form-rate-limit.ts');
    const { createAttemptStore, scopeAttemptsToRequest } = await import('../../../lib/newsletter-rate-store.ts');
    const { consumeRateLimit } = await import('../../../lib/newsletter-rate-limit.ts');
    same('max attempts', limits.PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS, 5);
    same('window ms', limits.PUBLIC_FORM_RATE_LIMIT_WINDOW_MS, 3_600_000);
    const store = createAttemptStore(limits.PUBLIC_FORM_RATE_LIMIT_WINDOW_MS);
    const now = new Date('2026-10-24T10:00:00Z');
    const attempt = (key: string) => {
      const scoped = scopeAttemptsToRequest(store);
      return consumeRateLimit({ now, ...scoped }, key, limits.PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS, limits.PUBLIC_FORM_RATE_LIMIT_WINDOW_MS);
    };
    for (let i = 1; i <= 5; i++) same(`attempt ${i} allowed`, attempt('contact:1.1.1.1').allowed, true);
    same('attempt 6 denied', attempt('contact:1.1.1.1').allowed, false);
    same('other key unaffected', attempt('contact:2.2.2.2').allowed, true);
  },
  // M1: contact validation
  async contact() {
    const f = fixture<{ valid: Record<string, unknown>; caps: Record<string, number>; rejects: { label: string; patch: Record<string, Expand> }[]; accepts: { label: string; patch: Record<string, Expand> }[]; nonObjectBodies: unknown[] }>('contact-cases.json');
    const mod = await import('../../../lib/contact-input.ts');
    same('caps', JSON.stringify(mod.CONTACT_FIELD_MAX_LENGTHS), JSON.stringify(f.caps));
    same('valid', mod.validateContactInput(f.valid).ok, true);
    for (const c of f.rejects) same(`reject: ${c.label}`, mod.validateContactInput(patched(f.valid, c.patch)).ok, false);
    for (const c of f.accepts) same(`accept: ${c.label}`, mod.validateContactInput(patched(f.valid, c.patch)).ok, true);
    for (const body of f.nonObjectBodies) same(`non-object ${JSON.stringify(body)}`, mod.validateContactInput(body).ok, false);
  },
  // M1: honeypot + content-length + base64 limit helpers
  async guards() {
    const g = await import('../../../lib/request-guards.ts');
    same('hp filled', g.isHoneypotHit({ _hp: 'x' }), true);
    same('hp empty', g.isHoneypotHit({ _hp: '' }), false);
    same('hp absent', g.isHoneypotHit({}), false);
    same('hp non-string', g.isHoneypotHit({ _hp: 1 }), false);
    same('hp null body', g.isHoneypotHit(null), false);
    same('limit 5MiB', g.base64BodyLimitBytes(5 * 1024 * 1024), 7_006_892);
    const max = 1000;
    same('cl null', g.isBodyWithinLimit(null, max), false);
    same('cl empty', g.isBodyWithinLimit('', max), false);
    same('cl nan', g.isBodyWithinLimit('abc', max), false);
    same('cl float', g.isBodyWithinLimit('10.5', max), false);
    same('cl negative', g.isBodyWithinLimit('-1', max), false);
    same('cl over', g.isBodyWithinLimit('1001', max), false);
    same('cl exact', g.isBodyWithinLimit('1000', max), true);
    same('cl zero', g.isBodyWithinLimit('0', max), true);
  },
  // M5: magic-byte sniff
  async sniff() {
    const f = fixture<{ sniff: { name: string; hex: string; expected: string | null }[]; matches: { hex: string; mime: string; expected: boolean }[] }>('sniff-cases.json');
    const mod = await import('../../../lib/upload-sniff.ts');
    for (const c of f.sniff) same(`sniff ${c.name}`, mod.sniffFileType(hex(c.hex)), c.expected);
    for (const c of f.matches) same(`matches ${c.hex.slice(0, 8)} ${c.mime}`, mod.matchesDeclaredMime(hex(c.hex), c.mime), c.expected);
  },
  // M5: routes check Content-Length before parsing; handlers sniff
  uploadwiring() {
    for (const [route, constant] of [
      ['app/api/vendors/[id]/proof-of-payment/route.ts', 'PROOF_OF_PAYMENT_MAX_BYTES'],
      ['app/api/vendors/[id]/marketing-asset/route.ts', 'MARKETING_ASSET_MAX_BYTES'],
    ] as const) {
      const source = code(route);
      const lengthAt = source.search(/content-length/i);
      const parseAt = source.indexOf('request.json()');
      if (lengthAt < 0) fail(`${route}: no content-length read`);
      if (parseAt < 0 || lengthAt > parseAt) fail(`${route}: content-length must be read before request.json()`);
      mustMatch(`${route} 413`, source, /413/);
      mustMatch(`${route} isBodyWithinLimit`, source, /isBodyWithinLimit\(/);
      mustMatch(`${route} derives limit`, source, new RegExp(`base64BodyLimitBytes\\(\\s*${constant}\\s*\\)`));
    }
    for (const handler of ['lib/vendor-proof-of-payment-handler.ts', 'lib/vendor-marketing-upload-handler.ts']) {
      mustMatch(`${handler} sniffs`, code(handler), /matchesDeclaredMime\(/);
    }
  },
  // M6: csv
  async csv() {
    const { csvField } = await import('../../../lib/csv-field.ts');
    for (const c of fixture<{ input: string; expected: string }[]>('csv-cases.json')) {
      same(`csv ${JSON.stringify(c.input)}`, csvField(c.input), c.expected);
    }
    const route = code('app/api/admin/export-csv/route.ts');
    mustMatch('export-csv imports csvField', route, /from '@\/lib\/csv-field'/);
    mustNotMatch('export-csv escapeField', route, /function escapeField/);
    const newsletter = code('lib/newsletter.ts');
    mustMatch('newsletter imports csvField', newsletter, /csv-field/);
    mustNotMatch('newsletter local csvField', newsletter, /function csvField/);
  },
  // L1: constant-time compare helper and wiring
  async consttime() {
    const { constantTimeStringEqual } = await import('../../../lib/recovery-token.ts');
    same('equal', constantTimeStringEqual('abc123', 'abc123'), true);
    same('different', constantTimeStringEqual('abc123', 'abc124'), false);
    same('shorter', constantTimeStringEqual('abc', 'abc123'), false);
    same('longer', constantTimeStringEqual('abc123', 'abc'), false);
    same('empty vs nonempty', constantTimeStringEqual('', 'a'), false);
    same('case sensitive', constantTimeStringEqual('ABC', 'abc'), false);
    for (const file of ['lib/payments/ozow.ts', 'lib/payments/payfast.ts', 'app/api/revalidate/route.ts', 'app/api/draft/route.ts']) {
      mustMatch(`${file} uses constantTimeStringEqual`, code(file), /constantTimeStringEqual\(/);
    }
    mustNotMatch('ozow plain hash compare', code('lib/payments/ozow.ts'), /!==\s*receivedHash/);
    mustNotMatch('payfast plain signature compare', code('lib/payments/payfast.ts'), /!==\s*receivedSignature/);
    mustNotMatch('revalidate plain compare', code('app/api/revalidate/route.ts'), /provided\s*!==\s*expected/);
    mustNotMatch('draft plain compare', code('app/api/draft/route.ts'), /secret\s*!==\s*expected/);
  },
  // L1: payment diff is comparison-only; payments stay off
  paymentsdiff() {
    const base = execFileSync('git', ['-C', ROOT, 'merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim();
    for (const file of ['lib/payments/ozow.ts', 'lib/payments/payfast.ts']) {
      const diff = execFileSync('git', ['-C', ROOT, 'diff', '-U0', base, '--', file], { encoding: 'utf8' }).split('\n');
      const removed = diff.filter((line) => line.startsWith('-') && !line.startsWith('---'));
      if (removed.length > 2) fail(`${file}: ${removed.length} removed lines, expected only the compare line`);
      for (const line of removed) {
        if (!/receivedHash|receivedSignature/.test(line)) fail(`${file}: unrelated removal: ${line.trim()}`);
      }
    }
    mustMatch('payments stay off', read('lib/ticketing-test-mode.ts'), /const TICKETING_PAYMENTS_LIVE = false;/);
  },
  // L2
  async redirect() {
    const { safeNextPath } = await import('../../../lib/safe-next-path.ts');
    for (const [input, expected] of [['https://evil.example', '/'], ['//evil.example', '/'], ['\\evil', '/'], ['/a\nb', '/'], [null, '/'], ['/orchids/x', '/orchids/x']] as const) {
      same(`safeNextPath ${JSON.stringify(input)}`, safeNextPath(input, '/'), expected);
    }
    const route = code('app/api/draft/route.ts');
    mustMatch('draft uses safeNextPath', route, /safeNextPath\(/);
    mustNotMatch('draft raw redirect', route, /redirect\(redirectTo\)/);
  },
  // L3
  session() {
    const route = code('app/api/admin/session/route.ts');
    const jsonAt = route.indexOf('request.json()');
    if (jsonAt < 0) return void fail('session: request.json() not found');
    mustMatch('session json guarded by try', route.slice(Math.max(0, jsonAt - 60), jsonAt), /try\s*\{/);
    mustMatch('session 400 body', route, /Invalid request body/);
  },
  // M3: events/submit guard
  async events() {
    const f = fixture<{ now: string; valid: Record<string, unknown>; caps: Record<string, number>; rejects: { label: string; field: string; patch: Record<string, Expand> }[]; accepts: { label: string; patch: Record<string, Expand> }[] }>('event-cases.json');
    const mod = await import('../../../lib/event-submission-guard.ts');
    const now = new Date(f.now);
    same('caps', JSON.stringify(mod.EVENT_FIELD_MAX_LENGTHS), JSON.stringify(f.caps));
    same('valid', mod.validateEventSubmission(f.valid, now).ok, true);
    for (const c of f.rejects) {
      const result = mod.validateEventSubmission(patched(f.valid, c.patch), now);
      same(`reject: ${c.label}`, result.ok, false);
      if (!result.ok) same(`reject field: ${c.label}`, result.field, c.field);
    }
    for (const c of f.accepts) same(`accept: ${c.label}`, mod.validateEventSubmission(patched(f.valid, c.patch), now).ok, true);
    for (const body of [null, 'x', 5, []]) same(`non-object ${JSON.stringify(body)}`, mod.validateEventSubmission(body, now).ok, false);
    same('verified true', mod.isVerifiedSubmitter({ email_verified: true }), true);
    same('verified false', mod.isVerifiedSubmitter({ email_verified: false }), false);
    same('verified missing', mod.isVerifiedSubmitter({}), false);
    same('verified string', mod.isVerifiedSubmitter({ email_verified: 'true' }), false);
    same('society found', await mod.hostSocietyExists('s1', async () => true), true);
    same('society missing', await mod.hostSocietyExists('s1', async () => false), false);
    same('society lookup throws', await mod.hostSocietyExists('s1', async () => { throw new Error('boom'); }), false);
    let called = false;
    same('society empty id', await mod.hostSocietyExists('', async () => { called = true; return true; }), false);
    same('empty id skips lookup', called, false);
  },
  eventswiring() {
    const route = code('app/api/events/submit/route.ts');
    mustMatch('revocation check', route, /verifyIdToken\(\s*token\s*,\s*true\s*\)/);
    mustMatch('email verified gate', route, /isVerifiedSubmitter\(/);
    mustMatch('society lookup', route, /hostSocietyExists\(/);
    mustMatch('parameterised groq', route, /_id\s*==\s*\$id/);
    mustMatch('groq params', route, /\{\s*id\b/);
    mustNotMatch('interpolated groq', route, /_id\s*==\s*["'`]?\$\{/);
    mustMatch('validation helper', route, /validateEventSubmission\(/);
    mustMatch('uid key', route, /event-submit:\$\{uid\}/);
    mustMatch('limiter', route, /consumeRateLimit\(/);
    mustMatch('429', route, /429/);
    mustMatch('uses shared limits', route, /PUBLIC_FORM_RATE_LIMIT_/);
  },
  // M1 wiring: contact + apply
  formwiring() {
    for (const [route, key] of [['app/api/contact/route.ts', 'contact:'], ['app/api/vendors/apply/route.ts', 'vendor-apply:']] as const) {
      const source = code(route);
      mustMatch(`${route} ip helper`, source, /clientIpFromForwardedFor\(/);
      mustMatch(`${route} store`, source, /createAttemptStore\(/);
      mustMatch(`${route} per-request scope`, source, /scopeAttemptsToRequest\(/);
      mustMatch(`${route} limiter`, source, /consumeRateLimit\(/);
      mustMatch(`${route} 429`, source, /429/);
      mustMatch(`${route} Retry-After`, source, /Retry-After/);
      mustMatch(`${route} key`, source, new RegExp(key));
      mustMatch(`${route} honeypot`, source, /isHoneypotHit\(/);
      const limitAt = source.indexOf('consumeRateLimit(');
      const parseAt = source.indexOf('request.json()');
      if (limitAt < 0 || parseAt < 0 || limitAt > parseAt) fail(`${route}: rate limit must run before request.json()`);
    }
    mustMatch('contact validation', code('app/api/contact/route.ts'), /validateContactInput\(/);
  },
  // rules files
  rules() {
    same('firestore.rules', read('firestore.rules'), readFileSync(`${GOLDEN}firestore.rules.golden`, 'utf8'));
    same('storage.rules', read('storage.rules'), readFileSync(`${GOLDEN}storage.rules.golden`, 'utf8'));
    const base = execFileSync('git', ['-C', ROOT, 'merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim();
    const changed = execFileSync('git', ['-C', ROOT, 'diff', '--name-only', base, '--', 'firebase.json'], { encoding: 'utf8' }).trim();
    same('firebase.json untouched', changed, '');
  },
  // PR README
  docs() {
    const doc = read('docs/security-hardening.md');
    for (const needle of ['## Out of scope', 'firebase.json', 'Cloud Armor', 'honeypot', '254', 'known limit']) {
      if (!doc.toLowerCase().includes(needle.toLowerCase())) fail(`docs/security-hardening.md missing "${needle}"`);
    }
  },
};

const mode = process.argv[2] ?? '';
const run = modes[mode];
if (!run) {
  console.error(`unknown mode "${mode}"; one of: ${Object.keys(modes).join(', ')}`);
  process.exit(2);
}
try {
  await run();
} catch (error) {
  fail(`threw ${error instanceof Error ? error.message : String(error)}`);
}
if (fails.length > 0) {
  console.error(`FAIL ${mode}:\n  ${fails.join('\n  ')}`);
  process.exit(1);
}
console.log(`PASS ${mode}`);

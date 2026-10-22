// Proves the best-effort failure paths in lib/confirmation-email.ts and lib/order-visit-info.ts
// never throw and never log an error message. Usage: pnpm exec tsx
// contracts/checks/email-shell/check-failure-logging.mts. Exits 0 on pass, 1 on fail.
import { readFileSync } from 'node:fs';

const CANARY = 'CANARY-buyer@example.invalid-secret';
const fails: string[] = [];
const fail = (message: string): number => fails.push(message);

const { sendConfirmationEmail } = await import('../../../lib/confirmation-email.ts');

const hostileNonError = {
  toString() {
    throw new Error(CANARY);
  },
  message: CANARY,
};
const hostileName = Object.create(Error.prototype, {
  name: {
    get() {
      throw new Error(CANARY);
    },
  },
  message: { value: CANARY },
});
const LEAKY_NAME = 'jane.doe@example.invalid sk_live_TOKEN123';
const leakyNameError = Object.assign(new Error('x'), { name: LEAKY_NAME });
const hostileProxy = new Proxy(
  {},
  {
    getPrototypeOf() {
      throw new Error(CANARY);
    },
    get() {
      throw new Error(CANARY);
    },
  }
);

const input = {
  orderId: 'order-fixture',
  buyerEmail: 'buyer@example.invalid',
  buyerName: 'Fixture Buyer',
  recoveryToken: null,
  orderReference: 'ORD-FIXTURE',
  positions: [{ bookingRef: 'SAOC-2027-AAAAAAAAAAAA', attendeeName: 'A Person', ticketType: 'Day Visitor' }],
};

async function capture<T>(run: () => Promise<T>): Promise<{ result: T | null; logs: string[]; threw: boolean }> {
  const logs: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map((a) => JSON.stringify(a)).join(' '));
  };
  try {
    return { result: await run(), logs, threw: false };
  } catch {
    return { result: null, logs, threw: true };
  } finally {
    console.error = original;
  }
}

for (const [label, thrown] of [
  ['non-Error with throwing toString', hostileNonError],
  ['Error with throwing name getter', hostileName],
  ['Error whose name carries an email and a token', leakyNameError],
  ['Proxy that throws on every trap', hostileProxy],
] as const) {
  const sent: Array<{ attachments?: Array<{ contentType: string }> }> = [];
  const run = await capture(() =>
    sendConfirmationEmail(input as never, {
      mailer: { send: async (args: unknown) => void sent.push(args as never) },
      generateQrPngBuffer: async () => Buffer.from('89504e470d0a1a0a', 'hex'),
      siteUrl: 'https://example.invalid',
      loadVisit: async () => ({ pendingLabel: null, venueName: null, venueAddress: null, showDates: null, openingTimes: null }),
      buildTicketPdf: () => {
        throw thrown;
      },
    } as never)
  );
  if (run.threw) fail(`${label}: sendConfirmationEmail threw`);
  if (sent.length !== 1) fail(`${label}: email sent ${sent.length} times, want 1`);
  if ((sent[0]?.attachments ?? []).some((a) => a.contentType === 'application/pdf')) fail(`${label}: PDF attached despite failure`);
  if (run.logs.length === 0) fail(`${label}: failure was not logged`);
  if (run.logs.some((l) => l.includes(CANARY) || l.includes('buyer@'))) fail(`${label}: log leaked the error message`);
  if (run.logs.some((l) => l.includes('jane.doe') || l.includes('sk_live'))) fail(`${label}: log leaked the error name`);
  if (thrown === leakyNameError && !run.logs.some((l) => l.includes('"errorType":"Error"'))) fail(`${label}: label is not the plain "Error"`);
}

// The visit loader's catch cannot be forced without mocking Sanity, so it is checked statically:
// it must log through the shared safe logger and keep no raw console/message/String(error) path.
for (const file of ['lib/order-visit-info.ts', 'lib/confirmation-email.ts']) {
  const source = readFileSync(file, 'utf8');
  if (!source.includes('logFailureSafely(')) fail(`${file}: failure path does not use logFailureSafely`);
  if (/console\.error|error\.message|String\(error\)/.test(source)) fail(`${file}: raw error logging remains`);
}

if (fails.length > 0) {
  for (const f of fails) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log('ok: failure-logging');

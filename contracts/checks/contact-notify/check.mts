// Checks for feature contact-notify. Usage: pnpm exec tsx contracts/checks/contact-notify/check.mts <mode>
// Exits 0 on pass, 1 on fail. Mocked mailer, mocked store, no network, no Firestore, no Resend.
// Interface pinned by .agent/memory/project/specs/backlog-wave-1028/contact-notify/goldens/spec.md
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const fails: string[] = [];
const fail = (message: string): number => fails.push(message);
const read = (path: string): string => readFileSync(`${ROOT}${path}`, 'utf8');
const strip = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const same = (label: string, actual: unknown, expected: unknown): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const SECRET = 're_SECRETKEY_abc123';
const BODY_MARKER = 'BODYMARKER-private-words';
const ALLOWLIST = 'Chair@Example.org, treasurer@example.org ,,';
const EXPECTED_RECIPIENTS = ['chair@example.org', 'treasurer@example.org'];
const SUBMITTED_AT = new Date('2026-10-28T08:00:00.000Z');
const INPUT = {
  submissionId: 'sub_1',
  name: 'Ada Grower',
  email: 'ada@example.org',
  subject: 'Repotting question',
  message: `${BODY_MARKER} hello`,
  submittedAt: SUBMITTED_AT,
  site: 'saoc' as const,
};

type Outcome = 'sent' | 'failed' | 'no_recipients' | null;
interface Status { visitor: Outcome; admin: Outcome }
interface DeliveryDeps {
  sendAcknowledgement(): Promise<void>;
  sendAdminNotice(): Promise<'sent' | 'no_recipients'>;
  recordStatus(status: Status): Promise<void>;
  logError(message: string, context: Record<string, string>): void;
}
type Deliver = (input: typeof INPUT, deps: DeliveryDeps) => Promise<Status>;

function hasUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null || typeof value !== 'object' || value instanceof Date) return false;
  return Object.values(value as Record<string, unknown>).some(hasUndefined);
}

async function loadDeliver(): Promise<Deliver> {
  const mod = (await import(`${ROOT}lib/contact-delivery.ts`)) as { deliverContactEmails?: Deliver };
  if (typeof mod.deliverContactEmails !== 'function') {
    fail('lib/contact-delivery.ts must export deliverContactEmails');
    return async () => ({ visitor: null, admin: null });
  }
  return mod.deliverContactEmails;
}

function harness(opts: { ack?: 'ok' | 'throw'; admin?: 'sent' | 'no_recipients' | 'throw'; record?: 'ok' | 'throw' }) {
  const recorded: Status[] = [];
  const logs: string[] = [];
  let ackCalls = 0;
  let adminCalls = 0;
  const deps: DeliveryDeps = {
    async sendAcknowledgement() {
      ackCalls += 1;
      if (opts.ack === 'throw') throw new Error(`resend 401 key=${SECRET} body=${BODY_MARKER}`);
    },
    async sendAdminNotice() {
      adminCalls += 1;
      if (opts.admin === 'throw') throw new Error(`resend 500 key=${SECRET} body=${BODY_MARKER}`);
      return opts.admin ?? 'sent';
    },
    async recordStatus(status) {
      if (opts.record === 'throw') throw new Error(`firestore down ${SECRET}`);
      recorded.push(JSON.parse(JSON.stringify(status)) as Status);
    },
    logError(message, context) {
      logs.push(JSON.stringify({ message, context }));
    },
  };
  return { deps, recorded, logs, calls: () => ({ ackCalls, adminCalls }) };
}

async function modeAdminRecipients(): Promise<void> {
  // The notice goes to exactly the ADMIN_EMAIL_ALLOWLIST recipients, never the submitter, and reports 'sent'.
  process.env.ADMIN_EMAIL_ALLOWLIST = ALLOWLIST;
  const mod = (await import(`${ROOT}lib/contact-submission-admin-notice.ts`)) as {
    sendContactSubmissionAdminNotice(input: typeof INPUT, deps: { mailer: unknown }): Promise<unknown>;
  };
  const sent: Array<{ to: string; subject: string }> = [];
  const mailer = { async send(args: { to: string; subject: string }) { sent.push({ to: args.to, subject: args.subject }); } };
  const result = await mod.sendContactSubmissionAdminNotice(INPUT, { mailer });
  same('recipients', sent.map((s) => s.to).sort(), EXPECTED_RECIPIENTS);
  if (sent.some((s) => s.to === INPUT.email)) fail('the submitter must never receive the admin notice');
  same('outcome on success', result, 'sent');
  process.env.ADMIN_EMAIL_ALLOWLIST = '';
  const empty = await mod.sendContactSubmissionAdminNotice(INPUT, { mailer });
  same('outcome with empty allowlist', empty, 'no_recipients');
  const subjects = new Set(sent.map((s) => s.subject));
  same('subject restates nothing beyond the existing label', [...subjects], ['New contact message — SAOC']);
}

async function modeResendFailure(): Promise<void> {
  const deliver = await loadDeliver();

  const ackFail = harness({ ack: 'throw' });
  const r1 = await deliver(INPUT, ackFail.deps).catch((e: unknown) => { fail(`visitor email failure must not throw: ${String(e)}`); return null; });
  same('visitor failure status', r1, { visitor: 'failed', admin: 'sent' });
  same('visitor failure recorded', ackFail.recorded.at(-1), { visitor: 'failed', admin: 'sent' });
  same('admin still attempted after visitor failure', ackFail.calls().adminCalls, 1);

  const adminFail = harness({ admin: 'throw' });
  const r2 = await deliver(INPUT, adminFail.deps).catch((e: unknown) => { fail(`admin email failure must not throw: ${String(e)}`); return null; });
  same('admin failure status', r2, { visitor: 'sent', admin: 'failed' });
  same('admin failure recorded', adminFail.recorded.at(-1), { visitor: 'sent', admin: 'failed' });

  const both = harness({ ack: 'throw', admin: 'throw' });
  same('both fail', await deliver(INPUT, both.deps).catch(() => null), { visitor: 'failed', admin: 'failed' });

  const none = harness({ admin: 'no_recipients' });
  same('no recipients', await deliver(INPUT, none.deps).catch(() => null), { visitor: 'sent', admin: 'no_recipients' });

  const ok = harness({});
  same('all sent', await deliver(INPUT, ok.deps).catch(() => null), { visitor: 'sent', admin: 'sent' });
  same('all sent recorded once', ok.recorded.length, 1);

  const storeDown = harness({ ack: 'throw', record: 'throw' });
  const r3 = await deliver(INPUT, storeDown.deps).catch((e: unknown) => { fail(`status-record failure must not throw: ${String(e)}`); return null; });
  same('status computed even if record fails', r3, { visitor: 'failed', admin: 'sent' });
  if (storeDown.logs.length === 0) fail('a status-record failure must be logged');
}

async function modeNoUndefined(): Promise<void> {
  const mod = (await import(`${ROOT}lib/contact-submission.ts`)) as {
    buildContactSubmissionDoc(i: object, site: string, at: Date): Record<string, unknown>;
  };
  const doc = mod.buildContactSubmissionDoc(
    { name: ' Ada ', email: 'Ada@Example.org', subject: 's', message: 'm' }, 'saoc', SUBMITTED_AT);
  if (hasUndefined(doc)) fail('buildContactSubmissionDoc output has an undefined own property');
  same('initial emailDelivery', doc.emailDelivery, { visitor: null, admin: null });

  const deliver = await loadDeliver();
  for (const opts of [{}, { ack: 'throw' as const }, { admin: 'throw' as const }, { admin: 'no_recipients' as const }]) {
    const h = harness(opts);
    await deliver(INPUT, h.deps).catch(() => null);
    for (const status of h.recorded) if (hasUndefined(status)) fail(`recorded status has undefined: ${JSON.stringify(opts)}`);
    if (h.recorded.length !== 1) fail(`status must be recorded exactly once, got ${h.recorded.length} for ${JSON.stringify(opts)}`);
  }
}

async function modeLogs(): Promise<void> {
  const deliver = await loadDeliver();
  const h = harness({ ack: 'throw', admin: 'throw', record: 'throw' });
  await deliver(INPUT, h.deps).catch(() => null);
  if (h.logs.length < 2) fail(`expected a log line per failed operation, got ${h.logs.length}`);
  const joined = h.logs.join('\n');
  for (const forbidden of [SECRET, BODY_MARKER, INPUT.email, INPUT.name, INPUT.message]) {
    if (joined.includes(forbidden)) fail(`log leaks ${forbidden === SECRET ? 'a secret' : 'submission content'}: ${forbidden}`);
  }
  for (const op of ['visitor_email', 'admin_email']) {
    if (!joined.includes(op)) fail(`no log line names operation ${op}`);
  }
  if (!/"exceptionType":"Error"/.test(joined)) fail('log lines must carry exceptionType');
  // The route itself must not log a raw error object or message body.
  const route = strip(read('app/api/contact/route.ts'));
  if (/console\.(error|warn|log)\([^)]*(emailErr|error\b|message\b)/.test(route.replace(/'\[contact\/route\] Error:', error/, ''))) {
    fail('route logs a raw error or message instead of the safe logger');
  }
  if (/emailErr/.test(route)) fail('route still logs the raw visitor email error object');
}

async function modeVisitorUnchanged(): Promise<void> {
  const deliver = await loadDeliver();
  const h = harness({});
  await deliver(INPUT, h.deps).catch(() => null);
  same('visitor ack sent exactly once', h.calls().ackCalls, 1);
  same('admin notice sent exactly once', h.calls().adminCalls, 1);

  const mod = (await import(`${ROOT}lib/contact-submission.ts`)) as {
    sendContactAcknowledgement(i: object, d: { mailer: unknown }): Promise<void>;
  };
  const sent: Array<Record<string, unknown>> = [];
  const mailer = { async send(a: Record<string, unknown>) { sent.push(a); } };
  await mod.sendContactAcknowledgement({ name: 'Ada', email: 'ada@example.org', subject: 's', site: 'saoc' }, { mailer });
  await mod.sendContactAcknowledgement({ name: 'Ada', email: 'ada@example.org', subject: 's', site: 'nos' }, { mailer });
  same('saoc ack subject', sent[0]?.subject, 'We received your message — SAOC');
  same('saoc ack to', sent[0]?.to, 'ada@example.org');
  same('saoc ack has no site override', sent[0]?.site, undefined);
  same('nos ack site', sent[1]?.site, 'nos');
  if (!/NOS|National Orchid Show/i.test(String(sent[1]?.subject))) fail('nos ack subject lost its show title');
}

async function modeRouteWiring(): Promise<void> {
  const route = strip(read('app/api/contact/route.ts'));
  if (!/deliverContactEmails\(/.test(route)) fail('route must call deliverContactEmails');
  if (!/status:\s*HTTP_CREATED/.test(route)) fail('route must still answer 201 on success');
  const idxWrite = route.indexOf('.add(');
  const idxDeliver = route.indexOf('deliverContactEmails(');
  if (idxWrite < 0 || idxDeliver < idxWrite) fail('delivery must run strictly after the submission is stored');
  if (/getVendorAdminNotifyRecipients|process\.env/.test(route)) fail('route must not resolve recipients itself');
  const sender = strip(read('lib/contact-submission-admin-notice.ts'));
  if (!/getAdminNotifyRecipients/.test(sender)) fail('admin notice must resolve recipients via the allowlist helper');
  const delivery = strip(read('lib/contact-delivery.ts'));
  if (/from ['"]firebase-admin/.test(delivery)) fail('contact-delivery must stay pure (no firebase-admin import)');
}

const modes: Record<string, () => Promise<void>> = {
  recipients: modeAdminRecipients,
  failure: modeResendFailure,
  noundefined: modeNoUndefined,
  logs: modeLogs,
  visitor: modeVisitorUnchanged,
  wiring: modeRouteWiring,
};

const mode = process.argv[2] ?? '';
const run = modes[mode];
if (!run) {
  console.error(`unknown mode "${mode}"; expected one of ${Object.keys(modes).join(', ')}`);
  process.exit(2);
}
try {
  await run();
} catch (error) {
  fail(`check threw: ${error instanceof Error ? error.message : String(error)}`);
}
if (fails.length > 0) {
  for (const message of fails) console.error(`FAIL [${mode}] ${message}`);
  process.exit(1);
}
console.log(`PASS [${mode}]`);

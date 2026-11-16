// payment-gateway-settings F1: behavioural checks on the two new pure-ish lib modules and the nav config.
// Run as: npx tsx .agent/memory/project/specs/payment-gateway-settings/checks/check-lib.mts <mode|audit|nav>
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Repo root: PGS_ROOT override (e.g. a worktree), else the checks' own position (6 levels below the root).
const ROOT = process.env.PGS_ROOT ?? resolve(import.meta.dirname, '../../../../../..');
const load = (rel: string) => import(pathToFileURL(resolve(ROOT, rel)).href);
const { parsePaymentMode, SELECTABLE_PAYMENT_MODES, PAYMENT_MODES } = await load('lib/payment-mode.ts');
const { writeAuditedSettingChange } = await load('lib/payment-settings-audit.ts');
const { visibleNavGroups } = await load('lib/admin-nav-config.ts');

const which = process.argv[2];
let failed = false;
function expect(cond: boolean, msg: string) {
  if (!cond) { console.error(`FAIL: ${msg}`); failed = true; }
}

function checkMode() {
  expect(JSON.stringify(SELECTABLE_PAYMENT_MODES) === '["sandbox"]', 'SELECTABLE_PAYMENT_MODES must be exactly ["sandbox"]');
  expect(PAYMENT_MODES.includes('live' as never), 'PAYMENT_MODES must still name live (rendered disabled)');
  for (const ok of [undefined, 'sandbox']) {
    const r = parsePaymentMode(ok);
    expect(r.ok === true && r.mode === 'sandbox', `parsePaymentMode(${String(ok)}) must be ok/sandbox`);
  }
  const live = parsePaymentMode('live');
  expect(live.ok === false && live.reason === 'live-not-available', "parsePaymentMode('live') must be rejected as live-not-available");
  for (const bad of ['LIVE', 'Live', ' live', null, 0, true, {}, [], 'prod', '']) {
    const r = parsePaymentMode(bad);
    expect(r.ok === false, `parsePaymentMode(${JSON.stringify(bad)}) must be rejected`);
  }
}

type Doc = Record<string, unknown>;
function fakeDb(opts: { failAuditWrite?: boolean; seed?: Record<string, Doc> } = {}) {
  const store: Record<string, Doc> = { ...(opts.seed ?? {}) };
  let auditSeq = 0;
  let transactions = 0;
  const collection = (name: string) => ({
    doc: (id?: string) => ({ path: `${name}/${id ?? `auto${++auditSeq}`}`, collection: name }),
  });
  const db = {
    collection,
    async runTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      transactions += 1;
      const pending: Array<[string, Doc]> = [];
      const tx = {
        async get(ref: { path: string }) {
          const d = store[ref.path];
          return { exists: d !== undefined, data: () => d };
        },
        set(ref: { path: string; collection: string }, data: Doc) {
          if (opts.failAuditWrite && ref.collection === 'adminSettingsAudit') throw new Error('audit write failed');
          pending.push([ref.path, data]);
        },
      };
      const result = await fn(tx);
      for (const [p, d] of pending) store[p] = d;
      return result;
    },
  };
  return { db, store, txCount: () => transactions };
}
const ACTOR = { uid: 'uid-1', email: 'owner@example.test' };
function hasUndefined(v: unknown): boolean {
  if (v === undefined) return true;
  if (v && typeof v === 'object' && !(v as { constructor?: { name?: string } }).constructor?.name?.includes('Transform')) {
    return Object.values(v as Doc).some(hasUndefined);
  }
  return false;
}

async function checkAudit() {
  // change: ozow -> payfast
  const a = fakeDb({ seed: { 'adminSettings/activePaymentGateway': { gateway: 'ozow' } } });
  const r = await writeAuditedSettingChange(a.db as never, { setting: 'activePaymentGateway', next: { gateway: 'payfast' }, actor: ACTOR });
  expect(r.changed === true, 'a real change must report changed:true');
  expect(a.txCount() === 1, 'setting and audit must be written in ONE transaction');
  expect((a.store['adminSettings/activePaymentGateway'] as Doc).gateway === 'payfast', 'setting not written');
  const audits = Object.entries(a.store).filter(([p]) => p.startsWith('adminSettingsAudit/'));
  expect(audits.length === 1, `expected exactly 1 audit doc, got ${audits.length}`);
  const e = (audits[0]?.[1] ?? {}) as Doc;
  expect(e.setting === 'activePaymentGateway', 'audit.setting');
  expect(JSON.stringify(e.from) === '{"gateway":"ozow"}', `audit.from was ${JSON.stringify(e.from)}`);
  expect(JSON.stringify(e.to) === '{"gateway":"payfast"}', `audit.to was ${JSON.stringify(e.to)}`);
  expect(e.byUid === 'uid-1' && e.byEmail === 'owner@example.test', 'audit.byUid/byEmail');
  expect(e.mode === 'sandbox', "audit.mode must be 'sandbox'");
  expect(e.at !== undefined && e.at !== null, 'audit.at (server timestamp) missing');
  expect(!hasUndefined(e), 'audit doc has an undefined own-property (Firestore write-safety)');
  expect(!hasUndefined(a.store['adminSettings/activePaymentGateway']), 'setting doc has an undefined own-property');

  // no-op: no audit
  const b = fakeDb({ seed: { 'adminSettings/activePaymentGateway': { gateway: 'ozow' } } });
  const nb = await writeAuditedSettingChange(b.db as never, { setting: 'activePaymentGateway', next: { gateway: 'ozow' }, actor: ACTOR });
  expect(nb.changed === false, 'no-op must report changed:false');
  expect(!Object.keys(b.store).some((p) => p.startsWith('adminSettingsAudit/')), 'no-op must not write an audit entry');

  // first-ever write: from is null-valued, not undefined
  const c = fakeDb();
  await writeAuditedSettingChange(c.db as never, { setting: 'ozowSandboxTestMode', next: { enabled: true }, actor: ACTOR });
  const ce = Object.entries(c.store).find(([p]) => p.startsWith('adminSettingsAudit/'))?.[1] as Doc | undefined;
  expect(JSON.stringify(ce?.from) === '{"enabled":null}', `first write audit.from was ${JSON.stringify(ce?.from)}`);
  expect(JSON.stringify(ce?.to) === '{"enabled":true}', 'first write audit.to');

  // audit failure fails the change
  const d = fakeDb({ failAuditWrite: true, seed: { 'adminSettings/activePaymentGateway': { gateway: 'ozow' } } });
  let threw = false;
  try {
    await writeAuditedSettingChange(d.db as never, { setting: 'activePaymentGateway', next: { gateway: 'payfast' }, actor: ACTOR });
  } catch { threw = true; }
  expect(threw, 'a failed audit write must reject the change');
  expect((d.store['adminSettings/activePaymentGateway'] as Doc).gateway === 'ozow', 'setting changed although audit write failed');

  // unknown setting id is refused
  let refused = false;
  try {
    await writeAuditedSettingChange(fakeDb().db as never, { setting: 'somethingElse' as never, next: { x: 1 }, actor: ACTOR });
  } catch { refused = true; }
  expect(refused, 'unknown setting id must be refused');
}

function checkNav() {
  const none = visibleNavGroups({ canReviewVendors: false, canManagePaymentSettings: false });
  const all = visibleNavGroups({ canReviewVendors: true, canManagePaymentSettings: true });
  const items = (g: typeof none) => g.flatMap((x) => x.items);
  const noneItems = items(none);
  const allItems = items(all);
  expect(noneItems.some((i) => i.label === 'Settings' && i.href === '/admin/settings'), 'Settings must be visible to a capability-less admin');
  expect(!noneItems.some((i) => i.href === '/admin/payments'), 'Payment settings must be hidden without manage-payment-settings');
  expect(allItems.some((i) => i.label === 'Payment settings' && i.href === '/admin/payments'), 'Payment settings item missing for an owner');
  const grp = all.find((g) => g.items.some((i) => i.href === '/admin/payments'));
  expect(grp?.label === 'PAYMENTS', `Payment settings must sit in a group labelled PAYMENTS, got ${grp?.label}`);
  const onlyPay = visibleNavGroups({ canReviewVendors: false, canManagePaymentSettings: true });
  expect(items(onlyPay).some((i) => i.href === '/admin/payments'), 'capability flag alone must reveal Payment settings');
}

if (which === 'mode') checkMode();
else if (which === 'audit') await checkAudit();
else if (which === 'nav') checkNav();
else { console.error('usage: check-lib.mts <mode|audit|nav>'); process.exit(2); }

if (failed) process.exit(1);
console.log(`PASS[${which}]`);

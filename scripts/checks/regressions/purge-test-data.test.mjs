// Regression tests for the test-data purge CLI (go-live-prep F1): a flagged-real reserved order,
// contradictory evidence, and the live project gate all lean towards keeping data. Fixture runs
// only; the live-gate cases are refused before any Firebase import or network call.
//   node --test scripts/checks/regressions/purge-test-data.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = 'scripts/ops/purge-test-data.mts';
const WORK = path.join(ROOT, '.tmp/sandbox/go-live-prep/f1-regress');
const NOW = '2026-11-01T10:00:00.000Z';
const SENTINEL = 'SENTINEL_SECRET_VALUE_regress_7k';
const WRONG_PROJECT = 'some-other-project';

function workDir(name) {
  const dir = path.join(WORK, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cli(args, env = {}) {
  const run = spawnSync('pnpm', ['exec', 'tsx', SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FIREBASE_ADMIN_PRIVATE_KEY: SENTINEL, PURGE_CONFIRM: '', ...env },
  });
  return { code: run.status, out: (run.stdout ?? '') + (run.stderr ?? '') };
}

function dryRun(name, orders, tickets = {}) {
  const dir = workDir(name);
  const snapshot = path.join(dir, 'snapshot.json');
  const collections = { orders, tickets, vendorStandOrders: {} };
  fs.writeFileSync(snapshot, JSON.stringify({ now: NOW, projectId: 'fixture-project', collections }));
  const run = cli(['--fixture', snapshot, '--now', NOW, '--out-dir', dir]);
  assert.equal(run.code, 0, run.out);
  const file = fs.readdirSync(dir).find((n) => n.startsWith('manifest-'));
  return { dir, manifest: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')), out: run.out };
}

const ids = (list) => list.map((d) => d.id);
const selectedIds = (m) => Object.values(m.classes).flatMap((c) => ids(c.docs));
const reservedExpired = (extra) => ({
  showId: 'show-19-2027',
  status: 'reserved',
  expiresAt: '2026-08-18T10:00:00.000Z',
  gateway: 'ozow',
  gatewayPaymentId: null,
  _updateTime: '2026-08-18T09:00:00.000Z',
  ...extra,
});

test('reserved-expired order flagged real with no gateway trace is held, not selected', () => {
  const { manifest } = dryRun('flagged-real', {
    'FLAGGED-REAL': reservedExpired({ issuedInTestMode: false }),
    'PLAIN-LAPSED': reservedExpired({}),
  });
  assert.ok(!selectedIds(manifest).includes('FLAGGED-REAL'));
  assert.deepEqual(ids(manifest.heldBack.reservedExpiredFlaggedReal), ['FLAGGED-REAL']);
  assert.deepEqual(ids(manifest.classes.reservedExpired.docs), ['PLAIN-LAPSED']);
});

test('paid order with explicit false and the sandbox amount is held, its ticket kept', () => {
  const { manifest } = dryRun(
    'contradictory',
    {
      CONTRADICTORY: {
        showId: 'show-19-2027',
        status: 'paid',
        gateway: 'ozow',
        gatewayPaymentId: 'OZ-X',
        issuedInTestMode: false,
        expectedGatewayAmount: 0.01,
        _updateTime: '2026-10-10T08:00:00.000Z',
      },
    },
    {
      'CONTRADICTORY-T': {
        showId: 'show-19-2027',
        ticketType: 'vip',
        status: 'paid',
        orderId: 'CONTRADICTORY',
        _updateTime: '2026-10-10T08:00:00.000Z',
      },
    },
  );
  assert.deepEqual(selectedIds(manifest), []);
  assert.deepEqual(ids(manifest.heldBack.paidWithoutTestEvidence), ['CONTRADICTORY']);
});

test('dry-run reports comp and kept-not-classified counts on stdout', () => {
  const { out } = dryRun('report', {
    'COMP-LAPSED': reservedExpired({ gateway: 'comp', expectedGatewayAmount: 0 }),
    'KEPT-CANCELLED': { status: 'cancelled', _updateTime: '2026-09-01T08:00:00.000Z' },
  });
  assert.match(out, /comp docs in delete set[^\n]*: 1/);
  assert.match(out, /kept, not classified orders: 1 \(read 2\)/);
});

test('live dry-run refuses a project other than saoc-webapp before any read', () => {
  const dir = workDir('live-dry');
  const run = cli(['--out-dir', dir], { FIREBASE_ADMIN_PROJECT_ID: WRONG_PROJECT });
  assert.equal(run.code, 2, run.out);
  assert.match(run.out, /saoc-webapp/);
  assert.deepEqual(fs.readdirSync(dir), []);
  assert.ok(!run.out.includes(SENTINEL));
});

test('live apply refuses a project other than saoc-webapp and writes nothing', () => {
  const { dir, manifest } = dryRun('live-apply', { 'PLAIN-LAPSED': reservedExpired({}) });
  const fresh = path.join(dir, 'fresh-manifest.json');
  const live = { ...manifest, source: 'live', generatedAt: new Date().toISOString() };
  fs.writeFileSync(fresh, JSON.stringify(live));
  const run = cli(['--apply', '--manifest', fresh, '--out-dir', dir], {
    FIREBASE_ADMIN_PROJECT_ID: WRONG_PROJECT,
    PURGE_CONFIRM: manifest.confirmToken,
  });
  assert.equal(run.code, 2, run.out);
  assert.deepEqual(fs.readdirSync(dir).filter((n) => /^(backup-|apply-result-)/.test(n)), []);
});

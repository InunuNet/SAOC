// Gate helper for go-live-prep F1 (purge-test-data). Usage: node check-purge.mjs <dry|refuse|happy|batch|live>
// Runs from the project root. Fixture modes never touch Firestore. `live` is read-only (dry-run only).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SPEC = '.agent/memory/project/specs/go-live-prep/f1-purge/goldens';
const SNAP = `${SPEC}/fixtures/snapshot.json`;
const SCRIPT = 'scripts/ops/purge-test-data.mts';
const WORK = '.tmp/sandbox/go-live-prep/f1';
const SENTINEL = 'SENTINEL_SECRET_VALUE_f1purge_9z';
const NOW = '2026-11-01T10:00:00.000Z';
const PLUS = (min) => new Date(Date.parse(NOW) + min * 60000).toISOString();

const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };
const ok = (m) => console.log('ok: ' + m);
const j = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const canon = (v) => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  : JSON.stringify(v);
const sha = (s) => createHash('sha256').update(s).digest('hex');

function fresh(name) {
  const d = path.join(WORK, name);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function run(args, env = {}) {
  const r = spawnSync('pnpm', ['exec', 'tsx', SCRIPT, ...args], {
    encoding: 'utf8', env: { ...process.env, FIREBASE_PRIVATE_KEY: SENTINEL, PURGE_CONFIRM: '', ...env },
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const manifestIn = (dir) => {
  const f = fs.readdirSync(dir).filter((n) => /^manifest-.*\.json$/.test(n));
  if (f.length !== 1) fail(`expected exactly one manifest in ${dir}, got ${f.length}`);
  return path.join(dir, f[0]);
};
const names = (m) => [
  ...Object.values(m.classes).flatMap((c) => c.docs.map((d) => d.id)),
  ...Object.values(m.heldBack).flatMap((b) => b.map((d) => d.id)),
];
const strip = (m) => {
  const c = structuredClone(m);
  for (const k of ['generatedAt', 'selectionDigest', 'confirmToken']) delete c[k];
  for (const cls of Object.values(c.classes)) cls.docs = cls.docs.map(({ collection, id }) => ({ collection, id })).sort(byId);
  for (const k of Object.keys(c.heldBack)) c.heldBack[k] = c.heldBack[k].map(({ collection, id }) => ({ collection, id })).sort(byId);
  delete c.stockDelta.note;
  c.stockDelta.rows.sort((a, b) => (a.showId + a.ticketType).localeCompare(b.showId + b.ticketType));
  return c;
};
const byId = (a, b) => (a.collection + a.id).localeCompare(b.collection + b.id);

function dry() {
  const dir = fresh('dry');
  const r = run(['--fixture', SNAP, '--now', NOW, '--out-dir', dir]); // no --dry-run: default must be dry-run
  if (r.code !== 0) fail('default invocation exit ' + r.code + '\n' + r.out);
  if (r.out.includes(SENTINEL)) fail('env secret leaked to output');
  const mp = manifestIn(dir);
  const raw = fs.readFileSync(mp, 'utf8');
  if (raw.includes(SENTINEL)) fail('env secret leaked to manifest');
  const m = JSON.parse(raw);
  const extra = fs.readdirSync(dir).filter((n) => !/^manifest-/.test(n));
  if (extra.length) fail('dry-run wrote non-manifest files: ' + extra);
  const want = j(`${SPEC}/expected-manifest.json`); delete want._comment;
  const got = strip(m); const exp = strip(want);
  if (canon(got) !== canon(exp)) fail('manifest differs from golden\nGOT ' + canon(got) + '\nEXP ' + canon(exp));
  ok('manifest equals golden');
  const f = j(`${SPEC}/forbidden-ids.json`);
  const selected = Object.values(m.classes).flatMap((c) => c.docs.map((d) => d.id));
  const bad = f.mustNotBeSelected.filter((id) => selected.includes(id));
  if (bad.length) fail('forbidden ids selected: ' + bad);
  const leaked = f.mustNotAppearAnywhere.filter((id) => names(m).includes(id));
  if (leaked.length) fail('ids must be absent from manifest: ' + leaked);
  const unheld = f.mustBeHeld.filter((id) => !Object.values(m.heldBack).flat().some((d) => d.id === id));
  if (unheld.length) fail('ids missing from heldBack: ' + unheld);
  if (m.selectionDigest !== sha(canon(m.classes))) fail('selectionDigest is not sha256(canonical(classes))');
  if (m.confirmToken !== m.selectionDigest.slice(0, 12)) fail('confirmToken is not digest[0:12]');
  if (!m.classes.reservedExpired.docs.every((d) => d.updateTime)) fail('docs missing updateTime');
  ok('forbidden/held/digest/token');
  const both = run(['--fixture', SNAP, '--now', NOW, '--out-dir', dir, '--dry-run', '--apply']);
  if (both.code !== 2) fail('--dry-run with --apply must exit 2, got ' + both.code);
  const outside = run(['--fixture', SNAP, '--now', NOW, '--out-dir', '/tmp/purge-escape']);
  if (outside.code !== 2) fail('out-dir outside .tmp/sandbox must exit 2, got ' + outside.code);
  ok('flag exclusivity + out-dir containment');
}

function applyArgs(dir, mp, snap, now, extra = []) {
  return ['--apply', '--manifest', mp, '--fixture', snap, '--now', now, '--out-dir', dir, '--fixture-out', path.join(dir, 'after.json'), ...extra];
}
const noEffects = (dir, label) => {
  const bad = fs.readdirSync(dir).filter((n) => /^(backup-|apply-result-|after\.json)/.test(n));
  if (bad.length) fail(`${label}: refused apply left artefacts ${bad}`);
};

function refuse() {
  const dir = fresh('refuse');
  if (run(['--fixture', SNAP, '--now', NOW, '--out-dir', dir]).code !== 0) fail('seed dry-run failed');
  const mp = manifestIn(dir); const m = j(mp); const tok = m.confirmToken;
  const expect = (label, r, code = 3) => {
    if (r.code !== code) fail(`${label}: expected exit ${code}, got ${r.code}\n${r.out}`);
    noEffects(dir, label); ok(label);
  };
  expect('no --manifest', run(['--apply', '--fixture', SNAP, '--now', NOW, '--out-dir', dir, '--fixture-out', path.join(dir, 'after.json')], { PURGE_CONFIRM: tok }), 2);
  expect('missing PURGE_CONFIRM', run(applyArgs(dir, mp, SNAP, PLUS(5))));
  expect('wrong PURGE_CONFIRM', run(applyArgs(dir, mp, SNAP, PLUS(5)), { PURGE_CONFIRM: 'deadbeef0000' }));
  expect('manifest 61 min old', run(applyArgs(dir, mp, SNAP, PLUS(61)), { PURGE_CONFIRM: tok }));
  const tampered = j(mp); tampered.classes.sandboxPaidOrders.docs.pop();
  const tp = path.join(dir, 'tampered.json'); fs.writeFileSync(tp, JSON.stringify(tampered));
  expect('tampered manifest (digest mismatch)', run(applyArgs(dir, tp, SNAP, PLUS(5)), { PURGE_CONFIRM: tok }));
  const edited = j(SNAP); edited.collections.tickets['SELECT-T-3']._updateTime = '2026-11-01T09:59:00.000Z';
  const ep = path.join(dir, 'edited.json'); fs.writeFileSync(ep, JSON.stringify(edited));
  expect('selected doc edited since dry-run', run(applyArgs(dir, mp, ep, PLUS(5)), { PURGE_CONFIRM: tok }));
  const added = j(SNAP);
  added.collections.orders['SELECT-O-LATE'] = { showId: 'show-19-2027', status: 'reserved', expiresAt: '2026-09-01T00:00:00.000Z', gateway: 'ozow', gatewayPaymentId: null, _updateTime: '2026-09-01T00:00:00.000Z' };
  const ap = path.join(dir, 'added.json'); fs.writeFileSync(ap, JSON.stringify(added));
  expect('selection grew since dry-run', run(applyArgs(dir, mp, ap, PLUS(5)), { PURGE_CONFIRM: tok }));
}

function happy() {
  const dir = fresh('happy');
  run(['--fixture', SNAP, '--now', NOW, '--out-dir', dir]);
  const mp = manifestIn(dir); const m = j(mp);
  const r = run(applyArgs(dir, mp, SNAP, PLUS(59)), { PURGE_CONFIRM: m.confirmToken });
  if (r.code !== 0) fail('apply exit ' + r.code + '\n' + r.out);
  if (r.out.includes(SENTINEL)) fail('env secret leaked to output');
  const snap = j(SNAP); const after = j(path.join(dir, 'after.json'));
  const sel = new Set(Object.values(m.classes).flatMap((c) => c.docs.map((d) => `${d.collection}/${d.id}`)));
  for (const [col, docs] of Object.entries(snap.collections)) {
    for (const [id, body] of Object.entries(docs)) {
      const now = after.collections[col]?.[id];
      if (sel.has(`${col}/${id}`) && now !== undefined) fail(`selected doc survived: ${col}/${id}`);
      if (!sel.has(`${col}/${id}`) && canon(now) !== canon(body)) fail(`non-selected doc changed or lost: ${col}/${id}`);
    }
  }
  ok('exactly the selected docs deleted, all others byte-identical');
  const bf = fs.readdirSync(dir).filter((n) => /^backup-.*\.json$/.test(n));
  const rf = fs.readdirSync(dir).filter((n) => /^apply-result-.*\.json$/.test(n));
  if (bf.length !== 1 || rf.length !== 1) fail('expected one backup and one apply-result');
  const braw = fs.readFileSync(path.join(dir, bf[0]), 'utf8'); const b = JSON.parse(braw);
  if (braw.includes(SENTINEL)) fail('secret in backup');
  const bdocs = b.docs ?? [];
  if (bdocs.length !== 13) fail('backup must hold 13 docs, has ' + bdocs.length);
  for (const d of bdocs) {
    const orig = snap.collections[d.collection]?.[d.id];
    if (!orig || canon(d.data) !== canon(orig)) fail(`backup body differs for ${d.collection}/${d.id}`);
  }
  const res = j(path.join(dir, rf[0]));
  if (res.deleted !== 13) fail('deleted != 13: ' + res.deleted);
  if (res.events[0].kind !== 'backup-written') fail('first event must be backup-written');
  if (res.backupSha256 !== sha(braw)) fail('backupSha256 mismatch');
  ok('backup complete and written before first delete');
}

function batch() {
  const dir = fresh('batch');
  const orders = {};
  for (let i = 0; i < 1000; i++) orders[`BULK-${i}`] = { showId: 'show-19-2027', status: 'reserved', expiresAt: '2026-08-18T10:00:00.000Z', gateway: 'ozow', gatewayPaymentId: null, _updateTime: '2026-08-18T09:00:00.000Z' };
  const sp = path.join(dir, 'bulk.json');
  fs.writeFileSync(sp, JSON.stringify({ now: NOW, projectId: 'fixture-project', collections: { orders, tickets: {}, vendorStandOrders: {} } }));
  run(['--fixture', sp, '--now', NOW, '--out-dir', dir]);
  const mp = manifestIn(dir); const m = j(mp);
  if (m.totals.selected !== 1000) fail('bulk selected ' + m.totals.selected);
  const r = run(applyArgs(dir, mp, sp, PLUS(5)), { PURGE_CONFIRM: m.confirmToken });
  if (r.code !== 0) fail('bulk apply exit ' + r.code + '\n' + r.out);
  const res = j(path.join(dir, fs.readdirSync(dir).find((n) => /^apply-result-/.test(n))));
  const sizes = res.events.filter((e) => e.kind === 'batch-commit').map((e) => e.size);
  if (sizes.length < 3 || Math.max(...sizes) > 400 || sizes.reduce((a, b) => a + b, 0) !== 1000) fail('bad batches: ' + sizes);
  ok('1000 deletes in batches ' + sizes.join(','));
}

function live() {
  const dir = fresh('live');
  const r = run(['--dry-run', '--out-dir', dir]);
  if (r.code !== 0) fail('live dry-run exit ' + r.code + '\n' + r.out.slice(0, 600));
  const m = j(manifestIn(dir));
  if (m.source !== 'live' || m.mode !== 'dry-run') fail('live smoke must be source=live mode=dry-run');
  const n = m.classes.reservedExpired.count + m.heldBack.reservedExpiredWithGatewayRef.length;
  if (n < 31) fail(`reserved-expired candidates ${n} < 31`);
  const other = fs.readdirSync(dir).filter((x) => !/^manifest-/.test(x));
  if (other.length) fail('live dry-run wrote ' + other);
  ok(`live read-only dry-run: ${n} reserved-expired candidates, ${m.totals.selected} selected, ${m.totals.heldBack} held`);
}

({ dry, refuse, happy, batch, live }[process.argv[2]] ?? (() => fail('unknown subcommand')))();

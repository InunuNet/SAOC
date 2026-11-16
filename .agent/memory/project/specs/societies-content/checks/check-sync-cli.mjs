// societies-content F1 — drive the real CLI against the fixture store: dry-run shape, apply, idempotency, abort-on-unknown, backup.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const SPEC = '.agent/memory/project/specs/societies-content/goldens';
const BOX = '.tmp/sandbox/societies-content';
const FIX = `${SPEC}/fixtures/existing-docs.json`;
const OUT = `${BOX}/after-apply.json`;
const BACKUP = `${BOX}/fixture-backup`;
const CLI = 'scripts/sync-societies-from-drive.ts';
mkdirSync(BOX, { recursive: true });

function run(args) {
  const r = spawnSync('npx', ['tsx', CLI, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

// 1. Dry-run is the default and matches the golden byte for byte; it writes nothing.
const dry = run(['--fixture-docs', FIX, '--backup-dir', BACKUP]);
assert.equal(dry.code, 0, dry.err);
assert.equal(dry.out, readFileSync(`${SPEC}/dry-run-output.txt`, 'utf8'), 'dry-run output differs from goldens/dry-run-output.txt');
assert.ok(!existsSync(BACKUP) || readdirSync(BACKUP).length === 0, 'dry-run wrote a backup');
for (const l of dry.out.split('\n').filter((x) => /^(PATCH|HIDE) /.test(x))) assert.match(l, /ifRevisionID=\S+/, `no ifRevisionID: ${l}`);

// 2. --apply: backup first (all 21 current docs), then the store holds 21 listed + 16 hidden.
const apply = run(['--apply', '--fixture-docs', FIX, '--fixture-out', OUT, '--backup-dir', BACKUP]);
assert.equal(apply.code, 0, apply.err);
const backups = readdirSync(BACKUP).filter((f) => f.endsWith('.json'));
assert.equal(backups.length, 1, 'expected exactly one backup file');
assert.equal(JSON.parse(readFileSync(`${BACKUP}/${backups[0]}`, 'utf8')).length, 21, 'backup must hold all 21 prior docs');
const after = JSON.parse(readFileSync(OUT, 'utf8'));
const listed = after.filter((d) => d.listed !== false);
const hidden = after.filter((d) => d.listed === false);
assert.equal(after.length, 37);
assert.equal(listed.length, 21);
assert.equal(hidden.length, 16);
const want = JSON.parse(readFileSync(`${SPEC}/disposition.json`, 'utf8'));
assert.deepEqual(hidden.map((d) => d._id).sort(), want.hide.map((h) => h._id).sort());
for (const h of hidden) assert.ok('founded' in h && 'memberCount' in h && h.province, 'hidden doc was otherwise edited');
const cape = after.find((d) => d._id === 'society-cape-orchid-society');
assert.equal(cape.province, 'WC', 'province/region of a patched doc must be left alone');
assert.ok(cape.founded == null && cape.memberCount == null, 'our founded/member estimates must be cleared on a Lee-Ann-sourced doc');
assert.equal(cape.slug.current, 'cape-orchid-society', 'an existing slug must not change');
for (const [id, prov] of [['society-natal-orchid-society', 'KZN'], ['society-east-rand-orchid-society', 'GP'], ['society-border-orchid-society', 'EC'], ['society-eastern-province-orchid-society', 'EC']]) {
  const d = after.find((x) => x._id === id);
  assert.equal(d.province, prov, `${id}: province must be kept`);
  assert.ok(d.founded == null && d.memberCount == null, `${id}: invented founded/memberCount must be cleared`);
}
for (const d of listed) assert.ok(d.founded == null && d.memberCount == null && d.foundedPlaceholder === false && d.memberCountPlaceholder === false, `${d._id}: an estimate survived on a listed doc`);
for (const slug of ['alfred-county-orchid-society', 'lowveld-orchid-group', 'phalaborwa-orchid-society', 'plantae-orchid-group', 'rustenburg-orchid-society', 'wolkberg-orchid-society']) {
  const d = listed.find((x) => x.slug?.current === slug);
  assert.ok(d && d._type === 'society' && d.province == null, `${slug}: missing, or given an inferred province`);
}

// 3. Idempotent: a second run over the result is a no-op, and --apply on it is too.
const again = run(['--fixture-docs', OUT, '--backup-dir', BACKUP]);
assert.equal(again.code, 0, again.err);
assert.ok(again.out.includes('SUMMARY create=0 patch=0 hide=0 noop=37'), again.out);
assert.ok(!/^(CREATE|PATCH|HIDE) /m.test(again.out));

// 4. An unknown society doc (someone added a real one in Studio) aborts with exit 3 and writes nothing.
const odd = JSON.parse(readFileSync(FIX, 'utf8'));
odd.push({ _id: 'society-someone-new', _type: 'society', _rev: 'r-new', name: 'Someone New Orchid Society', slug: { _type: 'slug', current: 'someone-new' } });
writeFileSync(`${BOX}/with-unknown.json`, JSON.stringify(odd));
const OUT2 = `${BOX}/should-not-exist.json`;
const bad = run(['--apply', '--fixture-docs', `${BOX}/with-unknown.json`, '--fixture-out', OUT2, '--backup-dir', BACKUP]);
assert.equal(bad.code, 3, `expected exit 3, got ${bad.code}`);
assert.match(bad.out + bad.err, /UNLISTED society-someone-new/);
assert.ok(!existsSync(OUT2), 'abort must happen before any write');
console.log('PASS sync CLI: dry-run golden, apply, 21 listed / 16 hidden, idempotent, abort-on-unknown');

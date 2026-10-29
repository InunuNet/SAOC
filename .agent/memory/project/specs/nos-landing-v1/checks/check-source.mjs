// check-source: the frozen goldens are faithful to the frozen Drive source, independently of gen-goldens.py.
// Runs with no build and no network. Exit 0 only if every line is classified, every rendered string is a verbatim substring of its
// source line (typos, curly quotes and all), and the source itself is byte-identical to what PROVENANCE.md recorded.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const SPEC = process.env.NLV_SPEC ?? '.agent/memory/project/specs/nos-landing-v1';
const failures = [];
const fail = (m) => failures.push(m);

const raw = readFileSync(`${SPEC}/goldens/sources/content.md`);
const sha = createHash('sha256').update(raw).digest('hex');
const prov = readFileSync(`${SPEC}/goldens/sources/PROVENANCE.md`, 'utf8');
if (!prov.includes(sha)) fail(`content.md sha256 ${sha} is not the one PROVENANCE.md records (source edited after freeze)`);
const manifest = JSON.parse(readFileSync(`${SPEC}/goldens/sources/manifest.json`, 'utf8'));
if (manifest.md5_checksum !== 'fc0c73515c7fb8519ce9b95059ad1dab') fail('manifest md5 is not the pinned Drive revision');
if (manifest.drive_file_id !== '1VIHf90ozX20PleXvzpxl6ztbWPZ4r7A3') fail('manifest drive id is not the landing page document');
const lines = raw.toString('utf8').split('\n');

const cls = JSON.parse(readFileSync(`${SPEC}/goldens/classification.json`, 'utf8'));
const nonBlank = lines.map((s, i) => [i + 1, s]).filter(([, s]) => s.trim()).map(([n]) => n);
const got = cls.lines.map((l) => l.line);
if (JSON.stringify(got) !== JSON.stringify(nonBlank)) fail(`classification covers lines ${got.length}, source has ${nonBlank.length} non-blank lines`);
for (const l of cls.lines) if (!['copy', 'instruction', 'ambiguous'].includes(l.class)) fail(`line ${l.line}: bad class ${l.class}`);
const counts = { copy: 0, instruction: 0, ambiguous: 0 };
for (const l of cls.lines) counts[l.class] += 1;
if (JSON.stringify(counts) !== JSON.stringify(cls.counts)) fail(`counts in classification.json (${JSON.stringify(cls.counts)}) do not match its lines (${JSON.stringify(counts)})`);

const copy = JSON.parse(readFileSync(`${SPEC}/goldens/copy.json`, 'utf8'));
const unitIds = new Set(copy.units.map((u) => u.id));
for (const u of copy.units) {
  const src = lines[u.line - 1] ?? '';
  if (!src.includes(u.raw)) { fail(`${u.id}: raw ${JSON.stringify(u.raw)} is not a substring of source line ${u.line}`); continue; }
  let want = u.raw.replace(/\*/g, '');
  if (u.derive === 'drop-strikethrough') want = want.replace(/\s*~~[^~]+~~/, '');
  else if (u.raw.includes('~')) fail(`${u.id}: contains strikethrough but no derive rule`);
  if (u.text !== want) fail(`${u.id}: text ${JSON.stringify(u.text)} != raw minus markup ${JSON.stringify(want)}`);
  const em = [...u.raw.matchAll(/\*([^*]+)\*/g)].map((m) => m[1]);
  if (JSON.stringify(em) !== JSON.stringify(u.em)) fail(`${u.id}: italics list differs from the source's *...* spans`);
  if (/\s\s/.test(u.text) || u.text !== u.text.trim()) fail(`${u.id}: text has stray whitespace`);
}
for (const l of cls.lines) for (const id of l.units) if (!unitIds.has(id)) fail(`line ${l.line}: unit ${id} not in copy.json`);
const claimed = new Set(cls.lines.flatMap((l) => l.units));
for (const id of unitIds) if (!claimed.has(id)) fail(`unit ${id} is not claimed by any classified line`);
for (const l of cls.lines) if (l.class === 'instruction' && l.units.length) fail(`line ${l.line}: an instruction line carries units`);
// the oddities SAOC queried must be present in the golden exactly as written
const must = [['about-judging', 'can be judges'], ['judging-h2', 'Ten judging groups'], ['stat-2', '13 Judging Groups'], ['stage-3-desc', 'Judging begins on Wednesday at 12pm']];
for (const [id, s] of must) if (!copy.units.find((u) => u.id === id)?.text.includes(s)) fail(`${id}: golden no longer carries ${JSON.stringify(s)}`);
const deferredLines = new Set(copy.deferred.map((d) => d.line));
for (const d of copy.deferred) if (!lines[d.line - 1].includes(d.text)) fail(`${d.id}: not on source line ${d.line}`);
void deferredLines;

for (const x of failures) console.error('FAIL', x);
console.log(failures.length ? `check-source: ${failures.length} failure(s)` : `check-source: ok (${cls.lines.length} lines: ${JSON.stringify(counts)}, ${copy.units.length} units)`);
process.exit(failures.length ? 1 : 0);

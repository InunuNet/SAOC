// A3: the diff against origin/main touches only the audited NOS-lane files, this spec, the doc and the e2e spec; never a SAOC-lane or protected file.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SPEC = '.agent/memory/project/specs/nos-award-entries';
const rows = JSON.parse(readFileSync(`${SPEC}/goldens/exhibitor-audit.json`, 'utf8')).rows;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).split('\n').filter(Boolean);
const base = git('merge-base', 'origin/main', 'HEAD')[0];
const changed = [...new Set([...git('diff', '--name-only', base), ...git('ls-files', '--others', '--exclude-standard')])];
const SAOC_LANE = ['components/newsletter/NewsletterSignup.tsx', 'app/layout.tsx', 'components/sponsors/', 'app/(nos)/national-show/sponsors/page.tsx'];
const PROTECTED = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.claude/', 'execution/', 'test-results/', '.env', 'sanity/', 'content/drive-source/', 'comms.md'];
const allowedFiles = new Set(rows.filter((r) => r.action === 'change').map((r) => r.file));
for (const f of ['app/(nos)/national-show/exhibitors/page.tsx', 'app/(nos)/national-show/award-entries/page.tsx', 'proxy.ts']) allowedFiles.add(f);
const allowedPrefixes = [`${SPEC}/`, 'docs/nos-award-entries.md', 'e2e/nos-award-entries'];
const failures = [];
for (const f of changed) {
  if (SAOC_LANE.some((p) => f === p || f.startsWith(p))) failures.push(`SAOC-lane file in the diff: ${f}`);
  else if (PROTECTED.some((p) => f === p || f.startsWith(p) || f.split('/').pop().startsWith('.env'))) failures.push(`protected file in the diff: ${f}`);
  else if (/\.css$/.test(f)) failures.push(`stylesheet in the diff (no new design; feat/nos-type-tokens owns typography): ${f}`);
  else if (!allowedFiles.has(f) && !allowedPrefixes.some((p) => f.startsWith(p))) failures.push(`file outside the audited set: ${f}`);
}
if (failures.length) { console.error(`check-diff-scope FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`check-diff-scope pass (${changed.length} changed file(s) vs ${base.slice(0, 8)})`);

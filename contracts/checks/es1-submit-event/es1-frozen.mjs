// ES-1 frozen surface. Wave 1 F6 and wave 2 F7 already own these files; ES-1 only repairs the LoginPrompt in
// app/(marketing)/events/submit/page.tsx. The form (including the F7 success panel), the page body, the fixture
// route, the fixture guard, and the whole /api/events tree (so the payload shape and field names) must be
// byte-identical to the base. Base: ES1_BASE (a ref), default 823e6b09 (polish wave 2, PR #98).
// Run as: node contracts/checks/es1-submit-event/es1-frozen.mjs
import { execFileSync } from 'node:child_process';

import { finish, repoRoot } from '../polish-wave-2026-10-25/_lib.mjs';

const FROZEN = [
  'components/events/SubmitEventForm.tsx',
  'components/events/SubmitEventPageBody.tsx',
  'app/events-fixtures/submit/page.tsx',
  'lib/fixture-route-guard.ts',
  'app/api/events/',
];
const base = process.env.ES1_BASE || '823e6b09';
const git = (args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
const failures = [];
try {
  git(['cat-file', '-e', `${base}^{commit}`]);
} catch {
  finish('es1-frozen', [`base ${base} is not a commit in this checkout (set ES1_BASE)`]);
}
const changed = git(['diff', '--name-only', base, '--', ...FROZEN]).split('\n').filter(Boolean);
const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...FROZEN]).split('\n').filter(Boolean);
for (const f of [...changed, ...untracked]) failures.push(`frozen file changed since ${base}: ${f}`);
finish('es1-frozen', failures);

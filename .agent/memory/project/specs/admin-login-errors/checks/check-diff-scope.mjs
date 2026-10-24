// Diff scope: only the login page, its fields, the new module, e2e, docs and this spec may change versus origin/main.
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).split('\n').filter(Boolean);
const changed = new Set([...git('diff', '--name-only', 'origin/main'), ...git('ls-files', '--others', '--exclude-standard')]);
const ALLOWED = [
  /^app\/admin\/login\/(page|LoginFormFields)\.tsx$/,
  /^lib\/admin-login-errors\.ts$/,
  /^e2e\/admin-login[\w-]*\.spec\.ts$/,
  /^docs\/(admin-access|admin-login-errors)\.md$/,
  /^\.agent\/memory\/project\/specs\/admin-login-errors\//,
  /^\.agent\/memory\/(scratch|project\/(learned|backlog))/,
];
const FORBIDDEN = [/^lib\/admin-auth\.ts$/, /^app\/api\/admin\//, /^CLAUDE\.md$/, /^apphosting\.yaml$/, /^package\.json$/, /^pnpm-lock\.yaml$/, /^firestore\.rules$/, /^firebase\.json$/, /^sanity\//, /^app\/globals\.css$/, /^components\//];
const bad = [...changed].filter((f) => FORBIDDEN.some((r) => r.test(f)) || !ALLOWED.some((r) => r.test(f)));
if (bad.length) { console.error(`out-of-scope changes:\n${bad.join('\n')}`); process.exit(1); }
console.log(`diff scope ok (${changed.size} files)`);

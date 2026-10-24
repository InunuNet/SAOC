// Diff scope: the floor is CSS only. Only globals.css, e2e specs, docs, the baseline and this spec may change versus origin/main.
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).split('\n').filter(Boolean);
const changed = new Set([...git('diff', '--name-only', 'origin/main'), ...git('ls-files', '--others', '--exclude-standard')]);
const ALLOWED = [/^app\/globals\.css$/, /^components\/chrome\/SaocLockup\.tsx$/, /^e2e\/[^/]+\.spec\.ts$/, /^docs\/saoc-mono-floor\.md$/, /^\.agent\/memory\/project\/specs\/saoc-mono-floor\//, /^\.agent\/memory\/(scratch|project\/(learned|backlog))/];
const FORBIDDEN = [/^app\/\(nos\)\//, /^components\/nos(-chrome)?\//, /^app\/admin\/\(shell\)\/settings\//, /^lib\/admin-nav-config\.ts$/, /^CLAUDE\.md$/, /^apphosting\.yaml$/, /^package\.json$/];
const bad = [...changed].filter((f) => FORBIDDEN.some((r) => r.test(f)) || !ALLOWED.some((r) => r.test(f)));
if (bad.length) { console.error(`out-of-scope changes:\n${bad.join('\n')}`); process.exit(1); }
console.log(`diff scope ok (${changed.size} files)`);

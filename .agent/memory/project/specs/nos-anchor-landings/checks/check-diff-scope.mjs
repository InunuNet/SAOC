// Diff scope: only the three CSS files, the doc, and this spec may change; no SAOC-lane file, CLAUDE.md, AGENTS.md, .claude, execution or test-results.
import { execFileSync } from 'node:child_process';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const base = git('merge-base', 'HEAD', 'origin/main');
const files = new Set([...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '-o', '--exclude-standard').split('\n')].filter(Boolean));
const ALLOWED = [/^app\/\(nos\)\/national-show\/nos-structure\.css$/, /^components\/nos-chrome\/nos-chrome\.css$/, /^app\/globals\.css$/, /^docs\/nos-anchor-landings\.md$/, /^\.agent\/memory\/project\/specs\/nos-anchor-landings\//, /^\.agent\/memory\/project\/(learned|backlog|reboot)\.md$/];
const FORBIDDEN = [/^components\/sponsors\//, /^app\/\(nos\)\/national-show\/sponsors\/page\.tsx$/, /^components\/newsletter\/NewsletterSignup\.tsx$/, /^app\/layout\.tsx$/, /^(CLAUDE|AGENTS|GEMINI)\.md$/, /^\.claude\//, /^execution\//, /^test-results\//, /(^|\/)\.env/];
let bad = 0;
for (const f of files) {
  if (FORBIDDEN.some((r) => r.test(f))) { console.error(`FORBIDDEN: ${f}`); bad++; }
  else if (!ALLOWED.some((r) => r.test(f))) { console.error(`OUT OF SCOPE: ${f}`); bad++; }
}
console.log(`files changed vs ${base.slice(0, 8)}: ${files.size}, violations: ${bad}`);
process.exit(bad ? 1 : 0);

// nav-focus-underline -- scope guard: only the files this fix owns may differ from main. Run from the project root: node <this file>
// Covers: skip links unchanged, buttons/fields untouched (component files other than the chrome ones are off limits).
import { execFileSync } from 'node:child_process';

if (process.env.CHECK_ROOT) process.chdir(process.env.CHECK_ROOT); // only for running outside the project root (e.g. from another worktree)
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const base = git('merge-base', 'HEAD', 'main');
const changed = new Set([
  ...git('diff', '--name-only', base).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].filter(Boolean));

const ALLOWED = [
  /^components\/chrome\/(Header|MobileMenu|Footer)\.tsx$/,
  /^components\/nos-chrome\/(NosHeader|NosFooter)\.tsx$/,
  /^components\/nos-chrome\/nos-chrome\.css$/,
  /^components\/site-chrome\/(SaocFrame|NosFrame|RouteFocus)\.tsx$/,
  /^app\/globals\.css$/,
  /^lib\/(nav-current|route-focus)\.ts$/,
  /^docs\/nav-focus-underline\.md$/,
  /^e2e\/nav-focus[^/]*$/,
  /^\.agent\/memory\//,
];
const MUST_STAY = [
  'components/chrome/SkipLink.tsx',
  'components/nos-chrome/NosSkipLink.tsx',
  'components/newsletter/NewsletterSignup.tsx',
  'components/chrome/footer-data.ts',
  'components/chrome/nav-config.ts',
  'components/nos-chrome/nos-nav.ts',
];

const failures = [];
for (const f of changed) {
  if (MUST_STAY.includes(f)) failures.push(`${f} must stay unchanged (skip link, form fields and nav data are out of scope)`);
  else if (!ALLOWED.some((re) => re.test(f))) failures.push(`${f} is outside this fix's scope`);
}
if (failures.length) { console.error(`FAIL\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`scope ok (${changed.size} changed paths since ${base.slice(0, 8)})`);

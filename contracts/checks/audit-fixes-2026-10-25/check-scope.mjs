#!/usr/bin/env node
// Scope allow-list: every file changed against origin/main (committed, staged, unstaged, untracked)
// must match one of ALLOWED. Anything else, in particular robots, the launch gate, the testing-mode
// banner and proxy.ts, fails the gate.
import { execFileSync } from 'node:child_process';

const ALLOWED = [
  /^components\/societies\/SocietyExpect\.tsx$/,
  /^components\/nos\/NosHero\.tsx$/,
  /^app\/\(nos\)\/national-show\/(conferences|symposium|workshops|wosa-conference)\/loading\.tsx$/,
  /^app\/\(nos\)\/tickets\/\[slug\]\/loading\.tsx$/,
  /^app\/\(nos\)\/national-show\/\[\.\.\.slug\]\/page\.tsx$/,
  /^app\/\(nos\)\/(layout|not-found)\.tsx$/,
  /^app\/\(nos\)\/national-show\/(layout|not-found)\.tsx$/,
  /^app\/not-found\.tsx$/,
  /^components\/site-chrome\/NosFrame\.tsx$/,
  /^app\/layout\.tsx$/,
  /^components\/chrome\/Footer\.tsx$/,
  /^components\/newsletter\/NewsletterSignup\.tsx$/,
  /^components\/chrome\/SaocLockup\.tsx$/,
  /^app\/sitemap\.ts$/,
  /^lib\/nos-sitemap-routes\.ts$/,
  /^lib\/saoc-sitemap-routes\.ts$/,
  /^lib\/site-hosts\.ts$/,
  /^components\/seo\/JsonLd\.tsx$/,
  /^app\/\(marketing\)\/page\.tsx$/,
  /^app\/\(marketing\)\/societies\/\[slug\]\/page\.tsx$/,
  /^scripts\/generate-image-variants\.mjs$/,
  /^lib\/(image-loader\.ts|image-widths\.json|hero-source-widths\.json)$/,
  /^contracts\/checks\/launch-weekend\/f5\/check-f-config\.mjs$/,
  /^scripts\/checks\/hero-render-check\.mjs$/,
  /^docs\/(image-delivery|audit-fixes-2026-10-25|launch-flip-inventory)\.md$/,
  /^tests\/audit-fixes-2026-10-25\//,
  /^contracts\/checks\/audit-fixes-2026-10-25\//,
  /^\.agent\/memory\//,
];

const gitRaw = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const git = (...args) => gitRaw(...args).trim();
const base = git('merge-base', 'HEAD', 'origin/main');
const changed = new Set(git('diff', '--name-only', base).split('\n').filter(Boolean));
for (const line of gitRaw('status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean)) {
  changed.add(line.slice(3).replace(/^"|"$/g, '').replace(/.* -> /, ''));
}
const outside = [...changed].filter((file) => !ALLOWED.some((re) => re.test(file)));
if (outside.length) {
  console.error('FAIL out-of-scope files:\n  ' + outside.join('\n  '));
  process.exit(1);
}
console.log(`ok: ${changed.size} changed files, all inside the allow-list`);

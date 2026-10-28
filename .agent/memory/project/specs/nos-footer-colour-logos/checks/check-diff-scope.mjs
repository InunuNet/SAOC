// The diff against the branch point may touch only the NOS footer, its two sources, the retired copy, tests that name the footer, the
// doc and this spec dir. Anything in a SAOC-owned lane, CLAUDE.md/AGENTS.md, .claude/, execution/, or any other public/ path fails.
import { execFileSync } from 'node:child_process';

const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim();
const files = new Set([
  ...execFileSync('git', ['diff', '--name-only', base], { encoding: 'utf8' }).split('\n'),
  ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n'),
].filter(Boolean));
const ALLOWED = [
  /^components\/nos-chrome\/NosFooter\.tsx$/,
  /^components\/nos-chrome\/nos-chrome\.css$/,
  /^public\/images\/NOS-2027-logo-full-colour-reversed-vertical\.png$/,
  /^public\/images\/saoc\/lockup\/saoc-lockup-south-african-orchid-council-vertical-colour-on-dark\.png$/,
  /^public\/images\/NOS-2027-logo-reversed-gold-vertical\.png$/,
  /^docs\/nos-footer-colour-logos\.md$/,
  /^docs\/nos-critique-r17\.md$/,
  /^e2e\/nav-followup-a11y\.spec\.ts$/,
  /^scripts\/checks\/footer-render-check\.mjs$/,
  /^\.agent\/memory\/project\/specs\/nos-footer-colour-logos\//,
  /^\.agent\/memory\/project\/(learned|backlog)\.md$/,
  /^test-results\//,
];
const FORBIDDEN_NOTE = 'SAOC lanes: components/newsletter/**, app/layout.tsx, components/sponsors/**, app/(nos)/national-show/sponsors/page.tsx, components/chrome/** (SaocLockup.tsx stays; its dead official-mono branch is a SAOC-lane follow-up)';
// The one permitted edit in components/chrome: SaocLockup.tsx gains `export` on ACCESSIBLE_LABEL (NOS Design ruling 2026-10-28), nothing else.
const LOCKUP = 'components/chrome/SaocLockup.tsx';
if (files.delete(LOCKUP)) {
  const changed = execFileSync('git', ['diff', '-U0', base, '--', LOCKUP], { encoding: 'utf8' }).split('\n').filter((l) => /^[+-][^+-]/.test(l));
  const ok = changed.length === 2 && changed[0].startsWith('-const ACCESSIBLE_LABEL') && changed[1].startsWith('+export const ACCESSIBLE_LABEL') && changed[0].slice(1) === changed[1].slice(8);
  if (!ok) { console.error(`diff scope FAILED: ${LOCKUP} may change only by adding "export" to ACCESSIBLE_LABEL:\n${changed.join('\n')}`); process.exit(1); }
}
const bad = [...files].filter((f) => !ALLOWED.some((re) => re.test(f)));
if (bad.length) { console.error(`diff scope FAILED (${FORBIDDEN_NOTE}):\n- ${bad.join('\n- ')}`); process.exit(1); }
console.log(`diff scope pass (${files.size} files)`);

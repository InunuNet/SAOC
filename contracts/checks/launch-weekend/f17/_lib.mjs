// Shared helpers for the launch-weekend F17 (naming sweep, nav sentence case, hub, footer, sponsors, symposium) checks.
// Run from the implementation worktree root, after `SITE_PUBLIC_LAUNCH=true pnpm run build` (never raw `next build`: the image variants must exist):
//   node --import tsx/esm contracts/checks/launch-weekend/f17/<check>.mjs        (tsx for the .mts render checks)
// Runtime checks reuse the NOS F3 lib: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:<port> against a server you started (ports 3660-3669 only),
// or the lib spawns `next start` on F17_PORT (default 3662). Exit 1 = finding, 2 = infrastructure. cwd = the tree under test.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

process.env.NOS_PORT = process.env.F17_PORT || process.env.NOS_PORT || '3662';
const f3 = await import('../../nos-own-brand-chrome/f3/_f3lib.mjs');

export const { main, openPage, withBrowser, BASE, NOS_ROUTES, norm, sectionPadOf } = f3;

export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f17';
export const readGolden = (name) => JSON.parse(readFileSync(`${GOLDEN_DIR}/${name}`, 'utf8'));
export const T = readGolden('tokens.json');
export const NAMING = readGolden('naming.json');
export const LABELS = readGolden('nav-labels.json');

export const VP = { desktop: { width: 1280, height: 800 }, wide: { width: 1920, height: 1080 }, phone: { width: 390, height: 844 } };
export const HUB = '/national-show';
export const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

// The diff base: F17_BASE_REF pins the commit the dev branched from, else origin/main.
export function baseRef() {
  if (process.env.F17_BASE_REF) return process.env.F17_BASE_REF;
  console.error('INFRA: set F17_BASE_REF to the commit the F17 dev branched from (the spec records origin/main 41a7a08f)');
  process.exit(2);
}
export const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
export const gitLines = (...a) => git(...a).split('\n').filter(Boolean);
export const baseText = (file) => { try { return git('show', `${baseRef()}:${file}`); } catch { return null; } };
export const wsNorm = (t) => t.replace(/\s+/g, ' ').trim();
export const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);
// True when a source line is a pure comment line (the naming scan ignores comments: they are never rendered).
export const isCommentLine = (line) => /^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line);

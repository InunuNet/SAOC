// Diff scope: only the three CSS files, the doc, and this spec may change; no SAOC-lane file, CLAUDE.md, AGENTS.md, .claude, execution or test-results.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
// nos-structure.css: only the doc-variable block, the generic hash-target rules and the sponsor card's rules may change (hunk-level).
const STRUCT = 'app/(nos)/national-show/nos-structure.css';
if (files.has(STRUCT)) {
  const src = readFileSync(STRUCT, 'utf8').split('\n');
  const allowed = [];
  const aStart = src.findIndex((l) => l.includes('/* Sticky values the shared CSS reads'));
  const aEnd = src.findIndex((l) => l.includes("/* One container: the header's own axis"));
  if (aStart >= 0 && aEnd > aStart) allowed.push([aStart + 1, aEnd]);
  const bStart = src.findIndex((l) => l.startsWith('.nos-theme [data-nos-group]'));
  let bEnd = bStart; let seen48 = false;
  for (let i = bStart; i >= 0 && i < src.length; i++) { if (src[i].includes('+ 48px')) seen48 = true; if (seen48 && src[i] === '}') { bEnd = i; break; } }
  if (bStart >= 0) allowed.push([bStart + 1, bEnd + 1]);
  let depth = 0; let start = -1;
  src.forEach((l, i) => {
    if (depth === 0 && l.includes('{')) start = i;
    depth += (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
    if (depth === 0 && start >= 0) { if (src.slice(start, i + 1).join('\n').includes("data-sponsor-enquiry='nos'")) allowed.push([start + 1, i + 1]); start = -1; }
  });
  for (const h of git('diff', '-U0', base, '--', STRUCT).matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const a = Number(h[1]); const n = h[2] === undefined ? 1 : Number(h[2]);
    if (n === 0) continue;
    if (!allowed.some(([x, y]) => a >= x && a + n - 1 <= y)) { console.error(`nos-structure.css hunk outside the permitted blocks: lines ${a}-${a + n - 1}`); bad++; }
  }
}
console.log(`files changed vs ${base.slice(0, 8)}: ${files.size}, violations: ${bad}`);
process.exit(bad ? 1 : 0);

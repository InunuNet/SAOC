// Shared by F18-A10 (scope) and F18-A32 (motion): the R84 motion exception and the keepsake exemption, as pure functions with negative probes.
// Exempt paths (design-cb final ruling): components/tickets/keepsake/ and the F18-KEEPSAKE block of nos-structure.css. There, @keyframes / animation are allowed ONLY inside
// @media (prefers-reduced-motion: no-preference) (or a motion-safe: class) and durations only from the allowlist; everywhere else no animation and only the 150ms duration.
export const KEEPSAKE_DIR = 'components/tickets/keepsake/';
export const STRUCTURE_CSS = 'app/(marketing)/national-show/nos-structure.css';
export const BLOCK_START = 'F18-KEEPSAKE-START';
export const BLOCK_END = 'F18-KEEPSAKE-END';
export const ALLOWED_MS = new Set([120, 150, 200, 300, 360, 1100]);
const NO_PREF = /@media[^{]*prefers-reduced-motion:\s*no-preference/;

// Brace-aware: is each line inside a no-preference @media block, or does it carry a motion-safe: class?
export function guardedLines(src) {
  const stack = [];
  let buf = '';
  return src.split('\n').map((line) => {
    let guarded = stack.some(Boolean) || /\bmotion-safe:/.test(line);
    for (const ch of line) {
      if (ch === '{') { const g = NO_PREF.test(buf); stack.push(g); if (g) guarded = true; buf = ''; }
      else if (ch === '}') { stack.pop(); buf = ''; }
      else if (ch === ';') buf = '';
      else buf += ch;
    }
    buf += ' ';
    return guarded;
  });
}

// The F18-KEEPSAKE block text of nos-structure.css (between its two marker comments), or ''.
export function keepsakeBlock(css) {
  const a = css.indexOf(BLOCK_START); const b = css.indexOf(BLOCK_END);
  return a >= 0 && b > a ? css.slice(a, b) : '';
}
export const isExemptPath = (file, line, blockText) => file.startsWith(KEEPSAKE_DIR) || (file === STRUCTURE_CSS && !!line.trim() && blockText.includes(line));

export function durationsMs(line) {
  const out = [];
  for (const m of line.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)) out.push(Math.round(parseFloat(m[1])*(m[2] === 's' ? 1000 : 1)));
  for (const m of line.matchAll(/\bduration-\[?(\d+)/g)) out.push(Number(m[1]));
  return out;
}

// One added line -> a problem string or null.
export function judgeMotion({ line, guarded, exempt }) {
  const code = line.replace(/\/\*.*?\*\//g, '');
  if (/@keyframes|\banimation(-name)?\s*:|\banimate-/.test(code)) {
    if (!exempt) return 'animation or @keyframes outside components/tickets/keepsake/ and the F18-KEEPSAKE block (R84 allows the hero fan-out only there)';
    if (!guarded) return 'animation or @keyframes outside @media (prefers-reduced-motion: no-preference)';
  }
  if (/transition|animation|duration-/.test(code)) {
    for (const ms of durationsMs(code)) {
      if (!ALLOWED_MS.has(ms)) return `duration ${ms}ms is not in the allowlist {120, 150, 200, 300, 360, 1100}`;
      if (!exempt && ms !== 150) return `duration ${ms}ms outside the keepsake paths (only 150ms there)`;
    }
  }
  return null;
}

// Negative probes: every verdict below must hold, or the check itself is broken.
export function probeMotionRules() {
  const bad = [];
  const want = (name, got, expectProblem) => { if (!!got !== expectProblem) bad.push(`probe "${name}": expected ${expectProblem ? 'a problem' : 'no problem'}, got ${got ?? 'none'}`); };
  want('keyframes unguarded in keepsake', judgeMotion({ line: '@keyframes fan-out { from { opacity: 0; } }', guarded: false, exempt: true }), true);
  want('keyframes guarded in keepsake', judgeMotion({ line: '@keyframes fan-out { from { opacity: 0; } }', guarded: true, exempt: true }), false);
  want('animation guarded in keepsake', judgeMotion({ line: 'animation: fan-out 1100ms ease both;', guarded: true, exempt: true }), false);
  want('500ms in keepsake', judgeMotion({ line: 'transition: filter 500ms ease;', guarded: true, exempt: true }), true);
  want('360ms in keepsake', judgeMotion({ line: 'transition: transform 360ms ease;', guarded: false, exempt: true }), false);
  want('300ms fan hover in keepsake', judgeMotion({ line: 'transition: filter 300ms ease;', guarded: false, exempt: true }), false);
  want('animation guarded outside keepsake', judgeMotion({ line: 'animation: fan-out 1100ms ease both;', guarded: true, exempt: false }), true);
  want('360ms outside keepsake', judgeMotion({ line: 'transition: transform 360ms ease;', guarded: true, exempt: false }), true);
  want('150ms outside keepsake', judgeMotion({ line: 'transition: color 150ms;', guarded: false, exempt: false }), false);
  const g = guardedLines('.a { animation: x 1s; }\n@media (prefers-reduced-motion: no-preference) {\n  .b { animation: y 1s; }\n}\n.c { animation: z 1s; }');
  if (g.join() !== 'false,true,true,true,false') bad.push(`probe "guardedLines": got ${g.join()}`);
  return bad;
}

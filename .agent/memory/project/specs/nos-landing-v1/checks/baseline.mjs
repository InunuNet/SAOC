// The hub page as origin/main has it at gate time. SAOC's What to Expect v1.2 PR changes HOURS and CLOSING on main before the dev
// starts, so the frozen CLOSING in copy.json is only the value at 98aa1da1; the retired set must also carry whatever main says then.
import { execFileSync } from 'node:child_process';

const PAGE = 'app/(nos)/national-show/page.tsx';

export function baselineConst(name, ref = 'origin/main') {
  let src;
  try { src = execFileSync('git', ['show', `${ref}:${PAGE}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
  const m = new RegExp(`^const ${name} = (['"])(.*)\\1;$`, 'm').exec(src);
  return m ? m[2].replace(/\\'/g, "'").replace(/\\"/g, '"') : null;
}

/** copy.json with the retired set extended by main's current CLOSING (when it differs from the frozen one). */
export function withBaseline(copy) {
  const closing = baselineConst('CLOSING');
  const retired = [...copy.retired];
  if (closing && !retired.some((r) => r.text === closing)) retired.push({ id: 'old-closing-main', text: closing, why: 'main\'s CLOSING at gate time (WTE v1.2 may have changed it); L131 replaces it (D5)' });
  return { ...copy, retired };
}

#!/usr/bin/env node
// F18-A32 (F18b, R84, the single motion exception to R28 on NOS routes).
// STATIC: across app/ and components/ (css, tsx), every @keyframes outside the base tree is named fan-out or fan-up and sits inside @media (prefers-reduced-motion: no-preference); every added line that
//   carries an animation, the hover lift (translateY(-5px)) or the press (scale(0.98)) (a plain transition duration is A10's allowlist, not a motion) is inside such a block or carries a motion-safe: class; the only animation names used are
//   fan-out / fan-up; no other @keyframes is added anywhere on a NOS surface.
// RUNTIME (public build, hub /national-show/tickets): with reducedMotion "reduce" the fan runs NO animation and the cards already stand in the fanned (final) state (distinct rotations at >=701); with
//   "no-preference" the fan cards run exactly the fan-out (>=701) or fan-up (<=700) animation, 1.1s.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 F18_BASE_REF=<sha> node --import tsx/esm contracts/checks/launch-weekend/f18/check-w-motion.mjs   (cwd = implementation worktree)
import { readFileSync } from 'node:fs';
import { main, withBrowser, BASE, httpAuth, baseRef, git, gitLines, readText } from './_lib.mjs';
import { guardedLines, probeMotionRules } from './motion-rules.mjs';

const M = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-tokens.json', 'utf8')).motion;
const NAMES = new Set(M.allowedKeyframes);

await main('F18-A32 R84 motion exception', async (r) => {
  for (const p of probeMotionRules()) r.fail(p);
  const base = baseRef();
  const files = [...new Set([...gitLines('diff', '--name-only', `${base}...HEAD`), ...gitLines('diff', '--name-only', 'HEAD'), ...gitLines('ls-files', '--others', '--exclude-standard')])].filter((f) => /^(app|components)\/.*\.(css|tsx)$/.test(f));
  const baseKeyframes = new Set(gitLines('ls-tree', '-r', '--name-only', base).filter((f) => /^(app|components)\/.*\.(css|tsx)$/.test(f)).flatMap((f) => { try { return [...git('show', `${base}:${f}`).matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]); } catch { return []; } }));
  let sawFan = false;
  for (const f of files) {
    const src = readText(f); if (src === null) continue;
    const guard = guardedLines(src);
    src.split('\n').forEach((line, i) => {
      const code = line.replace(/\/\*.*?\*\//g, '').replace(/^\s*\/\/.*$/, '');
      const tag = `${f}:${i + 1}`;
      for (const m of code.matchAll(/@keyframes\s+([\w-]+)/g)) {
        if (baseKeyframes.has(m[1])) continue;
        if (!NAMES.has(m[1])) r.fail(`${tag}: new @keyframes "${m[1]}": only ${[...NAMES].join(' / ')} are allowed on NOS (R84)`);
        else sawFan = true;
      }
      const motion = /\banimation(-name)?\s*:|\banimate-|translateY\(\s*-5px\)|-translate-y-\[5px\]|scale\(\s*0?\.98\s*\)|\bscale-\[?0?\.98/.test(code);
      if (motion && !guard[i] && !/^\s*@keyframes/.test(code)) {
        // a line of a @keyframes body or of a base-tree animation is not ours to judge
        if (!/^\s*(from|to|\d+%)\b/.test(code) && !baseKeyframesUse(code)) r.fail(`${tag}: motion outside @media (prefers-reduced-motion: no-preference) / motion-safe: "${code.trim().slice(0, 100)}"`);
      }
      for (const m of code.matchAll(/\banimation(?:-name)?\s*:\s*([\w-]+)/g)) if (!NAMES.has(m[1]) && !baseKeyframes.has(m[1]) && m[1] !== 'none') r.fail(`${tag}: animation "${m[1]}" is not fan-out / fan-up`);
    });
  }
  if (!sawFan) r.fail('no @keyframes fan-out / fan-up found in the diff: the hero fan-out (R84) is missing');

  function baseKeyframesUse(code) { return [...code.matchAll(/\banimation(?:-name)?\s*:\s*([\w-]+)/g)].some((m) => baseKeyframes.has(m[1])); }

  await withBrowser(async (browser) => {
    for (const [mode, width] of [['reduce', 1280], ['no-preference', 1280], ['no-preference', 390]]) {
      const ctx = await browser.newContext({ reducedMotion: mode, viewport: { width, height: width === 390 ? 844 : 800 }, extraHTTPHeaders: httpAuth() });
      const page = await ctx.newPage();
      const res = await page.goto(`${BASE}/national-show/tickets`, { waitUntil: 'domcontentloaded' });
      if (!res || res.status() !== 200) { r.fail(`hub @${mode}/${width}: HTTP ${res?.status()}`); await ctx.close(); continue; }
      await page.waitForSelector('[data-nos-ticket-fan] [data-fan-link]', { timeout: 15000 }).catch(() => {});
      const m = await page.evaluate(() => [...document.querySelectorAll('[data-nos-ticket-fan] [data-fan-link]')].map((l) => {
        const anims = []; const transforms = [];
        for (let e = l; e; e = e.parentElement) {
          for (const a of e.getAnimations()) anims.push({ name: a.animationName ?? '', ms: Number(a.effect?.getTiming?.().duration ?? 0) });
          const t = getComputedStyle(e).transform; if (t && t !== 'none') transforms.push(t);
          if (e.matches('[data-nos-ticket-fan]')) break;
        }
        return { anims, transforms };
      }));
      const tag = `hub @${mode}/${width}`;
      if (m.length !== 4) { r.fail(`${tag}: ${m.length} fan cards, want 4`); await ctx.close(); continue; }
      const named = m.flatMap((c) => c.anims.filter((a) => a.name));
      if (mode === 'reduce') {
        if (named.length) r.fail(`${tag}: reduced motion still runs ${[...new Set(named.map((a) => a.name))].join(', ')}`);
        if (m.some((c) => !c.transforms.length)) r.fail(`${tag}: reduced motion must show the final fanned state, a card has no transform`);
      } else {
        const want = width >= 701 ? 'fan-out' : 'fan-up';
        for (const [i, c] of m.entries()) {
          const a = c.anims.find((x) => x.name === want);
          if (!a) r.fail(`${tag}: card ${i + 1} does not run ${want}`);
          else if (Math.abs(a.ms - 1100) > 20) r.fail(`${tag}: card ${i + 1} ${want} lasts ${a.ms}ms, want 1100`);
        }
        const other = named.filter((a) => a.name !== want);
        if (other.length) r.fail(`${tag}: other animations on the fan: ${[...new Set(other.map((a) => a.name))].join(', ')}`);
      }
      await ctx.close();
    }
  });
});

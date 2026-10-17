// F12-A13 - the real UtilityBar module, server-rendered. The default (SAOC) output is byte-identical to the base version of the file;
// the nos variant differs ONLY in the show pill (label "saoc.co.za", href "/", same className as the pill it replaces).
// Run: pnpm exec tsx contracts/checks/launch-weekend/f12/check-h-utility-render.mts   (F12_BASE_REF or the F3 merge-base supplies the base)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { UtilityBar } from '../../../../components/chrome/UtilityBar';

const problems: string[] = [];
let base = process.env.F12_BASE_REF ?? '';
if (!base) {
  for (const ref of ['feat/nos-f3-hub-tickets', 'origin/main']) {
    try { base = execFileSync('git', ['merge-base', 'HEAD', ref], { encoding: 'utf8' }).trim(); break; } catch { /* next ref */ }
  }
}
const src = execFileSync('git', ['show', `${base}:components/chrome/UtilityBar.tsx`], { encoding: 'utf8' });
mkdirSync('.tmp/sandbox/f12-utility', { recursive: true });
const baseFile = '.tmp/sandbox/f12-utility/UtilityBarBase.tsx';
// the generated file compiles with the classic JSX runtime, so it needs React in scope on a clean checkout
writeFileSync(baseFile, /import\s+React\b/.test(src) ? src : `import React from 'react';\n${src}`);
const BaseBar = (await import(pathToFileURL(`${process.cwd()}/${baseFile}`).href)).UtilityBar as typeof UtilityBar;
unlinkSync(baseFile);

const show = { edition: 19, showDate: '2027-09-23' } as unknown as Parameters<typeof UtilityBar>[0]['show'];
const render = (C: unknown, props: object) => renderToStaticMarkup(createElement(C as (p: object) => ReturnType<typeof UtilityBar>, props));
const saocBase = render(BaseBar, { show });
if (render(UtilityBar, { show }) !== saocBase) problems.push('default UtilityBar output differs from the base version (SAOC pages must be byte-identical)');
if (render(UtilityBar, { show, variant: 'saoc' }) !== saocBase) problems.push('variant="saoc" output differs from the base version');
const nos = render(UtilityBar, { show, variant: 'nos' });
// v4 decision #2 (nos-critique-r6 f9) supersedes F12-A13's nos render: the NOS variant renders nothing.
if (nos !== '') problems.push(`nos variant must render nothing (no utility bar on NOS pages), got: ${nos.slice(0, 80)}`);

if (problems.length) { console.error(`FAIL F12-A13 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F12-A13 utility bar render');

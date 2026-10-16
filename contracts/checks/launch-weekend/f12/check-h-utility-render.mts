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
writeFileSync(baseFile, src);
const BaseBar = (await import(pathToFileURL(`${process.cwd()}/${baseFile}`).href)).UtilityBar as typeof UtilityBar;
unlinkSync(baseFile);

const show = { edition: 19, showDate: '2027-09-23' } as unknown as Parameters<typeof UtilityBar>[0]['show'];
const render = (C: unknown, props: object) => renderToStaticMarkup(createElement(C as (p: object) => ReturnType<typeof UtilityBar>, props));
const saocBase = render(BaseBar, { show });
if (render(UtilityBar, { show }) !== saocBase) problems.push('default UtilityBar output differs from the base version (SAOC pages must be byte-identical)');
if (render(UtilityBar, { show, variant: 'saoc' }) !== saocBase) problems.push('variant="saoc" output differs from the base version');
const nos = render(UtilityBar, { show, variant: 'nos' });

const pillBase = /<a\b[^>]*href="\/national-show"[^>]*>[^<]*<\/a>/.exec(saocBase)?.[0];
if (!pillBase) problems.push('could not find the show pill in the base markup');
else {
  const baseTokens = (/class="([^"]*)"/.exec(pillBase)?.[1] ?? '').split(/\s+/).filter(Boolean);
  const GATING = (t: string) => t === 'hidden' || /^min-\[[^\]]+\]:(inline|block|flex)/.test(t) || /^(sm|md|lg|xl):(inline|block|flex)/.test(t);
  const DISPLAY = (t: string) => ['inline-block', 'inline-flex', 'inline', 'block', 'flex'].includes(t);
  const nosPillRe = /<a\b[^>]*href="\/"[^>]*>saoc\.co\.za<\/a>/;
  const nosPill = nosPillRe.exec(nos)?.[0];
  if (!nosPill) problems.push('nos variant has no <a href="/">saoc.co.za</a> pill');
  else {
    const nosTokens = (/class="([^"]*)"/.exec(nosPill)?.[1] ?? '').split(/\s+/).filter(Boolean);
    if (nosTokens.some(GATING)) problems.push(`the saoc.co.za pill is still width-gated (${nosTokens.filter(GATING).join(' ')}); it must show at every width`);
    if (!nosTokens.some(DISPLAY)) problems.push('the saoc.co.za pill has no display class (inline-block expected)');
    const want = baseTokens.filter((t) => !GATING(t) && !DISPLAY(t)).sort().join(' ');
    const got = nosTokens.filter((t) => !GATING(t) && !DISPLAY(t)).sort().join(' ');
    if (want !== got) problems.push(`the saoc.co.za pill style differs from the replaced pill: "${got}" vs "${want}"`);
    const expected = nos.replace(nosPill, pillBase);
    const rest = (h: string) => h.replace(/<a\b[^>]*href="\/(national-show)?"[^>]*>[^<]*<\/a>/, '<PILL/>');
    if (rest(nos) !== rest(saocBase)) problems.push('nos variant differs from the SAOC bar in more than the pill (markup, tokens and styles must be reused)');
    void expected;
  }
}
if (/National Show/.test(nos)) problems.push('nos variant still contains "National Show"');
if (!nos.includes('href="mailto:info@saoc.co.za"') || !nos.includes('Join a society') || !nos.includes('href="/societies"')) problems.push('nos variant lost the email or "Join a society"');

if (problems.length) { console.error(`FAIL F12-A13 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F12-A13 utility bar render');

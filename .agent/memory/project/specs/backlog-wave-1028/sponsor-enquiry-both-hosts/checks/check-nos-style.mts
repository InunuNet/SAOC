// sponsor-enquiry-both-hosts, NOS Design ruling (2026-10-28), static half. The NOS enquiry card, its tokens and its anchor offset
// are declared in the NOS stylesheets, scoped to [data-sponsor-enquiry='nos'] so the shared form (and the SAOC page) is untouched.
// Rulings pinned (values are NOS Design's, not ours):
//   card    : background #F3F2D6 (--bone), radius 16, padding 32 (24 below 768), --shadow-sm; fields column max-width 640
//   fields  : labels Karla 500 14px ink, no tracking, no caps; inputs 1px --rule border, radius 8, min-height 48; 2px violet focus ring
//   submit  : the NOS primary Button look (bg --primary, text --ivory, Karla 700 14px uppercase, min-height 50, --radius-button)
//   heading : NOS doc-h2 role (the section is rendered inDocument)
//   anchor  : NOS Design anchor ruling (2026-10-28, final): the NOS host zeroes the root scroll-padding THROUGH THE VARIABLE (--scroll-padding-top: 0 on html
//             when the NOS chrome is present, at every width), so every NOS scroll-margin assumes zero; the card's scroll-margin-top is 121px at >=780, 24px below.
//             No header-height token exists in the repo (only the --doc-* ones), so 121 is the declared literal; a token is preferred if one appears.
//   SAOC    : the SAOC root scroll-padding (globals.css, --scroll-padding-top 6.5rem consumed by html) is unchanged
// The live scroll position and computed styles are proved by check-deployed-render.mjs (post-deploy); this half is the declared values.
// Method: a tiny flat-CSS reader (no nesting) evaluates the cascade at 390, 699, 700, 767, 768 and 1440 wide, last declaration wins
// (specificity is not modelled: rules must be unlayered so they beat the layered Tailwind utilities, which is asserted).
// Run as: pnpm exec tsx <this file> (from the checkout under test)
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SponsorEnquirySection } from '@/components/sponsors/SponsorEnquirySection';

const failures: string[] = [];
const expect = (ok: boolean, label: string) => { if (!ok) failures.push(label); };

interface Rule { selector: string; decls: Map<string, string>; media: string[]; layered: boolean; }
const DIR = 'app/(nos)/national-show';

function splitTop(text: string, sep: string): string[] {
  const out: string[] = []; let depth = 0; let quote = ''; let cur = '';
  for (const ch of text) {
    if (quote) { cur += ch; if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}
function matchBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) { if (text[i] === '{') depth += 1; if (text[i] === '}') { depth -= 1; if (depth === 0) return i; } }
  return text.length;
}
function parse(text: string, media: string[], layered: boolean, out: Rule[], nested: string[]): void {
  let i = 0;
  while (i < text.length) {
    const brace = text.indexOf('{', i); const semi = text.indexOf(';', i);
    if (brace === -1) break;
    if (semi !== -1 && semi < brace) { i = semi + 1; continue; }
    const prelude = text.slice(i, brace).trim(); const end = matchBrace(text, brace); const body = text.slice(brace + 1, end);
    i = end + 1;
    if (prelude.startsWith('@media')) parse(body, [...media, prelude.slice(6).trim()], layered, out, nested);
    else if (prelude.startsWith('@layer')) parse(body, media, true, out, nested);
    else if (prelude.startsWith('@supports')) parse(body, media, layered, out, nested);
    else if (prelude.startsWith('@')) continue;
    else {
      if (body.includes('{')) { nested.push(prelude); continue; }
      const decls = new Map<string, string>();
      for (const d of splitTop(body, ';')) { const c = d.indexOf(':'); if (c > 0) decls.set(d.slice(0, c).trim().toLowerCase(), d.slice(c + 1).trim().replace(/\s*!important$/i, '').replace(/\s+/g, ' ')); }
      for (const sel of splitTop(prelude, ',')) out.push({ selector: sel.replace(/\s+/g, ' '), decls, media, layered });
    }
  }
}
const rules: Rule[] = []; const nested: string[] = [];
const chromeRules: Rule[] = []; const chromeNested: string[] = [];
parse(readFileSync('components/nos-chrome/nos-chrome.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), [], false, chromeRules, chromeNested);
for (const f of readdirSync(DIR).filter((n) => n.endsWith('.css')).sort()) parse(readFileSync(`${DIR}/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), [], false, rules, nested);

function mediaMatches(media: string[], width: number): boolean {
  return media.every((m) => {
    const conds = [...m.matchAll(/\(\s*(min|max)-width\s*:\s*([\d.]+)px\s*\)/g)];
    if (conds.length === 0) return false;
    return conds.every(([, kind, px]) => (kind === 'min' ? width >= Number(px) : width <= Number(px)));
  });
}

const NOS_ATTR = /\[data-sponsor-enquiry\s*=\s*["']?nos["']?\]/;
const CONTROL = String.raw`(?:input|select|textarea)(?:\[[^\]]*\]|:not\([^)]*\))*`;
type Kind = 'card' | 'anchor' | 'fields' | 'input' | 'focus' | 'label' | 'labelBare' | 'consent' | 'status' | 'submit' | 'other';
function classify(selector: string): Kind {
  if (/^(?:\.nos-theme\s+)?(?:section)?#enquire$/.test(selector)) return 'anchor';
  const m = NOS_ATTR.exec(selector);
  if (!m) return 'other';
  const tail = selector.slice(m.index + m[0].length).trim().replace(/^>\s*/, '');
  if (tail === '') return 'card';
  if (new RegExp(`^(?:${CONTROL}|:is\\(\\s*input\\s*,[^)]*\\)(?:\\[[^\\]]*\\]|:not\\([^)]*\\))*)$`).test(tail)) return 'input';
  if (new RegExp(`^(?:${CONTROL}|:is\\([^)]*\\)|\\*)?:focus-visible$`).test(tail)) return 'focus';
  if (/^label(?:\[for=["']?se-consent["']?\]|:has\([^)]*(?:se-consent|checkbox)[^)]*\))$/.test(tail)) return 'consent';
  if (/^label:not\([^)]*(?:se-consent|checkbox)[^)]*\)$/.test(tail)) return 'label';
  if (/^label(?::not\([^)]*\))?$/.test(tail)) return 'labelBare';
  if (/^(?:div)?\[role=["']?status["']?\]$/.test(tail)) return 'status';
  if (/^button(?:\[type=["']?submit["']?\])?$/.test(tail)) return 'submit';
  return 'fields';
}

function longhands(prop: string, value: string): Array<[string, string]> {
  if (prop === 'padding' || prop === 'margin') {
    const v = value.split(' '); const [t, r = t, b = t, l = r] = v;
    return [[`${prop}-top`, t ?? ''], [`${prop}-right`, r ?? ''], [`${prop}-bottom`, b ?? ''], [`${prop}-left`, l ?? '']];
  }
  if (prop === 'border') {
    const tok = splitTop(value, ' '); const w = tok.find((t) => /^\d+(px)?$/.test(t)) ?? ''; const st = tok.find((t) => /^(solid|dashed|none)$/.test(t)) ?? '';
    const color = tok.filter((t) => t !== w && t !== st).join(' ');
    return [['border-width', w], ['border-style', st], ['border-color', color]];
  }
  if (prop === 'background' && !/\s/.test(value) && !value.startsWith('url')) return [['background-color', value]];
  return [[prop, value]];
}
function eff(kinds: Kind[], width: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rules) {
    if (!kinds.includes(classify(r.selector)) || !mediaMatches(r.media, width)) continue;
    for (const [p, v] of r.decls) for (const [lp, lv] of longhands(p, v)) out.set(lp, lv.toLowerCase());
  }
  return out;
}
const oneOf = (v: string | undefined, set: string[]) => v !== undefined && set.includes(v);
const BONE = ['#f3f2d6', 'var(--bone)', 'var(--bg-tint)', 'var(--color-bone)'];
const RULE = ['#dad7c8', 'var(--rule)', 'var(--color-rule)'];
const INK = ['#211a57', 'var(--ink)', 'var(--color-ink)', 'var(--primary)', 'var(--color-primary)'];
const VIOLET = ['#7e3f97', 'var(--accent)', 'var(--color-accent)'];
const PRIMARY = ['#211a57', 'var(--primary)', 'var(--color-primary)'];
const IVORY = ['#fbfaf0', 'var(--ivory)', 'var(--color-ivory)', 'var(--parchment)', 'var(--color-parchment)'];
const px = (v: string | undefined, n: number) => v === `${n}px`;

expect(nested.length === 0, `flat CSS only: nested rule(s) not readable by this check (${nested.slice(0, 2).join(' | ')})`);
const scoped = rules.filter((r) => classify(r.selector) !== 'other' && classify(r.selector) !== 'anchor');
expect(scoped.length > 0, 'RED the NOS stylesheets declare rules scoped to [data-sponsor-enquiry="nos"]');
expect(scoped.every((r) => !r.layered) && rules.filter((r) => classify(r.selector) === 'anchor').every((r) => !r.layered), 'RED the enquiry rules are unlayered (so they beat the layered Tailwind utilities in the shared form)');
expect(rules.every((r) => !/sponsor-enquiry/.test(r.selector) || NOS_ATTR.test(r.selector)), 'every sponsor-enquiry selector is scoped to the nos site (no leak to SAOC)');

// card
for (const w of [390, 768, 1440]) {
  const c = eff(['card'], w);
  expect(oneOf(c.get('background-color'), BONE), `RED card background is #F3F2D6 at ${w}px (got ${c.get('background-color')})`);
  expect(oneOf(c.get('border-radius'), ['16px', 'var(--radius-card)']), `RED card radius is 16 at ${w}px (got ${c.get('border-radius')})`);
  expect(c.get('box-shadow') === 'var(--shadow-sm)', `RED card shadow is var(--shadow-sm) at ${w}px (got ${c.get('box-shadow')})`);
}
for (const [w, want] of [[390, 24], [767, 24], [768, 32], [1440, 32]] as const) {
  const c = eff(['card'], w);
  expect(['top', 'right', 'bottom', 'left'].every((s) => px(c.get(`padding-${s}`), want)), `RED card padding is ${want}px on every side at ${w}px (got ${c.get('padding-top')}/${c.get('padding-right')})`);
}
expect(rules.some((r) => classify(r.selector) !== 'card' && NOS_ATTR.test(r.selector) && mediaMatches(r.media, 1440) && r.decls.get('max-width') === '640px'), 'RED a scoped fields rule sets max-width 640px');

// fields
for (const w of [390, 1440]) {
  const i = eff(['input'], w);
  expect(px(i.get('border-width'), 1) && oneOf(i.get('border-color'), RULE), `RED inputs have a 1px --rule border at ${w}px (got ${i.get('border-width')} ${i.get('border-color')})`);
  expect(oneOf(i.get('border-radius'), ['8px']), `RED inputs radius 8 at ${w}px (got ${i.get('border-radius')})`);
  expect(px(i.get('min-height'), 48), `RED inputs min-height 48 at ${w}px (got ${i.get('min-height')})`);
  const l = eff(['label'], w);
  expect(/karla/.test(l.get('font-family') ?? '') && px(l.get('font-size'), 14) && l.get('font-weight') === '500', `RED labels are Karla 500 14px at ${w}px (got ${l.get('font-family')} ${l.get('font-size')} ${l.get('font-weight')})`);
  expect(oneOf(l.get('letter-spacing'), ['0', '0px', 'normal']) && l.get('text-transform') === 'none' && oneOf(l.get('color'), INK), `RED labels: no tracking, no caps, ink colour at ${w}px`);
  const f = eff(['focus'], w);
  expect(/\b2px\b/.test(f.get('outline') ?? `${f.get('outline-width') ?? ''}`) && VIOLET.some((v) => (f.get('outline') ?? f.get('outline-color') ?? '').includes(v)), `RED the focus ring is 2px violet at ${w}px (got ${f.get('outline') ?? f.get('outline-width')})`);
  const s = eff(['submit'], w);
  expect(oneOf(s.get('background-color'), PRIMARY) && oneOf(s.get('color'), IVORY), `RED submit is the NOS primary button colours at ${w}px (got ${s.get('background-color')} on ${s.get('color')})`);
  expect(/karla/.test(s.get('font-family') ?? '') && s.get('font-weight') === '700' && px(s.get('font-size'), 14) && s.get('text-transform') === 'uppercase', `RED submit type is Karla 700 14px uppercase at ${w}px`);
  expect(px(s.get('min-height'), 50) && oneOf(s.get('border-radius'), ['var(--radius-button)', '10px']), `RED submit min-height 50 and --radius-button at ${w}px`);
}
// NR-4 (NOS Design): the success box inside the card is no box in a box - transparent, no border, no padding. role=status stays (A4).
// NOS Design: the consent label is EXCLUDED from the field-label rule and takes the body role (Karla 450 16px / 1.5).
expect(!rules.some((r) => classify(r.selector) === 'labelBare'), 'RED the field-label rule excludes the consent label (label:not([for="se-consent"]) or :not(:has(input[type=checkbox]))), no bare label rule');
for (const w of [390, 1440]) {
  const st = eff(['status'], w);
  const noBorder = st.get('border-style') === 'none' || ['0', '0px'].includes(st.get('border-width') ?? '');
  expect(noBorder, `RED success box (role=status) has no border at ${w}px (got ${st.get('border-width')} ${st.get('border-style')})`);
  expect(['top', 'right', 'bottom', 'left'].every((side) => ['0', '0px'].includes(st.get(`padding-${side}`) ?? '')), `RED success box has zero padding at ${w}px (got ${st.get('padding-top')})`);
  expect(['transparent', 'none'].includes(st.get('background-color') ?? ''), `RED success box background is transparent at ${w}px (got ${st.get('background-color')})`);
  const cl = eff(['consent'], w);
  expect(/karla/.test(cl.get('font-family') ?? '') && cl.get('font-weight') === '450' && px(cl.get('font-size'), 16) && ['1.5', '24px'].includes(cl.get('line-height') ?? ''), `RED consent label is Karla 450 16px / 1.5 at ${w}px (got ${cl.get('font-family')} ${cl.get('font-weight')} ${cl.get('font-size')} ${cl.get('line-height')})`);
}
// anchor: the card margin is declared for a root whose scroll-padding is zero (NOS Design anchor ruling)
for (const [w, want] of [[390, 24], [779, 24], [780, 121], [1440, 121], [2056, 121]] as const) {
  const a = eff(['card', 'anchor'], w);
  expect(px(a.get('scroll-margin-top'), want), `RED #enquire scroll-margin-top is ${want}px at ${w}px (got ${a.get('scroll-margin-top')})`);
}
// NOS root scroll-padding is zeroed through the variable, at every width, only when the NOS chrome (#nh) or the NOS theme is present
const rootDecl = (w: number, prop: string): string | undefined => {
  let v: string | undefined;
  for (const r of [...chromeRules, ...rules]) {
    if (!/^html\b/.test(r.selector) || !/#nh|nos/.test(r.selector)) continue;
    if (r.media.length && !mediaMatches(r.media, w)) continue;
    const d = r.decls.get(prop); if (d !== undefined) v = d.toLowerCase();
  }
  return v;
};
for (const w of [390, 767, 768, 1024, 1440, 2056]) {
  expect(['0', '0px'].includes(rootDecl(w, '--scroll-padding-top') ?? ''), `RED the NOS host sets --scroll-padding-top to 0 on html at ${w}px (got ${rootDecl(w, '--scroll-padding-top')}); a rule such as html:has(#nh) { --scroll-padding-top: 0px }, not limited to a max-width media query`);
}
expect(chromeRules.concat(rules).filter((r) => /^html\b/.test(r.selector) && r.decls.has('--scroll-padding-top')).every((r) => /#nh|nos/.test(r.selector)), 'every html --scroll-padding-top override is scoped to the NOS host (#nh or nos), never bare html');
// SAOC guard: the SAOC root scroll-padding stays as it is
const globals = readFileSync('app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
expect(/--scroll-padding-top\s*:\s*6\.5rem\s*;/.test(globals) && /(^|[\s;{])scroll-padding-top\s*:\s*var\(--scroll-padding-top\)\s*;/.test(globals), 'PIN SAOC root scroll-padding unchanged: app/globals.css still declares --scroll-padding-top: 6.5rem and html scroll-padding-top: var(--scroll-padding-top)');
// heading: NOS doc-h2 role, so the page renders the section inDocument
const page = readFileSync(`${DIR}/sponsors/page.tsx`, 'utf8');
expect(/<SponsorEnquirySection\b[^>]*\bsite="nos"[^>]*\binDocument\b/.test(page.replace(/\s+/g, ' ')), 'RED the NOS page renders <SponsorEnquirySection site="nos" inDocument />');
const html = renderToStaticMarkup(React.createElement(SponsorEnquirySection, { site: 'nos', inDocument: true }));
expect(/<h2[^>]*class="[^"]*\bdoc-h2\b/.test(html), 'PIN the inDocument heading carries the NOS doc-h2 class');
// the SAOC side is untouched
const base = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { encoding: 'utf8' }).trim();
const touched = execFileSync('git', ['diff', base, '--name-only', '--', 'app/globals.css', 'app/(marketing)', 'components/sponsors/SponsorEnquirySection.tsx'], { encoding: 'utf8' }).trim();
expect(touched === '', `PIN SAOC styling untouched: app/globals.css, app/(marketing), SponsorEnquirySection.tsx unchanged (${touched})`);

if (failures.length) { console.error(`FAIL (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('PASS: NOS enquiry card, tokens and anchor offset are declared per the NOS Design ruling');

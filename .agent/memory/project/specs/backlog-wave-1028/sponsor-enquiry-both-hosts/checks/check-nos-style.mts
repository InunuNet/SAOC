// sponsor-enquiry-both-hosts, NOS Design ruling (2026-10-28), static half. The NOS enquiry card, its tokens and its anchor offset
// are declared in the NOS stylesheets, scoped to [data-sponsor-enquiry='nos'] so the shared form (and the SAOC page) is untouched.
// Rulings pinned (values are NOS Design's, not ours):
//   card    : background #F3F2D6 (--bone), radius 16, padding 32 (24 below 768), --shadow-sm; fields column max-width 640
//   fields  : labels Karla 500 14px ink, no tracking, no caps; inputs 1px --rule border, radius 8, min-height 48; 2px violet focus ring
//   submit  : the NOS primary Button look (bg --primary, text --ivory, Karla 700 14px uppercase, min-height 50, --radius-button)
//   heading : NOS doc-h2 role (the section is rendered inDocument)
//   anchor  : scroll-margin-top 121px at >=700, 68px below 700 (sticky chrome + 24)
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
type Kind = 'card' | 'anchor' | 'fields' | 'input' | 'focus' | 'label' | 'submit' | 'other';
function classify(selector: string): Kind {
  if (/^(?:\.nos-theme\s+)?(?:section)?#enquire$/.test(selector)) return 'anchor';
  const m = NOS_ATTR.exec(selector);
  if (!m) return 'other';
  const tail = selector.slice(m.index + m[0].length).trim().replace(/^>\s*/, '');
  if (tail === '') return 'card';
  if (new RegExp(`^(?:${CONTROL}|:is\\(\\s*input\\s*,[^)]*\\)(?:\\[[^\\]]*\\]|:not\\([^)]*\\))*)$`).test(tail)) return 'input';
  if (new RegExp(`^(?:${CONTROL}|:is\\([^)]*\\)|\\*)?:focus-visible$`).test(tail)) return 'focus';
  if (/^label(?::not\([^)]*\))?$/.test(tail)) return 'label';
  if (/^button(?:\[type=["']?submit["']?\])?$/.test(tail)) return 'submit';
  return 'fields';
}

function longhands(prop: string, value: string): Array<[string, string]> {
  if (prop === 'padding' || prop === 'margin') {
    const v = value.split(' '); const [t, r = t, b = t, l = r] = v;
    return [[`${prop}-top`, t ?? ''], [`${prop}-right`, r ?? ''], [`${prop}-bottom`, b ?? ''], [`${prop}-left`, l ?? '']];
  }
  if (prop === 'border') {
    const tok = splitTop(value, ' '); const w = tok.find((t) => /^\d+px$/.test(t)) ?? ''; const st = tok.find((t) => /^(solid|dashed|none)$/.test(t)) ?? '';
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
// anchor
for (const [w, want] of [[390, 68], [699, 68], [700, 121], [1440, 121]] as const) {
  const a = eff(['card', 'anchor'], w);
  expect(px(a.get('scroll-margin-top'), want), `RED #enquire scroll-margin-top is ${want}px at ${w}px (got ${a.get('scroll-margin-top')})`);
}
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

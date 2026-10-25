// F4 static (policy links beside Buy). NOS Design ruling 2026-10-25 (goldens/nos-design-rulings-2026-10-25.md):
// TicketPurchaseForm ends with one <p className="nk-policy"> reading "Refunds · Privacy" on one line, two next/link
// <Link>s to the existing /refunds and /privacy pages labelled with the NOS footer's own labels (read here from
// components/nos-chrome/nos-footer-data.ts, so a relabelled footer fails the check), joined by an aria-hidden dot.
// No other text.
//   PL-1 the links, their hrefs and labels, in DOM order after the Buy hint (the last element of the form)
//   PL-2 `.nk-policy` is built only from existing tokens: sans, 14px, --primary-800, one flex row, links
//        underlined, inline-flex, min-height at least 24px (WCAG 2.5.8; the spec uses 44px)
//   PL-3 the env-gated fixture route renders the form for the rendered check: force-dynamic, 404 unless
//        TICKET_FIXTURES === '1', flag in no deploy or example env file
// Run as: node contracts/checks/polish-wave-2-2026-10-25/f4-links-static.mjs   (POLISH_ROOT optional)
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { finish, read, repoRoot, tags } from './_lib.mjs';

const failures = [];
const footer = read('components/nos-chrome/nos-footer-data.ts');
const refundTitle = footer.match(/label:\s*'([^']+)',\s*href:\s*'\/refunds'/)?.[1];
const privacyTitle = footer.match(/label:\s*'([^']+)',\s*href:\s*'\/privacy'/)?.[1];
if (refundTitle !== 'Refunds' || privacyTitle !== 'Privacy') failures.push(`NOS footer labels are "${refundTitle}" / "${privacyTitle}", the ruling pins "Refunds" / "Privacy"`);
const jsx = (s) => (s ?? '').replace(/&/g, '&amp;');

const form = read('components/tickets/TicketPurchaseForm.tsx');
if (!/import Link from 'next\/link'/.test(form)) failures.push("TicketPurchaseForm does not import Link from 'next/link'");
const policy = form.match(/<p\b[^>]*className="nk-policy"[^>]*>([\s\S]*?)<\/p>/);
if (!policy) failures.push('no <p className="nk-policy"> in TicketPurchaseForm');
else {
  const links = tags(policy[1], 'Link');
  const labels = [...policy[1].matchAll(/<Link\b[^>]*>\s*([^<]*?)\s*<\/Link>/g)].map((m) => m[1]);
  if (links.length !== 2) failures.push(`expected 2 <Link>s in .nk-policy, found ${links.length}`);
  else {
    if (!/href="\/refunds"/.test(links[0]) || labels[0] !== jsx(refundTitle)) failures.push(`first link must be href="/refunds" labelled "${refundTitle}" (found "${labels[0]}")`);
    if (!/href="\/privacy"/.test(links[1]) || labels[1] !== jsx(privacyTitle)) failures.push(`second link must be href="/privacy" labelled "${privacyTitle}" (found "${labels[1]}")`);
  }
  const stray = policy[1].replace(/<Link\b[\s\S]*?<\/Link>/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/<span aria-hidden="true">\s*·\s*<\/span>/, '').trim();
  if (stray) failures.push(`.nk-policy holds anything other than the two links and one aria-hidden dot span: "${stray.slice(0, 60)}"`);
  if (!/<\/Link>\s*<span aria-hidden="true">\s*·\s*<\/span>\s*<Link/.test(policy[1])) failures.push('the two links are not joined by <span aria-hidden="true">·</span>');
  if (form.indexOf('className="nk-policy"') < form.indexOf('data-buy-hint')) failures.push('.nk-policy must come after the Buy hint paragraph');
  if (/<\/form>/.test(form) && form.indexOf('</form>') < form.indexOf('className="nk-policy"')) failures.push('.nk-policy must be inside the <form>');
}

const css = read('app/(nos)/national-show/nos-structure.css');
const block = css.match(/\.nos-theme \.nk-policy\s*\{([^}]*)\}/);
const anchor = css.match(/\.nos-theme \.nk-policy a\s*\{([^}]*)\}/);
if (!block) failures.push('`.nos-theme .nk-policy` rule not found');
else {
  if (!/display:\s*flex/.test(block[1]) || !/align-items:\s*center/.test(block[1])) failures.push('`.nk-policy` is not a centred flex row');
  if (!/font-family:\s*var\(--sans\)/.test(block[1]) || !/font-size:\s*14px/.test(block[1]) || !/color:\s*var\(--primary-800\)/.test(block[1])) failures.push('`.nk-policy` must use var(--sans), 14px and var(--primary-800) (the .nk-hint tokens)');
}
if (!anchor) failures.push('`.nos-theme .nk-policy a` rule not found');
else {
  const mh = anchor[1].match(/min-height:\s*(\d+(?:\.\d+)?)(px|rem)/);
  const mhPx = mh ? Number(mh[1]) * (mh[2] === 'rem' ? 16 : 1) : 0;
  if (!/display:\s*inline-flex/.test(anchor[1]) || mhPx < 24) failures.push('`.nk-policy a` is not inline-flex with min-height of at least 24px');
  if (!/text-decoration(-line)?:\s*underline/.test(anchor[1])) failures.push('`.nk-policy a` is not underlined');
  if (/color:\s*#|rgb\(/.test(block?.[1] + anchor[1])) failures.push('`.nk-policy` rules introduce a literal colour');
}

const fxPath = 'app/ticket-fixtures/buy/page.tsx';
if (!existsSync(resolve(repoRoot, fxPath))) failures.push(`${fxPath} does not exist`);
else {
  const fx = read(fxPath);
  if (!/export const dynamic = 'force-dynamic'/.test(fx)) failures.push('fixture route is not force-dynamic');
  if (!/process\.env\.TICKET_FIXTURES !== '1'/.test(fx) || !/notFound\(\)/.test(fx)) failures.push("fixture route does not notFound() unless TICKET_FIXTURES === '1'");
  if (!/<TicketPurchaseForm\b/.test(fx) || !/<NosThemeScope\b/.test(fx)) failures.push('fixture route does not render <NosThemeScope><TicketPurchaseForm>');
}
for (const rel of ['apphosting.yaml', '.env.local.example', 'firebase.json', 'next.config.ts']) {
  const p = resolve(repoRoot, rel);
  if (existsSync(p) && readFileSync(p, 'utf8').includes('TICKET_FIXTURES')) failures.push(`${rel} must not mention TICKET_FIXTURES`);
}
finish('f4-links-static', failures);

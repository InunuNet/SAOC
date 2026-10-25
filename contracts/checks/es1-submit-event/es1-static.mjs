// ES-1 static (/events/submit off-system styling). The authenticated body already sits on the ContactForm anatomy
// (wave 1 F6); what is left off-system is the unauthenticated "Members only" LoginPrompt in
// app/(marketing)/events/submit/page.tsx (sans text-2xl h1, text-gray-*, a bare underlined link). This check pins:
//   P  parity, mechanical, read from components/contact/ContactForm.tsx so the two cannot drift:
//        SubmitEventForm LABEL_CLASS and SUBMIT_CLASS equal ContactForm's labelClass and button className; INPUT_CLASS
//        equals ContactForm's inputClass plus min-h-11 (green on baseline, a regression guard)
//   L  LoginPrompt: PageHero (serif h1) with the existing sentence as lede and the existing link as the hero action,
//        the link classes equal ContactForm's button classes (a leading mt-8 margin is the one allowed extra token),
//        the three strings byte-identical, no gray-*, text-2xl, font-semibold
//   G  no gray-* utility in either file; the "Host society" label; no "Sanity" or "document ID" wording in the markup
//   W  the submit path is unchanged: POST /api/events/submit, select name="hostSocietyId", payload.hostSocietyId
// Run as: node contracts/checks/es1-submit-event/es1-static.mjs   (POLISH_ROOT optional)
import { finish, read } from '../polish-wave-2026-10-25/_lib.mjs';

const failures = [];
const tryRead = (rel) => { try { return read(rel); } catch (e) { failures.push(e.message); return ''; } };
const contact = tryRead('components/contact/ContactForm.tsx');
const form = tryRead('components/events/SubmitEventForm.tsx');
const page = tryRead('app/(marketing)/events/submit/page.tsx');
const tokens = (s) => s.split(/\s+/).filter(Boolean);
const same = (a, b) => [...tokens(a)].sort().join(' ') === [...tokens(b)].sort().join(' ');

// P
const cInput = contact.match(/const inputClass =\s*'([^']+)'/)?.[1];
const cLabel = contact.match(/const labelClass = '([^']+)'/)?.[1];
const cButton = contact.match(/<button\s+type="submit"[^>]*?className="([^"]+)"/s)?.[1];
if (!cInput || !cLabel || !cButton) failures.push('reference classes not found in ContactForm.tsx (check bug)');
const fInput = form.match(/const INPUT_CLASS =\s*'([^']+)'/)?.[1];
const fLabel = form.match(/const LABEL_CLASS = '([^']+)'/)?.[1];
const fSubmit = form.match(/const SUBMIT_CLASS =\s*'([^']+)'/)?.[1];
if (cLabel && fLabel !== cLabel) failures.push(`LABEL_CLASS differs from ContactForm labelClass: "${fLabel}"`);
if (cButton && (!fSubmit || !same(fSubmit, cButton))) failures.push('SUBMIT_CLASS tokens differ from the ContactForm submit button className');
if (cInput && (!fInput || !same(fInput, `${cInput} min-h-11`))) failures.push('INPUT_CLASS is not ContactForm inputClass plus min-h-11');

// L
const lp = page.match(/function LoginPrompt\(\)[\s\S]*?\n\}\n/)?.[0] ?? '';
if (!lp) failures.push('no LoginPrompt function in events/submit/page.tsx');
else {
  if (!/<PageHero\b/.test(lp)) failures.push('LoginPrompt does not render PageHero (serif h1 and hero, as the authenticated page does)');
  if (/<h1\b/.test(lp)) failures.push('LoginPrompt hand-writes an <h1>; the h1 must come from PageHero');
  if (/gray-|text-2xl|font-semibold/.test(lp)) failures.push('LoginPrompt still has gray-*, text-2xl or font-semibold');
  for (const s of ['Members only', 'Event submission is available to SAOC members.', 'Contact us about membership']) {
    if (!lp.includes(s)) failures.push(`LoginPrompt lost its string "${s}"`);
  }
  if (!/heading="Members only"/.test(lp)) failures.push('the PageHero heading is not "Members only"');
  if (!/lede="Event submission is available to SAOC members\."/.test(lp)) failures.push('the PageHero lede is not the existing sentence');
  const link = lp.match(/<(?:a|Link)\b[^>]*href="\/contact"[^>]*>/s)?.[0];
  const linkClass = link?.match(/className="([^"]+)"/)?.[1];
  if (!link) failures.push('LoginPrompt has no link to /contact');
  else if (!cButton || !linkClass || !same(tokens(linkClass).filter((t) => t !== 'mt-8').join(' '), cButton)) failures.push('the /contact link classes are not the ContactForm submit button classes (plus an optional mt-8)');
}

// G
for (const [name, src] of [['page.tsx', page], ['SubmitEventForm.tsx', form]]) {
  if (/\bgray-\d|-gray-|\bgray\b/.test(src.replace(/\/\/.*$/gm, ''))) failures.push(`${name} still has a gray-* utility`);
}
if (!/<label[^>]*htmlFor="hostSocietyId"[^>]*>\s*Host society\b/.test(form)) failures.push('no <label htmlFor="hostSocietyId"> starting with "Host society"');
const markup = form.replace(/hostSocietyId/g, 'hostSociety_');
if (/Sanity|document ID|Host society ID/i.test(markup)) failures.push('SubmitEventForm mentions Sanity or a document ID');
if (/Sanity|document ID/i.test(lp)) failures.push('LoginPrompt mentions Sanity or a document ID');

// W
if (!/fetch\('\/api\/events\/submit'/.test(form)) failures.push("the form no longer POSTs to '/api/events/submit'");
if (!/<select[^>]*id="hostSocietyId"[^>]*name="hostSocietyId"/s.test(form)) failures.push('select#hostSocietyId lost name="hostSocietyId"');
if (!/payload\.hostSocietyId = values\.hostSocietyId\.trim\(\)/.test(form)) failures.push('payload.hostSocietyId assignment changed');
finish('es1-static', failures);

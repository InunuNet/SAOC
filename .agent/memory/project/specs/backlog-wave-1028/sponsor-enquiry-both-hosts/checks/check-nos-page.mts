// sponsor-enquiry-both-hosts F2 (item 1): the NOS sponsors page hosts the SAME enquiry component and its primary CTAs
// point at the on-page form, not mailto. Whether a secondary visible mailto line stays is a NOS Design call: this check
// reports the count and neither requires nor forbids it. Static read of the page source plus a render of the shared section.
// Run as: pnpm exec tsx <this file> (from the checkout under test)
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SponsorEnquirySection } from '@/components/sponsors/SponsorEnquirySection';

const PAGE = 'app/(nos)/national-show/sponsors/page.tsx';
const failures: string[] = [];
const expect = (ok: boolean, label: string) => { if (!ok) failures.push(label); };
const src = readFileSync(PAGE, 'utf8');

// RED the shared component is imported from its one home and rendered once with site="nos" (no fork).
expect(/import\s*\{\s*SponsorEnquirySection\s*\}\s*from\s*'@\/components\/sponsors\/SponsorEnquirySection'/.test(src), 'RED page imports SponsorEnquirySection from @/components/sponsors/SponsorEnquirySection');
const uses = src.match(/<SponsorEnquirySection\b[^>]*>/g) ?? [];
expect(uses.length === 1 && /\bsite="nos"/.test(uses[0] ?? ''), 'RED page renders exactly one <SponsorEnquirySection site="nos" />');

// RED primary CTAs: every <Button ...> opening tag that links to mailto is gone, and the three CTA Buttons (hero, aside card, empty state) target #enquire.
const buttonTags = src.match(/<Button\b[\s\S]*?>/g) ?? [];
expect(buttonTags.filter((t) => /href=\{SPONSORSHIP_MAILTO\}|href="mailto:/.test(t)).length === 0, 'RED no <Button> links to mailto');
expect(buttonTags.filter((t) => /href="#enquire"/.test(t)).length >= 3, 'RED at least three <Button> CTAs (hero, card, empty state) link to #enquire');
expect(/data-sponsors-hero-cta/.test(src) && /<Button[^>]*href="#enquire"[^>]*data-sponsors-hero-cta|<Button[^>]*data-sponsors-hero-cta[^>]*href="#enquire"/.test(src.replace(/\s+/g, ' ')), 'RED the hero CTA (data-sponsors-hero-cta) links to #enquire');

// PIN the shared section renders for nos with the anchor, the site marker and every field, and no mailto of its own.
const html = renderToStaticMarkup(React.createElement(SponsorEnquirySection, { site: 'nos', inDocument: true }));
expect(html.includes('id="enquire"') && html.includes('data-sponsor-enquiry="nos"'), 'PIN section renders id="enquire" and data-sponsor-enquiry="nos"');
for (const id of ['contactName', 'organisation', 'email', 'phone', 'website', 'level', 'message', 'consent']) expect(html.includes(`id="se-${id}"`), `PIN section renders field se-${id}`);
expect(!/mailto:/.test(html), 'PIN the shared section contains no mailto');

const mailtoLeft = (src.match(/href=\{SPONSORSHIP_MAILTO\}|href="mailto:/g) ?? []).length;
console.log(`NOTE (NOS Design call, not asserted): ${mailtoLeft} mailto href(s) remain in the page source.`);
if (failures.length) { console.error(`FAIL (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('PASS: NOS sponsors page uses the shared enquiry form; primary CTAs target #enquire');

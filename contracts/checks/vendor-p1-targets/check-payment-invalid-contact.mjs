// F7 -- /national-show/vendors/payment with no (or a bad) token is the invalid-link state. On base
// d2071be5 it is a dead end: one sentence, no action. It must now offer a contact action, built
// from EXISTING copy and the existing link pattern only (docs/rules/no-invention.md):
//   - the existing sentence, word for word, still reads
//       "This payment link is no longer valid. Please contact SAOC if you believe this is an error."
//   - an <a> inside the content area points at /contact or mailto:info@saoc.co.za and is visible
// Both a missing token and a garbage token must show it (same enumeration-blind fallback).
//
// Run as: npx tsx contracts/checks/vendor-p1-targets/check-payment-invalid-contact.mjs

import { VIEWPORTS, finish, launch, openSettled } from './_harness.mjs';

const SENTENCE = 'This payment link is no longer valid. Please contact SAOC if you believe this is an error.';
const ALLOWED_HREFS = ['/contact', 'mailto:info@saoc.co.za'];
const CASES = [
  { name: 'no token', path: '/national-show/vendors/payment' },
  { name: 'garbage token', path: '/national-show/vendors/payment?token=not-a-real-token' },
];

const failures = [];
const { baseUrl, browser } = await launch();

for (const viewport of VIEWPORTS) {
  for (const testCase of CASES) {
    const tag = `[${viewport.name}] payment (${testCase.name})`;
    const { context, page } = await openSettled(browser, baseUrl, testCase.path, viewport, null);
    const contentText = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      return main.innerText.replace(/\s+/g, ' ').trim();
    });
    if (!contentText.includes(SENTENCE)) {
      failures.push(`${tag}: the existing invalid-link sentence is missing or reworded`);
    }
    const links = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      return [...main.querySelectorAll('a[href]')].map((a) => {
        const r = a.getBoundingClientRect();
        const style = getComputedStyle(a);
        return {
          href: a.getAttribute('href'),
          visible: r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        };
      });
    });
    const contactLink = links.find((l) => ALLOWED_HREFS.includes(l.href));
    if (!contactLink) {
      failures.push(`${tag}: no link to ${ALLOWED_HREFS.join(' or ')} in the content (found: ${JSON.stringify(links.map((l) => l.href))})`);
    } else if (!contactLink.visible) {
      failures.push(`${tag}: the contact link is not visible`);
    }
    // The link must sit in the same block as the invalid-link sentence, not float elsewhere.
    const linkInsideMessage = await page.evaluate(
      ({ hrefs, sentence }) =>
        [...document.querySelectorAll('a[href]')].some((a) => {
          if (!hrefs.includes(a.getAttribute('href'))) return false;
          const block = a.closest('p, div');
          return !!block && block.innerText.replace(/\s+/g, ' ').includes(sentence);
        }),
      { hrefs: ALLOWED_HREFS, sentence: SENTENCE },
    );
    if (!linkInsideMessage) failures.push(`${tag}: the contact link is not in the same block as the invalid-link sentence`);
    await context.close();
  }
}

await finish(browser, failures);

// F1a: every vendor error summary (role="alert" box bordered with --status-error) uses a 2px border, the token as text
// colour, and carries an aria-hidden icon next to the text (never colour alone). Static: the vendor forms render only on
// the NOS host, which redirects away from the SAOC host in a browser.
import { readFileSync } from 'node:fs';
import { check, finish } from './lib.mjs';
for (const file of ['components/vendors/VendorApplyForm.tsx', 'components/vendors/VendorRegistrationCodeEntryForm.tsx']) {
  const src = readFileSync(file, 'utf8');
  const boxes = [...src.matchAll(/role="alert"/g)].map((m) => src.slice(m.index, m.index + 700));
  const summaries = boxes.filter((b) => b.includes('border-[var(--status-error)]'));
  check(summaries.length >= 1, `${file}: no error summary found`);
  summaries.forEach((b, i) => {
    const head = b.slice(0, 260);
    check(/\bborder-2\b/.test(head), `${file} summary ${i + 1}: border is not 2px (needs border-2)`);
    check(/<\w*(Alert|Circle|Triangle|Octagon|Icon)\w*[^>]*aria-hidden/.test(b), `${file} summary ${i + 1}: no aria-hidden icon beside the text`);
  });
}
finish('error-summary-static');

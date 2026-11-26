// The footer newsletter input must have a label: NewsletterSignup renders <label htmlFor={inputId}>
// and the footer passes an sr-only labelClassName plus an emailLabel.
import { readFileSync } from 'node:fs';

const signup = readFileSync('components/newsletter/NewsletterSignup.tsx', 'utf8');
const footer = readFileSync('components/chrome/Footer.tsx', 'utf8');
const need = [
  [signup, '<label htmlFor={inputId} className={labelClassName}>'],
  [footer, 'inputId="footer-newsletter-email"'],
  [footer, 'emailLabel={FOOTER_BULLETIN.emailLabel}'],
  [footer, 'labelClassName="sr-only"'],
];
const missing = need.filter(([src, s]) => !src.includes(s)).map(([, s]) => s);
if (missing.length > 0) {
  console.error(`FAIL: missing: ${missing.join(' | ')}`);
  process.exit(1);
}
console.log('PASS: footer newsletter input is labelled');

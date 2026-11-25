// The attendee email field must expose aria-invalid + aria-describedby (TicketFormField), and blur
// must reach the cart hook's validation (CartAttendeeFields -> TicketPurchaseForm -> useTicketCart).
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(`components/tickets/${f}`, 'utf8');
const field = read('TicketFormField.tsx');
const need = [
  [field, 'aria-invalid={Boolean(error)}'],
  [field, 'aria-describedby={error ? `${id}-error` : undefined}'],
  [field, 'onBlur={onBlur}'],
  [read('CartAttendeeFields.tsx'), 'onBlur={() => onAttendeeEmailBlur?.(type.slug, index)}'],
  [read('TicketPurchaseForm.tsx'), 'onAttendeeEmailBlur={cart.blurAttendeeEmail}'],
  [read('useTicketCart.ts'), 'function blurAttendeeEmail'],
  [read('cartValidation.ts'), "'Please enter a valid email address.'"],
];
const missing = need.filter(([src, s]) => !src.includes(s)).map(([, s]) => s);
if (missing.length > 0) {
  console.error(`FAIL: missing: ${missing.join(' | ')}`);
  process.exit(1);
}
console.log('PASS: attendee email aria wiring and blur validation present');

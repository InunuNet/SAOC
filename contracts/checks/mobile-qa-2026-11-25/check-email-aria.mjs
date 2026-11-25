// Behavioural check for the attendee email blur validation (pure logic in blurValidation.ts, run
// with node --experimental-strip-types), plus the aria wiring the field needs for it to be heard:
// aria-invalid + aria-describedby on the input, the error border, and blur reaching the hook.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const logicUrl = new URL('../../../components/tickets/blurValidation.ts', import.meta.url);
const {
  blurEmailError,
  withBlurEmailError,
  nextBlurErrors,
  visibleFieldErrors,
  INVALID_EMAIL_MESSAGE,
} = await import(logicUrl.href);

const MESSAGE = 'Please enter a valid email address.';
assert.equal(INVALID_EMAIL_MESSAGE, MESSAGE, 'reuses the existing cart error string');

// Invalid gives the error; empty gives none; a fixed email gives none.
assert.equal(blurEmailError('not-an-email'), MESSAGE);
assert.equal(blurEmailError('a@b'), MESSAGE);
assert.equal(blurEmailError(''), undefined);
assert.equal(blurEmailError('qa.test@example.com'), undefined);

// A fixed email clears its row's error; rows are independent; inputs are not mutated.
const start = {};
const one = withBlurEmailError(start, 'vip-0', blurEmailError('nope'));
assert.deepEqual(one, { 'vip-0': { email: MESSAGE } });
assert.deepEqual(start, {}, 'input map untouched');
const two = withBlurEmailError(one, 'vip-1', blurEmailError('also-bad'));
assert.deepEqual(Object.keys(two).sort(), ['vip-0', 'vip-1']);
const cleared = withBlurEmailError(two, 'vip-0', blurEmailError('fixed@example.com'));
assert.deepEqual(cleared, { 'vip-1': { email: MESSAGE } }, 'only the fixed row clears');
assert.deepEqual(two['vip-0'], { email: MESSAGE }, 'previous state untouched');

// The whole blur transition: invalid sets, other rows kept, fixed clears, empty clears that row's
// blur error ("required" is the submit check's job), an unknown row leaves state as is.
const rows = [{ attendeeEmail: 'bad' }, { attendeeEmail: 'worse' }];
const t1 = nextBlurErrors({}, rows, 0, 'vip-0');
assert.deepEqual(t1, { 'vip-0': { email: MESSAGE } });
const t2 = nextBlurErrors(t1, rows, 1, 'vip-1');
assert.deepEqual(Object.keys(t2).sort(), ['vip-0', 'vip-1']);
const fixedRows = [{ attendeeEmail: 'ok@example.com' }, rows[1]];
assert.deepEqual(nextBlurErrors(t2, fixedRows, 0, 'vip-0'), { 'vip-1': { email: MESSAGE } });
const emptyRows = [{ attendeeEmail: '' }, rows[1]];
assert.deepEqual(nextBlurErrors(t2, emptyRows, 0, 'vip-0'), { 'vip-1': { email: MESSAGE } });
assert.equal(nextBlurErrors(t2, rows, 5, 'vip-5'), t2, 'unknown row leaves state as is');

// Blur state shows in the fields but never enters the submit errors the summary reads.
const submitErrors = {};
const shown = visibleFieldErrors(cleared, submitErrors);
assert.deepEqual(shown, { 'vip-1': { email: MESSAGE } });
assert.deepEqual(submitErrors, {}, 'submit errors (the summary source) stay empty after a blur');
const submitRow = { 'vip-1': { name: 'Please enter the attendee name.', email: MESSAGE } };
assert.deepEqual(visibleFieldErrors(cleared, submitRow)['vip-1'], submitRow['vip-1'], 'submit wins');

// Wiring: the hook uses the pure logic and keeps the summary on submit errors only.
const read = (f) => readFileSync(`components/tickets/${f}`, 'utf8');
const field = read('TicketFormField.tsx');
const hook = read('useTicketCart.ts');
const wiring = [
  [field, 'aria-invalid={Boolean(error)}'],
  [field, 'aria-describedby={error ? `${id}-error` : undefined}'],
  [field, 'onBlur={onBlur}'],
  [field, 'aria-invalid:border-error'],
  [read('CartAttendeeFields.tsx'), 'onBlur={() => onAttendeeEmailBlur?.(type.slug, index)}'],
  [read('TicketPurchaseForm.tsx'), 'onAttendeeEmailBlur={cart.blurAttendeeEmail}'],
  [read('TicketPurchaseForm.tsx'), 'errors={cart.fieldErrors}'],
  [read('TicketPurchaseForm.tsx'), 'errors: cart.attendeeErrors,'],
  [hook, 'const [blurErrors, setBlurErrors] = useState<AttendeeFieldErrors>({});'],
  [
    hook,
    `function blurAttendeeEmail(_slug: string, index: number) {
    const key = attendeeRowKey(ticketType.slug, index);
    setBlurErrors((prev) => nextBlurErrors(prev, attendees, index, key));
  }`,
  ],
];
const missing = wiring.filter(([src, s]) => !src.includes(s)).map(([, s]) => s);
assert.deepEqual(missing, [], `wiring missing: ${missing.join(' | ')}`);
console.log('PASS: blur email validation behaves; aria wiring present');

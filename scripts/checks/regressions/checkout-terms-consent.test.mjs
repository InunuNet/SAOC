// CheckoutTermsConsent: a listing's own cancellation terms replace the policy's schedule only when
// they hold real text, and every rendered line gets its own key (no duplicate-key warnings).
//   npx tsx --test scripts/checks/regressions/checkout-terms-consent.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CANCELLATION_SCHEDULE_LINES } from '../../../content/legal/refunds.ts';
import { CheckoutTermsConsent } from '../../../components/tickets/CheckoutTermsConsent.tsx';

function render(cancellationTerms) {
  return renderToStaticMarkup(
    createElement(CheckoutTermsConsent, {
      checked: false,
      invalid: false,
      disabled: false,
      onChange: () => {},
      cancellationTerms,
    })
  );
}

const policyFirstLine = CANCELLATION_SCHEDULE_LINES[0];

test('blank-only entries fall back to the default schedule', () => {
  for (const blank of [[''], [' '], ['', ' ']]) {
    assert.ok(render(blank).includes(policyFirstLine), JSON.stringify(blank));
  }
});

test('null, undefined and empty arrays fall back to the default schedule', () => {
  for (const none of [null, undefined, []]) {
    assert.ok(render(none).includes(policyFirstLine));
  }
});

test('custom lines replace the schedule and blanks among them are dropped', () => {
  const html = render(['No refunds after 1 August.', ' ', 'Transfers allowed.']);
  assert.ok(html.includes('No refunds after 1 August.'));
  assert.ok(html.includes('Transfers allowed.'));
  assert.ok(!html.includes(policyFirstLine));
});

test('duplicate custom lines render without a duplicate-key warning', () => {
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    render(['Same line.', 'Same line.']);
  } finally {
    console.error = original;
  }
  assert.deepEqual(errors.filter((message) => /same key|unique "key"/i.test(message)), []);
});

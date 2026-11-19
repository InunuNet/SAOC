// Server-side rules of the registration validator (the same function the checkout route runs):
// the exclusive membership choices, and availability being ignored for a non-accredited judge.
import { expect, test } from '@playwright/test';

import { validateRegistrationGroup } from '../lib/registration';

const BASE = {
  title: 'Ms', firstName: 'Test', surname: 'Person', preferredName: 'T', email: 'p@example.invalid',
  mobile: '+27 11 000 0000', country: 'South Africa', province: 'Western Cape',
  societies: ['Cape Orchid Society'], attending: 'SAOC Symposium Normal Ticket',
  judgeAccredited: 'No', judgeOrganisation: 'Not applicable', judgeAvailable: 'No', judgeDate: 'None',
  judgeCommunication: 'No', judgeForum: 'No', dietary: 'None', dietaryOther: null, sameAsAttendee1: [],
};
const check = (overrides: Record<string, unknown>) => validateRegistrationGroup([{ ...BASE, ...overrides }], 'saoc-symposium');

test.describe('registration validator', () => {
  for (const [name, societies] of [
    ['None with a society', ['None', 'Cape Orchid Society']],
    ['Independent Member with a society', ['Independent Member', 'Cape Orchid Society']],
    ['Overseas visitor with a society', ['Overseas visitor', 'Natal Orchid Society']],
    ['Independent Member with Overseas visitor', ['Independent Member', 'Overseas visitor']],
  ] as const) {
    test(`rejects ${name}`, () => {
      const result = check({ societies: [...societies] });
      expect(result.ok).toBe(false);
    });
  }

  for (const only of ['None', 'Independent Member', 'Overseas visitor']) {
    test(`accepts ${only} alone`, () => expect(check({ societies: [only] }).ok).toBe(true));
  }

  test('a non-accredited judge: availability and date are ignored and cleared', () => {
    const result = check({ judgeAccredited: 'No', judgeAvailable: 'Yes', judgeDate: '23-Sep' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.people[0]).toMatchObject({ judgeAvailable: 'No', judgeDate: 'None' });
  });

  test('an accredited judge still needs a date when available', () => {
    const base = { judgeAccredited: 'Yes', judgeOrganisation: 'SAOC' };
    expect(check({ ...base, judgeAvailable: 'Yes', judgeDate: 'None' }).ok).toBe(false);
    expect(check({ ...base, judgeAvailable: 'Yes', judgeDate: '23-Sep' }).ok).toBe(true);
  });
});

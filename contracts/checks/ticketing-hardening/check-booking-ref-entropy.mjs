// A11 — booking references issued by the REAL route are unguessable. Booking refs are
// simultaneously the door code and the PayFast m_payment_id; the current
// `SAOC-2027-` + 6 digits form is a 1,000,000-value space that can be walked.
//
// Proved from live responses, not from source: the regexes come from
// contracts/golden/ticketing-hardening/booking-ref-format.golden.txt, and the same
// references are read back from Firestore so the format is the one actually persisted.

import {
  safeBody,
  assert,
  assertSalesOpen,
  postCheckout,
  readTicketByBookingRef,
  readRepoFile,
  runId,
  sentinelEmail,
  withCleanup,
} from './_shared.mjs';

const SAMPLE_SIZE = 16;

function goldenValue(name) {
  const golden = readRepoFile('contracts/golden/ticketing-hardening/booking-ref-format.golden.txt');
  const line = golden.split('\n').find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`golden file has no ${name} entry`);
  return line.slice(name.length + 1).trim();
}

function goldenRegex(name) {
  return new RegExp(goldenValue(name));
}

/**
 * Signatures of a counter dressed up as a random string. Format and uniqueness alone
 * prove nothing about guessability: a 12-character sequential counter
 * (SAOC-2027-000000000001, ...0002, ...) matches the required format, avoids the
 * forbidden one, and is distinct in every sample — while remaining fully enumerable,
 * which is the defect this assertion exists to close.
 *
 * For genuinely random Crockford-base32 segments each of these has a false-red
 * probability far below 1e-12 at SAMPLE_SIZE=16.
 */
function entropyProblems(segments) {
  const problems = [];

  let commonPrefix = 0;
  while (
    commonPrefix < segments[0].length &&
    segments.every((seg) => seg[commonPrefix] === segments[0][commonPrefix])
  ) {
    commonPrefix += 1;
  }
  if (commonPrefix > 0) {
    problems.push(
      `all samples share the first ${commonPrefix} character(s) of the random segment — that is a counter or a fixed field, not randomness`
    );
  }

  const ascending = segments.every((seg, i) => i === 0 || seg > segments[i - 1]);
  const descending = segments.every((seg, i) => i === 0 || seg < segments[i - 1]);
  if (ascending || descending) {
    problems.push(
      `references were issued in monotonic ${ascending ? 'ascending' : 'descending'} order — the next one is predictable from the last`
    );
  }

  for (let pos = 0; pos < segments[0].length; pos += 1) {
    const distinct = new Set(segments.map((seg) => seg[pos])).size;
    if (distinct === 1) {
      problems.push(
        `character ${pos + 1} of the random segment is '${segments[0][pos]}' in every sample — that position carries no entropy`
      );
    }
  }

  return problems;
}

// Detector self-test: a sequential counter must trip the heuristics, and a random
// sample must not. Without this, a heuristic that quietly stopped discriminating would
// look like a pass (this project's false-green failure mode).
const COUNTER_FIXTURE = Array.from({ length: SAMPLE_SIZE }, (_u, i) =>
  String(i + 1).padStart(12, '0')
);
const RANDOM_FIXTURE = [
  'K3M9T0BVXQZ7',
  '8FQ2WHNC5RJD',
  'PZ4XG7VKB1MT',
  '3RCJ9DQFW6HN',
  'VT7BM2XZK4QG',
  'H5NPW8JR3CFD',
  'Q9GKT1VBXM7Z',
  'D2WFJ6HNPR4C',
  'X8ZQM3TKG5BV',
  'N6CRD9WFJ2HP',
  'B4VXK7ZQGM1T',
  'J1HPF5CRDW9N',
  'T7MGB2VZXK8Q',
  'W3JNC6PRDF4H',
  'Z5KTQ8MBGV2X',
  'F9DWH4NRCJ6P',
];
if (entropyProblems(COUNTER_FIXTURE).length === 0) {
  console.error('FAIL: A11 detector self-test — a sequential counter was not detected');
  process.exit(1);
}
if (entropyProblems(RANDOM_FIXTURE).length !== 0) {
  console.error(
    `FAIL: A11 detector self-test — random samples were wrongly flagged: ${entropyProblems(RANDOM_FIXTURE).join('; ')}`
  );
  process.exit(1);
}

await withCleanup(`A11 ${SAMPLE_SIZE} live booking refs are high-entropy and unique`, async () => {
  await assertSalesOpen();
  const required = goldenRegex('REQUIRED_REGEX');
  const forbidden = goldenRegex('FORBIDDEN_REGEX');
  const id = runId();

  const refs = [];
  for (let i = 0; i < SAMPLE_SIZE; i += 1) {
    const { status, body } = await postCheckout({ email: sentinelEmail(`ref-${id}-${i}`) });
    assert(status === 201, `checkout ${i} failed: HTTP ${status} ${safeBody(body)}`);
    refs.push(body.bookingRef);
  }

  for (const ref of refs) {
    assert(
      !forbidden.test(ref),
      `booking ref '${ref}' still uses the guessable 6-digit format (${forbidden})`
    );
    assert(
      required.test(ref),
      `booking ref '${ref}' does not match the required format ${required}`
    );
  }
  assert(
    new Set(refs).size === refs.length,
    `booking refs collided within ${SAMPLE_SIZE} samples: ${refs.join(', ')}`
  );

  const prefix = goldenValue('PREFIX');
  const problems = entropyProblems(refs.map((r) => r.slice(prefix.length)));
  assert(
    problems.length === 0,
    `booking references are structurally predictable — ${problems.join('; ')}. Samples: ${refs.join(', ')}`
  );

  const stored = await readTicketByBookingRef(refs[0]);
  assert(
    stored != null && stored.bookingRef === refs[0],
    'the issued booking ref is not the one stored on the Firestore document'
  );
  assert(
    stored.m_payment_id === refs[0],
    `m_payment_id must remain the booking ref (PayFast correlation), got '${stored.m_payment_id}'`
  );
});

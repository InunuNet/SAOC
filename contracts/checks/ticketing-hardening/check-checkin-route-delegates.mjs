// A14 — app/api/admin/checkin/route.ts delegates ALL admission logic to lib/checkin.ts
// and keeps only auth + result mapping.
//
// Structural by necessity: Firebase Auth is unprovisioned on `saoc-webapp`
// (auth/configuration-not-found), so the authenticated HTTP path cannot be exercised at
// all — see contracts/golden/ticketing-hardening/README.md. A1–A4 prove the logic
// itself against real Firestore; this check only proves the route is wired to it.
//
// The first version of this check was an inline grep for
// `'reserved'|'checked-in'|showId ===|status ===`, which @qa showed was escapable: it
// matches neither `status !== "paid"` (wrong operator) nor double-quoted literals. The
// detector below is operator-agnostic and quote-agnostic, and it SELF-TESTS against a
// compliant and a non-compliant fixture before it judges the real file, so a detector
// that has stopped discriminating fails loudly instead of passing everything.

import { readFileSync } from 'node:fs';

const ROUTE_PATH = new URL('../../../app/api/admin/checkin/route.ts', import.meta.url).pathname;

// Any admission-relevant literal or identifier, in either quote style. Operators are
// deliberately not part of the pattern — comparing, assigning or switching on these is
// equally forbidden in the route.
const FORBIDDEN = [
  { pattern: /['"`]paid['"`]/, why: "compares or writes the 'paid' status" },
  { pattern: /['"`]reserved['"`]/, why: "compares or writes the 'reserved' status" },
  { pattern: /['"`]checked-in['"`]/, why: "compares or writes the 'checked-in' status" },
  { pattern: /\bshowId\b/, why: 'references showId — show scoping belongs in lib/checkin.ts' },
  { pattern: /\bTimestamp\b/, why: 'stamps a timestamp — the write belongs in lib/checkin.ts' },
  { pattern: /\brunTransaction\b/, why: 'runs its own transaction instead of delegating' },
];

const REQUIRED = /\bcheckInByBookingRef\b/;

/** Strip comments so a comment can neither trip nor satisfy the detector. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function judge(source) {
  const code = stripComments(source);
  const problems = [];
  if (!REQUIRED.test(code)) problems.push('does not call checkInByBookingRef');
  for (const { pattern, why } of FORBIDDEN) {
    if (pattern.test(code)) problems.push(why);
  }
  return problems;
}

// --- detector self-test -----------------------------------------------------
const COMPLIANT = `
  import { checkInByBookingRef } from '@/lib/checkin';
  export async function POST(request: Request) {
    // auth omitted in fixture — 'paid' and showId appear only in this comment
    const { bookingRef } = await request.json();
    const result = await checkInByBookingRef(bookingRef);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.httpStatus });
    return NextResponse.json({ success: true, ticket: result.ticket });
  }
`;
const ESCAPES = [
  ['single-quoted status compare', `const ok = data['status'] === 'paid'; checkInByBookingRef;`],
  [
    'double-quoted negated compare',
    `if (data["status"] !== "paid") return deny(); checkInByBookingRef;`,
  ],
  ['showId scoping in the route', `if (data.showId !== SHOW) return deny(); checkInByBookingRef;`],
  [
    'route writes the timestamp',
    `await docRef.update({ checkedInAt: Timestamp.now() }); checkInByBookingRef;`,
  ],
  ['no delegation at all', `const snap = await db.collection('tickets').get();`],
];

const selfTestFailures = [];
if (judge(COMPLIANT).length !== 0) {
  selfTestFailures.push(`detector rejects a compliant route: ${judge(COMPLIANT).join('; ')}`);
}
for (const [name, fixture] of ESCAPES) {
  if (judge(fixture).length === 0) selfTestFailures.push(`detector fails to catch: ${name}`);
}
if (selfTestFailures.length > 0) {
  console.error('FAIL: A14 detector self-test — this check can no longer discriminate');
  for (const f of selfTestFailures) console.error(`  - ${f}`);
  process.exit(1);
}

// --- the real file ----------------------------------------------------------
const problems = judge(readFileSync(ROUTE_PATH, 'utf8'));
if (problems.length > 0) {
  console.error('FAIL: A14 app/api/admin/checkin/route.ts still owns admission logic');
  for (const p of problems) console.error(`  - the route ${p}`);
  console.error(
    '  see contracts/golden/ticketing-hardening/checkin-admission-rules.golden.md (required module boundary)'
  );
  process.exit(1);
}
console.log('PASS: A14 the check-in route delegates all admission logic to lib/checkin.ts');

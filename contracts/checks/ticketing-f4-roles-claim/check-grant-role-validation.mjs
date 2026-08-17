#!/usr/bin/env node
// F4 (ticketing-foundation) — admin-grant.ts's role-name validation, proven by real
// validateGrantArgs() calls (spec §5.6: "no defaults for either" role or show; "the script
// validates the role name against the live mapping and refuses to grant an unrecognised name
// outright"). scripts/admin-grant.ts must call this exact function on its real validation
// path — this is not a grep of admin-grant.ts's source.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f4-roles-claim/check-grant-role-validation.mjs

import { validateGrantArgs } from '../../../lib/admin-grant-validation.ts';

const failures = [];

function expectOk(label, args) {
  const result = validateGrantArgs(args);
  if (!result.ok) {
    failures.push(`${label}: expected ok:true, got ok:false (reason: ${result.reason}).`);
  }
}

function expectRefused(label, args, mustMention) {
  const result = validateGrantArgs(args);
  if (result.ok) {
    failures.push(`${label}: expected ok:false, got ok:true.`);
    return;
  }
  if (mustMention && !result.reason.includes(mustMention)) {
    failures.push(
      `${label}: refusal reason '${result.reason}' does not mention '${mustMention}'.`,
    );
  }
}

// Empty roles is refused — no default role.
expectRefused('empty roles', { roles: [], show: 'nationalShow' });

// Empty show is refused — no default show.
expectRefused('empty show', { roles: ['manager'], show: '' });

// An unrecognised role name is refused, with that name identifiable in the reason.
expectRefused(
  'unrecognised role name',
  { roles: ['ticketing-secretary'], show: 'nationalShow' },
  'ticketing-secretary',
);

// Real roles with a real show scope is accepted.
expectOk('real role, real show', { roles: ['manager'], show: 'nationalShow' });

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: validateGrantArgs() refuses missing roles, missing show, and unrecognised role names, ' +
    'and accepts a real role at a real show scope — proven live against the grant script\'s ' +
    'real validation function.',
);
process.exit(0);

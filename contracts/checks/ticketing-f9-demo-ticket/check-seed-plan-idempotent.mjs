#!/usr/bin/env node
// F9 (ticketing-foundation) — planDemoTicketTypeSeed() (lib/demo-ticket-type-seed-plan.ts) is
// a PURE, offline decision function mirroring F4's parseMigrationArgs() dry-run-safety
// pattern: it computes what the real (unasserted, I/O-performing)
// scripts/seed-demo-ticket-type.ts WOULD write, given injected existing-document state,
// without ever touching a real Sanity client. NO CHECK IN THIS FILE CREATES A DOCUMENT.
//
// Also proves the two judgement calls named in the golden README: the seed price is NONZERO
// (spec §4.5 — a R0 ticket type takes the comp-bypass path around PayFast entirely, which
// would make F12's real-gateway proof hollow) and per-show uniqueness (an existing demo doc
// for a DIFFERENT show must not block seeding this show's own copy).
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f9-demo-ticket/check-seed-plan-idempotent.mjs

import { planDemoTicketTypeSeed } from '../../../lib/demo-ticket-type-seed-plan.ts';
import { DEMO_TICKET_TYPE_SLUG } from '../../../lib/demo-ticket-type.ts';

const failures = [];

const preExistingRealTypes = [
  { _id: 'ticketType-adult', slug: 'adult', show: { _ref: 'show-19-2027' } },
  { _id: 'ticketType-child', slug: 'child', show: { _ref: 'show-19-2027' } },
];

// (1) No existing demo doc for this show -> plan creates one, scoped correctly, nonzero price
// and capacity, carrying the reserved slug and the demo boolean, and active.
let created;
{
  const plan = planDemoTicketTypeSeed({
    activeShowId: 'show-19-2027',
    existingTicketTypes: preExistingRealTypes,
  });
  if (plan.action !== 'create') {
    failures.push(`(1) expected action 'create' with no existing demo doc, got '${plan.action}'.`);
  } else {
    created = plan.document;
    if (created.slug?.current !== DEMO_TICKET_TYPE_SLUG) {
      failures.push('(1a) planned document slug does not match DEMO_TICKET_TYPE_SLUG.');
    }
    if (created.demo !== true) {
      failures.push('(1b) planned document `demo` flag is not true.');
    }
    if (created.show?._ref !== 'show-19-2027') {
      failures.push('(1c) planned document is not scoped to the injected activeShowId.');
    }
    if (!(created.price > 0)) {
      failures.push(
        `(1d) planned document price is ${created.price} — must be > 0 (spec §4.5: a R0 ticketType takes the comp-bypass path around PayFast, which would make F12's real-gateway proof hollow).`,
      );
    }
    if (!(created.capacity > 0)) {
      failures.push(
        `(1e) planned document capacity is ${created.capacity} — must be > 0 (an unusable capacity is refused pre-write by checkout's own isUsableAmount() gate).`,
      );
    }
    if (created.active !== true) {
      failures.push('(1f) planned document is not active — it would never be selectable by ticketTypeBySlugQuery.');
    }
  }
}

// (2) An existing demo doc for the SAME show already present -> idempotent skip, no second
// document planned. Feeds (1)'s own planned document back in as "already-existing" state,
// exactly as a second real run of scripts/seed-demo-ticket-type.ts would see it.
{
  if (created) {
    const secondRunExisting = [
      ...preExistingRealTypes,
      { _id: created._id, slug: created.slug.current, show: created.show },
    ];
    const plan = planDemoTicketTypeSeed({
      activeShowId: 'show-19-2027',
      existingTicketTypes: secondRunExisting,
    });
    if (plan.action !== 'skip-exists') {
      failures.push(
        `(2) expected action 'skip-exists' on a second run against the same show, got '${plan.action}' — a non-idempotent seed script would create a duplicate demo ticketType on every run.`,
      );
    } else if (plan.existingId !== created._id) {
      failures.push(`(2b) skip-exists reported existingId '${plan.existingId}', expected '${created._id}'.`);
    }
  } else {
    failures.push('(2) skipped — case (1) did not produce a document to feed back in.');
  }
}

// (3) Per-show uniqueness: an existing demo doc for a DIFFERENT (e.g. archived) show must NOT
// block seeding a fresh demo ticketType for the current active show — a global slug-only dedup
// would wrongly skip here.
{
  const existingForOldShow = [
    { _id: 'ticketType-demo-show-18-2025', slug: DEMO_TICKET_TYPE_SLUG, show: { _ref: 'show-18-2025' } },
  ];
  const plan = planDemoTicketTypeSeed({
    activeShowId: 'show-19-2027',
    existingTicketTypes: existingForOldShow,
  });
  if (plan.action !== 'create') {
    failures.push(
      `(3) an archived show's demo ticketType wrongly blocked seeding show-19-2027's own copy — expected action 'create', got '${plan.action}'.`,
    );
  } else if (plan.document.show?._ref !== 'show-19-2027') {
    failures.push('(3b) the newly planned document is not scoped to the current active show.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: planDemoTicketTypeSeed() is a pure, offline, idempotent decision function — creates " +
    'exactly once per show, skips on a second run against the same show, does not let an ' +
    "archived show's demo doc block a fresh one, and always plans a nonzero price/capacity, " +
    'active document.',
);
process.exit(0);

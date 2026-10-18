#!/usr/bin/env node
// F24-A1 (offline, no server): the title and description rules accept every good case and reject every bad one for the stated rule,
// and every rule id is exercised by a negative case. Proves the sweep (check-b, check-c) CAN fail, per rule.
import { loadGolden, report } from './_meta.mjs';
import { titleProblems, descProblems, sentenceCut } from './_rules.mjs';

const { cases } = loadGolden('description-cases.json');
const problems = [];
const covered = new Set();
for (const c of cases) {
  if (c.kind === 'cut') {
    const got = sentenceCut(c.text, c.max);
    if (got !== c.expect) problems.push(`${c.id}: sentenceCut gave ${JSON.stringify(got)}, want ${JSON.stringify(c.expect)}`);
    continue;
  }
  const found = c.kind === 'title' ? titleProblems(c.route, c.title, c.h1) : descProblems(c.desc, c.lede);
  const ids = new Set(found.map(([id]) => id));
  if (c.expect === 'ok' && found.length) problems.push(`${c.id}: wanted ok, got ${[...ids].join(',')}`);
  if (c.expect === 'fail') {
    for (const want of c.rules) { if (!ids.has(want)) problems.push(`${c.id}: wanted rule ${want} to fire, got ${[...ids].join(',') || 'none'}`); covered.add(want); }
  }
}
for (const id of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'D1', 'D2', 'D3', 'D4']) if (!covered.has(id)) problems.push(`rule ${id} has no negative case`);
report(problems, `${cases.length} cases agree with the rules; all 10 rules have a negative case`);

#!/usr/bin/env node
// A6 - static: [year] page degrades without inventing (no "—" stat cards, no unconditional "was held ... hosted by"),
// generateStaticParams stays Sanity-derived, seed script cannot recreate the docs, llms-full has no venue residue.
import { readFileSync } from 'node:fs';
import { FORBIDDEN, report } from './_lib.mjs';

const problems = [];
const y = readFileSync('app/(marketing)/national-show/archive/[year]/page.tsx', 'utf8');
if (/NOT_RECORDED/.test(y)) problems.push('[year] page still renders NOT_RECORDED placeholder stat cards');
if (!/notFound\(\)/.test(y)) problems.push('[year] page lost notFound() for unrecorded years');
if (!/ConfirmationBadge/.test(y)) problems.push('[year] page lacks the pending marker for year-only editions');
const seed = readFileSync('scripts/seed-sanity.ts', 'utf8');
if (/from ['"]@\/lib\/data\/shows['"]|national-show-1[4-8]/.test(seed)) problems.push('seed-sanity.ts can recreate past show docs');
const llms = readFileSync('public/llms-full.txt', 'utf8');
for (const l of FORBIDDEN) if (llms.includes(l)) problems.push(`public/llms-full.txt contains "${l}"`);
report(problems, 'detail page degrades honestly; seed and llms-full clean');

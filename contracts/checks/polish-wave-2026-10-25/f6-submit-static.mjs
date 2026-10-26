// F6 static (/events/submit). The authenticated page cannot be reached without a Firebase session, so
// the body is extracted into components/events/SubmitEventPageBody.tsx and rendered for the check by an
// env-gated fixture route, following the admin-fixtures precedent (app/admin-fixtures/[route]/page.tsx).
//   SF-1  a "Host society" select fed by a `societies` prop; option value is the document id, option text
//         the name; no label or text that mentions an ID, Sanity or a document
//   SF-2  the page body is PageHero + the form; the fixture route exists, is force-dynamic, 404s unless
//         EVENT_SUBMIT_FIXTURES === '1', and that flag appears in no deploy or example env file
// Run as: node contracts/checks/polish-wave-2026-10-25/f6-submit-static.mjs   (POLISH_ROOT optional)
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { finish, read, repoRoot, tags } from './_lib.mjs';

const failures = [];
const tryRead = (rel) => { try { return read(rel); } catch (e) { failures.push(e.message); return ''; } };
const form = tryRead('components/events/SubmitEventForm.tsx');
if (/Sanity|document ID|Host society ID|hostSocietyId.*optional —/i.test(form.replace(/hostSocietyId/g, 'hostSociety_'))) failures.push('SubmitEventForm still mentions Sanity / a document ID in its markup or copy');
if (!/societies:\s*ReadonlyArray<\{\s*id:\s*string;\s*name:\s*string\s*\}>/.test(form)) failures.push('SubmitEventForm has no `societies: ReadonlyArray<{ id: string; name: string }>` prop');
if (!/<label[^>]*htmlFor="hostSocietyId"[^>]*>\s*Host society\b/.test(form)) failures.push('no <label htmlFor="hostSocietyId"> that starts with "Host society"');
const selects = tags(form, 'select').filter((t) => /id="hostSocietyId"/.test(t));
if (selects.length !== 1) failures.push(`expected one <select id="hostSocietyId">, found ${selects.length}`);
if (!/societies\.map\(\(\w+\) => \(?\s*<option[^>]*value=\{\w+\.id\}[^>]*>\s*\{\w+\.name\}/s.test(form)) failures.push('options are not societies.map(...) with value={s.id} and text {s.name}');
if (/<input[^>]*id="hostSocietyId"/.test(form)) failures.push('the free-text hostSocietyId input is still there');

const body = tryRead('components/events/SubmitEventPageBody.tsx');
if (!/<(PageHero|RouteHero)\b/.test(body)) failures.push('SubmitEventPageBody does not render PageHero or RouteHero');
if (!/<SubmitEventForm\b/.test(body)) failures.push('SubmitEventPageBody does not render SubmitEventForm');
const page = tryRead('app/(marketing)/events/submit/page.tsx');
if (!/<SubmitEventPageBody\b/.test(page)) failures.push('events/submit/page.tsx does not render SubmitEventPageBody');
if (!/societyListQuery/.test(page)) failures.push('events/submit/page.tsx does not load societies with societyListQuery');
// LoginPrompt (Members only) is out of scope tonight (see goldens/README.md follow-ups); scan the authenticated branch only.
const pageAuthed = page.replace(/function LoginPrompt\(\)[\s\S]*?\n\}\n/, '');
if (/text-2xl font-semibold|text-gray-/.test(pageAuthed + body + form)) failures.push('gray/Tailwind-default styling is still in the page body or form (text-gray-*, text-2xl font-semibold)');

const fixturePath = 'app/events-fixtures/submit/page.tsx';
if (!existsSync(resolve(repoRoot, fixturePath))) failures.push(`${fixturePath} does not exist`);
else {
  const fx = tryRead(fixturePath);
  if (!/export const dynamic = 'force-dynamic'/.test(fx)) failures.push('fixture route is not force-dynamic');
  if (!/process\.env\.EVENT_SUBMIT_FIXTURES !== '1'/.test(fx) || !/notFound\(\)/.test(fx)) failures.push("fixture route does not notFound() unless EVENT_SUBMIT_FIXTURES === '1'");
  if (!/<SubmitEventPageBody\b/.test(fx)) failures.push('fixture route does not render SubmitEventPageBody');
}
for (const rel of ['apphosting.yaml', '.env.local.example', 'firebase.json', 'next.config.ts']) {
  const p = resolve(repoRoot, rel);
  if (existsSync(p) && readFileSync(p, 'utf8').includes('EVENT_SUBMIT_FIXTURES')) failures.push(`${rel} must not mention EVENT_SUBMIT_FIXTURES`);
}
finish('f6-submit-static', failures);

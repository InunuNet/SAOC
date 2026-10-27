// F7 static (/events/submit success message). The success state was a bare `text-green-700 text-sm` paragraph,
// a Tailwind palette default that exists nowhere in the design system (no green or success token is in
// app/globals.css or the handoff). It becomes the site's own success panel: the border/background/padding and the
// body type of the contact and members success panels (read here from components/members/SuggestionForm.tsx, so the
// two cannot drift), around the same single sentence. No heading, no new copy.
// The authenticated page cannot be reached without a Firebase session and the success state needs a POST, so this
// feature is gated statically (see goldens/f7-submit-success.md for the limit).
// Run as: node contracts/checks/polish-wave-2-2026-10-25/f7-success-static.mjs   (POLISH_ROOT optional)
import { finish, read } from './_lib.mjs';

const failures = [];
const ref = read('components/members/SuggestionForm.tsx');
const panel = ref.match(/<div className="(border border-rule bg-parchment p-8)">/)?.[1];
const body = ref.match(/<p className="(mt-3 font-sans text-\[16px\] leading-\[1\.55\] text-ink\/80)">/)?.[1];
if (!panel || !body) failures.push('reference success panel not found in SuggestionForm.tsx');
const bodyType = body?.replace(/^mt-3 /, '');

const form = read('components/events/SubmitEventForm.tsx');
const start = form.indexOf("if (status === 'success')");
if (start < 0) failures.push("no `if (status === 'success')` branch in SubmitEventForm");
else {
  const end = form.indexOf('\n  }\n', start);
  const block = form.slice(start, end);
  if (/text-green|text-emerald|text-sm\b|text-red/.test(block)) failures.push('the success branch still uses a Tailwind palette colour or text-sm');
  if (panel && !block.includes(`className="${panel}"`)) failures.push(`the success branch has no panel with className="${panel}"`);
  if (bodyType && !block.includes(bodyType)) failures.push(`the success paragraph does not use "${bodyType}"`);
  if (!/<p\b[^>]*role="status"/.test(block)) failures.push('the success paragraph lost role="status"');
  if (!block.includes('Submitted for council review. Thank you — we will be in touch.')) failures.push('the success sentence changed');
  if (/<h[1-6]\b/.test(block)) failures.push('the success branch gained a heading (new copy)');
  if ((block.match(/<p\b/g) ?? []).length !== 1) failures.push('the success branch must hold exactly one paragraph');
}
finish('f7-success-static', failures);

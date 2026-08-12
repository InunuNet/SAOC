#!/usr/bin/env node
// A9 — F6: sanity/lib/image.ts must use the NAMED export.
//
// @sanity/image-url 2.1.1 marks its default export deprecated
// (`@deprecated Use the named export createImageUrlBuilder instead of the default
// export`, node_modules/@sanity/image-url/lib/index.d.ts:37) and wraps it in
// defineDeprecated(), which logs a warning on every call — i.e. on every home-page
// render in dev.
//
// The grep half is legitimate here: "which import form is used" is a structural fact
// about a source file with no rendered surface. The behavioural half is what stops
// the change being cosmetic — after switching import forms, urlFor() must still
// produce working Sanity CDN URLs, proven by fetching the home page (whose Hero
// resolves its images through urlFor) and confirming a cdn.sanity.io URL is present.
//
// Verified live 2026-08-11 pre-implementation: the home page already serves 1+
// cdn.sanity.io URL, so the behavioural half passes today and exists purely to catch
// a botched refactor. The grep half fails today (the file uses the default import).

import fs from 'node:fs';
import { fetchPage, assertDevServerUp, installCrashGuard, pass, fail } from './_shared.mjs';

installCrashGuard('check-image-url-import');

const FILE = 'sanity/lib/image.ts';

await assertDevServerUp();

const failures = [];

if (!fs.existsSync(FILE)) fail(`${FILE} is missing`);
const src = fs.readFileSync(FILE, 'utf8');

// A default import is `import X from '@sanity/image-url'` — no braces before `from`.
if (/^\s*import\s+(?!type\b)[A-Za-z_$][\w$]*\s+from\s+['"]@sanity\/image-url['"]/m.test(src)) {
  failures.push(
    `${FILE} still uses the deprecated DEFAULT import from @sanity/image-url. Use the named ` +
      "export instead: import { createImageUrlBuilder } from '@sanity/image-url';"
  );
}

if (!/import\s*\{[^}]*\bcreateImageUrlBuilder\b[^}]*\}\s*from\s*['"]@sanity\/image-url['"]/.test(src)) {
  failures.push(`${FILE} does not import the named \`createImageUrlBuilder\` export.`);
}

// The type-only import of SanityImageSource is fine and must survive.
if (!/import\s+type\s*\{[^}]*SanityImageSource[^}]*\}/.test(src)) {
  failures.push(`${FILE} lost its \`SanityImageSource\` type import.`);
}

// Behavioural half: urlFor() must still build real CDN URLs.
const home = await fetchPage('/');
if (home.status !== 200) {
  failures.push(`/ returned ${home.status}, expected 200`);
} else if (!home.html.includes('cdn.sanity.io')) {
  failures.push(
    'the home page no longer contains any cdn.sanity.io image URL — urlFor() stopped producing ' +
      'working URLs after the import change. This is the failure the grep alone would miss.'
  );
}

if (failures.length > 0) {
  fail(`image-url import — ${failures.length} problem(s):\n  - ${failures.join('\n  - ')}`);
}
pass('sanity/lib/image.ts uses the named export and urlFor() still builds working CDN URLs.');

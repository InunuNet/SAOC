// F8 (ticketing-complete M4) -- contract-f8.yaml A9, negative control A20.
//
// RUNTIME PROOF that every route the morning-review walkthrough tells Brad to visit actually
// resolves against a REAL LOCAL dev server -- never a deployed/live origin (that is an explicit
// contract requirement, this script refuses to run against anything but localhost/127.0.0.1).
// A claimed route that 404s is worse than no route claim at all -- the same standard F6's own
// A6/A7 apply to nav hrefs.
//
// Extracts every `/`-rooted path referenced inside fenced code blocks (``` ... ```), inline
// backtick spans (`...`), OR a markdown hyperlink target (`[label](/route)`) in the
// walkthrough doc -- WIDENED 2026-09-08 (architect) to add markdown-link extraction after the
// original backtick/fenced-only reading left a real gap: a route named only as
// `[Tickets hub](/tickets)` was never checked, making coverage depend on which formatting a
// future doc author happened to use rather than on what the doc actually tells Brad to visit.
// A route named through any of the three surfaces is skipped if explicitly listed in the
// pending-NOS fixture (honestly disclosed as not-yet-built, per F6's own A12), and every
// remaining route must return a non-error status from the local dev server.
//
// HTML comments (`<!-- ... -->`) are stripped before any extraction runs -- a route string or
// link-syntax example mentioned only in an explanatory comment must never be mistaken for a
// route the doc actually tells Brad to visit (the same comment-vs-real-content trap this
// mission's own negative fixtures have hit while being drafted).
//
// Usage:
//   node verify-walkthrough-routes.mjs <walkthrough.md> <f6-pending-nos-routes.json>
//
// Exit 0 = every non-skipped route resolved. Exit 1 = at least one route 404'd/errored, the
// dev server is unreachable, or an input could not be read/parsed (fail closed).

import { readFile } from 'node:fs/promises';

const DEFAULT_DEV_SERVER_URL = 'http://localhost:3002';

function fail(message) {
  console.error('FAIL: verify-walkthrough-routes.mjs');
  console.error(`  - ${message}`);
  process.exit(1);
}

function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

function extractBacktickSpans(text) {
  const spans = [];
  const fencedRe = /```[\s\S]*?```/g;
  let match;
  while ((match = fencedRe.exec(text)) !== null) {
    spans.push(match[0]);
  }
  // Strip fenced blocks before scanning for inline spans so a fenced block's own backticks
  // aren't re-matched as (broken) inline spans.
  const withoutFenced = text.replace(fencedRe, '');
  const inlineRe = /`([^`\n]+)`/g;
  while ((match = inlineRe.exec(withoutFenced)) !== null) {
    spans.push(match[0]);
  }
  return spans;
}

// Markdown hyperlink targets: `[label](target)`. Only the target (group 2) is a candidate --
// the label text is prose, not a route claim.
function extractMarkdownLinkTargets(text) {
  const targets = [];
  const linkRe = /\[[^\]]*\]\(([^)\s]+)\)/g;
  let match;
  while ((match = linkRe.exec(text)) !== null) {
    targets.push(match[1]);
  }
  return targets;
}

function extractRoutesFromSpans(spans) {
  const routes = new Set();
  // A path-shaped token: starts with a single '/', then word chars/hyphens/further '/'
  // segments. Deliberately excludes '//' (protocol-relative URLs) and query strings/hashes.
  const pathTokenRe = /(?<!\/)\/[A-Za-z0-9][A-Za-z0-9\-_/]*/g;
  for (const span of spans) {
    let match;
    while ((match = pathTokenRe.exec(span)) !== null) {
      // Trim a trailing slash so '/tickets/' and '/tickets' dedupe to the same route.
      const route = match[0].replace(/\/+$/, '') || '/';
      routes.add(route);
    }
  }
  return [...routes];
}

function extractRoutesFromLinkTargets(targets) {
  const routes = new Set();
  for (const target of targets) {
    // A local, path-rooted target only -- excludes http(s)/mailto links, protocol-relative
    // '//' targets, and pure-anchor '#...' fragments.
    if (!/^\/[A-Za-z0-9]/.test(target)) continue;
    const withoutHash = target.split('#')[0].split('?')[0];
    const route = withoutHash.replace(/\/+$/, '') || '/';
    if (route) routes.add(route);
  }
  return [...routes];
}

function assertLocalOrigin(url) {
  const parsed = new URL(url);
  if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    fail(
      `refusing to check routes against non-local origin ${url} -- this check must only run ` +
        'against a real local dev server, never a deployed/live origin (contract-f8.yaml A9/A17)'
    );
  }
}

async function main() {
  const [docPath, skipListPath] = process.argv.slice(2);
  if (!docPath || !skipListPath) {
    fail(
      'expected exactly 2 arguments: <walkthrough.md> <f6-pending-nos-routes.json>, got ' +
        `${process.argv.length - 2}`
    );
  }

  let docText;
  try {
    docText = await readFile(docPath, 'utf8');
  } catch (err) {
    fail(`could not read walkthrough doc at ${docPath}: ${err.message}`);
  }

  let skipListRaw;
  try {
    skipListRaw = await readFile(skipListPath, 'utf8');
  } catch (err) {
    fail(`could not read pending-NOS-routes fixture at ${skipListPath}: ${err.message}`);
  }

  let skipList;
  try {
    skipList = JSON.parse(skipListRaw);
  } catch (err) {
    fail(`pending-NOS-routes fixture at ${skipListPath} is not valid JSON: ${err.message}`);
  }

  if (!Array.isArray(skipList.pendingRoutes)) {
    fail(`pending-NOS-routes fixture at ${skipListPath} has no 'pendingRoutes' array`);
  }
  const skipSet = new Set(skipList.pendingRoutes);

  const devServerUrl = process.env.F8_DEV_SERVER_URL || DEFAULT_DEV_SERVER_URL;
  assertLocalOrigin(devServerUrl);

  const docTextNoComments = stripHtmlComments(docText);
  const spans = extractBacktickSpans(docTextNoComments);
  const linkTargets = extractMarkdownLinkTargets(docTextNoComments);
  const routes = [
    ...new Set([...extractRoutesFromSpans(spans), ...extractRoutesFromLinkTargets(linkTargets)]),
  ];

  if (routes.length === 0) {
    fail(
      `no '/'-rooted route found in any backtick span, fenced code block, or markdown link ` +
        `target in ${docPath}`
    );
  }

  const failures = [];
  const skipped = [];
  const checked = [];

  for (const route of routes) {
    if (skipSet.has(route)) {
      skipped.push(route);
      continue;
    }
    const target = `${devServerUrl}${route}`;
    try {
      const res = await fetch(target, { redirect: 'manual' });
      // A 3xx redirect (e.g. trailing-slash normalization) still proves the route resolves;
      // only treat 4xx/5xx as a broken claim.
      if (res.status >= 400) {
        failures.push(`${route} -> HTTP ${res.status} (${target})`);
      } else {
        checked.push(`${route} -> HTTP ${res.status}`);
      }
    } catch (err) {
      failures.push(
        `${route} -> request failed (${target}): ${err.message} -- is the local dev server ` +
          `running at ${devServerUrl}?`
      );
    }
  }

  if (failures.length > 0) {
    console.error('FAIL: verify-walkthrough-routes.mjs');
    for (const f of failures) console.error(`  - ${f}`);
    if (skipped.length > 0) {
      console.error(`  (skipped ${skipped.length} pending-NOS route(s): ${skipped.join(', ')})`);
    }
    process.exit(1);
  }

  console.log(
    `PASS: ${checked.length} route(s) resolved against ${devServerUrl}` +
      (skipped.length > 0 ? `, ${skipped.length} pending-NOS route(s) correctly skipped.` : '.')
  );
}

main();

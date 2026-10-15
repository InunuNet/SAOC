#!/usr/bin/env node
// nos-provenance-fix F2 (H1) — the files the server reads at runtime ARE traced.
//
// Usage: node contracts/checks/trace-excludes/check-required-traced.mjs [projectRoot]
//
// The only runtime filesystem reader in the app is lib/data/show-pages.ts
// (sourceFileExists / readSourceTextForLinkage), reached through loadShowPageOrFallback()
// by the six gated national-show routes below. Each of those route traces must carry every
// tracked content/drive-recovered/**/content.md — the council sources the provenance gate
// links against. Excluding them would silently flip clean council sections to the
// "AI-generated placeholder" notice. Exit 0 = all present, 1 = something missing, 2 = no build.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());
const GATED_ROUTES = [
  'international-guests',
  'programme',
  'sa-exhibitors',
  'sponsors',
  'symposium',
  'wosa-conference',
];
const ROUTE_TRACE = (slug) =>
  path.join(root, '.next', 'server', 'app', '(marketing)', 'national-show', slug, 'page.js.nft.json');

function contentMdUnder(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...contentMdUnder(full));
    else if (entry.name === 'content.md') out.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return out;
}

const required = contentMdUnder(path.join(root, 'content', 'drive-recovered')).sort();
if (required.length === 0) {
  console.error('check-required-traced: no content/drive-recovered/**/content.md found — nothing to prove');
  process.exit(2);
}

// Also guard the gate's lib against a silent rename: if lib/data/show-pages.ts stops being
// the runtime reader, this check's premise is stale and must be revisited, not passed.
const showPagesSrc = readFileSync(path.join(root, 'lib', 'data', 'show-pages.ts'), 'utf8');
if (!showPagesSrc.includes("'content/drive-recovered'")) {
  console.error('check-required-traced: lib/data/show-pages.ts no longer names content/drive-recovered — premise changed');
  process.exit(1);
}

let failed = false;
for (const slug of GATED_ROUTES) {
  const traceFile = ROUTE_TRACE(slug);
  if (!existsSync(traceFile)) {
    console.error(`MISSING TRACE: ${path.relative(root, traceFile)} — run pnpm build first`);
    process.exit(2);
  }
  const trace = JSON.parse(readFileSync(traceFile, 'utf8'));
  const traced = new Set(
    (trace.files ?? []).map((f) => path.relative(root, path.resolve(path.dirname(traceFile), f)).split(path.sep).join('/')),
  );
  const missing = required.filter((r) => !traced.has(r));
  if (missing.length) {
    failed = true;
    console.log(`FAIL /national-show/${slug}: ${missing.length}/${required.length} required files not traced`);
    missing.forEach((m) => console.log(`  - ${m}`));
  } else {
    console.log(`ok   /national-show/${slug}: all ${required.length} drive-recovered content.md traced`);
  }
}
process.exit(failed ? 1 : 0);

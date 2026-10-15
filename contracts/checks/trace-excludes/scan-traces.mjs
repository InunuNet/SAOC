#!/usr/bin/env node
// nos-provenance-fix F2 (H1) — scan every Next build trace for files that must never ship.
//
// Usage: node contracts/checks/trace-excludes/scan-traces.mjs [projectRoot]
//
// Walks EVERY *.nft.json under <root>/.next (route traces, next-server, next-minimal-server),
// resolves each traced entry to a project-relative path, and fails if any entry lands in a
// forbidden tree or matches a forbidden file pattern. When a standalone build exists
// (NEXT_PRIVATE_STANDALONE=true, what App Hosting deploys), it ALSO walks every file actually
// copied into .next/standalone — the shipped image itself — with the same rules. Prints counts
// and offending PATHS only, never file contents.
// Exit 0 = clean, 1 = forbidden file traced or shipped, 2 = no build / no traces.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());
const distDir = path.join(root, '.next');

// Trees that hold private docs, client source documents, harness code, agent memory or
// build tooling — none is read by the server at runtime (the only runtime fs reader is
// lib/data/show-pages.ts, which reads content/drive-recovered and content/drive-source).
const FORBIDDEN_TREES = [
  'content/drive-source/',
  'content/drive-watch/',
  'documents/',
  'docs/',
  'execution/',
  '.agent/',
  'contracts/',
  'design/',
  'design spec/',
  'branding/',
  'Plans/',
  'MEMORY/',
  'template/',
  'scripts/',
  'e2e/',
  'functions/',
  '.claude/',
  '.gemini/',
  '.grok/',
  '.golden/',
  '.github/',
  '.tmp/',
  '.anti/',
  '.scratch-render/',
  '.vscode/',
  'test-results/',
];

// The only project-root dot-entry a server trace or the standalone image may contain.
const ROOT_DOT_ALLOW = new Set(['.next']);

// File patterns forbidden anywhere in the project tree (node_modules included — a .env or
// .docx there is still not something the server should carry).
const FORBIDDEN_FILES = [
  { name: '*.docx', test: (p) => /\.docx$/i.test(p) },
  { name: '.env*', test: (p) => /(^|\/)\.env[^/]*$/.test(p) },
  { name: '*.pem', test: (p) => /\.pem$/i.test(p) },
  { name: '*.key', test: (p) => /\.key$/i.test(p) },
  { name: '.sops.yaml', test: (p) => /(^|\/)\.sops\.yaml$/.test(p) },
  { name: '.firebaserc', test: (p) => /^\.firebaserc$/.test(p) },
  // Catch-all: ANY project-root dot-entry (file or directory) except the build output itself.
  // Root dot-entries in this repo are agent, editor, CI or deploy config; a new one added later
  // is caught here without anyone remembering to extend the list above.
  { name: 'root dot-entry', test: (p) => /^\.[^/]+/.test(p) && !ROOT_DOT_ALLOW.has(p.split('/')[0]) },
  { name: 'apphosting*.yaml', test: (p) => /(^|\/)apphosting[^/]*\.yaml$/.test(p) && !p.startsWith('node_modules/') },
  // Project-root agent/ops files (comms board, agent instructions, harness scripts, contracts).
  // Root only: a README.md inside node_modules is a package's, not ours.
  { name: 'root *.md', test: (p) => /^[^/]+\.md$/.test(p) },
  { name: 'root *.sh', test: (p) => /^[^/]+\.sh$/.test(p) },
  { name: 'root contract*.yaml', test: (p) => /^contract[^/]*\.yaml$/.test(p) },
  { name: 'root issues.json / WORKSPACE / Makefile', test: (p) => /^(issues\.json|WORKSPACE|Makefile)$/.test(p) },
];

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'cache') continue; // .next/cache holds no traces
      if (entry.name === 'standalone') continue; // copies of the traces; scanned as files below
      walk(full, out);
    } else if (entry.name.endsWith('.nft.json')) {
      out.push(full);
    }
  }
  return out;
}

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error(`scan-traces: no build at ${distDir} — run pnpm build first`);
  process.exit(2);
}

const traceFiles = walk(distDir, []);
if (traceFiles.length === 0) {
  console.error('scan-traces: no *.nft.json found under .next — cannot prove anything');
  process.exit(2);
}

const offenders = new Map(); // label -> Set(reason)
function judge(rel, label) {
  const reasons = [];
  for (const t of FORBIDDEN_TREES) if (rel.startsWith(t)) reasons.push(`tree ${t}`);
  for (const p of FORBIDDEN_FILES) if (p.test(rel)) reasons.push(`file ${p.name}`);
  if (reasons.length) {
    if (!offenders.has(label)) offenders.set(label, new Set());
    reasons.forEach((r) => offenders.get(label).add(r));
  }
}

let entries = 0;
for (const traceFile of traceFiles) {
  const trace = JSON.parse(readFileSync(traceFile, 'utf8'));
  const base = path.dirname(traceFile);
  for (const f of trace.files ?? []) {
    entries += 1;
    const rel = path.relative(root, path.resolve(base, f)).split(path.sep).join('/');
    if (rel.startsWith('..')) continue; // outside the project — not ours to judge
    judge(rel, rel);
  }
}

const standaloneDir = path.join(distDir, 'standalone');
let shipped = 0;
if (existsSync(standaloneDir)) {
  (function walkShipped(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkShipped(full);
      else {
        shipped += 1;
        const rel = path.relative(standaloneDir, full).split(path.sep).join('/');
        judge(rel, `[standalone] ${rel}`);
      }
    }
  })(standaloneDir);
}

console.log(`scan-traces: ${traceFiles.length} trace files, ${entries} entries scanned; ${shipped} standalone files scanned`);
if (offenders.size > 0) {
  const byReason = new Map();
  for (const reasons of offenders.values()) for (const r of reasons) byReason.set(r, (byReason.get(r) ?? 0) + 1);
  console.log(`FAIL: ${offenders.size} forbidden files traced`);
  for (const [r, n] of [...byReason].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${r}`);
  for (const rel of [...offenders.keys()].sort().slice(0, 40)) console.log(`  - ${rel}`);
  if (offenders.size > 40) console.log(`  ... ${offenders.size - 40} more`);
  process.exit(1);
}
console.log('PASS: no forbidden tree, root dot-entry, *.docx, .env*, key or sops file in any trace or in the standalone image');

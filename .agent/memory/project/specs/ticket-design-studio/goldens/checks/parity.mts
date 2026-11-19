// ticket-design-studio parity: the shipped default design must render exactly what the renderers
// rendered BEFORE the studio existed. Run from the repo root:
//   pnpm exec tsx .agent/memory/project/specs/ticket-design-studio/goldens/checks/parity.mts
// It exports the base commit (PARITY_BASE, default: merge-base of HEAD and preview/local) into a
// temp dir and renders every per-type email and one ticket PDF with that tree's renderer and with
// the current tree's (design omitted, and DEFAULT_DESIGN passed explicitly). Email HTML must match
// byte for byte; the PDF is compared as decoded page content streams (raw PDF bytes are not
// deterministic: font subset tags, ID, dates). Exits 0 on parity, 1 on any difference, 2 on setup.
// Honesty note: if the base resolves to HEAD itself the check would be vacuous, so it refuses.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DUMP = path.join(HERE, 'parity-dump.mts');
const ROOT = process.cwd();

interface Snapshot { html: Record<string, string>; ops: string }

const sh = (cmd: string, args: string[], cwd: string): string =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

function resolveBase(): string {
  const base = process.env.PARITY_BASE ?? sh('git', ['merge-base', 'HEAD', 'preview/local'], ROOT);
  if (sh('git', ['rev-parse', base], ROOT) === sh('git', ['rev-parse', 'HEAD'], ROOT)) {
    throw new Error('base commit equals HEAD: parity would compare the new code with itself');
  }
  return base;
}

function dump(tree: string, mode: string, out: string): Snapshot {
  execFileSync('pnpm', ['exec', 'tsx', DUMP, out, mode], { cwd: tree, stdio: ['ignore', 'inherit', 'inherit'] });
  return JSON.parse(readFileSync(out, 'utf8')) as Snapshot;
}

function firstDiff(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `at char ${i}: base ${JSON.stringify(a.slice(i, i + 60))} vs new ${JSON.stringify(b.slice(i, i + 60))}`;
}

function compare(label: string, base: Snapshot, next: Snapshot): number {
  let failures = 0;
  for (const key of Object.keys(base.html)) {
    if (base.html[key] !== next.html[key]) {
      console.error(`FAIL ${label} email HTML differs for ${key}: ${firstDiff(base.html[key], next.html[key] ?? '')}`);
      failures++;
    }
  }
  if (base.ops !== next.ops) {
    console.error(`FAIL ${label} ticket PDF content streams differ: ${firstDiff(base.ops, next.ops)}`);
    failures++;
  }
  return failures;
}

function main(): number {
  const work = mkdtempSync(path.join(tmpdir(), 'ticket-parity-'));
  try {
    const base = resolveBase();
    const baseTree = path.join(work, 'base');
    const tarball = path.join(work, 'base.tar');
    sh('git', ['archive', '-o', tarball, base], ROOT);
    mkdirSync(baseTree);
    sh('tar', ['-xf', tarball, '-C', baseTree], work);
    symlinkSync(path.join(ROOT, 'node_modules'), path.join(baseTree, 'node_modules'));
    const before = dump(baseTree, 'base', path.join(work, 'base.json'));
    const failures =
      compare('no-design', before, dump(ROOT, 'new', path.join(work, 'new.json'))) +
      compare('default-design', before, dump(ROOT, 'design', path.join(work, 'design.json')));
    if (failures > 0) return 1;
    console.log(`parity ok (base ${base.slice(0, 8)}, ${Object.keys(before.html).length} emails, PDF streams)`);
    return 0;
  } catch (error) {
    console.error('parity setup error:', error instanceof Error ? error.message : error);
    return 2;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
process.exit(main());

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Goldens are heterogeneous JSON read by several checks; each check indexes its own shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function golden(name: string): any {
  const path = fileURLToPath(
    new URL(`../../../.agent/memory/project/specs/ticket-onsale-predicate/goldens/${name}`, import.meta.url)
  );
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function finish(label: string, failures: string[]): never {
  if (failures.length > 0) {
    console.error(`FAIL ${label}: ${failures.length} failure(s)`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS ${label}`);
  process.exit(0);
}

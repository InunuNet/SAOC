// F30 shared offline harness. No network, no Sanity or Firestore client, no credentials.
import { readFileSync } from 'node:fs';

export const GOLDENS = '.agent/memory/project/specs/launch-weekend/goldens/f30';
export const golden = <T = Record<string, unknown>>(name: string): T =>
  JSON.parse(readFileSync(`${GOLDENS}/${name}`, 'utf8')) as T;

export function makeChecker(label: string) {
  const problems: string[] = [];
  return {
    eq(name: string, got: unknown, want: unknown) {
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        problems.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
      }
    },
    ok(name: string, cond: boolean) {
      if (!cond) problems.push(`${name}: expected true`);
    },
    finish() {
      if (problems.length > 0) {
        console.error(`FAIL ${label}\n - ${problems.join('\n - ')}`);
        process.exit(1);
      }
      console.log(`PASS ${label}`);
    },
  };
}

export function hasUndefinedOwnProp(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some(hasUndefinedOwnProp);
}

/** In-memory stand-in for the Sanity write client. Any method other than getDocument and
 *  createIfNotExists throws, so createOrReplace, patch, delete and friends fail the check. */
export function fakeSanity(seed: Record<string, Record<string, unknown>> = {}) {
  const store = new Map<string, Record<string, unknown>>(Object.entries(seed).map(([k, v]) => [k, structuredClone(v)]));
  const calls: string[] = [];
  const impl = {
    getDocument: async (id: string) => {
      calls.push(`getDocument:${id}`);
      const d = store.get(id);
      return d ? structuredClone(d) : null;
    },
    createIfNotExists: async (doc: Record<string, unknown>) => {
      calls.push(`createIfNotExists:${String(doc._id)}`);
      const id = String(doc._id);
      if (!store.has(id)) store.set(id, structuredClone(doc));
      return doc;
    },
  };
  const sanity = new Proxy(impl, {
    get(target, prop: string) {
      if (prop in target) return target[prop as keyof typeof target];
      if (prop === 'then') return undefined;
      throw new Error(`forbidden Sanity method used: ${prop}`);
    },
  });
  const writes = () => calls.filter((c) => c.startsWith('createIfNotExists'));
  return { sanity, store, calls, writes };
}

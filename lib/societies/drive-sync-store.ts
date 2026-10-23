/**
 * societies-content F1 — the two DocStore implementations behind the sync CLI: a JSON fixture
 * (used by the checks, honours and bumps `_rev`) and the live Sanity dataset. Neither deletes.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { createClient } from '@sanity/client';

import type { DocStore, ExistingDoc, WriteOp } from './drive-sync-plan';

const SANITY_API_VERSION = '2024-01-01';
const DRAFT_PREFIX = 'drafts.';
const PUBLISHED_QUERY = '*[_type == "society" && !(_id in path("drafts.**"))]';
const ALL_QUERY = '*[_type == "society"]';

function parseFixture(file: string): ExistingDoc[] {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`${file} is not a JSON array of documents`);
  return parsed as ExistingDoc[]; // shape pinned by goldens/fixtures/existing-docs.json
}

export function createFixtureStore(inputFile: string, outputFile: string | null): DocStore {
  const docs = new Map(parseFixture(inputFile).map((d) => [d._id, d]));
  let revCounter = 0;
  const nextRev = (id: string): string => `${id}-rev-${(revCounter += 1)}`;

  return {
    kind: 'fixture',
    async listPublished() {
      return [...docs.values()].map((d) => structuredClone(d));
    },
    async listAllForBackup() {
      return [...docs.values()].map((d) => structuredClone(d));
    },
    async commitAll(ops: readonly WriteOp[]) {
      const staged = new Map(docs);
      for (const op of ops) {
        if (op.kind === 'create') {
          if (!op.doc) throw new Error(`create ${op.id} has no document`);
          if (staged.has(op.id)) throw new Error(`create collision: ${op.id} already exists`);
          staged.set(op.id, { ...op.doc, _rev: nextRev(op.id) } as ExistingDoc);
          continue;
        }
        const current = staged.get(op.id);
        if (!current) throw new Error(`patch target missing: ${op.id}`);
        if (current._rev !== op.rev) {
          throw new Error(`stale revision on ${op.id}: expected ${op.rev}, found ${current._rev}`);
        }
        const next: ExistingDoc = { ...current, ...(op.set ?? {}), _rev: nextRev(op.id) };
        for (const key of op.unset ?? []) Reflect.deleteProperty(next, key);
        staged.set(op.id, next);
      }
      docs.clear();
      for (const [id, doc] of staged) docs.set(id, doc);
    },
    async finish() {
      if (outputFile) writeFileSync(outputFile, JSON.stringify([...docs.values()], null, 2));
    },
  };
}

export function createSanityStore(
  projectId: string,
  dataset: string,
  token: string | undefined,
): DocStore {
  const client = createClient({
    projectId,
    dataset,
    apiVersion: SANITY_API_VERSION,
    useCdn: false,
    token,
  });

  return {
    kind: 'sanity',
    listPublished: () => client.fetch<ExistingDoc[]>(PUBLISHED_QUERY),
    listAllForBackup: () => client.fetch<ExistingDoc[]>(ALL_QUERY),
    async commitAll(ops: readonly WriteOp[]) {
      let tx = client.transaction();
      for (const op of ops) {
        if (op.kind === 'create') {
          if (!op.doc) throw new Error(`create ${op.id} has no document`);
          // `create`, not createIfNotExists: an id collision must fail the whole transaction.
          tx = tx.create(op.doc as { _id: string; _type: string });
        } else {
          tx = tx.patch(op.id, { ifRevisionID: op.rev, set: op.set ?? {}, unset: op.unset ?? [] });
        }
      }
      await tx.commit();
    },
    async finish() {},
  };
}

/** Draft ids (`drafts.<id>`) among `docs` that shadow one of `touchedIds`. */
export function draftsShadowing(docs: readonly ExistingDoc[], touchedIds: ReadonlySet<string>): string[] {
  return docs
    .map((d) => d._id)
    .filter((id) => id.startsWith(DRAFT_PREFIX) && touchedIds.has(id.slice(DRAFT_PREFIX.length)));
}

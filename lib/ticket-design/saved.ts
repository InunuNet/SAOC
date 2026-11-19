import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadShippedDesign, validateDesign, type ShippedDesign } from './index';

const SETTINGS_DIR = path.join('lib', 'ticket-design', 'settings');
const SAFE_SLUG = /^[a-z0-9-]+$/;
const NOT_FOUND = 'ENOENT';

/**
 * The design saved on disk for a ticket type, read at call time. loadShippedDesign() uses a static
 * import fixed at module load, so after a studio save in the same process it is stale. A type with
 * no settings file falls back to loadShippedDesign(). Server only; throws on an invalid file.
 */
export async function readSavedDesign(slug: string): Promise<ShippedDesign> {
  if (!SAFE_SLUG.test(slug)) throw new Error(`readSavedDesign: invalid ticket type "${slug}"`);
  const file = path.join(process.cwd(), SETTINGS_DIR, `${slug}.json`);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === NOT_FOUND) {
      return loadShippedDesign(slug);
    }
    throw error;
  }
  return validateDesign(JSON.parse(raw));
}
